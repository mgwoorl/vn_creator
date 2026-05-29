import React from 'react'
import { FiPlay, FiMessageSquare, FiHelpCircle, FiXCircle } from 'react-icons/fi'

// Боковая панель с типами блоков для перетаскивания на холст
export const DialogueSidebar = () => {
  // Обработчик начала перетаскивания узла
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="dialogue-sidebar">
      <h4>Блоки</h4>
      
      <div
        className="dialogue-node-item"
        onDragStart={(event) => onDragStart(event, 'start')}
        draggable
      >
        <span className="node-icon"><FiPlay /></span>
        <div className="node-info">
          <div className="node-title">Старт</div>
          <div className="node-desc">Начальная точка</div>
        </div>
      </div>

      <div
        className="dialogue-node-item"
        onDragStart={(event) => onDragStart(event, 'dialogue')}
        draggable
      >
        <span className="node-icon"><FiMessageSquare /></span>
        <div className="node-info">
          <div className="node-title">Диалог</div>
          <div className="node-desc">Реплика персонажа</div>
        </div>
      </div>

      <div
        className="dialogue-node-item"
        onDragStart={(event) => onDragStart(event, 'choice')}
        draggable
      >
        <span className="node-icon"><FiHelpCircle /></span>
        <div className="node-info">
          <div className="node-title">Выбор</div>
          <div className="node-desc">Варианты ответа</div>
        </div>
      </div>

      <div
        className="dialogue-node-item"
        onDragStart={(event) => onDragStart(event, 'end')}
        draggable
      >
        <span className="node-icon"><FiXCircle /></span>
        <div className="node-info">
          <div className="node-title">Конец</div>
          <div className="node-desc">Завершение</div>
        </div>
      </div>
    </div>
  )
}