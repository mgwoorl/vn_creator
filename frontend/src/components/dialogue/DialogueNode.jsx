import React, { memo, useContext } from 'react'
import { Handle, Position } from 'reactflow'
import { FiTrash2, FiMessageSquare, FiStar, FiPlay, FiMusic, FiImage } from 'react-icons/fi'

// Контекст для передачи функции удаления узла
const DeleteContext = React.createContext(null)

// Провайдер контекста удаления
export const DeleteProvider = ({ children, onDelete }) => {
  return (
    <DeleteContext.Provider value={onDelete}>
      {children}
    </DeleteContext.Provider>
  )
}

// Хук для получения функции удаления
export const useDelete = () => useContext(DeleteContext)

// Узел диалога в графе ReactFlow
export const DialogueNode = memo(({ id, data, selected }) => {
  const isStart = data?.isStart || false
  const options = data?.options || []
  const onDelete = useDelete()

  // Обработчик удаления узла
  const handleDelete = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onDelete) onDelete(id)
  }

  return (
    <div className={`dialogue-node ${selected ? 'selected' : ''} ${isStart ? 'start-node' : 'regular-node'}`}>
      {/* Входной handle — только для не-стартовых узлов */}
      {!isStart && (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="node-handle node-handle-target"
          isConnectable={true}
        />
      )}

      {/* Заголовок узла */}
      <div className={`node-header ${isStart ? 'start-header' : 'regular-header'}`}>
        <span className="node-title">
          {isStart ? (
            <><FiPlay className="node-icon" /> СТАРТ</>
          ) : (
            <><FiMessageSquare className="node-icon" /> {data.characterName || 'ДИАЛОГ'}</>
          )}
        </span>
        {/* Индикаторы наличия фона и музыки */}
        <div className="node-header-indicators">
          {data.backgroundUrl && (
            <span className="node-header-indicator" title="Свой фон">
              <FiImage size={12} />
            </span>
          )}
          {data.musicFile && (
            <span className="node-header-indicator" title="Своя музыка">
              <FiMusic size={12} />
            </span>
          )}
        </div>
        {/* Кнопка удаления (не показывается для стартового узла) */}
        {!isStart && (
          <button className="node-delete-btn" onClick={handleDelete} title="Удалить блок">
            <FiTrash2 />
          </button>
        )}
      </div>

      {/* Содержимое узла */}
      <div className="node-content">
        <div className="node-text">{data.text || 'Нажмите чтобы добавить текст'}</div>

        {/* Список опций с хендлами для соединений */}
        {options.length > 0 && (
          <div className="node-options">
            {options.map((opt, idx) => (
              <div key={`${id}-${opt.id}`} className="node-option-item">
                <span className="option-number">{idx + 1}</span>
                <span className="option-text">{opt.text}</span>
                {opt.points > 0 && (
                  <span className="option-points-badge"><FiStar /> +{opt.points}</span>
                )}
                {/* Выходной handle для каждой опции */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={opt.id}
                  className="node-handle node-handle-source"
                  isConnectable={true}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})