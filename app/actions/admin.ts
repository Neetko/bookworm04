"use server"

import { createAdminClient } from "@/lib/supabase-server"
import { canManageRoles, getCurrentUserAccess, normalizeAppRole } from "@/lib/server/roles"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function syncPublicRoleLabel(
  admin: ReturnType<typeof createAdminClient>,
  authUserId: string,
  publicRoleLabel: "reader" | "moderator" | "admin"
) {
  const { error } = await admin
    .from("user_profiles")
    .update({ role: publicRoleLabel })
    .eq("auth_user_id", authUserId)

  if (error) {
    console.error("Failed to sync public role label", error)
    throw new Error("Failed to sync public role label")
  }
}

function parseAuthUserId(input: FormData, fieldName = "authUserId") {
  const authUserId = String(input.get(fieldName) ?? "").trim()

  if (!authUserId) throw new Error("Missing user id")

  return authUserId
}

function parseRedirectTo(input: FormData) {
  const redirectTo = String(input.get("redirectTo") ?? "").trim()

  if (redirectTo.startsWith("/admin/moderators")) {
    return redirectTo
  }

  return "/admin/moderators"
}

async function requireAdminRoleManagementAccess() {
  const access = await getCurrentUserAccess()

  if (!access.user) {
    throw new Error("Unauthorized")
  }

  if (!canManageRoles(access.role)) {
    throw new Error("Admin access required")
  }

  if (!access.profileId) {
    throw new Error("Admin profile not found")
  }

  return {
    access,
    admin: createAdminClient(),
    profileId: access.profileId,
  }
}

async function getTargetProfile(admin: ReturnType<typeof createAdminClient>, authUserId: string) {
  const { data: targetProfile, error } = await admin
    .from("user_profiles")
    .select("id,username,email,auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load target profile", error)
    throw new Error("Failed to load target profile")
  }

  if (!targetProfile?.id || !targetProfile.auth_user_id) {
    throw new Error("Target user profile not found")
  }

  return {
    profileId: targetProfile.id as string,
    authUserId: targetProfile.auth_user_id as string,
    username: targetProfile.username ?? null,
    email: targetProfile.email ?? null,
  }
}

async function getActorMetadata(admin: ReturnType<typeof createAdminClient>, profileId: string) {
  const { data, error } = await admin
    .from("public_profiles")
    .select("id,username,avatar_url")
    .eq("id", profileId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load admin actor metadata", error)
    return null
  }

  if (!data?.id) return null

  return {
    id: data.id as string,
    username: data.username ?? null,
    avatarUrl: data.avatar_url ?? null,
  }
}

function revalidateRoleManagementPaths() {
  revalidatePath("/admin/moderators")
  revalidatePath("/admin/suggestions")
}

export async function assignModeratorRoleAction(formData: FormData) {
  const { access, admin, profileId } = await requireAdminRoleManagementAccess()
  const authUserId = parseAuthUserId(formData)
  const redirectTo = parseRedirectTo(formData)

  const targetProfile = await getTargetProfile(admin, authUserId)

  const { data: existingRoleRow, error: existingRoleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", authUserId)
    .maybeSingle()

  if (existingRoleError) {
    console.error("Failed to load existing app role", existingRoleError)
    throw new Error("Failed to load existing app role")
  }

  const existingRole = normalizeAppRole(existingRoleRow?.role)

  if (existingRole === "admin") {
    throw new Error("Admins are managed separately")
  }

  const { error: upsertError } = await admin
    .from("user_roles")
    .upsert({ user_id: authUserId, role: "moderator" }, { onConflict: "user_id" })

  if (upsertError) {
    console.error("Failed to assign moderator role", upsertError)
    throw new Error("Failed to assign moderator role")
  }

  await syncPublicRoleLabel(admin, authUserId, "moderator")

  if (targetProfile.profileId !== profileId) {
    const actorMeta = await getActorMetadata(admin, profileId)

    await admin.from("notifications").insert({
      recipient_profile_id: targetProfile.profileId,
      actor_profile_id: profileId,
      event_type: "moderator_assigned",
      metadata: {
        actor: actorMeta,
        role: {
          name: "moderator",
        },
      },
    })
  }

  revalidateRoleManagementPaths()
  redirect(redirectTo)
}

export async function removeModeratorRoleAction(formData: FormData) {
  const { admin } = await requireAdminRoleManagementAccess()
  const authUserId = parseAuthUserId(formData)
  const redirectTo = parseRedirectTo(formData)

  const { data: existingRoleRow, error: existingRoleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", authUserId)
    .maybeSingle()

  if (existingRoleError) {
    console.error("Failed to load existing app role", existingRoleError)
    throw new Error("Failed to load existing app role")
  }

  const existingRole = normalizeAppRole(existingRoleRow?.role)

  if (existingRole === "admin") {
    throw new Error("Admin accounts cannot be changed here")
  }

  await getTargetProfile(admin, authUserId)

  const { error: upsertError } = await admin
    .from("user_roles")
    .upsert({ user_id: authUserId, role: "user" }, { onConflict: "user_id" })

  if (upsertError) {
    console.error("Failed to reset user role", upsertError)
    throw new Error("Failed to reset user role")
  }

  await syncPublicRoleLabel(admin, authUserId, "reader")

  revalidateRoleManagementPaths()
  redirect(redirectTo)
}