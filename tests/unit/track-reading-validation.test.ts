import { describe, expect, it } from "vitest"
import { ActionValidationError, parseActionInput } from "@/lib/validation/action"
import {
  claimAndTrackGoogleBookSchema,
  confirmGoogleBookIngestSchema,
  googleVolumeIdSchema,
  parseConfirmGoogleBookIngestInput,
  trackTitleProgressSchema,
  updateDiaryEntrySchema,
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

  it("trims diary entry notes and enforces their storage bounds", () => {
    expect(
      parseActionInput(updateDiaryEntrySchema, {
        entryId: titleId,
        noteHtml: "  <p>A useful note.</p>  ",
        noteText: "  A useful note.  ",
      })
    ).toEqual({
      entryId: titleId,
      noteHtml: "<p>A useful note.</p>",
      noteText: "A useful note.",
    })

    expect(() =>
      parseActionInput(updateDiaryEntrySchema, {
        entryId: titleId,
        noteText: "x".repeat(20_001),
      })
    ).toThrow("Diary note is too long")
  })

  it("validates Google tracking input as one contract", () => {
    expect(
      parseActionInput(claimAndTrackGoogleBookSchema, {
        volumeId: "  google-volume  ",
        progress: {
          mode: "pages",
          currentPage: 50,
          totalPages: 200,
        },
      })
    ).toMatchObject({
      volumeId: "google-volume",
      progress: { mode: "pages", currentPage: 50, totalPages: 200 },
    })

    expect(() =>
      parseActionInput(claimAndTrackGoogleBookSchema, {
        volumeId: "google-volume",
        progress: {
          mode: "pages",
          currentPage: 201,
          totalPages: 200,
        },
      })
    ).toThrow("Current page cannot be greater than total pages")
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
    ).toThrow("Genre must be one of Bookworm's canonical genres")
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

  it("rejects oversized ingest arrays before visiting their elements", () => {
    const candidates = new Array(17).fill(null)
    Object.defineProperty(candidates, 0, {
      get() { throw new Error("Visited an oversized candidate") },
    })

    expect(() => parseConfirmGoogleBookIngestInput({
      volumeId: "abc123",
      selectedGenres: ["HORROR"],
      workCandidates: candidates,
    })).toThrow("Too many Open Library work candidates")

    expect(() => parseConfirmGoogleBookIngestInput({
      volumeId: "abc123",
      selectedGenres: ["HORROR"],
      selectedWorkIds: new Array(17).fill("OL1W"),
    })).toThrow("Too many selected Open Library works")
  })

  it("throws a validation error for blank Google volume IDs", () => {
    expect(() => parseActionInput(googleVolumeIdSchema, "  ")).toThrow(ActionValidationError)
    expect(() => parseActionInput(googleVolumeIdSchema, "  ")).toThrow("Google volume ID is required")
  })
})
