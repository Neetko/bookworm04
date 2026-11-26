import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { isGenre, normalizeGenres, type Genre } from "../titles/catalog"
import { diaryNoteHtml, diaryNoteText } from "./content"
import { parseDiaryNoteWrite, parseDiaryProgressWrite } from "./validation"

const maxRequestBytes = 64_000

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

async function getDefaultLists(
  supabase: ReturnType<typeof createRequestSupabaseClient>,
  profileId: string,
) {
  const { data, error } = await supabase.from("title_lists")
    .select("id,list_type").eq("user_profile_id", profileId)
    .in("list_type", ["to-read", "current-reading", "finished-reading"]).limit(10)
  if (error) return null
  return new Map((data ?? []).map((list) => [String(list.list_type), list.id as string]))
}

async function titleIsSelectable(
  supabase: ReturnType<typeof createRequestSupabaseClient>,
  lists: Map<string, string>,
  titleId: string,
) {
  const ids = [lists.get("to-read"), lists.get("current-reading")].filter((id): id is string => Boolean(id))
  if (!ids.length) return false
  const { data, error } = await supabase.from("title_list_items")
    .select("title_id").in("list_id", ids).eq("title_id", titleId).limit(1).maybeSingle()
  return !error && Boolean(data?.title_id)
}

async function removeFromList(
  supabase: ReturnType<typeof createRequestSupabaseClient>,
  listId: string | undefined,
  titleId: string,
) {
  if (!listId) return
  const { error } = await supabase.from("title_list_items").delete().eq("list_id", listId).eq("title_id", titleId)
  if (error) throw new Error("Could not update reading lists")
}

async function addToList(
  supabase: ReturnType<typeof createRequestSupabaseClient>,
  listId: string | undefined,
  titleId: string,
) {
  if (!listId) throw new Error("Required reading list is missing")
  const { error } = await supabase.from("title_list_items")
    .upsert({ list_id: listId, title_id: titleId }, { onConflict: "list_id,title_id" })
  if (error) throw new Error("Could not update reading lists")
}

