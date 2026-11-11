import "server-only"

import {
  fetchOpenLibraryWorkCandidatesByTitleAuthor,
  fetchOpenLibraryWorkEditionsByIsbn,
  type OpenLibraryWorkCandidate,
} from "@/lib/open-library"
import {
  buildWorkSnapshotFromCandidate,
  classifyOpenLibraryCandidateMatch,
  type IngestWorkMatchSummary,
  type SuggestionWorkMatchInsert,
} from "@/lib/google-ingest-utils"
import type { SupabaseServerClient } from "@/lib/supabase-server"
import type { SuggestionWorkMatchType } from "@/lib/suggestions"

export async function filterDedupedWorkCandidates(
  supabase: SupabaseServerClient,
  candidates: OpenLibraryWorkCandidate[]
): Promise<OpenLibraryWorkCandidate[]> {
  if (candidates.length === 0) return []

  const workIds = candidates.map((candidate) => candidate.workId)
  const orFilter = workIds.map((id) => `dupe_work_ids.cs.{${id}}`).join(",")

  const [{ data: titleWorkMatches }, { data: titleDupes }, { data: pooledWorkMatches }] = await Promise.all([
    supabase.from("titles").select("work_id").in("work_id", workIds),
    orFilter
      ? supabase.from("titles").select("dupe_work_ids").or(orFilter)
      : Promise.resolve({ data: [] as Array<{ dupe_work_ids: unknown }> }),
    supabase.from("title_reference_works").select("work_id").in("work_id", workIds),
  ])

  const deduped = new Set<string>()
  for (const row of titleWorkMatches ?? []) {
    if (row.work_id) deduped.add(row.work_id)
  }
  for (const row of pooledWorkMatches ?? []) {
    if (row.work_id) deduped.add(row.work_id)
  }
  const dupeRows = [...(titleDupes ?? [])]
  for (const row of dupeRows) {
    const values = row.dupe_work_ids
    if (Array.isArray(values)) {
      for (const id of values) {
        if (typeof id === "string") deduped.add(id)
      }
    }
  }

  return candidates.filter((candidate) => !deduped.has(candidate.workId))
}

export async function buildIngestWorkMatchSummary(
  supabase: SupabaseServerClient,
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
