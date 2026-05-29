import React, { useState, useEffect, useCallback } from 'react'
import { FiSave, FiX, FiVideo, FiImage, FiVolume2, FiVolumeX, FiTrash2 } from 'react-icons/fi'
import { DialogueEditor } from '../dialogue/DialogueEditor'
import { NodeEditor } from '../dialogue/NodeEditor'
import { useScenes } from '../../context/SceneContext'

export const SceneBuilder = ({ 
  scene, 
  allScenes, 
  onSave, 
  onClose, 
  sprites = [], 
  music = [], 
  backgrounds = [] 
}) => {
  const [name, setName] = useState(scene?.name || 'Новая сцена')
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState(scene?.background_url || null)
  const [backgroundType, setBackgroundType] = useState(scene?.background_type || 'image')
  const [enableVideoAudio, setEnableVideoAudio] = useState(scene?.use_video_audio || false)
  const [mediaError, setMediaError] = useState(false)
  const [mediaKey, setMediaKey] = useState(Date.now())
  const [loadingMedia, setLoadingMedia] = useState(false)

  const { deleteSceneNode, deleteNodeOption } = useScenes()

  // Инициализация данных сцены при изменении scene
  useEffect(() => {
    if (scene) {
      const sceneNodes = Array.isArray(scene.nodes) ? scene.nodes : []
      let sceneEdges = Array.isArray(scene.edges) ? scene.edges : []

      // Нормализуем связи для ReactFlow
      sceneEdges = sceneEdges.map(edge => ({
        ...edge,
        id: edge.id || `edge-${edge.source}-${edge.sourceHandle || ''}-${edge.target}`,
        sourceHandle: edge.sourceHandle || edge.source_handle || '',
        type: edge.type || 'deletable'
      }))

      setNodes(sceneNodes)
      setEdges(sceneEdges)

      if (scene.background_url) {
        setBackgroundUrl(scene.background_url)
        setBackgroundType(scene.background_type || 'image')
        setEnableVideoAudio(scene.use_video_audio || false)
        setMediaKey(Date.now())
        setMediaError(false)
        setLoadingMedia(true)
      } else {
        setBackgroundUrl(null)
        setBackgroundType('image')
        setEnableVideoAudio(false)
      }
    }
  }, [scene])

  // Добавление нового узла
  const handleAddNode = useCallback(() => {
    const newNodeId = `node-${Date.now()}`
    const newOptionId = `${Date.now()}-${Math.random()}`
    const isFirst = nodes.length === 0

    const newNode = {
      id: newNodeId,
      type: 'dialogue',
      position: {
        x: nodes.length > 0 ? 400 : 250,
        y: nodes.length > 0 ? (nodes.length * 150) + 100 : 100
      },
      data: {
        characterName: '',
        text: '',
        spriteFile: '',
        musicFile: '',
        backgroundUrl: '',
        isStart: isFirst,
        options: [{ 
          id: newOptionId, 
          text: 'Далее', 
          targetType: 'node', 
          targetNodeId: '', 
          points: 0 
        }]
      }
    }

    setNodes(prev => [...prev, newNode])
  }, [nodes])

  // Обновление данных узла
  const handleNodeUpdate = useCallback((nodeId, updatedNode) => {
    setNodes(prev => prev.map(node => {
      if (node.id === nodeId) {
        return { 
          ...updatedNode, 
          data: { 
            ...updatedNode.data, 
            isStart: node.data?.isStart || false 
          } 
        }
      }
      return node
    }))
  }, [])

  // Клик по узлу — открываем редактор
  const handleNodeClick = useCallback((event, node) => {
    setSelectedNode(node)
    setShowNodeEditor(true)
  }, [])

  // Удаление узла
  const handleDeleteNode = useCallback(async (nodeId) => {
    const nodeToDelete = nodes.find(n => n.id === nodeId)
    if (nodeToDelete?.data?.isStart) {
      alert('Нельзя удалить стартовый блок')
      return
    }
    if (!window.confirm('Удалить этот блок?')) return

    setNodes(prev => prev.filter(n => n.id !== nodeId))
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId))

    try {
      if (deleteSceneNode && scene?.id) {
        await deleteSceneNode(scene.id, nodeId)
      }
    } catch (error) {
      console.error('Ошибка удаления узла:', error)
    }
  }, [nodes, scene, deleteSceneNode])

  // Удаление опции
  const handleDeleteOption = useCallback(async (nodeId, optionId) => {
    if (!window.confirm('Удалить этот вариант ответа?')) return

    setNodes(prev => prev.map(node => {
      if (node.id === nodeId) {
        return { 
          ...node, 
          data: { 
            ...node.data, 
            options: node.data.options.filter(opt => opt.id !== optionId) 
          } 
        }
      }
      return node
    }))

    setEdges(prev => prev.filter(edge => {
      return !(edge.source === nodeId && edge.sourceHandle === optionId)
    }))

    try {
      if (deleteNodeOption && scene?.id) {
        await deleteNodeOption(scene.id, nodeId, optionId)
      }
    } catch (error) {
      console.error('Ошибка удаления опции:', error)
    }
  }, [scene, deleteNodeOption])

  // Перетаскивание фона на область предпросмотра
  const handleBackgroundDrop = useCallback((e) => {
    e.preventDefault()
    try {
      const data = e.dataTransfer.getData('application/json')
      if (data) {
        const bg = JSON.parse(data)
        if (!bg.url) return
        setBackgroundUrl(bg.url)
        setBackgroundType(bg.type === 'video' ? 'video' : 'image')
        setEnableVideoAudio(false)
        setMediaError(false)
        setMediaKey(Date.now())
        setLoadingMedia(true)
      }
    } catch (error) {
      console.error('Ошибка при перетаскивании фона:', error)
    }
  }, [])

  const handleDragOver = useCallback((e) => e.preventDefault(), [])

  // Удаление фона сцены
  const handleRemoveBackground = () => {
    setBackgroundUrl(null)
    setBackgroundType('image')
    setEnableVideoAudio(false)
    setMediaError(false)
  }

  // Сохранение сцены
  const handleSave = useCallback(() => {
    onSave({
      id: scene.id,
      name,
      background_url: backgroundUrl,
      background_type: backgroundType,
      use_video_audio: enableVideoAudio,
      nodes,
      edges
    })
  }, [scene, name, backgroundUrl, backgroundType, enableVideoAudio, nodes, edges, onSave])

  const getFullMediaUrl = useCallback((url) => {
    if (!url) return null
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return url
  }, [])

  const backgroundMediaUrl = backgroundUrl ? getFullMediaUrl(backgroundUrl) : null
  const handleMediaLoad = useCallback(() => { 
    setLoadingMedia(false)
    setMediaError(false) 
  }, [])
  
  const handleMediaError = useCallback(() => { 
    setMediaError(true)
    setLoadingMedia(false) 
  }, [])
  
  const hasNodes = nodes && nodes.length > 0

  return (
    <div className="scene-builder">
      {/* Заголовок с названием сцены и кнопками */}
      <div className="builder-header">
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="Название сцены" 
          className="scene-name-input" 
        />
        <div className="builder-actions">
          <button onClick={handleSave} className="save-btn">
            <FiSave /> Сохранить
          </button>
          <button onClick={onClose} className="close-btn">
            <FiX />
          </button>
        </div>
      </div>

      {/* Область предпросмотра фона сцены */}
      <div 
        className="scene-background-area"
        style={{ 
          position: 'relative', 
          width: '100%', 
          paddingBottom: '56.25%', 
          backgroundColor: '#000', 
          overflow: 'hidden' 
        }}
        onDragOver={handleDragOver} 
        onDrop={handleBackgroundDrop}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          {backgroundUrl && backgroundType === 'video' ? (
            <>
              {loadingMedia && (
                <div className="background-placeholder">
                  <div className="loader"></div>
                  <p>Загрузка видео...</p>
                </div>
              )}
              {!mediaError && backgroundMediaUrl && (
                <video 
                  key={`v-${mediaKey}`} 
                  src={backgroundMediaUrl} 
                  className="scene-background-preview" 
                  autoPlay 
                  loop 
                  muted={!enableVideoAudio} 
                  playsInline
                  onLoadedData={handleMediaLoad} 
                  onError={handleMediaError}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    display: loadingMedia ? 'none' : 'block' 
                  }} 
                />
              )}
              {mediaError && (
                <div className="background-placeholder">
                  <FiVideo size={48} />
                  <p>Ошибка загрузки видео</p>
                </div>
              )}
              {!mediaError && !loadingMedia && (
                <div className="background-controls">
                  <button 
                    className="video-audio-toggle" 
                    onClick={() => setEnableVideoAudio(!enableVideoAudio)} 
                    title={enableVideoAudio ? 'Выключить звук видео' : 'Включить звук видео'}
                  >
                    {enableVideoAudio ? <FiVolume2 /> : <FiVolumeX />}
                  </button>
                  <button 
                    className="background-remove-btn" 
                    onClick={handleRemoveBackground} 
                    title="Убрать фон"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              )}
            </>
          ) : backgroundUrl && backgroundType === 'image' ? (
            <>
              {!mediaError && backgroundMediaUrl ? (
                <img 
                  key={`i-${mediaKey}`} 
                  src={backgroundMediaUrl} 
                  alt="background" 
                  className="scene-background-preview"
                  onLoad={handleMediaLoad} 
                  onError={handleMediaError} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div className="background-placeholder">
                  <FiImage size={48} />
                  <p>Ошибка загрузки изображения</p>
                </div>
              )}
              {!mediaError && !loadingMedia && (
                <div className="background-controls">
                  <button 
                    className="background-remove-btn" 
                    onClick={handleRemoveBackground} 
                    title="Убрать фон"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="background-placeholder">
              <FiImage size={48} />
              <p>Перетащите фон сюда</p>
              <small>Изображения и видео из библиотеки ресурсов</small>
            </div>
          )}
        </div>
      </div>

      {/* Редактор диалогов или заглушка */}
      {hasNodes ? (
        <DialogueEditor 
          nodes={nodes} 
          edges={edges}
          onChange={(newNodes, newEdges) => { 
            setNodes(newNodes)
            setEdges(newEdges) 
          }}
          onNodeClick={handleNodeClick} 
          onAddNode={handleAddNode} 
          onDeleteNode={handleDeleteNode} 
        />
      ) : (
        <div className="dialogue-editor-placeholder">
          <p>В этой сцене пока нет блоков диалога</p>
          <button onClick={handleAddNode} className="add-node-btn">
            Добавить первый блок
          </button>
        </div>
      )}

      {/* Модальное окно редактора узла */}
      {showNodeEditor && (
        <NodeEditor 
          node={selectedNode} 
          onUpdate={handleNodeUpdate}
          onClose={() => { 
            setShowNodeEditor(false)
            setSelectedNode(null) 
          }}
          onDeleteOption={handleDeleteOption} 
          characters={[]} 
          sprites={sprites} 
          music={music} 
          backgrounds={backgrounds}
          allNodes={nodes} 
        />
      )}
    </div>
  )
}

export default SceneBuilder