import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi'

// Простое логирование
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][Login]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Форма входа в систему
export const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    log('INFO', 'Попытка входа', { email })

    const result = await login(email, password)
    if (!result.success) {
      setError(result.error)
      log('WARN', 'Ошибка входа', { email, error: result.error })
    } else {
      log('INFO', 'Вход выполнен успешно', { email })
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {error && (
        <div className={`auth-message ${error.includes('активирована') ? 'auth-warning-message' : 'auth-error-message'}`}>
          {error}
        </div>
      )}

      <div className="auth-form-group">
        <label htmlFor="login-email">Email</label>
        <div className="auth-input-wrapper">
          <FiMail className="auth-input-icon" />
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@mail.com"
            required
            autoComplete="email"
          />
        </div>
      </div>

      <div className="auth-form-group">
        <label htmlFor="login-password">Пароль</label>
        <div className="auth-input-wrapper">
          <FiLock className="auth-input-icon" />
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
            autoComplete="current-password"
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="auth-submit-btn">
        {loading ? 'Вход...' : <><FiLogIn /> Войти</>}
      </button>
    </form>
  )
}