import "server-only"

import { getGoogleBook } from "@/lib/google-books"
import {
  fetchOpenLibraryMetadataByIsbn,
  type OpenLibraryWorkCandidate,
} from "@/lib/open-library"
import { inferGenresFromMetadata } from "@/lib/book-tagging"
import { createAdminClient, type SupabaseServerClient } from "@/lib/supabase-server"
import { normalizeGenres, type Genre } from "@/lib/types"
import { finalizeSuggestionApproval } from "@/lib/server/suggestion-approval"
import { ensureGoogleBookIngested, findLocalTitleDuplicates } from "@/lib/server/google-title-ingest"
import {
  consumeGoogleIngestPreview,
  readGoogleIngestPreview,
  storeGoogleIngestPreview,
} from "@/lib/server/google-ingest-preview-cache"
import { buildIngestWorkMatchSummary } from "@/lib/server/google-ingest-work-matching"
import {
  resolveWorkSelection,
  type LocalDuplicate,
  type SuggestionWorkMatchInsert,
} from "@/lib/google-ingest-utils"
import type { Json } from "@/lib/database.types"

type CandidateSnapshotInput = {
  workId: string
  title: string
  author: string
  coverUrl?: string | null
  firstPublishYear: number | null
  editionCount: number | null
}

export type GoogleIngestSuggestion = {
  previewToken: string
  title: string
  author: string
  suggestedGenres: Genre[]
  workCandidates: OpenLibraryWorkCandidate[]
  localDuplicates: LocalDuplicate[]
  requiresWorkConfirmation: boolean
  autoDupeMatchCount: number
  bookwormSuggestedMatchCount: number
}

export async function getGoogleBookIngestSuggestionForProfile(input: {
  supabase: SupabaseServerClient
  profileId: string
  volumeId: string
}): Promise<GoogleIngestSuggestion> {
  const { supabase, profileId, volumeId } = input
  const volume = await getGoogleBook(volumeId)
  if (!volume) throw new Error("Unable to fetch Google book")

  const [openLibrary, workMatchSummary, localDuplicates] = await Promise.all([
    volume.isbn ? fetchOpenLibraryMetadataByIsbn(volume.isbn) : Promise.resolve(null),
    buildIngestWorkMatchSummary(supabase, {
      title: volume.title,
      author: volume.authors[0] ?? "",
      isbn: volume.isbn ?? null,
    }),
    findLocalTitleDuplicates(supabase, volume.title, volume.authors[0] ?? ""),
  ])

  const suggestedGenres = inferGenresFromMetadata({
    title: volume.title,
    googleMainCategory: volume.mainCategory ?? null,
    googleCategories: volume.categories,
    googleDescription: volume.description,
    openLibrary,
  })
  const requiresWorkConfirmation = workMatchSummary.userReviewCandidates.length > 0
  const normalizedSuggestedGenres = normalizeGenres(suggestedGenres)
  const previewToken = await storeGoogleIngestPreview(supabase, {
    profileId,
    volumeId,
    suggestedGenres: normalizedSuggestedGenres,
    workCandidates: workMatchSummary.userReviewCandidates,
    localDuplicates,
    requiresWorkConfirmation,
    autoDupeMatchCount: workMatchSummary.autoDupeMatches.length,
    bookwormSuggestedMatchCount: workMatchSummary.bookwormSuggestedMatches.length,
    workMatchSummary,
  })

  return {
    previewToken,
    title: volume.title,
    author: volume.authors[0] ?? "Unknown author",
    suggestedGenres: normalizedSuggestedGenres,
    workCandidates: workMatchSummary.userReviewCandidates,
    localDuplicates,
    requiresWorkConfirmation,
    autoDupeMatchCount: workMatchSummary.autoDupeMatches.length,
    bookwormSuggestedMatchCount: workMatchSummary.bookwormSuggestedMatches.length,
  }
}

