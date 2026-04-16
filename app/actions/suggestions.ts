"use server"

import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { fetchOpenLibraryWorkCandidatesByTitleAuthor, fetchOpenLibraryWorkEditionsByWorkId } from "@/lib/open-library"
import { getCoverChoicesForSelectedWorks } from "@/lib/cover-cache"
import { getLinkedTitlesByWorkId, getTitleReferenceWorkIds, type LinkedTitleSummary, upsertReferenceIsbns, upsertTitleReferenceWorks } from "@/lib/reference-data"
import { buildSuggestionReviewUpdate, isExactTitleAuthorMatch, normalizeCoverChoice, normalizeWorkIdList, type CoverChoice, type WorkSnapshot } from "@/lib/suggestions"
import { type Genre } from "@/lib/types"
import { revalidatePath } from "next/cache"

async function requireAdminAccess() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("Unauthorized")

  const admin = createAdminClient()
  const { data: roleRow, error: roleError } = await admin
    .from("user_profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (roleError) {
    console.error("Failed to verify admin access", roleError)
    throw new Error("Failed to verify admin access")
  }

  if ((roleRow?.role ?? "").toLowerCase() !== "admin") {
    throw new Error("Admin access required")
  }

  if (!roleRow?.id) {
    throw new Error("Admin profile not found")
  }

  return {
    admin,
    user,
    profileId: roleRow.id as string,
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

  const { admin, profileId: reviewerProfileId } = await requireAdminAccess()
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

  const { admin } = await requireAdminAccess()
  const { data: existing, error: existingError } = await admin
    .from("suggestions")
    .select("title_id,admin_reviewed_at,admin_final_selected_work_ids,suggested_selected_work_ids,admin_final_cover_selection")
    .eq("id", suggestionId)
    .single()

  if (existingError || !existing) {
    console.error("Failed to load suggestion before approval", existingError)
    throw new Error("Failed to approve suggestion")
  }

  if (!existing.admin_reviewed_at) {
    throw new Error("Review the suggestion before approving it")
  }

  const approvedWorkIds = Array.from(new Set([
    ...normalizeWorkIdList(existing.admin_final_selected_work_ids),
    ...normalizeWorkIdList(existing.suggested_selected_work_ids),
  ]))
  const adminFinalCoverSelection = normalizeCoverChoice(existing.admin_final_cover_selection)

  const { data, error } = await admin
    .from("suggestions")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", suggestionId)
    .select("title_id")
    .single()

  if (error) {
    console.error("Failed to approve suggestion", error)
    throw new Error("Failed to approve suggestion")
  }

  if (data?.title_id && approvedWorkIds.length > 0) {
    await upsertTitleReferenceWorks(admin, {
      titleId: data.title_id,
      workIds: approvedWorkIds,
      source: "suggestion-approval",
    })

    for (const workId of approvedWorkIds) {
      const workEditions = await fetchOpenLibraryWorkEditionsByWorkId(workId)
      await upsertReferenceIsbns(admin, {
        titleId: data.title_id,
        workId,
        isbns: workEditions?.isbns ?? [],
        source: "suggestion-approval",
      })
    }
  }

  if (data?.title_id && adminFinalCoverSelection?.imageUrl) {
    const { error: titleUpdateError } = await admin
      .from("titles")
      .update({
        cover_image_url: adminFinalCoverSelection.imageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.title_id)

    if (titleUpdateError) {
      console.error("Failed to apply approved cover image", titleUpdateError)
      throw new Error("Failed to approve suggestion")
    }
  }

  revalidatePath("/admin/suggestions")
  if (data?.title_id) {
    revalidatePath(`/titles/${data.title_id}`)
  }
}

export async function dismissSuggestionAction(input: FormData | { suggestionId: string }) {
  const suggestionId = parseSuggestionId(input)

  const { admin } = await requireAdminAccess()
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
  await requireAdminAccess()

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
  const { admin } = await requireAdminAccess()

  return getCoverChoicesForSelectedWorks(admin as any, {
    workIds: normalizeWorkIdList(input.selectedWorkIds),
    workSnapshots: input.selectedWorkSnapshots ?? [],
  })
}
