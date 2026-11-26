import { z } from "zod"

const uuid = z.string().uuid()
const timestamp = z.string().datetime({ offset: true })

const notificationCursorSchema = z.object({
  createdAt: timestamp,
  id: uuid,
}).strict()

const notificationReadCommandSchema = z.union([
  z.object({ id: uuid }).strict(),
  z.object({ markAll: z.literal(true) }).strict(),
])

const invitationResponseSchema = z.object({
  invitationId: uuid,
  action: z.enum(["accept", "decline"]),
}).strict()

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional()
const nullableId = uuid.nullable().optional()
const nullableTimestamp = timestamp.nullable().optional()

const notificationMetadataSchema = z.object({
  actor: z.object({
    id: nullableId,
    username: nullableText(100),
  }).optional(),
  title: z.object({
    id: nullableId,
    title: nullableText(300),
  }).optional(),
  role: z.object({
    name: nullableText(100),
  }).optional(),
  club: z.object({
    id: nullableId,
    name: nullableText(200),
  }).optional(),
  invitation: z.object({
    id: nullableId,
    status: nullableText(40),
    respondedAt: nullableTimestamp,
  }).optional(),
  application: z.object({
    id: nullableId,
    status: nullableText(40),
    respondedAt: nullableTimestamp,
  }).optional(),
  membership: z.object({
    reason: nullableText(1_000),
  }).optional(),
  resolution: z.object({
    action: nullableText(40),
    respondedAt: nullableTimestamp,
  }).optional(),
})

export interface NotificationCursor {
  createdAt: string
  id: string
}

export type NotificationReadCommand =
  | { kind: "one"; id: string }
  | { kind: "all" }

export type InvitationResponse = z.infer<typeof invitationResponseSchema>
export type NotificationMetadata = z.infer<typeof notificationMetadataSchema>

export function parseNotificationCursor(createdAt: string | null, id: string | null) {
  if (createdAt === null && id === null) return { cursor: null as NotificationCursor | null }
  const parsed = notificationCursorSchema.safeParse({ createdAt, id })
  return parsed.success ? { cursor: parsed.data } : null
}

export function parseNotificationReadCommand(value: unknown): NotificationReadCommand | null {
  const parsed = notificationReadCommandSchema.safeParse(value)
  if (!parsed.success) return null
  return "id" in parsed.data ? { kind: "one", id: parsed.data.id } : { kind: "all" }
}

export function parseInvitationResponse(value: unknown): InvitationResponse | null {
  const parsed = invitationResponseSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function sanitizeNotificationMetadata(value: unknown): NotificationMetadata | null {
  const parsed = notificationMetadataSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
