import React, { useState, useEffect, useCallback } from 'react'
import { FiPlus, FiCheckCircle, FiClock, FiTag, FiGrid, FiUsers, FiSearch, FiX, FiLayers, FiEye, FiEdit } from 'react-icons/fi'
import { ProjectCard } from './ProjectCard'
import { useProject } from '../../context/ProjectContext'
import { usePlaythrough } from '../../context/PlaythroughContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../common/ToastContext'
import api from '../../utils/api'

const FilterBar = ({ searchQuery, onSearchChange, sortBy, onSortChange }) => {
  return (
    <div className="projects-filter-bar">
      <div className="projects-search-wrapper">
        <FiSearch className="projects-search-icon" />
        <input
          type="text"
          placeholder="Поиск по названию или описанию..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="projects-search-input"
        />
        {searchQuery && (
          <button className="projects-search-clear" onClick={() => onSearchChange('')} type="button">
            <FiX size={14} />
          </button>
        )}
      </div>
      <select className="projects-filter-select" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
        <option value="date-desc">Сначала новые</option>
        <option value="date-asc">Сначала старые</option>
        <option value="name-asc">По алфавиту А-Я</option>
        <option value="name-desc">По алфавиту Я-А</option>
      </select>
    </div>
  )
}

export const ProjectList = ({ projects, onPlayProject, user }) => {
  const { createProject, fetchAllStatuses, deleteProject, fetchProjects, getUserStatuses } = useProject()
  const { getCompletedProjects } = usePlaythrough()
  const { addToast } = useToast()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProject, setNewProject] = useState({
    title: '', description: '', min_points: 0, reward_status: 'Стажёр', required_statuses: [], group_ids: []
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [allStatuses, setAllStatuses] = useState([])
  const [groupsList, setGroupsList] = useState([])
  const [showNewStatusInput, setShowNewStatusInput] = useState(false)
  const [newStatusName, setNewStatusName] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [completedProjects, setCompletedProjects] = useState([])
  const [earnedStatuses, setEarnedStatuses] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('date-desc')

  useEffect(() => {
    if (user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'super_admin') {
      loadStatusesAndGroups()
    }
  }, [user])

  useEffect(() => {
    if (user?.role === 'student') { loadStudentData() }
  }, [user])

  const loadStudentData = async () => {
    const completedResult = await getCompletedProjects()
    if (completedResult.success) setCompletedProjects(completedResult.completed_ids)
    const statusesResult = await getUserStatuses()
    if (statusesResult.success) {
      const earned = {}
      statusesResult.statuses.forEach(s => { if (s.playthrough_id) earned[s.playthrough_id] = s.name })
      setEarnedStatuses(earned)
    }
  }

  const loadStatusesAndGroups = async () => {
    try {
      const statusesResult = await fetchAllStatuses()
      if (statusesResult.success) setAllStatuses(statusesResult.statuses)
      const groupsResponse = await api.get('/users/groups')
      setGroupsList(groupsResponse.data)
    } catch (error) { console.error('Failed to load data:', error) }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    if (!newProject.title.trim()) { setError('Введите название проекта'); setLoading(false); return }
    const result = await createProject(newProject.title, newProject.description, newProject.min_points,
      newProject.reward_status, newProject.required_statuses, newProject.group_ids)
    if (result.success) {
      addToast('Проект успешно создан', 'success')
      setNewProject({ title: '', description: '', min_points: 0, reward_status: 'Стажёр', required_statuses: [], group_ids: [] })
      setShowCreateForm(false)
    } else { setError(result.error); addToast(result.error || 'Ошибка создания проекта', 'error') }
    setLoading(false)
  }

  const handleDeleteProject = async (projectId) => {
    const result = await deleteProject(projectId)
    if (result.success) { addToast('Проект удален', 'success'); await fetchProjects() }
    else addToast(result.error || 'Ошибка удаления проекта', 'error')
  }

  const handleAddNewStatus = async () => {
    if (!newStatusName.trim()) return
    try {
      const response = await api.post('/projects/statuses/add', { name: newStatusName.trim() })
      setAllStatuses([...allStatuses, response.data])
      setNewProject({ ...newProject, reward_status: response.data.name })
      addToast('Статус добавлен', 'success')
    } catch (error) { addToast(error.response?.data?.detail || 'Ошибка', 'error') }
    setNewStatusName(''); setShowNewStatusInput(false)
  }

  const handleToggleGroup = (groupId) => {
    setNewProject(prev => ({
      ...prev,
      group_ids: prev.group_ids.includes(groupId) ? prev.group_ids.filter(id => id !== groupId) : [...prev.group_ids, groupId]
    }))
  }

  const handleToggleRequiredStatus = (statusName) => {
    if (newProject.required_statuses.includes(statusName)) {
      setNewProject({ ...newProject, required_statuses: newProject.required_statuses.filter(s => s !== statusName) })
    } else {
      setNewProject({ ...newProject, required_statuses: [...newProject.required_statuses, statusName] })
    }
  }

  const getFilteredAndSortedProjects = useCallback((projectList) => {
    let result = [...projectList]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(p => (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc': return new Date(a.created_at) - new Date(b.created_at)
        case 'date-desc': return new Date(b.created_at) - new Date(a.created_at)
        case 'name-asc': return (a.title || '').localeCompare(b.title || '', 'ru')
        case 'name-desc': return (b.title || '').localeCompare(a.title || '', 'ru')
        default: return 0
      }
    })
    return result
  }, [searchQuery, sortBy])

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'super_admin'

  // Представление для преподавателя
  if (isTeacher) {
    const allProjects = getFilteredAndSortedProjects(projects)
    const published = allProjects.filter(p => p.is_published)
    const drafts = allProjects.filter(p => !p.is_published)
    const displayed = activeTab === 'published' ? published : activeTab === 'drafts' ? drafts : allProjects

    return (
      <div className="projects-container teacher-container">
        <div className="projects-header">
          <h2><FiGrid /> Мои проекты ({allProjects.length})</h2>
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="create-btn">
            <FiPlus /> {showCreateForm ? 'Отмена' : 'Новый проект'}
          </button>
        </div>

        {showCreateForm && (
          <div className="create-form">
            <h3>Создание нового проекта</h3>
            <form onSubmit={handleCreateProject}>
              {error && <div className="form-error-message">{error}</div>}
              <div className="form-group"><label>Название проекта</label><input type="text" value={newProject.title} onChange={(e) => setNewProject({ ...newProject, title: e.target.value })} placeholder="Например: Моя первая новелла" required /></div>
              <div className="form-group"><label>Описание</label><textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="Краткое описание" rows="3" /></div>
              <div className="form-group"><label>Минимальные баллы</label><input type="number" value={newProject.min_points} onChange={(e) => setNewProject({ ...newProject, min_points: parseInt(e.target.value) || 0 })} min="0" /></div>
              <div className="form-group"><label>Статус за прохождение</label>
                <div className="reward-status-select-container">
                  <select value={newProject.reward_status} onChange={(e) => setNewProject({ ...newProject, reward_status: e.target.value })} className="reward-status-select">
                    {allStatuses.map(status => <option key={status.id} value={status.name}>{status.name}</option>)}</select>
                  {!showNewStatusInput ? (
                    <button type="button" onClick={() => setShowNewStatusInput(true)} className="add-status-inline-btn"><FiPlus /> Новый</button>
                  ) : (
                    <div className="new-status-inline"><input type="text" value={newStatusName} onChange={(e) => setNewStatusName(e.target.value)} placeholder="Название статуса" autoFocus />
                      <button type="button" onClick={handleAddNewStatus} className="confirm-btn">✓</button>
                      <button type="button" onClick={() => setShowNewStatusInput(false)} className="cancel-btn">✕</button></div>)}</div></div>
              <div className="form-group"><label><FiTag /> Требуемые статусы</label>
                <div className="required-statuses-container">
                  <div className="selected-statuses">{newProject.required_statuses.map(status => (<div key={status} className="status-tag selected">{status}<button onClick={() => handleToggleRequiredStatus(status)} className="remove-status">×</button></div>))}
                    {newProject.required_statuses.length === 0 && <span className="hint">Не выбрано (доступно всем)</span>}</div>
                  <div className="statuses-list"><label>Выберите из существующих:</label><div className="status-options">{allStatuses.map(status => (
                    <div key={status.id} className={`status-option ${newProject.required_statuses.includes(status.name) ? 'selected' : ''}`} onClick={() => handleToggleRequiredStatus(status.name)}>{status.name}</div>))}</div></div></div></div>
              <div className="form-group"><label><FiUsers /> Группы для доступа</label>
                <div className="required-statuses-container">
                  <div className="selected-statuses">{newProject.group_ids.map(groupId => { const group = groupsList.find(g => g.id === groupId); return group ? (<div key={groupId} className="status-tag selected">{group.name}<button onClick={() => handleToggleGroup(groupId)} className="remove-status">×</button></div>) : null })}
                    {newProject.group_ids.length === 0 && <span className="hint">Не выбрано (доступно всем)</span>}</div>
                  <div className="statuses-list"><label>Выберите группы:</label><div className="status-options">{groupsList.map(group => (
                    <div key={group.id} className={`status-option ${newProject.group_ids.includes(group.id) ? 'selected' : ''}`} onClick={() => handleToggleGroup(group.id)}>{group.name}</div>))}</div></div></div>
                <small className="hint">Студент должен быть в одной из выбранных групп</small></div>
              <div className="form-actions"><button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Создание...' : 'Создать проект'}</button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="cancel-form-btn">Отмена</button></div>
            </form></div>)}

        {/* Вкладки для преподавателя */}
        <div className="projects-tabs">
          <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            <FiLayers /> Все <span className="tab-badge">{allProjects.length}</span>
          </button>
          <button className={`tab ${activeTab === 'published' ? 'active' : ''}`} onClick={() => setActiveTab('published')}>
            <FiEye /> Опубликованные <span className="tab-badge">{published.length}</span>
          </button>
          <button className={`tab ${activeTab === 'drafts' ? 'active' : ''}`} onClick={() => setActiveTab('drafts')}>
            <FiEdit /> Черновики <span className="tab-badge">{drafts.length}</span>
          </button>
        </div>

        <FilterBar searchQuery={searchQuery} onSearchChange={setSearchQuery} sortBy={sortBy} onSortChange={setSortBy} />

        {displayed.length === 0 && !showCreateForm ? (
          <div className="empty-state"><p>{searchQuery ? 'Ничего не найдено' : 'Нет проектов'}</p></div>
        ) : (
          <div className="projects-grid">{displayed.map(project => (
            <ProjectCard key={project.id} project={project} onPlay={onPlayProject} userRole={user?.role} onDelete={handleDeleteProject} />))}</div>)}
      </div>)
  }

  // Представление для студента
  const projectsWithStatus = projects.map(project => ({ ...project, reward_status_earned: earnedStatuses[project.id] || null }))
  const allStudentProjects = getFilteredAndSortedProjects(projectsWithStatus)
  const availableProjects = getFilteredAndSortedProjects(projectsWithStatus.filter(p => !completedProjects.includes(p.id)))
  const completed = getFilteredAndSortedProjects(projectsWithStatus.filter(p => completedProjects.includes(p.id)))

  const displayedStudent = activeTab === 'available' ? availableProjects : activeTab === 'completed' ? completed : allStudentProjects

  return (
    <div className="projects-container student-view">
      <div className="projects-header">
        <h2><FiGrid /> Доступные новеллы</h2>
      </div>

      {/* Вкладки для студента */}
      <div className="projects-tabs">
        <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
          <FiLayers /> Все <span className="tab-badge">{allStudentProjects.length}</span>
        </button>
        <button className={`tab ${activeTab === 'available' ? 'active' : ''}`} onClick={() => setActiveTab('available')}>
          <FiClock /> Доступные <span className="tab-badge">{availableProjects.length}</span>
        </button>
        <button className={`tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
          <FiCheckCircle /> Пройденные <span className="tab-badge">{completed.length}</span>
        </button>
      </div>

      <FilterBar searchQuery={searchQuery} onSearchChange={setSearchQuery} sortBy={sortBy} onSortChange={setSortBy} />

      <div className="tab-content">
        {displayedStudent.length === 0 ? (
          <div className="empty-state"><p>{searchQuery ? 'Ничего не найдено' : 'Нет новелл'}</p></div>
        ) : (
          <div className="projects-grid">
            {displayedStudent.map(project => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onPlay={onPlayProject} 
                userRole={user?.role} 
                isCompleted={completedProjects.includes(project.id)} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}