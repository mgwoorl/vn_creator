import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProject } from '../../context/ProjectContext'
import {
  FiUser, FiMail, FiAward, FiCalendar, FiBookOpen,
  FiStar, FiArrowLeft, FiRefreshCw, FiUsers
} from 'react-icons/fi'

// Простое логирование для отладки
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][ProfilePage]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Страница профиля пользователя с информацией о статусах, прохождениях и личных данных
export const ProfilePage = () => {
  const { user, getFullName } = useAuth()
  const { getStudentProfile, getUserStatuses } = useProject()
  const navigate = useNavigate()

  const [profileData, setProfileData] = useState(null)
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('statuses')

  // Загрузка данных профиля при монтировании
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      log('INFO', 'Загрузка данных профиля', { userId: user?.id, role: user?.role })

      if (user?.role === 'student') {
        const profileResult = await getStudentProfile()
        if (profileResult.success) {
          setProfileData(profileResult.data)
          log('INFO', 'Данные профиля студента загружены')
        } else {
          log('WARN', 'Не удалось загрузить профиль студента')
        }

        const statusesResult = await getUserStatuses()
        if (statusesResult.success) {
          setStatuses(statusesResult.statuses || [])
          log('INFO', 'Статусы пользователя загружены', { count: statusesResult.statuses?.length || 0 })
        }
      }

      setLoading(false)
    }

    if (user) {
      loadData()
    }
  }, [user, getStudentProfile, getUserStatuses])

  // Переход к деталям проекта (страница с информацией о новелле)
  const handleViewProjectDetails = (projectId) => {
    log('INFO', 'Переход к деталям проекта', { projectId })
    navigate(`/project/${projectId}`)
  }

  // Запуск прохождения проекта
  const handlePlayProject = (projectId) => {
    log('INFO', 'Запуск прохождения проекта', { projectId })
    navigate(`/projects/play/${projectId}`)
  }

  // Возврат на главную страницу в зависимости от роли
  const handleGoBack = () => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      navigate('/admin')
    } else {
      navigate('/projects')
    }
  }

  // Форматирование даты в читаемый вид
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Экран загрузки
  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-screen">
          <div className="loader"></div>
          <p>Загрузка профиля...</p>
        </div>
      </div>
    )
  }

  const isTeacher = user?.role === 'teacher'
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  return (
    <div className="profile-page">
      {/* Кнопка возврата на главную */}
      <button onClick={handleGoBack} className="profile-back-btn">
        <FiArrowLeft /> {isAdmin ? 'Вернуться к панели управления' : 'Вернуться к новеллам'}
      </button>

      {/* Шапка профиля с аватаром и основной информацией */}
      <div className="profile-header">
        <div className="profile-avatar">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <div className="profile-info">
          <h2>{getFullName()}</h2>
          <p className="profile-email"><FiMail /> {user?.email}</p>
          <p className="profile-role">
            {isAdmin
              ? (user?.role === 'super_admin' ? 'Супер-администратор' : 'Администратор')
              : isTeacher ? 'Преподаватель' : 'Студент'}
          </p>
          {profileData?.user?.group_name && (
            <p className="profile-group">
              <FiUsers /> Группа: {profileData.user.group_name}
            </p>
          )}
        </div>
      </div>

      {/* Вкладки для студента: статусы, прохождения, профиль */}
      {user?.role === 'student' && (
        <>
          <div className="profile-tabs">
            <button
              className={`profile-tab ${activeTab === 'statuses' ? 'active' : ''}`}
              onClick={() => setActiveTab('statuses')}
            >
              <FiAward /> Статусы ({statuses.length})
            </button>
            <button
              className={`profile-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <FiBookOpen /> Прохождения ({profileData?.completed_projects?.length || 0})
            </button>
            <button
              className={`profile-tab ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              <FiUser /> Профиль
            </button>
          </div>

          <div className="profile-content">
            {/* Вкладка "Статусы" */}
            {activeTab === 'statuses' && (
              <div className="profile-section">
                <h3><FiAward /> Полученные статусы</h3>
                {statuses.length === 0 ? (
                  <div className="profile-empty">
                    <p>У вас пока нет статусов</p>
                    <p className="profile-hint">Проходите новеллы, чтобы получать новые статусы</p>
                  </div>
                ) : (
                  <div className="statuses-grid">
                    {statuses.map((status, index) => (
                      <div key={index} className="status-card">
                        <div className="status-icon"><FiStar /></div>
                        <div className="status-info">
                          <div className="status-name">{status.name}</div>
                          <div className="status-date">
                            <FiCalendar /> {formatDate(status.earned_at)}
                          </div>
                          {status.project_title && (
                            <div className="status-project" title={status.project_title}>
                              За новеллу: {status.project_title.length > 35
                                ? status.project_title.slice(0, 35) + '...'
                                : status.project_title}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Вкладка "Прохождения" */}
            {activeTab === 'history' && (
              <div className="profile-section">
                <h3><FiBookOpen /> Завершённые прохождения</h3>
                {!profileData?.completed_projects || profileData.completed_projects.length === 0 ? (
                  <div className="profile-empty">
                    <p>Вы ещё не прошли ни одной новеллы</p>
                    <p className="profile-hint">Начните прохождение, чтобы увидеть результаты</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {profileData.completed_projects.map((project) => (
                      <div key={project.project_id} className="history-card">
                        {/* Название проекта — кликабельное, ведет на страницу деталей */}
                        <div className="history-project">
                          <strong
                            onClick={() => handleViewProjectDetails(project.project_id)}
                            className="history-project-link"
                            title="Посмотреть детали новеллы"
                          >
                            {project.project_title}
                          </strong>
                        </div>
                        {/* Статистика по проекту */}
                        <div className="history-details">
                          <div className="history-stat">Попыток: {project.attempts}</div>
                          <div className="history-stat"><FiStar /> Лучший балл: {project.best_points}</div>
                        </div>
                        {/* Кнопка для повторного прохождения */}
                        <div className="history-actions">
                          <button
                            onClick={() => handlePlayProject(project.project_id)}
                            className="history-replay-btn"
                            title="Пройти заново"
                          >
                            <FiRefreshCw /> Пройти
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Вкладка "Профиль" — личные данные */}
            {activeTab === 'info' && (
              <div className="profile-section">
                <h3><FiUser /> Личные данные</h3>
                <div className="info-card">
                  <div className="info-item">
                    <span className="info-label">Фамилия</span>
                    <span className="info-value">{user?.last_name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Имя</span>
                    <span className="info-value">{user?.first_name}</span>
                  </div>
                  {user?.patronymic && (
                    <div className="info-item">
                      <span className="info-label">Отчество</span>
                      <span className="info-value">{user?.patronymic}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <span className="info-label">Email</span>
                    <span className="info-value">{user?.email}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Роль</span>
                    <span className="info-value">Студент</span>
                  </div>
                  {profileData?.user?.group_name && (
                    <div className="info-item">
                      <span className="info-label">Группа</span>
                      <span className="info-value">{profileData.user.group_name}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <span className="info-label">Дата регистрации</span>
                    <span className="info-value">{formatDate(user?.created_at)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Профиль преподавателя — только личные данные */}
      {isTeacher && (
        <div className="profile-content">
          <div className="profile-section">
            <h3><FiUser /> Личные данные</h3>
            <div className="info-card">
              <div className="info-item">
                <span className="info-label">Фамилия</span>
                <span className="info-value">{user?.last_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Имя</span>
                <span className="info-value">{user?.first_name}</span>
              </div>
              {user?.patronymic && (
                <div className="info-item">
                  <span className="info-label">Отчество</span>
                  <span className="info-value">{user?.patronymic}</span>
                </div>
              )}
              <div className="info-item">
                <span className="info-label">Email</span>
                <span className="info-value">{user?.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Роль</span>
                <span className="info-value">Преподаватель</span>
              </div>
              <div className="info-item">
                <span className="info-label">Дата регистрации</span>
                <span className="info-value">{formatDate(user?.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Профиль администратора — только личные данные */}
      {isAdmin && (
        <div className="profile-content">
          <div className="profile-section">
            <h3><FiUser /> Личные данные</h3>
            <div className="info-card">
              <div className="info-item">
                <span className="info-label">Фамилия</span>
                <span className="info-value">{user?.last_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Имя</span>
                <span className="info-value">{user?.first_name}</span>
              </div>
              {user?.patronymic && (
                <div className="info-item">
                  <span className="info-label">Отчество</span>
                  <span className="info-value">{user?.patronymic}</span>
                </div>
              )}
              <div className="info-item">
                <span className="info-label">Email</span>
                <span className="info-value">{user?.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Роль</span>
                <span className="info-value">
                  {user?.role === 'super_admin' ? 'Супер-администратор' : 'Администратор'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Дата регистрации</span>
                <span className="info-value">{formatDate(user?.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}