"use server"

import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { extractAsins, getGoogleBook, getGoogleBookDetails, isIsbn10, isIsbn13 } from "@/lib/google-books"
import {
  fetchOpenLibraryMetadataByIsbn,
  fetchOpenLibraryWorkCandidatesByTitleAuthor,
  fetchOpenLibraryWorkEditionsByIsbn,
  type OpenLibraryEdition,
  type OpenLibraryWorkCandidate,
} from "@/lib/open-library"
import { inferGenresFromMetadata } from "@/lib/book-tagging"
import { getCoverChoicesForSelectedWorks } from "@/lib/cover-cache"
import { isExactTitleAuthorMatch, normalizeMatchText, type SuggestionWorkMatchType, type WorkSnapshot } from "@/lib/suggestions"
import { upsertReferenceIsbns, upsertTitleReferenceWorks } from "@/lib/reference-data"
import { normalizeGenres, type Genre } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { extractPlainTextFromHtml } from "@/lib/sanitize"
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

type SuggestionWorkMatchInsert = {
  workId: string
  matchType: SuggestionWorkMatchType
  confidenceScore: number
  reason: string
  workSnapshot: WorkSnapshot
}

type IngestWorkMatchSummary = {
  userReviewCandidates: OpenLibraryWorkCandidate[]
  autoDupeMatches: SuggestionWorkMatchInsert[]
  bookwormSuggestedMatches: SuggestionWorkMatchInsert[]
}

type FormatDerivationInput = {
  dimensions?: { height?: string; width?: string; thickness?: string } | null
  categories?: string[]
  physicalFormat?: string | null
  physicalDescription?: string | null
  physicalDimensions?: string | null
}

function normalizeToken(value: string): string {
  return normalizeMatchText(value)
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i

    for (let j = 1; j <= b.length; j += 1) {
      const temp = previous[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + cost
      )
      diagonal = temp
    }
  }

  return previous[b.length]
}

function computeStringSimilarity(a: string, b: string): number {
  const normalizedA = normalizeToken(a)
  const normalizedB = normalizeToken(b)

  if (!normalizedA && !normalizedB) return 1
  if (!normalizedA || !normalizedB) return 0
  if (normalizedA === normalizedB) return 1

  const distance = levenshteinDistance(normalizedA, normalizedB)
  return clamp(1 - distance / Math.max(normalizedA.length, normalizedB.length), 0, 1)
}

function computeTokenOverlap(a: string, b: string): number {
  const tokensA = new Set(normalizeToken(a).split(" ").filter(Boolean))
  const tokensB = new Set(normalizeToken(b).split(" ").filter(Boolean))

  if (tokensA.size === 0 && tokensB.size === 0) return 1
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let shared = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1
  }

  return shared / Math.max(tokensA.size, tokensB.size)
}

function buildWorkSnapshotFromCandidate(
  candidate: OpenLibraryWorkCandidate,
  match?: { matchType: SuggestionWorkMatchType; confidenceScore: number; reason: string }
): WorkSnapshot {
  return {
    workId: candidate.workId,
    title: candidate.title,
    author: candidate.author,
    firstPublishYear: candidate.firstPublishYear,
    editionCount: candidate.editionCount,
    forSale: null,
    coverUrl: candidate.coverUrl,
    subjects: candidate.subjects,
    matchCategory: match?.matchType ?? null,
    matchConfidence: match?.confidenceScore ?? null,
    matchReason: match?.reason ?? null,
  }
}

