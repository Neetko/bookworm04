import { expect, test } from "@playwright/test"
import { signInAsDemoReader, signOut, signUpLocalReader } from "./helpers/auth"
import { createAdminTestClient } from "./helpers/supabase"

test("the seeded local reviewer can sign in to a populated feed", async ({ page }) => {
  await signInAsDemoReader(page)

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  await expect(page.getByText("Ava Quill")).toBeVisible()
  await expect(page.getByText("started reading")).toBeVisible()
})

test("a fresh local sign-up goes directly to onboarding", async ({ page }) => {
  const email = await signUpLocalReader(page)

  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByText("Welcome, new reader.")).toBeVisible()

  for (const path of ["/", "/diary", "/messages", "/profile"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/onboarding$/)
  }

  await page.getByLabel("Username").fill(`Reader${email.match(/\d+/)?.[0] ?? Date.now()}`)
  await page.getByRole("button", { name: "Continue", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Choose your favorite genres" })).toBeVisible()
  await expect(page.getByText("Step 2 of 6")).toBeVisible()
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled()

  await page.getByRole("button", { name: "HORROR", exact: true }).click()
  await page.getByRole("button", { name: "SCI-FI", exact: true }).click()
  await page.getByRole("button", { name: "Continue", exact: true }).click()

  await expect(page.getByRole("heading", { name: "What have you already finished?" })).toBeVisible()
  await expect(page.getByText("Step 3 of 6")).toBeVisible()
  const frankensteinCard = page.getByRole("button", { name: /Frankenstein/ }).first()
  await expect(frankensteinCard.getByLabel("Genres: HORROR, SCI-FI")).toBeVisible()

  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "Skip", exact: true }).click()
  }

  await expect(page.getByText("Step 6 of 6")).toBeVisible()
  await expect(page.getByRole("button", { name: "Finish without more" })).toHaveCount(0)
  await page.getByRole("button", { name: "Finish setup", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  const admin = createAdminTestClient()
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("favorite_genres,onboarding_completed_at")
    .eq("email", email)
    .single()

  expect(error).toBeNull()
  expect(profile?.favorite_genres).toEqual(["HORROR", "SCI-FI"])
  expect(profile?.onboarding_completed_at).toBeTruthy()
})

test("a reader who completed onboarding cannot return to onboarding", async ({ page }) => {
  await signInAsDemoReader(page)
  await page.goto("/onboarding")

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
})

test("guests are redirected away from protected reading routes", async ({ page }) => {
  for (const path of ["/diary", "/messages", "/notifications", "/profile", "/onboarding"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/auth$/)
  }
})

test("logging out removes access to protected reading routes", async ({ page }) => {
  await signInAsDemoReader(page)
  await signOut(page)

  await page.goto("/diary")
  await expect(page).toHaveURL(/\/auth$/)
})
