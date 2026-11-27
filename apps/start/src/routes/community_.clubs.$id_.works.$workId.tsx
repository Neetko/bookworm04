import { ThemeToggle } from "../components/theme-toggle"
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { getWriterWork } from "../features/writer/writer.functions"
import styles from "../features/social/social.module.css"

export const Route = createFileRoute("/community_/clubs/$id_/works/$workId")({
  loader: async ({ params }) => {
    const work = await getWriterWork({ data: { clubId: params.id, workId: params.workId } })
    if (!work) throw notFound()
    return work
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Work"} | Bookworm` }] }),
  notFoundComponent: () => <main className={styles.main}><p className={styles.empty}>This work is unavailable.</p></main>,
  component: WriterWorkPage,
})

function WriterWorkPage() {
  const work = Route.useLoaderData()
  const { id, workId } = Route.useParams()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")
  async function toggleLike() {
    setBusy(true); setFeedback("")
    const response = await fetch(`/api/clubs/${encodeURIComponent(id)}/works/${encodeURIComponent(workId)}/like`, { method: "POST" })
    const body = await response.json().catch(() => null) as { error?: string } | null
    setBusy(false)
    if (!response.ok) { setFeedback(body?.error ?? "Could not update like"); return }
    await router.invalidate()
  }
  return <div className={styles.page}><header className={styles.header}><Link className={styles.brand} to="/">BOOKWORM</Link><nav className={styles.nav}><Link to="/community/clubs/$id" params={{ id }} search={{}}>Back to club</Link><Link to="/community" search={{ q: "", t: "", genres: "" }}>Community</Link><ThemeToggle /></nav></header><main className={styles.main}>
    <p className={styles.eyebrow}>Writer club work</p><h1 className={styles.title}>{work.title}</h1><p className={styles.meta}>By {work.authorName} · Updated {new Date(work.updated_at).toLocaleDateString()}</p>
    <div className={styles.actions}><span className={styles.chip}>{work.is_public ? "Published" : "Private draft"}</span>{work.is_completed && <span className={styles.chip}>Complete</span>}<button className={styles.smallButton} disabled={busy || !work.is_public} onClick={() => void toggleLike()}>{work.viewerLiked ? "Unlike" : "Like"} · {work.likesCount}</button>{work.viewerCanEdit && <Link className={styles.button} to="/community/clubs/$id/write" params={{ id }} search={{ work: work.id }}>Edit work</Link>}</div>
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}<article className={`${styles.card} ${styles.writerText}`}>{work.content_text}</article>
  </main></div>
}