function classifyOpenLibraryCandidateMatch(input: {
  title: string
  author: string
  candidate: OpenLibraryWorkCandidate
}): {
  confidenceScore: number
  matchType: SuggestionWorkMatchType | "user_review"
  reason: string
} {
  if (isExactTitleAuthorMatch({
    title: input.title,
    author: input.author,
    candidateTitle: input.candidate.title,
    candidateAuthor: input.candidate.author,
  })) {
    return {
      confidenceScore: 100,
      matchType: "exact_auto_dupe",
      reason: "Exact title and author match",
    }
  }

  const titleSimilarity = computeStringSimilarity(input.title, input.candidate.title)
  const authorSimilarity = input.author ? computeStringSimilarity(input.author, input.candidate.author) : 1
  const titleOverlap = computeTokenOverlap(input.title, input.candidate.title)
  const authorOverlap = input.author ? computeTokenOverlap(input.author, input.candidate.author) : 1

  const confidenceScore = Math.round(
    ((titleSimilarity * 0.55) + (titleOverlap * 0.2) + (authorSimilarity * 0.2) + (authorOverlap * 0.05)) * 100
  )

  if (confidenceScore >= 90 && titleSimilarity >= 0.82 && authorSimilarity >= 0.72) {
    return {
      confidenceScore,
      matchType: "bookworm_suggested",
      reason: "High-likelihood title and author match",
    }
  }

  return {
    confidenceScore,
    matchType: "user_review",
    reason: "Lower-confidence match left for user review",
  }
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

  const { data: titleMatches } = await (authorQuery
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
        .limit(15))

  const titles = (titleMatches ?? []).map((match) => ({
    id: match.id as string,
    title: match.title as string,
    author: match.author as string,
    coverImageUrl: (match as any).cover_image_url ?? null,
    source: "title" as const,
  }))

  return titles.slice(0, 15)
}

async function filterDedupedWorkCandidates(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  candidates: OpenLibraryWorkCandidate[]
): Promise<OpenLibraryWorkCandidate[]> {
  if (candidates.length === 0) return []

  const workIds = candidates.map((candidate) => candidate.workId)
  const orFilter = workIds.map((id) => `dupe_work_ids.cs.{${id}}`).join(",")

  const [{ data: titleWorkMatches }, { data: titleDupes }, { data: pooledWorkMatches }] = await Promise.all([
    supabase.from("titles").select("work_id").in("work_id", workIds),
    orFilter
      ? supabase.from("titles").select("dupe_work_ids").or(orFilter)
      : Promise.resolve({ data: [] as any[] } as any),
    supabase.from("title_reference_works").select("work_id").in("work_id", workIds),
  ])

  const deduped = new Set<string>()
  for (const row of titleWorkMatches ?? []) {
    if ((row as any).work_id) deduped.add((row as any).work_id as string)
  }
  for (const row of pooledWorkMatches ?? []) {
    if ((row as any).work_id) deduped.add((row as any).work_id as string)
  }
  const dupeRows = [...(titleDupes ?? [])]
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

async function buildIngestWorkMatchSummary(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  input: { title: string; author: string; isbn: string | null }
): Promise<IngestWorkMatchSummary> {
  let workCandidates = await fetchOpenLibraryWorkCandidatesByTitleAuthor({
    title: input.title,
    author: input.author,
    limit: 15,
  })

  if (input.isbn) {
    const workByIsbn = await fetchOpenLibraryWorkEditionsByIsbn(input.isbn)
    if (workByIsbn?.workId && !workCandidates.some((candidate) => candidate.workId === workByIsbn.workId)) {
      workCandidates = [
        {
          workId: workByIsbn.workId,
          title: input.title,
          author: input.author,
          coverUrl: null,
          firstPublishYear: null,
          editionCount: workByIsbn.editions.length || null,
          subjects: [],
        },
        ...workCandidates,
      ]
    }
  }

  const uniqueCandidates = Array.from(
    new Map(workCandidates.map((candidate) => [candidate.workId, candidate])).values()
  )
  const filteredCandidates = await filterDedupedWorkCandidates(supabase, uniqueCandidates)

  const summary: IngestWorkMatchSummary = {
    userReviewCandidates: [],
    autoDupeMatches: [],
    bookwormSuggestedMatches: [],
  }

  for (const candidate of filteredCandidates) {
    const classification = classifyOpenLibraryCandidateMatch({
      title: input.title,
      author: input.author,
      candidate,
    })

    if (classification.matchType === "user_review") {
      summary.userReviewCandidates.push(candidate)
      continue
    }

    const typedClassification: {
      matchType: SuggestionWorkMatchType
      confidenceScore: number
      reason: string
    } = {
      matchType: classification.matchType,
      confidenceScore: classification.confidenceScore,
      reason: classification.reason,
    }

    const entry: SuggestionWorkMatchInsert = {
      workId: candidate.workId,
      matchType: typedClassification.matchType,
      confidenceScore: typedClassification.confidenceScore,
      reason: typedClassification.reason,
      workSnapshot: buildWorkSnapshotFromCandidate(candidate, typedClassification),
    }

    if (classification.matchType === "exact_auto_dupe") {
      summary.autoDupeMatches.push(entry)
    } else {
      summary.bookwormSuggestedMatches.push(entry)
    }
  }

  return summary
}

function resolveWorkSelection(selectedWorkIds: string[] | null | undefined): WorkSelection {
  const normalized = (selectedWorkIds ?? []).filter((id) => typeof id === "string" && id.trim().length > 0)
  const unique = Array.from(new Set(normalized))
  return {
    primaryWorkId: unique[0] ?? null,
    dupeWorkIds: unique.length > 1 ? unique.slice(1) : [],
  }
}

async function getExistingTitleIdForVolume(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  volumeId: string
): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("title_sources")
    .select("title_id")
    .eq("source", "google")
    .eq("external_id", volumeId)
    .maybeSingle()

  if (error) {
    console.error("Error looking up title_sources mapping", error)
    throw new Error(
      `Failed to lookup title mapping (title_sources). ${error.code ?? ""} ${error.message}`.trim()
    )
  }

  return (data?.title_id as string | undefined) ?? null
}

