"use server"

import { createServerClient } from "@/lib/supabase-server"
import { extractAsins, getGoogleBook, getGoogleBookDetails, isIsbn10, isIsbn13 } from "@/lib/google-books"
import {
  fetchOpenLibraryMetadataByIsbn,
  fetchOpenLibraryWorkCandidatesByTitleAuthor,
  fetchOpenLibraryWorkEditionsByIsbn,
  fetchOpenLibraryWorkEditionsByWorkId,
  type OpenLibraryEdition,
  type OpenLibraryWorkCandidate,
} from "@/lib/open-library"
import { computeWeightedTags, flattenWeightedTags, type WeightedTag } from "@/lib/book-tagging"
import { normalizeGenres, type Genre } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { awardPointsForTitleAction } from "@/app/actions/rewards"

type ProgressMode = "pages" | "audiobook"

type LocalDuplicate = {
  id: string
  title: string
  author: string
  coverImageUrl: string | null
  source: "title" | "tracked"
}

type WorkSelection = {
  primaryWorkId: string | null
  dupeWorkIds: string[]
}

type FormatDerivationInput = {
  dimensions?: { height?: string; width?: string; thickness?: string } | null
  categories?: string[]
  physicalFormat?: string | null
  physicalDescription?: string | null
  physicalDimensions?: string | null
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

function parseCmFromText(value?: string | null): number | null {
  if (!value) return null
  const normalized = value.toLowerCase()
  const cmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*cm/)
  if (cmMatch) return Number(cmMatch[1])

  const inMatch = normalized.match(/(\d+(?:\.\d+)?)\s*in/)
  if (inMatch) return Number(inMatch[1]) * 2.54

  const numberMatch = normalized.match(/(\d+(?:\.\d+)?)/)
  return numberMatch ? Number(numberMatch[1]) : null
}

function deriveFormat(input: FormatDerivationInput): string | null {
  const categories = (input.categories ?? []).map(normalizeToken).join(" ")
  if (categories.includes("audiobook")) return "audiobook"
  if (categories.includes("electronic book") || categories.includes("ebook")) return "ebook"
  if (categories.includes("large type") || categories.includes("large print")) return "large-print"

  const heightCm =
    parseCmFromText(input.dimensions?.height) ??
    parseCmFromText(input.physicalDimensions) ??
    parseCmFromText(input.physicalDescription)
  if (heightCm) {
    if (heightCm >= 21) return "hardcover"
    if (heightCm <= 20) return "paperback"
  }

  const thicknessCm = parseCmFromText(input.dimensions?.thickness)
  if (thicknessCm) {
    if (thicknessCm >= 2.5) return "hardcover"
    return "paperback"
  }

  const fallback = normalizeToken(input.physicalFormat ?? input.physicalDescription ?? "")
  if (fallback.includes("hardcover")) return "hardcover"
  if (fallback.includes("paperback")) return "paperback"
  if (fallback.includes("audiobook")) return "audiobook"
  if (fallback.includes("ebook") || fallback.includes("electronic")) return "ebook"
  if (fallback.includes("large type") || fallback.includes("large print")) return "large-print"

  return null
}

function mergeIsbnLists(existing: unknown, incoming: string[]): string[] {
  const existingList = Array.isArray(existing)
    ? existing.filter((value) => typeof value === "string")
    : []
  const merged = new Set<string>([...existingList, ...incoming.filter(Boolean)])
  return Array.from(merged)
}

function mergeDupeWorkIds(existing: unknown, incoming: string[], primaryWorkId: string | null): string[] {
  const existingList = Array.isArray(existing)
    ? existing.filter((value) => typeof value === "string")
    : []
  const merged = new Set<string>([...existingList, ...incoming.filter(Boolean)])
  if (primaryWorkId) merged.delete(primaryWorkId)
  return Array.from(merged)
}

function extractIsbnParts(identifiers: string[]): { isbn10: string | null; isbn13: string | null } {
  const cleaned = identifiers.map((value) => value.replace(/\s+/g, ""))
  const isbn13 = cleaned.find((value) => isIsbn13(value)) ?? null
  const isbn10 = cleaned.find((value) => isIsbn10(value)) ?? null
  return { isbn10, isbn13 }
}

