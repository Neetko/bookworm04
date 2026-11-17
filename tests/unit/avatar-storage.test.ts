import { describe, expect, it } from "vitest"
import { getOwnedAvatarObjectPath } from "@/lib/avatar-storage"
import { getSupabasePublicEnv } from "@/lib/supabase-config"

const userId = "11111111-1111-4111-8111-111111111111"
const fileId = "22222222-2222-4222-8222-222222222222"
const base = getSupabasePublicEnv().url

describe("avatar cleanup path validation", () => {
  it("accepts an owned generated object", () => {
    const url = `${base}/storage/v1/object/public/user-avatars/${userId}/${fileId}.png`
    expect(getOwnedAvatarObjectPath(url, "user-avatars", userId)).toBe(`${userId}/${fileId}.png`)
  })

  it("rejects external, other-user, and non-generated objects", () => {
    const own = `${base}/storage/v1/object/public/user-avatars/${userId}/${fileId}.png`
    expect(getOwnedAvatarObjectPath(own.replace(base, "https://evil.test"), "user-avatars", userId)).toBeNull()
    expect(getOwnedAvatarObjectPath(own, "user-avatars", "33333333-3333-4333-8333-333333333333")).toBeNull()
    expect(getOwnedAvatarObjectPath(`${base}/storage/v1/object/public/user-avatars/${userId}/notes.txt`, "user-avatars", userId)).toBeNull()
  })
})
