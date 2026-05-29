import React, { useState, useEffect, useMemo } from 'react'
import api from '../../utils/api'
import { useToast } from '../common/ToastContext'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiAlertCircle, FiSearch } from 'react-icons/fi'

// Простое логирование
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][GroupManagement]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Компонент управления учебными группами
export const GroupManagement = () => {
  const { addToast } = useToast()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [editingGroup, setEditingGroup] = useState(null)
  const [formData, setFormData] = useState({ name: '' })
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadGroups()
  }, [])

  // Загрузка списка групп
  const loadGroups = async () => {
    try {
      log('INFO', 'Загрузка списка групп')
      const response = await api.get('/users/groups')
      setGroups(response.data)
      log('INFO', 'Группы загружены', { count: response.data.length })
    } catch (error) {
      log('ERROR', 'Ошибка загрузки групп', { error: error.message })
    } finally {
      setLoading(false)
    }
  }

  // Фильтрация групп по поисковому запросу
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    const query = searchQuery.toLowerCase()
    return groups.filter(g => g.name.toLowerCase().includes(query))
  }, [groups, searchQuery])

  // Создание новой группы
  const handleCreateGroup = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Введите название группы')
      return
    }

    try {
      log('INFO', 'Создание группы', { name: formData.name.trim() })
      await api.post('/users/groups', { name: formData.name.trim() })
      addToast('Группа создана', 'success')
      setFormData({ name: '' })
      setShowCreateModal(false)
      loadGroups()
    } catch (error) {
      const msg = error.response?.data?.detail || 'Ошибка создания группы'
      setError(msg)
      addToast(msg, 'error')
      log('ERROR', 'Ошибка создания группы', { error: msg })
    }
  }

  // Обновление существующей группы
  const handleUpdateGroup = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Введите название группы')
      return
    }

    try {
      log('INFO', 'Обновление группы', { groupId: editingGroup.id, name: formData.name.trim() })
      await api.put(`/users/groups/${editingGroup.id}`, { name: formData.name.trim() })
      addToast('Группа обновлена', 'success')
      setShowEditModal(false)
      setEditingGroup(null)
      setFormData({ name: '' })
      loadGroups()
    } catch (error) {
      const msg = error.response?.data?.detail || 'Ошибка обновления группы'
      setError(msg)
      addToast(msg, 'error')
      log('ERROR', 'Ошибка обновления группы', { error: msg })
    }
  }

  // Удаление группы
  const handleDeleteGroup = async () => {
    if (!deleteConfirm) return

    try {
      log('INFO', 'Удаление группы', { groupId: deleteConfirm })
      await api.delete(`/users/groups/${deleteConfirm}`)
      addToast('Группа удалена', 'success')
      loadGroups()
    } catch (error) {
      const msg = error.response?.data?.detail || 'Ошибка удаления'
      addToast(msg, 'error')
      log('ERROR', 'Ошибка удаления группы', { error: msg })
    }
    setDeleteConfirm(null)
  }

  // Открытие модального окна редактирования
  const openEditModal = (group) => {
    setEditingGroup(group)
    setFormData({ name: group.name })
    setShowEditModal(true)
    setError('')
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка групп...</p>
      </div>
    )
  }

  return (
    <div className="group-management">
      <div className="management-header">
        <h2>Группы ({filteredGroups.length})</h2>
        <button
          onClick={() => { setShowCreateModal(true); setError(''); setFormData({ name: '' }) }}
          className="create-btn"
        >
          <FiPlus /> Создать группу
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Поиск */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <FiSearch className="search-input-icon" />
          <input
            type="text"
            placeholder="Поиск по названию группы..."
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

      {filteredGroups.length === 0 ? (
        <div className="empty-state">
          <p>{searchQuery ? 'Группы не найдены' : 'Группы ещё не созданы'}</p>
          <p className="hint">Создайте группу для организации студентов</p>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Название</th>
                <th>Дата создания</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group, index) => (
                <tr key={group.id}>
                  <td>{index + 1}</td>
                  <td>{group.name}</td>
                  <td>{new Date(group.created_at).toLocaleDateString('ru-RU')}</td>
                  <td className="actions-cell">
                    <button onClick={() => openEditModal(group)} className="action-btn edit-btn" title="Редактировать">
                      <FiEdit2 />
                    </button>
                    <button onClick={() => setDeleteConfirm(group.id)} className="action-btn delete-btn" title="Удалить">
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно создания */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Создать группу</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Название группы</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Например: ПИ-101"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="cancel-btn">Отмена</button>
                <button type="submit" className="save-btn"><FiSave /> Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования */}
      {showEditModal && editingGroup && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редактировать группу</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleUpdateGroup}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Название группы</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowEditModal(false)} className="cancel-btn">Отмена</button>
                <button type="submit" className="save-btn"><FiSave /> Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Подтверждение удаления */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3><FiAlertCircle /> Удалить группу?</h3>
            <p>Студенты потеряют привязку к этой группе.</p>
            <div className="confirm-actions">
              <button onClick={handleDeleteGroup} className="confirm-yes"><FiTrash2 /> Удалить</button>
              <button onClick={() => setDeleteConfirm(null)} className="confirm-no"><FiX /> Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}