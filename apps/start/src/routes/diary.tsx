import { ThemeToggle } from "../components/theme-toggle"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { formatDate } from "../features/date-format"
import { diaryQuery } from "../features/diary/queries"
import { normalizeDiarySearch } from "../features/diary/validation"
import { GENRES } from "../features/titles/catalog"
import styles from "../features/diary/diary.module.css"
import { BookCover } from "../components/book-cover"

export const Route = createFileRoute("/diary")({
  validateSearch: normalizeDiarySearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const result = await context.queryClient.ensureQueryData(diaryQuery(deps))
    if (result.status === "unauthorized") throw redirect({ to: "/auth" })
    return result
  },
  head: () => ({ meta: [{ title: "Reading diary — Bookworm" }] }),
  component: DiaryPage,
  errorComponent: () => <main className={styles.shell}><h1>Reading diary</h1><p>Your diary could not be loaded.</p></main>,
})

function progressCopy(entry: { progressMode: "pages" | "audiobook"; currentPage: number | null; totalPages: number | null; minutesListened: number | null; totalMinutes: number | null }) {
  return entry.progressMode === "audiobook"
    ? `${entry.minutesListened ?? 0} / ${entry.totalMinutes ?? 0} min`
    : `${entry.currentPage ?? 0} / ${entry.totalPages ?? 0} pages`
}

