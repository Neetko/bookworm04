import { useEffect, useState, type FormEvent } from "react"
import { ThemeToggle } from "../components/theme-toggle"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { formatDate } from "../features/date-format"
import { getTitleDetail } from "../features/titles/catalog.functions"
import type { CatalogDetail } from "../features/titles/catalog"
import styles from "../features/titles/catalog.module.css"
import { BookCover } from "../components/book-cover"

export const Route = createFileRoute("/titles/$id")({
  loader: ({ params }) => getTitleDetail({ data: { id: params.id } }),
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData ? `${loaderData.title} by ${loaderData.author} | Bookworm` : "Title | Bookworm" },
    { name: "description", content: loaderData?.description?.slice(0, 160) || "Explore a title on Bookworm." },
  ] }),
  component: TitleDetailPage,
})

async function updateReading(titleId: string, payload: unknown) {
  const response = await fetch(`/api/titles/${encodeURIComponent(titleId)}/reading`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(result.error || "Could not update this title")
}

function ReadStatusButton({ title }: { title: CatalogDetail }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")

  if (!title.viewer.signedIn) {
    return <Link to="/auth" className={`${styles.actionButton} ${styles.actionSecondary}`}>Sign in to mark as read</Link>
  }

  async function toggle() {
    setPending(true)
    setMessage("")
    try {
      await updateReading(title.id, { action: "set-read", isRead: !title.viewer.isRead })
      setMessage(title.viewer.isRead ? "Marked as unread." : "Marked as read.")
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this title")
    } finally {
      setPending(false)
    }
  }

  return <div className={styles.actionWithStatus}>
    <button
      type="button"
      className={`${styles.actionButton} ${title.viewer.isRead ? styles.actionComplete : styles.actionPrimary}`}
      disabled={pending}
      onClick={toggle}
    >
      <span aria-hidden="true">{title.viewer.isRead ? "✓" : "○"}</span>
      {pending ? "Saving…" : title.viewer.isRead ? "Read" : "Mark as read"}
    </button>
    {message ? <span className={styles.actionMessage} role="status">{message}</span> : null}
  </div>
}

function ProgressDialog({ title }: { title: CatalogDetail }) {
  const router = useRouter()
  const saved = title.viewer.progress
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"pages" | "audiobook">(saved?.mode ?? "pages")
  const [currentPage, setCurrentPage] = useState(saved?.currentPage ?? 0)
  const [totalPages, setTotalPages] = useState(saved?.totalPages ?? 300)
  const [minutesListened, setMinutesListened] = useState(saved?.minutesListened ?? 0)
  const [totalMinutes, setTotalMinutes] = useState(saved?.totalMinutes ?? 600)
  const [noteText, setNoteText] = useState(title.viewer.todayNote)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, pending])

  if (!title.viewer.signedIn) {
    return <Link to="/auth" className={`${styles.actionButton} ${styles.actionSecondary}`}>Sign in to track</Link>
  }

  function showDialog() {
    setMode(saved?.mode ?? "pages")
    setCurrentPage(saved?.currentPage ?? 0)
    setTotalPages(saved?.totalPages ?? 300)
    setMinutesListened(saved?.minutesListened ?? 0)
    setTotalMinutes(saved?.totalMinutes ?? 600)
    setNoteText(title.viewer.todayNote)
    setError("")
    setMessage("")
    setOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const progress = mode === "pages"
        ? { mode, currentPage, totalPages }
        : { mode, minutesListened, totalMinutes }
      await updateReading(title.id, { action: "track-progress", progress, noteText })
      setOpen(false)
      setMessage("Progress saved.")
      await router.invalidate()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save progress")
    } finally {
      setPending(false)
    }
  }

  const invalid = mode === "pages"
    ? totalPages < 1 || currentPage < 0 || currentPage > totalPages
    : totalMinutes < 1 || minutesListened < 0 || minutesListened > totalMinutes

  return <div className={styles.actionWithStatus}>
    <button type="button" className={`${styles.actionButton} ${styles.actionSecondary}`} onClick={showDialog}>
      <span aria-hidden="true">◫</span>
      Track progress
    </button>
    {saved ? <span className={styles.progressSummary}>{saved.percent}% complete</span> : null}
    {message ? <span className={styles.actionMessage} role="status">{message}</span> : null}
    {open ? <div className={styles.modalBackdrop} onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) setOpen(false)
    }}>
      <section className={styles.progressDialog} role="dialog" aria-modal="true" aria-labelledby="progress-title">
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>Reading diary</p>
            <h2 id="progress-title">Track progress</h2>
            <p>{title.title}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} disabled={pending} aria-label="Close">×</button>
        </div>
        <form onSubmit={submit} className={styles.progressForm}>
          <div className={styles.modePicker} role="group" aria-label="Reading format">
            <button type="button" className={mode === "pages" ? styles.modeActive : ""} onClick={() => setMode("pages")}>Pages</button>
            <button type="button" className={mode === "audiobook" ? styles.modeActive : ""} onClick={() => setMode("audiobook")}>Audiobook</button>
          </div>
          {mode === "pages" ? <div className={styles.progressFields}>
            <label>Current page<input type="number" min="0" max={totalPages || undefined} value={currentPage} onChange={(event) => setCurrentPage(Number(event.target.value))} required /></label>
            <label>Total pages<input type="number" min="1" value={totalPages} onChange={(event) => setTotalPages(Number(event.target.value))} required /></label>
          </div> : <div className={styles.progressFields}>
            <label>Minutes listened<input type="number" min="0" max={totalMinutes || undefined} value={minutesListened} onChange={(event) => setMinutesListened(Number(event.target.value))} required /></label>
            <label>Total minutes<input type="number" min="1" value={totalMinutes} onChange={(event) => setTotalMinutes(Number(event.target.value))} required /></label>
          </div>}
          <label className={styles.noteField}>Diary note<textarea value={noteText} maxLength={10_000} onChange={(event) => setNoteText(event.target.value)} placeholder="Add a note about this reading session…" /></label>
          {error ? <p className={styles.formError} role="alert">{error}</p> : null}
          <div className={styles.dialogActions}>
            <button type="button" className={`${styles.actionButton} ${styles.actionSecondary}`} onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
            <button type="submit" className={`${styles.actionButton} ${styles.actionPrimary}`} disabled={pending || invalid}>{pending ? "Saving…" : "Save progress"}</button>
          </div>
        </form>
      </section>
    </div> : null}
  </div>
}

