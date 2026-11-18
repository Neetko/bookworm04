import Link from "next/link"
import { assignModeratorRoleAction, removeModeratorRoleAction } from "@/app/actions/admin"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { createAdminClient } from "@/lib/supabase-server"
import { canManageRoles, normalizeAppRole, type AppRole, getCurrentUserAccess } from "@/lib/server/roles"
import { hasVerifiedStaffSession } from "@/lib/server/staff-mfa"
import { AdminMfaGate } from "@/components/admin-mfa-gate"

type StaffProfileRow = {
  id: string
  authUserId: string
  username: string | null
  publicRoleLabel: string | null
  appRole: AppRole
}

function escapeOrLikeValue(value: string) {
  return value.replace(/[,%_()]/g, " ")
}

async function getRoleMap(admin: ReturnType<typeof createAdminClient>, authUserIds: string[]) {
  if (authUserIds.length === 0) return new Map<string, AppRole>()

  const { data: roleRows, error } = await admin
    .from("user_roles")
    .select("user_id,role")
    .in("user_id", authUserIds)

  if (error) {
    console.error("Failed to load user role rows", error)
    throw new Error("Failed to load user role rows")
  }

  const roleMap = new Map<string, AppRole>()

  for (const row of roleRows ?? []) {
    const userId = (row as any).user_id as string | undefined
    if (!userId) continue
    roleMap.set(userId, normalizeAppRole((row as any).role))
  }

  return roleMap
}

async function getStaffProfiles(admin: ReturnType<typeof createAdminClient>) {
  const { data: staffRoleRows, error: staffRoleError } = await admin
    .from("user_roles")
    .select("user_id,role")
    .in("role", ["admin", "moderator"])

  if (staffRoleError) {
    console.error("Failed to load staff role rows", staffRoleError)
    throw new Error("Failed to load staff role rows")
  }

  const authUserIds = Array.from(new Set((staffRoleRows ?? []).map((row: any) => row.user_id).filter(Boolean)))

  if (authUserIds.length === 0) return [] satisfies StaffProfileRow[]

  const { data: profileRows, error: profileError } = await admin
    .from("user_profiles")
    .select("id,auth_user_id,username,role")
    .in("auth_user_id", authUserIds)

  if (profileError) {
    console.error("Failed to load staff profiles", profileError)
    throw new Error("Failed to load staff profiles")
  }

  const roleMap = new Map<string, AppRole>()
  for (const row of staffRoleRows ?? []) {
    const userId = (row as any).user_id as string | undefined
    if (!userId) continue
    roleMap.set(userId, normalizeAppRole((row as any).role))
  }

  return (profileRows ?? [])
    .filter((row: any) => row?.id && row?.auth_user_id)
    .map((row: any) => ({
      id: row.id as string,
      authUserId: row.auth_user_id as string,
      username: row.username ?? null,
      publicRoleLabel: row.role ?? null,
      appRole: roleMap.get(row.auth_user_id as string) ?? "user",
    }))
    .sort((a, b) => {
      const roleOrder = { admin: 0, moderator: 1, user: 2 }
      const roleDiff = roleOrder[a.appRole] - roleOrder[b.appRole]
      if (roleDiff !== 0) return roleDiff
      return (a.username ?? "").localeCompare(b.username ?? "")
    })
}

async function searchProfiles(admin: ReturnType<typeof createAdminClient>, query: string) {
  if (!query) return [] satisfies StaffProfileRow[]

  const searchValue = escapeOrLikeValue(query)

  const { data: profileRows, error } = await admin
    .from("user_profiles")
    .select("id,auth_user_id,username,role")
    .not("auth_user_id", "is", null)
    .ilike("username", `%${searchValue}%`)
    .order("username", { ascending: true })
    .limit(25)

  if (error) {
    console.error("Failed to search user profiles", error)
    throw new Error("Failed to search user profiles")
  }

  const authUserIds = Array.from(new Set((profileRows ?? []).map((row: any) => row.auth_user_id).filter(Boolean)))
  const roleMap = await getRoleMap(admin, authUserIds)

  return (profileRows ?? [])
    .filter((row: any) => row?.id && row?.auth_user_id)
    .map((row: any) => ({
      id: row.id as string,
      authUserId: row.auth_user_id as string,
      username: row.username ?? null,
      publicRoleLabel: row.role ?? null,
      appRole: roleMap.get(row.auth_user_id as string) ?? "user",
    }))
}

