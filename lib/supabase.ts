const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost"
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key"

import { createClient } from "@supabase/supabase-js"

// Client-side Supabase (safe to import from Client Components)
export const supabase = createClient(url, anon)
