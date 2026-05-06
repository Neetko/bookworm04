import "server-only"

import { type User } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase-server"

export const APP_ROLES = ["user", "moderator", "admin"] as const

export type AppRole = (typeof APP_ROLES)[number]

export function normalizeAppRole(value: unknown): AppRole {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""

  if (normalized === "admin") return "admin"
  if (normalized === "moderator") return "moderator"

  return "user"
}

export function canReviewSuggestions(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "moderator"
}

export function canManageRoles(role: AppRole | null | undefined): boolean {
  return role === "admin"
}

export async function getUserAccessForAuthUserId(input: {
  userId: string
  user?: User | null
}): Promise<{
  user: User | null
  profileId: string | null
  role: AppRole
}> {
  const supabase = await createServerClient()

  const [{ data: roleRow, error: roleError }, { data: profileRow, error: profileError }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", input.userId)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", input.userId)
      .maybeSingle(),
  ])

  if (roleError) {
    console.error("Failed to load user_roles record", roleError)
  }

  if (profileError) {
    console.error("Failed to load user profile access record", profileError)
  }

  return {
    user: input.user ?? null,
    profileId: typeof profileRow?.id === "string" ? profileRow.id : null,
    role: normalizeAppRole(roleRow?.role),
  }
}

export async function getCurrentUserAccess(): Promise<{
  user: User | null
  profileId: string | null
  role: AppRole
}> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      profileId: null,
      role: "user",
    }
  }

  return getUserAccessForAuthUserId({ userId: user.id, user })
}