const FALLBACK_SUPABASE_URL = "http://127.0.0.1:54321"
const FALLBACK_SUPABASE_ANON_KEY = "public-anon-key"
const FALLBACK_SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

function isProductionRuntime() {
  return process.env.NODE_ENV === "production"
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""

  if (isProductionRuntime() && (!url || !anonKey)) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in production")
  }

  return {
    url: url || FALLBACK_SUPABASE_URL,
    anonKey: anonKey || FALLBACK_SUPABASE_ANON_KEY,
    isConfigured: Boolean(url && anonKey),
  }
}

export function getSupabaseServiceRoleEnv() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""

  if (isProductionRuntime() && !serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in production")
  }

  return {
    serviceRoleKey: serviceRoleKey || FALLBACK_SUPABASE_SERVICE_ROLE_KEY,
    isConfigured: Boolean(serviceRoleKey),
  }
}
