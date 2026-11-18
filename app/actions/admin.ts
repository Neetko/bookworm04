"use server"

import { createAdminClient } from "@/lib/supabase-server"
import { canManageRoles, getCurrentUserAccess } from "@/lib/server/roles"
import { requireVerifiedStaffSession } from "@/lib/server/staff-mfa"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

function parseAuthUserId(input: FormData, fieldName = "authUserId") {
  const authUserId = String(input.get(fieldName) ?? "").trim()

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authUserId)) {
    throw new Error("Invalid user id")
  }

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

  await requireVerifiedStaffSession()

  return {
    access,
    admin: createAdminClient(),
    profileId: access.profileId,
    actorAuthUserId: access.user.id,
  }
}

async function getTargetProfile(admin: ReturnType<typeof createAdminClient>, authUserId: string) {
  const { data: targetProfile, error } = await admin
    .from("user_profiles")
    .select("id,username,auth_user_id")
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

async function changeModeratorRole(
  admin: ReturnType<typeof createAdminClient>,
  actorAuthUserId: string,
  targetAuthUserId: string,
  makeModerator: boolean
) {
  const { data, error } = await admin.rpc("change_moderator_role", {
    p_actor_auth_user_id: actorAuthUserId,
    p_target_auth_user_id: targetAuthUserId,
    p_make_moderator: makeModerator,
  })

  if (error || !Array.isArray(data) || data.length !== 1) {
    console.error("Failed to change moderator role", error)
    throw new Error("Failed to change moderator role")
  }

  return data[0].changed === true
}

export async function assignModeratorRoleAction(formData: FormData) {
  const { actorAuthUserId, admin, profileId } = await requireAdminRoleManagementAccess()
  const authUserId = parseAuthUserId(formData)
  const redirectTo = parseRedirectTo(formData)

  const targetProfile = await getTargetProfile(admin, authUserId)

  const changed = await changeModeratorRole(admin, actorAuthUserId, authUserId, true)

  if (changed && targetProfile.profileId !== profileId) {
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
  const { actorAuthUserId, admin } = await requireAdminRoleManagementAccess()
  const authUserId = parseAuthUserId(formData)
  const redirectTo = parseRedirectTo(formData)

  await getTargetProfile(admin, authUserId)
  await changeModeratorRole(admin, actorAuthUserId, authUserId, false)

  revalidateRoleManagementPaths()
  redirect(redirectTo)
}
