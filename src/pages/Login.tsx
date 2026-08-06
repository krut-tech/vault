import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsMfa, setNeedsMfa] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSubmitting, setMfaSubmitting] = useState(false)
  const signIn = useAuthStore((s) => s.signIn)
  const { appName, logoUrl, load } = useBrandingStore()
  const navigate = useNavigate()

  const rootRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const liveRef = useRef<HTMLSpanElement>(null)
  const submitBtnRef = useRef<HTMLButtonElement>(null)
  const submitLabelRef = useRef<HTMLSpanElement>(null)
  const attemptRef = useRef<() => void>(() => {})

  useEffect(() => {
    load()
  }, [load])

  // Vault door animation engine — wired to real Supabase auth instead of a hardcoded check.
  useEffect(() => {
    const root = rootRef.current
    const emailInput = emailRef.current
    const passInput = passRef.current
    const live = liveRef.current
    if (!root || !emailInput || !passInput || !live) return

    const wheelRot = root.querySelector<SVGGElement>('.vdp-wheel-rot')
    if (!wheelRot) return

    const SVG_NS = 'http://www.w3.org/2000/svg'

    function buildTeeth(sel: string, count: number, inner: number, outer: number, w: number) {
      const g = root!.querySelector(sel)
      if (!g) return
      for (let i = 0; i < count; i++) {
        const r = document.createElementNS(SVG_NS, 'rect')
        r.setAttribute('class', 'vdp-tooth')
        r.setAttribute('x', String(-w / 2))
        r.setAttribute('y', String(-outer))
        r.setAttribute('width', String(w))
        r.setAttribute('height', String(outer - inner + 1))
        r.setAttribute('transform', `rotate(${(i * 360) / count})`)
        g.appendChild(r)
      }
    }
    buildTeeth('.vdp-teeth-8', 8, 9, 15, 6)
    buildTeeth('.vdp-teeth-6', 6, 6, 11, 5)
    buildTeeth('.vdp-teeth-5', 5, 4, 8.4, 4)

    let a1 = 0
    let a2 = 22
    let a3 = 8
    let prevLen = 0
    let looseTimer = 0

    function setGears() {
      root!.style.setProperty('--vdp-a1', `${a1}deg`)
      root!.style.setProperty('--vdp-a2', `${a2}deg`)
      root!.style.setProperty('--vdp-a3', `${a3}deg`)
    }

    function onCombinedTyping() {
      const len = emailInput!.value.length + passInput!.value.length
      const steps = len - prevLen
      prevLen = len
      if (!steps) return
      const dir = steps > 0 ? 1 : -1
      const n = Math.min(Math.abs(steps), 4)
      a1 += dir * 45 * n
      a2 -= dir * 60 * n
      a3 += dir * 72 * n
      if (dir < 0) {
        root!.classList.add('g-loose')
        window.clearTimeout(looseTimer)
        looseTimer = window.setTimeout(() => root!.classList.remove('g-loose'), 340)
      }
      setGears()
    }

    emailInput.addEventListener('input', onCombinedTyping)
    passInput.addEventListener('input', onCombinedTyping)

    const onFocus = () => root!.classList.add('is-focus')
    const onBlur = () => root!.classList.remove('is-focus')
    emailInput.addEventListener('focus', onFocus)
    emailInput.addEventListener('blur', onBlur)
    passInput.addEventListener('focus', onFocus)
    passInput.addEventListener('blur', onBlur)

    let busy = false
    let timers: number[] = []
    let rafId = 0
    let gen = 0
    const PHASES = [
      'is-playing', 'p-jam', 'p-b1', 'p-b2', 'p-b3', 'p-granted', 'p-open', 'p-reveal', 'p-close',
      's-shiver1', 's-shiver2', 's-shiver3',
    ]

    function at(t: number, fn: () => void) {
      timers.push(window.setTimeout(fn, t))
    }
    function clearAll() {
      timers.forEach((t) => window.clearTimeout(t))
      timers = []
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }
    function resetClasses() {
      PHASES.forEach((p) => root!.classList.remove(p))
    }
    function prefersReduced() {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    }
    function shiver(n: number) {
      const c = `s-shiver${n}`
      root!.classList.remove(c)
      void root!.offsetWidth
      root!.classList.add(c)
    }

    function spinWheel(myGen: number, from: number, dir: number, done?: () => void) {
      let v = dir * 620
      let angle = from
      let settled = false
      let settleFrom = 0
      let settleT = 0
      let prev = performance.now()
      function frame(now: number) {
        if (myGen !== gen) return
        const dt = Math.min((now - prev) / 1000, 0.05)
        prev = now
        if (!settled) {
          angle += v * dt
          v *= Math.pow(0.135, dt)
          if (Math.abs(v) < 46) {
            settled = true
            settleFrom = angle
            settleT = 0
          }
        } else {
          settleT += dt
          const k = settleT / 0.42
          if (k >= 1) {
            root!.style.setProperty('--vdp-wrot', `${settleFrom - dir * 12}deg`)
            if (done) done()
            return
          }
          const s = Math.exp(-4.2 * k) * Math.cos(9 * k)
          root!.style.setProperty('--vdp-wrot', `${settleFrom - dir * 12 * (1 - s)}deg`)
          rafId = requestAnimationFrame(frame)
          return
        }
        root!.style.setProperty('--vdp-wrot', `${angle}deg`)
        rafId = requestAnimationFrame(frame)
      }
      rafId = requestAnimationFrame(frame)
    }

    async function attempt() {
      if (busy) return
      busy = true
      gen++
      const myGen = gen
      clearAll()
      live!.textContent = ''
      setError(null)

      const emailVal = emailInput!.value
      const passVal = passInput!.value

      const { error: signInError } = await signIn(emailVal, passVal)
      if (myGen !== gen) return

      if (signInError) {
        root!.classList.add('p-jam')
        setError(signInError)
        at(120, () => {
          live!.textContent = signInError
        })
        at(950, () => {
          root!.classList.remove('p-jam')
          busy = false
        })
        return
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (myGen !== gen) return

      if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
        busy = false
        setNeedsMfa(true)
        return
      }

      emailInput!.blur()
      passInput!.blur()

      // Button flips to "Access Granted" with a border-light sweep (starts top-left,
      // travels the full perimeter) before the vault mechanism kicks in.
      if (submitLabelRef.current) submitLabelRef.current.textContent = 'Access Granted'
      submitBtnRef.current?.classList.add('vdp-granted-btn')
      live!.textContent = 'Access granted'

      if (prefersReduced()) {
        root!.classList.add('is-playing', 'p-b1', 'p-b2', 'p-b3', 'p-granted', 'p-open', 'p-reveal')
        at(1400, () => {
          if (myGen !== gen) return
          navigate('/', { replace: true })
        })
        return
      }

      const BORDER_SWEEP_MS = 850

      root!.classList.add('is-playing')
      at(BORDER_SWEEP_MS + 250, () => spinWheel(myGen, 0, 1))
      at(BORDER_SWEEP_MS + 1800, () => {
        root!.classList.add('p-b1')
        shiver(1)
      })
      at(BORDER_SWEEP_MS + 2250, () => {
        root!.classList.add('p-b2')
        shiver(2)
      })
      at(BORDER_SWEEP_MS + 2800, () => {
        root!.classList.add('p-b3')
        shiver(3)
      })
      at(BORDER_SWEEP_MS + 3100, () => {
        root!.classList.add('p-granted')
      })
      at(BORDER_SWEEP_MS + 3300, () => root!.classList.add('p-open'))
      at(BORDER_SWEEP_MS + 4200, () => root!.classList.add('p-reveal'))
      at(BORDER_SWEEP_MS + 5200, () => {
        if (myGen !== gen) return
        navigate('/', { replace: true })
      })
    }

    attemptRef.current = () => {
      void attempt()
    }

    const onEscape = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && busy) {
        gen++
        clearAll()
        resetClasses()
        root!.style.setProperty('--vdp-wrot', '0deg')
        live!.textContent = ''
        submitBtnRef.current?.classList.remove('vdp-granted-btn')
        if (submitLabelRef.current) submitLabelRef.current.textContent = 'Unlock'
        busy = false
      }
    }
    root.addEventListener('keydown', onEscape)

    return () => {
      clearAll()
      window.clearTimeout(looseTimer)
      emailInput.removeEventListener('input', onCombinedTyping)
      passInput.removeEventListener('input', onCombinedTyping)
      emailInput.removeEventListener('focus', onFocus)
      emailInput.removeEventListener('blur', onBlur)
      passInput.removeEventListener('focus', onFocus)
      passInput.removeEventListener('blur', onBlur)
      root.removeEventListener('keydown', onEscape)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signIn, navigate])

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    attemptRef.current()
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMfaSubmitting(true)
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const factor = factors?.totp?.[0]
      if (!factor) throw new Error('No 2FA method found on this account')
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challengeErr) throw challengeErr
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: mfaCode,
      })
      if (verifyErr) throw verifyErr
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setMfaSubmitting(false)
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
          {error && (
            <p role="alert" className="text-sm text-magenta bg-magenta/10 border border-magenta/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button type="submit" disabled={mfaSubmitting} className="btn-primary w-full">
            {mfaSubmitting ? 'Verifying…' : 'Verify'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2.5">
        {logoUrl && <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
        <h1 className="text-2xl font-bold neon-gradient-text-animated">{appName}</h1>
      </div>

      <div className="vdp-root" ref={rootRef}>
        <div className="vdp-scene" aria-hidden="false">
          <div className="vdp-vault">
            <div className="vdp-shadow" aria-hidden="true"></div>
            <div className="vdp-interior" aria-hidden="true">
              <div className="vdp-room"></div>
              <div className="vdp-dashboard">
                <div className="vdp-dash-topbar">
                  <span className="vdp-dash-dot vdp-dash-dot-r"></span>
                  <span className="vdp-dash-dot vdp-dash-dot-y"></span>
                  <span className="vdp-dash-dot vdp-dash-dot-g"></span>
                  <span className="vdp-dash-title">CodeVault</span>
                </div>
                <div className="vdp-dash-body">
                  <div className="vdp-dash-sidebar">
                    <span className="vdp-dash-nav vdp-dash-nav-active"></span>
                    <span className="vdp-dash-nav"></span>
                    <span className="vdp-dash-nav"></span>
                    <span className="vdp-dash-nav"></span>
                  </div>
                  <div className="vdp-dash-main">
                    <div className="vdp-dash-card"></div>
                    <div className="vdp-dash-card"></div>
                    <div className="vdp-dash-row vdp-dash-row-1"></div>
                    <div className="vdp-dash-row vdp-dash-row-2"></div>
                    <div className="vdp-dash-row vdp-dash-row-3"></div>
                  </div>
                </div>
              </div>
              <div className="vdp-barsweep"></div>
              <div className="vdp-glow"></div>
              <span className="vdp-granted">Access granted</span>
            </div>
            <div className="vdp-door">
              <div className="vdp-face">
                <span className="vdp-rivet vdp-rv1"></span>
                <span className="vdp-rivet vdp-rv2"></span>
                <span className="vdp-rivet vdp-rv3"></span>
                <span className="vdp-rivet vdp-rv4"></span>
                <span className="vdp-rivet vdp-rv5"></span>
                <span className="vdp-rivet vdp-rv6"></span>
                <div className="vdp-wheel" aria-hidden="true">
                  <svg viewBox="0 0 96 96" width="96" height="96">
                    <defs>
                      <linearGradient id="vdp-rim" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#5a6472"></stop>
                        <stop offset="0.5" stopColor="#39414d"></stop>
                        <stop offset="1" stopColor="#232932"></stop>
                      </linearGradient>
                      <radialGradient id="vdp-hub" cx="0.38" cy="0.34" r="0.85">
                        <stop offset="0" stopColor="#6a7480"></stop>
                        <stop offset="0.6" stopColor="#3a424d"></stop>
                        <stop offset="1" stopColor="#20252d"></stop>
                      </radialGradient>
                    </defs>
                    <g className="vdp-wheel-rot">
                      <circle cx="48" cy="48" r="30" fill="none" stroke="url(#vdp-rim)" strokeWidth={7}></circle>
                      <g stroke="url(#vdp-rim)" strokeWidth={8} strokeLinecap="round">
                        <line x1="48" y1="48" x2="48" y2="6"></line>
                        <line x1="48" y1="48" x2="84.4" y2="69"></line>
                        <line x1="48" y1="48" x2="11.6" y2="69"></line>
                      </g>
                      <g fill="#525c69">
                        <circle cx="48" cy="6" r="4.6"></circle>
                        <circle cx="84.4" cy="69" r="4.6"></circle>
                        <circle cx="11.6" cy="69" r="4.6"></circle>
                      </g>
                      <circle className="vdp-hubcap" cx="48" cy="48" r="11" fill="url(#vdp-hub)"></circle>
                      <circle cx="48" cy="48" r="3.4" fill="#171b21"></circle>
                    </g>
                  </svg>
                </div>
                <div className="vdp-bolts" aria-hidden="true">
                  <span className="vdp-slot vdp-slot-1">
                    <span className="vdp-bolt"></span>
                  </span>
                  <span className="vdp-slot vdp-slot-2">
                    <span className="vdp-bolt"></span>
                  </span>
                  <span className="vdp-slot vdp-slot-3">
                    <span className="vdp-bolt"></span>
                  </span>
                </div>
                <form className="vdp-form" onSubmit={handleFormSubmit} noValidate>
                  <label className="vdp-label" htmlFor="vdp-email">
                    Email
                  </label>
                  <input
                    ref={emailRef}
                    className="vdp-input"
                    id="vdp-email"
                    name="vault-email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="you@team.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <label className="vdp-label vdp-label-2" htmlFor="vdp-code">
                    Password
                  </label>
                  <input
                    ref={passRef}
                    className="vdp-input"
                    id="vdp-code"
                    name="vault-code"
                    type="password"
                    autoComplete="current-password"
                    spellCheck={false}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div className="vdp-underline"></div>
                  <div className="vdp-gearbox" aria-hidden="true">
                    <svg viewBox="0 0 92 34" width="92" height="34">
                      <g className="vdp-g vdp-g1">
                        <g className="vdp-teeth-8"></g>
                        <circle cx="0" cy="0" r="10.5" fill="#333b46"></circle>
                        <circle cx="0" cy="0" r="3.2" fill="#1a1f26"></circle>
                      </g>
                      <g className="vdp-g vdp-g2">
                        <g className="vdp-teeth-6"></g>
                        <circle cx="0" cy="0" r="7.4" fill="#3a424e"></circle>
                        <circle cx="0" cy="0" r="2.6" fill="#1a1f26"></circle>
                      </g>
                      <g className="vdp-g vdp-g3">
                        <g className="vdp-teeth-5"></g>
                        <circle cx="0" cy="0" r="5" fill="#424a56"></circle>
                        <circle cx="0" cy="0" r="2" fill="#1a1f26"></circle>
                      </g>
                    </svg>
                  </div>
                  <button className="vdp-submit" type="submit" ref={submitBtnRef}>
                    <span className="vdp-submit-label" ref={submitLabelRef}>Unlock</span>
                    <svg className="vdp-submit-ring" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                      <rect x="1" y="1" width="98" height="38" rx="9" ry="9" />
                    </svg>
                  </button>
                </form>
              </div>
              <div className="vdp-edge"></div>
            </div>
          </div>
        </div>
        <span className="vdp-live" aria-live="polite" ref={liveRef}></span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-magenta bg-magenta/10 border border-magenta/30 rounded-lg px-3 py-2 max-w-sm text-center">
          {error}
        </p>
      )}

      <div className="text-sm text-gray-400 flex flex-col items-center gap-1">
        <Link to="/forgot-password" className="text-cyan hover:underline">
          Forgot password?
        </Link>
        <p>
          No account?{' '}
          <Link to="/signup" className="text-cyan hover:underline">
            Create one
          </Link>
        </p>
      </div>

      <style>{`
        .vdp-root {
          --vdp-steel-hi: #4c5563;
          --vdp-steel: #2b323d;
          --vdp-steel-lo: #171c23;
          --vdp-line: rgba(210, 226, 246, 0.1);
          --vdp-amber: #e8a33d;
          --vdp-amber-soft: rgba(232, 163, 61, 0.55);
          --vdp-err: #e05252;
          position: relative;
          padding: 20px 26px 34px;
          -webkit-font-smoothing: antialiased;
          user-select: none;
        }

        .vdp-live {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          border: 0;
        }

        .vdp-scene {
          position: relative;
          width: 316px;
          height: 216px;
          perspective: 1000px;
        }

        .vdp-vault {
          position: absolute;
          inset: 0;
          border-radius: 26px;
          background: linear-gradient(160deg, #333b47 0%, #232a34 42%, #2b323d 68%, #14181f 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.09),
            inset 0 -2px 6px rgba(0, 0, 0, 0.5),
            0 22px 44px rgba(2, 4, 8, 0.55);
        }

        .vdp-shadow {
          position: absolute;
          left: 50%;
          bottom: -22px;
          width: 270px;
          height: 18px;
          margin-left: -135px;
          border-radius: 50%;
          background: radial-gradient(50% 50% at 50% 50%, rgba(2, 4, 8, 0.5), rgba(2, 4, 8, 0) 72%);
        }

        .vdp-interior {
          position: absolute;
          inset: 10px;
          border-radius: 18px;
          overflow: hidden;
          background: linear-gradient(180deg, #191412 0%, #0e0b09 70%);
          box-shadow: inset 0 0 26px rgba(0, 0, 0, 0.85);
        }

        .vdp-room {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0) 42%),
            repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.016) 0 1px, rgba(0, 0, 0, 0) 1px 22px);
        }

        .vdp-dashboard {
          position: absolute;
          right: 18px;
          bottom: 14px;
          width: 184px;
          height: 118px;
          border-radius: 10px;
          overflow: hidden;
          background: linear-gradient(160deg, rgba(20, 14, 36, 0.94) 0%, rgba(10, 9, 20, 0.97) 100%);
          border: 1px solid rgba(124, 214, 255, 0.25);
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.4),
            0 10px 26px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          filter: brightness(0.26);
          transition: filter 1s cubic-bezier(0.3, 0.6, 0.3, 1) 0.25s;
        }

        .vdp-dash-topbar {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 16px;
          padding: 0 7px;
          background: linear-gradient(90deg, rgba(34, 211, 238, 0.18), rgba(167, 90, 255, 0.18));
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .vdp-dash-dot { width: 4px; height: 4px; border-radius: 50%; }
        .vdp-dash-dot-r { background: #ff6767; }
        .vdp-dash-dot-y { background: #ffcf5c; }
        .vdp-dash-dot-g { background: #59e07a; }
        .vdp-dash-title {
          margin-left: 4px;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.05em;
          background: linear-gradient(90deg, #7cd6ff, #c084fc);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .vdp-dash-body {
          display: flex;
          height: calc(100% - 16px);
        }

        .vdp-dash-sidebar {
          width: 28px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: center;
          padding-top: 8px;
          background: rgba(255, 255, 255, 0.03);
          border-right: 1px solid rgba(255, 255, 255, 0.05);
        }
        .vdp-dash-nav {
          width: 14px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.12);
        }
        .vdp-dash-nav-active {
          background: linear-gradient(90deg, #22d3ee, #a75aff);
          box-shadow: 0 0 6px rgba(124, 214, 255, 0.6);
        }

        .vdp-dash-main {
          flex: 1;
          padding: 7px 8px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .vdp-dash-card {
          height: 20px;
          border-radius: 5px;
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.16), rgba(167, 90, 255, 0.12));
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .vdp-dash-row {
          height: 7px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.08);
        }
        .vdp-dash-row-1 { width: 100%; }
        .vdp-dash-row-2 { width: 80%; }
        .vdp-dash-row-3 { width: 55%; }

        .vdp-barsweep {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 220px;
          height: 130px;
          background: linear-gradient(115deg, rgba(255, 244, 214, 0) 34%, rgba(255, 244, 214, 0.5) 50%, rgba(255, 244, 214, 0) 66%);
          mix-blend-mode: screen;
          transform: translateX(-170px);
          opacity: 0;
        }

        .vdp-glow {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(130% 120% at 82% 50%, rgba(238, 178, 82, 0.5) 0%, rgba(238, 178, 82, 0.14) 42%, rgba(238, 178, 82, 0) 68%);
          opacity: 0;
          transition: opacity 0.9s cubic-bezier(0.3, 0.6, 0.3, 1);
        }

        .vdp-granted {
          position: absolute;
          right: 22px;
          top: 20px;
          padding: 7px 12px;
          border-radius: 10px;
          border: 1px solid rgba(238, 190, 110, 0.4);
          background: rgba(24, 16, 6, 0.72);
          color: #f2cf8d;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.16, 0.84, 0.3, 1);
        }

        .vdp-door {
          position: absolute;
          inset: 10px;
          transform-style: preserve-3d;
          transform-origin: 0% 50%;
          transform: rotateY(0.001deg);
          transition: transform 1.15s cubic-bezier(0.52, 0.02, 0.26, 1);
          z-index: 2;
        }

        .vdp-face {
          position: absolute;
          inset: 0;
          border-radius: 18px;
          overflow: hidden;
          background:
            repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.02) 0 1px, rgba(0, 0, 0, 0) 1px 3px),
            radial-gradient(120% 90% at 30% 12%, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0) 46%),
            linear-gradient(160deg, var(--vdp-steel-hi) 0%, var(--vdp-steel) 40%, #242b35 72%, var(--vdp-steel-lo) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            inset 0 0 0 1px rgba(0, 0, 0, 0.35),
            inset -10px 0 18px rgba(0, 0, 0, 0.28);
          backface-visibility: hidden;
        }

        .vdp-edge {
          position: absolute;
          top: 2px;
          bottom: 2px;
          right: 0;
          width: 17px;
          transform-origin: 100% 50%;
          transform: rotateY(90deg);
          background: linear-gradient(180deg, #39414c 0%, #21262e 55%, #14181e 100%);
          box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.55);
          border-radius: 2px;
        }

        .vdp-rivet {
          position: absolute;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #5d6675, #2a313b 62%, #171c22);
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.55), inset 0 -1px 1px rgba(0, 0, 0, 0.4);
        }
        .vdp-rv1 { left: 12px; top: 12px; }
        .vdp-rv2 { left: 12px; bottom: 12px; }
        .vdp-rv3 { right: 30px; top: 12px; }
        .vdp-rv4 { right: 30px; bottom: 12px; }
        .vdp-rv5 { left: 12px; top: 50%; margin-top: -5px; }
        .vdp-rv6 { right: 30px; top: 50%; margin-top: -5px; }

        .vdp-wheel {
          position: absolute;
          right: 34px;
          top: 50%;
          width: 96px;
          height: 96px;
          margin-top: -48px;
          filter: drop-shadow(0 5px 7px rgba(0, 0, 0, 0.45));
        }

        .vdp-wheel-rot {
          transform-origin: 48px 48px;
          transform: rotate(var(--vdp-wrot, 0deg));
        }

        .vdp-root.p-jam .vdp-wheel-rot {
          animation: vdp-jam 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        @keyframes vdp-jam {
          0%   { transform: rotate(0deg); }
          22%  { transform: rotate(84deg); }
          34%  { transform: rotate(78deg); }
          58%  { transform: rotate(6deg); }
          70%  { transform: rotate(14deg); }
          82%  { transform: rotate(-3deg); }
          100% { transform: rotate(0deg); }
        }
        .vdp-root.p-jam .vdp-hubcap {
          animation: vdp-hubflick 0.82s steps(1);
        }
        @keyframes vdp-hubflick {
          0%, 100% { fill: url(#vdp-hub); }
          24% { fill: #7a3f3f; }
          30% { fill: url(#vdp-hub); }
          40% { fill: #6e3939; }
          48% { fill: url(#vdp-hub); }
        }

        .vdp-bolts {
          position: absolute;
          right: 6px;
          top: 50%;
          width: 20px;
          height: 150px;
          margin-top: -75px;
        }

        .vdp-slot {
          position: absolute;
          right: 0;
          width: 20px;
          height: 14px;
          border-radius: 4px;
          background: linear-gradient(180deg, #14181e, #1f242c);
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.7);
        }
        .vdp-slot-1 { top: 6px; }
        .vdp-slot-2 { top: 68px; }
        .vdp-slot-3 { top: 130px; }

        .vdp-bolt {
          position: absolute;
          left: -8px;
          top: 2px;
          width: 34px;
          height: 10px;
          border-radius: 5px;
          background: linear-gradient(180deg, #626c7a 0%, #3d454f 48%, #262c34 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.28),
            0 1px 2px rgba(0, 0, 0, 0.6);
          transform: translateX(12px);
          transition: transform 0.24s cubic-bezier(0.5, 0.05, 0.3, 1.25);
        }
        .vdp-bolt::after {
          content: "";
          position: absolute;
          right: 7px;
          top: 2px;
          bottom: 2px;
          width: 2px;
          border-radius: 1px;
          background: rgba(0, 0, 0, 0.35);
        }

        .vdp-root.p-b1 .vdp-slot-1 .vdp-bolt,
        .vdp-root.p-b2 .vdp-slot-2 .vdp-bolt,
        .vdp-root.p-b3 .vdp-slot-3 .vdp-bolt {
          transform: translateX(-21px);
        }

        .vdp-root.p-b1 .vdp-slot-1 .vdp-bolt { animation: vdp-boltflash 0.3s ease; }
        .vdp-root.p-b2 .vdp-slot-2 .vdp-bolt { animation: vdp-boltflash 0.3s ease; }
        .vdp-root.p-b3 .vdp-slot-3 .vdp-bolt { animation: vdp-boltflash 0.3s ease; }
        @keyframes vdp-boltflash {
          0% { filter: brightness(1); }
          30% { filter: brightness(1.9); }
          100% { filter: brightness(1); }
        }

        .vdp-root.s-shiver1 .vdp-vault { animation: vdp-shiver1 0.26s ease; }
        .vdp-root.s-shiver2 .vdp-vault { animation: vdp-shiver2 0.3s ease; }
        .vdp-root.s-shiver3 .vdp-vault { animation: vdp-shiver3 0.44s cubic-bezier(0.3, 0.9, 0.4, 1.4); }
        @keyframes vdp-shiver1 {
          0%, 100% { transform: translateX(0); }
          35% { transform: translateX(-1px); }
          70% { transform: translateX(0.6px); }
        }
        @keyframes vdp-shiver2 {
          0%, 100% { transform: translateX(0); }
          30% { transform: translateX(-2px) rotate(-0.12deg); }
          62% { transform: translateX(1.2px); }
        }
        @keyframes vdp-shiver3 {
          0%, 100% { transform: translate(0, 0); }
          24% { transform: translate(-3px, 0) rotate(-0.2deg); }
          48% { transform: translate(1.8px, 1.4px); }
          74% { transform: translate(-0.6px, 2px); }
          88% { transform: translate(0, 1.2px); }
        }

        .vdp-root.p-granted .vdp-granted { opacity: 1; transform: translateY(0); }

        .vdp-root.p-open .vdp-door { transform: rotateY(-62deg); }
        .vdp-root.p-open .vdp-glow { opacity: 1; }
        .vdp-root.p-open .vdp-dashboard { filter: brightness(1); }

        .vdp-root.p-reveal .vdp-barsweep {
          animation: vdp-sweep 1.5s cubic-bezier(0.4, 0.1, 0.3, 1) forwards;
        }
        @keyframes vdp-sweep {
          0% { transform: translateX(-150px); opacity: 0; }
          18% { opacity: 1; }
          82% { opacity: 1; }
          100% { transform: translateX(150px); opacity: 0; }
        }

        .vdp-root.p-close .vdp-door {
          transform: rotateY(0.001deg);
          transition: transform 0.92s cubic-bezier(0.62, 0.02, 0.34, 1);
        }
        .vdp-root.p-close .vdp-glow { opacity: 0; transition: opacity 0.55s ease 0.3s; }
        .vdp-root.p-close .vdp-dashboard { filter: brightness(0.26); transition: filter 0.5s ease; }
        .vdp-root.p-close .vdp-granted { opacity: 0; transform: translateY(8px); transition: opacity 0.3s ease; }

        .vdp-form {
          position: absolute;
          left: 26px;
          top: 16px;
          width: 138px;
        }

        .vdp-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8b96a5;
        }

        .vdp-label-2 {
          margin-top: 4px;
        }

        .vdp-input {
          display: block;
          width: 100%;
          margin-top: 4px;
          padding: 3px 2px 4px;
          border: 0;
          background: transparent;
          color: #e6ebf2;
          font-size: 16px;
          letter-spacing: 0.14em;
          font-family: inherit;
          caret-color: var(--vdp-amber);
          outline: none;
        }
        .vdp-input::placeholder { color: rgba(230, 235, 242, 0.32); letter-spacing: 0.14em; }
        .vdp-input:-webkit-autofill,
        .vdp-input:-webkit-autofill:hover,
        .vdp-input:-webkit-autofill:focus,
        .vdp-input:-webkit-autofill:active {
          transition: background-color 100000s ease-in-out 0s;
          -webkit-text-fill-color: #e6ebf2;
          caret-color: var(--vdp-amber);
        }

        .vdp-underline {
          height: 2px;
          border-radius: 1px;
          background: rgba(210, 226, 246, 0.14);
          position: relative;
          overflow: hidden;
          margin-top: 2px;
        }
        .vdp-underline::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 1px;
          background: var(--vdp-amber);
          box-shadow: 0 0 8px var(--vdp-amber-soft);
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
        }
        .vdp-root.is-focus .vdp-underline::after { transform: scaleX(1); }
        .vdp-root.p-jam .vdp-underline::after { background: var(--vdp-err); box-shadow: 0 0 8px rgba(224, 82, 82, 0.5); transform: scaleX(1); }

        .vdp-root.p-jam .vdp-form { animation: vdp-formshake 0.2s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
        @keyframes vdp-formshake {
          0%, 100% { transform: translateX(0); }
          30% { transform: translateX(-4px); }
          65% { transform: translateX(3px); }
        }

        .vdp-gearbox {
          margin-top: 4px;
          width: 100px;
          height: 38px;
          padding: 2px;
          border-radius: 9px;
          background: linear-gradient(180deg, #141920, #1b212a);
          box-shadow:
            inset 0 2px 5px rgba(0, 0, 0, 0.65),
            inset 0 -1px 0 rgba(255, 255, 255, 0.05);
        }
        .vdp-gearbox svg { display: block; }

        .vdp-g {
          transition: transform 0.3s cubic-bezier(0.3, 1.9, 0.45, 1);
        }
        .vdp-g1 { transform: translate(18px, 17px) rotate(var(--vdp-a1, 0deg)); }
        .vdp-g2 { transform: translate(44px, 17px) rotate(var(--vdp-a2, 22deg)); }
        .vdp-g3 { transform: translate(64px, 17px) rotate(var(--vdp-a3, 8deg)); }

        .vdp-root.g-loose .vdp-g { transition-timing-function: cubic-bezier(0.2, 2.6, 0.4, 0.9); }

        .vdp-tooth { fill: #434c59; }

        .vdp-submit {
          position: relative;
          display: block;
          margin: 6px auto 0;
          padding: 5px 16px 6px;
          border: 1px solid rgba(210, 226, 246, 0.14);
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(233, 239, 247, 0.07), rgba(233, 239, 247, 0.02));
          color: #cfd7e2;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          letter-spacing: 0.04em;
          text-align: center;
          cursor: pointer;
          overflow: visible;
          transition: background 0.2s ease, transform 0.16s cubic-bezier(0.25, 0.1, 0.25, 1), border-color 0.2s ease, color 0.3s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .vdp-submit:hover { background: linear-gradient(180deg, rgba(233, 239, 247, 0.11), rgba(233, 239, 247, 0.04)); border-color: rgba(210, 226, 246, 0.24); }
        .vdp-submit:active { transform: translateY(1px) scale(0.97); }
        .vdp-submit:focus { outline: none; }
        .vdp-submit:focus-visible { outline: 2px solid var(--vdp-amber); outline-offset: 3px; }
        .vdp-input:focus-visible { outline: none; }

        .vdp-submit-label { position: relative; z-index: 1; white-space: nowrap; }

        .vdp-submit-ring {
          position: absolute;
          inset: -4px;
          width: calc(100% + 8px);
          height: calc(100% + 8px);
          pointer-events: none;
        }
        .vdp-submit-ring rect {
          fill: none;
          stroke: var(--vdp-amber);
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-dasharray: 260;
          stroke-dashoffset: 260;
          opacity: 0;
          filter: drop-shadow(0 0 3px var(--vdp-amber-soft)) drop-shadow(0 0 7px var(--vdp-amber-soft));
        }

        .vdp-submit.vdp-granted-btn {
          color: var(--vdp-amber);
          border-color: rgba(232, 163, 61, 0.55);
          background: linear-gradient(180deg, rgba(232, 163, 61, 0.16), rgba(232, 163, 61, 0.05));
        }
        .vdp-submit.vdp-granted-btn .vdp-submit-ring rect {
          animation: vdp-ring-sweep 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes vdp-ring-sweep {
          0% { stroke-dashoffset: 260; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }

        .vdp-root.is-playing .vdp-submit { pointer-events: none; opacity: 0.55; }
        .vdp-root.is-playing .vdp-submit.vdp-granted-btn { opacity: 1; }
        .vdp-root.is-playing .vdp-input { pointer-events: none; }

        .vdp-vault { transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); }
        .vdp-root:not(.is-playing):hover .vdp-vault { transform: translateY(-1px); }

        @media (prefers-reduced-motion: reduce) {
          .vdp-door, .vdp-glow, .vdp-bars, .vdp-bolt, .vdp-g, .vdp-granted { transition: none !important; animation: none !important; }
          .vdp-root .vdp-vault { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