function findMatchingEdition(editions: OpenLibraryEdition[], identifiers: string[]): OpenLibraryEdition | null {
  if (editions.length === 0 || identifiers.length === 0) return null
  const normalized = identifiers.map((value) => value.replace(/\s+/g, ""))
  return (
    editions.find((edition) => edition.isbn13.some((isbn) => normalized.includes(isbn))) ||
    editions.find((edition) => edition.isbn10.some((isbn) => normalized.includes(isbn))) ||
    null
  )
}

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

async function findLocalDuplicates(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  title: string,
  author: string
): Promise<LocalDuplicate[]> {
  const trimmedTitle = title.trim()
  const trimmedAuthor = author.trim()
  if (!trimmedTitle) return []

  const titleQuery = `%${trimmedTitle}%`
  const authorQuery = trimmedAuthor ? `%${trimmedAuthor}%` : null

  const [{ data: titleMatches }, { data: trackedMatches }] = await Promise.all([
    authorQuery
      ? supabase
          .from("titles")
          .select("id,title,author,cover_image_url")
          .ilike("title", titleQuery)
          .ilike("author", authorQuery)
            .limit(15)
      : supabase
          .from("titles")
          .select("id,title,author,cover_image_url")
          .ilike("title", titleQuery)
            .limit(15),
    authorQuery
      ? supabase
          .from("tracked_books")
          .select("id,title,author,cover_image_url")
          .ilike("title", titleQuery)
          .ilike("author", authorQuery)
            .limit(15)
      : supabase
          .from("tracked_books")
          .select("id,title,author,cover_image_url")
          .ilike("title", titleQuery)
            .limit(15),
  ])

  const titles = (titleMatches ?? []).map((match) => ({
    id: match.id as string,
    title: match.title as string,
    author: match.author as string,
    coverImageUrl: (match as any).cover_image_url ?? null,
    source: "title" as const,
  }))

  const tracked = (trackedMatches ?? []).map((match) => ({
    id: match.id as string,
    title: match.title as string,
    author: match.author as string,
    coverImageUrl: (match as any).cover_image_url ?? null,
    source: "tracked" as const,
  }))

  return [...titles, ...tracked].slice(0, 15)
}

async function filterDedupedWorkCandidates(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  candidates: OpenLibraryWorkCandidate[]
): Promise<OpenLibraryWorkCandidate[]> {
  if (candidates.length === 0) return []

  const workIds = candidates.map((candidate) => candidate.workId)
  const orFilter = workIds.map((id) => `dupe_work_ids.cs.{${id}}`).join(",")

  const [{ data: titleWorkMatches }, { data: trackedWorkMatches }, { data: titleDupes }, { data: trackedDupes }] =
    await Promise.all([
      supabase.from("titles").select("work_id").in("work_id", workIds),
      supabase.from("tracked_books").select("work_id").in("work_id", workIds),
      orFilter
        ? supabase.from("titles").select("dupe_work_ids").or(orFilter)
        : Promise.resolve({ data: [] as any[] } as any),
      orFilter
        ? supabase.from("tracked_books").select("dupe_work_ids").or(orFilter)
        : Promise.resolve({ data: [] as any[] } as any),
    ])

  const deduped = new Set<string>()
  for (const row of titleWorkMatches ?? []) {
    if ((row as any).work_id) deduped.add((row as any).work_id as string)
  }
  for (const row of trackedWorkMatches ?? []) {
    if ((row as any).work_id) deduped.add((row as any).work_id as string)
  }

  const dupeRows = [...(titleDupes ?? []), ...(trackedDupes ?? [])]
  for (const row of dupeRows) {
    const values = (row as any).dupe_work_ids
    if (Array.isArray(values)) {
      for (const id of values) {
        if (typeof id === "string") deduped.add(id)
      }
    }
  }

  return candidates.filter((candidate) => !deduped.has(candidate.workId))
}

