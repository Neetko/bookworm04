import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost"
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key"

// Note: using placeholders lets the app build without secrets; guarded callers avoid runtime use in that case.
export const supabase = createClient(url, anon)

// Server-side client for use in API routes and server components
export const createServerClient = () => {
  const serverUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost"
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key"
  return createClient(serverUrl, serviceKey)
}
