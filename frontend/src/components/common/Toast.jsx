import React, { useEffect, useState } from 'react'
import { FiCheckCircle, FiAlertCircle, FiXCircle, FiInfo, FiX } from 'react-icons/fi'

// Иконки для разных типов уведомлений
const icons = {
  success: FiCheckCircle,
  error: FiXCircle,
  warning: FiAlertCircle,
  info: FiInfo
}

// CSS-классы для разных типов уведомлений
const colors = {
  success: 'toast-success',
  error: 'toast-error',
  warning: 'toast-warning',
  info: 'toast-info'
}

// Отдельный компонент уведомления с анимацией появления и исчезновения
const Toast = ({ message, type = 'info', onClose, duration = 4000 }) => {
  const [visible, setVisible] = useState(true)

  // Автоматическое скрытие через указанное время
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300) // ждем окончания анимации исчезновения
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const Icon = icons[type] || icons.info

  return (
    <div className={`toast ${colors[type]} ${visible ? 'toast-enter' : 'toast-exit'}`}>
      <Icon className="toast-icon" size={18} />
      <span className="toast-message">{message}</span>
      <button
        className="toast-close"
        onClick={() => {
          setVisible(false)
          setTimeout(onClose, 300)
        }}
      >
        <FiX size={16} />
      </button>
    </div>
  )
}

// Контейнер для списка уведомлений
export const ToastContainer = ({ toasts, removeToast }) => (
  <div className="toast-container">
    {toasts.map(toast => (
      <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
    ))}
  </div>
)

export default Toast