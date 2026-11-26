import { afterEach, describe, expect, it } from "vitest"
import { getOwnedAvatarObjectPath } from "../../apps/start/src/server/avatar-storage.server"

const originalUrl = process.env.SUPABASE_URL

afterEach(() => {
  if (originalUrl === undefined) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = originalUrl
})

describe("TanStack avatar storage ownership", () => {
  it("accepts only a versioned image object under the owner's prefix", () => {
    process.env.SUPABASE_URL = "https://project.supabase.co"
    const userId = "11111111-1111-4111-8111-111111111111"
    const fileId = "22222222-2222-4222-8222-222222222222"
    const url = `https://project.supabase.co/storage/v1/object/public/user-avatars/${userId}/${fileId}.webp`
    expect(getOwnedAvatarObjectPath(url, "user-avatars", userId)).toBe(`${userId}/${fileId}.webp`)
  })

  it("rejects foreign hosts, owners, and non-image object names", () => {
    process.env.SUPABASE_URL = "https://project.supabase.co"
    const userId = "11111111-1111-4111-8111-111111111111"
    const fileId = "22222222-2222-4222-8222-222222222222"
    const base = `/storage/v1/object/public/user-avatars/${userId}/`
    expect(getOwnedAvatarObjectPath(`https://evil.test${base}${fileId}.png`, "user-avatars", userId)).toBeNull()
    expect(getOwnedAvatarObjectPath(`https://project.supabase.co${base}${fileId}.png`, "user-avatars", "33333333-3333-4333-8333-333333333333")).toBeNull()
    expect(getOwnedAvatarObjectPath(`https://project.supabase.co${base}notes.txt`, "user-avatars", userId)).toBeNull()
  })
})
