import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsMfa, setNeedsMfa] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const signIn = useAuthStore((s) => s.signIn)
  const { appName, logoUrl, load } = useBrandingStore()
  const navigate = useNavigate()

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) {
      setSubmitting(false)
      setError(error)
      return
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setSubmitting(false)
    if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
      setNeedsMfa(true)
      return
    }
    navigate('/', { replace: true })
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const factor = factors?.totp?.[0]
      if (!factor) throw new Error('No 2FA method found on this account')
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challengeErr) throw challengeErr
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: mfaCode })
      if (verifyErr) throw verifyErr
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setSubmitting(false)
    }
  }

  if (needsMfa) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleMfaSubmit} className="glass-panel glow-border w-full max-w-sm p-8 space-y-5">
          <h1 className="text-xl font-bold neon-gradient-text">Two-factor verification</h1>
          <p className="text-sm text-gray-400">Enter the 6-digit code from your authenticator app.</p>
          <input
            required
            autoFocus
            maxLength={6}
            className="input-field w-full text-center text-lg tracking-[0.5em]"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
          />
          {error && <p role="alert" className="text-sm text-magenta bg-magenta/10 border border-magenta/30 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full sm:hidden">
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
          <p className="hidden sm:block text-center text-xs text-gray-500">Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">Enter</kbd> to verify</p>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="glass-panel glow-border w-full max-w-sm p-8 space-y-5">
        <div className="flex items-center gap-2.5">
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
          <h1 className="text-2xl font-bold neon-gradient-text-animated">{appName}</h1>
        </div>
        <p className="text-sm text-gray-400">Sign in to your team vault</p>

        <div className="space-y-2">
          <label htmlFor="email" className="text-xs uppercase tracking-wide text-gray-400">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input-field w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-xs uppercase tracking-wide text-gray-400">Password</label>
          <input id="password" type="password" required autoComplete="current-password" className="input-field w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-cyan hover:underline">Forgot password?</Link>
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-magenta bg-magenta/10 border border-magenta/30 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full sm:hidden">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="hidden sm:block text-center text-xs text-gray-500">
          Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">Enter</kbd> to sign in
        </p>

        <p className="text-sm text-gray-400 text-center">
          No account? <Link to="/signup" className="text-cyan hover:underline">Create one</Link>
        </p>
      </form>
    </div>
  )
}
