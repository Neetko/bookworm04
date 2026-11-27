import { ThemeToggle } from "../components/theme-toggle"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { getPublicUser } from "../features/social/social.functions"
import styles from "../features/social/social.module.css"
import { BookCover } from "../components/book-cover"

export const Route = createFileRoute("/users/$username")({
  loader: async ({ params }) => {
    const user = await getPublicUser({ data: { id: params.username } })
    if (!user) throw notFound()
    return user
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.profile.username ?? "Reader"} | Bookworm` }, { name: "description", content: loaderData?.profile.bio ?? "A Bookworm reader profile." }] }),
  notFoundComponent: () => <p className={styles.empty}>User not found.</p>,
  component: UserPage,
})

function UserPage() {
  const { profile, points, readTitles, viewer } = Route.useLoaderData()
  const [following, setFollowing] = useState(viewer.isFollowing)
  const [friend, setFriend] = useState(viewer.isFriend)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")
  async function toggleFollow() {
    setBusy(true); setFeedback("")
    const response = await fetch(`/api/users/${encodeURIComponent(profile.id)}/follow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: following ? "unfollow" : "follow" }) })
    const body = await response.json().catch(() => null) as { isFollowing?: boolean; isFriend?: boolean; error?: string } | null
    setBusy(false)
    if (!response.ok) { setFeedback(body?.error ?? "Could not update follow"); return }
    setFollowing(Boolean(body?.isFollowing)); setFriend(Boolean(body?.isFriend))
  }
  return <div className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} to="/">BOOKWORM</Link><nav className={styles.nav}><Link to="/community" search={{ q: "", t: "", genres: "" }}>Community</Link><Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }}>Search titles</Link><Link to="/auth">Sign in</Link><ThemeToggle /></nav></header>
    <main className={styles.main}>
      <p className={styles.eyebrow}>Reader profile</p>
      <div className={styles.profile}>{profile.avatarUrl && <img className={styles.avatar} src={profile.avatarUrl} alt="" width="80" height="80" decoding="async" />}<div><h1 className={styles.title}>{profile.username ?? "Anonymous"}</h1>{profile.bio && <p className={styles.lead}>{profile.bio}</p>}</div>{viewer.signedIn && !viewer.isSelf && <button className={styles.button} disabled={busy} onClick={() => void toggleFollow()}>{friend ? "Friends" : following ? "Following" : "Follow"}</button>}</div>{feedback && <p className={styles.feedback} role="status">{feedback}</p>}
      <div className={styles.columns}>
        <section className={styles.card}><h2 className={styles.sectionTitle}>Read titles</h2>{readTitles.length ? <ul className={styles.list}>{readTitles.map((title) => <li key={title.id}>{title.coverUrl && <BookCover className={styles.cover} src={title.coverUrl} alt="" width="40" height="58" sizes="40px" loading="lazy" decoding="async" />}<div><Link className={styles.link} to="/titles/$id" params={{ id: title.id }} preload="intent">{title.title}</Link><div className={styles.meta}>{title.author ?? "Unknown author"}</div></div></li>)}</ul> : <p className={styles.muted}>No titles marked as read yet.</p>}</section>
        <section className={styles.card}><h2 className={styles.sectionTitle}>Points by genre</h2>{points.length ? <ul className={styles.list}>{points.map((point) => <li key={point.genre}><span>{point.genre}</span><strong>{point.points ?? 0}</strong></li>)}</ul> : <p className={styles.muted}>No points yet.</p>}</section>
      </div>
    </main>
  </div>
}
