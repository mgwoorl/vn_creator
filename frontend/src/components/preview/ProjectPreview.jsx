import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  FiX, FiStar, FiMusic, FiRefreshCw,
  FiVolume2, FiVolumeX, FiVolume1, FiMaximize2, FiMinimize2,
  FiEye, FiEyeOff, FiPlay, FiUser, FiBookOpen
} from 'react-icons/fi'
import { useProject } from '../../context/ProjectContext'
import { useScenes } from '../../context/SceneContext'

// Простое логирование для отладки
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][ProjectPreview]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Предпросмотр проекта для преподавателя без сохранения прогресса
const ProjectPreview = ({ project, onClose, hidePoints = false }) => {
  // Состояния для навигации по сценам и выполнения
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0)
  const [executionState, setExecutionState] = useState(null)
  const [showStart, setShowStart] = useState(true)
  const [showEnd, setShowEnd] = useState(false)
  const [totalPoints, setTotalPoints] = useState(0)
  const [history, setHistory] = useState([])
  const [answers, setAnswers] = useState([])
  const [currentMusic, setCurrentMusic] = useState(null)
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hideDialog, setHideDialog] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [videoAudioEnabled, setVideoAudioEnabled] = useState(false)

  // Состояния для управления громкостью
  const [volume, setVolume] = useState(0.7)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const previousVolume = useRef(0.7)

  // Рефы для аудио, видео и DOM-элементов
  const audioRef = useRef(new Audio())
  const videoRef = useRef(null)
  const answersListRef = useRef(null)
  const containerRef = useRef(null)
  const textContainerRef = useRef(null)
  const optionsContainerRef = useRef(null)
  const volumeRef = useRef(null)
  const hideTimeoutRef = useRef(null)
  const volumeSliderRef = useRef(null)
  const isDraggingRef = useRef(false)

  // Рефы для хранения актуальной громкости в колбэках
  const volumeRefValue = useRef(0.7)
  const isMutedRef = useRef(false)

  const { startSceneExecution, selectOption } = useScenes()
  const { getUserById } = useProject()

  const scenes = project?.scenes || []
  const currentScene = scenes[currentSceneIndex]

  // Синхронизация рефов громкости с состоянием
  useEffect(() => { volumeRefValue.current = volume }, [volume])
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  // Применение громкости к аудио и видео элементам
  useEffect(() => {
    const vol = isMuted ? 0 : volume
    if (audioRef.current) audioRef.current.volume = vol
    if (videoRef.current) videoRef.current.volume = vol
  }, [volume, isMuted])

  // Очистка таймера при размонтировании
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

  // Настройка прокрутки текста диалога
  useEffect(() => {
    if (textContainerRef.current && !hideDialog) {
      const hasScroll = textContainerRef.current.scrollHeight > textContainerRef.current.clientHeight
      textContainerRef.current.style.overflowY = hasScroll ? 'auto' : 'visible'
    }
  }, [executionState?.current_node?.text, hideDialog])

  // Настройка прокрутки контейнера с опциями
  useEffect(() => {
    if (optionsContainerRef.current && !hideDialog) {
      const hasScroll = optionsContainerRef.current.scrollHeight > optionsContainerRef.current.clientHeight
      optionsContainerRef.current.style.overflowY = hasScroll ? 'auto' : 'visible'
    }
  }, [executionState?.current_node?.options, hideDialog])

  // Загрузка имени владельца проекта
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

  // Обработчик окончания аудио
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

  // Отслеживание полноэкранного режима
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Автоматическая прокрутка списка ответов при добавлении новых
  useEffect(() => {
    if (answersListRef.current) {
      answersListRef.current.scrollTop = answersListRef.current.scrollHeight
    }
  }, [answers])

  // Автозапуск сцены после скрытия стартового экрана
  useEffect(() => {
    if (!showStart && currentScene && !executionState && !loading) {
      startExecution()
    }
  }, [currentSceneIndex, showStart])

  // Преобразование относительного пути в абсолютный URL
  const getFullUrl = useCallback((url) => {
    if (!url) return null
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return `http://localhost:8000${url}`
  }, [])

  // Переключение mute
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      setVolume(previousVolume.current || 0.7)
    } else {
      previousVolume.current = volume
      setIsMuted(true)
    }
  }

  // Выбор иконки громкости
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

  // Запуск выполнения сцены через движок
  const startExecution = async () => {
    if (!currentScene) return
    setLoading(true)
    setError(null)

    log('INFO', 'Запуск предпросмотра сцены', { sceneId: currentScene.id, sceneName: currentScene.name })

    try {
      const result = await startSceneExecution(currentScene.id)

      if (result.success && result.execution) {
        setVideoAudioEnabled(result.execution?.use_video_audio === true)

        if (videoRef.current) {
          videoRef.current.volume = isMutedRef.current ? 0 : volumeRefValue.current
        }

        setExecutionState(result.execution)
        setTotalPoints(t => t + (result.execution.context?.total_points || 0))
        setAnswers(a => [...a, ...(result.execution.context?.answers || [])])

        const musicFile = result.execution.current_node?.music_file
        if (musicFile) {
          playMusic(musicFile, result.execution.current_node?.loopMusic === true)
        } else {
          stopMusic()
        }

        if (result.execution.status === 'end' || !result.execution.has_paths) {
          setShowEnd(true)
          stopMusic()
          log('INFO', 'Предпросмотр завершен (конец сцены)')
        }
      } else {
        setError(result.error || 'Ошибка')
        log('ERROR', 'Ошибка выполнения сцены', { error: result.error })
      }
    } catch (err) {
      setError('Ошибка соединения')
      log('ERROR', 'Ошибка соединения в предпросмотре', { error: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Воспроизведение музыки с правильной громкостью и зацикливанием
  const playMusic = (musicFile, shouldLoop = false) => {
    if (!musicFile || !project?.music) return

    const musicList = project.music || []
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

    const url = getFullUrl(track.url)
    const audio = audioRef.current

    // Если трек уже играет, обновляем параметры
    if (url === currentMusic) {
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
    audio.src = url
    audio.loop = shouldLoop
    audio.volume = isMutedRef.current ? 0 : volumeRefValue.current
    audio.load()
    audio.play()
      .then(() => {
        setIsMusicPlaying(true)
        setCurrentMusic(url)
      })
      .catch(() => {
        setIsMusicPlaying(false)
        setCurrentMusic(null)
      })
  }

  // Остановка музыки
  const stopMusic = () => {
    const audio = audioRef.current
    audio.pause()
    audio.currentTime = 0
    audio.loop = false
    setIsMusicPlaying(false)
    setCurrentMusic(null)
  }

  // Обработка выбора варианта ответа
  const handleChoice = async (option) => {
    if (!executionState || loading) return
    setLoading(true)
    setError(null)

    log('INFO', 'Выбор варианта в предпросмотре', {
      nodeId: executionState.current_node.id,
      optionId: option.id
    })

    try {
      const result = await selectOption(
        currentScene.id,
        executionState.current_node.id,
        option.id,
        {
          total_points: totalPoints,
          visited_nodes: history.map(h => h.nodeId),
          answers
        }
      )

      if (result.success && result.execution) {
        setVideoAudioEnabled(result.execution?.use_video_audio === true)

        if (videoRef.current) {
          videoRef.current.volume = isMutedRef.current ? 0 : volumeRefValue.current
          videoRef.current.muted = !result.execution?.use_video_audio
        }

        // Сохраняем историю посещенных узлов
        if (executionState?.current_node) {
          setHistory(p => [
            ...p,
            { sceneIndex: currentSceneIndex, nodeId: executionState.current_node.id }
          ])
        }

        setExecutionState(result.execution)

        if (result.execution.context) {
          setAnswers(result.execution.context.answers || [])
          setTotalPoints(result.execution.context.total_points || 0)
        }

        // Обработка действий после выбора
        if (result.execution.status === 'end') {
          stopMusic()
          setShowEnd(true)
        } else if (result.execution.status === 'next_scene') {
          stopMusic()
          if (currentSceneIndex + 1 < scenes.length) {
            setCurrentSceneIndex(i => i + 1)
            setExecutionState(null)
            log('INFO', 'Переход к следующей сцене')
          } else {
            stopMusic()
            setShowEnd(true)
          }
        } else if (result.execution.current_node) {
          const musicFile = result.execution.current_node.music_file
          if (musicFile) {
            playMusic(musicFile, result.execution.current_node.loopMusic === true)
          } else {
            stopMusic()
          }
        }
      } else {
        setError(result.error || 'Ошибка')
        log('ERROR', 'Ошибка выбора варианта', { error: result.error })
      }
    } catch (err) {
      setError('Ошибка соединения')
      log('ERROR', 'Ошибка соединения при выборе варианта', { error: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Обработчик кнопки начала предпросмотра
  const handleStartScene = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowStart(false)
    log('INFO', 'Начало предпросмотра')
  }

  // Сброс предпросмотра к начальному состоянию
  const reset = () => {
    log('INFO', 'Сброс предпросмотра')
    setCurrentSceneIndex(0)
    setShowStart(true)
    setShowEnd(false)
    setTotalPoints(0)
    setHistory([])
    setAnswers([])
    setExecutionState(null)
    setError(null)
    setVideoAudioEnabled(false)
    stopMusic()
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }
  }

  // Закрытие предпросмотра с очисткой ресурсов
  const handleClose = () => {
    log('INFO', 'Закрытие предпросмотра')
    stopMusic()
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }
    if (onClose) onClose()
  }

  // Поиск URL спрайта по имени файла
  const getSpriteUrl = (spriteFile) => {
    if (!spriteFile || !project?.sprites) return null
    const sprite = project.sprites.find(s => s.filename === spriteFile || s.name === spriteFile)
    return sprite ? getFullUrl(sprite.url) : null
  }

  // Определение, показывать ли индикатор музыки
  const showMusicNotes = isMusicPlaying ||
    (currentScene?.background_type === 'video' && videoAudioEnabled && !isMuted)

  // Индикатор воспроизведения музыки
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
    // Запуск таймера автоматического скрытия
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

    // Обработчик начала перетаскивания ползунка
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

  // Определение текущего фона
  const currentNode = executionState?.current_node
  const nodeBgUrl = currentNode?.background_url ? getFullUrl(currentNode.background_url) : null
  const sceneBgUrl = currentScene?.background_url ? getFullUrl(currentScene.background_url) : null
  const currentBackgroundUrl = nodeBgUrl || sceneBgUrl
  const effectiveBackgroundType = nodeBgUrl
    ? ((currentNode.background_url || '').toLowerCase().endsWith('.mp4') ? 'video' : 'image')
    : (currentScene?.background_type || 'image')
  const currentSpriteUrl = currentNode?.sprite_file ? getSpriteUrl(currentNode.sprite_file) : null
  const coverUrl = project?.cover_url
    ? (project.cover_url.startsWith('http')
        ? project.cover_url
        : `http://localhost:8000${project.cover_url}`)
    : null

  // Экран завершения предпросмотра
  if (showEnd) {
    return (
      <div className="preview-overlay">
        <div className="preview-container" ref={containerRef}>
          <div className="preview-header">
            <h3>Конец</h3>
            <div className="preview-controls">
              <button onClick={toggleFullscreen} className="fullscreen-btn" type="button">
                {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
              <button onClick={handleClose} className="close-preview" type="button">
                <FiX />
              </button>
            </div>
          </div>

          <div className="preview-end-content">
            <div className="end-card">
              <h2>Конец</h2>

              <div className="results-summary">
                <p className="total-points">
                  <FiStar /> Всего баллов: <strong>{hidePoints ? '?' : totalPoints}</strong>
                </p>
                <p className="answers-count">Ответов: {answers.length}</p>
              </div>

              {/* Список всех ответов пользователя */}
              <div className="answers-list-container">
                <h4>Ваши ответы</h4>
                <div className="answers-list-scrollable" ref={answersListRef}>
                  {answers.map((ans, idx) => (
                    <div key={idx} className="answer-item">
                      <span className="answer-text">{ans.text}</span>
                      <span className="answer-points">
                        {hidePoints ? '*' : `+${ans.points}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="end-buttons">
                <button onClick={reset} className="restart-btn" type="button">
                  <FiRefreshCw /> Пройти заново
                </button>
                <button onClick={handleClose} className="close-end-btn" type="button">
                  <FiX /> Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Экран при отсутствии сцен
  if (!currentScene) {
    return (
      <div className="preview-overlay">
        <div className="preview-container">
          <div className="preview-header">
            <h3>Предпросмотр</h3>
            <button onClick={handleClose} className="close-preview" type="button">
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

  // Стартовый экран с информацией о новелле
  if (showStart) {
    return (
      <div className="preview-overlay">
        <div className="preview-container" ref={containerRef}>
          <div className="preview-header">
            <h3>Предпросмотр</h3>
            <div className="preview-controls">
              <button onClick={toggleFullscreen} className="fullscreen-btn" type="button">
                {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
              <button onClick={handleClose} className="close-preview" type="button">
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
                  <FiBookOpen /> {scenes.length} сцен
                </span>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                onClick={handleStartScene}
                className="start-btn novel-start-btn"
                disabled={loading}
                type="button"
              >
                {loading ? 'Загрузка...' : <><FiPlay /> Начать</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Основной экран предпросмотра сцены
  return (
    <div className="preview-overlay">
      <div className="preview-container" ref={containerRef}>
        {/* Заголовок сцены и кнопки управления */}
        <div className="preview-header">
          <h3>{currentScene.name}</h3>
          <div className="preview-controls">
            <MusicIndicator />
            <span className="points-display">
              <FiStar /> {hidePoints ? '?' : totalPoints}
            </span>
            <button
              onClick={() => setHideDialog(!hideDialog)}
              className="hide-dialog-btn"
              type="button"
              title={hideDialog ? 'Показать диалог' : 'Скрыть диалог'}
            >
              {hideDialog ? <FiEye /> : <FiEyeOff />}
            </button>
            <button onClick={toggleFullscreen} className="fullscreen-btn" type="button">
              {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
            </button>
            <button onClick={handleClose} className="close-preview" type="button">
              <FiX />
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message" style={{ margin: '10px' }}>
            {error}
          </div>
        )}

        {/* Область отображения сцены */}
        <div className="preview-scene">
          {/* Фон сцены */}
          <div className="preview-background-container">
            {currentBackgroundUrl && (
              effectiveBackgroundType === 'video' ? (
                <video
                  ref={videoRef}
                  src={currentBackgroundUrl}
                  className="preview-bg-video"
                  autoPlay
                  loop
                  muted={!videoAudioEnabled}
                  playsInline
                />
              ) : (
                <img src={currentBackgroundUrl} alt="" className="preview-bg" />
              )
            )}
          </div>

          {/* Спрайт персонажа */}
          {currentSpriteUrl && (
            <div className="preview-sprite-container">
              <img
                src={currentSpriteUrl}
                alt="character"
                className="preview-sprite"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
          )}

          {/* Управление громкостью */}
          <VolumeControl />

          {/* Диалоговое окно (можно скрыть кнопкой) */}
          {!hideDialog && currentNode && (
            <div className="preview-dialog">
              {currentNode.character_name && (
                <div className="preview-character-name">
                  {currentNode.character_name}
                </div>
              )}

              <div className="preview-text-container" ref={textContainerRef}>
                <div className="preview-text">
                  {currentNode.text || '...'}
                </div>
              </div>

              {/* Варианты ответов */}
              {currentNode.options && currentNode.options.length > 0 && (
                <div className="preview-options-container" ref={optionsContainerRef}>
                  <div className="preview-options">
                    {currentNode.options.map((opt, idx) => (
                      <button
                        key={opt.id}
                        onClick={() => handleChoice(opt)}
                        disabled={loading}
                        className={`preview-option ${opt.target_type || 'node'}`}
                        type="button"
                      >
                        <span className="option-number">{idx + 1}</span>
                        <span className="option-text">{opt.text}</span>
                        {opt.points > 0 && !hidePoints && (
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectPreview