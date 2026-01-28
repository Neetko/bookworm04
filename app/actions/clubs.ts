"use server"

import { createServerClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { normalizeGenres, type Genre } from "@/lib/types"
import { randomUUID } from "crypto"

export type ClubType = "book" | "writer"

export interface ClubBase {
  id: string
  type: ClubType
  name: string
  description: string | null
  categories: Genre[] | null
  avatar_url: string | null
  owner_user_id: string
  created_at: string
  updated_at: string
}

export interface ClubSummary extends ClubBase {
  memberCount: number
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
    return [] as ClubSummary[]
  }

  const clubs = (data ?? []) as ClubBase[]

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
  })) as ClubSummary[]
}

export async function getClub(clubId: string) {
  const supabase = await createServerClient()

  const { data: club, error } = await supabase
    .from("clubs")
    .select(
      `
      *,
      owner:user_profiles!clubs_owner_user_id_user_profiles_id_fk (
        username,
        avatar_url,
        role,
        created_at
      )
    `
    )
    .eq("id", clubId)
    .single()

  if (error) {
    console.error("Error fetching club:", error)
    return null
  }

  return club as unknown as ClubWithOwner
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
    .from("user_profiles")
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
  input: { bookId?: string; title?: string; author?: string }
) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const bookId = input.bookId?.trim() || null
  const title = input.title?.trim() || null
  const author = input.author?.trim() || null

  if (!bookId && !title) throw new Error("Provide a book id or title")

  const { error } = await supabase.from("club_reading_items").insert({
    club_id: clubId,
    book_id: bookId,
    title,
    author,
  })

  if (error) throw new Error("Failed to add title")

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

  const original = file.name || "upload"
  const ext = (original.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "")
  const safeExt = ext || "png"
  const path = `clubs/${clubId}/${randomUUID()}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from("club-avatars")
    .upload(path, file, { upsert: true, contentType: file.type })

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

export async function uploadBookCover(bookId: string, formData: FormData) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: me, error: meError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", profileId)
    .single()

  if (meError || !me) throw new Error("Unauthorized")
  if (me.role !== "Admin") throw new Error("Forbidden")

  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("Missing file")
  if (!file.type.startsWith("image/")) throw new Error("File must be an image")
  if (file.size > 10 * 1024 * 1024) throw new Error("Image must be <= 10MB")

  const original = file.name || "upload"
  const ext = (original.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")
  const safeExt = ext || "jpg"
  const path = `books/${bookId}/${randomUUID()}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from("book-covers")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) throw new Error("Failed to upload cover")

  const { data: publicUrlData } = supabase.storage.from("book-covers").getPublicUrl(path)
  const publicUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from("books")
    .update({ cover_image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", bookId)

  if (updateError) throw new Error("Failed to save cover")

  revalidatePath(`/books/${bookId}`)
  revalidatePath(`/books/${bookId}/read`)
  revalidatePath("/")

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

  return { isMember: !!membership, profileId: profile.id as string }
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
    .select(
      `
      user:user_profiles!club_members_user_id_user_profiles_id_fk (
        id,
        username,
        avatar_url,
        role
      ),
      created_at
    `
    )
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club members:", error)
    return [] as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }>
  }

  return (data ?? [])
    .map((row: any) => row.user)
    .filter(Boolean) as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }>
}

export async function getClubReadingItems(clubId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("club_reading_items")
    .select(
      `
      id,
      book_id,
      title,
      author,
      created_at,
      book:books!club_reading_items_book_id_books_id_fk (
        id,
        title,
        author
      )
    `
    )
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club reading items:", error)
    return [] as Array<{
      id: string
      book_id: string | null
      title: string | null
      author: string | null
      book: { id: string; title: string; author: string } | null
    }>
  }

  return (data ?? []) as any
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
