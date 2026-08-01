import { type ReactNode, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Clock3 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading, signOut, refreshProfile } = useAuthStore()

  // If we're sitting on the pending screen, listen for our own profile
  // row changing (i.e. an admin approves us) and unlock automatically
  // without needing a manual refresh.
  useEffect(() => {
    if (!user || profile?.approved_at) return
    const channel = supabase
      .channel(`profile-approval-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => {
        refreshProfile()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, profile?.approved_at, refreshProfile])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-cyan/30 border-t-cyan animate-spin" aria-label="Loading" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Profile hasn't loaded yet (separate async fetch from the session) —
  // keep showing the spinner rather than flashing the pending screen.
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-cyan/30 border-t-cyan animate-spin" aria-label="Loading" />
      </div>
    )
  }

  if (!profile.approved_at) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-panel glow-border max-w-sm w-full p-8 text-center space-y-4">
          <Clock3 className="mx-auto text-cyan" size={32} />
          <h1 className="text-lg font-semibold">Waiting on approval</h1>
          <p className="text-sm text-gray-400">
            Your account (<span className="text-gray-300">{user.email}</span>) has been created but an owner or admin still
            needs to approve it before you can get in. This page will unlock automatically once that happens — no need to
            keep refreshing.
          </p>
          <button onClick={() => signOut()} className="text-xs text-gray-500 hover:text-gray-300 underline">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
