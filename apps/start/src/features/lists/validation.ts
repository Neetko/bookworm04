import { z } from "zod"

export const MAX_CUSTOM_LISTS = 10
export const MAX_TITLES_PER_LIST = 500

const listName = z.string().trim().min(1).max(100)
const uuid = z.string().uuid()

const listMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: listName, isPublic: z.boolean() }).strict(),
  z.object({ action: z.literal("update"), listId: uuid, name: listName, isPublic: z.boolean() }).strict(),
  z.object({ action: z.literal("add"), listId: uuid, titleId: uuid }).strict(),
  z.object({ action: z.literal("remove"), listId: uuid, titleId: uuid }).strict(),
])

export type ListMutation = z.infer<typeof listMutationSchema>

export function parseListMutation(value: unknown): ListMutation | null {
  const parsed = listMutationSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
