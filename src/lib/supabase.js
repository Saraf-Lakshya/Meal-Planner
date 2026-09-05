import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// True only when both build-time secrets were present. If false, the app shows
// a clear config message instead of a blank page.
export const supabaseConfigured = Boolean(url && key)

export const supabase = supabaseConfigured ? createClient(url, key) : null
