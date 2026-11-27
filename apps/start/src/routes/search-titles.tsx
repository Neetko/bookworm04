import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { GENRES, normalizeCatalogSearch, type Genre } from "../features/titles/catalog"
import { getCatalogSearchPage } from "../features/titles/catalog.functions"
import type { ExternalCatalogTitle } from "../features/titles/external.server"
import styles from "../features/titles/catalog.module.css"
import externalStyles from "../features/titles/external-catalog.module.css"
import { BookCover } from "../components/book-cover"

export const Route = createFileRoute("/search-titles")({
  validateSearch: (search) => normalizeCatalogSearch(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCatalogSearchPage({ data: deps }),
  head: () => ({ meta: [
    { title: "Search Titles | Bookworm" },
    { name: "description", content: "Search the Bookworm catalog by title, author, and genre." },
  ] }),
  component: SearchTitlesPage,
})

function SearchTitlesPage() {
  const search = Route.useSearch()
  const { titles, external } = Route.useLoaderData()
  const navigate = useNavigate()
  const active = Boolean(search.q || search.title || search.author || search.genres)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      to: "/search-titles",
      search: normalizeCatalogSearch({
        title: form.get("title"),
        author: form.get("author"),
        genres: form.getAll("genre").join(","),
        includeExternal: form.get("includeExternal") === "1",
      }),
    })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Primary navigation">
          <Link to="/" className={styles.brand}>BOOKWORM</Link>
          <div className={styles.navLinks}>
            <Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }}>Search Titles</Link>
            <Link to="/about">About</Link>
            <Link to="/auth">Sign in</Link>
          </div>
        </nav>
      </header>
      <main className={styles.main}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Find your next read</p>
          <h1>Search Titles</h1>
          <p>Browse the local Bookworm catalog by title, author, or genre.</p>
        </div>

        <form key={`${search.q}:${search.title}:${search.author}:${search.genres}:${search.includeExternal}`} onSubmit={submit} className={styles.searchForm}>
          <div className={styles.fields}>
            <label>Title<input name="title" type="search" maxLength={100} defaultValue={search.title || search.q} placeholder="Search by title" /></label>
            <label>Author<input name="author" type="search" maxLength={100} defaultValue={search.author} placeholder="Search by author" /></label>
          </div>
          <fieldset className={styles.genres}>
            <legend>Genres</legend>
            {GENRES.map((genre) => (
              <label key={genre}>
                <input type="checkbox" name="genre" value={genre} defaultChecked={search.genres.split(",").includes(genre)} />
                {genre}
              </label>
            ))}
          </fieldset>
          <label className={externalStyles.externalToggle}>
            <input type="checkbox" name="includeExternal" value="1" defaultChecked={search.includeExternal} />
            Include Google Books results (sign-in required)
          </label>
          <button className={styles.submit} type="submit">Search catalog</button>
        </form>

        {external.status === "signed-out" ? <p className={styles.notice}>Sign in to search Google Books and submit new titles.</p> : null}
        {external.status === "query-required" ? <p className={styles.notice}>Enter a title or author to search Google Books.</p> : null}
        {external.status === "unavailable" ? <p className={styles.notice}>Google Books is temporarily unavailable. Local results are still shown.</p> : null}
        <div className={styles.resultHeader}>
          <h2>{active ? "Results" : "Browse titles"}</h2>
          <span>{titles.length} {titles.length === 1 ? "title" : "titles"}</span>
        </div>
        {titles.length === 0 ? <p className={styles.empty}>No titles matched this search.</p> : (
          <div className={styles.grid}>
            {titles.map((title) => (
              <Link key={title.id} to="/titles/$id" params={{ id: title.id }} className={styles.card} preload="intent">
                <div className={styles.cover}>
                  {title.coverUrl ? <BookCover src={title.coverUrl} alt="" width="210" height="315" sizes="(max-width: 600px) 42vw, 210px" loading="lazy" decoding="async" /> : <span aria-hidden="true">B</span>}
                </div>
                <div className={styles.cardContent}>
                  <h3>{title.title}</h3>
                  <p>by {title.author}</p>
                  {title.year ? <small>{title.year}</small> : null}
                  {title.genres.length ? <div className={styles.tags}>{title.genres.map((genre) => <span key={genre}>{genre}</span>)}</div> : null}
                </div>
              </Link>
            ))}
          </div>
        )}

        {external.status === "ok" ? <>
          <div className={styles.resultHeader}>
            <h2>Google Books</h2>
            <span>{external.titles.length} external {external.titles.length === 1 ? "title" : "titles"}</span>
          </div>
          {external.titles.length ? <div className={externalStyles.externalGrid}>{external.titles.map((title) => <ExternalTitleCard key={title.volumeId} title={title} />)}</div> : <p className={styles.empty}>No Google Books titles matched this search.</p>}
        </> : null}
      </main>
    </div>
  )
}

function ExternalTitleCard({ title }: { title: ExternalCatalogTitle }) {
  const [genres, setGenres] = useState<Genre[]>([])
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")

  function toggle(genre: Genre) {
    setGenres((current) => current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre])
  }

  async function submit() {
    if (!genres.length) { setFeedback("Choose at least one genre."); return }
    setBusy(true); setFeedback("")
    const response = await fetch("/api/titles/external", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ volumeId: title.volumeId, genres }) })
    const body = await response.json().catch(() => null) as { titleId?: string; error?: string } | null
    setBusy(false)
    if (!response.ok) { setFeedback(body?.error ?? "Could not submit this title."); return }
    setFeedback("Submitted for staff review.")
  }

  return <article className={externalStyles.externalCard}>
    <div className={externalStyles.externalCover}>{title.coverUrl ? <BookCover src={title.coverUrl} alt="" width="150" height="225" sizes="150px" loading="lazy" decoding="async" /> : <span aria-hidden="true">B</span>}</div>
    <div className={externalStyles.externalContent}>
      <h3>{title.title}</h3><p>by {title.author}</p>{title.year ? <small>{title.year}</small> : null}
      {title.localTitleId ? <Link className={externalStyles.submitLink} to="/titles/$id" params={{ id: title.localTitleId }}>View in Bookworm</Link> : <>
        <fieldset className={externalStyles.externalGenres}><legend>Genres for review</legend>{GENRES.map((genre) => <label key={genre}><input type="checkbox" checked={genres.includes(genre)} onChange={() => toggle(genre)} />{genre}</label>)}</fieldset>
        <button type="button" className={styles.submit} disabled={busy} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit to Bookworm"}</button>
        {feedback ? <p className={externalStyles.feedback} role="status">{feedback}</p> : null}
      </>}
    </div>
  </article>
}
