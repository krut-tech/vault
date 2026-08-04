import { useEffect, useRef, useState } from 'react'
import { FileText, Upload, Download, Trash2, X } from 'lucide-react'
import { listPdfs, uploadPdf, deletePdf, getPdfUrl } from '../lib/api/pdfs'
import type { PdfFile } from '../types/vault'
import { useAuthStore } from '../store/authStore'

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PdfPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const [pdfs, setPdfs] = useState<PdfFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listPdfs(projectId)
      .then(setPdfs)
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !user) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(fileList)) {
        const pdf = await uploadPdf({ project_id: projectId, file, uploaded_by: user.id })
        setPdfs((prev) => [pdf, ...prev])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(pdf: PdfFile) {
    if (!window.confirm(`Delete "${pdf.name}"?`)) return
    try {
      await deletePdf(pdf)
      setPdfs((prev) => prev.filter((p) => p.id !== pdf.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel glow-border w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <FileText size={14} /> PDF documents
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-magenta">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 border-b border-white/10">
          <label className="flex items-center justify-center gap-2 border border-dashed border-white/15 rounded-lg py-4 text-xs text-gray-400 hover:border-cyan hover:text-cyan cursor-pointer transition-colors">
            <Upload size={14} />
            {uploading ? 'Uploading…' : 'Click to choose PDF file(s), or drag them here'}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
          {error && <p className="text-xs text-magenta mt-2">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 rounded-full border-2 border-cyan/30 border-t-cyan animate-spin" />
            </div>
          ) : pdfs.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-10">No PDFs uploaded yet.</p>
          ) : (
            <ul className="space-y-1">
              {pdfs.map((pdf) => (
                <li
                  key={pdf.id}
                  className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm"
                >
                  <FileText size={16} className="text-cyan/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{pdf.name}</p>
                    <p className="text-[11px] text-gray-500">{humanSize(pdf.size_bytes)}</p>
                  </div>
                  <a
                    href={getPdfUrl(pdf.storage_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={pdf.name}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-cyan"
                    title="Download"
                  >
                    <Download size={15} />
                  </a>
                  <button
                    onClick={() => handleDelete(pdf)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-magenta"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
