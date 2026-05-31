import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not set — server-side Supabase client may fail')
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

export default supabaseAdmin
