import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderGit2,
  FilePlus2,
  FolderPlus,
  Upload,
  FolderUp,
  FileArchive,
  Search as SearchIcon,
  Play,
  WandSparkles,
  PanelLeft,
  TerminalSquare,
  MonitorPlay,
  Settings as SettingsIcon,
  LogOut,
  FileCode2,
  Clock,
} from 'lucide-react'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'

interface Command {
  id: string
  label: string
  group: 'Recent' | 'Navigate' | 'Workspace' | 'Editor' | 'View' | 'Account'
  icon: typeof FolderGit2
  keywords?: string
  shortcut?: string
  disabledReason?: string
  run: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  onOpenSearch: () => void
}

export default function CommandPalette({ open, onClose, onOpenSearch }: Props) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const signOut = useAuthStore((s) => s.signOut)
  const pushToast = useToastStore((s) => s.push)
  const commands = useWorkspaceStore((s) => s.commands)
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar)
  const toggleTerminal = useWorkspaceStore((s) => s.toggleTerminal)
  const recentFiles = useWorkspaceStore((s) => s.recentFiles)
  const recentCommandIds = useWorkspaceStore((s) => s.recentCommandIds)
  const pushRecentCommand = useWorkspaceStore((s) => s.pushRecentCommand)

  const inWorkspace = 'newFile' in commands

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      // Wait a frame so the dialog is actually painted before focusing.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  function run(cmd: Command) {
    if (cmd.disabledReason) return
    pushRecentCommand(cmd.id)
    onClose()
    cmd.run()
  }

  const allCommands = useMemo<Command[]>(() => {
    const notInWorkspace = inWorkspace ? undefined : 'Open a project first'
    const list: Command[] = [
      {
        id: 'new-project',
        label: 'New Project',
        group: 'Navigate',
        icon: FolderGit2,
        run: () => navigate('/?new=1'),
      },
      {
        id: 'new-file',
        label: 'New File',
        group: 'Workspace',
        icon: FilePlus2,
        disabledReason: notInWorkspace,
        run: () => commands.newFile?.(),
      },
      {
        id: 'new-folder',
        label: 'New Folder',
        group: 'Workspace',
        icon: FolderPlus,
        disabledReason: notInWorkspace,
        run: () => commands.newFolder?.(),
      },
      {
        id: 'upload-file',
        label: 'Upload File',
        group: 'Workspace',
        icon: Upload,
        disabledReason: notInWorkspace,
        run: () => commands.uploadFiles?.(),
      },
      {
        id: 'upload-folder',
        label: 'Upload Folder',
        group: 'Workspace',
        icon: FolderUp,
        disabledReason: notInWorkspace,
        run: () => commands.uploadFolder?.(),
      },
      {
        id: 'import-zip',
        label: 'Import ZIP',
        group: 'Workspace',
        icon: FileArchive,
        disabledReason: notInWorkspace,
        run: () => commands.importZip?.(),
      },
      {
        id: 'search',
        label: 'Search',
        group: 'Navigate',
        icon: SearchIcon,
        keywords: 'find content files projects',
        shortcut: 'Ctrl Shift F',
        run: () => onOpenSearch(),
      },
      {
        id: 'run-code',
        label: 'Run Code',
        group: 'Editor',
        icon: Play,
        disabledReason: commands.runCurrentFile ? undefined : 'Open a runnable file first',
        run: () => commands.runCurrentFile?.(),
      },
      {
        id: 'format-code',
        label: 'Format Code',
        group: 'Editor',
        icon: WandSparkles,
        disabledReason: commands.formatCurrentFile ? undefined : 'Open a file first',
        run: () => commands.formatCurrentFile?.(),
      },
      {
        id: 'toggle-sidebar',
        label: 'Toggle Sidebar',
        group: 'View',
        icon: PanelLeft,
        disabledReason: notInWorkspace,
        run: () => toggleSidebar(),
      },
      {
        id: 'toggle-terminal',
        label: 'Toggle Terminal',
        group: 'View',
        icon: TerminalSquare,
        disabledReason: commands.toggleTerminal ? undefined : (notInWorkspace ?? 'Open a runnable file first'),
        run: () => { commands.toggleTerminal?.(); toggleTerminal() },
      },
      {
        id: 'toggle-preview',
        label: 'Toggle Preview',
        group: 'View',
        icon: MonitorPlay,
        disabledReason: 'Live preview is coming in a future update',
        run: () => {},
      },
      {
        id: 'open-settings',
        label: 'Open Settings',
        group: 'Account',
        icon: SettingsIcon,
        run: () => navigate('/settings'),
      },
      {
        id: 'logout',
        label: 'Logout',
        group: 'Account',
        icon: LogOut,
        run: () => { void signOut(); navigate('/login') },
      },
    ]

    for (const rf of recentFiles) {
      list.unshift({
        id: `recent-file-${rf.id}`,
        label: rf.name,
        group: 'Recent',
        icon: FileCode2,
        keywords: rf.projectName,
        run: () => navigate(`/projects/${rf.projectId}?file=${rf.id}`),
      })
    }
    return list
  }, [commands, inWorkspace, navigate, onOpenSearch, recentFiles, signOut, toggleSidebar, toggleTerminal])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Empty query: show recently-used commands first (if any), then everything else.
      const recentSet = new Set(recentCommandIds)
      const recent = recentCommandIds.map((id) => allCommands.find((c) => c.id === id)).filter((c): c is Command => !!c)
      const rest = allCommands.filter((c) => !recentSet.has(c.id))
      return [...recent, ...rest]
    }
    return allCommands.filter((c) => `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q))
  }, [allCommands, query, recentCommandIds])

  useEffect(() => setActiveIndex(0), [filtered.length, query])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[activeIndex]
      if (cmd) {
        if (cmd.disabledReason) {
          pushToast(cmd.disabledReason, { type: 'info' })
          return
        }
        run(cmd)
      }
    }
  }

  if (!open) return null

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] px-3" role="presentation">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg glass-panel glow-border overflow-hidden flex flex-col max-h-[70vh]"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 shrink-0">
          <SearchIcon size={16} className="text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            aria-label="Type a command or search"
            className="flex-1 min-w-0 bg-transparent focus:outline-none text-sm placeholder:text-gray-600"
          />
          <kbd className="hidden sm:inline text-[10px] text-gray-600 border border-white/10 rounded px-1.5 py-0.5 shrink-0">Esc</kbd>
        </div>

        <div ref={listRef} className="overflow-y-auto py-1.5">
          {filtered.length === 0 && <p className="px-4 py-6 text-center text-xs text-gray-500">No matching commands.</p>}
          {filtered.map((cmd, index) => {
            const showGroupHeader = cmd.group !== lastGroup
            lastGroup = cmd.group
            const Icon = cmd.icon
            const active = index === activeIndex
            return (
              <div key={cmd.id}>
                {showGroupHeader && (
                  <p className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-wide text-gray-600">{cmd.group}</p>
                )}
                <button
                  data-index={index}
                  type="button"
                  onClick={() => (cmd.disabledReason ? pushToast(cmd.disabledReason, { type: 'info' }) : run(cmd))}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors ${
                    cmd.disabledReason ? 'opacity-40 cursor-not-allowed' : active ? 'bg-cyan/10 text-cyan' : 'text-gray-300 hover:bg-white/5'
                  }`}
                  title={cmd.disabledReason}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="truncate flex-1">{cmd.label}</span>
                  {cmd.shortcut && <span className="text-[10px] text-gray-600 shrink-0">{cmd.shortcut}</span>}
                  {cmd.group === 'Recent' && !cmd.id.startsWith('recent-file-') && <Clock size={12} className="text-gray-600 shrink-0" />}
                </button>
              </div>
            )
          })}
        </div>

        <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-t border-white/10 text-[10px] text-gray-600 shrink-0">
          <span><kbd className="border border-white/10 rounded px-1 py-0.5">↑↓</kbd> Navigate</span>
          <span><kbd className="border border-white/10 rounded px-1 py-0.5">Enter</kbd> Select</span>
          <span><kbd className="border border-white/10 rounded px-1 py-0.5">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
