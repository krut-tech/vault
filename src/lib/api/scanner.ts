import { listFiles } from './files'
import type { VaultFile } from '../../types/vault'

export interface ScanFinding {
  fileId: string
  fileName: string
  type: 'secret' | 'todo' | 'large-file'
  detail: string
  line?: number
}

const SECRET_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  { label: 'Generic API key assignment', regex: /(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi },
  { label: 'Private key block', regex: /-----BEGIN (RSA|EC|OPENSSH|DSA)? ?PRIVATE KEY-----/g },
  { label: 'Hardcoded password', regex: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]{6,}['"]/gi },
  { label: 'Stripe secret key', regex: /sk_(live|test)_[0-9a-zA-Z]{24,}/g },
  { label: 'Slack token', regex: /xox[baprs]-[0-9a-zA-Z-]{10,}/g },
]

const LARGE_FILE_THRESHOLD = 50_000 // characters

export async function scanProject(projectId: string): Promise<ScanFinding[]> {
  const files = await listFiles(projectId)
  const findings: ScanFinding[] = []

  for (const file of files) {
    findings.push(...scanFile(file))
  }
  return findings
}

function scanFile(file: VaultFile): ScanFinding[] {
  const findings: ScanFinding[] = []
  const lines = file.content.split('\n')

  lines.forEach((line, idx) => {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({ fileId: file.id, fileName: file.name, type: 'secret', detail: pattern.label, line: idx + 1 })
      }
      pattern.regex.lastIndex = 0
    }
    if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) {
      findings.push({ fileId: file.id, fileName: file.name, type: 'todo', detail: line.trim().slice(0, 100), line: idx + 1 })
    }
  })

  if (file.content.length > LARGE_FILE_THRESHOLD) {
    findings.push({ fileId: file.id, fileName: file.name, type: 'large-file', detail: `${Math.round(file.content.length / 1000)}KB — consider splitting` })
  }

  return findings
}
