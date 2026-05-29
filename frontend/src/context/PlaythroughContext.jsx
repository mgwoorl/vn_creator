import React, { createContext, useContext, useCallback } from 'react'
import api from '../utils/api'

const PlaythroughContext = createContext()

export const usePlaythrough = () => {
  const context = useContext(PlaythroughContext)
  if (!context) throw new Error('usePlaythrough must be used within PlaythroughProvider')
  return context
}

export const PlaythroughProvider = ({ children }) => {
  // Начать или восстановить прохождение
  const startPlaythrough = useCallback(async (projectId) => {
    try {
      const response = await api.post('/playthroughs/start', null, { params: { project_id: projectId } })
      const data = response.data
      return {
        success: true,
        playthrough_id: data.playthrough_id,
        message: data.message,
        last_scene_index: data.last_scene_index || 0,
        last_node_id: data.last_node_id || null,
        context_data: data.context_data || null,
        is_resumed: data.is_resumed || false
      }
    } catch (error) {
      return { success: false, playthrough_id: null, error: error.response?.data?.detail || 'Ошибка старта' }
    }
  }, [])

  // Сохранить прогресс
  const saveProgress = useCallback(async (playthroughId, contextData, sceneIndex, nodeId) => {
    try {
      await api.post(`/playthroughs/${playthroughId}/save-progress`, {
        context_data: contextData,
        current_scene_index: sceneIndex,
        current_node_id: nodeId
      })
      return { success: true }
    } catch {
      return { success: false }
    }
  }, [])

  // Завершить прохождение
  const completePlaythrough = useCallback(async (playthroughId, totalPoints, answers) => {
    try {
      const response = await api.post(`/playthroughs/${playthroughId}/complete`, {
        total_points: totalPoints,
        answers
      })
      return { success: true, reward_status: response.data.reward_status }
    } catch (error) {
      return { success: false, reward_status: null, error: error.response?.data?.detail || 'Ошибка завершения' }
    }
  }, [])

  // Прервать прохождение
  const abortPlaythrough = useCallback(async (playthroughId) => {
    try {
      await api.delete(`/playthroughs/${playthroughId}`)
      return { success: true }
    } catch {
      return { success: false }
    }
  }, [])

  // Получить список завершённых проектов
  const getCompletedProjects = useCallback(async () => {
    try {
      const response = await api.get('/playthroughs/completed')
      return { success: true, completed_ids: response.data.completed_ids }
    } catch {
      return { success: false, completed_ids: [] }
    }
  }, [])

  // Получить ответы прохождения
  const getPlaythroughAnswers = useCallback(async (playthroughId) => {
    try {
      const response = await api.get(`/playthroughs/${playthroughId}/answers`)
      return { success: true, answers: response.data }
    } catch {
      return { success: false, answers: [] }
    }
  }, [])

  const value = {
    startPlaythrough,
    saveProgress,
    completePlaythrough,
    abortPlaythrough,
    getCompletedProjects,
    getPlaythroughAnswers
  }

  return <PlaythroughContext.Provider value={value}>{children}</PlaythroughContext.Provider>
}