import "server-only"

import { randomUUID } from "crypto"
import type { GoogleIngestPreviewRecord } from "@/lib/google-ingest-utils"
import type { SupabaseServerClient } from "@/lib/supabase-server"

const GOOGLE_INGEST_PREVIEW_TTL_MS = 15 * 60 * 1000
const PREVIEW_SELECT = "id,profile_id,volume_id,payload,created_at,expires_at,used_at"

type GoogleIngestPreviewPayload = Omit<GoogleIngestPreviewRecord, "token" | "createdAt">

export async function storeGoogleIngestPreview(
  supabase: SupabaseServerClient,
  input: GoogleIngestPreviewPayload & { profileId: string; volumeId: string }
) {
  const token = randomUUID()
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + GOOGLE_INGEST_PREVIEW_TTL_MS)

  const { error } = await supabase.from("google_ingest_previews").insert({
    id: token,
    profile_id: input.profileId,
    volume_id: input.volumeId,
    payload: {
      suggestedGenres: input.suggestedGenres,
      workCandidates: input.workCandidates,
      localDuplicates: input.localDuplicates,
      requiresWorkConfirmation: input.requiresWorkConfirmation,
      autoDupeMatchCount: input.autoDupeMatchCount,
      bookwormSuggestedMatchCount: input.bookwormSuggestedMatchCount,
      workMatchSummary: input.workMatchSummary,
    },
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error("Failed to store Google ingest preview", error)
    throw new Error("Failed to store ingest preview")
  }

  return token
}

export async function readGoogleIngestPreview(
  supabase: SupabaseServerClient,
  input: {
    token: string | null | undefined
    profileId: string
    volumeId: string
  }
) {
  if (!input.token) return null

  const { data, error } = await supabase
    .from("google_ingest_previews")
    .select(PREVIEW_SELECT)
    .eq("id", input.token)
    .eq("profile_id", input.profileId)
    .eq("volume_id", input.volumeId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error) {
    console.error("Failed to read Google ingest preview", error)
    return null
  }

  if (!data || !data.payload || typeof data.payload !== "object" || Array.isArray(data.payload)) {
    return null
  }

  return {
    ...(data.payload as GoogleIngestPreviewPayload),
    token: data.id,
    profileId: data.profile_id,
    volumeId: data.volume_id,
    createdAt: Date.parse(data.created_at),
  } satisfies GoogleIngestPreviewRecord
}

export async function consumeGoogleIngestPreview(
  supabase: SupabaseServerClient,
  input: { token: string | null | undefined; profileId: string }
) {
  if (!input.token) return

  const { error } = await supabase
    .from("google_ingest_previews")
    .update({ used_at: new Date().toISOString() })
    .eq("id", input.token)
    .eq("profile_id", input.profileId)
    .is("used_at", null)

  if (error) {
    console.warn("Failed to consume Google ingest preview", error)
  }
}
