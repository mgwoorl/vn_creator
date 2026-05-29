import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  FiX, FiStar, FiMusic, FiRefreshCw, FiMaximize2, FiMinimize2,
  FiAward, FiPlay, FiUser, FiBookOpen, FiVolume2, FiVolumeX, FiVolume1
} from 'react-icons/fi'
import { useProject } from '../../context/ProjectContext'
import { useScenes } from '../../context/SceneContext'
import { usePlaythrough } from '../../context/PlaythroughContext'

// Простое логирование для отладки
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][ProjectPlayer]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Плеер визуальной новеллы для студента с сохранением прогресса прохождения
export const ProjectPlayer = ({ project, onClose }) => {
  // Состояния для навигации по сценам и выполнения
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0)
  const [executionState, setExecutionState] = useState(null)
  const [showStart, setShowStart] = useState(true)
  const [showEnd, setShowEnd] = useState(false)
  const [totalPoints, setTotalPoints] = useState(0)
  const [answers, setAnswers] = useState([])
  const [currentMusic, setCurrentMusic] = useState(null)
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [endResult, setEndResult] = useState(null)
  const [playthroughId, setPlaythroughId] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [ownerName, setOwnerName] = useState('')
  const [videoAudioEnabled, setVideoAudioEnabled] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)

  // Состояния для управления громкостью
  const [volume, setVolume] = useState(0.7)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const previousVolume = useRef(0.7)

  // Рефы для аудио, видео и DOM-элементов
  const audioRef = useRef(new Audio())
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const textContainerRef = useRef(null)
  const optionsContainerRef = useRef(null)
  const initDoneRef = useRef(false)
  const processingRef = useRef(false)
  const volumeRef = useRef(null)
  const hideTimeoutRef = useRef(null)
  const volumeSliderRef = useRef(null)
  const isDraggingRef = useRef(false)

  // Рефы для хранения актуальных значений в колбэках без замыканий
  const answersRef = useRef([])
  const totalPointsRef = useRef(0)
  const currentSceneRef = useRef(null)
  const volumeRefValue = useRef(0.7)
  const isMutedRef = useRef(false)
  const resumeNodeIdRef = useRef(null)
  const isResumedRef = useRef(false)

  // Хуки из контекстов
  const { startSceneExecution, selectOption } = useScenes()
  const { getUserById, fetchProjects } = useProject()
  const { startPlaythrough, completePlaythrough, abortPlaythrough, saveProgress } = usePlaythrough()

  const scenes = project?.scenes || []
  const currentScene = scenes[currentSceneIndex]

  // Синхронизация рефов с актуальным состоянием для использования в аудио-колбэках
  useEffect(() => { volumeRefValue.current = volume }, [volume])
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { totalPointsRef.current = totalPoints }, [totalPoints])
  useEffect(() => { currentSceneRef.current = currentScene }, [currentScene])

  // Применение громкости к аудио и видео элементам при каждом изменении
  useEffect(() => {
    const vol = isMuted ? 0 : volume
    if (audioRef.current) audioRef.current.volume = vol
    if (videoRef.current) videoRef.current.volume = vol
  }, [volume, isMuted])

  // Очистка таймера скрытия слайдера громкости при размонтировании
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  // Закрытие слайдера громкости при клике вне его области
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target)) {
        setTimeout(() => {
          if (!isDraggingRef.current) setShowVolumeSlider(false)
        }, 100)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Автоматическая настройка прокрутки контейнера с текстом
  useEffect(() => {
    if (textContainerRef.current) {
      const hasScroll = textContainerRef.current.scrollHeight > textContainerRef.current.clientHeight
      textContainerRef.current.style.overflowY = hasScroll ? 'auto' : 'visible'
    }
  }, [executionState?.current_node?.text])

  // Автоматическая настройка прокрутки контейнера с опциями
  useEffect(() => {
    if (optionsContainerRef.current) {
      const hasScroll = optionsContainerRef.current.scrollHeight > optionsContainerRef.current.clientHeight
      optionsContainerRef.current.style.overflowY = hasScroll ? 'auto' : 'visible'
    }
  }, [executionState?.current_node?.options])

  // Отслеживание входа и выхода из полноэкранного режима
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Обработчик окончания воспроизведения аудио
  useEffect(() => {
    const audio = audioRef.current
    const handleEnded = () => {
      if (!audio.loop) {
        setIsMusicPlaying(false)
        setCurrentMusic(null)
      }
    }
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Загрузка имени владельца проекта для отображения на стартовом экране
  useEffect(() => {
    const loadOwner = async () => {
      if (project?.owner_id) {
        const result = await getUserById(project.owner_id)
        if (result.success && result.user) {
          setOwnerName(`${result.user.last_name} ${result.user.first_name}`.trim())
        }
      }
    }
    loadOwner()
  }, [project?.owner_id, getUserById])

  // Инициализация прохождения при первом открытии плеера
  useEffect(() => {
    if (initDoneRef.current) return
    initDoneRef.current = true

    const init = async () => {
      setIsInitializing(true)
      log('INFO', 'Инициализация прохождения', { projectId: project.id })

      try {
        const result = await startPlaythrough(project.id)
        if (result.success) {
          setPlaythroughId(result.playthrough_id)
          log('INFO', 'Прохождение создано или восстановлено', {
            playthroughId: result.playthrough_id,
            isResumed: result.is_resumed
          })

          // Восстановление прогресса, если прохождение было прервано ранее
          if (result.is_resumed && result.context_data) {
            setTotalPoints(result.context_data.total_points || 0)
            setAnswers(result.context_data.answers || [])
            if (result.last_scene_index !== undefined && result.last_scene_index !== null) {
              setCurrentSceneIndex(result.last_scene_index)
            }
            if (result.last_node_id) resumeNodeIdRef.current = result.last_node_id
            isResumedRef.current = true
            setShowStart(false)
            log('INFO', 'Прогресс восстановлен', {
              sceneIndex: result.last_scene_index,
              nodeId: result.last_node_id
            })
          }
        } else {
          setError(result.error || 'Ошибка')
          log('ERROR', 'Ошибка инициализации прохождения', { error: result.error })
        }
      } catch (err) {
        setError('Ошибка подключения')
        log('ERROR', 'Ошибка подключения при инициализации', { error: err.message })
      } finally {
        setIsInitializing(false)
      }
    }

    init()
  }, [project.id, startPlaythrough])

  // Автоматический запуск сцены после инициализации
  useEffect(() => {
    if (!showStart && currentScene && !executionState && !loading && !isInitializing && playthroughId) {
      executeCurrentScene()
    }
  }, [currentSceneIndex, showStart, isInitializing, playthroughId])

  // Преобразование относительного пути в абсолютный URL
  const getFullUrl = useCallback((url) => {
    if (!url) return null
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return `http://localhost:8000${url}`
  }, [])

  // Переключение режима mute для звука
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      setVolume(previousVolume.current || 0.7)
    } else {
      previousVolume.current = volume
      setIsMuted(true)
    }
  }

  // Выбор иконки в зависимости от уровня громкости
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <FiVolumeX />
    if (volume < 0.5) return <FiVolume1 />
    return <FiVolume2 />
  }

  // Переключение полноэкранного режима
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // Поиск URL спрайта по имени файла (поддерживает разные форматы хранения)
  const getSpriteUrl = useCallback((spriteFile) => {
    if (!spriteFile) return null
    const sprites = project?.sprites || []
    if (!sprites.length) return null

    const sfn = spriteFile.split('/').pop()
    let s = sprites.find(x => (x.url || '').split('/').pop() === sfn)
    if (!s) s = sprites.find(x => x.filename === sfn)
    if (!s) s = sprites.find(x => x.name === sfn)
    if (!s) s = sprites.find(x => x.id === spriteFile)
    if (!s) {
      const q = sfn.toLowerCase()
      s = sprites.find(x => {
        const f = (x.filename || x.name || '').toLowerCase()
        return f === q || f.includes(q) || q.includes(f)
      })
    }
    return s ? getFullUrl(s.url) : null
  }, [project, getFullUrl])

  // Воспроизведение фоновой музыки с поддержкой зацикливания
  const playMusic = useCallback((musicFile, shouldLoop = false) => {
    if (!musicFile) return
    const musicList = project?.music || []
    if (!musicList.length) return

    const search = musicFile.toLowerCase()
    let track = musicList.find(x => (x.filename || x.name || '').toLowerCase() === search)
    if (!track) track = musicList.find(x => (x.url || '').split('/').pop().toLowerCase() === search)
    if (!track) {
      track = musicList.find(x => {
        const f = (x.filename || x.name || '').toLowerCase()
        return f.includes(search) || search.includes(f)
      })
    }
    if (!track) return

    const musicUrl = getFullUrl(track.url)
    if (!musicUrl) return

    const audio = audioRef.current

    // Если этот же трек уже играет, обновляем параметры
    if (musicUrl === currentMusic) {
      audio.loop = shouldLoop
      audio.volume = isMutedRef.current ? 0 : volumeRefValue.current
      if (audio.paused) {
        audio.play().then(() => setIsMusicPlaying(true)).catch(() => {})
      }
      return
    }

    // Переключаем на новый трек
    audio.pause()
    audio.currentTime = 0
    audio.src = musicUrl
    audio.loop = shouldLoop
    audio.volume = isMutedRef.current ? 0 : volumeRefValue.current
    audio.load()
    audio.play()
      .then(() => {
        setIsMusicPlaying(true)
        setCurrentMusic(musicUrl)
      })
      .catch(() => setIsMusicPlaying(false))

    log('INFO', 'Запуск музыки', { track: track.name || track.filename, loop: shouldLoop })
  }, [project, currentMusic, getFullUrl])

  // Полная остановка музыки и сброс состояния
  const stopMusic = useCallback(() => {
    const audio = audioRef.current
    audio.pause()
    audio.currentTime = 0
    audio.loop = false
    setIsMusicPlaying(false)
    setCurrentMusic(null)
  }, [])

  // Выполнение текущей сцены через движок
  const executeCurrentScene = async () => {
    if (!currentScene) return
    setLoading(true)
    setError(null)

    log('INFO', 'Запуск выполнения сцены', { sceneId: currentScene.id, sceneName: currentScene.name })

    try {
      const startNodeId = resumeNodeIdRef.current || null
      resumeNodeIdRef.current = null

      // Если прохождение восстановлено, передаем сохраненный контекст
      const savedContext = isResumedRef.current
        ? {
            total_points: totalPointsRef.current,
            answers: answersRef.current,
            visited_nodes: [],
            variables: {}
          }
        : null
      isResumedRef.current = false

      const result = await startSceneExecution(currentScene.id, startNodeId, savedContext)

      if (result.success && result.execution) {
        setVideoAudioEnabled(result.execution?.use_video_audio === true)
        setExecutionState(result.execution)

        if (videoRef.current) {
          videoRef.current.volume = isMutedRef.current ? 0 : volumeRefValue.current
        }

        // Если контекст не был восстановлен, применяем новый
        if (!savedContext && result.execution.context) {
          setTotalPoints(result.execution.context.total_points || 0)
          setAnswers(result.execution.context.answers || [])
        }

        const node = result.execution.current_node
        if (node?.music_file) {
          playMusic(node.music_file, node.loopMusic === true)
        }

        // Проверка на завершение сцены
        if (result.execution.status === 'end' || !result.execution.has_paths) {
          stopMusic()
          setTimeout(() => finishPlaythrough(), 100)
        }

        log('INFO', 'Сцена выполнена успешно', { status: result.execution.status })
      } else {
        setError(result.error || 'Ошибка')
        log('ERROR', 'Ошибка выполнения сцены', { error: result.error })
      }
    } catch (err) {
      setError('Ошибка соединения')
      log('ERROR', 'Ошибка соединения при выполнении сцены', { error: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Обработка выбора варианта ответа пользователем
  const handleChoice = async (option) => {
    if (!executionState || loading || processingRef.current || !playthroughId) return
    processingRef.current = true
    setLoading(true)
    setError(null)

    const currentNode = executionState.current_node
    const sceneForAnswer = currentSceneRef.current

    if (!currentNode) {
      processingRef.current = false
      setLoading(false)
      return
    }

    log('INFO', 'Выбор варианта ответа', {
      nodeId: currentNode.id,
      optionId: option.id,
      optionText: option.text
    })

    try {
      // Формируем контекст с историей ответов
      const contextData = {
        total_points: totalPointsRef.current,
        visited_nodes: [],
        answers: answersRef.current.map(a => ({
          scene_id: a.scene_id || sceneForAnswer.id,
          node_id: a.node_id || '',
          option_id: a.option_id || '',
          text: a.text || '',
          points: a.points || 0
        }))
      }

      const result = await selectOption(sceneForAnswer.id, currentNode.id, option.id, contextData)

      if (result.success && result.execution) {
        setVideoAudioEnabled(result.execution?.use_video_audio === true)
        const execution = result.execution

        if (videoRef.current) {
          videoRef.current.volume = isMutedRef.current ? 0 : volumeRefValue.current
          videoRef.current.muted = !execution?.use_video_audio
        }

        // Обновление контекста после выбора
        if (execution.context) {
          setTotalPoints(execution.context.total_points || 0)
          setAnswers((execution.context.answers || []).map(a => ({
            scene_id: a.scene_id || sceneForAnswer.id,
            node_id: a.node_id || '',
            option_id: a.option_id || '',
            text: a.text || '',
            points: a.points || 0
          })))
        }

        setExecutionState(execution)

        // Сохранение прогресса после каждого выбора
        if (saveProgress && playthroughId) {
          const nextNode = execution.current_node || executionState?.current_node
          saveProgress(
            playthroughId,
            {
              total_points: execution.context?.total_points || totalPointsRef.current,
              answers: execution.context?.answers || answersRef.current
            },
            currentSceneIndex,
            nextNode?.id || null
          ).catch(() => {})
        }

        // Обработка различных действий после выбора
        if (execution.status === 'next_scene') {
          stopMusic()
          const nextIndex = currentSceneIndex + 1
          if (nextIndex < scenes.length) {
            setCurrentSceneIndex(nextIndex)
            setExecutionState(null)
            log('INFO', 'Переход к следующей сцене', { nextIndex })
          } else {
            setTimeout(() => finishPlaythrough(), 100)
          }
        } else if (execution.status === 'end' || !execution.has_paths) {
          stopMusic()
          setTimeout(() => finishPlaythrough(), 100)
        } else if (execution.current_node) {
          const node = execution.current_node
          if (node?.music_file) {
            playMusic(node.music_file, node.loopMusic === true)
          } else {
            stopMusic()
          }
        }

        log('INFO', 'Вариант обработан', { action: execution.status })
      } else {
        setError(result.error || 'Ошибка')
        log('ERROR', 'Ошибка обработки варианта', { error: result.error })
      }
    } catch (err) {
      setError('Ошибка соединения')
      log('ERROR', 'Ошибка соединения при выборе варианта', { error: err.message })
    } finally {
      processingRef.current = false
      setLoading(false)
    }
  }

  // Завершение прохождения и начисление статуса
  const finishPlaythrough = async () => {
    if (!playthroughId) return
    setLoading(true)

    log('INFO', 'Завершение прохождения', { playthroughId })

    try {
      // Небольшая задержка для корректного завершения анимаций
      await new Promise(r => setTimeout(r, 50))

      const currentAnswers = answersRef.current
      const currentPoints = totalPointsRef.current

      const formattedAnswers = currentAnswers.map(a => ({
        scene_id: a.scene_id || currentSceneRef.current?.id || 1,
        node_id: a.node_id || '',
        option_id: a.option_id || '',
        text: a.text || '',
        points: a.points || 0
      }))

      const result = await completePlaythrough(playthroughId, currentPoints, formattedAnswers)

      setEndResult({
        earned: result.success && !!result.reward_status,
        status_name: result.reward_status || null,
        total_points: currentPoints,
        answers_count: formattedAnswers.length
      })

      setIsCompleted(true)
      setShowEnd(true)
      stopMusic()

      log('INFO', 'Прохождение завершено', {
        totalPoints: currentPoints,
        rewardStatus: result.reward_status
      })
    } catch (err) {
      setEndResult({
        earned: false,
        status_name: null,
        total_points: totalPointsRef.current,
        answers_count: answersRef.current.length
      })
      setIsCompleted(true)
      setShowEnd(true)
      stopMusic()

      log('ERROR', 'Ошибка завершения прохождения', { error: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Обработчик нажатия кнопки "Начать прохождение"
  const handleStart = useCallback((e) => {
    e.preventDefault()
    setShowStart(false)
    log('INFO', 'Начало прохождения')
  }, [])

  // Открытие диалога выхода из прохождения
  const handleOpenExitDialog = useCallback(() => {
    if (isCompleted) {
      stopMusic()
      fetchProjects()
      if (onClose) onClose()
      return
    }
    setShowExitDialog(true)
    log('INFO', 'Открытие диалога выхода')
  }, [isCompleted, stopMusic, onClose, fetchProjects])

  // Выход с сохранением текущего прогресса
  const handleExitAndSave = useCallback(() => {
    stopMusic()
    setShowExitDialog(false)

    if (saveProgress && playthroughId) {
      const nextNode = executionState?.current_node
      saveProgress(
        playthroughId,
        {
          total_points: totalPointsRef.current,
          answers: answersRef.current
        },
        currentSceneIndex,
        nextNode?.id || null
      ).catch(() => {})

      log('INFO', 'Выход с сохранением прогресса', {
        playthroughId,
        sceneIndex: currentSceneIndex
      })
    }

    fetchProjects()
    if (onClose) onClose()
  }, [stopMusic, onClose, playthroughId, saveProgress, executionState, currentSceneIndex, fetchProjects])

  // Выход с удалением незавершенного прохождения
  const handleExitAndDelete = useCallback(async () => {
    stopMusic()
    setShowExitDialog(false)

    if (playthroughId) {
      try {
        await abortPlaythrough(playthroughId)
        log('INFO', 'Прохождение удалено', { playthroughId })
      } catch (err) {
        log('ERROR', 'Ошибка удаления прохождения', { error: err.message })
      }
    }

    fetchProjects()
    if (onClose) onClose()
  }, [stopMusic, onClose, playthroughId, abortPlaythrough, fetchProjects])

  // Полный перезапуск прохождения
  const handleRestart = useCallback(async () => {
    stopMusic()
    log('INFO', 'Перезапуск прохождения')

    // Удаляем текущее прохождение если не завершено
    if (playthroughId && !isCompleted) {
      try {
        await abortPlaythrough(playthroughId)
      } catch (err) {
        // Игнорируем ошибку
      }
    }

    // Сброс всех состояний
    setCurrentSceneIndex(0)
    setShowStart(true)
    setShowEnd(false)
    setTotalPoints(0)
    setAnswers([])
    setExecutionState(null)
    setError(null)
    setVideoAudioEnabled(false)
    setPlaythroughId(null)
    setEndResult(null)
    setIsCompleted(false)
    initDoneRef.current = false
    resumeNodeIdRef.current = null
    isResumedRef.current = false

    // Переинициализация
    setIsInitializing(true)
    try {
      const r = await startPlaythrough(project.id)
      if (r.success) {
        setPlaythroughId(r.playthrough_id)
      } else {
        setError(r.error || 'Ошибка')
      }
    } catch (err) {
      setError('Ошибка подключения')
    } finally {
      setIsInitializing(false)
    }
  }, [stopMusic, playthroughId, isCompleted, abortPlaythrough, project.id, startPlaythrough])

  // Определение, показывать ли индикатор музыки
  const showMusicNotes = isMusicPlaying ||
    (currentScene?.background_type === 'video' && videoAudioEnabled && !isMuted)

  // Индикатор воспроизведения музыки с анимированными нотами
  const MusicIndicator = () => {
    if (!showMusicNotes) return null
    return (
      <div className="music-indicator">
        <FiMusic className="music-note" />
        <FiMusic className="music-note" />
        <FiMusic className="music-note" />
      </div>
    )
  }

  // Компонент управления громкостью с кастомным вертикальным слайдером
  const VolumeControl = () => {
    // Запуск таймера автоматического скрытия слайдера
    const startHideTimer = () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => {
        if (!isDraggingRef.current) setShowVolumeSlider(false)
      }, 2500)
    }

    // Отмена таймера скрытия
    const cancelHideTimer = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    }

    // Обновление громкости по позиции мыши
    const updateVolumeFromMouse = useCallback((clientY) => {
      if (!volumeSliderRef.current) return
      const rect = volumeSliderRef.current.getBoundingClientRect()
      const offset = rect.bottom - clientY
      let newVolume = Math.max(0, Math.min(1, offset / rect.height))
      setVolume(newVolume)
      if (audioRef.current) audioRef.current.volume = newVolume
      if (videoRef.current) videoRef.current.volume = newVolume
      if (newVolume > 0 && isMuted) setIsMuted(false)
    }, [isMuted])

    // Начало перетаскивания ползунка громкости
    const handleMouseDown = (e) => {
      e.preventDefault()
      e.stopPropagation()
      isDraggingRef.current = true
      cancelHideTimer()
      setShowVolumeSlider(true)
      updateVolumeFromMouse(e.clientY)

      const handleMouseMove = (me) => updateVolumeFromMouse(me.clientY)
      const handleMouseUp = () => {
        isDraggingRef.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        startHideTimer()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    const volumePercent = (isMuted ? 0 : volume) * 100

    return (
      <div
        className={`volume-fab ${showVolumeSlider ? 'expanded' : ''}`}
        ref={volumeRef}
        onMouseEnter={() => {
          cancelHideTimer()
          setShowVolumeSlider(true)
        }}
        onMouseLeave={() => {
          if (!isDraggingRef.current) startHideTimer()
        }}
      >
        <button
          className="volume-fab-btn"
          onClick={toggleMute}
          type="button"
          title={isMuted ? 'Включить звук' : 'Выключить звук'}
        >
          {getVolumeIcon()}
        </button>
        <div className="volume-fab-slider">
          <span className="volume-fab-value">{Math.round(volumePercent)}%</span>
          <div
            className="custom-volume-slider"
            ref={volumeSliderRef}
            onMouseDown={handleMouseDown}
          >
            <div
              className="custom-volume-fill"
              style={{ height: `${volumePercent}%` }}
            />
            <div
              className="custom-volume-thumb"
              style={{ bottom: `calc(${volumePercent}% - 9px)` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Определение текущего фона, спрайта и обложки
  const currentNode = executionState?.current_node
  const nodeBgUrl = currentNode?.background_url ? getFullUrl(currentNode.background_url) : null
  const sceneBgUrl = currentScene?.background_url ? getFullUrl(currentScene.background_url) : null
  const bgUrl = nodeBgUrl || sceneBgUrl
  const isVideoBg = nodeBgUrl
    ? (currentNode.background_url || '').toLowerCase().endsWith('.mp4')
    : currentScene?.background_type === 'video'
  const spriteUrl = currentNode?.sprite_file ? getSpriteUrl(currentNode.sprite_file) : null
  const coverUrl = project?.cover_url
    ? (project.cover_url.startsWith('http') ? project.cover_url : `http://localhost:8000${project.cover_url}`)
    : null

  // Экран инициализации
  if (isInitializing) {
    return (
      <div className="preview-overlay">
        <div className="loading-screen" style={{ background: '#1a1a2e' }}>
          <div className="loader"></div>
          <p style={{ color: '#fff' }}>Подготовка...</p>
        </div>
      </div>
    )
  }

  // Экран завершения прохождения
  if (showEnd) {
    return (
      <div className="preview-overlay">
        <div
          className="preview-container"
          ref={containerRef}
          style={{ height: 'auto', maxHeight: '90vh' }}
        >
          <div className="preview-header">
            <h3>Прохождение завершено</h3>
            <div className="preview-controls">
              <button
                onClick={toggleFullscreen}
                className="fullscreen-btn"
              >
                {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
              <button onClick={handleOpenExitDialog} className="close-preview">
                <FiX />
              </button>
            </div>
          </div>

          <div className="preview-end-content">
            <div className="end-card">
              <h2>Конец</h2>

              {/* Информация о полученном статусе */}
              {endResult?.earned ? (
                <div className="reward-earned-badge">
                  <FiAward size={24} />
                  <span>Получен статус: <strong>{endResult.status_name}</strong></span>
                </div>
              ) : (
                <div className="reward-not-earned-badge">Статус не получен</div>
              )}

              {/* Сводка результатов */}
              <div className="results-summary">
                <p className="total-points">
                  <FiStar /> Баллов: <strong>{endResult?.total_points || totalPoints}</strong>
                </p>
                <p className="answers-count">
                  Ответов: {endResult?.answers_count || answers.length}
                </p>
              </div>

              {/* Кнопки действий */}
              <div className="end-buttons">
                <button onClick={handleRestart} className="restart-btn">
                  <FiRefreshCw /> Пройти заново
                </button>
                <button onClick={handleOpenExitDialog} className="close-end-btn">
                  <FiX /> Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Экран при отсутствии сцен в проекте
  if (!currentScene) {
    return (
      <div className="preview-overlay">
        <div className="preview-container">
          <div className="preview-header">
            <h3>Прохождение</h3>
            <button onClick={handleOpenExitDialog} className="close-preview">
              <FiX />
            </button>
          </div>
          <div className="preview-empty">
            <p>В проекте нет сцен</p>
          </div>
        </div>
      </div>
    )
  }

  // Стартовый экран новеллы с обложкой и информацией
  if (showStart) {
    return (
      <div className="preview-overlay">
        <div className="preview-container" ref={containerRef}>
          <div className="preview-header">
            <h3>Новая новелла</h3>
            <div className="preview-controls">
              <button onClick={toggleFullscreen} className="fullscreen-btn">
                {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
              <button onClick={handleOpenExitDialog} className="close-preview">
                <FiX />
              </button>
            </div>
          </div>

          <div className="preview-start novel-start">
            {coverUrl && (
              <div className="novel-start-background">
                <img src={coverUrl} alt="" className="novel-cover-bg" />
              </div>
            )}
            <div className="novel-start-overlay" />

            <div className="novel-start-card">
              <h1 className="novel-title">{project?.title || 'Без названия'}</h1>

              {ownerName && (
                <p className="novel-author">
                  <FiUser /> {ownerName}
                </p>
              )}

              {project?.description && (
                <p className="novel-description">{project.description}</p>
              )}

              <div className="novel-meta">
                <span>
                  <FiBookOpen /> {scenes.length}{' '}
                  {scenes.length === 1
                    ? 'сцена'
                    : scenes.length >= 2 && scenes.length <= 4
                      ? 'сцены'
                      : 'сцен'}
                </span>
                {project?.reward_status && (
                  <span>
                    <FiAward /> {project.reward_status}
                  </span>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                onClick={handleStart}
                className="start-btn novel-start-btn"
                disabled={loading}
              >
                {loading ? 'Загрузка...' : <><FiPlay /> Начать прохождение</>}
              </button>
            </div>
          </div>
        </div>

        {/* Диалог выхода */}
        {showExitDialog && (
          <ExitDialog
            onSave={handleExitAndSave}
            onDelete={handleExitAndDelete}
            onCancel={() => setShowExitDialog(false)}
          />
        )}
      </div>
    )
  }

  // Основной экран прохождения сцены
  return (
    <div className="preview-overlay">
      <div className="preview-container" ref={containerRef}>
        {/* Заголовок с названием сцены и кнопками управления */}
        <div className="preview-header">
          <h3>{currentScene.name}</h3>
          <div className="preview-controls">
            <MusicIndicator />
            <button onClick={toggleFullscreen} className="fullscreen-btn">
              {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
            </button>
            <button onClick={handleOpenExitDialog} className="close-preview">
              <FiX />
            </button>
          </div>
        </div>

        {/* Область отображения сцены */}
        <div className="preview-scene">
          {/* Фон сцены (изображение или видео) */}
          <div className="preview-background-container">
            {bgUrl && (
              isVideoBg ? (
                <video
                  ref={videoRef}
                  src={bgUrl}
                  className="preview-bg-video"
                  autoPlay
                  loop
                  muted={!videoAudioEnabled}
                  playsInline
                />
              ) : (
                <img src={bgUrl} alt="" className="preview-bg" />
              )
            )}
          </div>

          {/* Спрайт персонажа */}
          {spriteUrl && (
            <div className="preview-sprite-container">
              <img
                src={spriteUrl}
                alt="character"
                className="preview-sprite"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
          )}

          {/* Плавающая кнопка управления громкостью */}
          <VolumeControl />

          {/* Диалоговое окно с текстом и опциями */}
          {currentNode && (
            <div className="preview-dialog">
              {currentNode.character_name && (
                <div className="preview-character-name">
                  {currentNode.character_name}
                </div>
              )}

              {/* Текст диалога с автоматической прокруткой */}
              <div className="preview-text-container" ref={textContainerRef}>
                <div className="preview-text">
                  {currentNode.text || '...'}
                </div>
              </div>

              {/* Варианты ответов */}
              {currentNode.options?.length > 0 && (
                <div className="preview-options-container" ref={optionsContainerRef}>
                  <div className="preview-options">
                    {currentNode.options.map((opt, idx) => (
                      <button
                        key={opt.id}
                        onClick={() => handleChoice(opt)}
                        disabled={loading}
                        className="preview-option"
                      >
                        <span className="option-number">{idx + 1}</span>
                        <span className="option-text">{opt.text}</span>
                        {opt.points > 0 && (
                          <span className="option-points-badge">
                            <FiStar /> +{opt.points}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading && <div className="loading-indicator">Загрузка...</div>}
              {error && (
                <div className="error-message" style={{ marginTop: '10px' }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Диалог выхода */}
      {showExitDialog && (
        <ExitDialog
          onSave={handleExitAndSave}
          onDelete={handleExitAndDelete}
          onCancel={() => setShowExitDialog(false)}
        />
      )}
    </div>
  )
}

// Диалог выхода из прохождения с опциями сохранить или удалить прогресс
const ExitDialog = ({ onSave, onDelete, onCancel }) => {
  return createPortal(
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="exit-dialog" onClick={e => e.stopPropagation()}>
        <h3>Выйти из прохождения?</h3>
        <p className="exit-dialog-hint">
          Вы можете сохранить прогресс и продолжить позже, либо удалить прохождение и начать заново.
        </p>
        <div className="exit-dialog-actions">
          <button onClick={onSave} className="exit-dialog-btn exit-save-btn">
            Сохранить и выйти
          </button>
          <button onClick={onDelete} className="exit-dialog-btn exit-delete-btn">
            Удалить прохождение
          </button>
          <button onClick={onCancel} className="exit-dialog-btn exit-cancel-btn">
            Продолжить прохождение
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ProjectPlayer