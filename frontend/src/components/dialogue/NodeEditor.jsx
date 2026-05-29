import React, { useState, useEffect, useRef } from 'react'
import { 
  FiX, FiMusic, FiUser, FiTrash2, FiSearch, FiFilter,
  FiChevronDown, FiChevronUp, FiImage, FiRepeat, FiPlay, FiPause
} from 'react-icons/fi'
import { groupSpritesByCharacter, getUniqueCharacters } from '../../utils/fileUtils'

// Простое логирование для отладки
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][NodeEditor]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Редактор содержимого узла диалога: персонаж, спрайт, музыка, фон, текст и варианты ответов
export const NodeEditor = ({ 
  node, 
  onUpdate, 
  onClose, 
  onDeleteOption,
  characters = [], 
  sprites = [],
  music = [],
  backgrounds = [],
  allNodes = [] 
}) => {
  // Состояние данных узла, инициализируется из переданного узла
  const [data, setData] = useState({
    characterName: '',
    spriteFile: '',
    musicFile: '',
    loopMusic: false,
    text: '',
    backgroundUrl: '',
    options: [],
    ...node?.data
  })

  // Состояния для отображения галерей
  const [spriteFilter, setSpriteFilter] = useState('all')
  const [spriteSearch, setSpriteSearch] = useState('')
  const [showSpriteGallery, setShowSpriteGallery] = useState(false)

  const [musicSearch, setMusicSearch] = useState('')
  const [showMusicGallery, setShowMusicGallery] = useState(false)
  // URL трека, который сейчас проигрывается в режиме предпрослушивания
  const [previewingMusicUrl, setPreviewingMusicUrl] = useState(null)
  const previewAudioRef = useRef(null)

  const [backgroundSearch, setBackgroundSearch] = useState('')
  const [showBackgroundGallery, setShowBackgroundGallery] = useState(false)

  // Инициализация данных при открытии редактора
  useEffect(() => {
    if (node?.data) {
      log('INFO', 'Открытие редактора узла', { nodeId: node.id })
      
      const nodeData = {
        characterName: node.data.characterName || '',
        spriteFile: node.data.spriteFile || '',
        musicFile: node.data.musicFile || '',
        // Явная проверка loopMusic на undefined/null для корректного отображения чекбокса
        loopMusic: node.data.loopMusic !== undefined && node.data.loopMusic !== null 
          ? node.data.loopMusic 
          : false,
        text: node.data.text || '',
        backgroundUrl: node.data.backgroundUrl || '',
        // Если опции пусты, создаем одну опцию по умолчанию
        options: node.data.options && node.data.options.length > 0 
          ? node.data.options 
          : [createDefaultOption()],
      }
      setData(nodeData)
      
      // Автоматическая установка фильтра спрайтов по имени персонажа
      if (nodeData.characterName && sprites.length > 0) {
        const charName = nodeData.characterName.toLowerCase()
        const uniqueChars = getUniqueCharacters(sprites)
        const matchingCharacter = uniqueChars.find(
          char => {
            const lowerChar = char.toLowerCase()
            return lowerChar.includes(charName) || charName.includes(lowerChar)
          }
        )
        if (matchingCharacter) {
          setSpriteFilter(matchingCharacter)
          log('INFO', 'Автоматический фильтр спрайтов', { character: matchingCharacter })
        }
      }
    }

    // Очистка при размонтировании: останавливаем и освобождаем аудио
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.src = ''
        previewAudioRef.current = null
        log('INFO', 'Очистка аудио при закрытии редактора')
      }
    }
  }, [node, sprites])

  // Создание опции со значениями по умолчанию
  const createDefaultOption = () => ({
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text: 'Далее',
    targetType: 'node',
    targetNodeId: '',
    points: 0
  })

  // Предпрослушивание музыки: переключает play/pause для выбранного трека
  const handlePreviewMusic = (track, e) => {
    e.stopPropagation()

    // Если трек уже играет — останавливаем
    if (previewingMusicUrl === track.url) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.src = ''
        previewAudioRef.current = null
      }
      setPreviewingMusicUrl(null)
      log('INFO', 'Остановка предпрослушивания', { track: track.name })
      return
    }

    // Останавливаем предыдущее превью перед запуском нового
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.src = ''
    }

    const fullUrl = track.url?.startsWith('http') ? track.url : `http://localhost:8000${track.url}`
    const audio = new Audio(fullUrl)
    audio.volume = 0.5
    audio.play().catch((err) => {
      log('WARN', 'Ошибка воспроизведения аудио', { track: track.name, error: err.message })
    })
    previewAudioRef.current = audio
    setPreviewingMusicUrl(track.url)
    log('INFO', 'Запуск предпрослушивания', { track: track.name })

    // Сброс состояния после окончания трека
    audio.addEventListener('ended', () => {
      setPreviewingMusicUrl(null)
      previewAudioRef.current = null
    })
  }

  if (!node) return null

  // Сохранение изменений узла
  const handleSave = () => {
    log('INFO', 'Сохранение узла', { nodeId: node.id, characterName: data.characterName })
    onUpdate(node.id, { 
      ...node, 
      data: {
        ...data,
        backgroundUrl: data.backgroundUrl || ''
      }
    })
    onClose()
  }

  // Изменение имени персонажа с автоматической фильтрацией спрайтов
  const handleCharacterNameChange = (value) => {
    setData({ ...data, characterName: value })
    
    if (value && sprites.length > 0) {
      const charName = value.toLowerCase()
      const uniqueChars = getUniqueCharacters(sprites)
      const matchingCharacter = uniqueChars.find(
        char => {
          const lowerChar = char.toLowerCase()
          return lowerChar.includes(charName) || charName.includes(lowerChar)
        }
      )
      if (matchingCharacter) {
        setSpriteFilter(matchingCharacter)
      }
    }
  }

  // Добавление нового варианта ответа
  const addOption = () => {
    log('INFO', 'Добавление новой опции', { nodeId: node.id, currentCount: data.options.length })
    setData({
      ...data,
      options: [...data.options, createDefaultOption()]
    })
  }

  // Обновление поля варианта ответа
  const updateOption = (optionId, field, value, e) => {
    if (e) e.stopPropagation()
    setData({
      ...data,
      options: data.options.map(opt =>
        opt.id === optionId ? { ...opt, [field]: value } : opt
      )
    })
  }

  // Удаление варианта ответа (минимум одна опция должна остаться)
  const deleteOption = (optionId, e) => {
    if (e) e.stopPropagation()
    if (data.options.length <= 1) {
      log('WARN', 'Попытка удалить последнюю опцию', { nodeId: node.id })
      alert('Должен быть хотя бы один вариант')
      return
    }
    
    log('INFO', 'Удаление опции', { nodeId: node.id, optionId })
    if (onDeleteOption) {
      onDeleteOption(node.id, optionId)
    }
    
    setData({
      ...data,
      options: data.options.filter(opt => opt.id !== optionId)
    })
  }

  // Группировка спрайтов по персонажам для отображения в галерее
  const groupedSprites = groupSpritesByCharacter(sprites)
  const uniqueCharacters = getUniqueCharacters(sprites)

  // Поиск текущего выбранного спрайта
  const currentSprite = sprites.find(s => 
    s.name === data.spriteFile || s.filename === data.spriteFile
  )

  // Фильтрация музыки по поисковому запросу
  const filteredMusic = music.filter(track => {
    if (!musicSearch.trim()) return true
    const search = musicSearch.toLowerCase()
    const name = (track.name || track.filename || '').toLowerCase()
    return name.includes(search)
  })

  // Поиск текущего выбранного трека
  const currentMusicTrack = music.find(t => 
    t.name === data.musicFile || t.filename === data.musicFile
  )

  // Фильтрация фонов по поисковому запросу
  const filteredBackgrounds = (backgrounds || []).filter(bg => {
    if (!backgroundSearch.trim()) return true
    const search = backgroundSearch.toLowerCase()
    const name = (bg.name || bg.filename || '').toLowerCase()
    return name.includes(search)
  })

  return (
    <div className="node-editor-overlay" onClick={onClose}>
      <div className="node-editor" onClick={(e) => e.stopPropagation()}>
        {/* Заголовок редактора */}
        <div className="node-editor-header">
          <h3>Редактирование блока</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <div className="node-editor-content">
          {/* Секция выбора персонажа и спрайта */}
          <div className="form-section">
            <h4><FiUser /> Персонаж</h4>
            
            <div className="form-group">
              <label>Имя персонажа</label>
              <input
                type="text"
                value={data.characterName || ''}
                onChange={(e) => handleCharacterNameChange(e.target.value)}
                placeholder="Кто говорит?"
              />
            </div>

            <div className="form-group">
              <label>Спрайт персонажа</label>
              
              <div className="sprite-selector">
                <div 
                  className="sprite-current"
                  onClick={() => setShowSpriteGallery(!showSpriteGallery)}
                >
                  {currentSprite ? (
                    <div className="sprite-current-preview">
                      <span className="sprite-current-name">{currentSprite.name}</span>
                    </div>
                  ) : (
                    <div className="sprite-placeholder">
                      <FiUser />
                      <span>Выбрать спрайт</span>
                    </div>
                  )}
                  <button type="button" className="sprite-toggle-btn">
                    {showSpriteGallery ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                </div>

                {data.spriteFile && (
                  <button 
                    type="button"
                    className="sprite-clear-btn"
                    onClick={() => setData({ ...data, spriteFile: '' })}
                  >
                    <FiX /> Без спрайта
                  </button>
                )}
              </div>

              {/* Галерея спрайтов с фильтрацией по персонажу и поиском */}
              {showSpriteGallery && (
                <div className="sprite-gallery">
                  <div className="sprite-gallery-filters">
                    <div className="sprite-search-bar">
                      <FiSearch size={14} />
                      <input
                        type="text"
                        placeholder="Поиск спрайта..."
                        value={spriteSearch}
                        onChange={(e) => setSpriteSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {spriteSearch && (
                        <button className="search-clear" onClick={() => setSpriteSearch('')}>
                          <FiX size={12} />
                        </button>
                      )}
                    </div>

                    <div className="sprite-filter-select">
                      <FiFilter size={14} />
                      <select
                        value={spriteFilter}
                        onChange={(e) => setSpriteFilter(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="all">Все персонажи</option>
                        {uniqueCharacters.map(char => (
                          <option key={char} value={char}>{char}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sprite-gallery-groups">
                    {Object.entries(groupedSprites)
                      .filter(([character]) => {
                        if (spriteFilter !== 'all') return character.toLowerCase() === spriteFilter.toLowerCase()
                        if (spriteSearch.trim()) {
                          const search = spriteSearch.toLowerCase()
                          return character.toLowerCase().includes(search) || 
                            groupedSprites[character].some(s => 
                              (s.name || s.filename || '').toLowerCase().includes(search)
                            )
                        }
                        return true
                      })
                      .map(([character, characterSprites]) => {
                        const filteredCharSprites = spriteSearch.trim()
                          ? characterSprites.filter(s => 
                              (s.name || s.filename || '').toLowerCase().includes(spriteSearch.toLowerCase())
                            )
                          : characterSprites

                        if (filteredCharSprites.length === 0) return null

                        return (
                          <div key={character} className="sprite-group-section">
                            <div className="sprite-group-header">
                              <FiUser size={14} />
                              <span>{character}</span>
                              <span className="sprite-group-count">{filteredCharSprites.length}</span>
                            </div>
                            <div className="sprite-group-grid">
                              {filteredCharSprites.map(sprite => (
                                <div
                                  key={sprite.id}
                                  className={`sprite-gallery-item ${data.spriteFile === (sprite.name || sprite.filename) ? 'selected' : ''}`}
                                  onClick={() => {
                                    setData({ ...data, spriteFile: sprite.name || sprite.filename })
                                    setShowSpriteGallery(false)
                                    setSpriteSearch('')
                                    log('INFO', 'Выбран спрайт', { sprite: sprite.name || sprite.filename })
                                  }}
                                >
                                  <div className="sprite-gallery-name-only">
                                    {(sprite.name || sprite.filename).split('_').slice(1).join('_') || sprite.name || sprite.filename}
                                  </div>
                                  {data.spriteFile === (sprite.name || sprite.filename) && (
                                    <div className="sprite-gallery-check">✓</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    
                    {Object.keys(groupedSprites).length === 0 && (
                      <div className="sprite-gallery-empty">
                        <FiImage size={24} />
                        <p>Нет спрайтов</p>
                        <small>Загрузите спрайты в библиотеке ресурсов</small>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Секция выбора фоновой музыки */}
          <div className="form-section">
            <h4><FiMusic /> Фоновая музыка</h4>
            
            <div className="form-group">
              <label>Выберите трек</label>
              
              <div className="sprite-selector">
                <div 
                  className="sprite-current"
                  onClick={() => setShowMusicGallery(!showMusicGallery)}
                >
                  {currentMusicTrack ? (
                    <div className="sprite-current-preview">
                      <FiMusic size={16} />
                      <span className="sprite-current-name">{currentMusicTrack.name}</span>
                    </div>
                  ) : (
                    <div className="sprite-placeholder">
                      <FiMusic />
                      <span>Без музыки</span>
                    </div>
                  )}
                  <button type="button" className="sprite-toggle-btn">
                    {showMusicGallery ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                </div>

                {data.musicFile && (
                  <button 
                    type="button"
                    className="sprite-clear-btn"
                    onClick={() => setData({ ...data, musicFile: '' })}
                  >
                    <FiX /> Без музыки
                  </button>
                )}
              </div>

              {/* Галерея музыки с поиском и предпрослушиванием */}
              {showMusicGallery && (
                <div className="sprite-gallery">
                  <div className="sprite-gallery-filters">
                    <div className="sprite-search-bar">
                      <FiSearch size={14} />
                      <input
                        type="text"
                        placeholder="Поиск музыки..."
                        value={musicSearch}
                        onChange={(e) => setMusicSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {musicSearch && (
                        <button className="search-clear" onClick={() => setMusicSearch('')}>
                          <FiX size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="music-gallery-list">
                    {filteredMusic.length === 0 ? (
                      <div className="sprite-gallery-empty">
                        <FiMusic size={24} />
                        <p>Нет музыки</p>
                        <small>Загрузите треки в библиотеке ресурсов</small>
                      </div>
                    ) : (
                      filteredMusic.map(track => {
                        const isSelected = data.musicFile === (track.name || track.filename)
                        const isThisPreviewing = previewingMusicUrl === track.url
                        
                        return (
                          <div
                            key={track.id}
                            className={`music-gallery-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setData({ ...data, musicFile: track.name || track.filename })
                              setShowMusicGallery(false)
                              setMusicSearch('')
                              log('INFO', 'Выбран трек', { track: track.name || track.filename })
                            }}
                          >
                            <div className="music-gallery-icon">
                              <FiMusic size={18} />
                            </div>
                            <div className="music-gallery-info">
                              <span className="music-gallery-name">{track.name || track.filename}</span>
                              {track.size && (
                                <span className="music-gallery-size">
                                  {Math.round(track.size / 1024)} КБ
                                </span>
                              )}
                            </div>
                            <button
                              className="music-preview-btn"
                              onClick={(e) => handlePreviewMusic(track, e)}
                              title={isThisPreviewing ? 'Остановить' : 'Прослушать'}
                            >
                              {isThisPreviewing ? <FiPause size={14} /> : <FiPlay size={14} />}
                            </button>
                            {isSelected && (
                              <div className="sprite-gallery-check">✓</div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Чекбокс зацикливания музыки, показывается только если трек выбран */}
            {data.musicFile && (
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label 
                  className="checkbox-label" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    cursor: 'pointer',
                    padding: '10px 0'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={data.loopMusic === true}
                    onChange={(e) => {
                      setData({ ...data, loopMusic: e.target.checked })
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiRepeat /> Зациклить музыку
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Секция выбора фона для конкретного блока */}
          <div className="form-section">
            <h4><FiImage /> Фон блока</h4>
            <div className="form-group">
              <label>Выберите фон (оставьте пустым для фона сцены)</label>
              
              <div className="sprite-selector">
                <div 
                  className="sprite-current"
                  onClick={() => setShowBackgroundGallery(!showBackgroundGallery)}
                >
                  {data.backgroundUrl ? (
                    <div className="sprite-current-preview">
                      <FiImage size={16} />
                      <span className="sprite-current-name">
                        {data.backgroundUrl.split('/').pop()}
                      </span>
                    </div>
                  ) : (
                    <div className="sprite-placeholder">
                      <FiImage />
                      <span>Фон сцены</span>
                    </div>
                  )}
                  <button type="button" className="sprite-toggle-btn">
                    {showBackgroundGallery ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                </div>

                {data.backgroundUrl && (
                  <button 
                    type="button"
                    className="sprite-clear-btn"
                    onClick={() => setData({ ...data, backgroundUrl: '' })}
                  >
                    <FiX /> Фон сцены
                  </button>
                )}
              </div>

              {/* Галерея фонов с превью изображений и поиском */}
              {showBackgroundGallery && (
                <div className="sprite-gallery">
                  <div className="sprite-gallery-filters">
                    <div className="sprite-search-bar">
                      <FiSearch size={14} />
                      <input
                        type="text"
                        placeholder="Поиск фона..."
                        value={backgroundSearch}
                        onChange={(e) => setBackgroundSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {backgroundSearch && (
                        <button className="search-clear" onClick={() => setBackgroundSearch('')}>
                          <FiX size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="background-gallery-grid">
                    {filteredBackgrounds.length === 0 ? (
                      <div className="sprite-gallery-empty">
                        <FiImage size={24} />
                        <p>Нет фонов</p>
                        <small>Загрузите фоны в библиотеке ресурсов</small>
                      </div>
                    ) : (
                      filteredBackgrounds.map(bg => {
                        const isSelected = data.backgroundUrl === bg.url
                        
                        return (
                          <div
                            key={bg.id}
                            className={`background-gallery-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setData({ ...data, backgroundUrl: bg.url })
                              setShowBackgroundGallery(false)
                              setBackgroundSearch('')
                              log('INFO', 'Выбран фон', { background: bg.name || bg.filename })
                            }}
                          >
                            <div className="background-gallery-preview">
                              {bg.type === 'video' ? (
                                <FiPlay size={24} />
                              ) : bg.url ? (
                                <img 
                                  src={bg.url.startsWith('http') ? bg.url : `http://localhost:8000${bg.url}`}
                                  alt={bg.name}
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                  }}
                                />
                              ) : (
                                <FiImage size={24} />
                              )}
                            </div>
                            <div className="background-gallery-name">
                              {bg.name || bg.filename || 'Без имени'}
                            </div>
                            {bg.type === 'video' && (
                              <span className="background-type-badge">Видео</span>
                            )}
                            {isSelected && (
                              <div className="sprite-gallery-check">✓</div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <small className="hint">
              Если выбран фон блока, он будет показан вместо фона сцены
            </small>
          </div>

          {/* Секция редактирования текста диалога */}
          <div className="form-section">
            <h4>Текст</h4>
            <div className="form-group">
              <textarea
                value={data.text || ''}
                onChange={(e) => setData({ ...data, text: e.target.value })}
                rows={3}
                placeholder="Текст диалога..."
              />
            </div>
          </div>

          {/* Секция вариантов ответа */}
          <div className="form-section">
            <h4>Варианты ответа</h4>
            {data.options.map((opt, idx) => (
              <div key={`${node.id}-opt-${opt.id}`} className="option-group">
                {/* Текст опции и баллы */}
                <div className="option-row">
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(opt.id, 'text', e.target.value, e)}
                    placeholder={`Вариант ${idx + 1}`}
                    className="option-input"
                  />
                  
                  <input
                    type="number"
                    value={opt.points || 0}
                    onChange={(e) => updateOption(opt.id, 'points', parseInt(e.target.value) || 0, e)}
                    placeholder="Баллы"
                    className="option-points"
                    min="0"
                    step="1"
                  />
                </div>

                {/* Тип перехода */}
                <div className="option-row">
                  <select
                    value={opt.targetType || 'node'}
                    onChange={(e) => updateOption(opt.id, 'targetType', e.target.value, e)}
                    className="option-type"
                  >
                    <option value="node">Другой блок</option>
                    <option value="next_scene">Следующая сцена</option>
                    <option value="novel_end">Конец новеллы</option>
                  </select>
                </div>

                {/* Подсказки в зависимости от выбранного типа перехода */}
                {opt.targetType === 'next_scene' && (
                  <div className="option-hint-full">
                    При выборе этого варианта произойдет переход на следующую сцену
                  </div>
                )}

                {opt.targetType === 'novel_end' && (
                  <div className="option-hint-full">
                    При выборе этого варианта новелла завершится
                  </div>
                )}

                {opt.targetType === 'node' && (
                  <div className="option-hint-full">
                    Переход на другой блок (нужно соединить линией в редакторе)
                  </div>
                )}

                {/* Кнопка удаления варианта, показывается если опций больше одной */}
                {data.options.length > 1 && (
                  <div className="option-row">
                    <button 
                      onClick={(e) => deleteOption(opt.id, e)} 
                      className="delete-option-full"
                      title="Удалить вариант"
                    >
                      <FiTrash2 /> Удалить вариант
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button onClick={(e) => { e.stopPropagation(); addOption(); }} className="add-option">
              + Добавить вариант
            </button>
          </div>
        </div>

        {/* Футер с кнопками сохранения и отмены */}
        <div className="node-editor-footer">
          <button onClick={handleSave} className="save-btn">Сохранить</button>
          <button onClick={onClose} className="cancel-btn">Отмена</button>
        </div>
      </div>
    </div>
  )
}

export default NodeEditor