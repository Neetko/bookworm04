import { describe, expect, it } from "vitest"
import { submitReview } from "@/app/actions/reviews"
import { saveOnboardingSelections } from "@/app/actions/onboarding"
import {
  claimAndTrackGoogleBook,
  trackTitleProgress,
  updateDiaryEntry,
} from "@/app/actions/track-reading"
import { ActionValidationError } from "@/lib/validation/action"

const titleId = "11111111-1111-4111-8111-111111111111"

describe("server action validation boundaries", () => {
  it("rejects invalid title progress before authentication or database work", async () => {
    await expect(
      trackTitleProgress({
        titleId,
        progress: { mode: "pages", currentPage: 301, totalPages: 300 },
      })
    ).rejects.toBeInstanceOf(ActionValidationError)
  })

  it("rejects invalid diary updates before authentication or database work", async () => {
    await expect(
      updateDiaryEntry({ entryId: "not-an-entry-id", noteText: "Note" })
    ).rejects.toBeInstanceOf(ActionValidationError)
  })

  it("rejects invalid Google tracking before authentication or ingestion", async () => {
    await expect(
      claimAndTrackGoogleBook(" ", {
        mode: "audiobook",
        minutesListened: 30,
        totalMinutes: 20,
      })
    ).rejects.toBeInstanceOf(ActionValidationError)
  })

  it("rejects an invalid review before authentication or database work", async () => {
    await expect(submitReview(titleId, 11, "Review")).rejects.toBeInstanceOf(ActionValidationError)
  })

  it("rejects onboarding completion without a favorite genre before authentication or database work", async () => {
    await expect(
      saveOnboardingSelections({
        favoriteGenres: [],
        finishedTitleIds: [],
        currentTitleIds: [],
        plannedTitleIds: [],
        followProfileIds: [],
      })
    ).resolves.toEqual({ error: "Select at least one genre" })
  })
})
