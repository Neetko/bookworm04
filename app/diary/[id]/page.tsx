import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { Navigation } from "@/components/navigation"
import { createServerClient } from "@/lib/supabase-server"
import { sanitizeRichTextHtml } from "@/lib/sanitize"
import { BookOpen } from "lucide-react"
import { isGenre, normalizeGenres, type Genre, GENRE_BG_CLASS } from "@/lib/types"
import type { DiaryFilterMode } from "@/components/diary-filters"
import { Badge } from "@/components/ui/badge"
import { DiaryEntryEditor } from "@/components/diary-entry-editor"

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

export default async function DiaryEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ filterBy?: string; genres?: string; author?: string; title?: string }>
}) {
  const { id } = await params
  const paramsResolved = await searchParams
  const filterBy = ((): DiaryFilterMode => {
    if (paramsResolved.filterBy === "genre" || paramsResolved.filterBy === "author" || paramsResolved.filterBy === "title") {
      return paramsResolved.filterBy
    }
    return "none"
  })()
  const selectedGenres = paramsResolved.genres
    ? paramsResolved.genres
        .split(",")
        .map((value) => value.trim())
        .filter(isGenre)
    : []
  const selectedAuthor = paramsResolved.author?.trim() || null
  const selectedTitle = paramsResolved.title?.trim() || null

  const { supabase, profileId } = await requireProfileId()

  const { data: entry, error: entryError } = await supabase
    .from("reading_diary_entries")
    .select(
      "id, title_id, entry_date, note_html, note_text, progress_percent, current_page, total_pages, minutes_listened, total_minutes, progress_mode, is_completed, created_at, title:titles(id,title,author,cover_image_url)"
    )
    .eq("user_profile_id", profileId)
    .eq("id", id)
    .single()

  if (entryError || !entry) {
    redirect("/diary")
  }

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
  const [entryTitlesRes] = await Promise.all([
    entryTitleIds.length
      ? supabase.from("titles").select("id,genre").in("id", entryTitleIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const titleGenresByTitleId = new Map<string, Genre[]>()
  for (const row of entryTitlesRes.data ?? []) {
    if (!row?.id) continue
    const fallback = normalizeGenres(row.genre)
    const merged = Array.from(new Set([...(titleGenresByTitleId.get(row.id) ?? []), ...fallback]))
    titleGenresByTitleId.set(row.id, merged)
  }

  const filteredEntries = applyDiaryFilters(
    entries,
    filterBy,
    selectedGenres,
    selectedAuthor,
    selectedTitle,
    titleGenresByTitleId
  )
  const entryIndex = filteredEntries.findIndex((item) => item.id === id)
  const previousEntry = entryIndex > 0 ? filteredEntries[entryIndex - 1] : null
  const nextEntry = entryIndex >= 0 && entryIndex < filteredEntries.length - 1 ? filteredEntries[entryIndex + 1] : null

  const query = new URLSearchParams()
  if (filterBy !== "none") query.set("filterBy", filterBy)
  if (filterBy === "genre" && selectedGenres.length > 0) query.set("genres", selectedGenres.join(","))
  if (filterBy === "author" && selectedAuthor) query.set("author", selectedAuthor)
  if (filterBy === "title" && selectedTitle) query.set("title", selectedTitle)
  const queryString = query.toString()
  const backHref = queryString ? `/diary?${queryString}` : "/diary"

  const entryTitle = Array.isArray(entry.title) ? entry.title[0] : entry.title
  const noteHtml = sanitizeRichTextHtml(entry.note_html)
  const dateLabel = entry.entry_date ? format(new Date(entry.entry_date), "MMM d, yyyy") : ""
  const entryGenres = entry.title_id
    ? titleGenresByTitleId.get(entry.title_id) ?? []
    : []

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to timeline
          </Link>
          <div className="flex items-center gap-2">
            {previousEntry ? (
              <Link
                href={queryString ? `/diary/${previousEntry.id}?${queryString}` : `/diary/${previousEntry.id}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Previous
              </Link>
            ) : null}
            {nextEntry ? (
              <Link
                href={queryString ? `/diary/${nextEntry.id}?${queryString}` : `/diary/${nextEntry.id}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Next →
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="grid gap-6 md:grid-cols-[160px_1fr] p-6">
            <div className="relative aspect-[3/4] w-[140px] bg-muted rounded-lg overflow-hidden">
              {entryTitle?.cover_image_url ? (
                <Image
                  src={entryTitle.cover_image_url}
                  alt={entryTitle.title ?? "Book cover"}
                  fill
                  className="object-cover"
                  sizes="140px"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">{dateLabel}</div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {entryTitle?.title ?? "Untitled"}
                </h1>
                <p className="text-sm text-muted-foreground">{entryTitle?.author ?? "Unknown author"}</p>
                {entryGenres.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entryGenres.map((genre) => (
                      <Badge
                        key={genre}
                        variant="outline"
                        className={GENRE_BG_CLASS[genre]}
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold">{entry.progress_percent ?? 0}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${entry.progress_percent ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {entry.progress_mode === "audiobook"
                    ? `${entry.minutes_listened ?? 0} / ${entry.total_minutes ?? 0} min`
                    : `${entry.current_page ?? 0} / ${entry.total_pages ?? 0} pages`}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border p-6">
            {noteHtml ? (
              <div
                className="font-ui prose prose-sm max-w-none text-foreground [&_p]:mb-3 last:[&_p]:mb-0"
                dangerouslySetInnerHTML={{ __html: noteHtml }}
              />
            ) : (
              <div className="text-sm text-muted-foreground">No note for this entry.</div>
            )}

            <div className="mt-6">
              <DiaryEntryEditor
                entryId={entry.id}
                initialMode={entry.progress_mode}
                initialCurrentPage={entry.current_page}
                initialTotalPages={entry.total_pages}
                initialMinutesListened={entry.minutes_listened}
                initialTotalMinutes={entry.total_minutes}
                initialNoteHtml={entry.note_html}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
