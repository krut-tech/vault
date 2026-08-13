import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FolderGit2, Folder as FolderIcon, FileCode2, Star, X, Clock } from 'lucide-react'
import { searchFileContents, searchProjectsAndFolders, type FileSearchHit, type ProjectOrFolderHit } from '../lib/api/search'
import { listProjects } from '../lib/api/projects'
import { listAllTags } from '../lib/api/tags'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import { LANGUAGES } from '../types/vault'
import type { Project } from '../types/vault'

interface Tag {
  id: string
  name: string
}

type Hit = (FileSearchHit & { key: string }) | (ProjectOrFolderHit & { key: string })

const RECENT_SEARCHES_KEY = 'codevault:recent-searches'
const MAX_RECENT_SEARCHES = 6

interface Props {
  open: boolean
  onClose: () => void
}

export default function AdvancedSearch({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [projectId, setProjectId] = useState('')
  const [language, setLanguage] = useState('')
  const [tagId, setTagId] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [fileHits, setFileHits] = useState<FileSearchHit[]>([])
  const [nameHits, setNameHits] = useState<ProjectOrFolderHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    setQuery('')
    setFileHits([])
    setNameHits([])
    setActiveIndex(0)
    Promise.all([listProjects(), listAllTags()])
      .then(([p, t]) => {
        setProjects(p)
        setTags(t)
      })
      .catch(() => {})
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  function saveRecentSearch(q: string) {
    if (!q.trim()) return
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((r) => r !== q)].slice(0, MAX_RECENT_SEARCHES)
      try {
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const runSearch = useDebouncedCallback(async (q: string) => {
    if (!q.trim()) {
      setFileHits([])
      setNameHits([])
      setSearchError(null)
      setSearching(false)
      return
    }
    const filters = { projectId: projectId || null, language: language || null, tagId: tagId || null, favoritesOnly }
    setSearchError(null)
    try {
      const [files, names] = await Promise.all([searchFileContents(q, filters), searchProjectsAndFolders(q, filters)])
      setFileHits(files)
      setNameHits(names)
      saveRecentSearch(q)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed — please try again')
      setFileHits([])
      setNameHits([])
    } finally {
      setSearching(false)
    }
  }, 300)

  function handleQueryChange(value: string) {
    setQuery(value)
    setSearching(true)
    runSearch(value)
  }

  // Re-run whenever a filter changes and there's already a query in flight.
  useEffect(() => {
    if (query.trim()) {
      setSearching(true)
      runSearch(query)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, language, tagId, favoritesOnly])

  const hits = useMemo<Hit[]>(() => {
    const nameOnly = nameHits.map((h) => ({ ...h, key: `${h.type}-${h.id}` }))
    const fileOnly = fileHits
      // De-dupe: a file whose NAME already matched via searchProjectsAndFolders-style
      // ilike isn't separately fetched there (that call only covers projects/folders),
      // so no overlap to worry about — file name+content both come from search_files.
      .map((h) => ({ ...h, key: `file-${h.id}` }))
    return [...nameOnly, ...fileOnly]
  }, [nameHits, fileHits])

  useEffect(() => setActiveIndex(0), [hits.length, query])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function openHit(hit: Hit) {
    onClose()
    if (hit.type === 'file') navigate(`/projects/${hit.projectId}?file=${hit.id}`)
    else navigate(`/projects/${hit.projectId}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, hits.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits[activeIndex]
      if (hit) openHit(hit)
    }
  }

  if (!open) return null

  const hasFilters = !!(projectId || language || tagId || favoritesOnly)

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[6vh] px-3" role="presentation">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Advanced search"
        className="relative w-full max-w-2xl glass-panel glow-border overflow-hidden flex flex-col max-h-[80vh]"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 shrink-0">
          <Search size={16} className="text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search file contents, names, projects, folders…"
            aria-label="Search"
            className="flex-1 min-w-0 bg-transparent focus:outline-none text-sm placeholder:text-gray-600"
          />
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 shrink-0" aria-label="Close search">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-white/10 shrink-0 text-xs">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input-field py-1 text-xs w-auto">
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input-field py-1 text-xs w-auto">
            <option value="">All languages</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          {tags.length > 0 && (
            <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="input-field py-1 text-xs w-auto">
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
              favoritesOnly ? 'border-violet/50 text-violet bg-violet/10' : 'border-white/10 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Star size={12} className={favoritesOnly ? 'fill-violet' : ''} /> Favorites
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setProjectId(''); setLanguage(''); setTagId(''); setFavoritesOnly(false) }}
              className="text-gray-500 hover:text-gray-300"
            >
              Clear filters
            </button>
          )}
        </div>

        <div ref={listRef} className="overflow-y-auto flex-1 min-h-0">
          {searchError && (
            <div className="m-4 glass-panel border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger flex items-center justify-between gap-3">
              <span>{searchError}</span>
              <button onClick={() => setSearchError(null)} className="text-danger/70 hover:text-danger shrink-0">Dismiss</button>
            </div>
          )}
          {!query.trim() && (
            <div className="p-4">
              {recentSearches.length > 0 ? (
                <>
                  <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-2">Recent searches</p>
                  <div className="flex flex-col gap-0.5">
                    {recentSearches.map((r) => (
                      <button
                        key={r}
                        onClick={() => handleQueryChange(r)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 text-left"
                      >
                        <Clock size={13} className="shrink-0 text-gray-600" />
                        <span className="truncate">{r}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500 px-1">Search file contents, names, projects, and folders. Filters above narrow it down.</p>
              )}
            </div>
          )}

          {query.trim() && searching && <p className="p-4 text-xs text-gray-500">Searching…</p>}
          {query.trim() && !searching && !searchError && hits.length === 0 && <p className="p-4 text-xs text-gray-500">No matches for "{query}".</p>}

          {query.trim() && !searching && hits.length > 0 && (
            <div className="py-1.5">
              {hits.map((hit, index) => {
                const active = index === activeIndex
                const Icon = hit.type === 'project' ? FolderGit2 : hit.type === 'folder' ? FolderIcon : FileCode2
                return (
                  <button
                    key={hit.key}
                    data-index={index}
                    type="button"
                    onClick={() => openHit(hit)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${active ? 'bg-cyan/10' : 'hover:bg-white/5'}`}
                  >
                    <Icon size={15} className={`shrink-0 mt-0.5 ${active ? 'text-cyan' : 'text-gray-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm truncate ${active ? 'text-cyan' : 'text-gray-200'}`}>{hit.type === 'file' ? hit.name : hit.title}</span>
                        {hit.type === 'file' && hit.isFavorite && <Star size={11} className="text-violet fill-violet shrink-0" />}
                        <span className="text-[10px] text-gray-600 shrink-0">{hit.type === 'file' ? hit.language : hit.subtitle}</span>
                      </div>
                      {hit.type === 'file' && hit.snippet && (
                        <p
                          className="text-xs text-gray-500 mt-0.5 line-clamp-2 [&_mark]:bg-cyan/25 [&_mark]:text-cyan [&_mark]:rounded [&_mark]:px-0.5 [&_mark]:not-italic"
                          dangerouslySetInnerHTML={{ __html: hit.snippet }}
                        />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-t border-white/10 text-[10px] text-gray-600 shrink-0">
          <span><kbd className="border border-white/10 rounded px-1 py-0.5">↑↓</kbd> Navigate</span>
          <span><kbd className="border border-white/10 rounded px-1 py-0.5">Enter</kbd> Open</span>
          <span><kbd className="border border-white/10 rounded px-1 py-0.5">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
