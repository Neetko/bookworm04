import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { MAX_CUSTOM_LISTS, MAX_TITLES_PER_LIST, parseListMutation } from "./validation"

const maxRequestBytes = 8_192

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

async function getIdentity() {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null
  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("id").eq("auth_user_id", user.id).maybeSingle()
  if (profileError || !profile) return null
  return { supabase, profileId: profile.id as string }
}

export async function handleListMutation(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, maxRequestBytes)
  if (!body.ok) return json({ error: body.error }, body.status)
  const input = parseListMutation(body.value)
  if (!input) return json({ error: "Invalid list update" }, 400)
  const identity = await getIdentity()
  if (!identity) return json({ error: "Unauthorized" }, 401)
  const { supabase, profileId } = identity
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "List service is not configured" }, 503)

  if (input.action === "create") {
    const { count, error: countError } = await supabase.from("title_lists")
      .select("id", { count: "exact", head: true })
      .eq("user_profile_id", profileId).eq("list_type", "custom")
    if (countError) return json({ error: "Could not check list limit" }, 500)
    if ((count ?? 0) >= MAX_CUSTOM_LISTS) return json({ error: "Custom list limit reached" }, 409)
    const { data, error } = await admin.from("title_lists").insert({
      user_profile_id: profileId,
      name: input.name,
      list_type: "custom",
      is_public: input.isPublic,
      is_default: false,
    }).select("id").single()
    if (error || !data) return json({ error: "Could not create list" }, 500)
    const { error: activityError } = await supabase.from("activity_events").insert({
      user_profile_id: profileId,
      event_type: "list_created",
      metadata: { list: { id: data.id, name: input.name } },
    })
    if (activityError) console.error("List activity insert failed", activityError)
    return json({ id: data.id as string }, 201)
  }

  const { data: list, error: listError } = await supabase.from("title_lists")
    .select("id,name,list_type,is_default,user_profile_id")
    .eq("id", input.listId).eq("user_profile_id", profileId).maybeSingle()
  if (listError) return json({ error: "Could not load list" }, 500)
  if (!list) return json({ error: "List not found" }, 404)

  if (input.action === "update") {
    if (list.is_default || list.list_type !== "custom") return json({ error: "Default lists cannot be renamed" }, 409)
    const { data: updated, error } = await admin.from("title_lists").update({
      name: input.name,
      is_public: input.isPublic,
      updated_at: new Date().toISOString(),
    }).eq("id", input.listId).eq("user_profile_id", profileId)
      .eq("list_type", "custom").select("id").maybeSingle()
    if (error || !updated) return json({ error: "Could not update list" }, 500)
    return json({ success: true }, 200)
  }

  if (input.action === "remove") {
    const { error } = await admin.from("title_list_items").delete()
      .eq("list_id", input.listId).eq("title_id", input.titleId)
    if (error) return json({ error: "Could not remove title" }, 500)
    return json({ success: true }, 200)
  }

  const { data: title, error: titleError } = await supabase.from("titles")
    .select("id,title").eq("id", input.titleId).maybeSingle()
  if (titleError || !title) return json({ error: "Title not found" }, 404)
  const { data: existing, error: existingError } = await supabase.from("title_list_items")
    .select("id").eq("list_id", input.listId).eq("title_id", input.titleId).maybeSingle()
  if (existingError) return json({ error: "Could not check list" }, 500)
  if (!existing) {
    const { count, error: countError } = await supabase.from("title_list_items")
      .select("id", { count: "exact", head: true }).eq("list_id", input.listId)
    if (countError) return json({ error: "Could not check list limit" }, 500)
    if ((count ?? 0) >= MAX_TITLES_PER_LIST) return json({ error: "Title limit reached for this list" }, 409)
    const { error } = await admin.from("title_list_items")
      .upsert({ list_id: input.listId, title_id: input.titleId }, { onConflict: "list_id,title_id" })
    if (error) return json({ error: "Could not add title" }, 500)
  }

  if (list.list_type !== "custom") {
    const { data: otherLists, error: otherListError } = await supabase.from("title_lists")
      .select("id").eq("user_profile_id", profileId).eq("is_default", true).neq("id", input.listId).limit(10)
    if (otherListError) return json({ error: "Title added, but other lists could not be updated" }, 500)
    const otherIds = (otherLists ?? []).map((row) => row.id as string)
    if (otherIds.length) {
      const { error } = await admin.from("title_list_items").delete()
        .in("list_id", otherIds).eq("title_id", input.titleId)
      if (error) return json({ error: "Title added, but other lists could not be updated" }, 500)
    }
  } else if (!existing) {
    const { error: activityError } = await supabase.from("activity_events").insert({
      user_profile_id: profileId,
      title_id: input.titleId,
      event_type: "list_item_added",
      metadata: {
        title: { id: input.titleId, title: title.title ?? "a title" },
        list: { id: list.id, name: list.name ?? "a list" },
      },
    })
    if (activityError) console.error("List item activity insert failed", activityError)
  }
  return json({ success: true }, 200)
}
