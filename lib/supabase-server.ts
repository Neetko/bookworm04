import "server-only"

import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { getSupabasePublicEnv, getSupabaseServiceRoleEnv } from "@/lib/supabase-config"

const { url, anonKey: anon } = getSupabasePublicEnv()

// Cookie-aware server client for Server Components + Server Actions
export const createServerClient = async () => {
  const cookieStore = await cookies()

  return createSupabaseServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot write cookies; middleware refreshes them instead.
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
