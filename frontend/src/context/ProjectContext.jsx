import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import api from '../utils/api'

const ProjectContext = createContext()

export const useProject = () => {
  const context = useContext(ProjectContext)
  if (!context) throw new Error('useProject must be used within ProjectProvider')
  return context
}

export const ProjectProvider = ({ children }) => {
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [allStatuses, setAllStatuses] = useState([])
  const [loading, setLoading] = useState(false)

  const loadingProjectsRef = useRef(false)
  const loadingProjectRef = useRef(false)

  // Получить все статусы
  const fetchAllStatuses = useCallback(async () => {
    try {
      const response = await api.get('/projects/statuses/all')
      setAllStatuses(response.data)
      return { success: true, statuses: response.data }
    } catch {
      return { success: false, statuses: [] }
    }
  }, [])

  // Добавить новый статус
  const addNewStatus = useCallback(async (statusName) => {
    try {
      const response = await api.post('/projects/statuses/add', { name: statusName.trim() })
      await fetchAllStatuses()
      return { success: true, status: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка добавления статуса' }
    }
  }, [fetchAllStatuses])

  // Удалить статус
  const deleteStatus = useCallback(async (statusId) => {
    try {
      await api.delete(`/projects/statuses/${statusId}`)
      await fetchAllStatuses()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка удаления статуса' }
    }
  }, [fetchAllStatuses])

  // Получить пользователя по ID
  const getUserById = useCallback(async (userId) => {
    try {
      const response = await api.get(`/users/${userId}`)
      return { success: true, user: response.data }
    } catch {
      return { success: false, user: null }
    }
  }, [])

  // Получить профиль студента
  const getStudentProfile = useCallback(async () => {
    try {
      const response = await api.get('/users/student/profile')
      return { success: true, data: response.data }
    } catch {
      return { success: false, data: null }
    }
  }, [])

  // Получить статусы пользователя
  const getUserStatuses = useCallback(async () => {
    try {
      const response = await api.get('/users/me/statuses')
      return { success: true, statuses: response.data }
    } catch {
      return { success: false, statuses: [] }
    }
  }, [])

  // Загрузить список проектов (без слеша в конце!)
  const fetchProjects = useCallback(async () => {
    if (loadingProjectsRef.current) return
    loadingProjectsRef.current = true
    setLoading(true)
    try {
      const response = await api.get('/projects')
      setProjects(response.data)
    } catch (error) {
      console.error('Ошибка загрузки проектов:', error)
    } finally {
      setLoading(false)
      loadingProjectsRef.current = false
    }
  }, [])

  // Создать проект
  const createProject = useCallback(async (title, description, min_points = 0, reward_status = 'Стажёр', required_statuses = [], group_ids = []) => {
    const formData = new FormData()
    formData.append('title', title)
    formData.append('description', description)
    formData.append('min_points', min_points)
    formData.append('reward_status', reward_status)
    formData.append('required_statuses', JSON.stringify(required_statuses))
    formData.append('group_ids', JSON.stringify(group_ids))
    try {
      const response = await api.post('/projects/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      await fetchProjects()
      return { success: true, project: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка создания проекта' }
    }
  }, [fetchProjects])

  // Загрузить один проект
  const loadProject = useCallback(async (projectId) => {
    if (loadingProjectRef.current) return { success: false, project: currentProject }
    loadingProjectRef.current = true
    setLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}`)
      setCurrentProject(response.data)
      return { success: true, project: response.data }
    } catch (error) {
      return { success: false, project: null, error: error.response?.data?.detail || 'Ошибка загрузки проекта' }
    } finally {
      setLoading(false)
      loadingProjectRef.current = false
    }
  }, [currentProject])

  // Загрузить проект со сценами
  const loadProjectWithScenes = useCallback(async (projectId) => {
    try {
      const projectResponse = await api.get(`/projects/${projectId}`)
      const project = projectResponse.data
      const scenesResponse = await api.get(`/scenes/project/${projectId}`)
      const scenesWithData = await Promise.all(
        scenesResponse.data.map(scene => api.get(`/scenes/${scene.id}/full`).then(r => r.data))
      )
      const fullProject = { ...project, scenes: scenesWithData }
      setCurrentProject(fullProject)
      return { success: true, project: fullProject }
    } catch (error) {
      return { success: false, project: null, error: error.response?.data?.detail || 'Ошибка загрузки' }
    }
  }, [])

  // Обновить проект
  const updateProject = useCallback(async (projectId, projectData) => {
    try {
      const response = await api.put(`/projects/${projectId}`, projectData)
      setCurrentProject(response.data)
      await fetchProjects()
      return { success: true, project: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка обновления проекта' }
    }
  }, [fetchProjects])

  // Удалить проект
  const deleteProject = useCallback(async (projectId) => {
    try {
      await api.delete(`/projects/${projectId}`)
      await fetchProjects()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка удаления проекта' }
    }
  }, [fetchProjects])

  // Очистить текущий проект
  const clearCurrentProject = useCallback(() => {
    setCurrentProject(null)
  }, [])

  const value = {
    projects,
    currentProject,
    allStatuses,
    loading,
    fetchAllStatuses,
    addNewStatus,
    deleteStatus,
    getUserById,
    getStudentProfile,
    getUserStatuses,
    fetchProjects,
    createProject,
    loadProject,
    loadProjectWithScenes,
    updateProject,
    deleteProject,
    clearCurrentProject
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}