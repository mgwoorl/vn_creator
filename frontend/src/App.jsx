import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useProject } from './context/ProjectContext'
import { useFiles } from './context/FileContext'
import { AppProviders } from './context/AppProviders'
import { AuthTabs } from './components/auth/AuthTabs'
import { ProjectList } from './components/projects/ProjectList'
import { ProjectPlayer } from './components/player/ProjectPlayer'
import { ProjectEditor } from './components/projects/ProjectEditor'
import { ProjectDetails } from './components/projects/ProjectDetails'
import { ProfilePage } from './components/profile/ProfilePage'
import { AdminDashboard } from './components/admin/AdminDashboard'
import { Header } from './components/layout/Header'
import './App.css'
import './styles/admin.css'

// Простая функция логирования
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][App]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

// Обертка для скрытия Header на странице логина
function Layout({ children }) {
  const location = useLocation()
  const hideHeaderPaths = ['/login']
  const shouldHideHeader = hideHeaderPaths.some(
    path => location.pathname === path || location.pathname.startsWith(path)
  )

  return (
    <>
      {!shouldHideHeader && <Header />}
      {children}
    </>
  )
}

// Страница со списком проектов
function ProjectsPage() {
  const { user } = useAuth()
  const { projects, fetchProjects, loading } = useProject()
  const navigate = useNavigate()
  const fetchedRef = React.useRef(false)

  React.useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      log('INFO', 'Загрузка списка проектов')
      fetchProjects()
    }
  }, [fetchProjects])

  const handlePlayProject = (project) => {
    log('INFO', 'Переход к проекту', { projectId: project.id })
    navigate(`/project/${project.id}`)
  }

  return (
    <div className="app">
      <main className="app-main">
        {loading ? (
          <div className="loading-screen">
            <div className="loader"></div>
            <p>Загрузка проектов...</p>
          </div>
        ) : (
          <ProjectList
            projects={projects}
            onPlayProject={handlePlayProject}
            user={user}
          />
        )}
      </main>
    </div>
  )
}

// Обертка для редактора проекта с загрузкой данных
function ProjectEditorWrapper() {
  const { projectId } = useParams()
  const [project, setProject] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const { loadProjectWithScenes } = useProject()
  const { loadProjectFiles } = useFiles()
  const navigate = useNavigate()
  const loadedIdRef = React.useRef(null)

  React.useEffect(() => {
    const id = parseInt(projectId)

    // Защита от повторной загрузки того же проекта
    if (loadedIdRef.current === id) return

    let cancelled = false

    const loadProjectData = async () => {
      setLoading(true)
      log('INFO', 'Загрузка данных проекта для редактора', { projectId: id })
      try {
        const result = await loadProjectWithScenes(id)
        if (!cancelled && result.success) {
          await loadProjectFiles(id)
          if (!cancelled) {
            setProject(result.project)
            loadedIdRef.current = id
            log('INFO', 'Проект загружен для редактора', { projectId: id })
          }
        } else if (!cancelled) {
          log('WARN', 'Не удалось загрузить проект для редактора', { projectId: id })
        }
      } catch (error) {
        log('ERROR', 'Ошибка загрузки проекта для редактора', { projectId: id, error: error.message })
      }
      if (!cancelled) {
        setLoading(false)
      }
    }

    loadProjectData()

    return () => {
      cancelled = true
    }
  }, [projectId, loadProjectWithScenes, loadProjectFiles])

  if (loading || !project) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка проекта...</p>
      </div>
    )
  }

  return (
    <ProjectEditor
      project={project}
      onClose={() => navigate('/projects')}
    />
  )
}

