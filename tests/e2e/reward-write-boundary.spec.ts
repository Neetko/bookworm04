import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { createAdminTestClient, createAnonymousTestClient } from "./helpers/supabase"

const admin = createAdminTestClient()

test("browser sessions cannot forge points or experience", async () => {
  const email = `reward-boundary-${randomUUID()}@bookworm.test`
  const password = "RewardBoundary!2026"
  const pointsId = randomUUID()
  const sourceId = randomUUID()
  const forgedPointsId = randomUUID()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  expect(createError).toBeNull()
  expect(created.user).not.toBeNull()
  if (!created.user) return

  const client = createAnonymousTestClient()

  try {
    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", created.user.id)
      .single()
    expect(profileError).toBeNull()
    expect(profile?.id).toBeTruthy()
    if (!profile?.id) return

    const { error: pointsSetupError } = await admin.from("user_genre_points").insert({
      id: pointsId,
      user_profile_id: profile.id,
      genre: "FICTION",
      points: 2,
      source_type: "review",
      source_id: sourceId,
      reason: "review",
    })
    expect(pointsSetupError).toBeNull()

    const { error: experienceSetupError } = await admin.from("user_experience").upsert({
      user_profile_id: profile.id,
      total_experience: 10,
      level: 1,
    })
    expect(experienceSetupError).toBeNull()

    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    expect(signInError).toBeNull()

    const { data: ownPoints, error: ownPointsError } = await client
      .from("user_genre_points")
      .select("id,points")
      .eq("id", pointsId)
      .single()
    expect(ownPointsError).toBeNull()
    expect(ownPoints?.points).toBe(2)

    const { error: forgeInsertError } = await client.from("user_genre_points").insert({
      id: forgedPointsId,
      user_profile_id: profile.id,
      genre: "FICTION",
      points: 1_000_000,
      source_type: "review",
      source_id: randomUUID(),
      reason: "review",
    })
    expect(forgeInsertError).not.toBeNull()

    const { error: forgeUpdateError } = await client
      .from("user_genre_points")
      .update({ points: 1_000_000 })
      .eq("id", pointsId)
    expect(forgeUpdateError).not.toBeNull()

    const { error: forgeDeleteError } = await client
      .from("user_genre_points")
      .delete()
      .eq("id", pointsId)
    expect(forgeDeleteError).not.toBeNull()

    const { error: experienceUpdateError } = await client
      .from("user_experience")
      .update({ level: 100, total_experience: 1_000_000 })
      .eq("user_profile_id", profile.id)
    expect(experienceUpdateError).not.toBeNull()

    const { error: experienceDeleteError } = await client
      .from("user_experience")
      .delete()
      .eq("user_profile_id", profile.id)
    expect(experienceDeleteError).not.toBeNull()

    const { data: pointsAfter, error: pointsAfterError } = await admin
      .from("user_genre_points")
      .select("points")
      .eq("id", pointsId)
      .single()
    expect(pointsAfterError).toBeNull()
    expect(pointsAfter?.points).toBe(2)

    const { data: experienceAfter, error: experienceAfterError } = await admin
      .from("user_experience")
      .select("level,total_experience")
      .eq("user_profile_id", profile.id)
      .single()
    expect(experienceAfterError).toBeNull()
    expect(experienceAfter).toEqual({ level: 1, total_experience: 10 })
  } finally {
    await client.auth.signOut()
    await admin.auth.admin.deleteUser(created.user.id)
  }
})
