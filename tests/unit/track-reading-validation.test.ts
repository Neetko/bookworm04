import { describe, expect, it } from "vitest"
import { ActionValidationError, parseActionInput } from "@/lib/validation/action"
import {
  confirmGoogleBookIngestSchema,
  googleVolumeIdSchema,
  trackTitleProgressSchema,
} from "@/lib/validation/track-reading"

const titleId = "11111111-1111-4111-8111-111111111111"

describe("track-reading validation", () => {
  it("accepts valid page progress input", () => {
    expect(
      parseActionInput(trackTitleProgressSchema, {
        titleId,
        progress: {
          mode: "pages",
          currentPage: 42,
          totalPages: 300,
        },
        noteHtml: "  <p>Good chapter.</p>  ",
      })
    ).toMatchObject({
      titleId,
      progress: {
        mode: "pages",
        currentPage: 42,
        totalPages: 300,
      },
      noteHtml: "<p>Good chapter.</p>",
    })
  })

  it("rejects impossible page progress before the server action writes", () => {
    expect(() =>
      parseActionInput(trackTitleProgressSchema, {
        titleId,
        progress: {
          mode: "pages",
          currentPage: 301,
          totalPages: 300,
        },
      })
    ).toThrow("Current page cannot be greater than total pages")
  })

  it("rejects impossible audiobook progress before the server action writes", () => {
    expect(() =>
      parseActionInput(trackTitleProgressSchema, {
        titleId,
        progress: {
          mode: "audiobook",
          minutesListened: 800,
          totalMinutes: 600,
        },
      })
    ).toThrow("Minutes listened cannot be greater than total minutes")
  })

  it("requires at least one selected canonical genre for ingest", () => {
    expect(() =>
      parseActionInput(confirmGoogleBookIngestSchema, {
        volumeId: "abc123",
        selectedGenres: [],
      })
    ).toThrow("Select at least one genre")

    expect(() =>
      parseActionInput(confirmGoogleBookIngestSchema, {
        volumeId: "abc123",
        selectedGenres: ["COZY"],
      })
    ).toThrow("Invalid enum value")
  })

  it("normalizes duplicate selected genres and selected work IDs", () => {
    expect(
      parseActionInput(confirmGoogleBookIngestSchema, {
        volumeId: "abc123",
        selectedGenres: ["HORROR", "HORROR", "MYSTERY"],
        selectedWorkIds: ["OL1W", "OL1W", "OL2W"],
      })
    ).toMatchObject({
      selectedGenres: ["HORROR", "MYSTERY"],
      selectedWorkIds: ["OL1W", "OL2W"],
    })
  })

  it("throws a validation error for blank Google volume IDs", () => {
    expect(() => parseActionInput(googleVolumeIdSchema, "  ")).toThrow(ActionValidationError)
    expect(() => parseActionInput(googleVolumeIdSchema, "  ")).toThrow("Google volume ID is required")
  })
})
