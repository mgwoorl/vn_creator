import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProject } from '../../context/ProjectContext'
import { usePlaythrough } from '../../context/PlaythroughContext'
import api from '../../utils/api'
import { 
  FiArrowLeft, FiEdit, FiPlay, FiRefreshCw, FiStar, 
  FiFilm, FiUser, FiTag, FiBookOpen, FiEye, FiEyeOff,
  FiAward, FiBarChart2, FiUsers, FiTrendingUp,
  FiSearch, FiX, FiChevronRight, FiChevronLeft, FiFilter
} from 'react-icons/fi'

// Компонент кнопки вкладки в аналитике
const TabButton = ({ active, onClick, icon: Icon, label, count }) => (
  <button className={`analytics-tab ${active ? 'active' : ''}`} onClick={onClick}>
    <Icon size={16} />
    <span>{label}</span>
    {count !== undefined && <span className="tab-count-badge">{count}</span>}
  </button>
)

// Компонент пагинации для таблиц аналитики
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null

  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <div className="pagination">
      <button className="pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        <FiChevronLeft size={14} />
      </button>
      {start > 1 && (
        <>
          <button className="pagination-btn" onClick={() => onPageChange(1)}>1</button>
          {start > 2 && <span className="pagination-dots">...</span>}
        </>
      )}
      {pages.map(page => (
        <button key={page} className={`pagination-btn ${page === currentPage ? 'active' : ''}`} onClick={() => onPageChange(page)}>
          {page}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="pagination-dots">...</span>}
          <button className="pagination-btn" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
        </>
      )}
      <button className="pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        <FiChevronRight size={14} />
      </button>
    </div>
  )
}

// Компонент значка места в рейтинге
const RankBadge = ({ rank }) => {
  if (rank === 1) return <span className="rank-badge gold">1</span>
  if (rank === 2) return <span className="rank-badge silver">2</span>
  if (rank === 3) return <span className="rank-badge bronze">3</span>
  return <span className="rank-badge normal">{rank}</span>
}

// Количество записей на странице в аналитике
const ITEMS_PER_PAGE = 15

