import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Button, Input } from '../components/ui'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const resetPasswordForEmail = useAuthStore((s) => s.resetPasswordForEmail)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await resetPasswordForEmail(email)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="glass-panel glow-border w-full max-w-sm p-8 space-y-5">
        <h1 className="text-2xl font-bold neon-gradient-text">Reset password</h1>
        <p className="text-sm text-gray-400">Enter your email and we'll send you a link to reset your password.</p>

        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={done}
        />

        {error && <p role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</p>}
        {done && (
          <p role="status" className="text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-3 py-2">
            If an account exists for that email, a reset link has been sent. Check your inbox.
          </p>
        )}

        {!done && (
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        )}

        <p className="text-sm text-gray-400 text-center">
          Remembered your password? <Link to="/login" className="text-cyan hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
