import React, { useState, useEffect, useRef } from 'react'
import { 
  FiSettings, FiEye, FiTrash2, FiX, FiSave, 
  FiAlertCircle, FiFolder, FiUpload, FiTag, FiUsers
} from 'react-icons/fi'
import { ResourceBar } from '../layout/ResourceBar'
import { SceneManager } from '../scene/SceneManager'
import { SceneBuilder } from '../scene/SceneBuilder'
import ProjectPreview from '../preview/ProjectPreview'
import { useProject } from '../../context/ProjectContext'
import { useFiles } from '../../context/FileContext'
import { useScenes } from '../../context/SceneContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../common/ToastContext'
import api from '../../utils/api'

export const ProjectEditor = ({ project, onClose }) => {
  const { user } = useAuth()
  const { addToast } = useToast()
  
  const { 
    loadProject, updateProject, deleteProject,
    currentProject, allStatuses, fetchAllStatuses, clearCurrentProject,
    loading: projectLoading
  } = useProject()
  
  const {
    projectFiles, filesLoading,
    loadProjectFiles, uploadFile, deleteFile, renameFile
  } = useFiles()
  
  const {
    projectScenes, scenesLoading,
    loadProjectScenes, loadFullScene, createScene, saveScene, deleteScene
  } = useScenes()
  
  const [currentScene, setCurrentScene] = useState(null)
  const [editingScene, setEditingScene] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewProject, setPreviewProject] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showNewRewardStatusInput, setShowNewRewardStatusInput] = useState('')
  const [addingRewardStatus, setAddingRewardStatus] = useState(false)
  const [groupsList, setGroupsList] = useState([])
  const [projectSettings, setProjectSettings] = useState({
    title: project.title || '',
    description: project.description || '',
    cover_url: project.cover_url || '',
    min_points: project.min_points || 0,
    reward_status: project.reward_status || 'Стажёр',
    is_published: project.is_published || false,
    required_statuses: project.required_statuses || [],
    group_ids: project.group_ids || []
  })
  
  const hasLoadedRef = useRef(false)

  const isLoading = projectLoading || filesLoading || scenesLoading

  // Загрузка статусов и групп при монтировании
  useEffect(() => {
    if (user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'super_admin') {
      fetchAllStatuses()
      loadGroups()
    }
  }, [user])

  // Загрузка данных проекта
  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    
    const loadData = async () => {
      await Promise.all([
        loadProject(project.id),
        loadProjectScenes(project.id),
        loadProjectFiles(project.id)
      ])
    }
    loadData()
    
    return () => { 
      clearCurrentProject() 
    }
  }, [project.id])

  // Обновление previewProject при изменении данных
  useEffect(() => {
    if (currentProject && projectFiles) {
      const updatedProject = {
        ...currentProject,
        sprites: projectFiles.sprites || [],
        music: projectFiles.music || [],
        backgrounds: projectFiles.backgrounds || []
      }
      setPreviewProject(updatedProject)
    }
  }, [currentProject, projectFiles])

  const loadGroups = async () => {
    try {
      const response = await api.get('/users/groups')
      setGroupsList(response.data)
    } catch (error) {
      console.error('Ошибка загрузки групп:', error)
    }
  }

  const handleUpload = async (file, fileType, customName = null) => {
    const result = await uploadFile(project.id, file, fileType, customName)
    if (result.success) {
      addToast('Файл загружен', 'success')
    } else {
      addToast(result.error || 'Ошибка загрузки файла', 'error')
    }
    return result
  }

  const handleDeleteFile = async (file, fileType) => {
    const result = await deleteFile(project.id, file, fileType)
    if (result.success) {
      addToast('Файл удалён', 'success')
    }
  }

  const handleRenameFile = async (file, fileType, newName) => {
    const result = await renameFile(project.id, file, fileType, newName)
    if (result.success) {
      addToast('Файл переименован', 'success')
    }
    return result
  }

  const handleCreateScene = async () => {
    const result = await createScene(project.id, 'Новая сцена')
    if (result.success) {
      addToast('Сцена создана', 'success')
      const fullSceneResult = await loadFullScene(result.scene.id)
      if (fullSceneResult.success) {
        setCurrentScene(fullSceneResult.scene)
        setEditingScene(true)
      }
    } else {
      addToast(result.error || 'Ошибка создания сцены', 'error')
    }
  }

  const handleSaveScene = async (sceneData) => {
    const result = await saveScene(sceneData.id, sceneData)
    if (result.success) {
      addToast('Сцена сохранена', 'success')
      setEditingScene(false)
      setCurrentScene(null)
      await loadProjectScenes(project.id)
    } else {
      addToast(result.error || 'Ошибка сохранения сцены', 'error')
    }
  }

  const handleSelectScene = async (scene) => {
    const result = await loadFullScene(scene.id)
    if (result.success) {
      setCurrentScene(result.scene)
      setEditingScene(true)
    }
  }

  const handleDeleteScene = async (sceneId) => {
    if (window.confirm('Удалить сцену? Все блоки и связи будут удалены.')) {
      const result = await deleteScene(sceneId)
      if (result.success) {
        addToast('Сцена удалена', 'success')
      }
    }
  }

  const handleSaveSettings = async () => {
    if (projectSettings.is_published && projectScenes.length === 0) {
      addToast('Нельзя опубликовать проект без сцен', 'warning')
      setProjectSettings({ ...projectSettings, is_published: false })
      return
    }
    
    const result = await updateProject(project.id, {
      ...projectSettings,
      group_ids: projectSettings.group_ids || []
    })
    if (result.success) {
      addToast('Настройки сохранены', 'success')
      setShowSettings(false)
      await fetchAllStatuses()
    } else {
      addToast(result.error || 'Ошибка сохранения настроек', 'error')
    }
  }

  const handleDeleteProject = async () => {
    const result = await deleteProject(project.id)
    if (result.success) {
      addToast('Проект удалён', 'success')
      onClose()
    } else {
      addToast(result.error || 'Ошибка удаления проекта', 'error')
    }
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (projectSettings.cover_url) {
      try {
        const oldFileName = projectSettings.cover_url.split('/').pop()
        await api.delete(`/projects/${project.id}/files/covers/${encodeURIComponent(oldFileName)}`)
      } catch (error) {
        // Игнорируем ошибку, файл мог быть уже удалён
      }
    }

    const result = await uploadFile(project.id, file, 'covers')
    if (result.success) {
      setProjectSettings({ ...projectSettings, cover_url: result.file.url })
      addToast('Обложка загружена', 'success')
    }
  }

  const handleCoverRemove = async () => {
    if (projectSettings.cover_url) {
      try {
        const oldFileName = projectSettings.cover_url.split('/').pop()
        await api.delete(`/projects/${project.id}/files/covers/${encodeURIComponent(oldFileName)}`)
      } catch (error) {
        // Игнорируем ошибку
      }
    }
    setProjectSettings({ ...projectSettings, cover_url: '' })
    addToast('Обложка удалена', 'success')
  }

  const handleAddNewRewardStatus = async () => {
    if (!showNewRewardStatusInput.trim()) return
    setAddingRewardStatus(true)
    
    try {
      const response = await api.post('/projects/statuses/add', {
        name: showNewRewardStatusInput.trim()
      })
      await fetchAllStatuses()
      setProjectSettings({ ...projectSettings, reward_status: response.data.name })
      addToast('Статус добавлен', 'success')
    } catch (error) {
      addToast(error.response?.data?.detail || 'Ошибка добавления статуса', 'error')
    } finally {
      setAddingRewardStatus(false)
      setShowNewRewardStatusInput('')
    }
  }

  // Показываем экран загрузки при первой загрузке
  if (isLoading && !hasLoadedRef.current) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка проекта...</p>
      </div>
    )
  }

  const coverPreviewUrl = projectSettings.cover_url
    ? (projectSettings.cover_url.startsWith('http') ? projectSettings.cover_url : projectSettings.cover_url)
    : null

  return (
    <div className="project-editor">
      {/* Шапка редактора */}
      <div className="editor-header">
        <div className="header-left">
          <h2 className="project-title">{currentProject?.title || project.title}</h2>
        </div>
        <div className="header-right">
          {coverPreviewUrl && (
            <img src={coverPreviewUrl} alt="cover" className="project-cover-thumb" />
          )}
          <div className="scene-counter">
            <FiFolder /> {projectScenes.length} {projectScenes.length === 1 ? 'сцена' : projectScenes.length >= 2 && projectScenes.length <= 4 ? 'сцены' : 'сцен'}
          </div>
          <button onClick={() => setShowSettings(true)} className="settings-btn" title="Настройки проекта">
            <FiSettings />
          </button>
          <button onClick={() => setShowPreview(true)} className="preview-btn" title="Предпросмотр">
            <FiEye />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="delete-project-btn" title="Удалить проект">
            <FiTrash2 />
          </button>
          <button onClick={onClose} className="close-btn" title="Закрыть редактор">
            <FiX />
          </button>
        </div>
      </div>

      {/* Основное содержимое редактора */}
      <div className="editor-content">
        <ResourceBar
          projectId={project.id}
          files={projectFiles}
          onUpload={handleUpload}
          onDeleteResource={handleDeleteFile}
          onRenameFile={handleRenameFile}
          onFilesUploaded={() => loadProjectFiles(project.id)}
          onSelectResource={(file, type) => {
            if (type === 'backgrounds' && currentScene) {
              setCurrentScene({ 
                ...currentScene, 
                background_url: file.url, 
                background_type: file.type === 'video' ? 'video' : 'image' 
              })
            }
          }}
          loading={filesLoading}
        />

        {!editingScene ? (
          <SceneManager
            scenes={projectScenes}
            currentSceneId={currentScene?.id}
            onCreateScene={handleCreateScene}
            onSelectScene={handleSelectScene}
            onDeleteScene={handleDeleteScene}
            loading={scenesLoading}
          />
        ) : (
          <SceneBuilder
            scene={currentScene}
            allScenes={projectScenes}
            onSave={handleSaveScene}
            onClose={() => { 
              setEditingScene(false)
              setCurrentScene(null) 
            }}
            sprites={projectFiles.sprites || []}
            music={projectFiles.music || []}
            backgrounds={projectFiles.backgrounds || []}
          />
        )}
      </div>

      {/* Предпросмотр проекта */}
      {showPreview && previewProject && (
        <ProjectPreview 
          project={previewProject} 
          onClose={() => setShowPreview(false)} 
          hidePoints={false} 
        />
      )}

      {/* Модальное окно настроек проекта */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><FiSettings /> Настройки проекта</h3>
              <button className="modal-close" onClick={() => setShowSettings(false)}>
                <FiX />
              </button>
            </div>
            
            <div className="modal-body">
              {/* Название */}
              <div className="form-group">
                <label>Название</label>
                <input 
                  type="text" 
                  value={projectSettings.title} 
                  onChange={e => setProjectSettings({ ...projectSettings, title: e.target.value })} 
                />
              </div>
              
              {/* Описание */}
              <div className="form-group">
                <label>Описание</label>
                <textarea 
                  value={projectSettings.description} 
                  onChange={e => setProjectSettings({ ...projectSettings, description: e.target.value })} 
                  rows={3} 
                />
              </div>
              
              {/* Обложка */}
              <div className="form-group">
                <label>Обложка проекта</label>
                <div className="cover-upload-container">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleCoverUpload} 
                    className="cover-file-input" 
                    id="cover-upload" 
                  />
                  <label htmlFor="cover-upload" className="cover-upload-label">
                    <div className="cover-upload-icon"><FiUpload /></div>
                    <span className="cover-upload-text">Выберите файл или перетащите</span>
                    <span className="cover-upload-hint">PNG, JPG</span>
                  </label>
                  {coverPreviewUrl && (
                    <div className="cover-preview-container">
                      <img src={coverPreviewUrl} alt="Preview" className="cover-preview-image" />
                      <button className="cover-preview-remove" onClick={handleCoverRemove} title="Удалить обложку">
                        <FiX />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Минимальные баллы */}
              <div className="form-group">
                <label>Минимальные баллы для получения статуса</label>
                <input 
                  type="number" 
                  value={projectSettings.min_points} 
                  onChange={e => setProjectSettings({ ...projectSettings, min_points: parseInt(e.target.value) || 0 })} 
                  min="0" 
                />
              </div>

              {/* Статус за прохождение */}
              <div className="form-group">
                <label>Статус за прохождение</label>
                <div className="reward-status-container">
                  <select 
                    value={projectSettings.reward_status} 
                    onChange={e => setProjectSettings({ ...projectSettings, reward_status: e.target.value })} 
                    className="reward-status-select"
                  >
                    {allStatuses.map(status => (
                      <option key={status.id} value={status.name}>{status.name}</option>
                    ))}
                  </select>
                  <div className="new-reward-status-input-group">
                    <input 
                      type="text" 
                      value={showNewRewardStatusInput} 
                      onChange={(e) => setShowNewRewardStatusInput(e.target.value)} 
                      placeholder="Название нового статуса" 
                      className="new-status-input" 
                    />
                    <button 
                      onClick={handleAddNewRewardStatus} 
                      className="add-reward-status-btn" 
                      disabled={addingRewardStatus || !showNewRewardStatusInput.trim()}
                    >
                      {addingRewardStatus ? '...' : 'Создать'}
                    </button>
                  </div>
                </div>
                <small className="hint">Студент получит этот статус после успешного прохождения</small>
              </div>
              
              {/* Требуемые статусы */}
              <div className="form-group">
                <label><FiTag /> Требуемые статусы для доступа</label>
                <div className="required-statuses-container">
                  <div className="selected-statuses">
                    {projectSettings.required_statuses.map(status => (
                      <div key={status} className="status-tag selected">
                        {status}
                        <button 
                          onClick={() => setProjectSettings({ 
                            ...projectSettings, 
                            required_statuses: projectSettings.required_statuses.filter(s => s !== status) 
                          })} 
                          className="remove-status"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {(!projectSettings.required_statuses || projectSettings.required_statuses.length === 0) && (
                      <span className="hint">Не выбрано (проект доступен всем)</span>
                    )}
                  </div>
                  <div className="statuses-list">
                    <label>Выберите из существующих:</label>
                    <div className="status-options">
                      {allStatuses.map(status => (
                        <div 
                          key={status.id} 
                          className={`status-option ${projectSettings.required_statuses?.includes(status.name) ? 'selected' : ''}`}
                          onClick={() => {
                            if (projectSettings.required_statuses?.includes(status.name)) {
                              setProjectSettings({ 
                                ...projectSettings, 
                                required_statuses: projectSettings.required_statuses.filter(s => s !== status.name) 
                              })
                            } else {
                              setProjectSettings({ 
                                ...projectSettings, 
                                required_statuses: [...(projectSettings.required_statuses || []), status.name] 
                              })
                            }
                          }}
                        >
                          {status.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <small className="hint">Студент должен иметь хотя бы один из указанных статусов</small>
              </div>

              {/* Группы */}
              <div className="form-group">
                <label><FiUsers /> Группы для доступа</label>
                <div className="required-statuses-container">
                  <div className="selected-statuses">
                    {projectSettings.group_ids && projectSettings.group_ids.map(groupId => {
                      const group = groupsList.find(g => g.id === groupId)
                      return group ? (
                        <div key={groupId} className="status-tag selected">
                          {group.name}
                          <button 
                            onClick={() => setProjectSettings({ 
                              ...projectSettings, 
                              group_ids: projectSettings.group_ids.filter(id => id !== groupId) 
                            })} 
                            className="remove-status"
                          >
                            ×
                          </button>
                        </div>
                      ) : null
                    })}
                    {(!projectSettings.group_ids || projectSettings.group_ids.length === 0) && (
                      <span className="hint">Не выбрано (доступно всем группам)</span>
                    )}
                  </div>
                  <div className="statuses-list">
                    <label>Выберите группы:</label>
                    <div className="status-options">
                      {groupsList.map(group => (
                        <div 
                          key={group.id} 
                          className={`status-option ${projectSettings.group_ids?.includes(group.id) ? 'selected' : ''}`}
                          onClick={() => {
                            if (projectSettings.group_ids?.includes(group.id)) {
                              setProjectSettings({ 
                                ...projectSettings, 
                                group_ids: projectSettings.group_ids.filter(id => id !== group.id) 
                              })
                            } else {
                              setProjectSettings({ 
                                ...projectSettings, 
                                group_ids: [...(projectSettings.group_ids || []), group.id] 
                              })
                            }
                          }}
                        >
                          {group.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <small className="hint">Студент должен быть в одной из выбранных групп</small>
              </div>
              
              {/* Публикация */}
              <div className="form-group checkbox-group">
                <label htmlFor="publish-checkbox" className="checkbox-label">
                  <FiEye /> Опубликовать проект
                </label>
                <input 
                  type="checkbox" 
                  id="publish-checkbox" 
                  checked={projectSettings.is_published}
                  onChange={(e) => { 
                    e.stopPropagation()
                    setProjectSettings({ ...projectSettings, is_published: e.target.checked }) 
                  }}
                  className="checkbox-input"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button onClick={handleSaveSettings} className="save-btn">
                <FiSave /> Сохранить
              </button>
              <button onClick={() => setShowSettings(false)} className="cancel-btn">
                <FiX /> Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Подтверждение удаления проекта */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3><FiAlertCircle /> Удалить проект?</h3>
            <p>Это действие нельзя отменить. Все сцены и файлы будут удалены.</p>
            <div className="confirm-actions">
              <button onClick={handleDeleteProject} className="confirm-yes">
                <FiTrash2 /> Удалить
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="confirm-no">
                <FiX /> Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}