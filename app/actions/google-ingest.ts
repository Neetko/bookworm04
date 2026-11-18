"use server"

import { createServerClient } from "@/lib/supabase-server"
import { requireAuthedProfileId } from "@/lib/server/auth"
import { canReviewSuggestions, getCurrentUserAccess } from "@/lib/server/roles"
import { hasVerifiedStaffSession } from "@/lib/server/staff-mfa"
import { ensureGoogleBookIngested } from "@/lib/server/google-title-ingest"
import {
  confirmGoogleBookIngestForProfile,
  getGoogleBookIngestSuggestionForProfile,
  type GoogleIngestSuggestion,
} from "@/lib/server/google-ingest-suggestions"
import { parseActionInput } from "@/lib/validation/action"
import {
  confirmGoogleBookIngestSchema,
  ensureGoogleBookSchema,
  googleVolumeIdSchema,
  type ConfirmGoogleBookIngestInput,
} from "@/lib/validation/track-reading"
import { revalidatePath } from "next/cache"

export async function getGoogleIngestSuggestion(volumeIdInput: string): Promise<GoogleIngestSuggestion> {
  const volumeId = parseActionInput(googleVolumeIdSchema, volumeIdInput)
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  return getGoogleBookIngestSuggestionForProfile({ supabase, profileId, volumeId })
}
export async function confirmGoogleBookIngest(input: ConfirmGoogleBookIngestInput) {
  const validatedInput = parseActionInput(confirmGoogleBookIngestSchema, input)
  const supabase = await createServerClient()
  const access = await getCurrentUserAccess()
  if (!access.user || !access.profileId) throw new Error("Unauthorized")

  const autoApproved = canReviewSuggestions(access.role) && await hasVerifiedStaffSession()
  const result = await confirmGoogleBookIngestForProfile({
    supabase,
    profileId: access.profileId,
    reviewerProfileId: access.profileId,
    autoApproved,
    ingestInput: validatedInput,
  })

  if (!autoApproved) revalidatePath("/admin/suggestions")
  revalidatePath("/search-titles")
  revalidatePath(`/titles/${result.titleId}`)
  return result
}

export async function ensureGoogleBook(volumeIdInput: string) {
  const { volumeId } = parseActionInput(ensureGoogleBookSchema, { volumeId: volumeIdInput })
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)
  const { titleId } = await ensureGoogleBookIngested(volumeId)
  revalidatePath("/search-titles")
  return { titleId }
}
