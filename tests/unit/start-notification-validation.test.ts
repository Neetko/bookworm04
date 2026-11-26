import { describe, expect, it } from "vitest"
import {
  parseInvitationResponse,
  parseNotificationCursor,
  parseNotificationReadCommand,
  sanitizeNotificationMetadata,
} from "../../apps/start/src/features/notifications/validation"

const firstId = "00000000-0000-4000-8000-000000000001"
const secondId = "00000000-0000-4000-8000-000000000002"

describe("TanStack Start notification boundaries", () => {
  it("requires a complete, valid keyset cursor", () => {
    expect(parseNotificationCursor(null, null)).toEqual({ cursor: null })
    expect(parseNotificationCursor("2026-11-26T00:00:00.000Z", firstId)).toEqual({
      cursor: { createdAt: "2026-11-26T00:00:00.000Z", id: firstId },
    })
    expect(parseNotificationCursor("2026-11-26T00:00:00.000Z", null)).toBeNull()
    expect(parseNotificationCursor("not-a-date", firstId)).toBeNull()
    expect(parseNotificationCursor("2026-11-26T00:00:00.000Z", "not-a-uuid")).toBeNull()
  })

  it("accepts only one bounded read command", () => {
    expect(parseNotificationReadCommand({ id: firstId })).toEqual({ kind: "one", id: firstId })
    expect(parseNotificationReadCommand({ markAll: true })).toEqual({ kind: "all" })
    expect(parseNotificationReadCommand({ id: firstId, markAll: true })).toBeNull()
    expect(parseNotificationReadCommand({ markAll: false })).toBeNull()
  })

  it("validates invitation transitions without accepting extra input", () => {
    expect(parseInvitationResponse({ invitationId: secondId, action: "accept" })).toEqual({
      invitationId: secondId,
      action: "accept",
    })
    expect(parseInvitationResponse({ invitationId: secondId, action: "remove" })).toBeNull()
    expect(parseInvitationResponse({ invitationId: secondId, action: "decline", clubId: firstId })).toBeNull()
  })

  it("returns only the metadata fields the notification UI uses", () => {
    expect(sanitizeNotificationMetadata({
      actor: { id: firstId, username: "Reader", avatarUrl: "https://example.invalid/avatar" },
      club: { id: secondId, name: "Classics", privateNote: "do not return" },
      unexpected: "drop me",
    })).toEqual({
      actor: { id: firstId, username: "Reader" },
      club: { id: secondId, name: "Classics" },
    })
    expect(sanitizeNotificationMetadata({ membership: { reason: "x".repeat(1_001) } })).toBeNull()
  })
})