function roleBadgeVariant(role: AppRole): "default" | "secondary" | "outline" {
  if (role === "admin") return "default"
  if (role === "moderator") return "secondary"
  return "outline"
}

function displayName(row: StaffProfileRow) {
  return row.username ?? "Unknown user"
}

function buildRedirectPath(query: string) {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  const suffix = params.toString()
  return suffix ? `/admin/moderators?${suffix}` : "/admin/moderators"
}

function RoleActionCell({ row, redirectTo }: { row: StaffProfileRow; redirectTo: string }) {
  if (row.appRole === "admin") {
    return <span className="text-xs text-muted-foreground">Admin accounts are read-only here.</span>
  }

  if (row.appRole === "moderator") {
    return (
      <form action={removeModeratorRoleAction}>
        <input type="hidden" name="authUserId" value={row.authUserId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Button type="submit" size="sm" variant="outline">Set back to user</Button>
      </form>
    )
  }

  return (
    <form action={assignModeratorRoleAction}>
      <input type="hidden" name="authUserId" value={row.authUserId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button type="submit" size="sm">Make moderator</Button>
    </form>
  )
}

export default async function ModeratorsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? "").trim()
  const access = await getCurrentUserAccess()
  const user = access.user

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="font-ui max-w-4xl mx-auto p-8">
          <h1 className="text-2xl font-semibold mb-2">Moderator access</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage moderator access.</p>
        </div>
      </div>
    )
  }

  if (!canManageRoles(access.role)) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="font-ui max-w-4xl mx-auto p-8 space-y-2">
          <h1 className="text-2xl font-semibold">Moderator access</h1>
          <p className="text-sm text-muted-foreground">Administrator access required.</p>
          <p className="text-xs text-muted-foreground">Signed in as {user.email ?? "unknown user"}.</p>
        </div>
      </div>
    )
  }

  if (!(await hasVerifiedStaffSession())) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="font-ui max-w-4xl mx-auto p-8">
          <AdminMfaGate />
        </div>
      </div>
    )
  }

  const admin = createAdminClient()
  const [staffProfiles, searchResults] = await Promise.all([
    getStaffProfiles(admin),
    searchProfiles(admin, query),
  ])
  const redirectTo = buildRedirectPath(query)

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="font-ui max-w-6xl mx-auto p-8 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Moderator access</h1>
            <p className="text-sm text-muted-foreground">
              Assign moderators here. Public-facing role labels now mirror application access as reader, moderator, or admin.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/suggestions">Review suggestions</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search users</CardTitle>
            <CardDescription>
              Find a profile by username, then grant or remove moderator access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row" action="/admin/moderators" method="get">
              <Input name="q" defaultValue={query} placeholder="Search username or email" />
              <Button type="submit">Search</Button>
            </form>

            {query ? (
              <div className="mt-6 space-y-3">
                <div className="text-sm text-muted-foreground">
                  {searchResults.length === 0 ? "No users matched your search." : `Found ${searchResults.length} user${searchResults.length === 1 ? "" : "s"}.`}
                </div>

                {searchResults.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>App role</TableHead>
                        <TableHead>Public role</TableHead>
                        <TableHead className="w-[180px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-medium">{displayName(row)}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={roleBadgeVariant(row.appRole)}>{row.appRole}</Badge>
                          </TableCell>
                          <TableCell>{row.publicRoleLabel ?? "reader"}</TableCell>
                          <TableCell>
                            <RoleActionCell row={row} redirectTo={redirectTo} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current staff access</CardTitle>
            <CardDescription>
              Application roles live in `user_roles`, and public profile labels are normalized to reader, moderator, or admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staffProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admins or moderators found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>App role</TableHead>
                    <TableHead>Public role</TableHead>
                    <TableHead className="w-[180px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffProfiles.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{displayName(row)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(row.appRole)}>{row.appRole}</Badge>
                      </TableCell>
                      <TableCell>{row.publicRoleLabel ?? "reader"}</TableCell>
                      <TableCell>
                        <RoleActionCell row={row} redirectTo={redirectTo} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