async function ensureTitleSourceMapping(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  volumeId: string,
  titleId: string
) {
  const admin = createAdminClient()
  const { error } = await admin.from("title_sources").upsert(
    {
      source: "google",
      external_id: volumeId,
      title_id: titleId,
    },
    {
      onConflict: "source,external_id",
    }
  )

  if (error) {
    console.error("Failed to upsert title_sources mapping", error)
    throw new Error("Failed to save title source mapping")
  }
}

async function ensureTitleForGoogleVolume(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  volumeId: string,
  volume: {
    title: string
    authors: string[]
    description: string | null
    thumbnailUrl: string | null
    publishedYear: number | null
    isbn: string | null
  },
  workInfo?: { workId: string | null; isbnList: string[]; dupeWorkIds?: string[] }
) {
  const admin = createAdminClient()
  const author = volume.authors?.[0] ?? "Unknown author"
  const existingMappedTitleId = await getExistingTitleIdForVolume(supabase, volumeId)
  const now = new Date().toISOString()

  const selectFields = "id,isbn_list,dupe_work_ids,cover_image_url,description,published_year,isbn,work_id"
  let existingTitle: any = null
  let titleId = existingMappedTitleId

  if (titleId) {
    const { data } = await admin.from("titles").select(selectFields).eq("id", titleId).maybeSingle()
    existingTitle = data ?? null
  }

  if (!titleId && volume.isbn) {
    const { data } = await admin.from("titles").select(selectFields).eq("isbn", volume.isbn).maybeSingle()
    if (data?.id) {
      titleId = data.id as string
      existingTitle = data
    }
  }

  if (!titleId && volume.title) {
    const { data } = await admin
      .from("titles")
      .select(selectFields)
      .ilike("title", volume.title)
      .ilike("author", author)
      .maybeSingle()
    if (data?.id) {
      titleId = data.id as string
      existingTitle = data
    }
  }

  if (!titleId) {
    const { data: inserted, error: insertError } = await admin
      .from("titles")
      .insert({
        title: volume.title,
        author,
        description: volume.description,
        cover_image_url: volume.thumbnailUrl,
        published_year: volume.publishedYear,
        isbn: volume.isbn,
        work_id: workInfo?.workId ?? null,
        isbn_list: (workInfo?.isbnList?.length ?? 0) > 0 ? workInfo?.isbnList : null,
        dupe_work_ids: (workInfo?.dupeWorkIds?.length ?? 0) > 0 ? workInfo?.dupeWorkIds : null,
        updated_at: now,
      })
      .select("id")
      .single()

    if (insertError || !inserted?.id) {
      console.error("Failed to insert title", insertError)
      throw new Error("Failed to create title")
    }

    titleId = inserted.id as string
  } else {
    const mergedIsbns = mergeIsbnLists(existingTitle?.isbn_list ?? null, workInfo?.isbnList ?? [])
    const updatePayload: Record<string, any> = {
      updated_at: now,
    }
    if (workInfo?.workId) updatePayload.work_id = workInfo.workId
    if (mergedIsbns.length > 0) updatePayload.isbn_list = mergedIsbns
    if (workInfo?.dupeWorkIds?.length) {
      updatePayload.dupe_work_ids = mergeDupeWorkIds(
        existingTitle?.dupe_work_ids ?? null,
        workInfo.dupeWorkIds,
        workInfo.workId ?? null
      )
    }
    if (!existingTitle?.cover_image_url && volume.thumbnailUrl) updatePayload.cover_image_url = volume.thumbnailUrl
    if (!existingTitle?.description && volume.description) updatePayload.description = volume.description
    if (!existingTitle?.published_year && volume.publishedYear) updatePayload.published_year = volume.publishedYear
    if (!existingTitle?.isbn && volume.isbn) updatePayload.isbn = volume.isbn

    const { error: updateError } = await admin.from("titles").update(updatePayload).eq("id", titleId)
    if (updateError) {
      console.error("Failed to update title", updateError)
      throw new Error("Failed to update title")
    }
  }

  await ensureTitleSourceMapping(supabase, volumeId, titleId)
  return titleId
}

