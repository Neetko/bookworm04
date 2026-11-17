import { z } from "zod"

export const NOTIFICATION_COUNTS_CHANGED_EVENT = "bookworm:notification-counts-changed"

const notificationReadCommandSchema = z.union([
  z.object({ id: z.string().uuid() }).strict(),
  z.object({ markAll: z.literal(true) }).strict(),
])

export type NotificationReadCommand =
  | { kind: "one"; id: string }
  | { kind: "all" }

export interface NotificationCursor {
  createdAt: string
  id: string
}

const notificationCursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
})

export function parseNotificationReadCommand(value: unknown): NotificationReadCommand | null {
  const parsed = notificationReadCommandSchema.safeParse(value)
  if (!parsed.success) return null

  if ("id" in parsed.data) {
    return { kind: "one", id: parsed.data.id }
  }

  return { kind: "all" }
}

export function parseNotificationCursor(createdAt: string | null, id: string | null) {
  if (createdAt === null && id === null) {
    return { cursor: null as NotificationCursor | null }
  }

  const parsed = notificationCursorSchema.safeParse({ createdAt, id })
  if (!parsed.success) return null

  return { cursor: parsed.data }
}

export function notifyUnreadCountsChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(NOTIFICATION_COUNTS_CHANGED_EVENT))
}