function resolveWorkSelection(selectedWorkIds: string[] | null | undefined): WorkSelection {
  const normalized = (selectedWorkIds ?? []).filter((id) => typeof id === "string" && id.trim().length > 0)
  const unique = Array.from(new Set(normalized))
  return {
    primaryWorkId: unique[0] ?? null,
    dupeWorkIds: unique.length > 1 ? unique.slice(1) : [],
  }
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

async function ensureBookFromGoogleVolume(
  volumeId: string,
  selectedWorkIds: string[]
): Promise<{ bookId: string; titleId: string }> {
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

  const existingTrackedBookId = existingMap?.tracked_book_id as string | undefined

  // 2) Fetch volume details (projection=full)
  const details = await getGoogleBookDetails(volumeId)
  if (!details) throw new Error("Unable to fetch Google book")
  const volume = details.refined

  const selection = resolveWorkSelection(selectedWorkIds)
  let openLibrary = volume.isbn ? await fetchOpenLibraryWorkEditionsByIsbn(volume.isbn) : null

  let workId = selection.primaryWorkId ?? openLibrary?.workId ?? null
  if (!workId && volume.title) {
    const candidates = await fetchOpenLibraryWorkCandidatesByTitleAuthor({
      title: volume.title,
      author: volume.authors[0] ?? "",
      limit: 5,
    })
    workId = candidates[0]?.workId ?? null
  }

  if (workId && (!openLibrary || openLibrary.workId !== workId)) {
    openLibrary = await fetchOpenLibraryWorkEditionsByWorkId(workId)
  }

  const extraWorkIds = selection.dupeWorkIds
  const extraWorkEditions = await Promise.all(
    extraWorkIds.map(async (extraWorkId) => ({
      workId: extraWorkId,
      data: await fetchOpenLibraryWorkEditionsByWorkId(extraWorkId),
    }))
  )

  const allIsbnsFromWorks = [
    ...(openLibrary?.isbns ?? []),
    ...extraWorkEditions.flatMap((entry) => entry.data?.isbns ?? []),
  ]

  const identifiers = mergeIsbnLists(null, [
    volume.isbn ?? "",
    ...details.identifiers,
    ...allIsbnsFromWorks,
  ])

  // 3) Insert local book (metadata-only)
  let mappedBookId = existingTrackedBookId
  if (!mappedBookId) {
    const { data: inserted, error: insertError } = await supabase
      .from("tracked_books")
      .insert({
        title: volume.title,
        author: volume.authors[0] ?? "Unknown author",
        description: volume.description,
        cover_image_url: volume.thumbnailUrl,
        published_year: volume.publishedYear,
        isbn: volume.isbn,
        work_id: workId,
        isbn_list: identifiers,
        dupe_work_ids: extraWorkIds.length > 0 ? extraWorkIds : null,
        genre: null,
        genre_weights: null,
      })
      .select("id")
      .single()

    if (insertError || !inserted?.id) {
      console.error("Failed to insert books row", insertError)
      throw new Error("Failed to create book")
    }

    mappedBookId = await ensureExternalGoogleMapping(supabase, volumeId, inserted.id as string)

    // If we lost a race and the external_id was already mapped, clean up the extra book row.
    if (mappedBookId !== inserted.id) {
      const { error: cleanupError } = await supabase.from("tracked_books").delete().eq("id", inserted.id)
      if (cleanupError) {
        // Not fatal; the row is metadata-only but would be orphaned.
        console.warn("Failed to cleanup duplicate books row", cleanupError)
      }
    }
  }

  if (mappedBookId && (workId || identifiers.length > 0)) {
    const { data: existingTracked } = await supabase
      .from("tracked_books")
      .select("isbn_list")
      .eq("id", mappedBookId)
      .maybeSingle()

    const mergedIsbns = mergeIsbnLists(existingTracked?.isbn_list ?? null, identifiers)
    const trackedUpdate: Record<string, any> = {
      work_id: workId ?? null,
      isbn_list: mergedIsbns.length > 0 ? mergedIsbns : null,
      updated_at: new Date().toISOString(),
    }
    if (extraWorkIds.length > 0) {
      trackedUpdate.dupe_work_ids = mergeDupeWorkIds(existingTracked?.dupe_work_ids ?? null, extraWorkIds, workId)
    }
    await supabase.from("tracked_books").update(trackedUpdate).eq("id", mappedBookId)
  }

  const titleId = await ensureTitleForTrackedBook(supabase, mappedBookId!, volumeId, volume, undefined, {
    workId,
    isbnList: identifiers,
    dupeWorkIds: extraWorkIds,
  })

  if (workId) {
    await upsertEditionsForWorks({
      supabase,
      primaryWorkId: workId,
      identifiers,
      googleDetails: details,
      googleCategories: volume.categories,
      workEditions: [
        { workId, editions: openLibrary?.editions ?? [] },
        ...extraWorkEditions
          .filter((entry) => entry.data?.workId)
          .map((entry) => ({ workId: entry.data!.workId!, editions: entry.data!.editions })),
      ],
    })
  }

  return { bookId: mappedBookId!, titleId }
}

function toUserConfirmedWeights(genres: Genre[]): WeightedTag[] {
  return genres.map((name) => ({
    name,
    weight: 1,
    source: "user-confirmed-ingest",
  }))
}

export async function getGoogleIngestSuggestion(volumeId: string): Promise<{
  title: string
  author: string
  suggestedGenres: Genre[]
  workCandidates: OpenLibraryWorkCandidate[]
  localDuplicates: LocalDuplicate[]
  requiresWorkConfirmation: boolean
}> {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)

  const volume = await getGoogleBook(volumeId)
  if (!volume) throw new Error("Unable to fetch Google book")

  const openLibrary = volume.isbn ? await fetchOpenLibraryMetadataByIsbn(volume.isbn) : null
  const weightedTags = computeWeightedTags({
    title: volume.title,
    googleMainCategory: volume.mainCategory ?? null,
    googleCategories: volume.categories,
    googleDescription: volume.description,
    openLibrary,
  })

  let workCandidates = await fetchOpenLibraryWorkCandidatesByTitleAuthor({
    title: volume.title,
    author: volume.authors[0] ?? "",
    limit: 15,
  })

  let requiresWorkConfirmation = workCandidates.length > 0
  if (volume.isbn) {
    const workByIsbn = await fetchOpenLibraryWorkEditionsByIsbn(volume.isbn)
    if (workByIsbn?.workId) {
      if (!workCandidates.some((candidate) => candidate.workId === workByIsbn.workId)) {
        workCandidates = [
          {
            workId: workByIsbn.workId,
            title: volume.title,
            author: volume.authors[0] ?? "",
            coverUrl: null,
            firstPublishYear: null,
            editionCount: workByIsbn.editions.length || null,
            subjects: [],
          },
          ...workCandidates,
        ]
      }
      requiresWorkConfirmation = true
    }
  }

  workCandidates = await filterDedupedWorkCandidates(supabase, workCandidates)
  requiresWorkConfirmation = workCandidates.length > 0

  const localDuplicates = await findLocalDuplicates(
    supabase,
    volume.title,
    volume.authors[0] ?? ""
  )

  return {
    title: volume.title,
    author: volume.authors[0] ?? "Unknown author",
    suggestedGenres: normalizeGenres(flattenWeightedTags(weightedTags)),
    workCandidates,
    localDuplicates,
    requiresWorkConfirmation,
  }
}

