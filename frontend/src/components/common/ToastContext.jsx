import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { ToastContainer } from './Toast'

const ToastContext = createContext()
export const useToast = () => useContext(ToastContext)

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const recentToasts = useRef(new Set())

  const addToast = useCallback((message, type = 'info') => {
    const toastKey = `${message}::${type}`
    
    if (recentToasts.current.has(toastKey)) {
      console.log('[ToastContext] Duplicate toast suppressed:', toastKey)
      return
    }
    
    recentToasts.current.add(toastKey)
    setTimeout(() => recentToasts.current.delete(toastKey), 500)
    
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    console.log('[ToastContext] Toast added:', { id, type, message: message.substring(0, 50) })
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}