import { ThemeToggle } from "../components/theme-toggle"
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { getClubManagement } from "../features/social/social.functions"
import { GENRES } from "../features/titles/catalog"
import styles from "../features/social/social.module.css"

export const Route = createFileRoute("/community_/clubs/$id_/manage")({
  loader: async ({ params }) => {
    const result = await getClubManagement({ data: { id: params.id } })
    if (result.status === "unauthorized") throw redirect({ to: "/auth" })
    return result
  },
  head: () => ({ meta: [{ title: "Manage club | Bookworm" }] }),
  component: ManageClubPage,
})

function ManageClubPage() {
  const data = Route.useLoaderData()
  const { id } = Route.useParams()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")
  if (data.status === "not-found") return <main className={styles.main}><p className={styles.empty}>Club not found.</p></main>
  if (data.status === "forbidden") return <main className={styles.main}><p className={styles.empty}>Only the club owner can manage this club.</p></main>

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true); setFeedback("")
    const response = await fetch(`/api/clubs/${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    const body = await response.json().catch(() => null) as { error?: string } | null
    setBusy(false)
    if (!response.ok) { setFeedback(body?.error ?? "Could not update club"); return false }
    await router.invalidate(); setFeedback("Club updated."); return true
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    await mutate({ action: "update", name: form.get("name"), description: form.get("description"), categories: form.getAll("categories"), joinPolicy: form.get("joinPolicy") })
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback("")
    const response = await fetch(`/api/clubs/${encodeURIComponent(id)}/avatar`, { method: "POST", body: new FormData(event.currentTarget) })
    const body = await response.json().catch(() => null) as { error?: string } | null
    setBusy(false); if (!response.ok) { setFeedback(body?.error ?? "Could not upload avatar"); return }
    await router.invalidate(); setFeedback("Avatar updated.")
  }
  return <div className={styles.page}><header className={styles.header}><Link className={styles.brand} to="/">BOOKWORM</Link><nav className={styles.nav}><Link to="/community/clubs/$id" params={{ id }} search={{}}>View club</Link><Link to="/community" search={{ q: "", t: "", genres: "" }}>Community</Link><ThemeToggle /></nav></header><main className={styles.main}>
    <p className={styles.eyebrow}>Owner tools</p><h1 className={styles.title}>Manage {data.club.name}</h1>{feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    <section className={styles.card}><h2 className={styles.sectionTitle}>Settings</h2><form className={styles.form} onSubmit={save}>
      <label>Name<input className={styles.input} name="name" defaultValue={data.club.name} maxLength={200} required /></label><label>Join policy<select className={styles.select} name="joinPolicy" defaultValue={data.club.joinPolicy}><option value="open">Open</option><option value="approval_required">Approval required</option><option value="invite_only">Invite only</option></select></label>
      <label className={styles.full}>Description<textarea name="description" defaultValue={data.club.description} maxLength={5000} rows={4} /></label><fieldset className={styles.full}><legend>Categories</legend><div className={styles.checks}>{GENRES.map((genre) => <label key={genre}><input type="checkbox" name="categories" value={genre} defaultChecked={data.club.categories.includes(genre)} />{genre}</label>)}</div></fieldset><button className={styles.button} disabled={busy}>Save settings</button>
    </form><form className={styles.inlineForm} onSubmit={upload}><input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required /><button className={styles.button} disabled={busy}>Upload avatar</button></form></section>
    {data.club.type === "book" && <section className={styles.card}><h2 className={styles.sectionTitle}>Reading</h2><form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate({ action: "add-reading", titleId: form.get("titleId") }) }}><select className={styles.select} name="titleId" required><option value="">Choose a title</option>{data.catalog.map((title) => <option value={title.id} key={title.id}>{title.title} — {title.author}</option>)}</select><button className={styles.button} disabled={busy}>Add</button></form>
      <form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate({ action: "set-current", titleId: form.get("titleId") || null }) }}><select className={styles.select} name="titleId" defaultValue={data.club.currentTitleId ?? ""}><option value="">No current reading</option>{data.reading.filter((item) => item.titleId).map((item) => <option value={item.titleId!} key={item.id}>{item.title}</option>)}</select><button className={styles.button} disabled={busy}>Set current</button></form>
      <ul className={styles.list}>{data.reading.map((item) => <li key={item.id}><span>{item.title} · {item.author ?? "Unknown author"}</span><button className={styles.smallButton} disabled={busy} onClick={() => void mutate({ action: "remove-reading", itemId: item.id })}>Remove</button></li>)}</ul></section>}
    <div className={styles.columns}><section className={styles.card}><h2 className={styles.sectionTitle}>Applications</h2>{data.applications.length ? <ul className={styles.list}>{data.applications.map((item) => <li key={item.id}><span>{item.username ?? "Reader"}</span><span><button className={styles.smallButton} disabled={busy} onClick={() => void mutate({ action: "review-application", applicationId: item.id, approve: true })}>Approve</button> <button className={styles.smallButton} disabled={busy} onClick={() => void mutate({ action: "review-application", applicationId: item.id, approve: false })}>Decline</button></span></li>)}</ul> : <p className={styles.muted}>No pending applications.</p>}</section>
      <section className={styles.card}><h2 className={styles.sectionTitle}>Invitations</h2><form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate({ action: "invite", username: form.get("username") }) }}><input className={styles.input} name="username" placeholder="Exact username" required /><button className={styles.button} disabled={busy}>Invite</button></form><ul className={styles.list}>{data.invitations.map((item) => <li key={item.id}><span>{item.username ?? "Reader"}</span><button className={styles.smallButton} disabled={busy} onClick={() => void mutate({ action: "revoke-invitation", invitationId: item.id })}>Revoke</button></li>)}</ul></section></div>
    <section className={styles.card}><h2 className={styles.sectionTitle}>Members</h2><ul className={styles.list}>{data.members.map((member) => <li key={member.id}><span>{member.username ?? "Reader"}</span>{member.id !== data.club.ownerId && <button className={styles.smallButton} disabled={busy} onClick={() => void mutate({ action: "remove-member", profileId: member.id })}>Remove</button>}</li>)}</ul></section>
  </main></div>
}