export async function confirmGoogleBookIngestForProfile(input: {
  supabase: SupabaseServerClient
  profileId: string
  reviewerProfileId: string | null
  autoApproved: boolean
  ingestInput: {
    volumeId: string
    previewToken?: string | null
    selectedGenres: Genre[]
    selectedWorkIds: string[]
    workCandidates?: CandidateSnapshotInput[]
  }
}) {
  const { supabase, profileId, reviewerProfileId, autoApproved, ingestInput } = input
  const selectedGenres = ingestInput.selectedGenres
  const preview = await readGoogleIngestPreview(supabase, {
    token: ingestInput.previewToken,
    profileId,
    volumeId: ingestInput.volumeId,
  })

  const ensured = await ensureGoogleBookIngested(ingestInput.volumeId)
  const volume = ensured.volume
  const workMatchSummary = autoApproved
    ? null
    : preview?.workMatchSummary ??
      (await buildIngestWorkMatchSummary(supabase, {
        title: volume.title,
        author: volume.authors[0] ?? "",
        isbn: volume.isbn ?? null,
      }))

  const selection = resolveWorkSelection(ingestInput.selectedWorkIds)
  const algorithmSuggestedGenres = normalizeGenres(
    preview?.suggestedGenres ??
      inferGenresFromMetadata({
        title: volume.title,
        googleMainCategory: volume.mainCategory ?? null,
        googleCategories: volume.categories,
        googleDescription: volume.description,
        openLibrary: volume.isbn ? await fetchOpenLibraryMetadataByIsbn(volume.isbn) : null,
      })
  )
  const workCandidates = workMatchSummary?.userReviewCandidates?.length
    ? workMatchSummary.userReviewCandidates
    : (preview?.workCandidates ?? ingestInput.workCandidates ?? [])
  const candidateById = new Map(workCandidates.map((candidate) => [candidate.workId, candidate]))
  const selectedWorkIds = [selection.primaryWorkId, ...selection.dupeWorkIds].filter(Boolean) as string[]
  const saleabilityByWorkId = await getSaleabilityByWorkId(supabase, selectedWorkIds)
  const selectedWorkSnapshots = selectedWorkIds
    .map((workId) => buildSelectedWorkSnapshot(workId, candidateById, saleabilityByWorkId))
    .filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot))

  const { data: insertedSuggestion, error: suggestionError } = await supabase
    .from("suggestions")
    .insert({
      title_id: ensured.titleId,
      suggested_genres: selectedGenres,
      algorithm_suggested_genres: algorithmSuggestedGenres.length > 0 ? algorithmSuggestedGenres : null,
      suggested_selected_work_ids: selectedWorkIds.length > 0 ? selectedWorkIds : null,
      suggested_selected_work_snapshots: selectedWorkSnapshots.length > 0 ? selectedWorkSnapshots : null,
      suggested_by_profile_id: profileId,
    })
    .select("id")
    .single()

  if (suggestionError || !insertedSuggestion?.id) {
    console.error("Failed to create suggestion", suggestionError)
    throw new Error("Failed to submit suggestion")
  }

  await createSuggestionWorkMatchRows({
    supabase,
    suggestionId: insertedSuggestion.id as string,
    workMatchRows: workMatchSummary
      ? [...workMatchSummary.autoDupeMatches, ...workMatchSummary.bookwormSuggestedMatches]
      : [],
  })

  if (autoApproved && reviewerProfileId) {
    const admin = createAdminClient()
    await finalizeSuggestionApproval({
      admin,
      suggestionId: insertedSuggestion.id as string,
      reviewerProfileId,
      titleId: ensured.titleId,
      suggestedGenres: selectedGenres,
      adminFinalGenres: selectedGenres,
      suggestedSelectedWorkIds: selectedWorkIds,
      adminFinalSelectedWorkIds: selectedWorkIds,
      suggestedSelectedWorkSnapshots: selectedWorkSnapshots,
      adminFinalSelectedWorkSnapshots: selectedWorkSnapshots,
    })
  }

  await consumeGoogleIngestPreview(supabase, {
    token: ingestInput.previewToken,
    profileId,
  })

  return { titleId: ensured.titleId, autoApproved }
}

async function getSaleabilityByWorkId(supabase: SupabaseServerClient, workIds: string[]) {
  const saleabilityByWorkId = new Map<string, boolean | null>()
  if (workIds.length === 0) return saleabilityByWorkId

  const { data: editionRows } = await supabase
    .from("editions")
    .select("work_id,saleability")
    .in("work_id", workIds)

  const grouped = new Map<string, Array<string | null>>()
  for (const row of editionRows ?? []) {
    const workId = row.work_id
    if (!workId) continue
    const list = grouped.get(workId) ?? []
    list.push(row.saleability ?? null)
    grouped.set(workId, list)
  }

  for (const workId of workIds) {
    const entries = grouped.get(workId) ?? []
    saleabilityByWorkId.set(
      workId,
      entries.length === 0 ? null : entries.some((value) => value === "FOR_SALE")
    )
  }

  return saleabilityByWorkId
}

function buildSelectedWorkSnapshot(
  workId: string,
  candidateById: Map<string, CandidateSnapshotInput>,
  saleabilityByWorkId: Map<string, boolean | null>
) {
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

async function createSuggestionWorkMatchRows(input: {
  supabase: SupabaseServerClient
  suggestionId: string
  workMatchRows: SuggestionWorkMatchInsert[]
}) {
  if (input.workMatchRows.length === 0) return

  const { error } = await input.supabase.from("suggestion_work_matches").insert(
    input.workMatchRows.map((match) => ({
      suggestion_id: input.suggestionId,
      work_id: match.workId,
      match_type: match.matchType,
      confidence_score: match.confidenceScore,
      reason: match.reason,
      work_snapshot: match.workSnapshot as Json,
      updated_at: new Date().toISOString(),
    }))
  )

  if (error) {
    console.error("Failed to create Bookworm work match rows", error)
    throw new Error("Failed to submit suggestion")
  }
}
