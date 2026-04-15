const FALLBACK_SUPABASE_URL = "http://127.0.0.1:54321"
const FALLBACK_SUPABASE_ANON_KEY = "public-anon-key"
const FALLBACK_SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""

  return {
    url: url || FALLBACK_SUPABASE_URL,
    anonKey: anonKey || FALLBACK_SUPABASE_ANON_KEY,
    isConfigured: Boolean(url && anonKey),
  }
}

export function getSupabaseServiceRoleEnv() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""

  return {
    serviceRoleKey: serviceRoleKey || FALLBACK_SUPABASE_SERVICE_ROLE_KEY,
    isConfigured: Boolean(serviceRoleKey),
  }
}
