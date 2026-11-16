import { expect, test } from "@playwright/test"
import { DEMO_TITLES } from "./fixtures/demo"
import { signInAsDemoReader } from "./helpers/auth"
import { ensureTitleRead, ensureTitleUnread } from "./helpers/title"

test("marking a title read persists after reload and unlocks discussion posting", async ({ page }) => {
  const titlePath = `/titles/${DEMO_TITLES.frankenstein.id}`

  await signInAsDemoReader(page)
  await page.goto(titlePath)

  try {
    await ensureTitleUnread(page)
    await page.getByRole("tab", { name: "Discussion" }).click()
    await expect(page.getByText("Read-only discussion")).toBeVisible()
    await expect(page.getByText("Share Your Thoughts")).toHaveCount(0)

    await page.getByRole("tab", { name: "Reviews" }).click()
    await page.getByRole("button", { name: "Mark as Read", exact: true }).click()
    await expect(page.getByRole("button", { name: "Read", exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByRole("button", { name: "Read", exact: true })).toBeVisible()
    await page.getByRole("tab", { name: "Discussion" }).click()
    await expect(page.getByText("Share Your Thoughts")).toBeVisible()
    await expect(page.getByText("Read-only discussion")).toHaveCount(0)
  } finally {
    await page.goto(titlePath)
    await ensureTitleRead(page)
    await page.getByRole("button", { name: "Read", exact: true }).click()
    await expect(page.getByRole("button", { name: "Mark as Read", exact: true })).toBeVisible()
  }
})
