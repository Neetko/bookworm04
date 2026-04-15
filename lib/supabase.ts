import { createClient } from "@supabase/supabase-js"
import { getSupabasePublicEnv } from "@/lib/supabase-config"

const { url, anonKey: anon } = getSupabasePublicEnv()

// Client-side Supabase (safe to import from Client Components)
export const supabase = createClient(url, anon)
