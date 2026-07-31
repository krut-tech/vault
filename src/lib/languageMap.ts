// Maps file extensions <-> vault languages, and validates uploads against a project's language.

export const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  javascript: ['js', 'mjs', 'cjs', 'jsx'],
  typescript: ['ts', 'tsx'],
  python: ['py', 'pyw'],
  php: ['php'],
  java: ['java'],
  c: ['c', 'h'],
  cpp: ['cpp', 'cc', 'cxx', 'hpp', 'hh'],
  csharp: ['cs'],
  go: ['go'],
  rust: ['rs'],
  html: ['html', 'htm'],
  css: ['css'],
  sql: ['sql'],
  json: ['json'],
  yaml: ['yml', 'yaml'],
  markdown: ['md', 'markdown'],
  shell: ['sh', 'bash'],
  plaintext: ['txt'],
}

const EXTENSION_TO_LANGUAGE: Record<string, string> = {}
for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
  for (const ext of exts) EXTENSION_TO_LANGUAGE[ext] = lang
}

export function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

export function detectLanguage(filename: string): string {
  const ext = getExtension(filename)
  return EXTENSION_TO_LANGUAGE[ext] ?? 'plaintext'
}

/** Returns true if the file's extension belongs to the given project language. */
export function matchesProjectLanguage(filename: string, projectLanguage: string): boolean {
  const ext = getExtension(filename)
  const allowed = LANGUAGE_EXTENSIONS[projectLanguage] ?? []
  return allowed.includes(ext)
}

/** Comma-separated accept string for <input type="file" accept="..."> */
export function acceptForLanguage(projectLanguage: string): string {
  const exts = LANGUAGE_EXTENSIONS[projectLanguage] ?? []
  return exts.map((e) => `.${e}`).join(',')
}
