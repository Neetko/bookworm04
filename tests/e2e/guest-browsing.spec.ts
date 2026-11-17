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

test("a guest can move from the catalog into a title discussion", async ({ page }) => {
  await page.goto("/search-titles")

  const frankensteinCard = page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: DEMO_TITLES.frankenstein.title }) })
  await frankensteinCard.click()
  await expect(page).toHaveURL(new RegExp(`/titles/${DEMO_TITLES.frankenstein.id}$`))
  await expect(page.getByRole("heading", { name: DEMO_TITLES.frankenstein.title })).toBeVisible()

  await page.getByRole("tab", { name: "Discussion" }).click()
  await expect(page.getByText("Read-only discussion")).toBeVisible()
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

test("the primary guest journey remains usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Keep your reading life in one place." })).toBeVisible()
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await expect(page.getByRole("menuitem", { name: "Search Titles" })).toBeVisible()
  await page.getByRole("menuitem", { name: "Search Titles" }).click()

  await expect(page).toHaveURL(/\/search-titles$/)
  await expect(page.getByRole("heading", { name: "Search Titles" })).toBeVisible()
  await expect(
    page
      .getByRole("button")
      .filter({ has: page.getByRole("heading", { name: DEMO_TITLES.frankenstein.title }) })
  ).toBeVisible()
})

test("the shell offers keyboard users a working content shortcut", async ({ page }) => {
  await page.goto("/")

  const skipLink = page.getByRole("link", { name: "Skip to main content" })
  await skipLink.focus()
  await expect(skipLink).toBeFocused()
  await skipLink.click()
  await expect(page.locator("#main-content")).toBeFocused()
})

test("unknown routes offer useful recovery links", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist")

  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { name: "This page is not on the shelf" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Search titles" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible()
})
