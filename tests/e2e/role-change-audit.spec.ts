import { expect, test } from "@playwright/test"
import { createAdminTestClient, createAnonymousTestClient } from "./helpers/supabase"

const admin = createAdminTestClient()
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = "RoleAudit!2026"

async function createActor(label: string) {
  const email = `role-audit-${label}-${runId}@bookworm.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw error ?? new Error(`Could not create ${label}`)

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .single()
  if (profileError || !profile?.id) throw profileError ?? new Error(`Could not load ${label} profile`)

  const browser = createAnonymousTestClient()
  const { error: signInError } = await browser.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { userId: data.user.id, profileId: profile.id as string, browser }
}

test("moderator changes are atomic, audited, and unavailable to browser sessions", async () => {
  const actors: Awaited<ReturnType<typeof createActor>>[] = []

  try {
    const administrator = await createActor("admin")
    actors.push(administrator)
    const target = await createActor("target")
    actors.push(target)
    const ordinary = await createActor("ordinary")
    actors.push(ordinary)

    const { error: setupError } = await admin.from("user_roles").upsert({
      user_id: administrator.userId,
      role: "admin",
    }, { onConflict: "user_id" })
    expect(setupError).toBeNull()

    const parameters = {
      p_actor_auth_user_id: administrator.userId,
      p_target_auth_user_id: target.userId,
      p_make_moderator: true,
    }

    const { error: browserExecuteError } = await administrator.browser.rpc("change_moderator_role", parameters)
    expect(browserExecuteError).not.toBeNull()

    const { data: browserAudit, error: browserAuditError } = await administrator.browser
      .from("role_change_audit")
      .select("id")
    expect(browserAuditError).not.toBeNull()
    expect(browserAudit).toBeNull()

    const { error: impersonationError } = await admin.rpc("change_moderator_role", {
      ...parameters,
      p_actor_auth_user_id: ordinary.userId,
    })
    expect(impersonationError).not.toBeNull()

    const { data: assigned, error: assignError } = await admin.rpc("change_moderator_role", parameters)
    expect(assignError).toBeNull()
    expect(assigned).toEqual([{ old_role: "user", new_role: "moderator", changed: true }])

    const { data: role, error: roleError } = await admin.from("user_roles")
      .select("role")
      .eq("user_id", target.userId)
      .single()
    expect(roleError).toBeNull()
    expect(role?.role).toBe("moderator")

    const { data: profile, error: profileError } = await admin.from("user_profiles")
      .select("role")
      .eq("id", target.profileId)
      .single()
    expect(profileError).toBeNull()
    expect(profile?.role).toBe("moderator")

    const { data: repeat, error: repeatError } = await admin.rpc("change_moderator_role", parameters)
    expect(repeatError).toBeNull()
    expect(repeat).toEqual([{ old_role: "moderator", new_role: "moderator", changed: false }])

    const { data: revoked, error: revokeError } = await admin.rpc("change_moderator_role", {
      ...parameters,
      p_make_moderator: false,
    })
    expect(revokeError).toBeNull()
    expect(revoked).toEqual([{ old_role: "moderator", new_role: "user", changed: true }])

    const { data: audit, error: auditError } = await admin.from("role_change_audit")
      .select("actor_auth_user_id,target_auth_user_id,old_role,new_role")
      .eq("target_auth_user_id", target.userId)
      .order("changed_at", { ascending: true })
    expect(auditError).toBeNull()
    expect(audit).toEqual([
      {
        actor_auth_user_id: administrator.userId,
        target_auth_user_id: target.userId,
        old_role: "user",
        new_role: "moderator",
      },
      {
        actor_auth_user_id: administrator.userId,
        target_auth_user_id: target.userId,
        old_role: "moderator",
        new_role: "user",
      },
    ])

    const { error: tamperError } = await admin.from("role_change_audit")
      .update({ new_role: "admin" })
      .eq("target_auth_user_id", target.userId)
    expect(tamperError).not.toBeNull()

    const { error: deleteAuditError } = await admin.from("role_change_audit")
      .delete()
      .eq("target_auth_user_id", target.userId)
    expect(deleteAuditError).not.toBeNull()

    const { error: adminTargetError } = await admin.rpc("change_moderator_role", {
      ...parameters,
      p_target_auth_user_id: administrator.userId,
    })
    expect(adminTargetError).not.toBeNull()

    const { data: finalRole, error: finalRoleError } = await admin.from("user_roles")
      .select("role")
      .eq("user_id", target.userId)
      .single()
    expect(finalRoleError).toBeNull()
    expect(finalRole?.role).toBe("user")
  } finally {
    for (const actor of actors.reverse()) {
      await actor.browser.auth.signOut()
      await admin.auth.admin.deleteUser(actor.userId)
    }
  }
})