async function ensureBookFromGoogleVolume(
  volumeId: string,
  _selectedWorkIds: string[]
): Promise<{ titleId: string }> {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)
  const admin = createAdminClient()

  const details = await getGoogleBookDetails(volumeId)
  if (!details) throw new Error("Unable to fetch Google book")
  const volume = details.refined

  const openLibrary = volume.isbn ? await fetchOpenLibraryWorkEditionsByIsbn(volume.isbn) : null
  const identifiers = mergeIsbnLists(null, [
    volume.isbn ?? "",
    ...details.identifiers,
    ...(openLibrary?.isbns ?? []),
  ])

  const titleId = await ensureTitleForGoogleVolume(supabase, volumeId, volume, {
    workId: null,
    isbnList: identifiers,
    dupeWorkIds: [],
  })

  if (openLibrary?.workId) {
    await upsertTitleReferenceWorks(admin, {
      titleId,
      workIds: [openLibrary.workId],
      source: "google-ingest",
      confidenceScore: 100,
    })

    await upsertReferenceIsbns(admin, {
      titleId,
      workId: openLibrary.workId,
      isbns: openLibrary.isbns,
      source: "google-ingest",
    })
  }

  return { titleId }
}

export async function getGoogleIngestSuggestion(volumeId: string): Promise<{
  title: string
  author: string
  suggestedGenres: Genre[]
  workCandidates: OpenLibraryWorkCandidate[]
  localDuplicates: LocalDuplicate[]
  requiresWorkConfirmation: boolean
  autoDupeMatchCount: number
  bookwormSuggestedMatchCount: number
}> {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)

  const volume = await getGoogleBook(volumeId)
  if (!volume) throw new Error("Unable to fetch Google book")

  const openLibrary = volume.isbn ? await fetchOpenLibraryMetadataByIsbn(volume.isbn) : null
  const suggestedGenres = inferGenresFromMetadata({
    title: volume.title,
    googleMainCategory: volume.mainCategory ?? null,
    googleCategories: volume.categories,
    googleDescription: volume.description,
    openLibrary,
  })

  const workMatchSummary = await buildIngestWorkMatchSummary(supabase, {
    title: volume.title,
    author: volume.authors[0] ?? "",
    isbn: volume.isbn ?? null,
  })
  const requiresWorkConfirmation = workMatchSummary.userReviewCandidates.length > 0

  const localDuplicates = await findLocalDuplicates(
    supabase,
    volume.title,
    volume.authors[0] ?? ""
  )

  return {
    title: volume.title,
    author: volume.authors[0] ?? "Unknown author",
    suggestedGenres: normalizeGenres(suggestedGenres),
    workCandidates: workMatchSummary.userReviewCandidates,
    localDuplicates,
    requiresWorkConfirmation,
    autoDupeMatchCount: workMatchSummary.autoDupeMatches.length,
    bookwormSuggestedMatchCount: workMatchSummary.bookwormSuggestedMatches.length,
  }
}

