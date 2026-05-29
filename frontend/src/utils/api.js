import axios from 'axios'

// Базовый URL API из переменных окружения или localhost для разработки
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Простое логирование для отладки запросов
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][API]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Создание экземпляра axios с настройками по умолчанию
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000, // 30 секунд таймаут
  withCredentials: true // Отправлять httpOnly cookies с каждым запросом
})

// Перехватчик запросов — логирует исходящие запросы
api.interceptors.request.use(
  config => {
    log('INFO', 'Отправка запроса', {
      method: config.method,
      url: config.url
    })
    return config
  },
  error => {
    log('ERROR', 'Ошибка перед отправкой запроса', { error: error.message })
    return Promise.reject(error)
  }
)

// Перехватчик ответов — обрабатывает ошибки и обновляет токены
api.interceptors.response.use(
  response => {
    log('INFO', 'Ответ получен', {
      status: response.status,
      url: response.config.url
    })
    return response
  },
  async error => {
    const originalRequest = error.config

    // Если ошибка 401 и это не повторный запрос — пробуем обновить токен
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      log('WARN', 'Токен истек, попытка обновления через cookies')

      try {
        // Отправляем запрос на обновление токена
        // Refresh токен передается автоматически через httpOnly cookies
        await axios.post(
          `${API_URL}/users/refresh`,
          {},
          { withCredentials: true }
        )

        log('INFO', 'Токен успешно обновлен через cookies')

        // Повторяем оригинальный запрос — новые токены уже в cookies
        return api(originalRequest)
      } catch (refreshError) {
        log('ERROR', 'Не удалось обновить токен, выход из системы')

        // Очищаем данные пользователя
        localStorage.removeItem('user')

        // Вызываем эндпоинт logout для очистки cookies на сервере
        try {
          await axios.post(
            `${API_URL}/users/logout`,
            {},
            { withCredentials: true }
          )
        } catch (e) {
          // Игнорируем ошибку — cookies будут очищены при редиректе
        }

        // Редирект на страницу входа, если не на ней
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    log('ERROR', 'Ошибка ответа', {
      status: error.response?.status,
      url: originalRequest?.url,
      message: error.message
    })
    return Promise.reject(error)
  }
)

export default api