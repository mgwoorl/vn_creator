import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../../context/ProjectContext'
import { useToast } from '../common/ToastContext'
import { FiEye, FiEdit, FiTrash2, FiX, FiAlertCircle, FiSearch, FiFilter } from 'react-icons/fi'

// Простое логирование
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][AdminProjectsList]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Список всех проектов в админ-панели с поиском и фильтрацией
export const AdminProjectsList = () => {
  const navigate = useNavigate()
  const { projects, fetchProjects, deleteProject, getUserById } = useProject()
  const { addToast } = useToast()
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ownerNames, setOwnerNames] = useState({})

  const [searchQuery, setSearchQuery] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    log('INFO', 'Загрузка списка проектов')
    await fetchProjects()
    setLoading(false)
  }

  // Загрузка имен владельцев проектов
  useEffect(() => {
    const loadOwners = async () => {
      const names = {}
      for (const project of projects) {
        if (project.owner_id && !names[project.owner_id]) {
          const result = await getUserById(project.owner_id)
          if (result.success && result.user) {
            names[project.owner_id] = `${result.user.last_name} ${result.user.first_name}`.trim()
          }
        }
      }
      setOwnerNames(names)
      log('INFO', 'Имена владельцев проектов загружены', { count: Object.keys(names).length })
    }
    if (projects.length > 0) {
      loadOwners()
    }
  }, [projects, getUserById])

  // Уникальные владельцы для фильтра
  const uniqueOwners = useMemo(() => {
    const owners = []
    const seen = new Set()
    for (const project of projects) {
      const name = ownerNames[project.owner_id] || `ID: ${project.owner_id}`
      if (!seen.has(project.owner_id)) {
        seen.add(project.owner_id)
        owners.push({ id: project.owner_id, name })
      }
    }
    return owners.sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, ownerNames])

  // Фильтрация проектов
  const filteredProjects = useMemo(() => {
    let result = [...projects]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p =>
        (p.title || '').toLowerCase().includes(query) ||
        (ownerNames[p.owner_id] || '').toLowerCase().includes(query)
      )
    }

    if (ownerFilter !== 'all') {
      const ownerId = parseInt(ownerFilter)
      result = result.filter(p => p.owner_id === ownerId)
    }

    if (statusFilter === 'published') {
      result = result.filter(p => p.is_published)
    } else if (statusFilter === 'draft') {
      result = result.filter(p => !p.is_published)
    }

    return result
  }, [projects, searchQuery, ownerFilter, statusFilter, ownerNames])

  const handleDeleteProject = async () => {
    if (!deleteConfirm) return
    log('INFO', 'Удаление проекта', { projectId: deleteConfirm })
    const result = await deleteProject(deleteConfirm)
    if (result.success) {
      addToast('Проект удалён', 'success')
      await fetchProjects()
    } else {
      log('ERROR', 'Ошибка удаления проекта', { projectId: deleteConfirm })
      addToast(result.error || 'Ошибка удаления проекта', 'error')
    }
    setDeleteConfirm(null)
  }

  const getOwnerDisplayName = (project) => {
    return ownerNames[project.owner_id] || `ID: ${project.owner_id}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('ru-RU')
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка проектов...</p>
      </div>
    )
  }

  return (
    <div className="admin-projects">
      <div className="management-header">
        <h2>Все проекты ({filteredProjects.length})</h2>
      </div>

      {/* Панель фильтров */}
      <div className="admin-filters-bar">
        <div className="admin-search-wrapper">
          <FiSearch className="admin-search-icon" />
          <input
            type="text"
            placeholder="Поиск по названию или автору..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-search-input"
          />
          {searchQuery && (
            <button className="admin-search-clear" onClick={() => setSearchQuery('')}>
              <FiX size={14} />
            </button>
          )}
        </div>

        <div className="admin-filter-item">
          <FiFilter size={14} className="admin-filter-icon" />
          <select
            className="admin-filter-select"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="all">Все авторы</option>
            {uniqueOwners.map(owner => (
              <option key={owner.id} value={owner.id}>{owner.name}</option>
            ))}
          </select>
        </div>

        <div className="admin-filter-item">
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Все статусы</option>
            <option value="published">Опубликованные</option>
            <option value="draft">Черновики</option>
          </select>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="empty-state">
          <p>Нет проектов по заданным фильтрам</p>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Название</th>
                <th>Автор</th>
                <th>Статус</th>
                <th>Создан</th>
                <th>Обновлён</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project, index) => (
                <tr key={project.id}>
                  <td>{index + 1}</td>
                  <td>
                    <span
                      className="project-name-link"
                      onClick={() => navigate(`/project/${project.id}`)}
                      title="Просмотреть детали проекта"
                    >
                      {project.title.length > 40 ? project.title.substring(0, 40) + '...' : project.title}
                    </span>
                  </td>
                  <td>{getOwnerDisplayName(project)}</td>
                  <td>
                    <span className={`project-status-badge ${project.is_published ? 'published' : 'draft'}`}>
                      {project.is_published ? 'Опубликован' : 'Черновик'}
                    </span>
                  </td>
                  <td>{formatDate(project.created_at)}</td>
                  <td>{formatDate(project.updated_at)}</td>
                  <td className="actions-cell">
                    <button
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="action-btn view-btn"
                      title="Просмотреть детали"
                    >
                      <FiEye />
                    </button>
                    <button
                      onClick={() => navigate(`/projects/edit/${project.id}`)}
                      className="action-btn edit-btn"
                      title="Редактировать проект"
                    >
                      <FiEdit />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(project.id)}
                      className="action-btn delete-btn"
                      title="Удалить проект"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3><FiAlertCircle /> Удалить проект?</h3>
            <p>Это действие нельзя отменить. Все сцены и файлы будут удалены.</p>
            <div className="confirm-actions">
              <button onClick={handleDeleteProject} className="confirm-yes"><FiTrash2 /> Удалить</button>
              <button onClick={() => setDeleteConfirm(null)} className="confirm-no"><FiX /> Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}