import { expect, test } from "@playwright/test"
import { createAdminTestClient } from "./helpers/supabase"

test("replaying a follow from a stale page sends one notification", async ({ page }) => {
  test.setTimeout(90_000)
  const admin = createAdminTestClient()
  const password = "FollowIdempotency!2026"
  const suffix = Date.now()
  const users: string[] = []
  let actorProfileId: string | null = null
  let targetProfileId: string | null = null

  try {
    const actorEmail = `follow-actor-${suffix}@bookworm.test`
    const targetEmail = `follow-target-${suffix}@bookworm.test`

    for (const email of [actorEmail, targetEmail]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (error || !data.user) throw error ?? new Error("Could not create follow test user")
      users.push(data.user.id)

      const { data: profile, error: profileError } = await admin.from("user_profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("auth_user_id", data.user.id)
        .select("id")
        .single()
      if (profileError || !profile?.id) throw profileError ?? new Error("Could not load follow test profile")

      if (email === actorEmail) actorProfileId = profile.id
      else targetProfileId = profile.id
    }

    expect(actorProfileId).toBeTruthy()
    expect(targetProfileId).toBeTruthy()

    await page.goto("/")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.getByLabel("Email address").fill(actorEmail)
    await page.getByLabel("Your Password").fill(password)
    await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    const stalePage = await page.context().newPage()
    const targetUrl = `/users/${targetProfileId}`
    await Promise.all([page.goto(targetUrl), stalePage.goto(targetUrl)])
    await expect(page.getByRole("button", { name: "Follow", exact: true })).toBeVisible()
    await expect(stalePage.getByRole("button", { name: "Follow", exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Follow", exact: true }).click()
    await expect(page.getByRole("button", { name: "Following", exact: true })).toBeVisible()

    // This page still has the old state and repeats the same server action.
    await stalePage.getByRole("button", { name: "Follow", exact: true }).click()
    await expect(stalePage.getByRole("button", { name: "Following", exact: true })).toBeVisible()

    const { count, error: notificationError } = await admin.from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", targetProfileId)
      .eq("actor_profile_id", actorProfileId)
      .eq("event_type", "followed")
    expect(notificationError).toBeNull()
    expect(count).toBe(1)
  } finally {
    if (actorProfileId && targetProfileId) {
      await admin.from("notifications")
        .delete()
        .eq("recipient_profile_id", targetProfileId)
        .eq("actor_profile_id", actorProfileId)
    }
    for (const userId of users) await admin.auth.admin.deleteUser(userId)
  }
})
