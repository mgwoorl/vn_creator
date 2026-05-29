import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiEdit, FiPlay, FiStar, FiCheckCircle, FiTag, FiRefreshCw, FiBookOpen, FiTrash2, FiAward } from 'react-icons/fi'

// Заглушка для отсутствующей обложки
const DefaultCover = () => (
  <div className="default-cover">
    <FiBookOpen className="default-cover-icon" />
    <span>Нет обложки</span>
  </div>
)

export const ProjectCard = ({ project, onPlay, userRole, isCompleted = false, onDelete }) => {
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Формируем URL обложки с учётом возможного относительного пути
  const coverUrl = project.cover_url
    ? (project.cover_url.startsWith('http')
        ? project.cover_url
        : `http://localhost:8000${project.cover_url}`)
    : null

  // Клик по карточке — переход на страницу деталей проекта
  const handleCardClick = (e) => {
    if (e.target.closest('button')) return
    navigate(`/project/${project.id}`)
  }

  // Клик по кнопке действия (Играть / Продолжить / Редактировать)
  const handleActionClick = (e) => {
    e.stopPropagation()
    if (userRole === 'teacher' || userRole === 'admin' || userRole === 'super_admin') {
      navigate(`/projects/edit/${project.id}`)
    } else {
      navigate(`/projects/play/${project.id}`)
    }
  }

  // Клик по кнопке удаления
  const handleDeleteClick = (e) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  // Подтверждение удаления
  const handleConfirmDelete = (e) => {
    e.stopPropagation()
    if (onDelete) onDelete(project.id)
    setShowDeleteConfirm(false)
  }

  // Отмена удаления
  const handleCancelDelete = (e) => {
    e.stopPropagation()
    setShowDeleteConfirm(false)
  }

  // Обрезаем длинные тексты для красивого отображения
  const description = project.description || ''
  const shortDescription = description.length > 100 ? description.slice(0, 100) + '...' : description
  const shortTitle = project.title && project.title.length > 35 ? project.title.slice(0, 35) + '...' : project.title

  // Карточка для учителя / администратора
  if (userRole === 'teacher' || userRole === 'admin' || userRole === 'super_admin') {
    return (
      <div className="project-card teacher-card" onClick={handleCardClick}>
        <div className="project-cover">
          {coverUrl ? <img src={coverUrl} alt={project.title} /> : <DefaultCover />}
          <div className="cover-badge-container">
            {!project.is_published && <div className="cover-badge draft-badge">Черновик</div>}
            {project.is_published && <div className="cover-badge published-badge">Опубликован</div>}
          </div>
        </div>
        <div className="project-content">
          <h3 className="project-title" title={project.title}>{shortTitle}</h3>
          {description && <p className="project-description">{shortDescription}</p>}

          {/* Требуемые статусы */}
          {project.required_statuses && project.required_statuses.length > 0 && (
            <div className="project-required-statuses">
              <small><FiTag /> Требуемые статусы:</small>
              <div className="status-tags">
                {project.required_statuses.map(s => <span key={s} className="status-tag">{s}</span>)}
              </div>
            </div>
          )}

          {/* Группы */}
          {project.groups && project.groups.length > 0 && (
            <div className="project-required-statuses">
              <small>Группы:</small>
              <div className="status-tags">
                {project.groups.map(g => <span key={g} className="status-tag">{g}</span>)}
              </div>
            </div>
          )}

          {/* Награда */}
          {project.reward_status && (
            <div className="project-reward">
              <FiAward className="reward-icon" />
              <span className="reward-text">Награда: <strong>{project.reward_status}</strong></span>
            </div>
          )}

          <div className="project-footer">
            <button className="edit-btn" onClick={handleActionClick}><FiEdit /> Редактировать</button>
            <button className="delete-btn" onClick={handleDeleteClick} title="Удалить"><FiTrash2 /></button>
          </div>
        </div>

        {/* Диалог подтверждения удаления */}
        {showDeleteConfirm && (
          <div className="delete-confirm-overlay" onClick={handleCancelDelete}>
            <div className="delete-confirm-dialog" onClick={e => e.stopPropagation()}>
              <p>Удалить проект?</p>
              <div className="delete-confirm-actions">
                <button onClick={handleConfirmDelete} className="confirm-yes-btn">Удалить</button>
                <button onClick={handleCancelDelete} className="confirm-no-btn">Отмена</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Карточка для студента
  // Определяем, что показывать на кнопке
  const getButtonContent = () => {
    if (isCompleted === true) {
      // Проект уже пройден — предлагаем перепройти
      return { icon: <FiRefreshCw />, text: 'Играть снова' }
    }
    if (project.has_active_playthrough === true) {
      // Есть активное незавершённое прохождение — предлагаем продолжить
      return { icon: <FiPlay />, text: 'Продолжить' }
    }
    // Ничего нет — начинаем новое прохождение
    return { icon: <FiPlay />, text: 'Играть' }
  }

  const buttonContent = getButtonContent()

  return (
    <div className="project-card student-card" onClick={handleCardClick}>
      <div className="project-cover">
        {coverUrl ? <img src={coverUrl} alt={project.title} /> : <DefaultCover />}
        <div className="cover-badge-container">
          {isCompleted === true && (
            <div className="cover-badge completed-badge"><FiCheckCircle /> Пройдено</div>
          )}
        </div>
      </div>
      <div className="project-content">
        <h3 className="project-title" title={project.title}>{shortTitle}</h3>
        {description && <p className="project-description">{shortDescription}</p>}

        {/* Требуемые статусы */}
        {project.required_statuses && project.required_statuses.length > 0 && (
          <div className="project-required-statuses">
            <small><FiTag /> Требуемые статусы:</small>
            <div className="status-tags">
              {project.required_statuses.map(s => <span key={s} className="status-tag">{s}</span>)}
            </div>
          </div>
        )}

        {/* Награда */}
        {project.reward_status && (
          <div className="project-reward">
            <FiAward className="reward-icon" />
            <span className="reward-text">Награда: <strong>{project.reward_status}</strong></span>
          </div>
        )}

        <div className="project-footer">
          <button
            className={`play-btn ${isCompleted === true ? 'replay-btn' : ''}`}
            onClick={handleActionClick}
          >
            {buttonContent.icon} {buttonContent.text}
          </button>
        </div>
      </div>
    </div>
  )
}