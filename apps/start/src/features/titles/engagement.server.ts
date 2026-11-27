import { z } from "zod"
import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { diaryNoteHtml, diaryNoteText } from "../diary/content"
import { isGenre, normalizeGenres, type Genre } from "./catalog"

const UUID = z.string().uuid()
const progressSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("pages"),
    currentPage: z.number().int().min(0).max(1_000_000),
    totalPages: z.number().int().min(1).max(1_000_000),
  }).strict().refine((value) => value.currentPage <= value.totalPages),
  z.object({
    mode: z.literal("audiobook"),
    minutesListened: z.number().int().min(0).max(1_000_000),
    totalMinutes: z.number().int().min(1).max(1_000_000),
  }).strict().refine((value) => value.minutesListened <= value.totalMinutes),
])
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set-read"), isRead: z.boolean() }).strict(),
  z.object({
    action: z.literal("track-progress"),
    progress: progressSchema,
    noteText: z.string().max(10_000).optional().default(""),
  }).strict(),
])

type Supabase = ReturnType<typeof createRequestSupabaseClient>
type ReadingLists = Map<string, string>

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

async function identity() {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase.from("user_profiles")
    .select("id").eq("auth_user_id", user.id).maybeSingle()
  return profile?.id ? { supabase, profileId: profile.id as string } : null
}

async function ensureReadingLists(supabase: Supabase, profileId: string): Promise<ReadingLists | null> {
  const load = () => supabase.from("title_lists").select("id,list_type")
    .eq("user_profile_id", profileId)
    .in("list_type", ["to-read", "current-reading", "finished-reading"])
    .limit(10)
  let result = await load()
  if (result.error) return null
  let lists = new Map((result.data ?? []).map((list) => [String(list.list_type), list.id as string]))
  if (lists.size === 3) return lists

  const rows = [
    { user_profile_id: profileId, name: "Planned Reading", list_type: "to-read", is_public: false, is_default: true },
    { user_profile_id: profileId, name: "Current Reading", list_type: "current-reading", is_public: false, is_default: true },
    { user_profile_id: profileId, name: "Finished Reading", list_type: "finished-reading", is_public: false, is_default: true },
  ]
  const writer = createAdminSupabaseClient() ?? supabase
  const { error } = await writer.from("title_lists")
    .upsert(rows, { onConflict: "user_profile_id,list_type", ignoreDuplicates: true })
  if (error) return null
  result = await load()
  if (result.error) return null
  lists = new Map((result.data ?? []).map((list) => [String(list.list_type), list.id as string]))
  return lists.size === 3 ? lists : null
}

async function addToList(supabase: Supabase, listId: string | undefined, titleId: string) {
  if (!listId) throw new Error("Required reading list is missing")
  const { error } = await supabase.from("title_list_items")
    .upsert({ list_id: listId, title_id: titleId }, { onConflict: "list_id,title_id" })
  if (error) throw new Error("Could not update reading lists")
}

async function removeFromList(supabase: Supabase, listId: string | undefined, titleId: string) {
  if (!listId) return
  const { error } = await supabase.from("title_list_items")
    .delete().eq("list_id", listId).eq("title_id", titleId)
  if (error) throw new Error("Could not update reading lists")
}

