import { create } from 'zustand'

/**
 * Bridges the global Command Palette (mounted once in App.tsx, has no
 * idea what page it's on) with whichever page actually knows how to
 * do things like "new file" or "run the current file". A page (right
 * now just ProjectView) registers its handlers on mount and clears
 * them on unmount. The palette calls whatever's registered; if
 * nothing is, that command shows as unavailable instead of the palette
 * trying to duplicate the page's own logic.
 */
export interface WorkspaceCommands {
  newFile?: () => void
  newFolder?: () => void
  uploadFiles?: () => void
  uploadFolder?: () => void
  importZip?: () => void
  runCurrentFile?: () => void
  formatCurrentFile?: () => void
  toggleTerminal?: () => void
}

export interface RecentFile {
  id: string
  name: string
  projectId: string
  projectName: string
  openedAt: number
}

const RECENT_FILES_KEY = 'codevault:recent-files'
const RECENT_COMMANDS_KEY = 'codevault:recent-commands'
const MAX_RECENT_FILES = 8
const MAX_RECENT_COMMANDS = 5

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

interface WorkspaceState {
  sidebarVisible: boolean
  terminalVisible: boolean
  commands: WorkspaceCommands
  recentFiles: RecentFile[]
  recentCommandIds: string[]
  toggleSidebar: () => void
  toggleTerminal: () => void
  setTerminalVisible: (visible: boolean) => void
  registerCommands: (commands: WorkspaceCommands) => void
  unregisterCommands: (keys: (keyof WorkspaceCommands)[]) => void
  pushRecentFile: (file: RecentFile) => void
  pushRecentCommand: (id: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  sidebarVisible: true,
  terminalVisible: false,
  commands: {},
  recentFiles: loadJson<RecentFile[]>(RECENT_FILES_KEY, []),
  recentCommandIds: loadJson<string[]>(RECENT_COMMANDS_KEY, []),

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleTerminal: () => set((s) => ({ terminalVisible: !s.terminalVisible })),
  setTerminalVisible: (visible) => set({ terminalVisible: visible }),

  // Merges rather than replaces: separate components (a page and its
  // currently-mounted editor, say) can each register their own slice of
  // commands without clobbering what the other already registered.
  registerCommands: (commands) => set((s) => ({ commands: { ...s.commands, ...commands } })),
  unregisterCommands: (keys) =>
    set((s) => {
      const next = { ...s.commands }
      for (const k of keys) delete next[k]
      return { commands: next }
    }),

  pushRecentFile: (file) => {
    const next = [file, ...get().recentFiles.filter((f) => f.id !== file.id)].slice(0, MAX_RECENT_FILES)
    set({ recentFiles: next })
    try {
      window.localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(next))
    } catch {
      /* localStorage unavailable (private mode etc) — recents just won't persist */
    }
  },

  pushRecentCommand: (id) => {
    const next = [id, ...get().recentCommandIds.filter((c) => c !== id)].slice(0, MAX_RECENT_COMMANDS)
    set({ recentCommandIds: next })
    try {
      window.localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  },
}))
