import { describe, expect, it } from "vitest"
import { readBoundedJson } from "../../apps/start/src/server/bounded-json.server"
import {
  isPlaceholderUsername,
  normalizeFavoriteGenres,
  normalizeUsername,
  sanitizeUsername,
  usernameError,
} from "../../apps/start/src/features/onboarding/validation"

describe("TanStack Start onboarding boundaries", () => {
  it("normalizes usernames and rejects missing, oversized, or control-character values", () => {
    expect(sanitizeUsername("  Reader  ")).toBe("Reader")
    expect(normalizeUsername("  ReAdEr  ")).toBe("reader")
    expect(usernameError(" ")).toBe("Username is required")
    expect(usernameError("x".repeat(101))).toMatch(/100 characters/)
    expect(usernameError("Reader\nAdmin")).toMatch(/control characters/)
    expect(isPlaceholderUsername("Bookworm1234")).toBe(true)
    expect(isPlaceholderUsername("Reader")).toBe(false)
  })

  it("accepts only canonical, bounded favorite genres", () => {
    expect(normalizeFavoriteGenres(["FANTASY", "FANTASY", "MYSTERY", "unknown"]))
      .toEqual(["FANTASY", "MYSTERY"])
    expect(normalizeFavoriteGenres(Array.from({ length: 8 }, () => "FANTASY"))).toEqual([])
    expect(normalizeFavoriteGenres("FANTASY")).toEqual([])
  })

  it("bounds JSON streams before parsing and rejects unsupported content types", async () => {
    const oversized = new Request("https://bookworm.example/api/onboarding/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "x".repeat(100) }),
    })
    expect(await readBoundedJson(oversized, 32)).toMatchObject({ ok: false, status: 413 })

    const wrongType = new Request("https://bookworm.example/api/onboarding/complete", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    })
    expect(await readBoundedJson(wrongType, 32)).toMatchObject({ ok: false, status: 415 })
  })
})
