import { expect, test } from "@playwright/test"

test("public pages hydrate while inline event payloads are blocked", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const response = await page.goto("/about")
  expect(response?.status()).toBe(200)

  const policy = response?.headers()["content-security-policy"] ?? ""
  expect(policy).toContain("script-src 'self' 'nonce-")
  expect(policy).toContain("script-src-attr 'none'")

  await expect(page.getByRole("heading", { name: /about/i })).toBeVisible()
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await expect(page.getByRole("menuitem", { name: "Search Titles" })).toBeVisible()

  await page.evaluate(() => {
    ;(window as Window & { cspPayloadRan?: boolean }).cspPayloadRan = false
    document.body.insertAdjacentHTML(
      "beforeend",
      '<img src="/missing-csp-test.png" onerror="window.cspPayloadRan=true">'
    )
  })

  await page.waitForFunction(() => {
    const image = document.querySelector('img[src="/missing-csp-test.png"]')
    return image instanceof HTMLImageElement && image.complete
  })
  expect(await page.evaluate(() => (window as Window & { cspPayloadRan?: boolean }).cspPayloadRan)).toBe(false)
})

test("API responses and protected redirects keep security headers", async ({ request }) => {
  const api = await request.get("/api/messages")
  expect(api.status()).toBe(401)
  expect(api.headers()["content-security-policy"]).toContain("script-src-attr 'none'")

  const redirect = await request.get("/messages", { maxRedirects: 0 })
  expect(redirect.status()).toBeGreaterThanOrEqual(300)
  expect(redirect.status()).toBeLessThan(400)
  expect(redirect.headers()["content-security-policy"]).toContain("script-src-attr 'none'")
})
