import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { normalizeCommunitySearch } from "../features/social/search"
import { getCommunityClubs } from "../features/social/social.functions"
import { GENRES } from "../features/titles/catalog"
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
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState("")
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
  async function createClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setFeedback("")
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.get("type"),
        name: form.get("name"),
        description: form.get("description"),
        categories: form.getAll("categories"),
      }),
    })
    const body = await response.json().catch(() => null) as { id?: string; error?: string } | null
    setCreating(false)
    if (!response.ok || !body?.id) { setFeedback(body?.error ?? "Could not create club"); return }
    void navigate({ to: "/community/clubs/$id/manage", params: { id: body.id } })
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
      <details className={styles.card}><summary className={styles.link}>Create a club</summary><form className={styles.form} onSubmit={createClub}>
        <label>Type<select className={styles.select} name="type"><option value="book">Book club</option><option value="writer">Writer club</option></select></label>
        <label>Name<input className={styles.input} name="name" maxLength={200} required /></label>
        <label className={styles.full}>Description<textarea name="description" maxLength={5000} rows={4} /></label>
        <fieldset className={styles.full}><legend>Categories</legend><div className={styles.checks}>{GENRES.map((genre) => <label key={genre}><input type="checkbox" name="categories" value={genre} />{genre}</label>)}</div></fieldset>
        <button className={styles.button} type="submit" disabled={creating}>{creating ? "Creating…" : "Create club"}</button>{feedback && <p className={styles.feedback} role="status">{feedback}</p>}
      </form></details>
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
