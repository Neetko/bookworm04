import "server-only"

import type { createServerClient } from "@/lib/supabase-server"

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>
export type DefaultTitleListType = "to-read" | "current-reading" | "finished-reading"

const DEFAULT_LIST_NAMES: Record<DefaultTitleListType, string> = {
  "to-read": "Planned Reading",
  "current-reading": "Current Reading",
  "finished-reading": "Finished Reading",
}

export async function ensureDefaultTitleList(
  supabase: SupabaseServerClient,
  profileId: string,
  listType: DefaultTitleListType
) {
  const { data: existing, error } = await supabase
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("list_type", listType)
    .maybeSingle()

  if (error) {
    console.error(`Failed to load ${listType} list`, error)
  }

  if (existing?.id) return existing.id as string

  const { data: created, error: createError } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: profileId,
      name: DEFAULT_LIST_NAMES[listType],
      list_type: listType,
      is_public: false,
      is_default: true,
    })
    .select("id")
    .single()

  if (createError || !created?.id) {
    console.error(`Failed to create ${listType} list`, createError)
    return null
  }

  return created.id as string
}

export function ensureToReadListForProfile(supabase: SupabaseServerClient, profileId: string) {
  return ensureDefaultTitleList(supabase, profileId, "to-read")
}

export function ensureCurrentReadingListForProfile(supabase: SupabaseServerClient, profileId: string) {
  return ensureDefaultTitleList(supabase, profileId, "current-reading")
}

export function ensureFinishedReadingListForProfile(supabase: SupabaseServerClient, profileId: string) {
  return ensureDefaultTitleList(supabase, profileId, "finished-reading")
}

export async function removeTitleFromDefaultList(
  supabase: SupabaseServerClient,
  profileId: string,
  titleId: string,
  listType: DefaultTitleListType
) {
  const listId = await ensureDefaultTitleList(supabase, profileId, listType)
  if (!listId) return

  await supabase
    .from("title_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("title_id", titleId)
}

export async function addTitleToDefaultList(
  supabase: SupabaseServerClient,
  profileId: string,
  titleId: string,
  listType: DefaultTitleListType
) {
  const listId = await ensureDefaultTitleList(supabase, profileId, listType)
  if (!listId) return

  await supabase
    .from("title_list_items")
    .upsert({ list_id: listId, title_id: titleId }, { onConflict: "list_id,title_id" })
}
