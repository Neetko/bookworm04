"use server"

import { createServerClient } from "@/lib/supabase-server"
import { requireAuthedProfileId } from "@/lib/server/auth"
import {
  ensureCurrentReadingListForProfile,
  ensureFinishedReadingListForProfile,
  ensureToReadListForProfile,
} from "@/lib/server/title-lists"
import { revalidatePath } from "next/cache"

export type TitleListSummary = {
  id: string
  name: string
  listType: string
  isPublic: boolean
  isDefault: boolean
  likesCount: number
  items: Array<{
    titleId: string
    title: string
    author: string
    coverImageUrl: string | null
  }>
}

export async function ensureToReadList(profileId: string) {
  const supabase = await createServerClient()
  const listId = await ensureToReadListForProfile(supabase, profileId)
  if (!listId) throw new Error("Failed to create to-read list")
  return listId
}

export async function ensureCurrentReadingList(profileId: string) {
  const supabase = await createServerClient()
  const listId = await ensureCurrentReadingListForProfile(supabase, profileId)
  if (!listId) throw new Error("Failed to create current reading list")
  return listId
}

export async function ensureFinishedReadingList(profileId: string) {
  const supabase = await createServerClient()
  const listId = await ensureFinishedReadingListForProfile(supabase, profileId)
  if (!listId) throw new Error("Failed to create finished reading list")
  return listId
}

export async function getMyListsAction(): Promise<TitleListSummary[]> {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  await ensureToReadList(profileId)
  await ensureCurrentReadingList(profileId)
  await ensureFinishedReadingList(profileId)

  const { data: lists, error } = await supabase
    .from("title_lists")
    .select("id,name,list_type,is_public,is_default")
    .eq("user_profile_id", profileId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to load lists", error)
    return []
  }

  const listIds = (lists ?? []).map((list) => list.id)
  const { data: likes } = await supabase
    .from("title_list_likes")
    .select("list_id")
    .in("list_id", listIds)

  const likesCountMap = new Map<string, number>()
  for (const row of likes ?? []) {
    const listId = (row as any).list_id as string
    likesCountMap.set(listId, (likesCountMap.get(listId) ?? 0) + 1)
  }

  const { data: items } = await supabase
    .from("title_list_items")
    .select("list_id, title_id, titles ( id, title, author, cover_image_url )")
    .in("list_id", listIds)

  const itemsByList = new Map<string, TitleListSummary["items"]>()
  for (const row of items ?? []) {
    const listId = (row as any).list_id as string
    const title = (row as any).titles
    if (!itemsByList.has(listId)) itemsByList.set(listId, [])
    itemsByList.get(listId)!.push({
      titleId: title?.id ?? (row as any).title_id,
      title: title?.title ?? "Untitled",
      author: title?.author ?? "Unknown author",
      coverImageUrl: title?.cover_image_url ?? null,
    })
  }

  return (lists ?? []).map((list) => ({
    id: list.id as string,
    name: list.name as string,
    listType: list.list_type as string,
    isPublic: Boolean(list.is_public),
    isDefault: Boolean(list.is_default),
    likesCount: likesCountMap.get(list.id) ?? 0,
    items: itemsByList.get(list.id) ?? [],
  }))
}

export async function createCustomListAction(input: { name: string; isPublic: boolean }) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const name = input.name.trim()
  if (!name) throw new Error("List name is required")

  const { data, error } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: profileId,
      name,
      list_type: "custom",
      is_public: input.isPublic,
      is_default: false,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    console.error("Failed to create list", error)
    throw new Error("Failed to create list")
  }

  await supabase.from("activity_events").insert({
    user_profile_id: profileId,
    event_type: "list_created",
    metadata: {
      list: {
        id: data.id as string,
        name,
      },
    },
  })

  revalidatePath("/profile")
  return { listId: data.id as string }
}

