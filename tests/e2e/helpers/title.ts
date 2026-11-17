import { expect, type Page } from "@playwright/test"

export async function ensureTitleUnread(page: Page) {
  const readButton = page.getByRole("button", { name: "Read", exact: true })

  if (await readButton.isVisible()) {
    await readButton.click()
  }

  await expect(page.getByRole("button", { name: "Mark as Read", exact: true })).toBeVisible()
}

export async function ensureTitleRead(page: Page) {
  const markAsReadButton = page.getByRole("button", { name: "Mark as Read", exact: true })

  if (await markAsReadButton.isVisible()) {
    await markAsReadButton.click()
  }

  await expect(page.getByRole("button", { name: "Read", exact: true })).toBeVisible()
}
