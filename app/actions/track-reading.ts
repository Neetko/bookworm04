"use server"

import { createServerClient } from "@/lib/supabase-server"
import { getGoogleBook } from "@/lib/google-books"
import { revalidatePath } from "next/cache"

type ProgressMode = "pages" | "audiobook"

export type TrackProgressInput =
  | {
      mode: "pages"
      currentPage: number
      totalPages: number
    }
  | {
      mode: "audiobook"
      minutesListened: number
      totalMinutes: number
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

async function ensureExternalGoogleMapping(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  googleVolumeId: string,
  desiredBookId: string
): Promise<string> {
  // Critical: do NOT allow "remapping" an existing external_id to a different book_id.
  // We create the mapping once and then treat it as immutable.
  const { error: mapUpsertError } = await supabase.from("external_books").upsert(
    {
      source: "google",
      external_id: googleVolumeId,
      tracked_book_id: desiredBookId,
    },
    {
      onConflict: "source,external_id",
      ignoreDuplicates: true,
    }
  )

  if (mapUpsertError) {
    console.error("Failed to create external_books mapping", mapUpsertError)
    throw new Error(
      `Failed to save external mapping (external_books). ${mapUpsertError.code ?? ""} ${mapUpsertError.message}`.trim()
    )
  }

  const { data: mapping, error: mappingError } = await supabase
    .from("external_books")
    .select("tracked_book_id")
    .eq("source", "google")
    .eq("external_id", googleVolumeId)
    .maybeSingle()

  if (mappingError) {
    console.error("Failed to read external_books mapping", mappingError)
    throw new Error(
      `Failed to lookup book mapping (external_books). ${mappingError.code ?? ""} ${mappingError.message}`.trim()
    )
  }

  if (!mapping?.tracked_book_id) {
    // This usually means the table/migration wasn't applied, or RLS/policies block inserts.
    throw new Error(
      "Failed to lookup book mapping (external_books). Mapping row not found; ensure the Track Reading migration has been applied to your Supabase DB."
    )
  }

  return mapping.tracked_book_id as string
}

async function ensureBookFromGoogleVolume(volumeId: string): Promise<{ bookId: string; titleId: string }> {
  const supabase = await createServerClient()

  // 1) Check mapping first
  const { data: existingMap, error: mapError } = await supabase
    .from("external_books")
    .select("tracked_book_id")
    .eq("source", "google")
    .eq("external_id", volumeId)
    .maybeSingle()

  if (mapError) {
    console.error("Error looking up external_books mapping", mapError)
    throw new Error(
      `Failed to lookup book mapping (external_books). ${mapError.code ?? ""} ${mapError.message}`.trim()
    )
  }

  if (existingMap?.tracked_book_id) {
    const trackedBookId = existingMap.tracked_book_id as string
    const titleId = await ensureTitleForTrackedBook(supabase, trackedBookId, volumeId)
    return { bookId: trackedBookId, titleId }
  }

  // 2) Fetch volume
  const volume = await getGoogleBook(volumeId)
  if (!volume) throw new Error("Unable to fetch Google book")

  // 3) Insert local book (metadata-only)
  const { data: inserted, error: insertError } = await supabase
    .from("tracked_books")
    .insert({
      title: volume.title,
      author: volume.authors[0] ?? "Unknown author",
      description: volume.description,
      cover_image_url: volume.thumbnailUrl,
      published_year: volume.publishedYear,
      isbn: volume.isbn,
      genre: null,
    })
    .select("id")
    .single()

  if (insertError || !inserted?.id) {
    console.error("Failed to insert books row", insertError)
    throw new Error("Failed to create book")
  }

  const mappedBookId = await ensureExternalGoogleMapping(supabase, volumeId, inserted.id as string)

  // If we lost a race and the external_id was already mapped, clean up the extra book row.
  if (mappedBookId !== inserted.id) {
    const { error: cleanupError } = await supabase.from("tracked_books").delete().eq("id", inserted.id)
    if (cleanupError) {
      // Not fatal; the row is metadata-only but would be orphaned.
      console.warn("Failed to cleanup duplicate books row", cleanupError)
    }
  }

  const titleId = await ensureTitleForTrackedBook(supabase, mappedBookId, volumeId, volume)
  return { bookId: mappedBookId, titleId }
}

async function ensureTitleForTrackedBook(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  trackedBookId: string,
  volumeId: string,
  volume?: {
    title: string
    authors: string[]
    description: string | null
    thumbnailUrl: string | null
    publishedYear: number | null
    isbn: string | null
  }
) {
  const { data: tracked } = await supabase
    .from("tracked_books")
    .select("id,title_id")
    .eq("id", trackedBookId)
    .single()

  if (!tracked?.id) {
    throw new Error("Tracked book not found")
  }

  const author = volume?.authors?.[0] ?? "Unknown author"

  // Try to unify with curated library by ISBN
  if (volume?.isbn) {
    const { data: matchByIsbn } = await supabase
      .from("books")
      .select("id")
      .eq("isbn", volume.isbn)
      .maybeSingle()

    if (matchByIsbn?.id) {
      await supabase.from("tracked_books").update({ title_id: matchByIsbn.id }).eq("id", trackedBookId)
      await supabase.from("title_sources").upsert(
        { source: "google", external_id: volumeId, title_id: matchByIsbn.id },
        { onConflict: "source,external_id" }
      )
      return matchByIsbn.id as string
    }
  }

  // Try to unify with curated library by title+author (case-insensitive)
  if (volume?.title) {
    const { data: matchByTitle } = await supabase
      .from("books")
      .select("id")
      .ilike("title", volume.title)
      .ilike("author", author)
      .maybeSingle()

    if (matchByTitle?.id) {
      await supabase.from("tracked_books").update({ title_id: matchByTitle.id }).eq("id", trackedBookId)
      await supabase.from("title_sources").upsert(
        { source: "google", external_id: volumeId, title_id: matchByTitle.id },
        { onConflict: "source,external_id" }
      )
      return matchByTitle.id as string
    }
  }

  // Default: use tracked book id as canonical title id
  const titleId = tracked.title_id ?? trackedBookId

  if (!tracked.title_id) {
    await supabase.from("tracked_books").update({ title_id: titleId }).eq("id", trackedBookId)
  }

  if (volume) {
    await supabase.from("titles").upsert({
      id: titleId,
      title: volume.title,
      author,
      description: volume.description,
      cover_image_url: volume.thumbnailUrl,
      published_year: volume.publishedYear,
      isbn: volume.isbn,
    })
  }

  await supabase.from("title_sources").upsert(
    { source: "google", external_id: volumeId, title_id: titleId },
    { onConflict: "source,external_id" }
  )

  return titleId
}

export async function ensureGoogleBook(volumeId: string) {
  const { bookId, titleId } = await ensureBookFromGoogleVolume(volumeId)
  revalidatePath("/search-titles")
  return { bookId, titleId }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export async function trackTitleProgress(input: {
  titleId: string
  bookId?: string | null
  trackedBookId?: string | null
  progress: TrackProgressInput
}) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { titleId, bookId, trackedBookId, progress } = input

  if (!bookId && !trackedBookId) {
    throw new Error("No ingested title available to track")
  }

  const update: Record<string, any> = {
    user_profile_id: profileId,
    is_completed: true,
    last_read_at: new Date().toISOString(),
  }

  if (progress.mode === "pages") {
    const totalPages = Math.max(1, Math.floor(progress.totalPages))
    const currentPage = clamp(Math.floor(progress.currentPage), 0, totalPages)
    const percent = Math.round((currentPage / totalPages) * 100)

    update.current_page = currentPage
    update.total_pages = totalPages
    update.progress_percent = percent
    update.minutes_listened = null
    update.total_minutes = null
  } else {
    const totalMinutes = Math.max(1, Math.floor(progress.totalMinutes))
    const minutesListened = clamp(Math.floor(progress.minutesListened), 0, totalMinutes)
    const percent = Math.round((minutesListened / totalMinutes) * 100)

    update.minutes_listened = minutesListened
    update.total_minutes = totalMinutes
    update.progress_percent = percent
    update.total_pages = null
  }

  if (bookId) {
    update.book_id = bookId
    const { error } = await supabase.from("user_progress").upsert(update, {
      onConflict: "user_profile_id,book_id",
    })

    if (error) {
      console.error("Failed to upsert progress", error)
      throw new Error("Failed to save progress")
    }

    revalidatePath(`/titles/${titleId}`)
    return { bookId, titleId }
  }

  update.tracked_book_id = trackedBookId
  const { error } = await supabase.from("tracked_user_progress").upsert(update, {
    onConflict: "user_profile_id,tracked_book_id",
  })

  if (error) {
    console.error("Failed to upsert progress", error)
    throw new Error("Failed to save progress")
  }

  revalidatePath(`/titles/${titleId}`)
  return { trackedBookId, titleId }
}

export async function claimAndTrackLocalBook(bookId: string, progress: TrackProgressInput) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const update: Record<string, any> = {
    user_profile_id: profileId,
    book_id: bookId,
    is_completed: true,
    last_read_at: new Date().toISOString(),
  }

  if (progress.mode === "pages") {
    const totalPages = Math.max(1, Math.floor(progress.totalPages))
    const currentPage = clamp(Math.floor(progress.currentPage), 0, totalPages)
    const percent = Math.round((currentPage / totalPages) * 100)

    update.current_page = currentPage
    update.total_pages = totalPages
    update.progress_percent = percent

    // Clear audio fields
    update.minutes_listened = null
    update.total_minutes = null
  } else {
    const totalMinutes = Math.max(1, Math.floor(progress.totalMinutes))
    const minutesListened = clamp(Math.floor(progress.minutesListened), 0, totalMinutes)
    const percent = Math.round((minutesListened / totalMinutes) * 100)

    update.minutes_listened = minutesListened
    update.total_minutes = totalMinutes
    update.progress_percent = percent

    // Keep current_page but clear page totals
    update.total_pages = null
  }

  const { error } = await supabase.from("user_progress").upsert(update, {
    onConflict: "user_profile_id,book_id",
  })

  if (error) {
    console.error("Failed to upsert progress", error)
    throw new Error("Failed to save progress")
  }

  revalidatePath(`/titles/${bookId}`)
  return { bookId }
}