export async function confirmGoogleBookIngest(input: {
  volumeId: string
  selectedGenres: Genre[]
  selectedWorkIds?: string[]
  requiresWorkSelection?: boolean
  algorithmSuggestedGenres?: Genre[]
  workCandidates?: Array<{
    workId: string
    title: string
    author: string
    firstPublishYear: number | null
    editionCount: number | null
    coverUrl?: string | null
  }>
}) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const selectedGenres = normalizeGenres(input.selectedGenres)
  if (selectedGenres.length === 0) {
    throw new Error("Select at least one genre")
  }

  const ensured = await ensureBookFromGoogleVolume(input.volumeId, input.selectedWorkIds ?? [])
  const volume = await getGoogleBook(input.volumeId)
  if (!volume) throw new Error("Unable to fetch Google book")

  const workMatchSummary = await buildIngestWorkMatchSummary(supabase, {
    title: volume.title,
    author: volume.authors[0] ?? "",
    isbn: volume.isbn ?? null,
  })

  const selection = resolveWorkSelection(input.selectedWorkIds)
  const algorithmSuggestedGenres = normalizeGenres(input.algorithmSuggestedGenres ?? [])
  const workCandidates = workMatchSummary.userReviewCandidates.length > 0
    ? workMatchSummary.userReviewCandidates
    : (input.workCandidates ?? [])
  const candidateById = new Map(workCandidates.map((candidate) => [candidate.workId, candidate]))
  const selectedWorkIds = [selection.primaryWorkId, ...selection.dupeWorkIds].filter(Boolean) as string[]

  let saleabilityByWorkId = new Map<string, boolean | null>()
  if (selectedWorkIds.length > 0) {
    const { data: editionRows } = await supabase
      .from("editions")
      .select("work_id,saleability")
      .in("work_id", selectedWorkIds)

    const grouped = new Map<string, string[]>()
    for (const row of editionRows ?? []) {
      const workId = (row as any).work_id as string | undefined
      if (!workId) continue
      const list = grouped.get(workId) ?? []
      list.push((row as any).saleability ?? null)
      grouped.set(workId, list)
    }

    for (const workId of selectedWorkIds) {
      const entries = grouped.get(workId) ?? []
      if (entries.length === 0) {
        saleabilityByWorkId.set(workId, null)
        continue
      }
      saleabilityByWorkId.set(workId, entries.some((value) => value === "FOR_SALE"))
    }
  }

  const buildSnapshot = (workId: string) => {
    const candidate = candidateById.get(workId)
    if (!candidate) return null
    return {
      workId,
      title: candidate.title,
      author: candidate.author,
      firstPublishYear: candidate.firstPublishYear,
      editionCount: candidate.editionCount,
      forSale: saleabilityByWorkId.get(workId) ?? null,
      coverUrl: candidate.coverUrl ?? null,
    }
  }

  const selectedWorkSnapshots = selectedWorkIds
    .map((workId) => buildSnapshot(workId))
    .filter(Boolean)

  const suggestionPayload: Record<string, any> = {
    title_id: ensured.titleId,
    suggested_genres: selectedGenres,
    algorithm_suggested_genres: algorithmSuggestedGenres.length > 0 ? algorithmSuggestedGenres : null,
    suggested_selected_work_ids: selectedWorkIds.length > 0 ? selectedWorkIds : null,
    suggested_selected_work_snapshots: selectedWorkSnapshots.length > 0 ? selectedWorkSnapshots : null,
    suggested_by_profile_id: profileId,
  }
  const { data: insertedSuggestion, error: suggestionError } = await supabase
    .from("suggestions")
    .insert(suggestionPayload)
    .select("id")
    .single()
  if (suggestionError || !insertedSuggestion?.id) {
    console.error("Failed to create suggestion", suggestionError)
    throw new Error("Failed to submit suggestion")
  }

  const bookwormMatchRows = [...workMatchSummary.autoDupeMatches, ...workMatchSummary.bookwormSuggestedMatches]
  if (bookwormMatchRows.length > 0) {
    const { error: bookwormMatchError } = await supabase.from("suggestion_work_matches").insert(
      bookwormMatchRows.map((match) => ({
        suggestion_id: insertedSuggestion.id,
        work_id: match.workId,
        match_type: match.matchType,
        confidence_score: match.confidenceScore,
        reason: match.reason,
        work_snapshot: match.workSnapshot,
        updated_at: new Date().toISOString(),
      }))
    )

    if (bookwormMatchError) {
      console.error("Failed to create Bookworm work match rows", bookwormMatchError)
      throw new Error("Failed to submit suggestion")
    }
  }

  if (selectedWorkIds.length > 0) {
    const admin = createAdminClient()
    try {
      await getCoverChoicesForSelectedWorks(admin as any, {
        workIds: selectedWorkIds,
        workSnapshots: selectedWorkSnapshots as WorkSnapshot[],
      })
    } catch (error) {
      console.warn("Failed to warm work cover cache during suggestion creation", error)
    }
  }

  revalidatePath("/search-titles")
  revalidatePath(`/titles/${ensured.titleId}`)
  return { titleId: ensured.titleId }
}

