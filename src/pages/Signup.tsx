import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const signUp = useAuthStore((s) => s.signUp)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signUp(email, password, fullName)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 1800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="glass-panel glow-border w-full max-w-sm p-8 space-y-5">
        <h1 className="text-2xl font-bold neon-gradient-text">Create account</h1>

        <div className="space-y-2">
          <label htmlFor="fullName" className="text-xs uppercase tracking-wide text-gray-400">Full name</label>
          <input id="fullName" required className="input-field w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="text-xs uppercase tracking-wide text-gray-400">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input-field w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-xs uppercase tracking-wide text-gray-400">Password</label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password" className="input-field w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p role="alert" className="text-sm text-magenta bg-magenta/10 border border-magenta/30 rounded-lg px-3 py-2">{error}</p>}
        {done && <p role="status" className="text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-3 py-2">Account created — redirecting to login…</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Creating…' : 'Create account'}
        </button>

        <p className="text-sm text-gray-400 text-center">
          Already have an account? <Link to="/login" className="text-cyan hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
