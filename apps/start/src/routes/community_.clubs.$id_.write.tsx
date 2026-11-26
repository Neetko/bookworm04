import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState, type FormEvent } from "react"
import { getWriterWorkspace } from "../features/writer/writer.functions"
import styles from "../features/social/social.module.css"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const Route = createFileRoute("/community_/clubs/$id_/write")({
  validateSearch: (search) => ({ work: typeof search.work === "string" && UUID.test(search.work) ? search.work : "" }),
  loader: ({ params }) => getWriterWorkspace({ data: { clubId: params.id } }),
  head: () => ({ meta: [{ title: "Writer workspace | Bookworm" }] }),
  component: WriterWorkspace,
})

function WriterWorkspace() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const { id } = Route.useParams()
  const navigate = useNavigate({ from: "/community/clubs/$id/write" })
  const selected = data.status === "ok" ? data.works.find((work) => work.id === search.work) : undefined
  const [title, setTitle] = useState(selected?.title ?? "")
  const [content, setContent] = useState(selected?.content_text ?? "")
  const [isPublic, setIsPublic] = useState(Boolean(selected?.is_public))
  const [isCompleted, setIsCompleted] = useState(Boolean(selected?.is_completed))
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    setTitle(selected?.title ?? "")
    setContent(selected?.content_text ?? "")
    setIsPublic(Boolean(selected?.is_public))
    setIsCompleted(Boolean(selected?.is_completed))
    setFeedback("")
  }, [selected?.id])

  if (data.status === "not-found") return <main className={styles.main}><p className={styles.empty}>Writer club not found.</p></main>
  if (data.status === "forbidden") return <main className={styles.main}><p className={styles.empty}>Join this writer club to create or read member works.</p><Link className={styles.link} to="/community/clubs/$id" params={{ id }} search={{}}>Back to club</Link></main>

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback("")
    const response = await fetch(`/api/clubs/${encodeURIComponent(id)}/works`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workId: selected?.id, title, content, isPublic, isCompleted }) })
    const body = await response.json().catch(() => null) as { id?: string; error?: string } | null
    setBusy(false)
    if (!response.ok || !body?.id) { setFeedback(body?.error ?? "Could not save work"); return }
    await navigate({ to: "/community/clubs/$id/works/$workId", params: { id, workId: body.id } })
  }

  return <div className={styles.page}><header className={styles.header}><Link className={styles.brand} to="/">BOOKWORM</Link><nav className={styles.nav}><Link to="/community/clubs/$id" params={{ id }} search={{}}>Back to club</Link><Link to="/community" search={{ q: "", t: "", genres: "" }}>Community</Link></nav></header><main className={styles.main}>
    <p className={styles.eyebrow}>Writer workspace</p><h1 className={styles.title}>Write in {data.club.name}</h1><p className={styles.lead}>Keep a private draft or publish it for fellow club members.</p>
    <div className={styles.columns}><section className={styles.card}><div className={styles.actions}><h2 className={styles.sectionTitle}>Your works</h2><Link className={styles.smallButton} to="/community/clubs/$id/write" params={{ id }} search={{ work: "" }}>New draft</Link></div>
      {data.works.length ? <ul className={styles.list}>{data.works.map((work) => <li key={work.id}><div><Link className={styles.link} to="/community/clubs/$id/write" params={{ id }} search={{ work: work.id }}>{work.title}</Link><div className={styles.meta}>{work.is_public ? "Published" : "Draft"}{work.is_completed ? " · Complete" : ""}</div></div></li>)}</ul> : <p className={styles.muted}>No works yet.</p>}
    </section><section className={styles.card}><h2 className={styles.sectionTitle}>{selected ? "Edit work" : "New work"}</h2><form className={styles.writerForm} onSubmit={save}>
      <label>Title<input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required /></label>
      <label>Writing<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={100000} rows={20} required /></label>
      <div className={styles.checks}><label><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />Publish to club</label><label><input type="checkbox" checked={isCompleted} onChange={(event) => setIsCompleted(event.target.checked)} />Mark complete</label></div>
      <button className={styles.button} disabled={busy}>{busy ? "Saving…" : "Save work"}</button>{feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    </form></section></div>
  </main></div>
}
