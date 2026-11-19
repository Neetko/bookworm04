import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { createAdminTestClient, createAnonymousTestClient } from "./helpers/supabase"

test("follow writes are server-only and repeated refollows have durable limits", async () => {
  test.setTimeout(90_000)
  const admin = createAdminTestClient()
  const browserClient = createAnonymousTestClient()
  const password = "FollowQuota!2026"
  const users: string[] = []
  const profiles: string[] = []

  try {
    const actorEmail = `quota-actor-${randomUUID()}@bookworm.test`
    const targetEmail = `quota-target-${randomUUID()}@bookworm.test`
    for (const email of [actorEmail, targetEmail]) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createError || !created.user) throw createError ?? new Error("Could not create test user")
      users.push(created.user.id)

      const { data: profile, error: profileError } = await admin.from("user_profiles")
        .select("id")
        .eq("auth_user_id", created.user.id)
        .single()
      if (profileError || !profile) throw profileError ?? new Error("Could not load test profile")
      profiles.push(profile.id)
    }

    const [actorId, targetId] = profiles
    const follow = () => admin.rpc("insert_follow_with_quota", {
      p_follower_profile_id: actorId,
      p_followed_profile_id: targetId,
    })
    const remove = () => admin.from("user_follows").delete()
      .eq("follower_profile_id", actorId)
      .eq("followed_profile_id", targetId)

    const first = await follow()
    expect(first.error).toBeNull()
    expect(first.data).toEqual({ inserted: true, notify: true })

    const replay = await follow()
    expect(replay.error).toBeNull()
    expect(replay.data).toEqual({ inserted: false, notify: false })

    expect((await remove()).error).toBeNull()
    const refollow = await follow()
    expect(refollow.error).toBeNull()
    expect(refollow.data).toEqual({ inserted: true, notify: false })

    // The first and second successful transitions used two of fifteen hourly slots.
    for (let i = 2; i < 15; i++) {
      expect((await remove()).error).toBeNull()
      const attempt = await follow()
      expect(attempt.error).toBeNull()
      expect(attempt.data).toEqual({ inserted: true, notify: false })
    }

    expect((await remove()).error).toBeNull()
    const blocked = await follow()
    expect(blocked.error?.message).toContain("follow_quota_exceeded")
    const { count } = await admin.from("user_follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_profile_id", actorId)
      .eq("followed_profile_id", targetId)
    expect(count).toBe(0)

    const { error: loginError } = await browserClient.auth.signInWithPassword({
      email: actorEmail,
      password,
    })
    expect(loginError).toBeNull()

    const directInsert = await browserClient.from("user_follows").insert({
      follower_profile_id: actorId,
      followed_profile_id: targetId,
      is_private: true,
      is_friend: false,
    })
    expect(directInsert.error).not.toBeNull()

    const directRpc = await browserClient.rpc("insert_follow_with_quota", {
      p_follower_profile_id: actorId,
      p_followed_profile_id: targetId,
    })
    expect(directRpc.error).not.toBeNull()
  } finally {
    for (const userId of users) {
      await admin.auth.admin.deleteUser(userId)
    }
  }
})
