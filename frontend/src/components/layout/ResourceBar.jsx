import React, { useState, useRef } from 'react'
import { FiImage, FiMusic, FiUser, FiChevronUp, FiChevronDown, FiTrash2, FiUpload, FiVideo, FiFolder, FiX, FiVolume2, FiSearch, FiFilter, FiUsers, FiEdit2, FiAlertCircle } from 'react-icons/fi'
import { groupSpritesByCharacter, getUniqueCharacters, filterSprites, validateFileName, extractCharacterName } from '../../utils/fileUtils'
import api from '../../utils/api'

export const ResourceBar = ({ projectId, files, onUpload, onSelectResource, onDeleteResource, onRenameFile, onFilesUploaded, loading }) => {
  const [activeTab, setActiveTab] = useState('backgrounds')
  const [backgroundSubTab, setBackgroundSubTab] = useState('all')
  const [isExpanded, setIsExpanded] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState('all')
  const [showRenameDialog, setShowRenameDialog] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadFileName, setUploadFileName] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [conflictAction, setConflictAction] = useState(null)
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchStatus, setBatchStatus] = useState(null)

  const spritesByCharacter = groupSpritesByCharacter(files.sprites || [])
  const uniqueCharacters = getUniqueCharacters(files.sprites || [])
  const filteredSprites = filterSprites(files.sprites || [], searchTerm, selectedCharacter)

  const tabs = [
    { id: 'backgrounds', label: 'Фоны', icon: FiImage },
    { id: 'sprites', label: 'Спрайты', icon: FiUser },
    { id: 'music', label: 'Музыка', icon: FiMusic }
  ]

  const openUploadDialog = (file) => {
    const defaultName = file.name.replace(/\.[^/.]+$/, '')
    setUploadFileName(defaultName)
    setPendingFile(file)
    setUploadError('')
    setConflictAction(null)
    setShowUploadDialog(true)
  }

  const uploadMultipleFiles = async (fileList) => {
    setBatchUploading(true)
    setUploadProgress(0)
    setBatchStatus(`Загрузка ${fileList.length} файлов...`)

    const formData = new FormData()
    fileList.forEach(file => formData.append('files', file))

    try {
      const response = await api.post(
        `/projects/${projectId}/upload/${activeTab}/batch`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
            }
          }
        }
      )

      if (onFilesUploaded) await onFilesUploaded()

      const data = response.data
      if (data.errors && data.errors.length > 0) {
        setBatchStatus(`Загружено ${data.uploaded} из ${fileList.length}. Ошибки: ${data.errors.slice(0, 3).join('; ')}`)
      } else {
        setBatchStatus(`Загружено ${data.uploaded} файлов`)
      }

      setTimeout(() => setBatchStatus(null), 3000)
      return { success: true, uploaded: data.uploaded }
    } catch (error) {
      setBatchStatus(`Ошибка: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setBatchStatus(null), 5000)
      return { success: false }
    } finally {
      setBatchUploading(false)
      setUploadProgress(null)
    }
  }

  const handleUploadConfirm = async () => {
    const validation = validateFileName(uploadFileName)
    if (!validation.isValid) {
      setUploadError(validation.error)
      return
    }
    await performUpload()
  }

  const performUpload = async () => {
    setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress(prev => { if (prev >= 90) { clearInterval(interval); return 90 } return prev + 10 })
    }, 100)
    await onUpload(pendingFile, activeTab, uploadFileName)
    clearInterval(interval)
    setUploadProgress(100)
    setTimeout(() => { setUploadProgress(null); setShowUploadDialog(false); setPendingFile(null); setUploadFileName(''); setConflictAction(null) }, 1000)
  }

  const cancelUpload = () => {
    setShowUploadDialog(false); setPendingFile(null); setUploadFileName(''); setUploadError(''); setConflictAction(null)
  }

  const handleRenameClick = (file, fileType) => {
    const currentName = file.name || file.filename || ''
    const nameWithoutExt = currentName.replace(/\.[^/.]+$/, '')
    setRenameValue(nameWithoutExt)
    setRenameError('')
    setShowRenameDialog({ file, fileType })
  }

  const handleRenameConfirm = async () => {
    const validation = validateFileName(renameValue)
    if (!validation.isValid) {
      setRenameError(validation.error)
      return
    }

    const oldName = showRenameDialog.file.name || showRenameDialog.file.filename || ''
    const extension = oldName.split('.').pop()
    const newNameWithExt = `${renameValue}.${extension}`

    if (onRenameFile) {
      const result = await onRenameFile(showRenameDialog.file, showRenameDialog.fileType, newNameWithExt)
      if (result && result.success) {
        setShowRenameDialog(null)
        setRenameValue('')
        setRenameError('')
      } else {
        setRenameError(result?.error || 'Ошибка переименования')
      }
    }
  }

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length === 0) return
    if (droppedFiles.length === 1) openUploadDialog(droppedFiles[0])
    else uploadMultipleFiles(droppedFiles)
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length === 0) return
    if (selectedFiles.length === 1) openUploadDialog(selectedFiles[0])
    else uploadMultipleFiles(selectedFiles)
    e.target.value = ''
  }

  const getAcceptTypes = () => {
    if (activeTab === 'backgrounds') {
      if (backgroundSubTab === 'images') return '.jpg,.jpeg,.png'
      if (backgroundSubTab === 'videos') return '.mp4'
      return '.jpg,.jpeg,.png,.mp4'
    }
    if (activeTab === 'music') return '.mp3'
    if (activeTab === 'sprites') return '.png'
    return '.jpg,.jpeg,.png'
  }

  const handleDeleteClick = (file, fileType, e) => { e.stopPropagation(); setDeleteConfirm({ file, fileType }) }

  const confirmDelete = async () => {
    if (deleteConfirm && onDeleteResource) {
      await onDeleteResource(deleteConfirm.file, deleteConfirm.fileType)
      setDeleteConfirm(null)
    }
  }

  const getFilteredBackgrounds = () => {
    if (activeTab !== 'backgrounds') return []
    const backgrounds = files.backgrounds || []
    if (backgroundSubTab === 'images') return backgrounds.filter(f => f.type === 'image')
    if (backgroundSubTab === 'videos') return backgrounds.filter(f => f.type === 'video')
    return backgrounds
  }

  const renderResourceItem = (file, fileType, showCharacter = false) => {
    const PreviewIcon = file.type === 'audio' ? FiVolume2 : file.type === 'video' ? FiVideo : FiImage
    const characterName = showCharacter ? extractCharacterName(file.name || file.filename || '') : null
    const fileUrl = file.url || ''

    return (
      <div key={file.id} className="resource-item" onClick={() => onSelectResource(file, activeTab)}
        draggable={activeTab !== 'sprites'}
        onDragStart={(e) => { if (activeTab !== 'sprites') { e.dataTransfer.setData('application/json', JSON.stringify(file)); e.dataTransfer.effectAllowed = 'copy' } else { e.preventDefault() } }}>

        {file.type === 'audio' ? (
          <div className="resource-preview audio"><PreviewIcon className="preview-icon" /></div>
        ) : file.type === 'video' ? (
          <div className="resource-preview video">
            {fileUrl ? (
              <video src={fileUrl} className="resource-preview-video" muted preload="metadata"
                onMouseOver={e => e.target.play().catch(() => {})}
                onMouseOut={e => { e.target.pause(); e.target.currentTime = 0 }}
                onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<div class="preview-icon">🎬</div>' }} />
            ) : (
              <div className="preview-icon">🎬</div>
            )}
          </div>
        ) : (
          <div className="resource-preview image">
            {fileUrl ? (
              <img src={fileUrl} alt={file.name}
                onError={(e) => { e.target.style.display = 'none'; const parent = e.target.parentNode; if (parent) parent.innerHTML = '<div class="preview-icon">🖼️</div>' }} />
            ) : (
              <PreviewIcon className="preview-icon" />
            )}
          </div>
        )}

        <div className="resource-info">
          <div className="resource-name" title={file.name}>{file.name}</div>
          {showCharacter && characterName && fileType === 'sprites' && (
            <div className="resource-character"><FiUser size={12} /><span>{characterName}</span></div>
          )}
          <div className="resource-meta">
            <span className="resource-size">{file.size ? Math.round(file.size / 1024) : 0} КБ</span>
          </div>
        </div>

        <div className="resource-actions">
          <button className="resource-rename-btn" onClick={(e) => { e.stopPropagation(); handleRenameClick(file, fileType) }} title="Переименовать">
            <FiEdit2 />
          </button>
          <button className="resource-delete-btn" onClick={(e) => handleDeleteClick(file, fileType, e)} title="Удалить">
            <FiTrash2 />
          </button>
        </div>
      </div>
    )
  }

  const renderSpritesContent = () => {
    if (searchTerm !== '' || selectedCharacter !== 'all') {
      if (filteredSprites.length === 0) {
        return <div className="resources-empty"><p>Нет спрайтов по фильтру</p></div>
      }
      return (
        <div className="resources-grid">
          {filteredSprites.map(sprite => renderResourceItem(sprite, 'sprites', true))}
        </div>
      )
    }

    if (Object.keys(spritesByCharacter).length === 0) {
      return <div className="resources-empty"><p>Нет загруженных спрайтов</p></div>
    }

    return Object.entries(spritesByCharacter).map(([character, characterSprites]) => (
      <div key={character} className="character-group">
        <div className="character-group-header">
          <FiUsers size={16} /><span className="character-name">{character}</span>
          <span className="character-count">({characterSprites.length})</span>
        </div>
        <div className="character-sprites-grid">
          {characterSprites.map(sprite => renderResourceItem(sprite, 'sprites', false))}
        </div>
      </div>
    ))
  }

  const ActiveTabIcon = tabs.find(t => t.id === activeTab)?.icon || FiFolder
  const currentFiles = activeTab === 'backgrounds' ? getFilteredBackgrounds() : activeTab === 'music' ? (files.music || []) : null
  const isSpritesTab = activeTab === 'sprites'

  return (
    <div className={`resource-bar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="resource-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3><ActiveTabIcon /> Библиотека ресурсов</h3>
        <button className="toggle-btn">{isExpanded ? <FiChevronUp /> : <FiChevronDown />}</button>
      </div>

      {isExpanded && (
        <div className="resource-content">
          <div className="resource-tabs">
            {tabs.map(tab => {
              const Icon = tab.icon; const count = files[tab.id]?.length || 0; const isActive = activeTab === tab.id
              return (
                <button key={tab.id} className={`tab ${isActive ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                  <Icon /> <span className="tab-label">{tab.label}</span>
                  {count > 0 && <span className={`tab-count ${isActive ? 'active-count' : ''}`}>{count}</span>}
                </button>
              )
            })}
          </div>

          {activeTab === 'backgrounds' && (
            <div className="resource-subtabs">
              <button className={`subtab ${backgroundSubTab === 'all' ? 'active' : ''}`} onClick={() => setBackgroundSubTab('all')}>
                <FiFolder size={14} /><span>Все</span>
              </button>
              <button className={`subtab ${backgroundSubTab === 'images' ? 'active' : ''}`} onClick={() => setBackgroundSubTab('images')}>
                <FiImage size={14} /><span>Изображения</span>
              </button>
              <button className={`subtab ${backgroundSubTab === 'videos' ? 'active' : ''}`} onClick={() => setBackgroundSubTab('videos')}>
                <FiVideo size={14} /><span>Видео</span>
              </button>
            </div>
          )}

          {activeTab === 'sprites' && (
            <div className="resource-filters">
              <div className="search-bar">
                <FiSearch size={16} />
                <input type="text" placeholder="Поиск спрайтов..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                {searchTerm && <button className="search-clear" onClick={() => setSearchTerm('')}><FiX size={14} /></button>}
              </div>
              <div className="character-filter">
                <FiFilter size={16} />
                <select value={selectedCharacter} onChange={(e) => setSelectedCharacter(e.target.value)}>
                  <option value="all">Все персонажи</option>
                  {uniqueCharacters.map(char => <option key={char} value={char}>{char}</option>)}
                </select>
                {selectedCharacter !== 'all' && <button className="filter-clear" onClick={() => setSelectedCharacter('all')}><FiX size={14} /></button>}
              </div>
            </div>
          )}

          <div className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
            <input key={`${activeTab}-${backgroundSubTab}`} type="file" accept={getAcceptTypes()}
              onChange={handleFileSelect} className="file-input-hidden" id="file-upload" multiple />
            <label htmlFor="file-upload" className="upload-zone-label">
              <div className="upload-zone-icon"><FiUpload size={32} /></div>
              <div className="upload-zone-text">Перетащите файлы или нажмите для выбора</div>
              <div className="upload-zone-hint">
                {activeTab === 'sprites' ? 'PNG (с прозрачностью)' :
                 activeTab === 'music' ? 'MP3' :
                 activeTab === 'backgrounds' ? 'JPG, PNG, MP4' : 'JPG, PNG'}
              </div>
              <div className="upload-zone-hint-multi">Можно выбрать несколько файлов сразу</div>
            </label>
          </div>

          {batchStatus && (
            <div className="batch-status" style={{
              padding: '10px 14px', margin: '8px 0', borderRadius: '8px', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: batchStatus.includes('Ошибка') ? '#fee2e2' : '#d1fae5',
              color: batchStatus.includes('Ошибка') ? '#dc2626' : '#065f46'
            }}>{batchStatus}</div>
          )}

          {(uploadProgress !== null && !batchStatus) && (
            <div className="upload-progress">
              <div className="upload-progress-bar" style={{ width: `${uploadProgress || 0}%` }} />
              <span className="upload-progress-text">{uploadProgress || 0}%</span>
            </div>
          )}

          {loading ? (
            <div className="loading-files"><div className="loader-small"></div><span>Загрузка файлов...</span></div>
          ) : (
            <div className="resources-scroll-container">
              {isSpritesTab ? (
                <div className="sprites-container">{renderSpritesContent()}</div>
              ) : (
                <div className="resources-grid">
                  {currentFiles?.map(file => renderResourceItem(file, activeTab, false))}
                  {(!currentFiles || currentFiles.length === 0) && <div className="resources-empty"><p>Нет загруженных файлов</p></div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showUploadDialog && (
        <div className="modal-overlay" onClick={cancelUpload}>
          <div className="modal-content upload-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Загрузка файла</h3><button className="modal-close" onClick={cancelUpload}><FiX /></button></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Имя файла</label>
                <input type="text" value={uploadFileName} onChange={(e) => { setUploadFileName(e.target.value); setUploadError('') }} placeholder="Введите имя файла" autoFocus />
                {activeTab === 'sprites' && <small className="hint">Используйте _ для группировки: "Анна_портрет"</small>}
              </div>
              {uploadError && <div className="error-message"><FiAlertCircle size={16} /><span>{uploadError}</span></div>}
            </div>
            <div className="modal-footer">
              <button onClick={cancelUpload} className="cancel-btn">Отмена</button>
              <button onClick={handleUploadConfirm} className="save-btn">Загрузить</button>
            </div>
          </div>
        </div>
      )}

      {showRenameDialog && (
        <div className="modal-overlay" onClick={() => setShowRenameDialog(null)}>
          <div className="modal-content rename-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Переименовать файл</h3><button className="modal-close" onClick={() => setShowRenameDialog(null)}><FiX /></button></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Новое имя</label>
                <input type="text" value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }} placeholder="Введите новое имя" autoFocus />
              </div>
              {renameError && <div className="error-message"><FiAlertCircle size={16} /><span>{renameError}</span></div>}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowRenameDialog(null)} className="cancel-btn">Отмена</button>
              <button onClick={handleRenameConfirm} className="save-btn">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Удалить файл?</h3>
            <p>Вы уверены, что хотите удалить "{deleteConfirm.file.name}"?</p>
            <div className="confirm-actions">
              <button onClick={confirmDelete} className="confirm-yes"><FiTrash2 /> Удалить</button>
              <button onClick={() => setDeleteConfirm(null)} className="confirm-no"><FiX /> Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}