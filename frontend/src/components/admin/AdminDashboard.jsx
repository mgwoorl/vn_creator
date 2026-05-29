import React, { useState, useEffect } from 'react'
import { UserManagement } from './UserManagement'
import { GroupManagement } from './GroupManagement'
import { StatusManagement } from './StatusManagement'
import { AdminProjectsList } from './AdminProjectsList'
import { FiUsers, FiGrid, FiTag, FiFolder } from 'react-icons/fi'

// Ключ для сохранения активной вкладки в localStorage
const TAB_STORAGE_KEY = 'adminDashboardActiveTab'

// Простое логирование
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][AdminDashboard]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Панель администратора с вкладками для управления пользователями, группами, статусами и проектами
export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY)
    return saved || 'users'
  })

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeTab)
    log('INFO', 'Переключение вкладки админ-панели', { activeTab })
  }, [activeTab])

  return (
    <div className="admin-dashboard">
      <div className="admin-tabs-container">
        <div className="admin-tabs-wrapper">
          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <FiUsers className="tab-icon" />
            <span className="tab-label">Пользователи</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            <FiGrid className="tab-icon" />
            <span className="tab-label">Группы</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'statuses' ? 'active' : ''}`}
            onClick={() => setActiveTab('statuses')}
          >
            <FiTag className="tab-icon" />
            <span className="tab-label">Статусы</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <FiFolder className="tab-icon" />
            <span className="tab-label">Проекты</span>
          </button>
        </div>
      </div>
      <div className="admin-content-panel">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'groups' && <GroupManagement />}
        {activeTab === 'statuses' && <StatusManagement />}
        {activeTab === 'projects' && <AdminProjectsList />}
      </div>
    </div>
  )
}