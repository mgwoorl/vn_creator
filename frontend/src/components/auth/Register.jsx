import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiMail, FiLock, FiUser, FiUserPlus } from 'react-icons/fi'

// Простое логирование
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][Register]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Форма регистрации нового пользователя
export const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    last_name: '',
    first_name: '',
    patronymic: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    log('INFO', 'Попытка регистрации', { email: formData.email })

    const result = await register(formData)
    if (result.success) {
      setSuccess(result.message || 'Регистрация успешна. Ожидайте подтверждения администратора.')
      setFormData({ email: '', last_name: '', first_name: '', patronymic: '', password: '' })
      log('INFO', 'Регистрация успешна', { email: formData.email })
    } else {
      setError(result.error)
      log('WARN', 'Ошибка регистрации', { email: formData.email, error: result.error })
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {success && (
        <div className="auth-success-message">{success}</div>
      )}

      {error && (
        <div className={`auth-message ${error.includes('уже зарегистрирован') ? 'auth-warning-message' : 'auth-error-message'}`}>
          {error}
        </div>
      )}

      <div className="form-group">
        <label>Email</label>
        <div className="input-with-icon">
          <FiMail className="input-icon" />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="example@mail.com"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>Фамилия</label>
        <div className="input-with-icon">
          <FiUser className="input-icon" />
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            placeholder="Иванов"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>Имя</label>
        <div className="input-with-icon">
          <FiUser className="input-icon" />
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            placeholder="Иван"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>Отчество</label>
        <div className="input-with-icon">
          <FiUser className="input-icon" />
          <input
            type="text"
            name="patronymic"
            value={formData.patronymic}
            onChange={handleChange}
            placeholder="Иванович"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Пароль</label>
        <div className="input-with-icon">
          <FiLock className="input-icon" />
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Минимум 4 символа"
            required
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="auth-submit-btn">
        {loading ? 'Регистрация...' : <><FiUserPlus /> Зарегистрироваться</>}
      </button>
    </form>
  )
}