async function upsertEditionsForWorks(input: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  primaryWorkId: string
  identifiers: string[]
  googleDetails: Awaited<ReturnType<typeof getGoogleBookDetails>>
  workEditions: Array<{ workId: string; editions: OpenLibraryEdition[] }>
  googleCategories: string[]
}) {
  const { primaryWorkId, identifiers, googleDetails, workEditions, googleCategories } = input
  const admin = createAdminClient()
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
    await admin.from("editions").upsert(googleEdition, { onConflict: "isbn_13" })
  } else if (isbn10) {
    await admin.from("editions").upsert(googleEdition, { onConflict: "isbn_10" })
  } else if (googleAsin) {
    await admin.from("editions").upsert(googleEdition, { onConflict: "volume_id" })
  } else {
    await admin.from("editions").upsert(googleEdition, { onConflict: "volume_id" })
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
      await admin.from("editions").upsert(olRowsIsbn13, { onConflict: "isbn_13" })
    }
    if (olRowsIsbn10.length > 0) {
      await admin.from("editions").upsert(olRowsIsbn10, { onConflict: "isbn_10" })
    }
  }
}

export async function ensureGoogleBook(volumeId: string) {
  const { titleId } = await ensureBookFromGoogleVolume(volumeId, [])
  revalidatePath("/search-titles")
  return { titleId }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

async function ensureTitleReadAndReward(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const finishedListId = await ensureFinishedReadingListForProfile(supabase, profileId)
  if (!finishedListId) throw new Error("Failed to mark title as read")

  const { data: existing, error: existingError } = await supabase
    .from("title_list_items")
    .select("title_id")
    .eq("list_id", finishedListId)
    .eq("title_id", titleId)
    .maybeSingle()

  if (existingError) {
    console.error("Failed to check title read status", existingError)
    throw new Error("Failed to mark title as read")
  }

  if (existing?.title_id) return

  const { error } = await supabase
    .from("title_list_items")
    .insert({ list_id: finishedListId, title_id: titleId })

  if (error) {
    console.error("Failed to mark title as read", error)
    throw new Error("Failed to mark title as read")
  }

  const { data: title } = await supabase
    .from("titles")
    .select("id, title, cover_image_url")
    .eq("id", titleId)
    .maybeSingle()

  await supabase.from("activity_events").insert({
    user_profile_id: profileId,
    title_id: titleId,
    event_type: "title_finished",
    metadata: {
      title: {
        id: titleId,
        title: title?.title ?? "a title",
        cover: (title as any)?.cover_image_url ?? null,
      },
    },
  })

  await awardPointsForTitleAction({
    supabase,
    profileId,
    titleId,
    sourceType: "title_read",
    sourceId: titleId,
    basePoints: 3,
    reason: "completed_reading",
  })

  await removeFromCurrentReadingList(supabase, profileId, titleId)
  await removeFromToReadList(supabase, profileId, titleId)
}

async function ensureToReadListForProfile(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string
) {
  const { data: existing } = await supabase
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("list_type", "to-read")
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: profileId,
      name: "Planned Reading",
      list_type: "to-read",
      is_public: false,
      is_default: true,
    })
    .select("id")
    .single()

  return created?.id ?? null
}