function TitleActions({ title }: { title: CatalogDetail }) {
  return <div className={styles.titleActions}>
    <div className={styles.readingActions}>
      <ReadStatusButton title={title} />
      <ProgressDialog title={title} />
    </div>
    <div className={styles.shopActions}>
      <span>Shop</span>
      <a className={`${styles.actionButton} ${styles.actionSecondary}`} href={title.shop.amazonUrl} target="_blank" rel="noopener noreferrer">
        <span aria-hidden="true">▣</span> Amazon <small aria-hidden="true">↗</small>
      </a>
      <a className={`${styles.actionButton} ${styles.actionSecondary}`} href={title.shop.audibleUrl} target="_blank" rel="noopener noreferrer">
        <span aria-hidden="true">◖</span> Audible <small aria-hidden="true">↗</small>
      </a>
    </div>
  </div>
}

function TitleDetailPage() {
  const title = Route.useLoaderData()
  const average = title.reviews.length
    ? (title.reviews.reduce((sum, review) => sum + review.rating, 0) / title.reviews.length).toFixed(1)
    : null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Primary navigation">
          <Link to="/" className={styles.brand}>BOOKWORM</Link>
          <div className={styles.navLinks}>
            <Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }}>Search Titles</Link>
            <Link to="/about">About</Link>
            <Link to={title.viewer.signedIn ? "/profile" : "/auth"}>{title.viewer.signedIn ? "Profile" : "Sign in"}</Link>
          </div>
        <ThemeToggle /></nav>
      </header>
      <main className={styles.main}>
        <Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }} className={styles.back}>← Back to catalog</Link>
        <div className={styles.detail}>
          <div className={styles.detailCover}>
            {title.coverUrl ? <BookCover src={title.coverUrl} alt={`Cover of ${title.title}`} width="260" height="390" sizes="(max-width: 700px) 60vw, 260px" decoding="async" /> : <span aria-hidden="true">B</span>}
          </div>
          <div className={styles.detailText}>
            <p className={styles.eyebrow}>Bookworm title</p>
            <h1>{title.title}</h1>
            <p className={styles.author}>by {title.author}</p>
            <div className={styles.detailMeta}>
              {title.year ? <span>Published {title.year}</span> : null}
              {title.isbn ? <span>ISBN {title.isbn}</span> : null}
              {average ? <span>{average}/10 · {title.reviews.length} reviews</span> : <span>No reviews yet</span>}
            </div>
            {title.genres.length ? <div className={styles.tags}>{title.genres.map((genre) => <span key={genre} data-genre={genre}>{genre}</span>)}</div> : null}
            {title.description ? <p className={styles.description}>{title.description}</p> : null}
            <TitleActions title={title} />
          </div>
        </div>
        <section className={styles.reviews}>
          <div className={styles.resultHeader}><h2>Reader reviews</h2><span>{title.reviews.length}</span></div>
          {title.reviews.length === 0 ? <p className={styles.empty}>No reviews yet.</p> : (
            <div className={styles.reviewGrid}>
              {title.reviews.map((review) => (
                <article className={styles.review} key={review.id}>
                  <div><strong>{review.username ?? "Reader"}</strong><span>{review.rating}/10</span></div>
                  {review.text ? <p>{review.text}</p> : null}
                  <small>{formatDate(review.createdAt)}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