function DiaryPage() {
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(diaryQuery(search))
  const navigate = useNavigate({ from: "/diary" })
  const queryClient = useQueryClient()
  const [composing, setComposing] = useState(false)
  const [filterMode, setFilterMode] = useState(search.filterBy)
  const [mode, setMode] = useState<"pages" | "audiobook">("pages")
  const [selectedTitleId, setSelectedTitleId] = useState("")
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(300)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState("")
  if (data.status !== "ok") return null
  const diary = data

  const grouped = (() => {
    const result = new Map<string, typeof diary.entries>()
    for (const entry of diary.entries) {
      const currentEntries = result.get(entry.entryDate) ?? []
      currentEntries.push(entry)
      result.set(entry.entryDate, currentEntries)
    }
    return [...result.entries()]
  })()

  function chooseTitle(id: string) {
    setSelectedTitleId(id)
    const option = diary.titleOptions.find((item) => item.id === id)
    const progress = option?.progress
    if (progress?.totalMinutes != null || progress?.minutesListened != null) {
      setMode("audiobook")
      setCurrent(progress.minutesListened ?? 0)
      setTotal(progress.totalMinutes ?? 600)
    } else {
      setMode("pages")
      setCurrent(progress?.currentPage ?? 0)
      setTotal(progress?.totalPages ?? 300)
    }
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTitleId) return
    setSaving(true)
    setFeedback("")
    const form = new FormData(event.currentTarget)
    const progress = mode === "pages"
      ? { mode, currentPage: current, totalPages: total }
      : { mode, minutesListened: current, totalMinutes: total }
    try {
      const response = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: selectedTitleId, progress, noteText: String(form.get("noteText") ?? "") }),
      })
      const body = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? "Diary entry could not be saved")
      await queryClient.invalidateQueries({ queryKey: ["diary"] })
      setComposing(false)
      setSelectedTitleId("")
      setFeedback("Diary entry saved.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Diary entry could not be saved")
    } finally {
      setSaving(false)
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      search: normalizeDiarySearch({
        filterBy: form.get("filterBy"),
        genres: form.get("genres"),
        author: form.get("value"),
        title: form.get("value"),
      }),
    })
  }

  return <main className={styles.shell}>
    <div className={styles.top}><Link to="/">Bookworm</Link><nav><Link to="/profile">Profile</Link><Link to="/messages" search={{ folder: "inbox", page: 1 }}>Messages</Link><ThemeToggle /></nav></div>
    <div className={styles.heading}><div><h1>Reading diary</h1><p>Your private record of pages, listening, and notes.</p></div><button className={styles.button} type="button" onClick={() => { setComposing((value) => !value); setFeedback("") }} disabled={!data.titleOptions.length}>New entry</button></div>
    {composing && <form className={styles.composer} onSubmit={saveEntry}>
      <label>Title<select value={selectedTitleId} onChange={(event) => chooseTitle(event.target.value)} required><option value="">Choose from Planned or Current Reading</option>{data.titleOptions.map((title) => <option key={title.id} value={title.id}>{title.title} — {title.author}</option>)}</select></label>
      <label>Format<select value={mode} onChange={(event) => { setMode(event.target.value as "pages" | "audiobook"); setCurrent(0); setTotal(event.target.value === "pages" ? 300 : 600) }}><option value="pages">Pages</option><option value="audiobook">Audiobook</option></select></label>
      <label>{mode === "pages" ? "Current / total pages" : "Listened / total minutes"}<span className={styles.actions}><input type="number" min="0" max="1000000" value={current} onChange={(event) => setCurrent(Number(event.target.value))} required /><input type="number" min="1" max="1000000" value={total} onChange={(event) => setTotal(Number(event.target.value))} required /></span></label>
      <label>Note (optional)<textarea name="noteText" maxLength={10_000} rows={5} /></label>
      <div className={styles.actions}><button className={styles.button} type="submit" disabled={saving || !selectedTitleId || current < 0 || total < 1 || current > total}>{saving ? "Saving…" : "Save entry"}</button><button className={styles.button} type="button" onClick={() => setComposing(false)} disabled={saving}>Cancel</button></div>
    </form>}
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    <form className={styles.filters} onSubmit={applyFilters}>
      <label>Filter by<select name="filterBy" value={filterMode} onChange={(event) => setFilterMode(event.target.value as typeof filterMode)}><option value="none">All entries</option><option value="genre">Genre</option><option value="author">Author</option><option value="title">Title</option></select></label>
      <label>Value{filterMode === "genre" ? <select name="genres" defaultValue={search.genres}><option value="">Any genre</option>{GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select> : <input name="value" list={filterMode === "author" ? "diary-authors" : "diary-titles"} defaultValue={filterMode === "author" ? search.author : search.title} disabled={filterMode === "none"} />}</label>
      <button className={styles.button} type="submit">Apply</button>
      <datalist id="diary-authors">{data.authors.map((author) => <option key={author} value={author} />)}</datalist><datalist id="diary-titles">{data.titles.map((title) => <option key={title} value={title} />)}</datalist>
    </form>
    {!data.entries.length ? <div className={styles.empty}>{data.allEntries.length ? "No entries match this filter." : "No entries yet. Add a title to Planned Reading, then record your progress."}</div> : <div className={styles.timeline}>{grouped.map(([date, entries]) => <section className={styles.day} key={date}><h2>{formatDate(date)}</h2><div className={styles.dayEntries}>{entries.map((entry) => <Link className={styles.entry} key={entry.id} to="/diary/$id" params={{ id: entry.id }} search={search} preload="intent">{entry.coverUrl ? <BookCover className={styles.cover} src={entry.coverUrl} alt="" width="82" height="142" sizes="82px" loading="lazy" /> : <span className={`${styles.cover} ${styles.coverFallback}`}>{entry.title.slice(0, 1)}</span>}<div className={styles.entryBody}><div className={styles.entryTop}><h3>{entry.title}</h3>{entry.isCompleted && <span className={styles.complete}>Finished</span>}</div><p className={styles.author}>{entry.author}</p><div className={styles.progress}><span style={{ width: `${entry.progressPercent}%` }} /></div><div className={styles.progressMeta}><span>{progressCopy(entry)}</span><strong>{entry.progressPercent}%</strong></div>{entry.noteText && <p className={styles.note}>{entry.noteText}</p>}</div></Link>)}</div></section>)}</div>}
  </main>
}