async function awardCompletionPoints(supabase: Supabase, profileId: string, titleId: string) {
  const [titleResult, ownedResult, membershipResult] = await Promise.all([
    supabase.from("titles").select("genre").eq("id", titleId).maybeSingle(),
    supabase.from("clubs").select("id,categories").eq("owner_user_id", profileId).limit(100),
    supabase.from("club_members").select("club_id").eq("user_id", profileId).limit(100),
  ])
  if (titleResult.error || ownedResult.error || membershipResult.error) throw new Error("Could not calculate completion points")
  const genres = normalizeGenres(Array.isArray(titleResult.data?.genre)
    ? titleResult.data.genre.filter(isGenre).join(",")
    : "")
  if (!genres.length) return

  const memberClubIds = (membershipResult.data ?? []).map((row) => row.club_id as string)
  const { data: memberClubs, error: memberClubError } = memberClubIds.length
    ? await supabase.from("clubs").select("id,categories").in("id", memberClubIds).limit(100)
    : { data: [], error: null }
  if (memberClubError) throw new Error("Could not calculate completion points")
  const ownerGenres = new Set<Genre>((ownedResult.data ?? []).flatMap((club) => normalizeGenres(
    Array.isArray(club.categories) ? club.categories.join(",") : "",
  )))
  const memberGenres = new Set<Genre>((memberClubs ?? []).flatMap((club) => normalizeGenres(
    Array.isArray(club.categories) ? club.categories.join(",") : "",
  )))
  const rows = genres.flatMap((genre) => {
    const base = { user_profile_id: profileId, title_id: titleId, genre, source_id: titleId }
    const bonus = ownerGenres.has(genre)
      ? [{ ...base, points: 2, source_type: "club_bonus", reason: "club_owner" }]
      : memberGenres.has(genre)
        ? [{ ...base, points: 1, source_type: "club_bonus", reason: "club_member" }]
        : []
    return [{ ...base, points: 3, source_type: "title_read", reason: "completed_reading" }, ...bonus]
  })
  const admin = createAdminSupabaseClient()
  if (!admin) throw new Error("Reward service is not configured")
  const { error } = await admin.from("user_genre_points").upsert(rows, {
    onConflict: "user_profile_id,source_type,source_id,genre,reason",
    ignoreDuplicates: true,
  })
  if (error) throw new Error("Could not award completion points")
}

async function recordCompletion(supabase: Supabase, profileId: string, titleId: string) {
  const { data: title } = await supabase.from("titles").select("title,cover_image_url").eq("id", titleId).maybeSingle()
  const { error } = await supabase.from("activity_events").insert({
    user_profile_id: profileId,
    title_id: titleId,
    event_type: "title_finished",
    metadata: { title: { id: titleId, title: title?.title ?? "a title", cover: title?.cover_image_url ?? null } },
  })
  if (error) console.error("Could not record title completion", error)
}

async function completeTitle(supabase: Supabase, profileId: string, lists: ReadingLists, titleId: string) {
  const finishedId = lists.get("finished-reading")
  if (!finishedId) throw new Error("Finished Reading list is missing")
  const { data: existing, error } = await supabase.from("title_list_items")
    .select("title_id").eq("list_id", finishedId).eq("title_id", titleId).maybeSingle()
  if (error) throw new Error("Could not check completion state")
  if (!existing) {
    await addToList(supabase, finishedId, titleId)
    await recordCompletion(supabase, profileId, titleId)
  }
  await awardCompletionPoints(supabase, profileId, titleId)
  await removeFromList(supabase, lists.get("current-reading"), titleId)
  await removeFromList(supabase, lists.get("to-read"), titleId)
}

async function setReadStatus(supabase: Supabase, profileId: string, lists: ReadingLists, titleId: string, isRead: boolean) {
  if (isRead) {
    await completeTitle(supabase, profileId, lists, titleId)
    const { error } = await supabase.from("title_user_progress").upsert({
      user_profile_id: profileId,
      title_id: titleId,
      progress_percent: 100,
      is_completed: true,
      last_read_at: new Date().toISOString(),
    }, { onConflict: "user_profile_id,title_id" })
    if (error) throw new Error("Could not update read status")
    return
  }

  await removeFromList(supabase, lists.get("finished-reading"), titleId)
  const { error } = await supabase.from("title_user_progress")
    .delete().eq("user_profile_id", profileId).eq("title_id", titleId).eq("is_completed", true)
  if (error) throw new Error("Could not update read status")
}

