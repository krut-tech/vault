import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut, ShieldCheck, ShieldOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import AvatarUpload from '../components/AvatarUpload'
import { listFactors, enrollTotp, verifyEnrollment, unenroll } from '../lib/api/twoFactor'

export default function Settings() {
  const { profile, user, refreshProfile } = useAuthStore()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [revoking, setRevoking] = useState(false)

  const [factors, setFactors] = useState<Array<{ id: string; status: string }>>([])
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [mfaError, setMfaError] = useState<string | null>(null)

  useEffect(() => {
    listFactors().then((f) => setFactors(f as Array<{ id: string; status: string }>))
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setSaved(false)
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleRevokeAll() {
    if (!window.confirm('Sign out of every device where you are currently logged in?')) return
    setRevoking(true)
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } finally {
      setRevoking(false)
    }
  }

  async function handleStartEnroll() {
    setMfaError(null)
    setEnrolling(true)
    try {
      const { factorId, qrCode } = await enrollTotp()
      setPendingFactorId(factorId)
      setQrCode(qrCode)
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Could not start enrollment')
      setEnrolling(false)
    }
  }

  async function handleVerifyEnroll(e: FormEvent) {
    e.preventDefault()
    if (!pendingFactorId) return
    setMfaError(null)
    try {
      await verifyEnrollment(pendingFactorId, verifyCode)
      setEnrolling(false)
      setQrCode(null)
      setPendingFactorId(null)
      setVerifyCode('')
      setFactors(await listFactors() as Array<{ id: string; status: string }>)
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Invalid code, try again')
    }
  }

  async function handleDisable2FA(factorId: string) {
    if (!window.confirm('Disable two-factor authentication?')) return
    await unenroll(factorId)
    setFactors(await listFactors() as Array<{ id: string; status: string }>)
  }

  const verifiedFactor = factors.find((f) => f.status === 'verified')

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-cyan"><ArrowLeft size={18} /></Link>
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      <section className="glass-panel p-6 flex flex-col items-center gap-4">
        <AvatarUpload />
        <form onSubmit={handleSave} className="w-full space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wide text-gray-400">Full name</label>
            <input className="input-field w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wide text-gray-400">Email</label>
            <input className="input-field w-full opacity-60" value={profile?.email ?? ''} disabled />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save changes'}</button>
            {saved && <span className="text-xs text-cyan">Saved</span>}
          </div>
        </form>
      </section>

      <section className="glass-panel p-6">
        <h3 className="font-medium text-sm mb-1 flex items-center gap-1.5">
          {verifiedFactor ? <ShieldCheck size={15} className="text-cyan" /> : <ShieldOff size={15} className="text-gray-500" />}
          Two-factor authentication
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          {verifiedFactor ? 'Enabled — an authenticator code is required at every sign-in.' : 'Add an authenticator app code as a second sign-in factor.'}
        </p>

        {verifiedFactor && (
          <button onClick={() => handleDisable2FA(verifiedFactor.id)} className="text-sm px-4 py-2 rounded-xl border border-magenta/40 text-magenta hover:bg-magenta/10">
            Disable 2FA
          </button>
        )}

        {!verifiedFactor && !enrolling && (
          <button onClick={handleStartEnroll} className="btn-primary text-sm">Set up 2FA</button>
        )}

        {enrolling && qrCode && (
          <div className="space-y-3 mt-2">
            <p className="text-xs text-gray-400">Scan this with Google Authenticator, Authy, or any TOTP app:</p>
            <img src={qrCode} alt="2FA QR code" className="rounded-lg bg-white p-2 w-fit" />
            <form onSubmit={handleVerifyEnroll} className="flex gap-2 max-w-xs">
              <input
                required
                maxLength={6}
                className="input-field flex-1 text-center tracking-[0.3em]"
                placeholder="123456"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              />
              <button type="submit" className="btn-primary text-sm px-4">Verify</button>
            </form>
          </div>
        )}
        {mfaError && <p className="text-sm text-magenta mt-2">{mfaError}</p>}
      </section>

      <section className="glass-panel p-6">
        <h3 className="font-medium text-sm mb-1">Session management</h3>
        <p className="text-xs text-gray-500 mb-4">Sign out everywhere revokes every active session for your account across all devices and browsers.</p>
        <button onClick={handleRevokeAll} disabled={revoking} className="text-sm px-4 py-2 rounded-xl border border-magenta/40 text-magenta hover:bg-magenta/10 flex items-center gap-1.5">
          <LogOut size={14} /> {revoking ? 'Signing out…' : 'Sign out of all devices'}
        </button>
      </section>
    </div>
  )
}
