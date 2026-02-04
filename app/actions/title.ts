"use server"

import { createServerClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"

async function requireAuthedProfileId(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("Unauthorized")

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (profileError || !profile) throw new Error("Profile not found")

  return profile.id as string
}

async function requireTitleRead(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const { data, error } = await supabase
    .from("title_reads")
    .select("title_id")
    .eq("user_profile_id", profileId)
    .eq("title_id", titleId)
    .maybeSingle()

  if (error) {
    console.error("Failed to check title read status", error)
    throw new Error("Failed to check access")
  }

  if (!data?.title_id) throw new Error("Forbidden")
}

export async function getTitleReadStatus(titleId: string) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (!profile?.id) return false

  const { data } = await supabase
    .from("title_reads")
    .select("title_id")
    .eq("user_profile_id", profile.id)
    .eq("title_id", titleId)
    .maybeSingle()

  return Boolean(data?.title_id)
}

export async function setTitleReadStatus(titleId: string, isRead: boolean) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  if (isRead) {
    const { error } = await supabase
      .from("title_reads")
      .upsert({ user_profile_id: profileId, title_id: titleId }, { onConflict: "user_profile_id,title_id" })

    if (error) {
      console.error("Failed to mark title as read", error)
      throw new Error("Failed to update read status")
    }
  } else {
    const { error } = await supabase
      .from("title_reads")
      .delete()
      .eq("user_profile_id", profileId)
      .eq("title_id", titleId)

    if (error) {
      console.error("Failed to mark title as unread", error)
      throw new Error("Failed to update read status")
    }
  }

  revalidatePath(`/titles/${titleId}`)
  return { titleId }
}

export type DiscussionPostRow = {
  id: string
  content: string
  created_at: string
  user_profiles: {
    username: string | null
    avatar_url: string | null
    role: string | null
    joined_date: string | null
    signature: string | null
    signature_image: string | null
  } | null
}

export async function getDiscussionPosts(titleId: string): Promise<DiscussionPostRow[]> {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  await requireTitleRead(supabase, profileId, titleId)

  const { data, error } = await supabase
    .from("discussion_posts")
    .select(
      `
      id,
      content,
      created_at,
      user_profiles (
        username,
        avatar_url,
        role,
        created_at,
        signature,
        signature_image
      )
    `
    )
    .eq("title_id", titleId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch discussion posts", error)
    throw new Error("Failed to load discussion")
  }

  const rows = (data ?? []) as any[]
  return rows.map((row) => ({
    ...row,
    user_profiles: row.user_profiles
      ? {
          ...row.user_profiles,
          joined_date: row.user_profiles.created_at ?? null,
        }
      : null,
  }))
}

export async function createDiscussionPost(titleId: string, content: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  await requireTitleRead(supabase, profileId, titleId)

  const trimmed = content.trim()
  if (!trimmed) throw new Error("Message cannot be empty")

  const { error } = await supabase.from("discussion_posts").insert({
    title_id: titleId,
    user_id: profileId,
    content: trimmed,
    likes_count: 0,
  })

  if (error) {
    console.error("Failed to create discussion post", error)
    throw new Error("Failed to publish post")
  }

  revalidatePath(`/titles/${titleId}`)
  return { titleId }
}