export async function confirmGoogleBookIngest(input: {
  volumeId: string
  hasRead: boolean
  selectedGenres: Genre[]
  selectedWorkIds?: string[]
  requiresWorkSelection?: boolean
}) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const selectedGenres = normalizeGenres(input.selectedGenres)
  if (selectedGenres.length === 0) {
    throw new Error("Select at least one genre")
  }

  if (input.requiresWorkSelection && (!input.selectedWorkIds || input.selectedWorkIds.length === 0)) {
    throw new Error("Select a matching Open Library work before ingesting")
  }

  const ensured = await ensureBookFromGoogleVolume(input.volumeId, input.selectedWorkIds ?? [])
  const userWeights = toUserConfirmedWeights(selectedGenres)

  const { error: trackedUpdateError } = await supabase
    .from("tracked_books")
    .update({
      genre: selectedGenres,
      genre_weights: userWeights,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ensured.bookId)

  if (trackedUpdateError) {
    console.error("Failed to save tracked book genres", trackedUpdateError)
    throw new Error("Failed to save genres")
  }

  const { error: titleUpdateError } = await supabase
    .from("titles")
    .update({
      genre_weights: userWeights,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ensured.titleId)

  if (titleUpdateError) {
    console.error("Failed to save title genres", titleUpdateError)
    throw new Error("Failed to save genres")
  }

  if (input.hasRead) {
    const { error: progressError } = await supabase.from("tracked_user_progress").upsert(
      {
        user_profile_id: profileId,
        tracked_book_id: ensured.bookId,
        current_page: 0,
        progress_percent: 100,
        is_completed: true,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "user_profile_id,tracked_book_id" }
    )

    if (progressError) {
      console.error("Failed to mark progress complete", progressError)
      throw new Error("Failed to save progress")
    }

    await ensureTitleReadAndReward(supabase, profileId, ensured.titleId)
  }

  revalidatePath("/search-titles")
  revalidatePath(`/titles/${ensured.titleId}`)
  return { bookId: ensured.bookId, titleId: ensured.titleId }
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
  },
  genreWeights?: WeightedTag[],
  workInfo?: { workId: string | null; isbnList: string[]; dupeWorkIds?: string[] }
) {
  const { data: tracked } = await supabase
    .from("tracked_books")
    .select("id,title_id,work_id,isbn_list,dupe_work_ids")
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
      await supabase
        .from("tracked_books")
        .update({ title_id: matchByIsbn.id })
        .eq("id", trackedBookId)
      if (workInfo?.workId || (workInfo?.isbnList?.length ?? 0) > 0) {
        const { data: existingTitle } = await supabase
          .from("titles")
          .select("isbn_list,dupe_work_ids")
          .eq("id", matchByIsbn.id)
          .maybeSingle()
        const mergedIsbns = mergeIsbnLists(existingTitle?.isbn_list ?? null, workInfo?.isbnList ?? [])
        const updatePayload: Record<string, any> = {
          isbn_list: mergedIsbns.length > 0 ? mergedIsbns : null,
          updated_at: new Date().toISOString(),
        }
        if (workInfo?.workId) updatePayload.work_id = workInfo.workId
        if (workInfo?.dupeWorkIds?.length) {
          updatePayload.dupe_work_ids = mergeDupeWorkIds(
            existingTitle?.dupe_work_ids ?? null,
            workInfo.dupeWorkIds,
            workInfo.workId ?? null
          )
        }
        await supabase.from("titles").update(updatePayload).eq("id", matchByIsbn.id)
      }
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
      await supabase
        .from("tracked_books")
        .update({ title_id: matchByTitle.id })
        .eq("id", trackedBookId)
      if (workInfo?.workId || (workInfo?.isbnList?.length ?? 0) > 0) {
        const { data: existingTitle } = await supabase
          .from("titles")
          .select("isbn_list,dupe_work_ids")
          .eq("id", matchByTitle.id)
          .maybeSingle()
        const mergedIsbns = mergeIsbnLists(existingTitle?.isbn_list ?? null, workInfo?.isbnList ?? [])
        const updatePayload: Record<string, any> = {
          isbn_list: mergedIsbns.length > 0 ? mergedIsbns : null,
          updated_at: new Date().toISOString(),
        }
        if (workInfo?.workId) updatePayload.work_id = workInfo.workId
        if (workInfo?.dupeWorkIds?.length) {
          updatePayload.dupe_work_ids = mergeDupeWorkIds(
            existingTitle?.dupe_work_ids ?? null,
            workInfo.dupeWorkIds,
            workInfo.workId ?? null
          )
        }
        await supabase.from("titles").update(updatePayload).eq("id", matchByTitle.id)
      }
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
    const mergedIsbns = mergeIsbnLists(tracked?.isbn_list ?? null, workInfo?.isbnList ?? [])
    const mergedDupes = workInfo?.dupeWorkIds?.length
      ? mergeDupeWorkIds(tracked?.dupe_work_ids ?? null, workInfo.dupeWorkIds, workInfo.workId ?? null)
      : (tracked?.dupe_work_ids ?? null)
    await supabase.from("titles").upsert({
      id: titleId,
      title: volume.title,
      author,
      description: volume.description,
      cover_image_url: volume.thumbnailUrl,
      published_year: volume.publishedYear,
      isbn: volume.isbn,
      work_id: workInfo?.workId ?? tracked?.work_id ?? null,
      isbn_list: mergedIsbns.length > 0 ? mergedIsbns : null,
      dupe_work_ids: mergedDupes,
      genre_weights: genreWeights ?? null,
    })
  }

  await supabase.from("title_sources").upsert(
    { source: "google", external_id: volumeId, title_id: titleId },
    { onConflict: "source,external_id" }
  )

  return titleId
}