async function trackProgress(
  supabase: Supabase,
  profileId: string,
  lists: ReadingLists,
  titleId: string,
  input: Extract<z.infer<typeof mutationSchema>, { action: "track-progress" }>,
) {
  const progress = input.progress
  const percent = progress.mode === "pages"
    ? Math.round((progress.currentPage / progress.totalPages) * 100)
    : Math.round((progress.minutesListened / progress.totalMinutes) * 100)
  const completed = percent >= 100
  const now = new Date()
  const values = progress.mode === "pages"
    ? { current_page: progress.currentPage, total_pages: progress.totalPages, minutes_listened: null, total_minutes: null }
    : { current_page: 0, total_pages: null, minutes_listened: progress.minutesListened, total_minutes: progress.totalMinutes }
  const { error: progressError } = await supabase.from("title_user_progress").upsert({
    user_profile_id: profileId,
    title_id: titleId,
    ...values,
    progress_percent: percent,
    is_completed: completed,
    last_read_at: now.toISOString(),
  }, { onConflict: "user_profile_id,title_id" })
  if (progressError) throw new Error("Could not save reading progress")

  const today = now.toISOString().slice(0, 10)
  const { data: existing, error: existingError } = await supabase.from("reading_diary_entries")
    .select("id").eq("user_profile_id", profileId).eq("title_id", titleId)
    .eq("entry_date", today).order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (existingError) throw new Error("Could not save diary entry")
  const noteText = diaryNoteText(input.noteText)
  const noteFields = noteText ? { note_text: noteText, note_html: diaryNoteHtml(noteText) } : {}
  const entryValues = {
    ...values,
    ...noteFields,
    progress_mode: progress.mode,
    progress_percent: percent,
    is_completed: completed,
  }
  const entryWrite = existing?.id
    ? await supabase.from("reading_diary_entries").update(entryValues)
        .eq("id", existing.id).eq("user_profile_id", profileId).select("id").maybeSingle()
    : await supabase.from("reading_diary_entries").insert({
        ...entryValues,
        user_profile_id: profileId,
        title_id: titleId,
        entry_date: today,
        note_text: noteText || null,
        note_html: diaryNoteHtml(noteText),
      }).select("id").single()
  if (entryWrite.error || !entryWrite.data) throw new Error("Could not save diary entry")

  if (completed) await completeTitle(supabase, profileId, lists, titleId)
  else if (percent > 0) {
    await addToList(supabase, lists.get("current-reading"), titleId)
    await removeFromList(supabase, lists.get("to-read"), titleId)
  } else {
    await removeFromList(supabase, lists.get("current-reading"), titleId)
  }
}

export async function handleTitleEngagement(request: Request, rawTitleId: string): Promise<Response> {
  const titleId = UUID.safeParse(rawTitleId)
  if (!titleId.success) return json({ error: "Title not found" }, 404)
  const body = await readBoundedJson(request, 32_000)
  if (!body.ok) return json({ error: body.error }, body.status)
  const parsed = mutationSchema.safeParse(body.value)
  if (!parsed.success) return json({ error: "Invalid title update" }, 400)
  const actor = await identity()
  if (!actor) return json({ error: "Sign in to update your reading" }, 401)
  const { data: title } = await actor.supabase.from("titles").select("id").eq("id", titleId.data).maybeSingle()
  if (!title) return json({ error: "Title not found" }, 404)
  const lists = await ensureReadingLists(actor.supabase, actor.profileId)
  if (!lists) return json({ error: "Could not load reading lists" }, 500)

  try {
    if (parsed.data.action === "set-read") {
      await setReadStatus(actor.supabase, actor.profileId, lists, titleId.data, parsed.data.isRead)
    } else {
      await trackProgress(actor.supabase, actor.profileId, lists, titleId.data, parsed.data)
    }
  } catch (error) {
    console.error("Title engagement update failed", error)
    return json({ error: error instanceof Error ? error.message : "Could not update title" }, 500)
  }
  return json({ success: true }, 200)
}
