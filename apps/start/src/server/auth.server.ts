import type { User } from "@supabase/supabase-js"
import {
  createRequestSupabaseClient,
  type RequestSupabaseClient,
} from "./supabase.server"

export async function requireUser(supabase: RequestSupabaseClient): Promise<User> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new Response("Unauthorized", { status: 401 })
  }
  return data.user
}

export async function requireStaff(supabase: RequestSupabaseClient) {
  const user = await requireUser(supabase)
  const [{ data: assurance, error: assuranceError }, { data: role, error: roleError }] =
    await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ])

  if (assuranceError || assurance?.currentLevel !== "aal2") {
    throw new Response("Authenticator verification required", { status: 403 })
  }
  if (roleError || !["admin", "moderator"].includes(role?.role ?? "")) {
    throw new Response("Forbidden", { status: 403 })
  }

  return { user, role: role!.role as "admin" | "moderator" }
}

export async function getCurrentUser() {
  const supabase = createRequestSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user
}