async function upsertEditionsForWorks(input: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  primaryWorkId: string
  identifiers: string[]
  googleDetails: Awaited<ReturnType<typeof getGoogleBookDetails>>
  workEditions: Array<{ workId: string; editions: OpenLibraryEdition[] }>
  googleCategories: string[]
}) {
  const { supabase, primaryWorkId, identifiers, googleDetails, workEditions, googleCategories } = input
  if (!googleDetails) return

  const { isbn10, isbn13 } = extractIsbnParts(identifiers)
  const asins = extractAsins(googleDetails.raw.volumeInfo?.industryIdentifiers)
  const googleAsin = asins[0] ?? null
  const matchedEdition = findMatchingEdition(
    workEditions.find((entry) => entry.workId === primaryWorkId)?.editions ?? [],
    identifiers
  )

  const googleFormat = deriveFormat({
    dimensions: googleDetails.dimensions ?? null,
    categories: googleCategories,
    physicalFormat: matchedEdition?.physicalFormat ?? null,
    physicalDescription: matchedEdition?.physicalDescription ?? null,
    physicalDimensions: matchedEdition?.physicalDimensions ?? null,
  })

  const googleEdition = {
    work_id: primaryWorkId,
    isbn_10: isbn10,
    isbn_13: isbn13,
    asin: googleAsin,
    volume_id: googleDetails.refined.volumeId,
    format: googleFormat,
    saleability: googleDetails.saleability ?? null,
    raw_google_data: googleDetails.raw,
    updated_at: new Date().toISOString(),
  }

  if (isbn13) {
    await supabase.from("editions").upsert(googleEdition, { onConflict: "isbn_13" })
  } else if (isbn10) {
    await supabase.from("editions").upsert(googleEdition, { onConflict: "isbn_10" })
  } else if (googleAsin) {
    await supabase.from("editions").upsert(googleEdition, { onConflict: "volume_id" })
  } else {
    await supabase.from("editions").upsert(googleEdition, { onConflict: "volume_id" })
  }

  for (const entry of workEditions) {
    if (entry.editions.length === 0) continue

    const olRows = entry.editions.flatMap((edition) => {
      const format = deriveFormat({
        physicalFormat: edition.physicalFormat,
        physicalDescription: edition.physicalDescription,
        physicalDimensions: edition.physicalDimensions,
      })

      const rows: Array<Record<string, any>> = []
      const primaryIsbn10 = edition.isbn10[0] ?? null

      if (edition.isbn13.length > 0) {
        for (const isbn of edition.isbn13) {
          rows.push({
            work_id: entry.workId,
            isbn_13: isbn,
            isbn_10: primaryIsbn10,
            format,
            saleability: null,
            raw_google_data: null,
            updated_at: new Date().toISOString(),
          })
        }
      } else {
        for (const isbn of edition.isbn10) {
          rows.push({
            work_id: entry.workId,
            isbn_10: isbn,
            format,
            saleability: null,
            raw_google_data: null,
            updated_at: new Date().toISOString(),
          })
        }
      }

      return rows
    })

    const olRowsIsbn13 = olRows.filter((row) => row.isbn_13)
    const olRowsIsbn10 = olRows.filter((row) => row.isbn_10 && !row.isbn_13)

    if (olRowsIsbn13.length > 0) {
      await supabase.from("editions").upsert(olRowsIsbn13, { onConflict: "isbn_13" })
    }
    if (olRowsIsbn10.length > 0) {
      await supabase.from("editions").upsert(olRowsIsbn10, { onConflict: "isbn_10" })
    }
  }
}