async function awardCompletionPoints(
  supabase: ReturnType<typeof createRequestSupabaseClient>,
  profileId: string,
  titleId: string,
) {
  const [titleResult, ownedResult, membershipResult] = await Promise.all([
    supabase.from("titles").select("genre").eq("id", titleId).maybeSingle(),
    supabase.from("clubs").select("id,categories").eq("owner_user_id", profileId).limit(100),
    supabase.from("club_members").select("club_id").eq("user_id", profileId).limit(100),
  ])
  if (titleResult.error || ownedResult.error || membershipResult.error) {
    throw new Error("Could not calculate completion points")
  }
  const title = titleResult.data
  const owned = ownedResult.data
  const memberships = membershipResult.data
  const genres = normalizeGenres(Array.isArray(title?.genre) ? title.genre.filter(isGenre).join(",") : "")
  if (!genres.length) return
  const memberClubIds = (memberships ?? []).map((row) => row.club_id as string)
  const { data: memberClubs, error: memberClubError } = memberClubIds.length
    ? await supabase.from("clubs").select("id,categories").in("id", memberClubIds).limit(100)
    : { data: [], error: null }
  if (memberClubError) throw new Error("Could not calculate completion points")
  const ownerGenres = new Set<Genre>((owned ?? []).flatMap((club) => normalizeGenres(
    Array.isArray(club.categories) ? club.categories.join(",") : "",
  )))
  const memberGenres = new Set<Genre>((memberClubs ?? []).flatMap((club) => normalizeGenres(
    Array.isArray(club.categories) ? club.categories.join(",") : "",
  )))
  const rows = genres.flatMap((genre) => {
    const base = {
      user_profile_id: profileId,
      title_id: titleId,
      genre,
      source_id: titleId,
    }
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

async function completeTitle(
  supabase: ReturnType<typeof createRequestSupabaseClient>,
  profileId: string,
  lists: Map<string, string>,
  titleId: string,
) {
  const finishedId = lists.get("finished-reading")
  if (!finishedId) throw new Error("Finished Reading list is missing")
  const { data: existing, error: existingError } = await supabase.from("title_list_items")
    .select("title_id").eq("list_id", finishedId).eq("title_id", titleId).limit(1).maybeSingle()
  if (existingError) throw new Error("Could not check completion state")
  if (!existing) {
    await addToList(supabase, finishedId, titleId)
    const { data: title } = await supabase.from("titles").select("title").eq("id", titleId).maybeSingle()
    const { error: activityError } = await supabase.from("activity_events").insert({
      user_profile_id: profileId,
      title_id: titleId,
      event_type: "title_finished",
      metadata: { title: { id: titleId, title: title?.title ?? "a title" } },
    })
    if (activityError) console.error("Could not record completion activity", activityError)
  }
  // Reward rows are uniquely keyed, so this also repairs a prior partial write on retry.
  await awardCompletionPoints(supabase, profileId, titleId)
  await removeFromList(supabase, lists.get("current-reading"), titleId)
  await removeFromList(supabase, lists.get("to-read"), titleId)
}

export async function handleDiaryProgress(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, maxRequestBytes)
  if (!body.ok) return json({ error: body.error }, body.status)
  const parsed = parseDiaryProgressWrite(body.value)
  if (!parsed) return json({ error: "Invalid reading progress" }, 400)
  const identity = await getIdentity()
  if (!identity) return json({ error: "Unauthorized" }, 401)
  const { supabase, profileId } = identity
  const lists = await getDefaultLists(supabase, profileId)
  if (!lists) return json({ error: "Could not load reading lists" }, 500)
  if (!await titleIsSelectable(supabase, lists, parsed.titleId)) {
    return json({ error: "Add this title to Planned or Current Reading first" }, 409)
  }

  const progress = parsed.progress
  const progressPercent = progress.mode === "pages"
    ? Math.round((progress.currentPage / progress.totalPages) * 100)
    : Math.round((progress.minutesListened / progress.totalMinutes) * 100)
  const completed = progressPercent >= 100
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const values = progress.mode === "pages"
    ? {
        current_page: progress.currentPage,
        total_pages: progress.totalPages,
        minutes_listened: null,
        total_minutes: null,
      }
    : {
        current_page: null,
        total_pages: null,
        minutes_listened: progress.minutesListened,
        total_minutes: progress.totalMinutes,
      }
  const { error: progressError } = await supabase.from("title_user_progress").upsert({
    user_profile_id: profileId,
    title_id: parsed.titleId,
    ...values,
    progress_percent: progressPercent,
    is_completed: completed,
    last_read_at: now.toISOString(),
  }, { onConflict: "user_profile_id,title_id" })
  if (progressError) return json({ error: "Could not save reading progress" }, 500)

  const { data: existing, error: existingError } = await supabase.from("reading_diary_entries")
    .select("id").eq("user_profile_id", profileId).eq("title_id", parsed.titleId)
    .eq("entry_date", today).order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (existingError) return json({ error: "Could not save diary entry" }, 500)
  const noteText = diaryNoteText(parsed.noteText)
  const noteFields = noteText ? { note_text: noteText, note_html: diaryNoteHtml(noteText) } : {}
  const entryValues = {
    ...values,
    ...noteFields,
    progress_mode: progress.mode,
    progress_percent: progressPercent,
    is_completed: completed,
  }
  const entryWrite = existing?.id
    ? await supabase.from("reading_diary_entries").update(entryValues)
      .eq("id", existing.id).eq("user_profile_id", profileId).select("id").maybeSingle()
    : await supabase.from("reading_diary_entries").insert({
      ...entryValues,
      user_profile_id: profileId,
      title_id: parsed.titleId,
      entry_date: today,
      note_text: noteText || null,
      note_html: diaryNoteHtml(noteText),
    }).select("id").single()
  if (entryWrite.error || !entryWrite.data) return json({ error: "Could not save diary entry" }, 500)

  try {
    if (completed) await completeTitle(supabase, profileId, lists, parsed.titleId)
    else if (progressPercent > 0) {
      await addToList(supabase, lists.get("current-reading"), parsed.titleId)
      await removeFromList(supabase, lists.get("to-read"), parsed.titleId)
    } else {
      await removeFromList(supabase, lists.get("current-reading"), parsed.titleId)
    }
  } catch (error) {
    console.error("Diary list/reward update failed", error)
    return json({ error: "Progress saved, but reading lists could not be updated" }, 500)
  }
  return json({ id: entryWrite.data.id as string }, 200)
}

export async function handleDiaryNoteUpdate(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, maxRequestBytes)
  if (!body.ok) return json({ error: body.error }, body.status)
  const parsed = parseDiaryNoteWrite(body.value)
  if (!parsed) return json({ error: "Invalid diary note" }, 400)
  const identity = await getIdentity()
  if (!identity) return json({ error: "Unauthorized" }, 401)
  const { supabase, profileId } = identity
  const noteText = diaryNoteText(parsed.noteText)
  const { data, error } = await supabase.from("reading_diary_entries")
    .update({ note_text: noteText || null, note_html: diaryNoteHtml(noteText) })
    .eq("id", parsed.entryId).eq("user_profile_id", profileId).select("id").maybeSingle()
  if (error) return json({ error: "Could not update diary entry" }, 500)
  if (!data) return json({ error: "Diary entry not found" }, 404)
  return json({ success: true }, 200)
}
