import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { StaffMfa } from "../features/staff/staff-mfa"
import { getModeratorAdmin } from "../features/staff/staff.functions"
import styles from "../features/staff/staff.module.css"

export const Route = createFileRoute("/admin/moderators")({
  validateSearch: (search) => ({ q: typeof search.q === "string" ? search.q.trim().slice(0, 100) : "" }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => { const data = await getModeratorAdmin({ data: deps }); if (data.status === "unauthorized") throw redirect({ to: "/auth" }); return data },
  head: () => ({ meta: [{ title: "Moderator access | Bookworm" }] }),
  component: ModeratorsPage,
})

function ModeratorsPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [busy, setBusy] = useState("")
  const [feedback, setFeedback] = useState("")
  if (data.status === "mfa") return <StaffShell><StaffMfa /></StaffShell>
  if (data.status === "forbidden") return <StaffShell><p className={styles.error}>Administrator access required.</p></StaffShell>
  if (data.status !== "ok") return <StaffShell><p className={styles.error}>Moderator management is unavailable.</p></StaffShell>
  async function change(authUserId: string, makeModerator: boolean) {
    setBusy(authUserId); setFeedback("")
    const response = await fetch("/api/staff/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authUserId, makeModerator }) })
    const body = await response.json().catch(() => null) as { error?: string } | null
    setBusy(""); if (!response.ok) { setFeedback(body?.error ?? "Could not change role"); return }
    await router.invalidate(); setFeedback("Role updated.")
  }
  const row = (item: typeof data.staff[number]) => <li key={item.id}><div><strong>{item.username ?? "Unknown user"}</strong><p className={styles.muted}>{item.appRole} · public label {item.publicRole ?? "reader"}</p></div>{item.appRole !== "admin" && <button className={styles.button} disabled={busy === item.authUserId} onClick={() => void change(item.authUserId, item.appRole !== "moderator")}>{item.appRole === "moderator" ? "Set back to user" : "Make moderator"}</button>}</li>
  return <StaffShell><p className={styles.muted}>Administrator tools</p><h1 className={styles.title}>Moderator access</h1><p>Assign or remove moderator privileges. Every change is checked again in the database and recorded in the role audit.</p>{feedback && <p className={styles.feedback}>{feedback}</p>}
    <section className={styles.card}><h2>Search users</h2><form className={styles.form} method="get"><input className={styles.input} name="q" defaultValue={data.q} placeholder="Username" maxLength={100} /><button className={styles.button}>Search</button></form>{data.q && <ul className={styles.list}>{data.results.length ? data.results.map(row) : <li>No users matched.</li>}</ul>}</section>
    <section className={styles.card}><h2>Current staff</h2><ul className={styles.list}>{data.staff.length ? data.staff.map(row) : <li>No staff accounts found.</li>}</ul></section>
  </StaffShell>
}

function StaffShell({ children }: { children: React.ReactNode }) { return <div className={styles.page}><header className={styles.header}><Link to="/">BOOKWORM</Link><nav><Link to="/admin/suggestions">Suggestions</Link></nav></header><main className={styles.main}>{children}</main></div> }
