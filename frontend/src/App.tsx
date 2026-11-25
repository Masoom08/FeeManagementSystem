
import { useEffect, useState } from 'react'
import { DashboardPage, type DashboardPageName } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { api, AUTH_TOKEN_STORAGE_KEY } from './api/client'
import './App.css'
import './accessibility.css'

const routeByPage: Record<DashboardPageName, string> = {
  Overview: '/admin',
  'Current fees': '/admin/current-fees',
  'Fee history': '/admin/fee-history',
  'Fee structure': '/admin/fees',
  Courses: '/admin/courses',
  Batches: '/admin/batches',
  Sessions: '/admin/sessions',
  Semesters: '/admin/semesters',
  'Reminder history': '/admin/reminders',
  'Late fee waivers': '/admin/waivers',
}

const ROLE_STORAGE_KEY = 'iccmrt-user-role'
const EMAIL_STORAGE_KEY = 'iccmrt-user-email'

type UserRole = 'ADMIN' | 'SUPERADMIN'

function pageFromPath(path: string): DashboardPageName {
  if (path.startsWith('/admin/current-fees') || path.startsWith('/admin/students')) return 'Current fees'
  if (path.startsWith('/admin/fee-history')) return 'Fee history'
  if (path.startsWith('/admin/fees')) return 'Fee structure'
  if (path.startsWith('/admin/courses')) return 'Courses'
  if (path.startsWith('/admin/batches')) return 'Batches'
  if (path.startsWith('/admin/sessions')) return 'Sessions'
  if (path.startsWith('/admin/semesters')) return 'Semesters'
  if (path.startsWith('/admin/reminders')) return 'Reminder history'
  if (path.startsWith('/admin/waivers')) return 'Late fee waivers'
  return 'Overview'
}

function App() {
  const [pathname, setPathname] = useState(window.location.pathname)
  const [signedIn, setSignedIn] = useState(() =>
    Boolean(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY))
  )

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname)

    window.addEventListener('popstate', syncPath)

    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  useEffect(() => {
    const role = sessionStorage.getItem(ROLE_STORAGE_KEY)
    const page = pageFromPath(pathname)

    const restrictedPage = [
      'Courses',
      'Batches',
      'Sessions',
      'Semesters',
    ].includes(page)

    if (
      pathname.startsWith('/admin') &&
      role !== 'SUPERADMIN' &&
      restrictedPage
    ) {
      window.history.replaceState({}, '', routeByPage.Overview)
      setPathname(routeByPage.Overview)
    }
  }, [pathname])

  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }

    setPathname(path)
  }

  const signIn = async (email: string, password: string) => {
    const result = await api.login(email, password)

    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, result.accessToken)
    sessionStorage.setItem(ROLE_STORAGE_KEY, result.user.role)
    sessionStorage.setItem(EMAIL_STORAGE_KEY, email)

    setSignedIn(true)
    navigate('/admin')
  }

  const signOut = () => {
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(ROLE_STORAGE_KEY)
    sessionStorage.removeItem(EMAIL_STORAGE_KEY)

    setSignedIn(false)
    navigate('/login')
  }

  if (signedIn && pathname.startsWith('/admin')) {
    const role =
      (sessionStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null) ?? 'ADMIN'

    const requestedPage = pageFromPath(pathname)

    const restrictedPage = [
      'Courses',
      'Batches',
      'Sessions',
      'Semesters',
    ].includes(requestedPage)

    const page =
      role !== 'SUPERADMIN' && restrictedPage
        ? 'Overview'
        : requestedPage

    return (
      <DashboardPage
        initialPage={page}
        role={role}
        onNavigate={nextPage => {
          const nextRestricted = [
            'Courses',
            'Batches',
            'Sessions',
            'Semesters',
          ].includes(nextPage)

          if (role === 'SUPERADMIN' || !nextRestricted) {
            navigate(routeByPage[nextPage])
          }
        }}
        onLogout={signOut}
      />
    )
  }

  return <LoginPage onLogin={signIn} />
}

export default App
