import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// registerType:'autoUpdate' (vite.config.ts) reloads a tab the moment
// a new service worker takes over — but the browser only checks for a
// new SW on navigation/reload by default. A tab left open for a while
// (exactly what happened here: desktop showed an old build with no
// tabs/no Private-projects stat, even though the new one had shipped
// and gone live) never re-checks on its own. This adds an explicit
// hourly check plus one on tab focus, so long-lived open tabs catch
// up without the person needing to know to hard-refresh.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
  },
})
void updateSW

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
