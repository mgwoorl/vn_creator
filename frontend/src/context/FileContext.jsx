import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import api from '../utils/api'

const FileContext = createContext()

export const useFiles = () => {
  const context = useContext(FileContext)
  if (!context) throw new Error('useFiles must be used within FileProvider')
  return context
}

export const FileProvider = ({ children }) => {
  const [projectFiles, setProjectFiles] = useState({ backgrounds: [], sprites: [], music: [], covers: [] })
  const [filesLoading, setFilesLoading] = useState(false)
  const loadingRef = useRef(false)

  const loadProjectFiles = useCallback(async (projectId) => {
    if (loadingRef.current) return { success: false, files: projectFiles }
    loadingRef.current = true
    setFilesLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}/files`)
      const files = response.data
      setProjectFiles(files)
      return { success: true, files }
    } catch (error) {
      return { success: false, files: null, error: error.response?.data?.detail || 'Ошибка загрузки файлов' }
    } finally {
      setFilesLoading(false)
      loadingRef.current = false
    }
  }, [projectFiles])

  const uploadFile = useCallback(async (projectId, file, fileType, customName = null) => {
    const formData = new FormData()
    formData.append('file', file)
    if (customName) formData.append('custom_name', customName)

    try {
      const response = await api.post(
        `/projects/${projectId}/upload/${fileType}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      const uploadedFile = response.data
      const fileKey = fileType === 'covers' ? 'covers' : fileType

      setProjectFiles(prev => ({
        ...prev,
        [fileKey]: [...(prev[fileKey] || []), uploadedFile]
      }))

      return { success: true, file: uploadedFile }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка загрузки', file: null }
    }
  }, [])

  const deleteFile = useCallback(async (projectId, file, fileType) => {
    try {
      const fileName = file.url ? file.url.split('/').pop() : file.name
      await api.delete(`/projects/${projectId}/files/${fileType}/${encodeURIComponent(fileName)}`)
      setProjectFiles(prev => ({
        ...prev,
        [fileType]: prev[fileType].filter(f => f.id !== file.id)
      }))
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка удаления' }
    }
  }, [])

  const renameFile = useCallback(async (projectId, file, fileType, newName) => {
    try {
      const oldFileName = file.url?.split('/').pop() || file.name || file.filename
      if (!oldFileName) return { success: false, error: 'Не удалось определить имя файла' }

      await api.put(
        `/projects/${projectId}/files/${fileType}/${encodeURIComponent(oldFileName)}`,
        { new_name: newName }
      )

      await loadProjectFiles(projectId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка переименования' }
    }
  }, [loadProjectFiles])

  const clearFiles = useCallback(() => {
    setProjectFiles({ backgrounds: [], sprites: [], music: [], covers: [] })
  }, [])

  const value = {
    projectFiles,
    filesLoading,
    loadProjectFiles,
    uploadFile,
    deleteFile,
    renameFile,
    clearFiles
  }

  return <FileContext.Provider value={value}>{children}</FileContext.Provider>
}