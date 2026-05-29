import React, { useState, useCallback, useEffect, useRef } from 'react'
import ReactFlow, { Background, Controls, MarkerType, applyNodeChanges, applyEdgeChanges, BaseEdge, getBezierPath } from 'reactflow'
import 'reactflow/dist/style.css'
import { DialogueNode, DeleteProvider } from './DialogueNode'
import { FiX } from 'react-icons/fi'

// Простое логирование
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][DialogueEditor]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Типы узлов для ReactFlow
const nodeTypes = { dialogue: DialogueNode }

// Кастомное ребро с кнопкой удаления по центру
const DeletableEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }) => {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition
  })

  // Обработчик клика по ребру для удаления
  const onEdgeClick = (evt) => {
    evt.stopPropagation()
    evt.preventDefault()
    if (data?.onDelete) {
      data.onDelete(id)
    }
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Невидимая широкая область для удобного клика */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onClick={onEdgeClick}
      />
      {/* Кнопка удаления по центру ребра */}
      <foreignObject
        width={24}
        height={24}
        x={(sourceX + targetX) / 2 - 12}
        y={(sourceY + targetY) / 2 - 12}
        className="edge-delete-button"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <button onClick={onEdgeClick} className="edge-delete-btn" title="Удалить связь">
          <FiX size={12} />
        </button>
      </foreignObject>
    </>
  )
}

const edgeTypes = {
  deletable: DeletableEdge
}

// Редактор диалогов на основе ReactFlow
export const DialogueEditor = ({ nodes = [], edges = [], onChange, onNodeClick, onAddNode, onDeleteNode }) => {
  const prevNodesLength = useRef(nodes.length)
  const [localEdges, setLocalEdges] = useState(edges)

  // Синхронизация edges из пропсов
  useEffect(() => {
    setLocalEdges(edges)
  }, [edges])

  // Автоматическое определение стартового узла при изменении количества узлов
  useEffect(() => {
    if (nodes.length === 0) return
    if (nodes.length === prevNodesLength.current) return
    prevNodesLength.current = nodes.length

    const nodesWithTargets = new Set(localEdges.map(e => e.target))
    const existingStart = nodes.find(n => n.data?.isStart)

    const updatedNodes = nodes.map((node, index) => {
      if (existingStart) return node
      // Первый узел без входящих связей становится стартовым
      const isStart = index === 0 && !nodesWithTargets.has(node.id)
      if (node.data?.isStart !== isStart) {
        return { ...node, data: { ...node.data, isStart } }
      }
      return node
    })

    const needsUpdate = nodes.some((node, i) => node.data?.isStart !== updatedNodes[i].data.isStart)
    if (needsUpdate) {
      log('INFO', 'Автоматическое определение стартового узла')
      onChange(updatedNodes, localEdges)
    }
  }, [nodes.length])

  // Перехват клавиш Delete/Backspace на уровне документа
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target
        if (target.closest('.react-flow__pane') && !target.closest('input, textarea, [contenteditable]')) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  // Обработчик изменений узлов (перемещение, выделение)
  const onNodesChange = useCallback(
    (changes) => {
      const filteredChanges = changes.filter(change => change.type !== 'remove')
      onChange(applyNodeChanges(filteredChanges, nodes), localEdges)
    },
    [nodes, localEdges, onChange]
  )

  // Обработчик изменений ребер
  const onEdgesChange = useCallback(
    (changes) => {
      const updatedEdges = applyEdgeChanges(changes, localEdges)
      setLocalEdges(updatedEdges)
      onChange(nodes, updatedEdges)
    },
    [nodes, localEdges, onChange]
  )

  // Удаление ребра по клику на крестик
  const handleDeleteEdge = useCallback((edgeId) => {
    log('INFO', 'Удаление связи', { edgeId })
    setLocalEdges(prev => {
      const updated = prev.filter(e => e.id !== edgeId)
      onChange(nodes, updated)
      return updated
    })
  }, [nodes, onChange])

  // Создание нового ребра при соединении узлов
  const onConnect = useCallback(
    (params) => {
      const sourceHandle = params.sourceHandle || ''
      log('INFO', 'Создание связи', { source: params.source, target: params.target, handle: sourceHandle })

      setLocalEdges(prev => {
        // Удаляем старую связь с таким же sourceHandle (если была)
        const filteredEdges = prev.filter(
          edge => !(edge.source === params.source && edge.sourceHandle === sourceHandle)
        )

        const newEdge = {
          ...params,
          id: `edge-${params.source}-${sourceHandle}-${params.target}`,
          type: 'deletable',
          sourceHandle: sourceHandle,
          targetHandle: 'in',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#48bb78', strokeWidth: 2 },
          data: { onDelete: handleDeleteEdge }
        }

        const updated = [...filteredEdges, newEdge]
        onChange(nodes, updated)
        return updated
      })
    },
    [nodes, onChange, handleDeleteEdge]
  )

  // Добавление обработчика удаления ко всем ребрам
  const edgesWithDelete = localEdges.map(edge => ({
    ...edge,
    type: edge.type || 'deletable',
    data: { ...edge.data, onDelete: handleDeleteEdge }
  }))

  return (
    <DeleteProvider onDelete={onDeleteNode}>
      <div className="dialogue-editor">
        <div className="editor-toolbar">
          <button onClick={onAddNode} className="add-node-btn">Добавить блок</button>
          <div className="toolbar-hint">Для удаления связи нажмите ✕ на линии</div>
        </div>
        <div style={{ height: 'calc(100% - 50px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edgesWithDelete}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
            deleteKeyCode={null}
            defaultEdgeOptions={{ type: 'deletable' }}
            connectionLineStyle={{ stroke: '#667eea', strokeWidth: 2 }}
          >
            <Background color="#aaa" gap={16} />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </DeleteProvider>
  )
}