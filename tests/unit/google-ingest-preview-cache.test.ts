import { beforeEach, describe, expect, it } from "vitest"
import { createFakeSupabase } from "./fake-supabase"
import {
  consumeGoogleIngestPreview,
  readGoogleIngestPreview,
  storeGoogleIngestPreview,
} from "@/lib/server/google-ingest-preview-cache"

const previewInput = {
  profileId: "profile-1",
  volumeId: "volume-1",
  suggestedGenres: ["science-fiction"] as any,
  genreClassification: { suggestedGenres: ["science-fiction"] } as any,
  workCandidates: [],
  localDuplicates: [],
  requiresWorkConfirmation: false,
  autoDupeMatchCount: 0,
  bookwormSuggestedMatchCount: 0,
  workMatchSummary: {
    userReviewCandidates: [],
    autoDupeMatches: [],
    bookwormSuggestedMatches: [],
  },
}

describe("Google ingest preview persistence", () => {
  let tables: Record<string, Array<Record<string, any>>>

  beforeEach(() => {
    tables = { google_ingest_previews: [] }
  })

  it("stores and reads a preview across separate calls", async () => {
    const supabase = createFakeSupabase({ tables }) as any
    const token = await storeGoogleIngestPreview(supabase, previewInput)

    await expect(readGoogleIngestPreview(supabase, {
      token,
      profileId: "profile-1",
      volumeId: "volume-1",
    })).resolves.toMatchObject({
      token,
      profileId: "profile-1",
      volumeId: "volume-1",
      suggestedGenres: ["science-fiction"],
    })
  })

  it("does not return another user's or another volume's preview", async () => {
    const supabase = createFakeSupabase({ tables }) as any
    const token = await storeGoogleIngestPreview(supabase, previewInput)

    await expect(readGoogleIngestPreview(supabase, {
      token,
      profileId: "profile-2",
      volumeId: "volume-1",
    })).resolves.toBeNull()

    await expect(readGoogleIngestPreview(supabase, {
      token,
      profileId: "profile-1",
      volumeId: "volume-2",
    })).resolves.toBeNull()
  })

  it("does not return a consumed preview", async () => {
    const supabase = createFakeSupabase({ tables }) as any
    const token = await storeGoogleIngestPreview(supabase, previewInput)

    await consumeGoogleIngestPreview(supabase, { token, profileId: "profile-1" })

    await expect(readGoogleIngestPreview(supabase, {
      token,
      profileId: "profile-1",
      volumeId: "volume-1",
    })).resolves.toBeNull()
  })

  it("does not return an expired preview", async () => {
    const supabase = createFakeSupabase({ tables }) as any
    const token = await storeGoogleIngestPreview(supabase, previewInput)
    tables.google_ingest_previews[0].expires_at = "2000-01-01T00:00:00.000Z"

    await expect(readGoogleIngestPreview(supabase, {
      token,
      profileId: "profile-1",
      volumeId: "volume-1",
    })).resolves.toBeNull()
  })
})
