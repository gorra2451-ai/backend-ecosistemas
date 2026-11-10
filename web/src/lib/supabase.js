import { createClient } from '@supabase/supabase-js'

// Solo URL y llave PUBLICABLE (D-018). Nunca la secret/service_role.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://hdaolwqvxofmvqahzjvp.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY || ''

export const supabase = createClient(url, key || 'falta-llave', {
  auth: { persistSession: true, autoRefreshToken: true },
})
