import { expect, test } from "@playwright/test"
import { DEMO_TITLES } from "./fixtures/demo"

test("guests can browse local search titles without external ingest controls @prod-smoke", async ({ page }) => {
  await page.goto("/search-titles")

  await expect(page.getByRole("heading", { name: "Search Titles" })).toBeVisible()
  await expect(
    page.getByText("Guests can browse local Bookworm titles. Sign in to search external sources or ingest new titles.")
  ).toBeVisible()
  await expect(page.getByRole("switch", { name: "Include external results" })).toBeDisabled()
})

test("selecting multiple genres narrows local titles to an all-tag match", async ({ page }) => {
  await page.goto("/search-titles?genres=HORROR%2CSCI-FI")

  await expect(page.getByRole("heading", { name: "Frankenstein" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Dracula" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "The War of the Worlds" })).toHaveCount(0)
})

test("guests can browse title discussions but cannot post", async ({ page }) => {
  await page.goto(`/titles/${DEMO_TITLES.frankenstein.id}`)

  await expect(page.getByRole("link", { name: "Sign in to mark as read" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in to bookmark" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in to track" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in to suggest" })).toBeVisible()
  await page.getByRole("tab", { name: "Discussion" }).click()

  await expect(page.getByText("Read-only discussion")).toBeVisible()
  await expect(page.getByText(/The creature’s account changes the moral center/)).toBeVisible()
  await expect(page.getByText("Share Your Thoughts")).toHaveCount(0)
  await expect(page.getByTitle("Sign in to like posts")).toBeDisabled()
})

test("guests can read reviews but cannot like them", async ({ page }) => {
  await page.goto(`/titles/${DEMO_TITLES.prideAndPrejudice.id}`)

  await expect(page.getByText(/Sharp, funny, and much warmer/)).toBeVisible()
  await expect(page.getByTitle("Sign in to like reviews")).toBeDisabled()
})

test("protected APIs reject anonymous requests", async ({ request }) => {
  for (const path of ["/api/messages", "/api/notifications", "/api/notifications/counts"]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(401)
  }
})
