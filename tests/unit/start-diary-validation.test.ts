import { describe, expect, it } from "vitest"
import { diaryNoteHtml, diaryNoteText } from "../../apps/start/src/features/diary/content"
import {
  MAX_DIARY_NOTE_LENGTH,
  normalizeDiarySearch,
  parseDiaryNoteWrite,
  parseDiaryProgressWrite,
} from "../../apps/start/src/features/diary/validation"

describe("TanStack Start diary boundaries", () => {
  it("accepts valid progress and rejects impossible or extra fields", () => {
    expect(parseDiaryProgressWrite({
      titleId: "00000000-0000-0000-0000-000000000000",
      progress: { mode: "pages", currentPage: 50, totalPages: 200 },
      noteText: "Halfway",
    })?.progress).toEqual({ mode: "pages", currentPage: 50, totalPages: 200 })
    expect(parseDiaryProgressWrite({
      titleId: "00000000-0000-0000-0000-000000000000",
      progress: { mode: "pages", currentPage: 201, totalPages: 200 },
    })).toBeNull()
    expect(parseDiaryProgressWrite({
      titleId: "00000000-0000-0000-0000-000000000000",
      progress: { mode: "audiobook", minutesListened: 5, totalMinutes: 10 },
      role: "admin",
    })).toBeNull()
  })

  it("bounds notes and converts legacy HTML to inert text", () => {
    expect(parseDiaryNoteWrite({
      entryId: "00000000-0000-0000-0000-000000000000",
      noteText: "x".repeat(MAX_DIARY_NOTE_LENGTH + 1),
    })).toBeNull()
    expect(diaryNoteText("", `<img src=x onerror=alert(1)><p>Hello <strong>reader</strong></p>`)).toBe("Hello reader")
    expect(diaryNoteHtml(`<img src=x onerror=alert(1)>`)).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>")
  })

  it("normalizes and bounds filter input", () => {
    expect(normalizeDiarySearch({ filterBy: "genre", genres: "HORROR,nope,HORROR", author: "ignored" })).toEqual({
      filterBy: "genre",
      genres: "HORROR",
      author: "",
      title: "",
    })
  })
})
