import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Normalize the URL to just its origin (https://xxx.supabase.co) so a stray
// trailing slash or path pasted into the secret can't break the auth endpoint.
let url = rawUrl
try {
  if (rawUrl) url = new URL(rawUrl).origin
} catch {
  /* leave rawUrl as-is; the config check below will catch a truly empty value */
}

// True only when both build-time secrets were present. If false, the app shows
// a clear config message instead of a blank page.
export const supabaseConfigured = Boolean(url && key)

export const supabase = supabaseConfigured ? createClient(url, key) : null
