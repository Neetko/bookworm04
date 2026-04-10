import Image from "next/image"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { Navigation } from "@/components/navigation"
import { createServerClient } from "@/lib/supabase-server"
import { DiaryEntryDialog, type DiaryTitleOption } from "@/components/diary-entry-dialog"
import { DiaryFilters, type DiaryFilterMode } from "@/components/diary-filters"
import { buildNoteHtmlFromText, extractPlainTextFromHtml, sanitizeRichTextHtml } from "@/lib/sanitize"
import { BookOpen } from "lucide-react"
import { isGenre, normalizeGenres, type Genre, GENRE_BG_CLASS } from "@/lib/types"
import Link from "next/link"

async function requireProfileId() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (error || !profile) {
    redirect("/auth")
  }

  return { supabase, profileId: profile.id as string }
}

type DiaryEntryRow = {
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
  progress_mode: "pages" | "audiobook"
  is_completed: boolean
  created_at: string | null
  title:
    | {
        id: string
        title: string
        author: string
        cover_image_url: string | null
      }
    | {
        id: string
        title: string
        author: string
        cover_image_url: string | null
      }[]
    | null
}

function applyDiaryFilters(
  entries: DiaryEntryRow[],
  filterBy: DiaryFilterMode,
  selectedGenres: Genre[],
  selectedAuthor: string | null,
  selectedTitle: string | null,
  titleGenresByTitleId: Map<string, Genre[]>
) {
  if (filterBy === "genre" && selectedGenres.length > 0) {
    return entries.filter((entry) => {
      if (!entry.title_id) return false
      const titleGenres = titleGenresByTitleId.get(entry.title_id) ?? []
      return selectedGenres.some((genre) => titleGenres.includes(genre))
    })
  }

  if (filterBy === "author" && selectedAuthor) {
    const match = selectedAuthor.toLowerCase()
    return entries.filter((entry) => {
      const title = Array.isArray(entry.title) ? entry.title[0] : entry.title
      return (title?.author ?? "").toLowerCase() === match
    })
  }

  if (filterBy === "title" && selectedTitle) {
    const match = selectedTitle.toLowerCase()
    return entries.filter((entry) => {
      const title = Array.isArray(entry.title) ? entry.title[0] : entry.title
      return (title?.title ?? "").toLowerCase() === match
    })
  }

  return entries
}

function getProgressColor(percent: number | null): string {
  if (percent === null) return "bg-muted"
  if (percent < 30) return "bg-red-500"
  if (percent < 60) return "bg-yellow-500"
  return "bg-green-500"
}

function getProgressTextColor(percent: number | null): string {
  if (percent === null) return "text-muted-foreground"
  if (percent < 30) return "text-red-500"
  if (percent < 60) return "text-yellow-500"
  return "text-green-500"
}

type GroupedEntries = {
  date: string
  dateLabel: string
  entries: DiaryEntryRow[]
}

