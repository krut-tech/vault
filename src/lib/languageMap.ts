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

/** Returns true if the file's extension belongs to ANY of the project's selected languages. */
export function matchesProjectLanguages(filename: string, projectLanguages: string[]): boolean {
  const ext = getExtension(filename)
  return projectLanguages.some((lang) => (LANGUAGE_EXTENSIONS[lang] ?? []).includes(ext))
}

/** Comma-separated accept string for <input type="file" accept="..."> covering every selected language. */
export function acceptForLanguages(projectLanguages: string[]): string {
  const exts = projectLanguages.flatMap((lang) => LANGUAGE_EXTENSIONS[lang] ?? [])
  return exts.map((e) => `.${e}`).join(',')
}
