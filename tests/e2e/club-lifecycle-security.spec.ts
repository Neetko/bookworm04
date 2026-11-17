import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createAdminTestClient, createAnonymousTestClient } from "./helpers/supabase"

type TestActor = {
  client: SupabaseClient
  email: string
  password: string
  profileId: string
  user: User
}

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = "ClubJourney!2026"

async function createActor(label: string): Promise<TestActor> {
  const admin = createAdminTestClient()
  const email = `club-${label}-${runId}@bookworm.test`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Club ${label}` },
  })

  if (createError || !created.user) throw createError ?? new Error(`Could not create ${label}`)

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", created.user.id)
    .single()

  if (profileError || !profile) throw profileError ?? new Error(`Could not find ${label} profile`)

  const { error: onboardingError } = await admin
    .from("user_profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", profile.id)

  if (onboardingError) throw onboardingError

  const client = createAnonymousTestClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return {
    client,
    email,
    password,
    profileId: profile.id,
    user: created.user,
  }
}

test.describe.serial("club lifecycle database boundary", () => {
  const admin = createAdminTestClient()
  const approvalClubId = randomUUID()
  const inviteOnlyClubId = randomUUID()
  let owner: TestActor
  let applicant: TestActor
  let invitee: TestActor

  test.beforeAll(async () => {
    owner = await createActor("owner")
    applicant = await createActor("applicant")
    invitee = await createActor("invitee")

    const { error } = await admin.from("clubs").insert([
      {
        id: approvalClubId,
        type: "book",
        name: `Approval Club ${runId}`,
        description: "Approval lifecycle test fixture",
        owner_user_id: owner.profileId,
        join_policy: "approval_required",
        categories: ["MYSTERY"],
      },
      {
        id: inviteOnlyClubId,
        type: "book",
        name: `Invite Club ${runId}`,
        description: "Invitation lifecycle test fixture",
        owner_user_id: owner.profileId,
        join_policy: "invite_only",
        categories: ["SCI-FI"],
      },
    ])

    if (error) throw error
  })

  test.afterAll(async () => {
    await admin.from("clubs").delete().in("id", [approvalClubId, inviteOnlyClubId])

    for (const actor of [owner, applicant, invitee]) {
      if (actor?.user.id) await admin.auth.admin.deleteUser(actor.user.id)
    }
  })

  test("blocks direct membership and forged notification writes", async () => {
    for (const clubId of [approvalClubId, inviteOnlyClubId]) {
      await applicant.client.from("club_members").insert({
        club_id: clubId,
        user_id: applicant.profileId,
      })
    }

    const { data: bypassedMemberships, error: membershipReadError } = await admin
      .from("club_members")
      .select("club_id")
      .eq("user_id", applicant.profileId)
      .in("club_id", [approvalClubId, inviteOnlyClubId])

    expect(membershipReadError).toBeNull()
    expect(bypassedMemberships).toEqual([])

    await applicant.client.from("notifications").insert({
      recipient_profile_id: invitee.profileId,
      actor_profile_id: applicant.profileId,
      event_type: "club_invited_to_club",
      metadata: { club: { id: inviteOnlyClubId, name: "Forged invitation" } },
    })

    const { data: forgedNotifications, error: forgedReadError } = await admin
      .from("notifications")
      .select("id")
      .eq("recipient_profile_id", invitee.profileId)
      .eq("actor_profile_id", applicant.profileId)
      .eq("event_type", "club_invited_to_club")

    expect(forgedReadError).toBeNull()
    expect(forgedNotifications).toEqual([])
  })

  test("submits each application once and reviews it atomically", async () => {
    const first = await applicant.client.rpc("submit_club_application", {
      target_club_id: approvalClubId,
    })
    expect(first.error).toBeNull()
    expect(first.data).toEqual(expect.any(String))

    const repeated = await applicant.client.rpc("submit_club_application", {
      target_club_id: approvalClubId,
    })
    expect(repeated.error).toBeNull()
    expect(repeated.data).toBe(first.data)

    const { data: ownerNotifications, error: ownerNotificationError } = await admin
      .from("notifications")
      .select("id")
      .eq("recipient_profile_id", owner.profileId)
      .eq("event_type", "club_application_received")
      .contains("metadata", { application: { id: first.data } })

    expect(ownerNotificationError).toBeNull()
    expect(ownerNotifications).toHaveLength(1)

    const review = await owner.client.rpc("review_club_application", {
      target_club_id: approvalClubId,
      target_application_id: first.data,
      approve_application: true,
    })
    expect(review.error).toBeNull()

    const { data: application, error: applicationError } = await admin
      .from("club_applications")
      .select("status, reviewed_by_user_id")
      .eq("id", first.data)
      .single()
    expect(applicationError).toBeNull()
    expect(application).toEqual({ status: "accepted", reviewed_by_user_id: owner.profileId })

    const { data: membership, error: membershipError } = await admin
      .from("club_members")
      .select("id")
      .eq("club_id", approvalClubId)
      .eq("user_id", applicant.profileId)
      .single()
    expect(membershipError).toBeNull()
    expect(membership).not.toBeNull()

    const { data: resolvedOwnerNotification, error: resolvedOwnerNotificationError } = await admin
      .from("notifications")
      .select("is_read, metadata")
      .eq("id", ownerNotifications![0].id)
      .single()
    expect(resolvedOwnerNotificationError).toBeNull()
    expect(resolvedOwnerNotification?.is_read).toBe(true)
    expect(resolvedOwnerNotification?.metadata).toMatchObject({
      resolution: { action: "approved" },
    })
  })

  test("supports withdrawal, revocation, and a race-safe invitation acceptance", async () => {
    const application = await invitee.client.rpc("submit_club_application", {
      target_club_id: approvalClubId,
    })
    expect(application.error).toBeNull()

    const withdrawal = await invitee.client.rpc("withdraw_club_application", {
      target_club_id: approvalClubId,
    })
    expect(withdrawal.error).toBeNull()

    const { data: withdrawnApplication, error: withdrawnError } = await admin
      .from("club_applications")
      .select("status")
      .eq("id", application.data)
      .single()
    expect(withdrawnError).toBeNull()
    expect(withdrawnApplication?.status).toBe("withdrawn")

    const invitation = await owner.client.rpc("invite_club_member", {
      target_club_id: inviteOnlyClubId,
      target_invitee_profile_id: invitee.profileId,
    })
    expect(invitation.error).toBeNull()

    await invitee.client
      .from("club_invitations")
      .update({ inviter_user_id: invitee.profileId, status: "accepted" })
      .eq("id", invitation.data)

    const { data: unchangedInvitation, error: unchangedInvitationError } = await admin
      .from("club_invitations")
      .select("inviter_user_id, status")
      .eq("id", invitation.data)
      .single()
    expect(unchangedInvitationError).toBeNull()
    expect(unchangedInvitation).toEqual({ inviter_user_id: owner.profileId, status: "pending" })

    const revoke = await owner.client.rpc("revoke_club_invitation", {
      target_club_id: inviteOnlyClubId,
      target_invitation_id: invitation.data,
    })
    expect(revoke.error).toBeNull()

    const reinvitation = await owner.client.rpc("invite_club_member", {
      target_club_id: inviteOnlyClubId,
      target_invitee_profile_id: invitee.profileId,
    })
    expect(reinvitation.error).toBeNull()
    expect(reinvitation.data).toBe(invitation.data)

    const response = await invitee.client.rpc("respond_to_club_invitation", {
      target_invitation_id: reinvitation.data,
      accept_invitation: true,
    })
    expect(response.error).toBeNull()

    const repeatedResponse = await invitee.client.rpc("respond_to_club_invitation", {
      target_invitation_id: reinvitation.data,
      accept_invitation: true,
    })
    expect(repeatedResponse.error).toBeNull()

    const { data: acceptedInvitation, error: acceptedInvitationError } = await admin
      .from("club_invitations")
      .select("status")
      .eq("id", reinvitation.data)
      .single()
    expect(acceptedInvitationError).toBeNull()
    expect(acceptedInvitation?.status).toBe("accepted")

    const { count: membershipCount, error: membershipCountError } = await admin
      .from("club_members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", inviteOnlyClubId)
      .eq("user_id", invitee.profileId)
    expect(membershipCountError).toBeNull()
    expect(membershipCount).toBe(1)

    const { count: joinedActivityCount, error: activityCountError } = await admin
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("user_profile_id", invitee.profileId)
      .eq("event_type", "club_joined")
      .contains("metadata", { club: { id: inviteOnlyClubId } })
    expect(activityCountError).toBeNull()
    expect(joinedActivityCount).toBe(1)
  })

  test("prevents recipients from rewriting notification content", async () => {
    const notificationId = randomUUID()
    const { error: seedError } = await admin.from("notifications").insert({
      id: notificationId,
      recipient_profile_id: applicant.profileId,
      actor_profile_id: owner.profileId,
      event_type: "club_membership_removed",
      metadata: { club: { id: approvalClubId, name: "Original club" } },
    })
    expect(seedError).toBeNull()

    await applicant.client
      .from("notifications")
      .update({ event_type: "club_invited_to_club", metadata: { forged: true } })
      .eq("id", notificationId)

    const { data: notification, error } = await admin
      .from("notifications")
      .select("event_type, metadata")
      .eq("id", notificationId)
      .single()

    expect(error).toBeNull()
    expect(notification).toEqual({
      event_type: "club_membership_removed",
      metadata: { club: { id: approvalClubId, name: "Original club" } },
    })

    const readResult = await applicant.client.rpc("mark_notifications_read", {
      target_notification_id: notificationId,
      mark_all: false,
    })
    expect(readResult.error).toBeNull()
    expect(readResult.data).toBe(1)

    const { data: readState, error: readStateError } = await admin
      .from("notifications")
      .select("is_read")
      .eq("id", notificationId)
      .single()
    expect(readStateError).toBeNull()
    expect(readState?.is_read).toBe(true)
  })
})
