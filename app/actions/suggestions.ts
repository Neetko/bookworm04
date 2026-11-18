"use server"

import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { fetchOpenLibraryWorkCandidatesByTitleAuthor } from "@/lib/open-library"
import { getCoverChoicesForSelectedWorks } from "@/lib/cover-cache"
import { getLinkedTitlesByWorkId, getTitleReferenceWorkIds, type LinkedTitleSummary } from "@/lib/reference-data"
import { buildSuggestionReviewUpdate, isExactTitleAuthorMatch, normalizeWorkIdList, type CoverChoice, type WorkSnapshot } from "@/lib/suggestions"
import { type Genre } from "@/lib/types"
import { finalizeSuggestionApproval } from "@/lib/server/suggestion-approval"
import { canReviewSuggestions, getCurrentUserAccess } from "@/lib/server/roles"
import { requireVerifiedStaffSession } from "@/lib/server/staff-mfa"
import { revalidatePath } from "next/cache"

async function requireSuggestionReviewerAccess() {
  const access = await getCurrentUserAccess()

  if (!access.user) throw new Error("Unauthorized")

  if (!canReviewSuggestions(access.role)) {
    throw new Error("Moderator access required")
  }

  if (!access.profileId) {
    throw new Error("Reviewer profile not found")
  }

  await requireVerifiedStaffSession()

  return {
    admin: createAdminClient(),
    user: access.user,
    profileId: access.profileId,
    role: access.role,
  }
}

function parseSuggestionId(input: FormData | { suggestionId: string }) {
  const suggestionId = input instanceof FormData
    ? String(input.get("suggestionId") ?? "").trim()
    : String(input.suggestionId ?? "").trim()

  if (!suggestionId) throw new Error("Missing suggestion id")

  return suggestionId
}

export async function saveSuggestionReviewAction(input: {
  suggestionId: string
  adminFinalGenres: Genre[]
  adminFinalSelectedWorkIds: string[]
  adminFinalSelectedWorkSnapshots: WorkSnapshot[]
  adminFinalCoverSelection: CoverChoice | null
}) {
  const suggestionId = parseSuggestionId(input)

  const { admin, profileId: reviewerProfileId } = await requireSuggestionReviewerAccess()
  const reviewUpdate = buildSuggestionReviewUpdate(input)

  const { error } = await admin
    .from("suggestions")
    .update({
      admin_final_genres: reviewUpdate.adminFinalGenres,
      admin_final_selected_work_ids: reviewUpdate.adminFinalSelectedWorkIds,
      admin_final_selected_work_snapshots: reviewUpdate.adminFinalSelectedWorkSnapshots,
      admin_final_cover_selection: reviewUpdate.adminFinalCoverSelection,
      admin_reviewed_at: new Date().toISOString(),
      admin_reviewed_by_profile_id: reviewerProfileId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", suggestionId)

  if (error) {
    console.error("Failed to save suggestion review", error)
    throw new Error("Failed to save suggestion review")
  }

  revalidatePath("/admin/suggestions")
}

export async function approveSuggestionAction(input: FormData | { suggestionId: string }) {
  const suggestionId = parseSuggestionId(input)

  const { admin, profileId: reviewerProfileId } = await requireSuggestionReviewerAccess()
  const { data: existing, error: existingError } = await admin
    .from("suggestions")
    .select("title_id,suggested_genres,suggested_selected_work_ids,suggested_selected_work_snapshots,admin_reviewed_at,admin_final_genres,admin_final_selected_work_ids,admin_final_selected_work_snapshots,admin_final_cover_selection")
    .eq("id", suggestionId)
    .single()

  if (existingError || !existing) {
    console.error("Failed to load suggestion before approval", existingError)
    throw new Error("Failed to approve suggestion")
  }

  if (!existing.admin_reviewed_at) {
    throw new Error("Review the suggestion before approving it")
  }

  await finalizeSuggestionApproval({
    admin,
    suggestionId,
    reviewerProfileId,
    titleId: existing.title_id,
    suggestedGenres: existing.suggested_genres,
    adminFinalGenres: existing.admin_final_genres,
    suggestedSelectedWorkIds: existing.suggested_selected_work_ids,
    adminFinalSelectedWorkIds: existing.admin_final_selected_work_ids,
    suggestedSelectedWorkSnapshots: existing.suggested_selected_work_snapshots,
    adminFinalSelectedWorkSnapshots: existing.admin_final_selected_work_snapshots,
    adminFinalCoverSelection: existing.admin_final_cover_selection,
  })

  revalidatePath("/admin/suggestions")
  revalidatePath(`/titles/${existing.title_id}`)
}

export async function dismissSuggestionAction(input: FormData | { suggestionId: string }) {
  const suggestionId = parseSuggestionId(input)

  const { admin } = await requireSuggestionReviewerAccess()
  const { error } = await admin
    .from("suggestions")
    .delete()
    .eq("id", suggestionId)

  if (error) {
    console.error("Failed to dismiss suggestion", error)
    throw new Error("Failed to dismiss suggestion")
  }

  revalidatePath("/admin/suggestions")
}

export async function getSuggestionOpenLibraryCandidatesAction(input: {
  titleId?: string
  title: string
  author?: string
}): Promise<{
  candidates: WorkSnapshot[]
  linkedElsewhere: Record<string, LinkedTitleSummary[]>
}> {
  await requireSuggestionReviewerAccess()

  const supabase = await createServerClient()
  const titleId = String(input.titleId ?? "").trim()
  const title = String(input.title ?? "").trim()
  const author = String(input.author ?? "").trim()
  if (!title) return { candidates: [], linkedElsewhere: {} }

  const existingWorkIds = titleId
    ? await getTitleReferenceWorkIds(supabase, {
        titleId,
      })
    : []
  const existingWorkIdSet = new Set(existingWorkIds)

  const candidates = await fetchOpenLibraryWorkCandidatesByTitleAuthor({
    title,
    author,
    limit: 15,
  })

  const remainingCandidates = candidates
    .filter((candidate) => !isExactTitleAuthorMatch({
      title,
      author,
      candidateTitle: candidate.title,
      candidateAuthor: candidate.author,
    }))
    .filter((candidate) => !existingWorkIdSet.has(candidate.workId))

  const linkedElsewhere = await getLinkedTitlesByWorkId(supabase, {
    workIds: remainingCandidates.map((candidate) => candidate.workId),
    excludeTitleId: titleId || undefined,
  })

  return {
    candidates: remainingCandidates.map((candidate) => ({
      workId: candidate.workId,
      title: candidate.title,
      author: candidate.author,
      firstPublishYear: candidate.firstPublishYear,
      editionCount: candidate.editionCount,
      forSale: null,
      coverUrl: candidate.coverUrl,
      subjects: candidate.subjects,
    })),
    linkedElsewhere,
  }
}

export async function getSuggestionCoverChoicesAction(input: {
  selectedWorkIds: string[]
  selectedWorkSnapshots?: WorkSnapshot[]
}): Promise<CoverChoice[]> {
  const { admin } = await requireSuggestionReviewerAccess()

  return getCoverChoicesForSelectedWorks(admin as any, {
    workIds: normalizeWorkIdList(input.selectedWorkIds),
    workSnapshots: input.selectedWorkSnapshots ?? [],
  })
}
