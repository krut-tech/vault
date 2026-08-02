import { useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'codevault_splash_shown'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fadingOut, setFadingOut] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      finish()
      return
    }

    const video = videoRef.current

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

  return (
    <div
      className={`fixed inset-0 z-[100] bg-void flex items-center justify-center transition-opacity duration-500 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src="/media/intro.mp4"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
      <button
        onClick={finish}
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