export async function updateCustomListAction(input: { listId: string; name: string; isPublic: boolean }) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const name = input.name.trim()
  if (!name) throw new Error("List name is required")

  const { data: list, error: listError } = await supabase
    .from("title_lists")
    .select("id, user_profile_id, is_default")
    .eq("id", input.listId)
    .single()

  if (listError || !list?.id) throw new Error("List not found")
  if (list.user_profile_id !== profileId) throw new Error("Forbidden")
  if (list.is_default) throw new Error("Default lists cannot be edited")

  const { error } = await supabase
    .from("title_lists")
    .update({
      name,
      is_public: input.isPublic,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.listId)

  if (error) {
    console.error("Failed to update list", error)
    throw new Error("Failed to update list")
  }

  revalidatePath("/profile")
  return { listId: input.listId }
}

export async function addTitleToListAction(input: { listId: string; titleId: string }) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: list, error: listError } = await supabase
    .from("title_lists")
    .select("id, user_profile_id, name, list_type")
    .eq("id", input.listId)
    .single()

  if (listError || !list?.id) throw new Error("List not found")
  if (list.user_profile_id !== profileId) throw new Error("Forbidden")

  const { data: existingItem } = await supabase
    .from("title_list_items")
    .select("id")
    .eq("list_id", input.listId)
    .eq("title_id", input.titleId)
    .maybeSingle()

  if (existingItem?.id) {
    revalidatePath("/profile")
    revalidatePath(`/titles/${input.titleId}`)
    return { listId: input.listId }
  }

  const { error } = await supabase
    .from("title_list_items")
    .upsert(
      { list_id: input.listId, title_id: input.titleId },
      { onConflict: "list_id,title_id" }
    )

  if (error) {
    console.error("Failed to add title to list", error)
    throw new Error("Failed to add title to list")
  }

  if (list.list_type === "custom") {
    const { data: title } = await supabase
      .from("titles")
      .select("id, title, cover_image_url")
      .eq("id", input.titleId)
      .maybeSingle()

    await supabase.from("activity_events").insert({
      user_profile_id: profileId,
      title_id: input.titleId,
      event_type: "list_item_added",
      metadata: {
        title: {
          id: input.titleId,
          title: title?.title ?? "a title",
          cover: (title as any)?.cover_image_url ?? null,
        },
        list: {
          id: list.id as string,
          name: (list as any).name ?? "a list",
        },
      },
    })
  }

  revalidatePath("/profile")
  revalidatePath(`/titles/${input.titleId}`)
  return { listId: input.listId }
}

export async function removeTitleFromListAction(input: { listId: string; titleId: string }) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: list, error: listError } = await supabase
    .from("title_lists")
    .select("id, user_profile_id")
    .eq("id", input.listId)
    .single()

  if (listError || !list?.id) throw new Error("List not found")
  if (list.user_profile_id !== profileId) throw new Error("Forbidden")

  const { error } = await supabase
    .from("title_list_items")
    .delete()
    .eq("list_id", input.listId)
    .eq("title_id", input.titleId)

  if (error) {
    console.error("Failed to remove title from list", error)
    throw new Error("Failed to remove title from list")
  }

  revalidatePath("/profile")
  revalidatePath(`/titles/${input.titleId}`)
  return { listId: input.listId }
}

export async function removeTitleFromToReadAction(titleId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  const listId = await ensureToReadList(profileId)

  await supabase
    .from("title_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("title_id", titleId)

  revalidatePath("/profile")
  revalidatePath(`/titles/${titleId}`)
}

export async function toggleListLikeAction(listId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: existing } = await supabase
    .from("title_list_likes")
    .select("id")
    .eq("list_id", listId)
    .eq("user_profile_id", profileId)
    .maybeSingle()

  if (existing?.id) {
    await supabase.from("title_list_likes").delete().eq("id", existing.id)
  } else {
    await supabase.from("title_list_likes").insert({ list_id: listId, user_profile_id: profileId })
  }

  revalidatePath("/profile")
  revalidatePath("/users")
  return { listId }
}
