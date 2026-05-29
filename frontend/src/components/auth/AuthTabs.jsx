import React, { useState } from 'react'
import { Login } from './Login'
import { Register } from './Register'
import { FiLogIn, FiUserPlus } from 'react-icons/fi'

// Простое логирование
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][AuthTabs]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Компонент с вкладками входа и регистрации
export const AuthTabs = () => {
  const [activeTab, setActiveTab] = useState('login')

  const handleTabChange = (tab) => {
    log('INFO', 'Переключение вкладки авторизации', { from: activeTab, to: tab })
    setActiveTab(tab)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="auth-title">Visual Novel Builder</h1>
          <p className="auth-subtitle">
            {activeTab === 'login' ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => handleTabChange('login')}
          >
            <FiLogIn /> Вход
          </button>
          <button
            className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => handleTabChange('register')}
          >
            <FiUserPlus /> Регистрация
          </button>
        </div>

        <div className="auth-card-body">
          {activeTab === 'login' ? <Login /> : <Register />}
        </div>

        <div className="auth-card-footer">
          <p>Учебная платформа визуальных новелл</p>
        </div>
      </div>
    </div>
  )
}