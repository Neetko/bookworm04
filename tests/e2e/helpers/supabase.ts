import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { DEMO_READER } from "../fixtures/demo"

config({ path: ".env.local" })

function getSupabaseTestEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !anonKey) {
    throw new Error("Local Supabase test environment is not configured")
  }

  return { url, anonKey, serviceRoleKey }
}

export function createAdminTestClient() {
  const { url, serviceRoleKey } = getSupabaseTestEnv()

  if (!serviceRoleKey) {
    throw new Error("Local Supabase service role is not configured")
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createAnonymousTestClient() {
  const { url, anonKey } = getSupabaseTestEnv()
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function createDemoReaderTestClient() {
  const client = createAnonymousTestClient()
  const { error } = await client.auth.signInWithPassword({
    email: DEMO_READER.email,
    password: DEMO_READER.password,
  })

  if (error) throw error
  return client
}
