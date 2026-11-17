import { expect, test } from "@playwright/test"
import { DEMO_TITLES } from "./fixtures/demo"
import { signInAsDemoReader } from "./helpers/auth"

test("a reader can save partial progress and see it in the diary", async ({ page }) => {
  await signInAsDemoReader(page)
  await page.goto(`/titles/${DEMO_TITLES.frankenstein.id}`)

  await page.getByRole("button", { name: "Track", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: `Track progress: ${DEMO_TITLES.frankenstein.title}` })

  await dialog.getByRole("spinbutton", { name: "Current page" }).fill("42")
  await dialog.getByRole("spinbutton", { name: "Total pages" }).fill("300")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByText("Progress saved")).toBeVisible()
  await page.goto("/diary")

  await expect(page.getByRole("heading", { name: "Reading Diary" })).toBeVisible()
  await expect(page.getByRole("heading", { name: DEMO_TITLES.frankenstein.title })).toBeVisible()
  await expect(page.getByText("42 / 300 pages")).toBeVisible()
  await expect(page.getByText("14%")).toBeVisible()
})
