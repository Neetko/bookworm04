"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export type ClubType = "book" | "writer"

export interface ClubSummary {
  id: string
  type: ClubType
  name: string
  description: string | null
  owner_user_id: string
  created_at: string
  updated_at: string
}

export interface ClubWithOwner extends ClubSummary {
  owner: {
    username: string | null
    avatar_url: string | null
    role: string | null
    created_at: string | null
  } | null
}

async function requireAuthedProfileId(supabase: ReturnType<typeof createServerClient>) {
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

export async function getClubs() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching clubs:", error)
    return [] as ClubSummary[]
  }

  return data as ClubSummary[]
}

export async function getClub(clubId: string) {
  const supabase = createServerClient()

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

export async function createClub(type: ClubType, name: string, description: string) {
  const supabase = createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data, error } = await supabase
    .from("clubs")
    .insert({
      type,
      name,
      description: description || null,
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
  const supabase = createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .single()

  if (clubError || !club) throw new Error("Club not found")
  if (club.owner_user_id !== profileId) throw new Error("Forbidden")

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

export async function getMyMembership(clubId: string) {
  const supabase = createServerClient()

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

export async function joinClub(clubId: string) {
  const supabase = createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { error } = await supabase.from("club_members").insert({
    club_id: clubId,
    user_id: profileId,
  })

  if (error) throw new Error("Failed to join club")

  revalidatePath(`/community/clubs/${clubId}`)
}

export async function leaveClub(clubId: string) {
  const supabase = createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", profileId)

  if (error) throw new Error("Failed to leave club")

  revalidatePath(`/community/clubs/${clubId}`)
}
