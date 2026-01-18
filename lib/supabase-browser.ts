import "client-only"

import { createBrowserClient } from "@supabase/ssr"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost"
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key"

// Browser client that stores the session in cookies (used by Auth UI + client components)
export const supabase = createBrowserClient(url, anon)
