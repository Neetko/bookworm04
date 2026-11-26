import { z } from "zod"

export const MAX_PROFILE_BIO_LENGTH = 2_000

const profileUpdateSchema = z.object({
  username: z.string().max(100),
  bio: z.string().max(MAX_PROFILE_BIO_LENGTH),
}).strict()

const activityMetadataSchema = z.object({
  actor: z.object({ username: z.string().max(100).nullable().optional() }).optional(),
  title: z.object({ title: z.string().max(300).nullable().optional() }).optional(),
  list: z.object({ name: z.string().max(200).nullable().optional() }).optional(),
  club: z.object({ name: z.string().max(200).nullable().optional() }).optional(),
  achievement: z.object({ name: z.string().max(200).nullable().optional() }).optional(),
  rating: z.number().min(0).max(10).nullable().optional(),
})

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>
export type ActivityMetadata = z.infer<typeof activityMetadataSchema>

export function parseProfileUpdate(value: unknown): ProfileUpdate | null {
  const parsed = profileUpdateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function sanitizeActivityMetadata(value: unknown): ActivityMetadata | null {
  const parsed = activityMetadataSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
