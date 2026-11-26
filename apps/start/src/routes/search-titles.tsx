import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import type { FormEvent } from "react"
import { GENRES, normalizeCatalogSearch } from "../features/titles/catalog"
import { getCatalogTitles } from "../features/titles/catalog.functions"
import styles from "../features/titles/catalog.module.css"

export const Route = createFileRoute("/search-titles")({
  validateSearch: (search) => normalizeCatalogSearch(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCatalogTitles({ data: deps }),
  head: () => ({ meta: [
    { title: "Search Titles | Bookworm" },
    { name: "description", content: "Search the Bookworm catalog by title, author, and genre." },
  ] }),
  component: SearchTitlesPage,
})

function SearchTitlesPage() {
  const search = Route.useSearch()
  const titles = Route.useLoaderData()
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

        <form key={`${search.q}:${search.title}:${search.author}:${search.genres}`} onSubmit={submit} className={styles.searchForm}>
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
          <button className={styles.submit} type="submit">Search catalog</button>
        </form>

        {search.includeExternal ? <p className={styles.notice}>External source search will return when its ingestion controls move to Start. Local catalog results are shown below.</p> : null}
        <div className={styles.resultHeader}>
          <h2>{active ? "Results" : "Browse titles"}</h2>
          <span>{titles.length} {titles.length === 1 ? "title" : "titles"}</span>
        </div>
        {titles.length === 0 ? <p className={styles.empty}>No titles matched this search.</p> : (
          <div className={styles.grid}>
            {titles.map((title) => (
              <Link key={title.id} to="/titles/$id" params={{ id: title.id }} className={styles.card} preload="intent">
                <div className={styles.cover}>
                  {title.coverUrl ? <img src={title.coverUrl} alt="" width="210" height="315" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span aria-hidden="true">B</span>}
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
      </main>
    </div>
  )
}
