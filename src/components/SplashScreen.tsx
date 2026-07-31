import { useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'codevault_splash_shown'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      finish()
      return
    }

    const timeout = setTimeout(finish, 4200) // safety cap even if video is slow to end
    const video = videoRef.current
    video?.addEventListener('ended', finish)
    return () => {
      clearTimeout(timeout)
      video?.removeEventListener('ended', finish)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish() {
    setFadingOut(true)
    sessionStorage.setItem(SESSION_KEY, '1')
    setTimeout(onFinish, 500)
  }

  return (
    <div
      className={`fixed inset-0 z-[100] bg-void flex items-center justify-center transition-opacity duration-500 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover opacity-70"
        src="/media/intro.mp4"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-void/40" />
      <div className="relative flex flex-col items-center gap-4">
        <h1 className="text-3xl font-bold neon-gradient-text tracking-wide">CodeVault</h1>
        <div className="h-1 w-40 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan to-violet animate-[loadbar_2.8s_ease-in-out_forwards]" />
        </div>
      </div>
      <button
        onClick={finish}
        className="absolute bottom-8 right-8 text-xs text-gray-400 hover:text-cyan border border-white/10 rounded-full px-3 py-1.5"
      >
        Skip
      </button>
      <style>{`
        @keyframes loadbar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  )
}

export function shouldShowSplash() {
  return !sessionStorage.getItem(SESSION_KEY)
}