export async function claimAndTrackGoogleBook(volumeId: string, progress: TrackProgressInput) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const ensured = await ensureBookFromGoogleVolume(volumeId)

  const update: Record<string, any> = {
    user_profile_id: profileId,
    tracked_book_id: ensured.bookId,
    is_completed: true,
    last_read_at: new Date().toISOString(),
  }

  if (progress.mode === "pages") {
    const totalPages = Math.max(1, Math.floor(progress.totalPages))
    const currentPage = clamp(Math.floor(progress.currentPage), 0, totalPages)
    const percent = Math.round((currentPage / totalPages) * 100)

    update.current_page = currentPage
    update.total_pages = totalPages
    update.progress_percent = percent
    update.minutes_listened = null
    update.total_minutes = null
  } else {
    const totalMinutes = Math.max(1, Math.floor(progress.totalMinutes))
    const minutesListened = clamp(Math.floor(progress.minutesListened), 0, totalMinutes)
    const percent = Math.round((minutesListened / totalMinutes) * 100)

    update.minutes_listened = minutesListened
    update.total_minutes = totalMinutes
    update.progress_percent = percent
    update.total_pages = null
  }

  const { error } = await supabase.from("tracked_user_progress").upsert(update, {
    onConflict: "user_profile_id,tracked_book_id",
  })

  if (error) {
    console.error("Failed to upsert progress", error)
    throw new Error("Failed to save progress")
  }

  revalidatePath("/search-titles")
  return { bookId: ensured.bookId, titleId: ensured.titleId }
}

