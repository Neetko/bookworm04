"use server"

import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"

async function requireAuthedProfileId() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("Unauthorized")
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (profileError || !profile?.id) {
    throw new Error("Profile not found")
  }

  return { supabase, profileId: profile.id as string }
}

async function getActorMetadata(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileIds: string[]
) {
  const { data } = await supabase
    .from("public_profiles")
    .select("id,username,avatar_url")
    .in("id", profileIds)

  const map = new Map<string, { id: string; username: string | null; avatarUrl: string | null }>()
  for (const row of data ?? []) {
    if (!row?.id) continue
    map.set(row.id as string, {
      id: row.id as string,
      username: row.username ?? null,
      avatarUrl: row.avatar_url ?? null,
    })
  }

  return map
}

export async function getFollowState(targetProfileId: string) {
  const { supabase, profileId } = await requireAuthedProfileId()

  const { data, error } = await supabase
    .from("user_follows")
    .select("id,is_friend")
    .eq("follower_profile_id", profileId)
    .eq("followed_profile_id", targetProfileId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load follow state", error)
    throw new Error("Failed to load follow state")
  }

  return {
    isFollowing: Boolean(data?.id),
    isFriend: Boolean(data?.is_friend),
  }
}

export async function followUser(targetProfileId: string) {
  const { supabase, profileId } = await requireAuthedProfileId()
  const admin = createAdminClient()

  if (profileId === targetProfileId) {
    throw new Error("Cannot follow yourself")
  }

  const { error: upsertError } = await supabase
    .from("user_follows")
    .upsert(
      {
        follower_profile_id: profileId,
        followed_profile_id: targetProfileId,
        is_private: true,
        is_friend: false,
      },
      { onConflict: "follower_profile_id,followed_profile_id" }
    )

  if (upsertError) {
    console.error("Failed to follow user", upsertError)
    throw new Error("Failed to follow user")
  }

  const actorMap = await getActorMetadata(supabase, [profileId])
  const actorMeta = actorMap.get(profileId) ?? null

  await admin.from("notifications").insert({
    recipient_profile_id: targetProfileId,
    actor_profile_id: profileId,
    event_type: "followed",
    metadata: {
      actor: actorMeta,
    },
  })

  const { data: reciprocal, error: reciprocalError } = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_profile_id", targetProfileId)
    .eq("followed_profile_id", profileId)
    .maybeSingle()

  if (reciprocalError) {
    console.error("Failed to check reciprocal follow", reciprocalError)
    throw new Error("Failed to follow user")
  }

  if (reciprocal?.id) {
    const { data: friendRows } = await supabase
      .from("user_follows")
      .select("is_friend")
      .or(
        `and(follower_profile_id.eq.${profileId},followed_profile_id.eq.${targetProfileId}),and(follower_profile_id.eq.${targetProfileId},followed_profile_id.eq.${profileId})`
      )

    const wasFriend = (friendRows ?? []).some((row: any) => row?.is_friend)

    const { error: updateError } = await admin
      .from("user_follows")
      .update({ is_friend: true })
      .or(
        `and(follower_profile_id.eq.${profileId},followed_profile_id.eq.${targetProfileId}),and(follower_profile_id.eq.${targetProfileId},followed_profile_id.eq.${profileId})`
      )

    if (updateError) {
      console.error("Failed to update friend state", updateError)
      throw new Error("Failed to follow user")
    }

    if (!wasFriend) {
      const metaMap = await getActorMetadata(supabase, [profileId, targetProfileId])
      const forTarget = metaMap.get(profileId) ?? null
      const forActor = metaMap.get(targetProfileId) ?? null

      await admin.from("notifications").insert([
        {
          recipient_profile_id: targetProfileId,
          actor_profile_id: profileId,
          event_type: "friendship",
          metadata: { actor: forTarget },
        },
        {
          recipient_profile_id: profileId,
          actor_profile_id: targetProfileId,
          event_type: "friendship",
          metadata: { actor: forActor },
        },
      ])
    }
  }

  revalidatePath("/")
  return { success: true }
}

export async function unfollowUser(targetProfileId: string) {
  const { supabase, profileId } = await requireAuthedProfileId()
  const admin = createAdminClient()

  if (profileId === targetProfileId) {
    throw new Error("Cannot unfollow yourself")
  }

  const { error: deleteError } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_profile_id", profileId)
    .eq("followed_profile_id", targetProfileId)

  if (deleteError) {
    console.error("Failed to unfollow user", deleteError)
    throw new Error("Failed to unfollow user")
  }

  const { error: updateError } = await admin
    .from("user_follows")
    .update({ is_friend: false })
    .eq("follower_profile_id", targetProfileId)
    .eq("followed_profile_id", profileId)

  if (updateError) {
    console.error("Failed to update friend state", updateError)
    throw new Error("Failed to unfollow user")
  }

  revalidatePath("/")
  return { success: true }
}
