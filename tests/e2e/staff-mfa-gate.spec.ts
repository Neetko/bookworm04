import { createHmac } from "node:crypto"
import { expect, test } from "@playwright/test"
import { createAdminTestClient } from "./helpers/supabase"

function currentTotp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const letter of secret.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    value = (value << 5) | alphabet.indexOf(letter)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 0xff)
    }
  }

  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return number.toString().padStart(6, "0")
}

test("staff pages require authenticator verification before loading privileged data", async ({ page }) => {
  test.setTimeout(90_000)
  const admin = createAdminTestClient()
  const email = `staff-mfa-${Date.now()}@bookworm.test`
  const password = "StaffMfaTest!2026"
  let titleId: string | null = null
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created.user) throw createError ?? new Error("Could not create staff test user")

  try {
    const { error: roleError } = await admin.from("user_roles").upsert({
      user_id: created.user.id,
      role: "admin",
    }, { onConflict: "user_id" })
    expect(roleError).toBeNull()

    const { error: onboardingError } = await admin.from("user_profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("auth_user_id", created.user.id)
    expect(onboardingError).toBeNull()

    const { data: title, error: titleError } = await admin.from("titles")
      .insert({ title: `Staff MFA test ${Date.now()}`, author: "Bookworm test" })
      .select("id")
      .single()
    expect(titleError).toBeNull()
    titleId = title?.id ?? null
    expect(titleId).toBeTruthy()

    await page.goto("/")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.getByLabel("Email address").fill(email)
    await page.getByLabel("Your Password").fill(password)
    await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.goto("/admin/moderators")
    await expect(page.getByRole("heading", { name: "Staff verification" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Set up authenticator" })).toBeVisible()
    await expect(page.getByPlaceholder("Search username or email")).toHaveCount(0)

    await page.goto("/admin/suggestions")
    await expect(page.getByRole("heading", { name: "Staff verification" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Set up authenticator" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Suggestions" })).toHaveCount(0)

    await page.goto(`/titles/${titleId}`)
    await page.getByRole("button", { name: "Dedupe", exact: true }).click()
    await expect(page.getByText("Select possible work IDs to send for moderator review.", { exact: false })).toBeVisible()

    await page.goto("/admin/moderators")
    await page.getByRole("button", { name: "Set up authenticator" }).click()
    await expect(page.getByAltText("Authenticator setup QR code")).toBeVisible()
    const secret = (await page.locator("code").textContent())?.trim()
    expect(secret).toBeTruthy()
    await page.getByRole("textbox", { name: "Authenticator code" }).fill(currentTotp(secret!))
    await page.getByRole("button", { name: "Verify and continue" }).click()
    await expect(page.getByPlaceholder("Search username or email")).toBeVisible()

    await page.goto("/admin/suggestions")
    await expect(page.getByText("Review pending user-submitted metadata.")).toBeVisible()

    await page.goto(`/titles/${titleId}`)
    await page.getByRole("button", { name: "Dedupe", exact: true }).click()
    await expect(page.getByText("Select possible work IDs to verify now.", { exact: false })).toBeVisible()
  } finally {
    if (titleId) await admin.from("titles").delete().eq("id", titleId)
    await admin.auth.admin.deleteUser(created.user.id)
  }
})
