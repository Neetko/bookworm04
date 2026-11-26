import { GENRES, type Genre } from "../titles/catalog"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function categories(value: unknown): Genre[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is Genre =>
    typeof item === "string" && (GENRES as readonly string[]).includes(item)
  ))]
}

export function parseClubCreate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const type = input.type === "writer" ? "writer" : input.type === "book" ? "book" : null
  const name = text(input.name, 200)
  if (!type || !name) return null
  return { type, name, description: text(input.description, 5_000), categories: categories(input.categories) }
}

export type ClubMutation =
  | { action: "update"; name: string; description: string; categories: Genre[]; joinPolicy: "open" | "approval_required" | "invite_only" }
  | { action: "add-reading"; titleId: string }
  | { action: "remove-reading"; itemId: string }
  | { action: "set-current"; titleId: string | null }
  | { action: "join" | "apply" | "withdraw" | "leave" }
  | { action: "invite"; username: string }
  | { action: "revoke-invitation"; invitationId: string }
  | { action: "review-application"; applicationId: string; approve: boolean }
  | { action: "remove-member"; profileId: string }

export function parseClubMutation(value: unknown): ClubMutation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (input.action === "update") {
    const name = text(input.name, 200)
    const joinPolicy = input.joinPolicy === "open" || input.joinPolicy === "approval_required" || input.joinPolicy === "invite_only"
      ? input.joinPolicy
      : null
    if (!name || !joinPolicy) return null
    return { action: "update", name, description: text(input.description, 5_000), categories: categories(input.categories), joinPolicy }
  }
  if (input.action === "add-reading" && isUuid(input.titleId)) return { action: input.action, titleId: input.titleId }
  if (input.action === "remove-reading" && isUuid(input.itemId)) return { action: input.action, itemId: input.itemId }
  if (input.action === "set-current" && (input.titleId === null || isUuid(input.titleId))) return { action: input.action, titleId: input.titleId }
  if (["join", "apply", "withdraw", "leave"].includes(String(input.action))) return { action: input.action } as ClubMutation
  if (input.action === "invite") {
    const username = text(input.username, 100)
    return username ? { action: input.action, username } : null
  }
  if (input.action === "revoke-invitation" && isUuid(input.invitationId)) return { action: input.action, invitationId: input.invitationId }
  if (input.action === "review-application" && isUuid(input.applicationId) && typeof input.approve === "boolean") return { action: input.action, applicationId: input.applicationId, approve: input.approve }
  if (input.action === "remove-member" && isUuid(input.profileId)) return { action: input.action, profileId: input.profileId }
  return null
}
