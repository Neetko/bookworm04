import { expect, test } from "@playwright/test"

test("guests can browse local search titles without external ingest controls @prod-smoke", async ({ page }) => {
  await page.goto("/search-titles")

  await expect(page.getByRole("heading", { name: "Search Titles" })).toBeVisible()
  await expect(
    page.getByText("Guests can browse local Bookworm titles. Sign in to search external sources or ingest new titles.")
  ).toBeVisible()
  await expect(page.getByRole("switch", { name: "Include external results" })).toBeDisabled()
})
