import { describe, expect, it } from "vitest"
import { getTitleEngagementCapabilities, getTitleSearchCapabilities } from "@/lib/title-capabilities"

describe("title capabilities", () => {
  it("allows guests to browse local titles but not external search or ingest", () => {
    expect(getTitleSearchCapabilities({ isSignedIn: false })).toEqual({
      canSearchLocalTitles: true,
      canSearchExternalSources: false,
      canIngestExternalTitles: false,
    })
  })

  it("allows signed-in users to search external sources and ingest external titles", () => {
    expect(getTitleSearchCapabilities({ isSignedIn: true })).toEqual({
      canSearchLocalTitles: true,
      canSearchExternalSources: true,
      canIngestExternalTitles: true,
    })
  })

  it("keeps review viewing public while gating write actions", () => {
    expect(getTitleEngagementCapabilities({ isSignedIn: false, hasReadTitle: false })).toMatchObject({
      canViewReviews: true,
      canTrackReading: false,
      canWriteReview: false,
      canViewDiscussion: true,
    })
  })

  it("requires both sign-in and read status before review and discussion writes", () => {
    expect(getTitleEngagementCapabilities({ isSignedIn: true, hasReadTitle: false })).toMatchObject({
      canWriteReview: false,
      canViewDiscussion: true,
      canWriteDiscussionPost: false,
    })

    expect(getTitleEngagementCapabilities({ isSignedIn: true, hasReadTitle: true })).toMatchObject({
      canWriteReview: true,
      canViewDiscussion: true,
      canWriteDiscussionPost: true,
    })
  })
})
