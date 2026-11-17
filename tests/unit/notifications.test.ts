import { describe, expect, it } from "vitest"
import { parseNotificationCursor, parseNotificationReadCommand } from "@/lib/notifications"

describe("notification request parsing", () => {
  it("accepts one explicit notification id or an explicit mark-all command", () => {
    expect(parseNotificationReadCommand({ id: "10000000-0000-4000-8000-000000000001" })).toEqual({
      kind: "one",
      id: "10000000-0000-4000-8000-000000000001",
    })
    expect(parseNotificationReadCommand({ markAll: true })).toEqual({ kind: "all" })
  })

  it("rejects ambiguous, malformed, and implicit mark-all requests", () => {
    expect(parseNotificationReadCommand({})).toBeNull()
    expect(parseNotificationReadCommand({ markAll: false })).toBeNull()
    expect(parseNotificationReadCommand({ id: "not-a-uuid" })).toBeNull()
    expect(
      parseNotificationReadCommand({
        id: "10000000-0000-4000-8000-000000000001",
        markAll: true,
      })
    ).toBeNull()
  })

  it("accepts a complete stable pagination cursor or no cursor", () => {
    expect(parseNotificationCursor(null, null)).toEqual({ cursor: null })
    expect(
      parseNotificationCursor(
        "2026-11-17T10:00:00.000Z",
        "10000000-0000-4000-8000-000000000001"
      )
    ).toEqual({
      cursor: {
        createdAt: "2026-11-17T10:00:00.000Z",
        id: "10000000-0000-4000-8000-000000000001",
      },
    })
  })

  it("rejects incomplete and malformed pagination cursors", () => {
    expect(parseNotificationCursor("2026-11-17T10:00:00.000Z", null)).toBeNull()
    expect(parseNotificationCursor(null, "10000000-0000-4000-8000-000000000001")).toBeNull()
    expect(parseNotificationCursor("not-a-date", "not-a-uuid")).toBeNull()
  })
})
