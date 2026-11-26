import { createServerFn } from "@tanstack/react-start"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"

async function access(required: "staff" | "admin") {
  const supabase = createRequestSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "unauthorized" as const }
  const [{ data: role }, { data: assurance }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  const appRole = role?.role as string | undefined
  if (!appRole || (required === "admin" ? appRole !== "admin" : !["admin", "moderator"].includes(appRole))) return { status: "forbidden" as const }
  if (assurance?.currentLevel !== "aal2") return { status: "mfa" as const, role: appRole as "admin" | "moderator" }
  const admin = createAdminSupabaseClient()
  if (!admin) return { status: "unavailable" as const }
  return { status: "ok" as const, user, role: appRole as "admin" | "moderator", admin }
}

export const getModeratorAdmin = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ q: input && typeof input === "object" && "q" in input && typeof input.q === "string" ? input.q.trim().slice(0, 100) : "" }))
  .handler(async ({ data }) => {
    const auth = await access("admin")
    if (auth.status !== "ok") return auth
    const { data: roleRows, error } = await auth.admin.from("user_roles").select("user_id,role").in("role", ["admin", "moderator"])
    if (error) return { status: "unavailable" as const }
    const staffIds = (roleRows ?? []).map((row) => row.user_id)
    const { data: staffProfiles } = staffIds.length ? await auth.admin.from("user_profiles").select("id,auth_user_id,username,role").in("auth_user_id", staffIds) : { data: [] }
    const roleMap = new Map((roleRows ?? []).map((row) => [row.user_id, row.role]))
    let searchRows: Array<{ id: string; auth_user_id: string; username: string | null; role: string | null }> = []
    if (data.q) {
      const safe = data.q.replace(/[\\%_]/g, "\\$&")
      const { data: profiles } = await auth.admin.from("user_profiles").select("id,auth_user_id,username,role").not("auth_user_id", "is", null).ilike("username", `%${safe}%`).order("username").limit(25)
      searchRows = (profiles ?? []).filter((row): row is typeof row & { auth_user_id: string } => Boolean(row.auth_user_id))
      const ids = searchRows.map((row) => row.auth_user_id)
      if (ids.length) {
        const { data: searchedRoles } = await auth.admin.from("user_roles").select("user_id,role").in("user_id", ids)
        for (const row of searchedRoles ?? []) roleMap.set(row.user_id, row.role)
      }
    }
    const present = (row: { id: string; auth_user_id: string | null; username: string | null; role: string | null }) => ({ id: row.id, authUserId: row.auth_user_id!, username: row.username, publicRole: row.role, appRole: (roleMap.get(row.auth_user_id!) ?? "user") as "admin" | "moderator" | "user" })
    return { status: "ok" as const, role: auth.role, staff: (staffProfiles ?? []).filter((row) => row.auth_user_id).map(present).sort((a, b) => a.appRole.localeCompare(b.appRole) || (a.username ?? "").localeCompare(b.username ?? "")), results: searchRows.map(present), q: data.q }
  })

export const getSuggestionAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await access("staff")
  if (auth.status !== "ok") return auth
  const { data, error } = await auth.admin.from("suggestions").select("id,title_id,suggested_genres,algorithm_suggested_genres,admin_final_genres,created_at,title:titles!suggestions_title_id_fkey(id,title,author),suggested_by:user_profiles!suggestions_suggested_by_profile_id_fkey(username)").eq("status", "pending").order("created_at", { ascending: false }).limit(200)
  if (error) return { status: "unavailable" as const }
  type JoinedSuggestion = {
    id: string
    title_id: string
    suggested_genres: string[] | null
    algorithm_suggested_genres: string[] | null
    admin_final_genres: string[] | null
    created_at: string | null
    title: { title: string | null; author: string | null } | Array<{ title: string | null; author: string | null }> | null
    suggested_by: { username: string | null } | Array<{ username: string | null }> | null
  }
  const suggestions = (data ?? []) as unknown as JoinedSuggestion[]
  return { status: "ok" as const, role: auth.role, suggestions: suggestions.map((row) => {
    const title = Array.isArray(row.title) ? row.title[0] : row.title
    const suggestedBy = Array.isArray(row.suggested_by) ? row.suggested_by[0] : row.suggested_by
    return { id: row.id, titleId: row.title_id, title: title?.title, author: title?.author, suggestedBy: suggestedBy?.username, suggestedGenres: row.suggested_genres ?? [], algorithmGenres: row.algorithm_suggested_genres ?? [], finalGenres: row.admin_final_genres ?? [], createdAt: row.created_at }
  }) }
})