async function ensureCurrentReadingListForProfile(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string
) {
  const { data: existing } = await supabase
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("list_type", "current-reading")
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: profileId,
      name: "Current Reading",
      list_type: "current-reading",
      is_public: false,
      is_default: true,
    })
    .select("id")
    .single()

  return created?.id ?? null
}

async function ensureFinishedReadingListForProfile(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string
) {
  const { data: existing } = await supabase
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("list_type", "finished-reading")
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: profileId,
      name: "Finished Reading",
      list_type: "finished-reading",
      is_public: false,
      is_default: true,
    })
    .select("id")
    .single()

  return created?.id ?? null
}

async function removeFromToReadList(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const listId = await ensureToReadListForProfile(supabase, profileId)
  if (!listId) return
  await supabase
    .from("title_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("title_id", titleId)
}

async function addToCurrentReadingList(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const listId = await ensureCurrentReadingListForProfile(supabase, profileId)
  if (!listId) return
  await supabase
    .from("title_list_items")
    .upsert({ list_id: listId, title_id: titleId }, { onConflict: "list_id,title_id" })
}

async function removeFromCurrentReadingList(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const listId = await ensureCurrentReadingListForProfile(supabase, profileId)
  if (!listId) return
  await supabase
    .from("title_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("title_id", titleId)
}

export async function trackTitleProgress(input: {
  titleId: string
  progress: TrackProgressInput
  noteHtml?: string
  noteText?: string
}) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { titleId, progress, noteHtml, noteText } = input

  const update: Record<string, any> = {
    user_profile_id: profileId,
    last_read_at: new Date().toISOString(),
  }
  let isCompleted = false
  let progressPercent = 0

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
    progressPercent = percent
  } else {
    const totalMinutes = Math.max(1, Math.floor(progress.totalMinutes))
    const minutesListened = clamp(Math.floor(progress.minutesListened), 0, totalMinutes)
    const percent = Math.round((minutesListened / totalMinutes) * 100)

    update.minutes_listened = minutesListened
    update.total_minutes = totalMinutes
    update.progress_percent = percent
    update.total_pages = null
    isCompleted = percent >= 100
    progressPercent = percent
  }

  update.is_completed = isCompleted

  const normalizedEntryDate = new Date().toISOString().slice(0, 10)

  const normalizedNoteHtml = (noteHtml ?? "").trim() || null
  const normalizedNoteText = (noteText ?? "").trim() || (normalizedNoteHtml ? extractPlainTextFromHtml(normalizedNoteHtml) : null)

  const diaryEntryBase = {
    user_profile_id: profileId,
    title_id: titleId,
    entry_date: normalizedEntryDate,
    note_html: normalizedNoteHtml,
    note_text: normalizedNoteText,
    progress_mode: progress.mode,
    current_page: update.current_page ?? null,
    total_pages: update.total_pages ?? null,
    minutes_listened: update.minutes_listened ?? null,
    total_minutes: update.total_minutes ?? null,
    progress_percent: update.progress_percent ?? null,
    is_completed: isCompleted,
  }

  const upsertDiaryEntryForToday = async (override: Record<string, any>) => {
    const { data: existingEntry } = await supabase
      .from("reading_diary_entries")
      .select("id,note_html,note_text")
      .eq("user_profile_id", profileId)
      .eq("title_id", titleId)
      .eq("entry_date", normalizedEntryDate)
      .maybeSingle()

    const notePayload: Record<string, any> = {}
    if (normalizedNoteHtml) notePayload.note_html = normalizedNoteHtml
    if (normalizedNoteText) notePayload.note_text = normalizedNoteText

    if (existingEntry?.id) {
      const { error: updateError } = await supabase
        .from("reading_diary_entries")
        .update({
          ...override,
          ...notePayload,
        })
        .eq("id", existingEntry.id)

      if (updateError) {
        console.error("Failed to update diary entry", updateError)
        throw new Error("Failed to save diary entry")
      }
      return existingEntry.id
    }

    const { error: insertError } = await supabase
      .from("reading_diary_entries")
      .insert({
        ...diaryEntryBase,
        ...override,
      })

    if (insertError) {
      console.error("Failed to insert diary entry", insertError)
      throw new Error("Failed to save diary entry")
    }
    return null
  }

  update.title_id = titleId
  const { error } = await supabase.from("title_user_progress").upsert(update, {
    onConflict: "user_profile_id,title_id",
  })

  if (error) {
    console.error("Failed to upsert progress", error)
    throw new Error("Failed to save progress")
  }

  if (progressPercent > 0 && progressPercent < 100) {
    await addToCurrentReadingList(supabase, profileId, titleId)
    await removeFromToReadList(supabase, profileId, titleId)
  } else if (progressPercent === 0) {
    await removeFromCurrentReadingList(supabase, profileId, titleId)
  }

  if (isCompleted) {
    await ensureTitleReadAndReward(supabase, profileId, titleId)
  }

  await upsertDiaryEntryForToday({})

  revalidatePath(`/titles/${titleId}`)
  revalidatePath("/diary")
  return { titleId }
}

