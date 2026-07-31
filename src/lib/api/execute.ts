import { supabase } from '../supabase'

export interface RunResult {
  stdout: string
  stderr: string
  compileOutput: string | null
  exitCode: number | null
  error?: string
}

const EXECUTABLE_LANGUAGES = new Set(['javascript', 'typescript', 'python', 'php', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'shell'])

export function isExecutable(language: string) {
  return EXECUTABLE_LANGUAGES.has(language)
}

export async function runCode(language: string, code: string, stdin = ''): Promise<RunResult> {
  const { data, error } = await supabase.functions.invoke('run-code', { body: { language, code, stdin } })
  if (error) return { stdout: '', stderr: '', compileOutput: null, exitCode: null, error: error.message }
  return data as RunResult
}
