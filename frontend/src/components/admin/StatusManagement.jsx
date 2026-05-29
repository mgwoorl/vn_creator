import React, { useState, useEffect, useMemo } from 'react'
import { useProject } from '../../context/ProjectContext'
import { useToast } from '../common/ToastContext'
import { FiPlus, FiTrash2, FiX, FiAlertCircle, FiSearch } from 'react-icons/fi'

// Простое логирование
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][StatusManagement]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Компонент управления статусами в админ-панели
export const StatusManagement = () => {
  const { fetchAllStatuses, addNewStatus, deleteStatus } = useProject()
  const { addToast } = useToast()
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [newStatusName, setNewStatusName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadStatuses()
  }, [])

  // Загрузка списка статусов
  const loadStatuses = async () => {
    setLoading(true)
    log('INFO', 'Загрузка списка статусов')
    const result = await fetchAllStatuses()
    if (result.success) {
      setStatuses(result.statuses)
      log('INFO', 'Статусы загружены', { count: result.statuses.length })
    } else {
      log('ERROR', 'Ошибка загрузки статусов')
    }
    setLoading(false)
  }

  // Фильтрация статусов по поиску
  const filteredStatuses = useMemo(() => {
    if (!searchQuery.trim()) return statuses
    const query = searchQuery.toLowerCase()
    return statuses.filter(s => s.name.toLowerCase().includes(query))
  }, [statuses, searchQuery])

  // Добавление нового статуса
  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return

    setAdding(true)
    log('INFO', 'Добавление статуса', { name: newStatusName.trim() })
    const result = await addNewStatus(newStatusName.trim())
    if (result.success) {
      addToast('Статус добавлен', 'success')
      setNewStatusName('')
      await loadStatuses()
    } else {
      addToast(result.error || 'Ошибка добавления статуса', 'error')
      log('ERROR', 'Ошибка добавления статуса', { error: result.error })
    }
    setAdding(false)
  }

  // Запрос на удаление статуса с проверкой базового статуса
  const requestDeleteStatus = (statusId, statusName) => {
    if (statusName === 'Стажёр') {
      addToast('Нельзя удалить базовый статус "Стажёр"', 'warning')
      log('WARN', 'Попытка удалить базовый статус', { statusName })
      return
    }
    setDeleteConfirm({ id: statusId, name: statusName })
  }

  // Подтверждение удаления статуса
  const handleDeleteStatus = async () => {
    if (!deleteConfirm) return

    log('INFO', 'Удаление статуса', { statusId: deleteConfirm.id, name: deleteConfirm.name })
    const result = await deleteStatus(deleteConfirm.id)
    if (result.success) {
      addToast('Статус удалён', 'success')
      await loadStatuses()
    } else {
      addToast(result.error || 'Ошибка удаления статуса', 'error')
      log('ERROR', 'Ошибка удаления статуса', { error: result.error })
    }
    setDeleteConfirm(null)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка статусов...</p>
      </div>
    )
  }

  return (
    <div className="status-management">
      <div className="management-header">
        <h2>Статусы ({filteredStatuses.length})</h2>
      </div>

      <div className="filters-bar">
        <div className="search-input-wrapper">
          <FiSearch className="search-input-icon" />
          <input
            type="text"
            placeholder="Поиск по названию статуса..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <FiX size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Форма добавления статуса */}
      <div className="status-add-form">
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <input
              type="text"
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              placeholder="Название нового статуса"
              onKeyPress={(e) => e.key === 'Enter' && handleAddStatus()}
            />
          </div>
          <button
            onClick={handleAddStatus}
            className="create-btn"
            disabled={adding || !newStatusName.trim()}
          >
            <FiPlus /> {adding ? 'Добавление...' : 'Добавить'}
          </button>
        </div>
      </div>

      {filteredStatuses.length === 0 ? (
        <div className="empty-state">
          <p>{searchQuery ? 'Статусы не найдены' : 'Нет статусов'}</p>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Название</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredStatuses.map((status, index) => (
                <tr key={status.id}>
                  <td>{index + 1}</td>
                  <td>
                    <span className="status-name-cell">
                      {status.name}
                      {status.name === 'Стажёр' && (
                        <span className="default-badge">по умолчанию</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => requestDeleteStatus(status.id, status.name)}
                      className="action-btn delete-btn"
                      title="Удалить статус"
                      disabled={status.name === 'Стажёр'}
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
            <h3><FiAlertCircle /> Удалить статус?</h3>
            <p>Вы уверены, что хотите удалить статус "{deleteConfirm.name}"?</p>
            <div className="confirm-actions">
              <button onClick={handleDeleteStatus} className="confirm-yes"><FiTrash2 /> Удалить</button>
              <button onClick={() => setDeleteConfirm(null)} className="confirm-no"><FiX /> Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}