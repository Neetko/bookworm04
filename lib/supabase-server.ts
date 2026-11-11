import "server-only"

import { createServerClient as createSupabaseServerClient, type CookieOptions } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { getSupabasePublicEnv, getSupabaseServiceRoleEnv } from "@/lib/supabase-config"

const { url, anonKey: anon } = getSupabasePublicEnv()

// Cookie-aware server client for Server Components + Server Actions
export const createServerClient = async () => {
  const cookieStore = await cookies()

  return createSupabaseServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // In some contexts (e.g. certain Server Components), cookies are read-only.
        }
      },
      remove(name: string, options: CookieOptions) {
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
  const { serviceRoleKey: serviceKey, isConfigured } = getSupabaseServiceRoleEnv()

  if (!isConfigured) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not configured. Admin-only Supabase requests may fail.")
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>
export type SupabaseAdminClient = ReturnType<typeof createAdminClient>
