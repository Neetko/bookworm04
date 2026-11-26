import { safePublicImageUrl } from "../../server/images.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { isGenre, normalizeGenres, type Genre } from "../titles/catalog"
import { diaryNoteText } from "./content"
import { normalizeDiarySearch, type DiarySearch } from "./validation"

type TitleJoin = {
  id: string
  title: string | null
  author: string | null
  cover_image_url: string | null
}

type EntryRow = {
  id: string
  title_id: string | null
  entry_date: string | null
  note_html: string | null
  note_text: string | null
  progress_percent: number | null
  current_page: number | null
  total_pages: number | null
  minutes_listened: number | null
  total_minutes: number | null
  progress_mode: string
  is_completed: boolean
  created_at: string | null
  title: TitleJoin | TitleJoin[] | null
}

export type DiaryEntry = {
  id: string
  titleId: string
  entryDate: string
  noteText: string
  progressPercent: number
  currentPage: number | null
  totalPages: number | null
  minutesListened: number | null
  totalMinutes: number | null
  progressMode: "pages" | "audiobook"
  isCompleted: boolean
  createdAt: string
  title: string
  author: string
  coverUrl: string | null
  genres: Genre[]
}

async function getIdentity() {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null
  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("id").eq("auth_user_id", user.id).maybeSingle()
  if (profileError) throw new Error("Could not load diary identity")
  if (!profile) return null
  return { supabase, profileId: profile.id as string }
}

function joinedTitle(value: EntryRow["title"]): TitleJoin | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function matchesSearch(entry: DiaryEntry, search: DiarySearch) {
  if (search.filterBy === "genre" && search.genres) {
    const selected = normalizeGenres(search.genres)
    return selected.every((genre) => entry.genres.includes(genre))
  }
  if (search.filterBy === "author" && search.author) return entry.author.toLowerCase() === search.author.toLowerCase()
  if (search.filterBy === "title" && search.title) return entry.title.toLowerCase() === search.title.toLowerCase()
  return true
}

export async function loadDiary(searchInput: DiarySearch) {
  const identity = await getIdentity()
  if (!identity) return { status: "unauthorized" as const }
  const { supabase, profileId } = identity
  const search = normalizeDiarySearch(searchInput)

  const { data: rows, error } = await supabase.from("reading_diary_entries")
    .select("id,title_id,entry_date,note_html,note_text,progress_percent,current_page,total_pages,minutes_listened,total_minutes,progress_mode,is_completed,created_at,title:titles(id,title,author,cover_image_url)")
    .eq("user_profile_id", profileId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) throw new Error("Could not load diary entries")

  const rawEntries = (rows ?? []) as EntryRow[]
  const titleIds = [...new Set(rawEntries.map((row) => row.title_id).filter((id): id is string => Boolean(id)))]
  const { data: genreRows, error: genreError } = titleIds.length
    ? await supabase.from("titles").select("id,genre").in("id", titleIds).limit(500)
    : { data: [], error: null }
  if (genreError) throw new Error("Could not load diary genres")
  const genres = new Map<string, Genre[]>((genreRows ?? []).map((row) => [
    row.id as string,
    Array.isArray(row.genre) ? row.genre.filter(isGenre) : [],
  ]))

  const allEntries: DiaryEntry[] = rawEntries.flatMap((row) => {
    const title = joinedTitle(row.title)
    if (!row.title_id || !title?.id) return []
    return [{
      id: row.id,
      titleId: row.title_id,
      entryDate: row.entry_date ?? row.created_at?.slice(0, 10) ?? "1970-01-01",
      noteText: diaryNoteText(row.note_text, row.note_html),
      progressPercent: Math.max(0, Math.min(100, Number(row.progress_percent) || 0)),
      currentPage: row.current_page,
      totalPages: row.total_pages,
      minutesListened: row.minutes_listened,
      totalMinutes: row.total_minutes,
      progressMode: row.progress_mode === "audiobook" ? "audiobook" : "pages",
      isCompleted: Boolean(row.is_completed),
      createdAt: row.created_at ?? row.entry_date ?? "",
      title: title.title ? String(title.title) : "Untitled",
      author: title.author ? String(title.author) : "Unknown author",
      coverUrl: safePublicImageUrl(title.cover_image_url),
      genres: genres.get(row.title_id) ?? [],
    }]
  })

  const { data: lists, error: listError } = await supabase.from("title_lists")
    .select("id,list_type").eq("user_profile_id", profileId)
    .in("list_type", ["to-read", "current-reading"]).limit(10)
  if (listError) throw new Error("Could not load diary lists")
  const listIds = (lists ?? []).map((list) => list.id as string)
  const listType = new Map((lists ?? []).map((list) => [list.id as string, String(list.list_type)]))
  const { data: items, error: itemError } = listIds.length
    ? await supabase.from("title_list_items")
      .select("list_id,title_id,title:titles(id,title,author,cover_image_url)")
      .in("list_id", listIds).limit(500)
    : { data: [], error: null }
  if (itemError) throw new Error("Could not load diary title choices")
  const choiceMap = new Map<string, {
    id: string
    title: string
    author: string
    coverUrl: string | null
    listTypes: Array<"to-read" | "current-reading">
  }>()
  for (const item of items ?? []) {
    const title = joinedTitle(item.title as EntryRow["title"])
    const type = listType.get(item.list_id as string)
    if (!title?.id || (type !== "to-read" && type !== "current-reading")) continue
    const current = choiceMap.get(title.id) ?? {
      id: title.id,
      title: title.title ? String(title.title) : "Untitled",
      author: title.author ? String(title.author) : "Unknown author",
      coverUrl: safePublicImageUrl(title.cover_image_url),
      listTypes: [],
    }
    if (!current.listTypes.includes(type)) current.listTypes.push(type)
    choiceMap.set(title.id, current)
  }
  const choiceIds = [...choiceMap.keys()]
  const { data: progressRows, error: progressError } = choiceIds.length
    ? await supabase.from("title_user_progress")
      .select("title_id,current_page,total_pages,minutes_listened,total_minutes,progress_percent")
      .eq("user_profile_id", profileId).in("title_id", choiceIds).limit(500)
    : { data: [], error: null }
  if (progressError) throw new Error("Could not load reading progress")
  const progress = new Map((progressRows ?? []).map((row) => [row.title_id as string, {
    currentPage: row.current_page as number | null,
    totalPages: row.total_pages as number | null,
    minutesListened: row.minutes_listened as number | null,
    totalMinutes: row.total_minutes as number | null,
    progressPercent: Math.max(0, Math.min(100, Number(row.progress_percent) || 0)),
  }]))

  return {
    status: "ok" as const,
    search,
    entries: allEntries.filter((entry) => matchesSearch(entry, search)),
    allEntries,
    titleOptions: [...choiceMap.values()].map((title) => ({ ...title, progress: progress.get(title.id) ?? null })),
    authors: [...new Set(allEntries.map((entry) => entry.author))].sort(),
    titles: [...new Set(allEntries.map((entry) => entry.title))].sort(),
  }
}