function groupEntriesByDate(entries: DiaryEntryRow[]): GroupedEntries[] {
  const grouped = new Map<string, DiaryEntryRow[]>()

  for (const entry of entries) {
    const dateKey = entry.entry_date ?? "unknown"
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(entry)
  }

  return Array.from(grouped.entries()).map(([date, groupEntries]) => ({
    date,
    dateLabel: date !== "unknown" ? format(new Date(date), "MMM d, yyyy") : "Unknown date",
    entries: groupEntries,
  }))
}

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ filterBy?: string; genres?: string; author?: string; title?: string }>
}) {
  const params = await searchParams
  const filterBy = ((): DiaryFilterMode => {
    if (params.filterBy === "genre" || params.filterBy === "author" || params.filterBy === "title") {
      return params.filterBy
    }
    return "none"
  })()
  const selectedGenres = params.genres
    ? params.genres
        .split(",")
        .map((value) => value.trim())
        .filter(isGenre)
    : []
  const selectedAuthor = params.author?.trim() || null
  const selectedTitle = params.title?.trim() || null

  const { supabase, profileId } = await requireProfileId()

  const { data: lists } = await supabase
    .from("title_lists")
    .select("id,list_type")
    .eq("user_profile_id", profileId)
    .in("list_type", ["to-read", "current-reading"])

  const listIds = (lists ?? []).map((list) => list.id)

  const { data: listItems } = listIds.length
    ? await supabase
        .from("title_list_items")
        .select("list_id, title_id, title:titles(id,title,author,cover_image_url)")
        .in("list_id", listIds)
    : { data: [] as any[] }

  const listTypeById = new Map<string, "to-read" | "current-reading">()
  for (const list of lists ?? []) {
    if (list?.id && (list.list_type === "to-read" || list.list_type === "current-reading")) {
      listTypeById.set(list.id, list.list_type)
    }
  }

  const uniqueTitles = new Map<
    string,
    { id: string; title: string; author: string; coverImageUrl: string | null; listTypes: Set<"to-read" | "current-reading"> }
  >()
  for (const item of listItems ?? []) {
    const title = item.title
    if (!title?.id) continue
    const listType = listTypeById.get(item.list_id)
    if (!uniqueTitles.has(title.id)) {
      uniqueTitles.set(title.id, {
        id: title.id,
        title: title.title ?? "Untitled",
        author: title.author ?? "Unknown author",
        coverImageUrl: title.cover_image_url ?? null,
        listTypes: new Set(listType ? [listType] : []),
      })
      continue
    }
    if (listType) {
      uniqueTitles.get(title.id)?.listTypes.add(listType)
    }
  }

  const titleIds = Array.from(uniqueTitles.keys())

  const [trackedRes, trackedProgressRes] = await Promise.all([
    titleIds.length
      ? supabase.from("tracked_books").select("id,title_id").in("title_id", titleIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("tracked_user_progress")
      .select("tracked_book_id,current_page,total_pages,minutes_listened,total_minutes,progress_percent")
      .eq("user_profile_id", profileId),
  ])

  const trackedByTitleId = new Map<string, string>()
  for (const row of trackedRes.data ?? []) {
    if (row?.title_id) trackedByTitleId.set(row.title_id, row.id)
  }

  const trackedProgressByBookId = new Map<string, {
    currentPage: number | null
    totalPages: number | null
    minutesListened: number | null
    totalMinutes: number | null
    progressPercent: number | null
  }>()
  for (const row of trackedProgressRes.data ?? []) {
    if (!row?.tracked_book_id) continue
    trackedProgressByBookId.set(row.tracked_book_id, {
      currentPage: row.current_page ?? null,
      totalPages: row.total_pages ?? null,
      minutesListened: row.minutes_listened ?? null,
      totalMinutes: row.total_minutes ?? null,
      progressPercent: row.progress_percent ?? null,
    })
  }

  const titleOptions: DiaryTitleOption[] = Array.from(uniqueTitles.values())
    .map((title) => {
      const trackedBookId = trackedByTitleId.get(title.id) ?? null
      const trackedProgress = trackedBookId ? trackedProgressByBookId.get(trackedBookId) : undefined
      return {
        ...title,
        listTypes: Array.from(title.listTypes),
        trackedBookId,
        lastProgress: trackedProgress ?? null,
      }
    })

  const { data: entriesRaw } = await supabase
    .from("reading_diary_entries")
    .select(
      "id, title_id, entry_date, note_html, note_text, progress_percent, current_page, total_pages, minutes_listened, total_minutes, progress_mode, is_completed, created_at, title:titles(id,title,author,cover_image_url)"
    )
    .eq("user_profile_id", profileId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })

  const entries = (entriesRaw ?? []) as DiaryEntryRow[]
  const entryTitleIds = Array.from(new Set(entries.map((item) => item.title_id).filter(Boolean))) as string[]
  const [entryTitlesRes, entryTrackedRes] = await Promise.all([
    entryTitleIds.length
      ? supabase.from("titles").select("id,genre").in("id", entryTitleIds)
      : Promise.resolve({ data: [] as any[] }),
    entryTitleIds.length
      ? supabase.from("tracked_books").select("title_id,genre").in("title_id", entryTitleIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const titleGenresByTitleId = new Map<string, Genre[]>()
  for (const row of entryTitlesRes.data ?? []) {
    if (!row?.id) continue
    const fallback = normalizeGenres(row.genre)
    const merged = Array.from(new Set([...(titleGenresByTitleId.get(row.id) ?? []), ...fallback]))
    titleGenresByTitleId.set(row.id, merged)
  }
  for (const row of entryTrackedRes.data ?? []) {
    if (!row?.title_id) continue
    const fallback = normalizeGenres(row.genre)
    const merged = Array.from(new Set([...(titleGenresByTitleId.get(row.title_id) ?? []), ...fallback]))
    titleGenresByTitleId.set(row.title_id, merged)
  }

  const filteredEntries = applyDiaryFilters(
    entries,
    filterBy,
    selectedGenres,
    selectedAuthor,
    selectedTitle,
    titleGenresByTitleId
  )
  const groupedEntries = groupEntriesByDate(filteredEntries)

  const uniqueAuthors = Array.from(
    new Set(
      entries
        .map((entry) => {
          const title = Array.isArray(entry.title) ? entry.title[0] : entry.title
          return (title?.author ?? "").trim()
        })
        .filter(Boolean)
    )
  )

  const uniqueTitleNames = Array.from(
    new Set(
      entries
        .map((entry) => {
          const title = Array.isArray(entry.title) ? entry.title[0] : entry.title
          return (title?.title ?? "").trim()
        })
        .filter(Boolean)
    )
  )

  const filterQuery = new URLSearchParams()
  if (filterBy !== "none") filterQuery.set("filterBy", filterBy)
  if (filterBy === "genre" && selectedGenres.length > 0) filterQuery.set("genres", selectedGenres.join(","))
  if (filterBy === "author" && selectedAuthor) filterQuery.set("author", selectedAuthor)
  if (filterBy === "title" && selectedTitle) filterQuery.set("title", selectedTitle)
  const filterQueryString = filterQuery.toString()

  const today = new Date().toISOString().slice(0, 10)
  const todayEntries = entries.filter((entry) => entry.entry_date === today && entry.title_id)
  const todayTitleIds = new Set(todayEntries.map((entry) => entry.title_id as string))
  const todayNotesByTitleId: Record<string, { noteHtml: string; noteText: string }> = {}
  for (const entry of todayEntries) {
    const titleId = entry.title_id as string
    const rawNoteHtml = entry.note_html ?? null
    const rawNoteText = entry.note_text ?? null
    const noteHtml = rawNoteHtml || (rawNoteText ? buildNoteHtmlFromText(rawNoteText) : "")
    const noteText = rawNoteText || (rawNoteHtml ? extractPlainTextFromHtml(rawNoteHtml) : "")
    if (noteHtml || noteText) {
      todayNotesByTitleId[titleId] = { noteHtml, noteText }
    }
  }
  const listTitleIds = Array.from(uniqueTitles.keys())
  const canCreateToday = listTitleIds.length > 0 && listTitleIds.some((titleId) => !todayTitleIds.has(titleId))

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-16">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Reading Diary</h1>
            <p className="text-muted-foreground mt-2">Track your reading journey through time.</p>
          </div>
          <DiaryEntryDialog
            titles={titleOptions}
            canCreateToday={canCreateToday}
            todayNotesByTitleId={todayNotesByTitleId}
          />
        </div>

        <div className="mb-10">
          <DiaryFilters
            filterBy={filterBy}
            selectedGenres={selectedGenres}
            authors={uniqueAuthors}
            titles={uniqueTitleNames}
            selectedAuthor={selectedAuthor}
            selectedTitle={selectedTitle}
          />
        </div>

        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No entries yet</h2>
            <p className="text-muted-foreground max-w-sm">
              Start tracking your reading progress by adding your first diary entry.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-16">
              {groupedEntries.map((group) => (
                <div key={group.date} className="relative">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-4 border-background z-10" />

                    <div className="ml-12 md:ml-0 md:absolute md:right-[calc(50%+2rem)] md:text-right">
                      <span className="inline-block px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                        {group.dateLabel}
                      </span>
                    </div>
                  </div>

                  <div className="ml-12 md:ml-0 grid md:grid-cols-2 gap-6">
                    {group.entries.map((entry, entryIndex) => {
                      const title = Array.isArray(entry.title) ? entry.title[0] : entry.title
                      const progressPercent = entry.progress_percent ?? 0
                      const noteHtml = sanitizeRichTextHtml(entry.note_html)
                      const isLeft = entryIndex % 2 === 0
                      const titleGenres = entry.title_id
                        ? titleGenresByTitleId.get(entry.title_id) ?? []
                        : []
                      const detailHref = filterQueryString
                        ? `/diary/${entry.id}?${filterQueryString}`
                        : `/diary/${entry.id}`

                      return (
                        <div
                          key={entry.id}
                          className={`relative group ${isLeft ? "md:pr-8 md:justify-self-end" : "md:pl-8 md:col-start-2"}`}
                        >
                          <div
                            className={`hidden md:block absolute top-12 w-8 h-0.5 bg-border ${
                              isLeft ? "right-0" : "left-0"
                            }`}
                          />

                          <Link href={detailHref} className="block">
                            <div className="relative bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 w-[220px] h-[320px] flex flex-col">
                              <div className="relative h-[180px] w-full overflow-hidden bg-muted">
                              {title?.cover_image_url ? (
                                <Image
                                  src={title.cover_image_url}
                                  alt={title.title ?? "Book cover"}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                                  sizes="220px"
                                  unoptimized
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <BookOpen className="w-6 h-6 text-muted-foreground/50" />
                                </div>
                              )}

                              {entry.is_completed ? (
                                <div className="absolute top-3 right-3 px-2.5 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                                  Finished
                                </div>
                              ) : null}
                            </div>

                            <div className="p-3 space-y-2 flex-1">
                              <div>
                                <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">
                                  {title?.title ?? "Untitled"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {title?.author ?? "Unknown author"}
                                </p>
                                {titleGenres.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    {titleGenres.map((genre) => (
                                      <span
                                        key={genre}
                                        className={`h-2 w-2 rounded-full ${GENRE_BG_CLASS[genre]}`}
                                      />
                                    ))}
                                  </div>
                                ) : null}
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className={`font-semibold ${getProgressTextColor(entry.progress_percent)}`}>
                                    {progressPercent}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(entry.progress_percent)}`}
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {entry.progress_mode === "audiobook"
                                    ? `${entry.minutes_listened ?? 0} / ${entry.total_minutes ?? 0} min`
                                    : `${entry.current_page ?? 0} / ${entry.total_pages ?? 0} pages`}
                                </p>
                              </div>
                            </div>
                            </div>
                          </Link>

                          <div
                            className={`pointer-events-none absolute top-6 z-20 w-56 rounded-lg border border-border bg-popover p-3 text-xs text-muted-foreground shadow-lg opacity-0 transition-all duration-200 group-hover:opacity-100 ${
                              isLeft ? "right-full mr-3 -translate-x-2 group-hover:translate-x-0" : "left-full ml-3 translate-x-2 group-hover:translate-x-0"
                            }`}
                          >
                            {noteHtml ? (
                              <div
                                className="prose prose-sm max-w-none [&_p]:mb-2 last:[&_p]:mb-0"
                                dangerouslySetInnerHTML={{ __html: noteHtml }}
                              />
                            ) : (
                              <div className="h-16" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute left-4 md:left-1/2 -translate-x-1/2 -bottom-4 w-3 h-3 rounded-full bg-border" />
          </div>
        )}
      </div>
    </div>
  )
}
