export interface Project {
  id: string
  name: string
  description: string | null
  language: string
  created_by: string
  is_private: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface ProjectAccessEntry {
  project_id: string
  user_id: string
  granted_by: string
  granted_at: string
}

export interface Folder {
  id: string
  project_id: string
  parent_id: string | null
  name: string
  is_deleted: boolean
  created_at: string
}

export interface VaultFile {
  id: string
  project_id: string
  folder_id: string | null
  name: string
  language: string
  content: string
  created_by: string
  is_favorite: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface FileVersion {
  id: string
  file_id: string
  content: string
  created_by: string
  created_at: string
}

export interface PdfFile {
  id: string
  project_id: string
  folder_id: string | null
  name: string
  storage_path: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}

export const LANGUAGES = [
  'javascript', 'typescript', 'python', 'php', 'java', 'c', 'cpp',
  'csharp', 'go', 'rust', 'html', 'css', 'sql', 'json', 'yaml',
  'markdown', 'shell', 'plaintext',
] as const

export type LanguageId = (typeof LANGUAGES)[number]
