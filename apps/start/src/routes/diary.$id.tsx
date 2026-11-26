import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { formatDate } from "../features/date-format"
import { diaryQuery } from "../features/diary/queries"
import { normalizeDiarySearch } from "../features/diary/validation"
import styles from "../features/diary/diary.module.css"
import { BookCover } from "../components/book-cover"

export const Route = createFileRoute("/diary/$id")({
  validateSearch: normalizeDiarySearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, context, deps }) => {
    const result = await context.queryClient.ensureQueryData(diaryQuery(deps))
    if (result.status === "unauthorized") throw redirect({ to: "/auth" })
    if (!result.allEntries.some((entry) => entry.id === params.id)) throw notFound()
    return result
  },
  head: ({ params }) => ({ meta: [{ title: `Diary entry ${params.id.slice(0, 8)} — Bookworm` }] }),
  component: DiaryDetailPage,
  notFoundComponent: () => <main className={styles.shell}><h1>Diary entry not found</h1><Link to="/diary" search={normalizeDiarySearch({})}>Back to diary</Link></main>,
})

function DiaryDetailPage() {
  const search = Route.useSearch()
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(diaryQuery(search))
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState("")
  if (data.status !== "ok") return null
  const entry = data.allEntries.find((item) => item.id === id)
  if (!entry) return null
  const entryId = entry.id
  const index = data.entries.findIndex((item) => item.id === id)
  const previous = index > 0 ? data.entries[index - 1] : null
  const next = index >= 0 && index < data.entries.length - 1 ? data.entries[index + 1] : null

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFeedback("")
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/diary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, noteText: String(form.get("noteText") ?? "") }),
      })
      const body = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? "Diary note could not be updated")
      await queryClient.invalidateQueries({ queryKey: ["diary"] })
      setEditing(false)
      setFeedback("Diary note updated.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Diary note could not be updated")
    } finally {
      setSaving(false)
    }
  }

  const measure = entry.progressMode === "audiobook"
    ? `${entry.minutesListened ?? 0} / ${entry.totalMinutes ?? 0} min`
    : `${entry.currentPage ?? 0} / ${entry.totalPages ?? 0} pages`
  return <main className={styles.shell}>
    <div className={styles.top}><Link to="/">Bookworm</Link><nav><Link to="/profile">Profile</Link><Link to="/messages" search={{ folder: "inbox", page: 1 }}>Messages</Link></nav></div>
    <article className={styles.detail}>
      <div className={styles.backRow}><Link to="/diary" search={search}>← Back to diary</Link><div className={styles.navLinks}>{previous && <Link to="/diary/$id" params={{ id: previous.id }} search={search}>← Previous</Link>}{next && <Link to="/diary/$id" params={{ id: next.id }} search={search}>Next →</Link>}</div></div>
      <div className={styles.detailGrid}>{entry.coverUrl ? <BookCover className={styles.detailCover} src={entry.coverUrl} alt="" width="150" height="225" sizes="150px" /> : <span className={`${styles.detailCover} ${styles.coverFallback}`}>{entry.title.slice(0, 1)}</span>}<div><p className={styles.date}>{formatDate(entry.entryDate)}</p><h1>{entry.title}</h1><p className={styles.author}>{entry.author}</p>{entry.genres.length > 0 && <div className={styles.genres}>{entry.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>}<div className={styles.detailProgress}><div className={styles.progress}><span style={{ width: `${entry.progressPercent}%` }} /></div><div className={styles.progressMeta}><span>{measure}</span><strong>{entry.progressPercent}%</strong></div></div></div></div>
      <div className={styles.detailNote}>{entry.noteText || "No note for this entry."}</div>
      <div className={styles.actions}><button className={styles.button} type="button" onClick={() => { setEditing((value) => !value); setFeedback("") }}>{editing ? "Close editor" : "Edit note"}</button></div>
      {editing && <form className={styles.editor} onSubmit={saveNote}><label>Diary note<textarea name="noteText" defaultValue={entry.noteText} maxLength={10_000} rows={8} /></label><div className={styles.actions}><button className={styles.button} type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button><button className={styles.button} type="button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button></div></form>}
      {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    </article>
  </main>
}
