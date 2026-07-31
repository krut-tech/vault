import { useEffect, useRef, useState } from 'react'
import { Search, FolderGit2, Folder as FolderIcon, FileCode2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { globalSearch, type SearchResult } from '../lib/api/search'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'

const ICONS = { project: FolderGit2, folder: FolderIcon, file: FileCode2 }

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const runSearch = useDebouncedCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    const r = await globalSearch(q)
    setResults(r)
    setSearching(false)
  }, 300)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    setOpen(true)
    setSearching(true)
    runSearch(value)
  }

  function goTo(result: SearchResult) {
    setOpen(false)
    setQuery('')
    navigate(`/projects/${result.projectId}`)
  }

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input-field w-full pl-9"
          placeholder="Search projects, folders, files…"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query && setOpen(true)}
        />
      </div>

      {open && query && (
        <div className="absolute mt-2 w-full glass-panel glow-border max-h-80 overflow-y-auto z-50">
          {searching && <p className="p-3 text-xs text-gray-500">Searching…</p>}
          {!searching && results.length === 0 && <p className="p-3 text-xs text-gray-500">No matches.</p>}
          {!searching && results.map((r) => {
            const Icon = ICONS[r.type]
            return (
              <button key={`${r.type}-${r.id}`} onClick={() => goTo(r)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-white/5">
                <Icon size={14} className="text-cyan shrink-0" />
                <span className="truncate flex-1">{r.title}</span>
                <span className="text-xs text-gray-500 shrink-0">{r.subtitle}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
