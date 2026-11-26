import { describe, expect, it } from "vitest"
import {
  MAX_CUSTOM_LISTS,
  MAX_TITLES_PER_LIST,
  parseListMutation,
} from "../../apps/start/src/features/lists/validation"

describe("TanStack Start list mutation boundaries", () => {
  it("accepts exact list mutations and normalizes names", () => {
    expect(parseListMutation({ action: "create", name: "  Favorites  ", isPublic: true })).toEqual({
      action: "create",
      name: "Favorites",
      isPublic: true,
    })
    expect(parseListMutation({
      action: "add",
      listId: "00000000-0000-4000-8000-000000000001",
      titleId: "00000000-0000-4000-8000-000000000002",
    })?.action).toBe("add")
  })

  it("rejects overlong, malformed, and privilege-shaped input", () => {
    expect(parseListMutation({ action: "create", name: "x".repeat(101), isPublic: true })).toBeNull()
    expect(parseListMutation({ action: "remove", listId: "not-a-uuid", titleId: "also-bad" })).toBeNull()
    expect(parseListMutation({ action: "create", name: "Favorites", isPublic: true, userProfileId: "victim" })).toBeNull()
    expect(MAX_CUSTOM_LISTS).toBe(10)
    expect(MAX_TITLES_PER_LIST).toBe(500)
  })
})
