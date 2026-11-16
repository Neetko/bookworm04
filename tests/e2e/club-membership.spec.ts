import { expect, test } from "@playwright/test"
import { DEMO_READER } from "./fixtures/demo"
import { signInAsDemoReader } from "./helpers/auth"
import { createAdminTestClient } from "./helpers/supabase"

const OPEN_CLUB = {
  id: "43000000-0000-4000-8000-000000000001",
  name: "Gothic After Dark",
} as const

async function restoreDemoReaderMembership() {
  const admin = createAdminTestClient()

  const { error: membershipError } = await admin
    .from("club_members")
    .delete()
    .eq("club_id", OPEN_CLUB.id)
    .eq("user_id", DEMO_READER.profileId)

  if (membershipError) throw membershipError

  const { error: activityError } = await admin
    .from("activity_events")
    .delete()
    .eq("user_profile_id", DEMO_READER.profileId)
    .eq("event_type", "club_joined")
    .contains("metadata", { club: { id: OPEN_CLUB.id } })

  if (activityError) throw activityError
}

test.beforeEach(async () => {
  await restoreDemoReaderMembership()
})

test.afterEach(async () => {
  await restoreDemoReaderMembership()
})

test("a signed-in reader can join and leave an open book club", async ({ page }) => {
  await signInAsDemoReader(page, `/community/clubs/${OPEN_CLUB.id}`)

  await expect(page.getByRole("heading", { name: OPEN_CLUB.name, level: 1 })).toBeVisible()
  await expect(page.getByText("HORROR", { exact: true })).toBeVisible()
  await expect(page.getByText("2 total", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Join", exact: true }).click()
  await expect(page.getByText("Joined club", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Leave", exact: true })).toBeVisible()
  await expect(page.getByText("3 total", { exact: true })).toBeVisible()

  const admin = createAdminTestClient()
  const { data: joinedMembership, error: joinedMembershipError } = await admin
    .from("club_members")
    .select("id")
    .eq("club_id", OPEN_CLUB.id)
    .eq("user_id", DEMO_READER.profileId)
    .maybeSingle()

  expect(joinedMembershipError).toBeNull()
  expect(joinedMembership).not.toBeNull()

  await page.getByRole("button", { name: "Leave", exact: true }).click()
  await expect(page.getByText("Left club", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Join", exact: true })).toBeVisible()
  await expect(page.getByText("2 total", { exact: true })).toBeVisible()

  const { data: departedMembership, error: departedMembershipError } = await admin
    .from("club_members")
    .select("id")
    .eq("club_id", OPEN_CLUB.id)
    .eq("user_id", DEMO_READER.profileId)
    .maybeSingle()

  expect(departedMembershipError).toBeNull()
  expect(departedMembership).toBeNull()
})
