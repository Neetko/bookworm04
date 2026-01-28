import "server-only"

import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost"
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key"

// Cookie-aware server client for Server Components + Server Actions
export const createServerClient = async () => {
  const cookieStore = await cookies()

  return createSupabaseServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // In some contexts (e.g. certain Server Components), cookies are read-only.
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 })
        } catch {
          // Same rationale as set()
        }
      },
    },
  })
}

// Admin client (service role) – use sparingly and never for user-authenticated identity.
export const createAdminClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key"
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