export const ProjectDetails = ({ project, onBack }) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getUserById } = useProject()
  const { getCompletedProjects, getPlaythroughAnswers } = usePlaythrough()
  const [isCompleted, setIsCompleted] = useState(false)
  const [ownerName, setOwnerName] = useState('Неизвестен')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  // Состояния для аналитики
  const [analytics, setAnalytics] = useState(null)
  const [analyticsTab, setAnalyticsTab] = useState('leaderboard')
  const [leaderboardSearch, setLeaderboardSearch] = useState('')
  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const [studentsSearch, setStudentsSearch] = useState('')
  const [studentsPage, setStudentsPage] = useState(1)
  const [groupFilter, setGroupFilter] = useState('')
  const [availableGroups, setAvailableGroups] = useState([])

  // Состояния для навигации по студентам и ответам
  const [viewMode, setViewMode] = useState('main') // 'main' | 'student' | 'answers'
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentPlaythroughs, setStudentPlaythroughs] = useState([])
  const [selectedPlaythrough, setSelectedPlaythrough] = useState(null)
  const [playthroughAnswers, setPlaythroughAnswers] = useState([])
  const [loadingStudent, setLoadingStudent] = useState(false)
  const [loadingAnswers, setLoadingAnswers] = useState(false)
  const [studentInfo, setStudentInfo] = useState(null)
  const [previousContext, setPreviousContext] = useState(null)

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  // Сброс страниц при изменении фильтров
  useEffect(() => { setLeaderboardPage(1) }, [leaderboardSearch])
  useEffect(() => { setStudentsPage(1) }, [studentsSearch, groupFilter])

  // Загрузка имени владельца проекта
  useEffect(() => {
    const loadOwner = async () => {
      if (project.owner_id) {
        const result = await getUserById(project.owner_id)
        if (result.success && result.user) {
          setOwnerName(`${result.user.last_name} ${result.user.first_name}`.trim() || 'Неизвестен')
        }
      }
    }
    loadOwner()
  }, [project.owner_id, getUserById])

  // Проверка, завершён ли проект студентом
  useEffect(() => {
    if (user?.role === 'student' && project.id) {
      getCompletedProjects().then(result => {
        if (result.success) setIsCompleted(result.completed_ids.includes(project.id))
      })
    }
  }, [project.id, user?.role, getCompletedProjects])

  // Загрузка или скрытие аналитики
  const loadAnalytics = async () => {
    if (showAnalytics) {
      setShowAnalytics(false)
      return
    }
    setLoadingAnalytics(true)
    try {
      if (!analytics) {
        const response = await api.get(`/projects/${project.id}/analytics`)
        setAnalytics(response.data)
        const groupsResponse = await api.get('/users/groups')
        setAvailableGroups(groupsResponse.data || [])
      }
      setShowAnalytics(true)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  // Возврат на главный экран аналитики
  const goToMain = () => {
    setViewMode('main')
    setSelectedStudent(null)
    setStudentPlaythroughs([])
    setSelectedPlaythrough(null)
    setPlaythroughAnswers([])
    setPreviousContext(null)
  }

  // Возврат на уровень назад
  const goBack = () => {
    if (viewMode === 'answers') {
      setViewMode('student')
      setSelectedPlaythrough(null)
      setPlaythroughAnswers([])
    } else if (viewMode === 'student') {
      goToMain()
    }
  }

  // Открыть все попытки студента
  const openStudent = async (entry) => {
    setLoadingStudent(true)
    setStudentInfo(entry)
    setSelectedStudent(entry.user_id)
    setSelectedPlaythrough(null)
    setPlaythroughAnswers([])
    setPreviousContext({
      tab: analyticsTab,
      group: groupFilter
    })
    try {
      const response = await api.get(`/projects/${project.id}/student/${entry.user_id}/playthroughs`)
      setStudentPlaythroughs(response.data)
      setViewMode('student')
    } catch (error) {
      console.error('Failed to load student:', error)
    } finally {
      setLoadingStudent(false)
    }
  }

  // Открыть ответы попытки
  const openAnswers = async (playthroughId, contextOverride = null) => {
    setLoadingAnswers(true)
    try {
      const result = await getPlaythroughAnswers(playthroughId)
      if (result.success) {
        setPlaythroughAnswers(result.answers)
        setSelectedPlaythrough(playthroughId)
        if (contextOverride) {
          setPreviousContext(contextOverride)
        }
        setViewMode('answers')
      }
    } catch (error) {
      console.error('Failed to load answers:', error)
    } finally {
      setLoadingAnswers(false)
    }
  }

  const handlePlayClick = () => navigate(`/projects/play/${project.id}`)
  const handleEditClick = () => navigate(`/projects/edit/${project.id}`)

  const coverUrl = project.cover_url?.startsWith('http') ? project.cover_url : project.cover_url ? `http://localhost:8000${project.cover_url}` : null
  const isTeacher = user?.role === 'teacher'
  const description = project.description || ''

  // Определяем, что показывать в хлебных крошках
  const getBreadcrumbLabel = () => {
    if (!previousContext) return 'Аналитика'
    if (previousContext.tab === 'leaderboard') return 'Рейтинг'
    if (previousContext.tab === 'students') return `Студенты${previousContext.group ? ` (${previousContext.group})` : ''}`
    return 'Аналитика'
  }

  // Рейтинг — лучший результат каждого студента
  const filteredLeaderboard = useMemo(() => {
    if (!analytics?.students_list) return []
    let data = [...analytics.students_list]
    if (leaderboardSearch.trim()) {
      const s = leaderboardSearch.toLowerCase()
      data = data.filter(e => e.student_name.toLowerCase().includes(s) || e.student_email.toLowerCase().includes(s))
    }
    const bestResults = {}
    data.forEach(entry => {
      if (!bestResults[entry.user_id] || entry.best_points > bestResults[entry.user_id].best_points) {
        bestResults[entry.user_id] = entry
      }
    })
    const uniqueData = Object.values(bestResults)
    uniqueData.sort((a, b) => {
      if (b.best_points !== a.best_points) return b.best_points - a.best_points
      return new Date(b.last_completed_at || 0) - new Date(a.last_completed_at || 0)
    })
    return uniqueData
  }, [analytics, leaderboardSearch])

  const leaderboardTotalPages = Math.ceil(filteredLeaderboard.length / ITEMS_PER_PAGE)
  const leaderboardPageData = filteredLeaderboard.slice((leaderboardPage - 1) * ITEMS_PER_PAGE, leaderboardPage * ITEMS_PER_PAGE)

  // Студенты по группам
  const filteredStudents = useMemo(() => {
    if (!analytics?.students_list || !groupFilter) return []
    let data = [...analytics.students_list]
    if (studentsSearch.trim()) {
      const s = studentsSearch.toLowerCase()
      data = data.filter(e => e.student_name.toLowerCase().includes(s) || e.student_email.toLowerCase().includes(s))
    }
    return data
  }, [analytics, studentsSearch, groupFilter])

  const studentsTotalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE)
  const studentsPageData = filteredStudents.slice((studentsPage - 1) * ITEMS_PER_PAGE, studentsPage * ITEMS_PER_PAGE)

  return (
    <div className="project-details-page">
      <div className="project-details-container">
        {/* Кнопка возврата */}
        <div className="details-header">
          <button onClick={onBack || (() => navigate(isAdmin ? '/admin' : '/projects'))} className="back-button">
            <FiArrowLeft /> Назад к проектам
          </button>
        </div>

        {/* Hero-секция с обложкой и информацией */}
        <div className="details-hero">
          <div className="details-cover">
            {coverUrl ? <img src={coverUrl} alt={project.title} /> : (
              <div className="details-cover-placeholder"><FiBookOpen /><span>Нет обложки</span></div>
            )}
            {(isTeacher || isAdmin) && (
              <div className={`cover-badge ${project.is_published ? 'published-badge' : 'draft-badge'}`}>
                {project.is_published ? <><FiEye /> Опубликован</> : <><FiEyeOff /> Черновик</>}
              </div>
            )}
            {isCompleted && !isTeacher && !isAdmin && (
              <div className="cover-badge completed-badge"><FiStar /> Пройдено</div>
            )}
          </div>
          <div className="details-info">
            <h1 className="details-project-title">{project.title}</h1>
            <div className="details-author"><FiUser /> Автор: {ownerName}</div>
            <div className="details-stats-grid">
              <div className="stat-item">
                <FiFilm className="stat-icon" />
                <div className="stat-content">
                  <span className="stat-label">Сцен</span>
                  <span className="stat-value">{project.scenes?.length || 0}</span>
                </div>
              </div>
              {project.min_points > 0 && (
                <div className="stat-item">
                  <FiStar className="stat-icon" />
                  <div className="stat-content">
                    <span className="stat-label">Мин. баллы</span>
                    <span className="stat-value">{project.min_points}</span>
                  </div>
                </div>
              )}
              {!isTeacher && !isAdmin && project.reward_status && (
                <div className="stat-item reward">
                  <FiAward className="stat-icon" />
                  <div className="stat-content">
                    <span className="stat-label">Статус</span>
                    <span className="stat-value">{project.reward_status}</span>
                  </div>
                </div>
              )}
            </div>
            {project.required_statuses?.length > 0 && (
              <div className="details-required-statuses">
                <FiTag className="required-icon" />
                <span className="required-label">Требуемые статусы:</span>
                <div className="status-tags">
                  {project.required_statuses.map(s => <span key={s} className="status-tag">{s}</span>)}
                </div>
              </div>
            )}
            {project.groups?.length > 0 && (
              <div className="details-required-statuses" style={{ marginTop: '12px' }}>
                <FiUsers className="required-icon" />
                <span className="required-label">Группы:</span>
                <div className="status-tags">
                  {project.groups.map(g => <span key={g} className="status-tag">{g}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Описание проекта */}
        {description && (
          <div className="details-section">
            <h3>Описание</h3>
            <p className="full-description">
              {description.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < description.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          </div>
        )}

        {/* Кнопки действий */}
        <div className="details-actions">
          {(isTeacher || isAdmin) ? (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleEditClick} className="edit-btn-large"><FiEdit /> Редактировать</button>
              <button
                onClick={loadAnalytics}
                className={`play-btn-large ${showAnalytics ? 'active-analytics' : ''}`}
                disabled={loadingAnalytics}
              >
                <FiBarChart2 /> {loadingAnalytics ? 'Загрузка...' : showAnalytics ? 'Скрыть аналитику' : 'Аналитика'}
              </button>
            </div>
          ) : (
            <button onClick={handlePlayClick} className={`play-btn-large ${isCompleted ? 'replay' : ''}`}>
              {isCompleted ? (
                <><FiRefreshCw /> Играть снова</>
              ) : project.has_active_playthrough ? (
                <><FiPlay /> Продолжить</>
              ) : (
                <><FiPlay /> Играть</>
              )}
            </button>
          )}
        </div>

        {/* Аналитика */}
        {showAnalytics && analytics && (
          <div className="details-section">
            {/* Карточки со статистикой */}
            <div className="analytics-summary-cards">
              <div className="analytics-card">
                <FiUsers className="analytics-icon" />
                <div className="analytics-value">{analytics.total_students}</div>
                <div className="analytics-label">Студентов прошло</div>
              </div>
              <div className="analytics-card">
                <FiTrendingUp className="analytics-icon" />
                <div className="analytics-value">{analytics.total_playthroughs}</div>
                <div className="analytics-label">Всего прохождений</div>
              </div>
              <div className="analytics-card">
                <FiStar className="analytics-icon" />
                <div className="analytics-value">{analytics.average_points}</div>
                <div className="analytics-label">Средний балл</div>
              </div>
            </div>

            {/* Хлебные крошки для навигации */}
            {viewMode !== 'main' && (
              <div className="analytics-breadcrumb">
                <button className="breadcrumb-link" onClick={goToMain}>
                  <FiBarChart2 size={14} /> {getBreadcrumbLabel()}
                </button>
                <FiChevronRight size={14} className="breadcrumb-arrow" />
                {viewMode === 'student' && (
                  <span className="breadcrumb-current">
                    <FiUser size={14} /> {studentInfo?.student_name || 'Студент'}
                  </span>
                )}
                {viewMode === 'answers' && (
                  <>
                    <button className="breadcrumb-link" onClick={goBack}>
                      <FiUser size={14} /> {studentInfo?.student_name || 'Студент'}
                    </button>
                    <FiChevronRight size={14} className="breadcrumb-arrow" />
                    <span className="breadcrumb-current">
                      <FiEye size={14} /> Ответы
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Основной вид аналитики */}
            {viewMode === 'main' && (
              <>
                {/* Вкладки: Рейтинг и Студенты */}
                <div className="analytics-tabs">
                  <TabButton
                    active={analyticsTab === 'leaderboard'}
                    onClick={() => setAnalyticsTab('leaderboard')}
                    icon={FiAward}
                    label="Рейтинг"
                    count={filteredLeaderboard.length}
                  />
                  <TabButton
                    active={analyticsTab === 'students'}
                    onClick={() => setAnalyticsTab('students')}
                    icon={FiUsers}
                    label="Студенты"
                  />
                </div>

                {/* Вкладка "Рейтинг" */}
                {analyticsTab === 'leaderboard' && (
                  <>
                    <div className="analytics-tab-description">
                      Рейтинг показывает <strong>лучший результат</strong> каждого студента.
                      Нажмите на <strong>имя</strong> — все попытки студента.
                      Нажмите на <FiEye size={12} /> — ответы лучшей попытки.
                    </div>
                    <div className="analytics-controls">
                      <div className="projects-search-wrapper">
                        <FiSearch className="projects-search-icon" />
                        <input
                          type="text"
                          placeholder="Поиск по имени или email..."
                          value={leaderboardSearch}
                          onChange={(e) => setLeaderboardSearch(e.target.value)}
                          className="projects-search-input"
                        />
                        {leaderboardSearch && (
                          <button className="projects-search-clear" onClick={() => setLeaderboardSearch('')}>
                            <FiX size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {leaderboardPageData.length === 0 ? (
                      <div className="empty-state"><p>Студенты не найдены</p></div>
                    ) : (
                      <>
                        <Pagination currentPage={leaderboardPage} totalPages={leaderboardTotalPages} onPageChange={setLeaderboardPage} />
                        <div className="leaderboard-table-container">
                          <table>
                            <thead>
                              <tr>
                                <th>Место</th><th>Студент</th><th>Лучший балл</th>
                                <th>Попыток</th><th>Дата</th><th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {leaderboardPageData.map((entry, index) => (
                                <tr key={entry.user_id}>
                                  <td><RankBadge rank={(leaderboardPage - 1) * ITEMS_PER_PAGE + index + 1} /></td>
                                  <td>
                                    <button className="student-link-btn" onClick={() => openStudent(entry)} title="Все попытки студента">
                                      {entry.student_name}
                                    </button>
                                  </td>
                                  <td><strong>{entry.best_points}</strong></td>
                                  <td>{entry.attempts}</td>
                                  <td>{entry.last_completed_at ? new Date(entry.last_completed_at).toLocaleDateString('ru-RU') : '-'}</td>
                                  <td>
                                    <button
                                      className="view-answers-btn"
                                      onClick={() => openAnswers(entry.last_playthrough_id, { tab: 'leaderboard', group: '' })}
                                      title="Ответы лучшей попытки"
                                    >
                                      <FiEye size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <Pagination currentPage={leaderboardPage} totalPages={leaderboardTotalPages} onPageChange={setLeaderboardPage} />
                      </>
                    )}
                  </>
                )}

                {/* Вкладка "Студенты" */}
                {analyticsTab === 'students' && (
                  <>
                    <div className="analytics-tab-description">
                      Выберите группу, чтобы посмотреть студентов этой группы.
                      Нажмите на <strong>имя</strong> — все попытки студента.
                      Нажмите на <FiEye size={12} /> — ответы.
                    </div>
                    <div className="analytics-controls">
                      <div className="filter-group">
                        <FiFilter size={14} />
                        <select className="filter-select" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                          <option value="">— Выберите группу —</option>
                          {availableGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                        </select>
                      </div>
                      {groupFilter && (
                        <div className="projects-search-wrapper">
                          <FiSearch className="projects-search-icon" />
                          <input
                            type="text"
                            placeholder="Поиск по имени или email..."
                            value={studentsSearch}
                            onChange={(e) => setStudentsSearch(e.target.value)}
                            className="projects-search-input"
                          />
                          {studentsSearch && (
                            <button className="projects-search-clear" onClick={() => setStudentsSearch('')}>
                              <FiX size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {!groupFilter ? (
                      <div className="empty-state"><p>Выберите группу для отображения студентов</p></div>
                    ) : studentsPageData.length === 0 ? (
                      <div className="empty-state">
                        <p>{studentsSearch ? 'Студенты не найдены' : 'Нет студентов в этой группе'}</p>
                      </div>
                    ) : (
                      <>
                        <Pagination currentPage={studentsPage} totalPages={studentsTotalPages} onPageChange={setStudentsPage} />
                        <div className="leaderboard-table-container">
                          <table>
                            <thead>
                              <tr>
                                <th>Студент</th><th>Email</th><th>Баллы</th>
                                <th>Попыток</th><th>Дата</th><th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {studentsPageData.map(entry => (
                                <tr key={entry.user_id}>
                                  <td>
                                    <button className="student-link-btn" onClick={() => openStudent(entry)} title="Все попытки студента">
                                      {entry.student_name}
                                    </button>
                                  </td>
                                  <td>{entry.student_email}</td>
                                  <td><strong>{entry.best_points}</strong></td>
                                  <td>{entry.attempts}</td>
                                  <td>{entry.last_completed_at ? new Date(entry.last_completed_at).toLocaleDateString('ru-RU') : '-'}</td>
                                  <td>
                                    <button
                                      className="view-answers-btn"
                                      onClick={() => openAnswers(entry.last_playthrough_id, { tab: 'students', group: groupFilter })}
                                      title="Ответы"
                                    >
                                      <FiEye size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <Pagination currentPage={studentsPage} totalPages={studentsTotalPages} onPageChange={setStudentsPage} />
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* Просмотр попыток студента */}
            {viewMode === 'student' && selectedStudent && (
              <>
                <div className="analytics-tab-description">
                  Все попытки прохождения студента <strong>{studentInfo?.student_name || 'Студент'}</strong>.
                  Нажмите на <FiEye size={12} />, чтобы посмотреть ответы конкретной попытки.
                </div>
                {loadingStudent ? (
                  <div className="loading-files">Загрузка попыток...</div>
                ) : (
                  <div className="leaderboard-table-container">
                    <table>
                      <thead>
                        <tr><th>#</th><th>Баллы</th><th>Дата</th><th></th></tr>
                      </thead>
                      <tbody>
                        {studentPlaythroughs.map((p, i) => (
                          <tr key={p.playthrough_id}>
                            <td>{i + 1}</td>
                            <td><strong>{p.total_points}</strong></td>
                            <td>{p.completed_at ? new Date(p.completed_at).toLocaleDateString('ru-RU') : '-'}</td>
                            <td>
                              <button className="view-answers-btn" onClick={() => openAnswers(p.playthrough_id)} title="Ответы этой попытки">
                                <FiEye size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Просмотр ответов */}
            {viewMode === 'answers' && selectedPlaythrough && (
              <>
                <div className="analytics-tab-description">
                  Ответы студента <strong>{studentInfo?.student_name || 'Студент'}</strong> на вопросы новеллы.
                </div>
                {loadingAnswers ? (
                  <div className="loading-files">Загрузка ответов...</div>
                ) : (
                  <div className="answers-detail-list-scroll">
                    {playthroughAnswers.map((a, i) => (
                      <div key={a.id || i} className="answer-detail-card">
                        <div className="answer-detail-number">#{a.order_index + 1}</div>
                        <div className="answer-detail-body">
                          <div className="answer-detail-question">
                            <span className="answer-label">Сцена: {a.scene_name}</span>
                          </div>
                          <div className="answer-detail-chosen">
                            <FiChevronRight size={14} /><span>{a.option_text}</span>
                          </div>
                          <div className="answer-detail-points">
                            <FiStar size={12} /> {a.points_earned} баллов
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}