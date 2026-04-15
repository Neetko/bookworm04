import "client-only"

import { createBrowserClient } from "@supabase/ssr"
import { getSupabasePublicEnv } from "@/lib/supabase-config"

const { url, anonKey: anon } = getSupabasePublicEnv()

// Browser client that stores the session in cookies (used by Auth UI + client components)
export const supabase = createBrowserClient(url, anon)
