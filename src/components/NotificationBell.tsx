import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listNotifications, markAllRead, markNotificationRead } from '../lib/api/activity'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { supabase } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import type { Database } from '../types/database'

type Notification = Database['public']['Tables']['notifications']['Row']

export default function NotificationBell() {
  const user = useAuthStore((s) => s.user)
  const pushToast = useToastStore((s) => s.push)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    listNotifications(user.id).then(setNotifications).catch((err) => console.error('Failed to load notifications:', err))

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        const n = payload.new as Notification
        setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]))
        pushToast(n.message, { link: n.link })
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Notifications realtime subscription failed:', status, err)
        }
      })

    // Fallback: re-fetch every minute in case the realtime socket drops silently
    // (network hiccups, tab suspension, etc.) so notifications never go stale.
    const pollId = window.setInterval(() => {
      listNotifications(user.id).then(setNotifications).catch((err) => console.error('Failed to refresh notifications:', err))
    }, 60_000)

    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(pollId)
    }
  }, [user])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.length

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative h-11 w-11 rounded-full glass-panel glow-border flex items-center justify-center text-gray-400 hover:text-cyan shadow-lg"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-magenta text-[10px] leading-none rounded-full h-4 w-4 flex items-center justify-center text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 glass-panel glow-border max-h-96 overflow-y-auto z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <span className="text-sm font-medium">Notifications</span>
            {user && unreadCount > 0 && (
              <button onClick={() => markAllRead(user.id).then(() => setNotifications([]))} className="text-xs text-cyan hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 && <p className="p-4 text-xs text-gray-500">No notifications yet.</p>}
          {notifications.map((n) => (
            <Link
              key={n.id}
              to={n.link ?? '#'}
              onClick={() => markNotificationRead(n.id).then(() => setNotifications((p) => p.filter((x) => x.id !== n.id)))}
              className="block px-4 py-2.5 text-sm border-b border-white/5 hover:bg-white/5 text-gray-100"
            >
              <p>{n.message}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
