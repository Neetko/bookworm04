import { describe, expect, it } from "vitest"
import {
  MAX_PROFILE_BIO_LENGTH,
  parseProfileUpdate,
  sanitizeActivityMetadata,
} from "../../apps/start/src/features/profile/validation"

describe("TanStack Start profile boundaries", () => {
  it("accepts a bounded, exact profile update", () => {
    expect(parseProfileUpdate({ username: "Reader", bio: "A short bio" })).toEqual({
      username: "Reader",
      bio: "A short bio",
    })
    expect(parseProfileUpdate({ username: "Reader", bio: "", role: "admin" })).toBeNull()
    expect(parseProfileUpdate({ username: "x".repeat(101), bio: "" })).toBeNull()
    expect(parseProfileUpdate({ username: "Reader", bio: "x".repeat(MAX_PROFILE_BIO_LENGTH + 1) })).toBeNull()
  })

  it("returns only activity fields rendered by the profile", () => {
    expect(sanitizeActivityMetadata({
      actor: { username: "Reader", email: "private@example.test" },
      title: { title: "Dune", privateNotes: "drop me" },
      rating: 9,
      unexpected: true,
    })).toEqual({
      actor: { username: "Reader" },
      title: { title: "Dune" },
      rating: 9,
    })
    expect(sanitizeActivityMetadata({ rating: 11 })).toBeNull()
  })
})
