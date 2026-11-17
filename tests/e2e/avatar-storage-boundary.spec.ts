import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { createAdminTestClient, createDemoReaderTestClient } from "./helpers/supabase"

test("browser credentials cannot bypass server-side avatar processing", async () => {
  const browser = await createDemoReaderTestClient()
  const admin = createAdminTestClient()
  const { data: { user }, error: userError } = await browser.auth.getUser()
  expect(userError).toBeNull()
  expect(user).not.toBeNull()

  const path = `${user!.id}/direct-upload-${randomUUID()}.png`
  try {
    const { error: uploadError } = await browser.storage.from("user-avatars").upload(
      path,
      Buffer.from("not actually a PNG"),
      { contentType: "image/png" },
    )
    expect(uploadError).not.toBeNull()

    const { error: quotaError } = await browser.rpc("consume_avatar_upload_quota", {
      p_profile_id: user!.id,
    })
    expect(quotaError).not.toBeNull()
  } finally {
    await admin.storage.from("user-avatars").remove([path])
    await browser.auth.signOut()
  }
})
