export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; full_name: string | null; avatar_url: string | null; role: 'owner' | 'admin' | 'member'; totp_secret: string | null; is_active: boolean; approved_at: string | null; deleted_at: string | null; created_at: string }
        Insert: { id: string; email: string; full_name?: string | null; avatar_url?: string | null; role?: 'owner' | 'admin' | 'member'; totp_secret?: string | null; is_active?: boolean; approved_at?: string | null; deleted_at?: string | null; created_at?: string }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      app_settings: {
        Row: { id: boolean; app_name: string; logo_url: string | null; updated_by: string | null; updated_at: string }
        Insert: { id?: boolean; app_name?: string; logo_url?: string | null; updated_by?: string | null; updated_at?: string }
        Update: Partial<Database['public']['Tables']['app_settings']['Insert']>
        Relationships: []
      }
      login_attempts: {
        Row: { id: string; email: string; ip: string | null; success: boolean; created_at: string }
        Insert: { id?: string; email: string; ip?: string | null; success: boolean; created_at?: string }
        Update: Partial<Database['public']['Tables']['login_attempts']['Insert']>
        Relationships: []
      }
      ip_allowlist: {
        Row: { id: string; ip: string; note: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; ip: string; note?: string | null; created_by?: string | null; created_at?: string }
        Update: Partial<Database['public']['Tables']['ip_allowlist']['Insert']>
        Relationships: []
      }
      projects: {
        Row: { id: string; name: string; description: string | null; language: string; created_by: string; is_private: boolean; is_deleted: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; description?: string | null; language: string; created_by: string; is_private?: boolean; is_deleted?: boolean; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
        Relationships: []
      }
      project_access: {
        Row: { project_id: string; user_id: string; granted_by: string; granted_at: string }
        Insert: { project_id: string; user_id: string; granted_by: string; granted_at?: string }
        Update: Partial<Database['public']['Tables']['project_access']['Insert']>
        Relationships: []
      }
      folders: {
        Row: { id: string; project_id: string; parent_id: string | null; name: string; is_deleted: boolean; created_at: string }
        Insert: { id?: string; project_id: string; parent_id?: string | null; name: string; is_deleted?: boolean; created_at?: string }
        Update: Partial<Database['public']['Tables']['folders']['Insert']>
        Relationships: []
      }
      files: {
        Row: { id: string; project_id: string; folder_id: string | null; name: string; language: string; content: string; created_by: string; is_favorite: boolean; is_deleted: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; project_id: string; folder_id?: string | null; name: string; language: string; content?: string; created_by: string; is_favorite?: boolean; is_deleted?: boolean; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['files']['Insert']>
        Relationships: []
      }
      pdf_files: {
        Row: { id: string; project_id: string; folder_id: string | null; name: string; storage_path: string; size_bytes: number; uploaded_by: string | null; created_at: string }
        Insert: { id?: string; project_id: string; folder_id?: string | null; name: string; storage_path: string; size_bytes: number; uploaded_by?: string | null; created_at?: string }
        Update: Partial<Database['public']['Tables']['pdf_files']['Insert']>
        Relationships: []
      }
      file_versions: {
        Row: { id: string; file_id: string; content: string; created_by: string; created_at: string }
        Insert: { id?: string; file_id: string; content: string; created_by: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['file_versions']['Insert']>
        Relationships: []
      }
      tags: {
        Row: { id: string; name: string }
        Insert: { id?: string; name: string }
        Update: Partial<Database['public']['Tables']['tags']['Insert']>
        Relationships: []
      }
      file_tags: {
        Row: { file_id: string; tag_id: string }
        Insert: { file_id: string; tag_id: string }
        Update: Partial<Database['public']['Tables']['file_tags']['Insert']>
        Relationships: []
      }
      collections: {
        Row: { id: string; name: string; created_by: string; created_at: string }
        Insert: { id?: string; name: string; created_by: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['collections']['Insert']>
        Relationships: []
      }
      collection_items: {
        Row: { collection_id: string; file_id: string }
        Insert: { collection_id: string; file_id: string }
        Update: Partial<Database['public']['Tables']['collection_items']['Insert']>
        Relationships: []
      }
      comments: {
        Row: { id: string; file_id: string; author_id: string; body: string; created_at: string }
        Insert: { id?: string; file_id: string; author_id: string; body: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
        Relationships: []
      }
      notifications: {
        Row: { id: string; user_id: string; message: string; link: string | null; is_read: boolean; created_at: string }
        Insert: { id?: string; user_id: string; message: string; link?: string | null; is_read?: boolean; created_at?: string }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
        Relationships: []
      }
      activity_log: {
        Row: { id: string; actor_id: string; action: string; entity_type: string; entity_id: string | null; meta: Json | null; created_at: string }
        Insert: { id?: string; actor_id: string; action: string; entity_type: string; entity_id?: string | null; meta?: Json | null; created_at?: string }
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
        Relationships: []
      }
      notes: {
        Row: { id: string; project_id: string | null; title: string; body: string; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; project_id?: string | null; title?: string; body?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['notes']['Insert']>
        Relationships: []
      }
      quick_tasks: {
        Row: { id: string; project_id: string | null; title: string; is_done: boolean; created_by: string; created_at: string }
        Insert: { id?: string; project_id?: string | null; title: string; is_done?: boolean; created_by: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['quick_tasks']['Insert']>
        Relationships: []
      }
      boards: {
        Row: { id: string; project_id: string | null; name: string; created_by: string; created_at: string }
        Insert: { id?: string; project_id?: string | null; name: string; created_by: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['boards']['Insert']>
        Relationships: []
      }
      board_columns: {
        Row: { id: string; board_id: string; name: string; position: number }
        Insert: { id?: string; board_id: string; name: string; position?: number }
        Update: Partial<Database['public']['Tables']['board_columns']['Insert']>
        Relationships: []
      }
      tasks: {
        Row: { id: string; column_id: string; title: string; description: string | null; assignee_id: string | null; position: number; created_at: string }
        Insert: { id?: string; column_id: string; title: string; description?: string | null; assignee_id?: string | null; position?: number; created_at?: string }
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
        Relationships: []
      }
      time_entries: {
        Row: { id: string; task_id: string | null; project_id: string | null; user_id: string; started_at: string; ended_at: string | null; note: string | null }
        Insert: { id?: string; task_id?: string | null; project_id?: string | null; user_id: string; started_at?: string; ended_at?: string | null; note?: string | null }
        Update: Partial<Database['public']['Tables']['time_entries']['Insert']>
        Relationships: []
      }
      deploy_targets: {
        Row: { id: string; project_id: string; name: string; protocol: 'ftp' | 'sftp'; host: string; port: number; username: string; secret_ref: string; remote_path: string; created_by: string; created_at: string }
        Insert: { id?: string; project_id: string; name: string; protocol: 'ftp' | 'sftp'; host: string; port: number; username: string; secret_ref: string; remote_path?: string; created_by: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['deploy_targets']['Insert']>
        Relationships: []
      }
      deployments: {
        Row: { id: string; target_id: string; status: 'queued' | 'running' | 'success' | 'failed'; log: string | null; started_at: string; finished_at: string | null }
        Insert: { id?: string; target_id: string; status?: 'queued' | 'running' | 'success' | 'failed'; log?: string | null; started_at?: string; finished_at?: string | null }
        Update: Partial<Database['public']['Tables']['deployments']['Insert']>
        Relationships: []
      }
      monitors: {
        Row: { id: string; url: string; name: string; interval_minutes: number; created_by: string; created_at: string }
        Insert: { id?: string; url: string; name: string; interval_minutes?: number; created_by: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['monitors']['Insert']>
        Relationships: []
      }
      monitor_checks: {
        Row: { id: string; monitor_id: string; is_up: boolean; status_code: number | null; response_ms: number | null; checked_at: string }
        Insert: { id?: string; monitor_id: string; is_up: boolean; status_code?: number | null; response_ms?: number | null; checked_at?: string }
        Update: Partial<Database['public']['Tables']['monitor_checks']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
