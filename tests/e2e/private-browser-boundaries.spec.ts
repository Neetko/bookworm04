import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createAdminTestClient, createAnonymousTestClient } from "./helpers/supabase"

type Actor = {
  client: SupabaseClient
  profileId: string
  user: User
}

const admin = createAdminTestClient()
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = "PrivateBoundary!2026"

async function createActor(label: string): Promise<Actor> {
  const email = `private-${label}-${runId}@bookworm.test`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created.user) throw createError ?? new Error(`Could not create ${label}`)

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", created.user.id)
    .single()

  if (profileError || !profile?.id) throw profileError ?? new Error(`Could not find ${label} profile`)

  const client = createAnonymousTestClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { client, profileId: profile.id as string, user: created.user }
}

test("private data and role writes stay outside even an admin browser session", async () => {
  const createdActors: Actor[] = []
  const sentId = randomUUID()
  const draftId = randomUUID()
  const notificationId = randomUUID()

  try {
    const sender = await createActor("sender")
    createdActors.push(sender)
    const recipient = await createActor("recipient")
    createdActors.push(recipient)
    const staff = await createActor("admin")
    createdActors.push(staff)

    const { error: roleSetupError } = await admin
      .from("user_roles")
      .upsert([
        { user_id: staff.user.id, role: "admin" },
        { user_id: recipient.user.id, role: "user" },
      ], { onConflict: "user_id" })
    expect(roleSetupError).toBeNull()

    const { error: messageSetupError } = await admin.from("messages").insert([
      {
        id: sentId,
        sender_profile_id: sender.profileId,
        recipient_profile_id: recipient.profileId,
        subject: "Sent fixture",
        body: "Visible only to sender and recipient",
        status: "sent",
        is_read: false,
      },
      {
        id: draftId,
        sender_profile_id: sender.profileId,
        recipient_profile_id: recipient.profileId,
        subject: "Unsent fixture",
        body: "Private to the sender",
        status: "draft",
        is_read: true,
      },
    ])
    expect(messageSetupError).toBeNull()

    const { error: notificationSetupError } = await admin.from("notifications").insert({
      id: notificationId,
      recipient_profile_id: recipient.profileId,
      actor_profile_id: sender.profileId,
      event_type: "private_boundary_test",
    })
    expect(notificationSetupError).toBeNull()

    const { data: staffOwnRole, error: staffOwnRoleError } = await staff.client
      .from("user_roles")
      .select("role")
      .eq("user_id", staff.user.id)
      .single()
    expect(staffOwnRoleError).toBeNull()
    expect(staffOwnRole?.role).toBe("admin")

    const { data: isAdmin, error: adminCheckError } = await staff.client.rpc("is_current_user_admin")
    expect(adminCheckError).toBeNull()
    expect(isAdmin).toBe(true)

    const { data: staffMessages, error: staffMessagesError } = await staff.client
      .from("messages")
      .select("id")
      .in("id", [sentId, draftId])
    expect(staffMessagesError).toBeNull()
    expect(staffMessages).toEqual([])

    const { data: recipientMessages, error: recipientMessagesError } = await recipient.client
      .from("messages")
      .select("id")
      .in("id", [sentId, draftId])
    expect(recipientMessagesError).toBeNull()
    expect(recipientMessages).toEqual([{ id: sentId }])

    const { data: senderMessages, error: senderMessagesError } = await sender.client
      .from("messages")
      .select("id")
      .in("id", [sentId, draftId])
    expect(senderMessagesError).toBeNull()
    expect(new Set((senderMessages ?? []).map((row) => row.id))).toEqual(new Set([sentId, draftId]))

    const { data: staffProfiles, error: staffProfilesError } = await staff.client
      .from("user_profiles")
      .select("id,email")
      .eq("id", recipient.profileId)
    expect(staffProfilesError).toBeNull()
    expect(staffProfiles).toEqual([])

    const { data: staffNotifications, error: staffNotificationsError } = await staff.client
      .from("notifications")
      .select("id")
      .eq("id", notificationId)
    expect(staffNotificationsError).toBeNull()
    expect(staffNotifications).toEqual([])

    const { data: recipientNotifications, error: recipientNotificationsError } = await recipient.client
      .from("notifications")
      .select("id")
      .eq("id", notificationId)
    expect(recipientNotificationsError).toBeNull()
    expect(recipientNotifications).toEqual([{ id: notificationId }])

    const { data: staffOtherRoles, error: staffOtherRolesError } = await staff.client
      .from("user_roles")
      .select("user_id")
      .eq("user_id", recipient.user.id)
    expect(staffOtherRolesError).toBeNull()
    expect(staffOtherRoles).toEqual([])

    const { error: insertRoleError } = await staff.client
      .from("user_roles")
      .insert({ user_id: sender.user.id, role: "admin" })
    expect(insertRoleError).not.toBeNull()

    const { error: updateRoleError } = await staff.client
      .from("user_roles")
      .update({ role: "user" })
      .eq("user_id", staff.user.id)
    expect(updateRoleError).not.toBeNull()

    const { error: deleteRoleError } = await staff.client
      .from("user_roles")
      .delete()
      .eq("user_id", staff.user.id)
    expect(deleteRoleError).not.toBeNull()

    const { data: roleAfterAttempts, error: roleAfterAttemptsError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", staff.user.id)
      .single()
    expect(roleAfterAttemptsError).toBeNull()
    expect(roleAfterAttempts?.role).toBe("admin")

    const { error: spoofMessageError } = await staff.client.from("messages").insert({
      sender_profile_id: recipient.profileId,
      recipient_profile_id: sender.profileId,
      subject: "Forged sender",
      body: "Should be blocked",
      status: "sent",
      is_read: false,
    })
    expect(spoofMessageError).not.toBeNull()

    await staff.client
      .from("user_profiles")
      .update({ bio: "Changed by admin browser" })
      .eq("id", recipient.profileId)

    const { data: recipientProfileAfter, error: recipientProfileAfterError } = await admin
      .from("user_profiles")
      .select("bio")
      .eq("id", recipient.profileId)
      .single()
    expect(recipientProfileAfterError).toBeNull()
    expect(recipientProfileAfter?.bio).not.toBe("Changed by admin browser")
  } finally {
    await admin.from("notifications").delete().eq("id", notificationId)
    await admin.from("messages").delete().in("id", [sentId, draftId])
    for (const actor of createdActors) {
      await actor.client.auth.signOut()
      await admin.auth.admin.deleteUser(actor.user.id)
    }
  }
})
