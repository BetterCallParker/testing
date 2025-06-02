import { createClient } from '@supabase/supabase-js'

// IMPORTANT: User will need to replace these with their actual Supabase project URL and anon key
// You can get these from your Supabase project settings > API
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'

if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  alert("Supabase URL or Anon Key is not configured. Please update tracking-ducks/src/supabaseClient.ts with your project credentials. Authentication will not work until this is done.");
  console.warn("Supabase URL or Anon Key is not configured. Please update supabaseClient.ts with your project credentials. Authentication will not work until this is done.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