export async function ensureGoogleBook(volumeId: string) {
  const { bookId, titleId } = await ensureBookFromGoogleVolume(volumeId, [])
  revalidatePath("/search-titles")
  return { bookId, titleId }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

async function ensureTitleReadAndReward(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const { data: existing, error: existingError } = await supabase
    .from("title_reads")
    .select("title_id")
    .eq("user_profile_id", profileId)
    .eq("title_id", titleId)
    .maybeSingle()

  if (existingError) {
    console.error("Failed to check title read status", existingError)
    throw new Error("Failed to mark title as read")
  }

  if (existing?.title_id) return

  const { error } = await supabase
    .from("title_reads")
    .insert({ user_profile_id: profileId, title_id: titleId })

  if (error) {
    console.error("Failed to mark title as read", error)
    throw new Error("Failed to mark title as read")
  }

  await awardPointsForTitleAction({
    supabase,
    profileId,
    titleId,
    sourceType: "title_read",
    sourceId: titleId,
    basePoints: 3,
    reason: "completed_reading",
  })
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
    last_read_at: new Date().toISOString(),
  }
  let isCompleted = false

  if (progress.mode === "pages") {
    const totalPages = Math.max(1, Math.floor(progress.totalPages))
    const currentPage = clamp(Math.floor(progress.currentPage), 0, totalPages)
    const percent = Math.round((currentPage / totalPages) * 100)

    update.current_page = currentPage
    update.total_pages = totalPages
    update.progress_percent = percent
    update.minutes_listened = null
    update.total_minutes = null
    isCompleted = percent >= 100
  } else {
    const totalMinutes = Math.max(1, Math.floor(progress.totalMinutes))
    const minutesListened = clamp(Math.floor(progress.minutesListened), 0, totalMinutes)
    const percent = Math.round((minutesListened / totalMinutes) * 100)

    update.minutes_listened = minutesListened
    update.total_minutes = totalMinutes
    update.progress_percent = percent
    update.total_pages = null
    isCompleted = percent >= 100
  }

  update.is_completed = isCompleted

  if (bookId) {
    update.book_id = bookId
    const { error } = await supabase.from("user_progress").upsert(update, {
      onConflict: "user_profile_id,book_id",
    })

    if (error) {
      console.error("Failed to upsert progress", error)
      throw new Error("Failed to save progress")
    }

    if (isCompleted) {
      await ensureTitleReadAndReward(supabase, profileId, titleId)
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

  if (isCompleted) {
    await ensureTitleReadAndReward(supabase, profileId, titleId)
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
    last_read_at: new Date().toISOString(),
  }
  let isCompleted = false

  if (progress.mode === "pages") {
    const totalPages = Math.max(1, Math.floor(progress.totalPages))
    const currentPage = clamp(Math.floor(progress.currentPage), 0, totalPages)
    const percent = Math.round((currentPage / totalPages) * 100)

    update.current_page = currentPage
    update.total_pages = totalPages
    update.progress_percent = percent
    isCompleted = percent >= 100

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
    isCompleted = percent >= 100

    // Keep current_page but clear page totals
    update.total_pages = null
  }

  update.is_completed = isCompleted

  const { error } = await supabase.from("user_progress").upsert(update, {
    onConflict: "user_profile_id,book_id",
  })

  if (error) {
    console.error("Failed to upsert progress", error)
    throw new Error("Failed to save progress")
  }

  if (isCompleted) {
    await ensureTitleReadAndReward(supabase, profileId, bookId)
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
    last_read_at: new Date().toISOString(),
  }
  let isCompleted = false

  if (progress.mode === "pages") {
    const totalPages = Math.max(1, Math.floor(progress.totalPages))
    const currentPage = clamp(Math.floor(progress.currentPage), 0, totalPages)
    const percent = Math.round((currentPage / totalPages) * 100)

    update.current_page = currentPage
    update.total_pages = totalPages
    update.progress_percent = percent
    isCompleted = percent >= 100
    update.minutes_listened = null
    update.total_minutes = null
  } else {
    const totalMinutes = Math.max(1, Math.floor(progress.totalMinutes))
    const minutesListened = clamp(Math.floor(progress.minutesListened), 0, totalMinutes)
    const percent = Math.round((minutesListened / totalMinutes) * 100)

    update.minutes_listened = minutesListened
    update.total_minutes = totalMinutes
    update.progress_percent = percent
    isCompleted = percent >= 100
    update.total_pages = null
  }

  update.is_completed = isCompleted

  const { error } = await supabase.from("tracked_user_progress").upsert(update, {
    onConflict: "user_profile_id,tracked_book_id",
  })

  if (error) {
    console.error("Failed to upsert progress", error)
    throw new Error("Failed to save progress")
  }

  if (isCompleted) {
    await ensureTitleReadAndReward(supabase, profileId, ensured.titleId)
  }

  revalidatePath("/search-titles")
  return { bookId: ensured.bookId, titleId: ensured.titleId }
}