export async function updateDiaryEntry(input: {
  entryId: string
  noteHtml?: string
  noteText?: string
}) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: entry, error: entryError } = await supabase
    .from("reading_diary_entries")
    .select("id,title_id")
    .eq("user_profile_id", profileId)
    .eq("id", input.entryId)
    .single()

  if (entryError || !entry) {
    throw new Error("Diary entry not found")
  }

  if (!entry.title_id) {
    throw new Error("Diary entry missing title")
  }

  const normalizedUpdateNoteHtml = (input.noteHtml ?? "").trim() || null
  const normalizedUpdateNoteText = (input.noteText ?? "").trim() || (normalizedUpdateNoteHtml ? extractPlainTextFromHtml(normalizedUpdateNoteHtml) : null)
  const update: Record<string, any> = {
    note_html: normalizedUpdateNoteHtml,
    note_text: normalizedUpdateNoteText,
  }

  const { error: updateError } = await supabase
    .from("reading_diary_entries")
    .update(update)
    .eq("id", input.entryId)
    .eq("user_profile_id", profileId)

  if (updateError) {
    console.error("Failed to update diary entry", updateError)
    throw new Error("Failed to update diary entry")
  }

  revalidatePath(`/diary/${input.entryId}`)
  revalidatePath("/diary")
  revalidatePath(`/titles/${entry.title_id}`)
  return { entryId: input.entryId }
}

export async function claimAndTrackGoogleBook(volumeId: string, progress: TrackProgressInput) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const ensured = await ensureBookFromGoogleVolume(volumeId, [])

  const update: Record<string, any> = {
    user_profile_id: profileId,
    title_id: ensured.titleId,
    last_read_at: new Date().toISOString(),
  }
  let isCompleted = false
  let progressPercent = 0

  if (progress.mode === "pages") {
    const totalPages = Math.max(1, Math.floor(progress.totalPages))
    const currentPage = clamp(Math.floor(progress.currentPage), 0, totalPages)
    const percent = Math.round((currentPage / totalPages) * 100)

    update.current_page = currentPage
    update.total_pages = totalPages
    update.progress_percent = percent
    isCompleted = percent >= 100
    progressPercent = percent
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
    progressPercent = percent
    update.total_pages = null
  }

  update.is_completed = isCompleted

  const { error } = await supabase.from("title_user_progress").upsert(update, {
    onConflict: "user_profile_id,title_id",
  })

  if (error) {
    console.error("Failed to upsert progress", error)
    throw new Error("Failed to save progress")
  }

  if (progressPercent > 0 && progressPercent < 100) {
    await addToCurrentReadingList(supabase, profileId, ensured.titleId)
    await removeFromToReadList(supabase, profileId, ensured.titleId)
  } else if (progressPercent === 0) {
    await removeFromCurrentReadingList(supabase, profileId, ensured.titleId)
  }

  if (isCompleted) {
    await ensureTitleReadAndReward(supabase, profileId, ensured.titleId)
  }

  revalidatePath("/search-titles")
  return { titleId: ensured.titleId }
}

