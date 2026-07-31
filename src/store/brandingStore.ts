import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface BrandingState {
  appName: string
  logoUrl: string | null
  loaded: boolean
  load: () => Promise<void>
  update: (appName: string, logoUrl: string | null, userId: string) => Promise<void>
}

export const useBrandingStore = create<BrandingState>((set) => ({
  appName: 'CodeVault',
  logoUrl: null,
  loaded: false,

  load: async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', true).maybeSingle()
    if (data) {
      set({ appName: data.app_name, logoUrl: data.logo_url, loaded: true })
      document.title = data.app_name
    } else {
      set({ loaded: true })
    }
  },

  update: async (appName, logoUrl, userId) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ app_name: appName, logo_url: logoUrl, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', true)
    if (error) throw error
    set({ appName, logoUrl })
    document.title = appName
  },
}))