// Обертка для плеера проекта с загрузкой данных
function ProjectPlayerWrapper() {
  const { projectId } = useParams()
  const [project, setProject] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const { loadProjectWithScenes } = useProject()
  const { loadProjectFiles } = useFiles()
  const navigate = useNavigate()
  const loadedIdRef = React.useRef(null)

  React.useEffect(() => {
    const id = parseInt(projectId)

    // Защита от повторной загрузки
    if (loadedIdRef.current === id) return

    let cancelled = false

    const loadProjectData = async () => {
      setLoading(true)
      log('INFO', 'Загрузка данных проекта для плеера', { projectId: id })
      try {
        const result = await loadProjectWithScenes(id)
        if (!cancelled && result.success) {
          const filesResult = await loadProjectFiles(id)
          if (!cancelled) {
            const fullProject = {
              ...result.project,
              sprites: filesResult.files?.sprites || [],
              music: filesResult.files?.music || [],
              backgrounds: filesResult.files?.backgrounds || []
            }
            setProject(fullProject)
            loadedIdRef.current = id
            log('INFO', 'Проект загружен для плеера', { projectId: id })
          }
        } else if (!cancelled) {
          log('WARN', 'Не удалось загрузить проект для плеера', { projectId: id })
        }
      } catch (error) {
        log('ERROR', 'Ошибка загрузки проекта для плеера', { projectId: id, error: error.message })
      }
      if (!cancelled) {
        setLoading(false)
      }
    }

    loadProjectData()

    return () => {
      cancelled = true
    }
  }, [projectId, loadProjectWithScenes, loadProjectFiles])

  const handleClose = React.useCallback(() => {
    log('INFO', 'Закрытие плеера')
    navigate('/projects')
  }, [navigate])

  if (loading || !project) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка новеллы...</p>
      </div>
    )
  }

  return (
    <ProjectPlayer
      project={project}
      onClose={handleClose}
    />
  )
}

// Обертка для страницы деталей проекта
function ProjectDetailsWrapper() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { loadProjectWithScenes } = useProject()
  const [project, setProject] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const loadedIdRef = React.useRef(null)

  React.useEffect(() => {
    const id = parseInt(projectId)

    if (loadedIdRef.current === id) return

    let cancelled = false

    const loadProject = async () => {
      setLoading(true)
      log('INFO', 'Загрузка деталей проекта', { projectId: id })
      const result = await loadProjectWithScenes(id)
      if (!cancelled && result.success) {
        setProject(result.project)
        loadedIdRef.current = id
        log('INFO', 'Детали проекта загружены', { projectId: id })
      } else if (!cancelled) {
        log('WARN', 'Не удалось загрузить детали проекта', { projectId: id })
      }
      if (!cancelled) {
        setLoading(false)
      }
    }
    loadProject()

    return () => {
      cancelled = true
    }
  }, [projectId, loadProjectWithScenes])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка...</p>
      </div>
    )
  }

  if (!project) {
    return <div className="error-screen">Проект не найден</div>
  }

  return <ProjectDetails project={project} onBack={() => navigate('/projects')} />
}

// Компонент защиты маршрутов по ролям
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка...</p>
      </div>
    )
  }

  if (!user) {
    log('WARN', 'Попытка доступа без авторизации')
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    log('WARN', 'Недостаточно прав для доступа', { userRole: user.role, requiredRoles: allowedRoles })
    return (
      <Navigate
        to={user.role === 'admin' || user.role === 'super_admin' ? '/admin' : '/projects'}
        replace
      />
    )
  }

  return children
}

// Основные маршруты приложения
function AppRoutes() {
  const { user, isAdmin } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? <Navigate to={isAdmin ? '/admin' : '/projects'} replace /> : <AuthTabs />
        }
      />

      <Route path="/" element={<Navigate to={isAdmin ? '/admin' : '/projects'} replace />} />

      <Route
        path="/projects"
        element={
          <ProtectedRoute allowedRoles={['student', 'teacher']}>
            <ProjectsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/project/:projectId"
        element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
            <ProjectDetailsWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects/play/:projectId"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <ProjectPlayerWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects/edit/:projectId"
        element={
          <ProtectedRoute allowedRoles={['teacher', 'admin', 'super_admin']}>
            <ProjectEditorWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={isAdmin ? '/admin' : '/projects'} replace />} />
    </Routes>
  )
}

// Корневой компонент приложения
function App() {
  log('INFO', 'Инициализация приложения')
  return (
    <Router>
      <AppProviders>
        <Layout>
          <AppRoutes />
        </Layout>
      </AppProviders>
    </Router>
  )
}

export default App