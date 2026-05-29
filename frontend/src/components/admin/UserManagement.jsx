import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../common/ToastContext'
import api from '../../utils/api'
import { 
  FiTrash2, FiKey, FiX, FiSave,
  FiAlertCircle, FiSearch, FiFilter, FiEdit2,
  FiEye, FiEyeOff, FiShield, FiUnlock
} from 'react-icons/fi'

// Простая функция логирования для отладки
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][UserManagement]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

export const UserManagement = () => {
  const { isSuperAdmin, user } = useAuth()
  const { addToast } = useToast()
  
  // Состояния для списка пользователей и групп
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Состояния для модальных окон
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toggleConfirm, setToggleConfirm] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  
  // Состояния для форм
  const [resetPassword, setResetPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [editData, setEditData] = useState({
    email: '', last_name: '', first_name: '', patronymic: '',
    role: 'student', group_id: ''
  })
  const [error, setError] = useState('')

  // Состояния для фильтрации
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')

  // Состояние режима удаления — ключевое изменение для безопасности
  // По умолчанию false, кнопки удаления скрыты
  const [deleteMode, setDeleteMode] = useState(false)

  // Загрузка данных при монтировании
  useEffect(() => {
    loadUsers()
    loadGroups()
  }, [])

  // Автоматический выход из режима удаления при смене фильтров
  // чтобы админ случайно не удалил не того пользователя
  useEffect(() => {
    if (deleteMode) {
      setDeleteMode(false)
      addToast('Режим удаления отключен из-за смены фильтров', 'info')
    }
  }, [searchQuery, roleFilter, groupFilter])

  const loadUsers = async () => {
    try {
      const response = await api.get('/users/admin/users')
      setUsers(response.data)
    } catch (error) {
      log('ERROR', 'Ошибка загрузки пользователей', { error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async () => {
    try {
      const response = await api.get('/users/groups')
      setGroups(response.data)
    } catch (error) {
      log('ERROR', 'Ошибка загрузки групп', { error: error.message })
    }
  }

  // Фильтрация пользователей с использованием useMemo для производительности
  const filteredUsers = useMemo(() => {
    let result = [...users]

    // Поиск по имени, фамилии или email
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(u =>
        u.email?.toLowerCase().includes(query) ||
        u.last_name?.toLowerCase().includes(query) ||
        u.first_name?.toLowerCase().includes(query) ||
        `${u.last_name} ${u.first_name}`.toLowerCase().includes(query)
      )
    }

    // Фильтр по роли
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter)
    }

    // Фильтр по группе
    if (groupFilter !== 'all') {
      const groupId = parseInt(groupFilter)
      result = result.filter(u => u.group_id === groupId)
    }

    return result
  }, [users, searchQuery, roleFilter, groupFilter])

  // Вспомогательные функции для отображения
  const getRoleLabel = (role) => {
    const labels = {
      'super_admin': 'Супер-админ',
      'admin': 'Администратор',
      'teacher': 'Преподаватель',
      'student': 'Студент'
    }
    return labels[role] || role
  }

  const getRoleBadgeClass = (role) => {
    const classes = {
      'super_admin': 'role-super_admin',
      'admin': 'role-admin',
      'teacher': 'role-teacher',
      'student': 'role-student'
    }
    return classes[role] || ''
  }

  const getGroupName = (groupId) => {
    if (!groupId) return '—'
    const group = groups.find(g => g.id === groupId)
    return group ? group.name : '—'
  }

  // Обработчики модальных окон
  const openEditModal = (u) => {
    setSelectedUser(u)
    setEditData({
      email: u.email,
      last_name: u.last_name,
      first_name: u.first_name,
      patronymic: u.patronymic || '',
      role: u.role,
      group_id: u.group_id || ''
    })
    setError('')
    setShowEditModal(true)
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    setError('')

    try {
      const payload = {
        email: editData.email,
        last_name: editData.last_name,
        first_name: editData.first_name,
        patronymic: editData.patronymic || '',
        role: editData.role
      }

      // Группа только для студентов
      if (editData.role === 'student' && editData.group_id) {
        payload.group_id = parseInt(editData.group_id)
      } else if (editData.role !== 'student') {
        payload.group_id = null
      }

      await api.put(`/users/admin/users/${selectedUser.id}`, payload)
      addToast('Данные обновлены', 'success')
      setShowEditModal(false)
      setSelectedUser(null)
      loadUsers()
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка обновления')
      addToast(error.response?.data?.detail || 'Ошибка обновления', 'error')
    }
  }

  // Активация / деактивация пользователя
  const requestToggleActive = (userToToggle) => {
    setToggleConfirm(userToToggle)
  }

  const handleToggleActive = async () => {
    if (!toggleConfirm) return

    try {
      const response = await api.put(`/users/admin/users/${toggleConfirm.id}/toggle-active`)
      addToast(response.data.message || 'Статус изменён', 'success')
      loadUsers()
    } catch (error) {
      addToast(error.response?.data?.detail || 'Ошибка', 'error')
    }
    setToggleConfirm(null)
  }

  // Сброс пароля
  const openResetModal = (u) => {
    setSelectedUser(u)
    setResetPassword('')
    setShowResetPassword(false)
    setError('')
    setShowResetModal(true)
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!resetPassword || resetPassword.length < 4) {
      setError('Пароль должен быть не менее 4 символов')
      return
    }

    try {
      await api.post(`/users/admin/users/${selectedUser.id}/reset-password`, {
        new_password: resetPassword
      })
      addToast('Пароль сброшен', 'success')
      setShowResetModal(false)
      setSelectedUser(null)
    } catch (error) {
      addToast('Ошибка сброса пароля', 'error')
    }
  }

  // Удаление пользователя с двойным подтверждением
  const requestDeleteUser = (userId) => {
    const userToDelete = users.find(u => u.id === userId)
    if (!userToDelete) return
    
    // Дополнительная проверка безопасности
    if (userToDelete.role === 'super_admin') {
      addToast('Невозможно удалить супер-администратора', 'warning')
      return
    }
    
    if (userId === user?.id) {
      addToast('Невозможно удалить самого себя', 'warning')
      return
    }
    
    setDeleteConfirm(userId)
  }

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return
    
    try {
      await api.delete(`/users/admin/users/${deleteConfirm}`)
      addToast('Пользователь удалён', 'success')
      loadUsers()
      // После успешного удаления выходим из режима удаления
      setDeleteMode(false)
    } catch (error) {
      addToast('Ошибка удаления', 'error')
    }
    setDeleteConfirm(null)
  }

  // Переключение режима удаления
  const toggleDeleteMode = () => {
    const newMode = !deleteMode
    setDeleteMode(newMode)
    
    if (newMode) {
      addToast('Режим удаления активирован. Кнопки удаления теперь видны.', 'warning')
    } else {
      addToast('Режим удаления отключен', 'info')
      setDeleteConfirm(null)
    }
  }

  // Экран загрузки
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка пользователей...</p>
      </div>
    )
  }

  return (
    <div className="user-management">
      {/* Заголовок с информацией о режиме удаления */}
      <div className="management-header">
        <h2>Пользователи ({filteredUsers.length})</h2>
        
        {/* Кнопка переключения режима удаления */}
        <button
          onClick={toggleDeleteMode}
          className={`create-btn ${deleteMode ? 'danger-mode' : ''}`}
          style={deleteMode ? { background: '#ef4444', color: 'white' } : {}}
          title={deleteMode ? 'Отключить режим удаления' : 'Включить режим удаления'}
        >
          {deleteMode ? (
            <><FiUnlock /> Отключить удаление</>
          ) : (
            <><FiShield /> Включить удаление</>
          )}
        </button>
      </div>

      {/* Предупреждение о режиме удаления */}
      {deleteMode && (
        <div className="error-message" style={{ 
          background: '#fef2f2', 
          border: '2px solid #ef4444',
          padding: '12px 16px',
          marginBottom: '16px'
        }}>
          <FiAlertCircle style={{ marginRight: '8px' }} />
          <strong>Внимание!</strong> Режим удаления активирован. Удаление пользователей необратимо.
          Режим автоматически отключится при смене фильтров или после успешного удаления.
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {/* Фильтры */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <FiSearch className="search-input-icon" />
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <FiX size={14} />
            </button>
          )}
        </div>

        <div className="filter-group">
          <FiFilter size={14} className="filter-group-icon" />
          <select className="filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">Все роли</option>
            <option value="student">Студенты</option>
            <option value="teacher">Преподаватели</option>
            <option value="admin">Администраторы</option>
            <option value="super_admin">Супер-админы</option>
          </select>
        </div>

        <div className="filter-group">
          <select className="filter-select" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="all">Все группы</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {/* Таблица пользователей */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>№</th>
              <th>ФИО</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Группа</th>
              <th>Статус</th>
              <th>Дата регистрации</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u, index) => (
              <tr key={u.id} className={!u.is_active ? 'inactive-row' : ''}>
                <td>{index + 1}</td>
                <td>{`${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim()}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`role-badge ${getRoleBadgeClass(u.role)}`}>
                    {getRoleLabel(u.role)}
                  </span>
                </td>
                <td>
                  {u.role === 'student' ? (
                    <span className="group-badge">{getGroupName(u.group_id)}</span>
                  ) : (
                    <span className="no-group">—</span>
                  )}
                </td>
                <td>
                  {u.role !== 'super_admin' ? (
                    <button
                      onClick={() => requestToggleActive(u)}
                      className={`status-toggle-btn ${u.is_active ? 'active' : 'inactive'}`}
                      title={u.is_active ? 'Деактивировать' : 'Активировать'}
                    >
                      {u.is_active ? 'Активен' : 'Неактивен'}
                    </button>
                  ) : (
                    <span className="status-badge permanent-active">Активен</span>
                  )}
                </td>
                <td>{new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
                <td className="actions-cell">
                  {/* Кнопка редактирования — всегда доступна */}
                  <button
                    onClick={() => openEditModal(u)}
                    className="action-btn edit-btn"
                    title="Редактировать"
                  >
                    <FiEdit2 />
                  </button>
                  
                  {/* Кнопка сброса пароля — всегда доступна */}
                  <button
                    onClick={() => openResetModal(u)}
                    className="action-btn reset-btn"
                    title="Сбросить пароль"
                  >
                    <FiKey />
                  </button>
                  
                  {/* Кнопка удаления — видна только в режиме удаления */}
                  {deleteMode && u.id !== user?.id && u.role !== 'super_admin' && (
                    <button
                      onClick={() => requestDeleteUser(u.id)}
                      className="action-btn delete-btn"
                      title="Удалить пользователя"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модальное окно редактирования */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редактировать: {selectedUser.last_name} {selectedUser.first_name}</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Фамилия</label>
                    <input
                      type="text"
                      value={editData.last_name}
                      onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Имя</label>
                    <input
                      type="text"
                      value={editData.first_name}
                      onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Отчество</label>
                    <input
                      type="text"
                      value={editData.patronymic}
                      onChange={(e) => setEditData({ ...editData, patronymic: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Роль</label>
                    <select
                      value={editData.role}
                      onChange={(e) => setEditData({
                        ...editData,
                        role: e.target.value,
                        group_id: e.target.value !== 'student' ? '' : editData.group_id
                      })}
                    >
                      <option value="student">Студент</option>
                      <option value="teacher">Преподаватель</option>
                      {isSuperAdmin && <option value="admin">Администратор</option>}
                    </select>
                  </div>
                  {editData.role === 'student' && (
                    <div className="form-group">
                      <label>Группа</label>
                      <select
                        value={editData.group_id}
                        onChange={(e) => setEditData({ ...editData, group_id: e.target.value })}
                      >
                        <option value="">Нет группы</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowEditModal(false)} className="cancel-btn">
                  Отмена
                </button>
                <button type="submit" className="save-btn">
                  <FiSave /> Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно сброса пароля */}
      {showResetModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Сбросить пароль: {selectedUser.last_name} {selectedUser.first_name}</h3>
              <button className="modal-close" onClick={() => setShowResetModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Новый пароль</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      required
                      placeholder="Минимум 4 символа"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      title={showResetPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showResetPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowResetModal(false)} className="cancel-btn">
                  Отмена
                </button>
                <button type="submit" className="save-btn">
                  <FiSave /> Сбросить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Подтверждение активации/деактивации */}
      {toggleConfirm && (
        <div className="modal-overlay" onClick={() => setToggleConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>
              {toggleConfirm.is_active ? 'Деактивировать пользователя?' : 'Активировать пользователя?'}
            </h3>
            <p>
              {toggleConfirm.is_active
                ? `${toggleConfirm.last_name} ${toggleConfirm.first_name} не сможет войти в систему.`
                : `${toggleConfirm.last_name} ${toggleConfirm.first_name} получит доступ к системе.`
              }
            </p>
            <div className="confirm-actions">
              <button onClick={handleToggleActive} className="confirm-yes">
                {toggleConfirm.is_active ? 'Деактивировать' : 'Активировать'}
              </button>
              <button onClick={() => setToggleConfirm(null)} className="confirm-no">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Подтверждение удаления с дополнительной информацией */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3><FiAlertCircle /> Удалить пользователя?</h3>
            <p>
              Это действие нельзя отменить. 
              Все данные пользователя, включая прохождения и статусы, будут удалены.
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
              Режим удаления будет автоматически отключен после удаления.
            </p>
            <div className="confirm-actions">
              <button onClick={handleDeleteUser} className="confirm-yes">
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