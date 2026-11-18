import { createHmac } from "node:crypto"
import { expect, test } from "@playwright/test"
import { createAdminTestClient, createAnonymousTestClient } from "./helpers/supabase"

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

test("direct staff database permissions require an authenticator-verified session", async () => {
  test.setTimeout(90_000)
  const admin = createAdminTestClient()
  const browser = createAnonymousTestClient()
  const email = `staff-db-mfa-${Date.now()}@bookworm.test`
  const password = "StaffDbMfaTest!2026"
  let titleId: string | null = null
  let deniedTitleId: string | null = null
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

    const { error: signInError } = await browser.auth.signInWithPassword({ email, password })
    expect(signInError).toBeNull()

    // Staff must still see their own role so the app can offer MFA enrollment.
    const { data: ownRole, error: ownRoleError } = await browser.from("user_roles")
      .select("role")
      .eq("user_id", created.user.id)
      .single()
    expect(ownRoleError).toBeNull()
    expect(ownRole?.role).toBe("admin")

    const { data: beforeAdmin, error: beforeAdminError } = await browser.rpc("is_current_user_admin")
    const { data: beforeStaff, error: beforeStaffError } = await browser.rpc("is_current_user_staff")
    expect(beforeAdminError).toBeNull()
    expect(beforeStaffError).toBeNull()
    expect(beforeAdmin).toBe(false)
    expect(beforeStaff).toBe(false)

    const title = `AAL1 must not create this title ${Date.now()}`
    const { data: unexpectedlyCreated, error: deniedInsert } = await browser.from("titles")
      .insert({ title, author: "Bookworm test" })
      .select("id")
      .maybeSingle()
    deniedTitleId = unexpectedlyCreated?.id ?? null
    expect(deniedInsert).not.toBeNull()

    const { data: enrolled, error: enrollError } = await browser.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Bookworm staff database test",
    })
    expect(enrollError).toBeNull()
    expect(enrolled?.totp?.secret).toBeTruthy()

    const { data: challenge, error: challengeError } = await browser.auth.mfa.challenge({ factorId: enrolled!.id })
    expect(challengeError).toBeNull()
    expect(challenge?.id).toBeTruthy()

    const { error: verifyError } = await browser.auth.mfa.verify({
      factorId: enrolled!.id,
      challengeId: challenge!.id,
      code: currentTotp(enrolled!.totp!.secret),
    })
    expect(verifyError).toBeNull()

    const { data: assurance, error: assuranceError } = await browser.auth.mfa.getAuthenticatorAssuranceLevel()
    expect(assuranceError).toBeNull()
    expect(assurance?.currentLevel).toBe("aal2")

    const { data: afterAdmin, error: afterAdminError } = await browser.rpc("is_current_user_admin")
    const { data: afterStaff, error: afterStaffError } = await browser.rpc("is_current_user_staff")
    expect(afterAdminError).toBeNull()
    expect(afterStaffError).toBeNull()
    expect(afterAdmin).toBe(true)
    expect(afterStaff).toBe(true)

    const { data: createdTitle, error: allowedInsert } = await browser.from("titles")
      .insert({ title: `AAL2 title ${Date.now()}`, author: "Bookworm test" })
      .select("id")
      .single()
    expect(allowedInsert).toBeNull()
    expect(createdTitle?.id).toBeTruthy()
    titleId = createdTitle?.id ?? null
  } finally {
    if (deniedTitleId) await admin.from("titles").delete().eq("id", deniedTitleId)
    if (titleId) await admin.from("titles").delete().eq("id", titleId)
    await admin.auth.admin.deleteUser(created.user.id)
  }
})
