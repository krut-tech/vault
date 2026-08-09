import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Projects from './pages/Projects'
import ProjectView from './pages/ProjectView'
import RecycleBin from './pages/RecycleBin'
import AdminPanel from './pages/AdminPanel'
import BoardsList from './pages/BoardsList'
import BoardView from './pages/BoardView'
import TimeTracker from './pages/TimeTracker'
import Monitors from './pages/Monitors'
import Settings from './pages/Settings'
import NotesAndTasks from './pages/NotesAndTasks'
import ProtectedRoute from './components/ProtectedRoute'
import SplashScreen, { shouldShowSplash } from './components/SplashScreen'
import NotificationBell from './components/NotificationBell'
import ToastContainer from './components/ToastContainer'
import CommandPalette from './components/CommandPalette'
import AdvancedSearch from './components/AdvancedSearch'
import { useAuthStore } from './store/authStore'

function GlobalShortcuts() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) return
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(false)
        setPaletteOpen((v) => !v)
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setPaletteOpen(false)
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [user])

  if (!user) return null

  return (
    <>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenSearch={() => { setPaletteOpen(false); setSearchOpen(true) }}
      />
      <AdvancedSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  const [showSplash, setShowSplash] = useState(shouldShowSplash)

  useEffect(() => {
    init()
  }, [init])

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />
  }

  return (
    <BrowserRouter>
      {/* Mounted once at the root so notifications are visible on every
          authenticated page, not just the Projects dashboard. Renders
          nothing when logged out (see NotificationBell's own user guard). */}
      <div className="fixed top-4 right-4 z-[60]">
        <NotificationBell />
      </div>
      <ToastContainer />
      <GlobalShortcuts />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><ProjectView /></ProtectedRoute>} />
        <Route path="/recycle-bin" element={<ProtectedRoute><RecycleBin /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
        <Route path="/boards" element={<ProtectedRoute><BoardsList /></ProtectedRoute>} />
        <Route path="/boards/:id" element={<ProtectedRoute><BoardView /></ProtectedRoute>} />
        <Route path="/time" element={<ProtectedRoute><TimeTracker /></ProtectedRoute>} />
        <Route path="/monitors" element={<ProtectedRoute><Monitors /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/notes" element={<ProtectedRoute><NotesAndTasks /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
