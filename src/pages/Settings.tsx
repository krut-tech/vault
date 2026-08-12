import { useEffect, useState, type FormEvent } from 'react'
import { LogOut, ShieldCheck, ShieldOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import AvatarUpload from '../components/AvatarUpload'
import { listFactors, enrollTotp, verifyEnrollment, unenroll } from '../lib/api/twoFactor'
import { Badge, Button, ConfirmDialog, Input, PageHeader } from '../components/ui'

export default function Settings() {
  const { profile, user, refreshProfile } = useAuthStore()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false)

  const [factors, setFactors] = useState<Array<{ id: string; status: string }>>([])
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [confirmDisable2FA, setConfirmDisable2FA] = useState(false)
  const [disabling2FA, setDisabling2FA] = useState(false)

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

  async function confirmRevokeAll() {
    setRevoking(true)
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } finally {
      setRevoking(false)
      setConfirmSignOutAll(false)
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

  async function confirmDisable(factorId: string) {
    setDisabling2FA(true)
    try {
      await unenroll(factorId)
      setFactors(await listFactors() as Array<{ id: string; status: string }>)
    } finally {
      setDisabling2FA(false)
      setConfirmDisable2FA(false)
    }
  }

  const verifiedFactor = factors.find((f) => f.status === 'verified')

  return (
    <div className="p-3 sm:p-6 max-w-xl mx-auto space-y-6">
      <PageHeader title="Settings" backTo="/" />

      <section className="glass-panel p-4 sm:p-6 flex flex-col items-center gap-4">
        <AvatarUpload />
        <form onSubmit={handleSave} className="w-full space-y-3">
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Email" value={profile?.email ?? ''} disabled hint="Your sign-in email — contact an owner/admin to change it." />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
            {saved && <span className="text-xs text-cyan">Saved</span>}
          </div>
        </form>
      </section>

      <section className="glass-panel p-4 sm:p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-sm flex items-center gap-1.5">
            {verifiedFactor ? <ShieldCheck size={15} className="text-cyan" /> : <ShieldOff size={15} className="text-muted" />}
            Two-factor authentication
          </h3>
          <Badge variant={verifiedFactor ? 'success' : 'default'}>{verifiedFactor ? 'Enabled' : 'Disabled'}</Badge>
        </div>
        <p className="text-xs text-secondary mb-4">
          {verifiedFactor ? 'An authenticator code is required at every sign-in.' : 'Add an authenticator app code as a second sign-in factor.'}
        </p>

        {verifiedFactor && (
          <Button variant="danger" size="sm" onClick={() => setConfirmDisable2FA(true)}>
            Disable 2FA
          </Button>
        )}

        {!verifiedFactor && !enrolling && (
          <Button onClick={handleStartEnroll}>Set up 2FA</Button>
        )}

        {enrolling && qrCode && (
          <div className="space-y-3 mt-2">
            <p className="text-xs text-secondary">Scan this with Google Authenticator, Authy, or any TOTP app:</p>
            <img src={qrCode} alt="2FA QR code" className="rounded-lg bg-white p-2 w-fit" />
            <form onSubmit={handleVerifyEnroll} className="flex gap-2 max-w-xs items-end">
              <div className="flex-1">
                <Input
                  required
                  maxLength={6}
                  className="text-center tracking-[0.3em]"
                  placeholder="123456"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <Button type="submit">Verify</Button>
            </form>
          </div>
        )}
        {mfaError && <p className="text-sm text-danger mt-2">{mfaError}</p>}
      </section>

      <section className="glass-panel p-4 sm:p-6">
        <h3 className="font-medium text-sm mb-1">Session management</h3>
        <p className="text-xs text-secondary mb-4">Sign out everywhere revokes every active session for your account across all devices and browsers.</p>
        <Button variant="danger" size="sm" onClick={() => setConfirmSignOutAll(true)} loading={revoking}>
          <LogOut size={14} /> {revoking ? 'Signing out…' : 'Sign out of all devices'}
        </Button>
      </section>

      <ConfirmDialog
        open={confirmDisable2FA}
        onClose={() => setConfirmDisable2FA(false)}
        onConfirm={() => verifiedFactor && confirmDisable(verifiedFactor.id)}
        title="Disable two-factor authentication?"
        description="Your account will only require your password to sign in."
        confirmLabel="Disable 2FA"
        danger
        loading={disabling2FA}
      />

      <ConfirmDialog
        open={confirmSignOutAll}
        onClose={() => setConfirmSignOutAll(false)}
        onConfirm={confirmRevokeAll}
        title="Sign out of every device?"
        description="This revokes every active session for your account, including this one."
        confirmLabel="Sign out everywhere"
        danger
        loading={revoking}
      />
    </div>
  )
}
