import { useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'codevault_splash_shown'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fadingOut, setFadingOut] = useState(false)
  const [needsTapForSound, setNeedsTapForSound] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      finish()
      return
    }

    const video = videoRef.current

    // Try to play WITH sound first. Browsers only block this if the user has
    // never interacted with the site before — most returning users will get sound.
    if (video) {
      video.muted = false
      video.play().catch(() => {
        // Browser blocked unmuted autoplay -> fall back to muted, let user tap once to unmute
        setNeedsTapForSound(true)
        video.muted = true
        video.play().catch(() => {})
      })
    }

    // Fallback in case metadata/ended events never fire (e.g. video fails to load)
    timeoutRef.current = setTimeout(finish, 8000)

    function setSafetyTimeoutFromDuration() {
      if (!video || !isFinite(video.duration)) return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      // Give a small buffer after the video's real length so it always finishes playing
      timeoutRef.current = setTimeout(finish, video.duration * 1000 + 300)
    }

    video?.addEventListener('loadedmetadata', setSafetyTimeoutFromDuration)
    video?.addEventListener('ended', finish)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      video?.removeEventListener('loadedmetadata', setSafetyTimeoutFromDuration)
      video?.removeEventListener('ended', finish)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish() {
    setFadingOut(true)
    sessionStorage.setItem(SESSION_KEY, '1')
    setTimeout(onFinish, 500)
  }

  function unmuteNow() {
    const video = videoRef.current
    if (video) {
      video.muted = false
      video.play().catch(() => {})
    }
    setNeedsTapForSound(false)
  }

  return (
    <div
      className={`fixed inset-0 z-[100] bg-void flex items-center justify-center transition-opacity duration-500 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onClick={needsTapForSound ? unmuteNow : undefined}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src="/media/intro.mp4"
        autoPlay
        playsInline
        aria-hidden="true"
      />
      {needsTapForSound && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            unmuteNow()
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-white bg-black/50 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 animate-pulse"
        >
          🔊 Tap for sound
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          finish()
        }}
        className="absolute bottom-8 right-8 text-xs text-gray-400 hover:text-cyan border border-white/10 rounded-full px-3 py-1.5"
      >
        Skip
      </button>
    </div>
  )
}

export function shouldShowSplash() {
  return !sessionStorage.getItem(SESSION_KEY)
}
