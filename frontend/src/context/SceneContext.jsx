import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import api from '../utils/api'

const SceneContext = createContext()

export const useScenes = () => {
  const context = useContext(SceneContext)
  if (!context) throw new Error('useScenes must be used within SceneProvider')
  return context
}

export const SceneProvider = ({ children }) => {
  const [projectScenes, setProjectScenes] = useState([])
  const [scenesLoading, setScenesLoading] = useState(false)
  const loadingRef = useRef(false)

  const loadProjectScenes = useCallback(async (projectId) => {
    if (loadingRef.current) return { success: false, scenes: projectScenes }
    loadingRef.current = true
    setScenesLoading(true)
    try {
      const response = await api.get(`/scenes/project/${projectId}`)
      setProjectScenes(response.data)
      return { success: true, scenes: response.data }
    } catch (error) {
      return { success: false, scenes: [], error: error.response?.data?.detail || 'Ошибка загрузки сцен' }
    } finally {
      setScenesLoading(false)
      loadingRef.current = false
    }
  }, [projectScenes])

  const loadFullScene = useCallback(async (sceneId) => {
    try {
      const response = await api.get(`/scenes/${sceneId}/full`)
      return { success: true, scene: response.data }
    } catch (error) {
      return { success: false, scene: null, error: error.response?.data?.detail || 'Ошибка загрузки сцены' }
    }
  }, [])

  const createScene = useCallback(async (projectId, name = 'Новая сцена') => {
    try {
      const response = await api.post(`/scenes/?project_id=${projectId}`, { name, project_id: projectId })
      await loadProjectScenes(projectId)
      return { success: true, scene: response.data }
    } catch (error) {
      return { success: false, scene: null, error: error.response?.data?.detail || 'Ошибка создания сцены' }
    }
  }, [loadProjectScenes])

  const saveScene = useCallback(async (sceneId, sceneData) => {
    try {
      const response = await api.put(`/scenes/${sceneId}/full`, sceneData)
      setProjectScenes(prev => prev.map(s =>
        s.id === sceneId
          ? { ...s, name: sceneData.name, background_url: sceneData.background_url, background_type: sceneData.background_type }
          : s
      ))
      return { success: true, scene: response.data }
    } catch (error) {
      return { success: false, scene: null, error: error.response?.data?.detail || 'Ошибка сохранения сцены' }
    }
  }, [])

  const deleteScene = useCallback(async (sceneId) => {
    try {
      await api.delete(`/scenes/${sceneId}`)
      setProjectScenes(prev => prev.filter(s => s.id !== sceneId))
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка удаления сцены' }
    }
  }, [])

  const deleteSceneNode = useCallback(async (sceneId, nodeId) => {
    try { await api.delete(`/scenes/${sceneId}/nodes/${nodeId}`); return { success: true } }
    catch { return { success: true } }
  }, [])

  const deleteNodeOption = useCallback(async (sceneId, nodeId, optionId) => {
    try {
      await api.delete(`/scenes/${sceneId}/nodes/${nodeId}/options/${optionId}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Ошибка удаления опции' }
    }
  }, [])

  // Запуск сцены с возможностью передать start_node_id и context_data
  const startSceneExecution = useCallback(async (sceneId, startNodeId = null, contextData = null) => {
    try {
      const requestBody = {}
      if (startNodeId && startNodeId !== 'null' && startNodeId !== 'undefined') {
        requestBody.start_node_id = startNodeId
      }
      if (contextData) {
        requestBody.context_data = contextData
      }
      const response = await api.post(`/scenes/execute/${sceneId}/start`, requestBody)
      return { success: true, execution: response.data.execution }
    } catch (error) {
      return { success: false, execution: null, error: error.response?.data?.detail || 'Ошибка выполнения сцены' }
    }
  }, [])

  const selectOption = useCallback(async (sceneId, nodeId, optionId, contextData) => {
    try {
      const response = await api.post(`/scenes/execute/${sceneId}/select`, {
        node_id: nodeId,
        option_id: optionId,
        context_data: contextData
      })
      return { success: true, execution: response.data.execution }
    } catch (error) {
      return { success: false, execution: null, error: error.response?.data?.detail || 'Ошибка выбора опции' }
    }
  }, [])

  const clearScenes = useCallback(() => { setProjectScenes([]) }, [])

  const value = {
    projectScenes, scenesLoading,
    loadProjectScenes, loadFullScene, createScene, saveScene, deleteScene,
    deleteSceneNode, deleteNodeOption,
    startSceneExecution, selectOption,
    clearScenes
  }

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
}