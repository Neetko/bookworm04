import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import type { FormEvent } from "react"
import { normalizeCommunitySearch } from "../features/social/search"
import { getCommunityClubs } from "../features/social/social.functions"
import styles from "../features/social/social.module.css"

export const Route = createFileRoute("/community")({
  validateSearch: (search) => normalizeCommunitySearch(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCommunityClubs({ data: deps }),
  head: () => ({ meta: [{ title: "Community | Bookworm" }, { name: "description", content: "Find book clubs and writer clubs on Bookworm." }] }),
  component: CommunityPage,
})

function CommunityPage() {
  const clubs = Route.useLoaderData()
  const filters = Route.useSearch()
  const navigate = useNavigate()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      to: "/community",
      search: normalizeCommunitySearch({
        q: form.get("q"),
        t: form.get("t"),
        genres: form.get("genres"),
      }),
    })
  }
  return <div className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} to="/">BOOKWORM</Link><nav className={styles.nav}><Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }}>Search titles</Link><Link to="/about">About</Link><Link to="/auth">Sign in</Link></nav></header>
    <main className={styles.main}>
      <p className={styles.eyebrow}>Readers together</p><h1 className={styles.title}>Community</h1>
      <p className={styles.lead}>Explore book clubs and writer clubs. Club membership and writing tools will arrive here as the Start migration continues.</p>
      <form className={styles.filters} onSubmit={submit}>
        <input className={styles.input} type="search" name="q" aria-label="Search clubs" placeholder="Search clubs" defaultValue={filters.q} maxLength={100} />
        <select className={styles.select} name="t" aria-label="Club type" defaultValue={filters.t}><option value="">All clubs</option><option value="book">Book clubs</option><option value="writer">Writer clubs</option></select>
        <input className={styles.input} name="genres" aria-label="Genres, comma separated" placeholder="Genres, comma separated" defaultValue={filters.genres} />
        <button className={styles.button} type="submit">Filter</button>
      </form>
      {clubs.length ? <div className={styles.grid}>{clubs.map((club) => <article className={styles.card} key={club.id}>
        <p className={styles.eyebrow}>{club.type === "writer" ? "Writer club" : "Book club"}</p>
        <h2><Link className={styles.link} to="/community/clubs/$id" params={{ id: club.id }} search={{}} preload="intent">{club.name}</Link></h2>
        <p>{club.description || "No description yet."}</p>
        <p className={styles.meta}>{club.joinPolicy?.replaceAll("_", " ")}</p>
        {club.currentReading && <p className={styles.meta}>Currently reading: {club.currentReading}</p>}
        <div className={styles.chips}>{club.categories.map((category: string) => <span className={styles.chip} key={category}>{category}</span>)}</div>
      </article>)}</div> : <p className={styles.empty}>No clubs found.</p>}
    </main>
  </div>
}
