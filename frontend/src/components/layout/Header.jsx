import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FiLogOut, FiUser, FiBookOpen } from 'react-icons/fi'

// Простое логирование
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][Header]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Шапка приложения с логотипом и меню пользователя
export const Header = () => {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  // Переход на главную страницу в зависимости от роли
  const handleLogoClick = () => {
    if (isAdmin) {
      navigate('/admin')
    } else {
      navigate('/projects')
    }
  }

  // Отображение роли пользователя
  const getRoleLabel = () => {
    switch (user?.role) {
      case 'super_admin': return 'Супер-админ'
      case 'admin': return 'Администратор'
      case 'teacher': return 'Преподаватель'
      default: return 'Студент'
    }
  }

  // Формирование отображаемого имени
  const getUserDisplayName = () => {
    if (!user) return ''
    return `${user.last_name} ${user.first_name}`
  }

  // Обработчик выхода из системы
  const handleLogout = async () => {
    log('INFO', 'Выход из системы', { userId: user?.id })
    await logout()
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-section" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          <FiBookOpen className="logo-icon" />
          <h1>Visual Novel Builder</h1>
        </div>
        <div className="user-menu">
          <Link to="/profile" className="user-name-link">
            <FiUser className="user-icon" />
            <span className="user-name">{getUserDisplayName()}</span>
          </Link>
          <span className="user-role-badge">{getRoleLabel()}</span>
          <button onClick={handleLogout} className="logout-btn">
            <FiLogOut /> Выйти
          </button>
        </div>
      </div>
    </header>
  )
}