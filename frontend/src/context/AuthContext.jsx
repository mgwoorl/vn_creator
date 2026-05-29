import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import api from '../utils/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider')
  }
  return context
}

// Простое логирование для отладки
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][AuthContext]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Провайдер аутентификации
// Управляет состоянием пользователя и автоматически проверяет сессию через cookies
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // При загрузке приложения проверяем наличие активной сессии
  useEffect(() => {
    const checkAuth = async () => {
      log('INFO', 'Проверка текущей сессии')

      try {
        // Пробуем получить данные пользователя через API
        // Токен передается автоматически через httpOnly cookies
        const response = await api.get('/users/me')
        setUser(response.data)
        log('INFO', 'Сессия восстановлена через cookies', {
          userId: response.data.id,
          role: response.data.role
        })
      } catch (error) {
        // Если запрос не удался — проверяем localStorage как запасной вариант
        log('WARN', 'Не удалось восстановить сессию через API, проверяем localStorage')
        const savedUser = localStorage.getItem('user')
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser)
            setUser(parsedUser)
            log('INFO', 'Данные пользователя восстановлены из localStorage')
          } catch (parseError) {
            log('ERROR', 'Ошибка парсинга сохраненного пользователя', {
              error: parseError.message
            })
            localStorage.removeItem('user')
          }
        }
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Вход в систему
  // Токены устанавливаются в httpOnly cookies на сервере — фронтенд их не обрабатывает
  const login = useCallback(async (email, password) => {
    log('INFO', 'Попытка входа', { email })
    setLoading(true)

    try {
      const response = await api.post('/users/login', { email, password })

      if (response.data.success) {
        const userData = response.data.user
        setUser(userData)

        // Сохраняем только базовую информацию о пользователе
        // Токены хранятся в httpOnly cookies — недоступны через JavaScript
        localStorage.setItem('user', JSON.stringify(userData))

        log('INFO', 'Вход выполнен успешно', {
          userId: userData.id,
          role: userData.role
        })
        return { success: true }
      }

      log('WARN', 'Вход не удался', { email, message: response.data.message })
      return { success: false, error: response.data.message }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Ошибка соединения'
      log('ERROR', 'Ошибка входа', { email, error: error.message })
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  // Регистрация нового пользователя
  const register = useCallback(async (userData) => {
    log('INFO', 'Попытка регистрации', { email: userData.email })

    try {
      const response = await api.post('/users/register', userData)

      if (response.data.success) {
        log('INFO', 'Регистрация успешна', { email: userData.email })
        return { success: true, message: response.data.message }
      }

      return { success: false, error: response.data.message }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Ошибка регистрации'
      log('ERROR', 'Ошибка регистрации', { email: userData.email, error: error.message })
      return { success: false, error: errorMessage }
    }
  }, [])

  // Выход из системы
  // Очищает состояние на клиенте и удаляет httpOnly cookies через API
  const logout = useCallback(async () => {
    log('INFO', 'Выход из системы', { userId: user?.id })

    // Очищаем состояние на клиенте
    setUser(null)
    localStorage.removeItem('user')

    // Отправляем запрос на сервер для очистки httpOnly cookies
    try {
      await api.post('/users/logout')
    } catch (error) {
      // Даже если запрос не удался, пользователь уже разлогинен на клиенте
      log('WARN', 'Ошибка при вызове logout на сервере', { error: error.message })
    }
  }, [user])

  // Формирование полного имени пользователя для отображения
  const getFullName = useCallback(() => {
    if (!user) return ''
    return `${user.last_name} ${user.first_name} ${user.patronymic || ''}`.trim()
  }, [user])

  // Вычисляемые свойства ролей (мемоизированы для избежания лишних рендеров)
  const isAdmin = useMemo(
    () => user?.role === 'admin' || user?.role === 'super_admin',
    [user]
  )
  const isSuperAdmin = useMemo(
    () => user?.role === 'super_admin',
    [user]
  )
  const isTeacher = useMemo(
    () => ['teacher', 'admin', 'super_admin'].includes(user?.role),
    [user]
  )

  // Формируем значение контекста
  const value = {
    user,
    loading,
    login,
    register,
    logout,
    getFullName,
    isAdmin,
    isSuperAdmin,
    isTeacher,
    isStudent: user?.role === 'student'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext