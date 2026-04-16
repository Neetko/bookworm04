"use server"

import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { normalizeGenres, type Genre } from "@/lib/types"
import { extractPlainTextFromHtml, sanitizeRichTextHtml } from "@/lib/sanitize"
import { randomUUID } from "crypto"
import { resizeAvatarImage } from "@/lib/avatar-image"

export type ClubType = "book" | "writer"

export interface ClubBase {
  id: string
  type: ClubType
  name: string
  description: string | null
  categories: Genre[] | null
  avatar_url: string | null
  current_title_id: string | null
  owner_user_id: string
  created_at: string
  updated_at: string
}

export interface ClubSummary extends ClubBase {
  memberCount: number
}

export interface ClubListItem extends ClubSummary {
  currentReading: string | null
  plannedReading: string[]
}

export interface ClubWithOwner extends ClubBase {
  owner: {
    username: string | null
    avatar_url: string | null
    role: string | null
    created_at: string | null
  } | null
}

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

async function requireOwnerProfileId(supabase: Awaited<ReturnType<typeof createServerClient>>, clubId: string) {
  const profileId = await requireAuthedProfileId(supabase)

  const { data: club, error } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .single()

  if (error || !club) throw new Error("Club not found")
  if (club.owner_user_id !== profileId) throw new Error("Forbidden")

  return profileId
}

export async function getClubs() {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching clubs:", error)
    return [] as ClubListItem[]
  }

  const clubs = (data ?? []) as ClubBase[]

  const bookClubs = clubs.filter((club) => club.type === "book")
  const bookClubIds = bookClubs.map((club) => club.id)

  const currentTitleIds = bookClubs
    .map((club) => club.current_title_id)
    .filter(Boolean) as string[]

  const { data: currentTitles } = currentTitleIds.length
    ? await supabase.from("titles").select("id, title").in("id", currentTitleIds)
    : { data: [] as Array<{ id: string; title: string }> }

  const currentTitleMap = new Map((currentTitles ?? []).map((t) => [t.id, t.title]))

  let plannedItems: Array<{
    club_id: string
    title_id?: string | null
    title: string | null
    created_at?: string
  }> = []

  if (bookClubIds.length > 0) {
    const plannedRes = await supabase
      .from("club_reading_items")
      .select("club_id, title_id, title, created_at")
      .in("club_id", bookClubIds)
      .order("created_at", { ascending: false })

    if (plannedRes.error) {
      const message = `${plannedRes.error.message ?? ""}`
      const isMissingTitleId = plannedRes.error.code === "42703" || message.includes("column")

      if (isMissingTitleId) {
        const fallbackRes = await supabase
          .from("club_reading_items")
          .select("club_id, title, created_at")
          .in("club_id", bookClubIds)
          .order("created_at", { ascending: false })

        plannedItems = (fallbackRes.data ?? []) as typeof plannedItems
      } else {
        console.error("Error fetching planned reading items:", plannedRes.error)
      }
    } else {
      plannedItems = (plannedRes.data ?? []) as typeof plannedItems
    }
  }

  const plannedTitleIds = plannedItems
    .map((item) => item.title_id)
    .filter(Boolean) as string[]

  const plannedTitlesRes = plannedTitleIds.length
    ? await supabase.from("titles").select("id, title").in("id", plannedTitleIds)
    : { data: [] as any[] }

  const plannedTitleMap = new Map((plannedTitlesRes.data ?? []).map((t: any) => [t.id, t.title]))

  const plannedByClub = new Map<string, string[]>()
  for (const item of plannedItems) {
    const clubId = item.club_id
    const list = plannedByClub.get(clubId) ?? []
    if (list.length >= 4) continue

    const title =
      (item.title_id ? plannedTitleMap.get(item.title_id) : null) ??
      item.title ??
      "Untitled"

    list.push(title)
    plannedByClub.set(clubId, list)
  }

  const memberCounts = await Promise.all(
    clubs.map(async (club) => {
      const { count } = await supabase
        .from("club_members")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id)

      return typeof count === "number" ? count : 0
    })
  )

  return clubs.map((club, idx) => ({
    ...(club as any),
    memberCount: memberCounts[idx] ?? 0,
    currentReading:
      club.type === "book" && club.current_title_id
        ? currentTitleMap.get(club.current_title_id) ?? null
        : null,
    plannedReading: club.type === "book" ? plannedByClub.get(club.id) ?? [] : [],
  })) as ClubListItem[]
}

export async function getClub(clubId: string) {
  const supabase = await createServerClient()

  const { data: club, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .single()

  if (error) {
    console.error("Error fetching club:", error)
    return null
  }

  const { data: owner } = await supabase
    .from("public_profiles")
    .select("username, avatar_url, role, created_at")
    .eq("id", club.owner_user_id)
    .maybeSingle()

  return {
    ...club,
    owner: owner ?? null,
  } as unknown as ClubWithOwner
}

async function requireMemberOrOwner(supabase: Awaited<ReturnType<typeof createServerClient>>, clubId: string) {
  const profileId = await requireAuthedProfileId(supabase)

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .single()

  if (clubError || !club) throw new Error("Club not found")
  if (club.owner_user_id === profileId) return profileId

  const { data: member } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", profileId)
    .maybeSingle()

  if (!member) throw new Error("Forbidden")
  return profileId
}

export async function setClubCurrentReading(clubId: string, titleId: string | null) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase
    .from("clubs")
    .update({ current_title_id: titleId, updated_at: new Date().toISOString() })
    .eq("id", clubId)

  if (error) {
    const message = `${error.message ?? ""}`
    const isMissingColumn = error.code === "42703" || (message.includes("column") && message.includes("current_title_id"))

    if (isMissingColumn) {
      const { error: fallbackError } = await supabase
        .from("clubs")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", clubId)

      if (fallbackError) {
        console.error("Failed to update current reading (fallback)", fallbackError)
        throw new Error("Failed to update current reading")
      }
    } else {
      console.error("Failed to update current reading", error)
      throw new Error("Failed to update current reading")
    }
  }

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
}

export async function getClubCurrentReading(clubId: string) {
  const supabase = await createServerClient()
  const { data: club, error } = await supabase
    .from("clubs")
    .select("current_title_id")
    .eq("id", clubId)
    .single()

  if (error) {
    const message = `${error.message ?? ""}`
    const isMissingColumn = error.code === "42703" || (message.includes("column") && message.includes("current_title_id"))
    if (!isMissingColumn) {
      console.error("Error fetching current reading", error)
    }
    return null
  }

  if (!club?.current_title_id) return null

  const { data: title, error: titleError } = await supabase
    .from("titles")
    .select("id, title, author, cover_image_url")
    .eq("id", club.current_title_id)
    .maybeSingle()

  if (titleError || !title) return null
  return title
}

export async function getClubCurrentReadingComments(clubId: string) {
  const supabase = await createServerClient()

  const { data: club } = await supabase
    .from("clubs")
    .select("current_title_id")
    .eq("id", clubId)
    .maybeSingle()

  if (!club?.current_title_id) return []

  const { data, error } = await supabase
    .from("club_reading_comments")
    .select("id, content, likes_count, created_at, user_id")
    .eq("club_id", clubId)
    .eq("title_id", club.current_title_id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club comments", error)
    return []
  }

  const userIds = Array.from(new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean))) as string[]
  const { data: profiles } = userIds.length
    ? await supabase
        .from("public_profiles")
        .select("id, username, avatar_url")
        .in("id", userIds)
    : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null }> }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]))

  return (data ?? []).map((row: any) => ({
    ...row,
    user_profiles: profileMap.get(row.user_id as string) ?? null,
  }))
}

export async function addClubCurrentReadingComment(clubId: string, content: string) {
  const supabase = await createServerClient()
  const profileId = await requireMemberOrOwner(supabase, clubId)

  const { data: club } = await supabase
    .from("clubs")
    .select("current_title_id")
    .eq("id", clubId)
    .single()

  if (!club?.current_title_id) throw new Error("No current reading selected")

  const cleaned = sanitizeRichTextHtml(content)
  const plain = extractPlainTextFromHtml(cleaned)
  if (!plain) throw new Error("Message cannot be empty")

  const { error } = await supabase.from("club_reading_comments").insert({
    club_id: clubId,
    title_id: club.current_title_id,
    user_id: profileId,
    content: cleaned,
    likes_count: 0,
  })

  if (error) throw new Error("Failed to add comment")

  revalidatePath(`/community/clubs/${clubId}`)
}

export async function upvoteClubCurrentReadingComment(commentId: string) {
  const supabase = await createServerClient()
  const admin = createAdminClient()

  const { data: comment, error: commentError } = await supabase
    .from("club_reading_comments")
    .select("id, club_id, likes_count")
    .eq("id", commentId)
    .single()

  if (commentError || !comment) throw new Error("Comment not found")

  await requireMemberOrOwner(supabase, comment.club_id)

  const nextCount = (comment.likes_count ?? 0) + 1
  const { error } = await admin
    .from("club_reading_comments")
    .update({ likes_count: nextCount })
    .eq("id", commentId)

  if (error) throw new Error("Failed to upvote")

  revalidatePath(`/community/clubs/${comment.club_id}`)
}

export async function createClub(type: ClubType, name: string, description: string, categories: Genre[] = []) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const safeCategories = normalizeGenres(categories)

  const { data, error } = await supabase
    .from("clubs")
    .insert({
      type,
      name,
      description: description || null,
      categories: safeCategories.length ? safeCategories : null,
      owner_user_id: profileId,
    })
    .select("id")
    .single()

  if (error || !data) throw new Error("Failed to create club")

  await supabase.from("activity_events").insert({
    user_profile_id: profileId,
    event_type: "club_created",
    metadata: {
      club: {
        id: data.id as string,
        name,
        avatar_url: null,
      },
    },
  })

  revalidatePath("/community")
  revalidatePath(`/community/clubs/${data.id}`)

  return data.id as string
}

export async function updateClub(clubId: string, updates: { name: string; description: string; type: ClubType }) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase
    .from("clubs")
    .update({
      name: updates.name,
      description: updates.description || null,
      type: updates.type,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId)

  if (error) throw new Error("Failed to update club")

  revalidatePath("/community")
  revalidatePath(`/community/clubs/${clubId}`)
}

export async function updateClubSettings(
  clubId: string,
  updates: { name: string; description: string; avatarUrl: string; categories: Genre[] }
) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const safeCategories = normalizeGenres(updates.categories)
  const avatarUrl = updates.avatarUrl.trim() || null

  const { error } = await supabase
    .from("clubs")
    .update({
      name: updates.name.trim(),
      description: updates.description.trim() || null,
      avatar_url: avatarUrl,
      categories: safeCategories.length ? safeCategories : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId)

  if (error) throw new Error("Failed to update club")

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/community")
}

export async function inviteMemberToClub(clubId: string, username: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const handle = username.trim()
  if (!handle) throw new Error("Username required")

  const { data: profile, error: profileError } = await supabase
    .from("public_profiles")
    .select("id")
    .eq("username", handle)
    .single()

  if (profileError || !profile) throw new Error("User not found")

  const { data: existing } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", profile.id)
    .maybeSingle()

  if (existing) return

  const { error } = await supabase.from("club_members").insert({
    club_id: clubId,
    user_id: profile.id,
  })

  if (error) throw new Error("Failed to invite")

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
}

export async function kickMemberFromClub(clubId: string, memberProfileId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { data: club } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .single()

  if (club?.owner_user_id === memberProfileId) throw new Error("Cannot remove owner")

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", memberProfileId)

  if (error) throw new Error("Failed to remove member")

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
}

export async function addClubReadingItem(
  clubId: string,
  input: { titleId?: string; title?: string; author?: string }
) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const titleId = input.titleId?.trim() || null
  const title = input.title?.trim() || null
  const author = input.author?.trim() || null

  if (!titleId && !title) throw new Error("Provide a title id or title")

  const payload: Record<string, any> = {
    club_id: clubId,
    title,
    author,
  }

  if (titleId) {
    payload.title_id = titleId
  }

  const { error } = await supabase.from("club_reading_items").insert(payload)

  if (error) {
    const message = `${error.message ?? ""}`
    const isMissingColumn = error.code === "42703" || message.includes("column") && message.includes("title_id")

    if (isMissingColumn) {
      const { error: fallbackError } = await supabase.from("club_reading_items").insert({
        club_id: clubId,
        title,
        author,
      })

      if (fallbackError) {
        console.error("Failed to add title (fallback)", fallbackError)
        throw new Error("Failed to add title")
      }
    } else {
      console.error("Failed to add title", error)
      throw new Error("Failed to add title")
    }
  }

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
}

export async function removeClubReadingItem(clubId: string, itemId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase
    .from("club_reading_items")
    .delete()
    .eq("id", itemId)
    .eq("club_id", clubId)

  if (error) throw new Error("Failed to remove title")

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
}

export async function uploadClubAvatar(clubId: string, formData: FormData) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("Missing file")
  if (!file.type.startsWith("image/")) throw new Error("File must be an image")
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be <= 5MB")

  let resized
  try {
    resized = await resizeAvatarImage(file, 200)
  } catch (error) {
    console.error(error)
    throw new Error("Unsupported or invalid image")
  }

  const path = `clubs/${clubId}/${randomUUID()}.${resized.ext}`

  const { error: uploadError } = await supabase.storage
    .from("club-avatars")
    .upload(path, resized.buffer, { upsert: true, contentType: resized.contentType })

  if (uploadError) throw new Error("Failed to upload avatar")

  const { data: publicUrlData } = supabase.storage.from("club-avatars").getPublicUrl(path)
  const publicUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from("clubs")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", clubId)

  if (updateError) throw new Error("Failed to save avatar")

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/community")

  return publicUrl
}


export async function getMyMembership(clubId: string) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { isMember: false, profileId: null as string | null }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (!profile) return { isMember: false, profileId: null as string | null }

  const { data: membership } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", profile.id)
    .maybeSingle()

  if (membership) return { isMember: true, profileId: profile.id as string }

  const { data: club } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .maybeSingle()

  if (club?.owner_user_id === profile.id) {
    return { isMember: true, profileId: profile.id as string }
  }

  return { isMember: false, profileId: profile.id as string }
}

export async function getMyProfile() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { profileId: null as string | null, role: null as string | null }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single()

  if (!profile) return { profileId: null as string | null, role: null as string | null }

  return { profileId: profile.id as string, role: (profile.role as string | null) ?? null }
}

export async function getClubMembers(clubId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("club_members")
    .select("user_id, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club members:", error)
    return [] as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }>
  }

  const memberIds = Array.from(
    new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean) as string[])
  )

  const { data: memberProfiles } = memberIds.length
    ? await supabase
        .from("public_profiles")
        .select("id,username,avatar_url,role")
        .in("id", memberIds)
    : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }> }

  const memberMap = new Map(
    (memberProfiles ?? []).map((member) => [member.id as string, member])
  )

  const members = (data ?? [])
    .map((row: any) => memberMap.get(row.user_id as string))
    .filter(Boolean) as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }>

  const { data: club } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .maybeSingle()

  const { data: owner } = club?.owner_user_id
    ? await supabase
        .from("public_profiles")
        .select("id,username,avatar_url,role")
        .eq("id", club.owner_user_id)
        .maybeSingle()
    : { data: null as { id: string; username: string | null; avatar_url: string | null; role: string | null } | null }

  if (owner && !members.some((m) => m.id === owner.id)) {
    return [owner, ...members]
  }

  return members
}

export async function getClubReadingItems(clubId: string) {
  const supabase = await createServerClient()

  const { data: items, error } = await supabase
    .from("club_reading_items")
    .select("id, title_id, title, author, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club reading items:", error)
    return [] as Array<{
      id: string
      title_id: string | null
      title: string | null
      author: string | null
      created_at: string
      title_data?: { id: string; title: string; author: string; cover_image_url: string | null } | null
    }>
  }

  const titleIds = (items ?? []).map((i) => i.title_id).filter(Boolean) as string[]

  const titlesRes = titleIds.length
    ? await supabase
        .from("titles")
        .select("id, title, author, cover_image_url")
        .in("id", titleIds)
    : { data: [] as any[] }

  const titleMap = new Map((titlesRes.data ?? []).map((t: any) => [t.id, t]))

  return (items ?? []).map((item: any) => ({
    ...item,
    title_data: item.title_id ? titleMap.get(item.title_id) ?? null : null,
  }))
}

export async function applyToClub(clubId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: existingMember } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", profileId)
    .maybeSingle()

  if (existingMember) return

  const { data: existingApp } = await supabase
    .from("club_applications")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", profileId)
    .maybeSingle()

  if (existingApp) return

  const { error } = await supabase.from("club_applications").insert({
    club_id: clubId,
    user_id: profileId,
    status: "pending",
  })

  if (error) throw new Error("Failed to apply")

  revalidatePath(`/community/clubs/${clubId}`)
}

export async function joinClub(clubId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { error } = await supabase.from("club_members").insert({
    club_id: clubId,
    user_id: profileId,
  })

  if (error) throw new Error("Failed to join club")

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, avatar_url")
    .eq("id", clubId)
    .maybeSingle()

  await supabase.from("activity_events").insert({
    user_profile_id: profileId,
    event_type: "club_joined",
    metadata: {
      club: {
        id: clubId,
        name: club?.name ?? "a club",
        avatar_url: (club as any)?.avatar_url ?? null,
      },
    },
  })

  revalidatePath(`/community/clubs/${clubId}`)
}

export async function leaveClub(clubId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", profileId)

  if (error) throw new Error("Failed to leave club")

  revalidatePath(`/community/clubs/${clubId}`)
}
