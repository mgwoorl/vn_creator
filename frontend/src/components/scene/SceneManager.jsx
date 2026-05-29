import React, { useState } from 'react'
import { FiPlus, FiTrash2, FiImage, FiVideo, FiFolder, FiAlertCircle, FiX } from 'react-icons/fi'

export const SceneManager = ({ 
  scenes, 
  currentSceneId, 
  onCreateScene, 
  onSelectScene, 
  onDeleteScene,
  loading 
}) => {
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  if (loading) {
    return <div className="loading">Загрузка сцен...</div>
  }

  const getBackgroundPreview = (scene) => {
    if (!scene.background_url) return <FiFolder />
    return scene.background_type === 'video' ? <FiVideo /> : <FiImage />
  }

  const getBackgroundUrl = (url) => {
    if (!url) return null
    return url.startsWith('http') ? url : `http://localhost:8000${url}`
  }

  const handleDeleteClick = (e, sceneId) => {
    e.stopPropagation()
    setDeleteConfirm(sceneId)
  }

  const handleConfirmDelete = () => {
    if (deleteConfirm && onDeleteScene) {
      onDeleteScene(deleteConfirm)
    }
    setDeleteConfirm(null)
  }

  return (
    <div className="scene-manager">
      <div className="scene-header">
        <h3><FiFolder /> Сцены ({scenes.length})</h3>
        <button onClick={onCreateScene} className="create-scene-btn">
          <FiPlus /> Новая сцена
        </button>
      </div>

      {scenes.length === 0 ? (
        <div className="empty-scenes">
          <p>В этом проекте еще нет сцен</p>
          <p className="hint">Создайте первую сцену</p>
        </div>
      ) : (
        <div className="scenes-grid">
          {scenes.map((scene, index) => (
            <div
              key={scene.id}
              className={`scene-card ${scene.id === currentSceneId ? 'active' : ''}`}
              onClick={() => onSelectScene(scene)}
            >
              <div className="scene-card-header">
                <span className="scene-index">#{index + 1}</span>
                <span className="scene-name">{scene.name}</span>
                <button 
                  className="scene-delete"
                  onClick={(e) => handleDeleteClick(e, scene.id)}
                  title="Удалить сцену"
                >
                  <FiTrash2 />
                </button>
              </div>
              
              <div className="scene-preview-container">
                {scene.background_url ? (
                  scene.background_type === 'video' ? (
                    <div className="scene-preview-placeholder">
                      <FiVideo />
                    </div>
                  ) : (
                    <img 
                      src={getBackgroundUrl(scene.background_url)}
                      alt={scene.name}
                      className="scene-preview"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.parentNode.innerHTML = '<div class="scene-preview-placeholder"><FiImage /></div>'
                      }}
                    />
                  )
                ) : (
                  <div className="scene-preview-placeholder">
                    <FiFolder />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3><FiAlertCircle /> Удалить сцену?</h3>
            <p>Это действие нельзя отменить. Все узлы и связи сцены будут удалены.</p>
            <div className="confirm-actions">
              <button onClick={handleConfirmDelete} className="confirm-yes">
                <FiTrash2 /> Удалить
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="confirm-no">
                <FiX /> Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}