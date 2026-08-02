import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    async function verify() {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (!tokenHash || type !== 'recovery') {
        // Fallback: maybe an existing recovery session already exists (e.g. old-style link)
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          setReady(true)
        } else {
          setError('This reset link is invalid or has expired. Please request a new one.')
        }
        setVerifying(false)
        return
      }

      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      setVerifying(false)
      if (error) {
        setError('This reset link is invalid or has expired. Please request a new one.')
        return
      }
      setReady(true)
    }
    verify()
  }, [searchParams])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)
    const { error } = await updatePassword(password)
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
        <h1 className="text-2xl font-bold neon-gradient-text">Set new password</h1>

        {verifying && (
          <p className="text-sm text-gray-400">Verifying your reset link…</p>
        )}

        {!verifying && error && !ready && (
          <p role="alert" className="text-sm text-magenta bg-magenta/10 border border-magenta/30 rounded-lg px-3 py-2">{error}</p>
        )}

        {ready && !done && (
          <>
            <div className="space-y-2">
              <label htmlFor="password" className="text-xs uppercase tracking-wide text-gray-400">New password</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input-field w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-xs uppercase tracking-wide text-gray-400">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input-field w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && <p role="alert" className="text-sm text-magenta bg-magenta/10 border border-magenta/30 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}

        {done && (
          <p role="status" className="text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-3 py-2">
            Password updated — redirecting to login…
          </p>
        )}

        <p className="text-sm text-gray-400 text-center">
          <Link to="/login" className="text-cyan hover:underline">Back to login</Link>
        </p>
      </form>
    </div>
  )
}
