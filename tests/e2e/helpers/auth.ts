import { expect, type Page } from "@playwright/test"
import { DEMO_READER, uniqueLocalReaderEmail } from "../fixtures/demo"

export async function signInAsDemoReader(page: Page, path = "/") {
  await page.goto(path)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByLabel("Email address").fill(DEMO_READER.email)
  await page.getByLabel("Your Password").fill(DEMO_READER.password)
  await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: new RegExp(DEMO_READER.username) })).toBeVisible()
}

export async function signUpLocalReader(page: Page, path = "/search-titles") {
  const email = uniqueLocalReaderEmail()

  await page.goto(path)
  await page.getByRole("button", { name: "Sign up", exact: true }).click()
  await page.getByLabel("Email address").fill(email)
  await page.locator('input[type="password"]').fill("LocalReader!2026")
  await page.getByRole("dialog").getByRole("button", { name: "Sign up", exact: true }).click()

  return email
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: new RegExp(DEMO_READER.username) }).click()
  await page.getByRole("menuitem", { name: "Log Out" }).click()

  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign up", exact: true })).toBeVisible()
}
