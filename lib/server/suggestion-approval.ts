import "server-only"

import { fetchOpenLibraryWorkEditionsByWorkId } from "@/lib/open-library"
import { upsertReferenceIsbns, upsertTitleReferenceWorks } from "@/lib/reference-data"
import {
  buildFallbackWorkSnapshot,
  normalizeCoverChoice,
  normalizeWorkIdList,
  normalizeWorkSnapshots,
  type CoverChoice,
  type WorkSnapshot,
} from "@/lib/suggestions"
import { enforceGenreRulesFromList } from "@/lib/book-tagging"
import { normalizeGenres, type Genre } from "@/lib/types"

function mergeApprovedWorkIds(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>()
  const merged: string[] = []

  for (const workId of [...primary, ...secondary]) {
    if (!workId || seen.has(workId)) continue
    seen.add(workId)
    merged.push(workId)
  }

  return merged
}

export async function finalizeSuggestionApproval(input: {
  admin: any
  suggestionId?: string | null
  reviewerProfileId: string
  titleId: string
  suggestedGenres?: unknown
  adminFinalGenres?: unknown
  suggestedSelectedWorkIds?: unknown
  adminFinalSelectedWorkIds?: unknown
  suggestedSelectedWorkSnapshots?: unknown
  adminFinalSelectedWorkSnapshots?: unknown
  adminFinalCoverSelection?: unknown
}) {
  const reviewedAt = new Date().toISOString()
  const finalGenres = enforceGenreRulesFromList(
    normalizeGenres(input.adminFinalGenres ?? input.suggestedGenres ?? [])
  )
  const reviewerSelectedWorkIds = normalizeWorkIdList(input.adminFinalSelectedWorkIds)
  const suggestedWorkIds = normalizeWorkIdList(input.suggestedSelectedWorkIds)
  const approvedWorkIds = mergeApprovedWorkIds(reviewerSelectedWorkIds, suggestedWorkIds)
  const availableSnapshots = [
    ...normalizeWorkSnapshots(input.adminFinalSelectedWorkSnapshots),
    ...normalizeWorkSnapshots(input.suggestedSelectedWorkSnapshots),
  ]
  const approvedWorkSnapshots = approvedWorkIds.map((workId) => {
    return availableSnapshots.find((snapshot) => snapshot.workId === workId) ?? buildFallbackWorkSnapshot(workId)
  })
  const adminFinalCoverSelection = normalizeCoverChoice(input.adminFinalCoverSelection)

  if (input.suggestionId) {
    const { error: suggestionError } = await input.admin
      .from("suggestions")
      .update({
        admin_final_genres: finalGenres,
        admin_final_selected_work_ids: approvedWorkIds,
        admin_final_selected_work_snapshots: approvedWorkSnapshots,
        admin_final_cover_selection: adminFinalCoverSelection,
        admin_reviewed_at: reviewedAt,
        admin_reviewed_by_profile_id: input.reviewerProfileId,
        status: "approved",
        updated_at: reviewedAt,
      })
      .eq("id", input.suggestionId)

    if (suggestionError) {
      console.error("Failed to update suggestion approval", suggestionError)
      throw new Error("Failed to approve suggestion")
    }
  }

  const titleUpdate: Record<string, unknown> = {
    updated_at: reviewedAt,
  }

  if (finalGenres.length > 0) {
    titleUpdate.genre = finalGenres
  }

  if (approvedWorkIds.length > 0) {
    titleUpdate.work_id = approvedWorkIds[0]
    titleUpdate.dupe_work_ids = approvedWorkIds.length > 1 ? approvedWorkIds.slice(1) : null
  }

  if (adminFinalCoverSelection?.imageUrl) {
    titleUpdate.cover_image_url = adminFinalCoverSelection.imageUrl
  }

  const { error: titleUpdateError } = await input.admin
    .from("titles")
    .update(titleUpdate)
    .eq("id", input.titleId)

  if (titleUpdateError) {
    console.error("Failed to apply approved suggestion to title", titleUpdateError)
    throw new Error("Failed to approve suggestion")
  }

  if (approvedWorkIds.length > 0) {
    await upsertTitleReferenceWorks(input.admin, {
      titleId: input.titleId,
      workIds: approvedWorkIds,
      source: input.suggestionId ? "suggestion-approval" : "moderation-bypass",
    })

    for (const workId of approvedWorkIds) {
      const workEditions = await fetchOpenLibraryWorkEditionsByWorkId(workId)
      await upsertReferenceIsbns(input.admin, {
        titleId: input.titleId,
        workId,
        isbns: workEditions?.isbns ?? [],
        source: input.suggestionId ? "suggestion-approval" : "moderation-bypass",
      })
    }
  }

  return {
    finalGenres: finalGenres as Genre[],
    approvedWorkIds,
    approvedWorkSnapshots: approvedWorkSnapshots as WorkSnapshot[],
    adminFinalCoverSelection: adminFinalCoverSelection as CoverChoice | null,
  }
}