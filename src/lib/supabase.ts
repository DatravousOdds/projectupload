import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail at startup with the variable name, instead of on the first request.
if (!SUPABASE_URL) {
  throw new Error('Missing VITE_SUPABASE_URL. Add it to .env (see .env.example).')
}

if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY. Add it to .env (see .env.example).')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
