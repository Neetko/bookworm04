import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { getPublicClub } from "../features/social/social.functions"
import styles from "../features/social/social.module.css"

export const Route = createFileRoute("/community_/clubs/$id")({
  loader: async ({ params }) => {
    const club = await getPublicClub({ data: { id: params.id } })
    if (!club) throw notFound()
    return club
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.name ?? "Club"} | Bookworm` }, { name: "description", content: loaderData?.description ?? "A Bookworm community club." }] }),
  notFoundComponent: () => <p className={styles.empty}>Club not found.</p>,
  component: ClubPage,
})

function ClubPage() {
  const club = Route.useLoaderData()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")
  async function membership(action: "join" | "apply" | "withdraw" | "leave") {
    setBusy(true); setFeedback("")
    const response = await fetch(`/api/clubs/${encodeURIComponent(club.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
    const body = await response.json().catch(() => null) as { error?: string } | null
    setBusy(false); if (!response.ok) { setFeedback(body?.error ?? "Could not update membership"); return }
    await router.invalidate(); setFeedback("Membership updated.")
  }
  return <div className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} to="/">BOOKWORM</Link><nav className={styles.nav}><Link to="/community" search={{ q: "", t: "", genres: "" }}>Community</Link><Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }}>Search titles</Link><Link to="/auth">Sign in</Link></nav></header>
    <main className={styles.main}>
      <p className={styles.eyebrow}>{club.type === "writer" ? "Writer club" : "Book club"}</p>
      <h1 className={styles.title}>{club.name}</h1>
      <p className={styles.meta}>{club.joinPolicy.replaceAll("_", " ")}{club.owner?.username ? ` · Owned by ${club.owner.username}` : ""}</p>
      <p className={styles.lead}>{club.description || "No description yet."}</p>
      <div className={styles.chips}>{club.categories.map((category: string) => <span className={styles.chip} key={category}>{category}</span>)}</div>
      <div className={styles.actions}>{club.viewer.isOwner ? <Link className={styles.button} to="/community/clubs/$id/manage" params={{ id: club.id }}>Manage club</Link> : !club.viewer.signedIn ? <Link className={styles.button} to="/auth">Sign in to join</Link> : club.viewer.isMember ? <button className={styles.button} disabled={busy} onClick={() => void membership("leave")}>Leave club</button> : club.viewer.hasPendingApplication ? <button className={styles.button} disabled={busy} onClick={() => void membership("withdraw")}>Withdraw application</button> : club.joinPolicy === "open" ? <button className={styles.button} disabled={busy} onClick={() => void membership("join")}>Join club</button> : club.joinPolicy === "approval_required" ? <button className={styles.button} disabled={busy} onClick={() => void membership("apply")}>Apply to join</button> : <span className={styles.muted}>Invitation required</span>}{club.type === "writer" && club.viewer.isMember && <Link className={styles.button} to="/community/clubs/$id/write" params={{ id: club.id }} search={{ work: "" }}>Write</Link>}</div>{feedback && <p className={styles.feedback} role="status">{feedback}</p>}
      <div className={styles.columns}>
        <section className={styles.card}><h2 className={styles.sectionTitle}>{club.type === "writer" ? "Written works" : "Planned reading"}</h2>
          {club.type === "writer" ? club.viewer.isMember ? club.writerWorks.length ? <ul className={styles.list}>{club.writerWorks.map((work) => <li key={work.id}><div><Link className={styles.link} to="/community/clubs/$id/works/$workId" params={{ id: club.id, workId: work.id }} preload="intent">{work.title}</Link><div className={styles.meta}>By {work.authorName}{work.isCompleted ? " · Complete" : ""}</div>{work.excerpt && <p>{work.excerpt}</p>}</div></li>)}</ul> : <p className={styles.muted}>No published works yet.</p> : <p className={styles.muted}>Join this club to read member works.</p> : club.reading.length ? <ul className={styles.list}>{club.reading.map((item) => <li key={item.id}>{item.coverUrl && <img className={styles.cover} src={item.coverUrl} alt="" width="40" height="58" loading="lazy" decoding="async" />}<div>{item.titleId ? <Link className={styles.link} to="/titles/$id" params={{ id: item.titleId }} preload="intent">{item.title}</Link> : item.title}<div className={styles.meta}>{item.author}</div></div></li>)}</ul> : <p className={styles.muted}>No titles selected yet.</p>}
        </section>
        <section className={styles.card}><h2 className={styles.sectionTitle}>Members</h2><p className={styles.meta}>{club.memberCount} total{club.memberCount > club.members.length ? ` · showing ${club.members.length}` : ""}</p>
          <ul className={styles.list}>{club.members.map((member: { id: string; username: string | null; avatarUrl: string | null }) => <li key={member.id}>{member.avatarUrl && <img className={styles.avatar} src={member.avatarUrl} alt="" width="56" height="56" loading="lazy" decoding="async" />}<Link className={styles.link} to="/users/$username" params={{ username: member.id }} preload="intent">{member.username ?? "Unnamed"}</Link></li>)}</ul>
        </section>
      </div>
    </main>
  </div>
}
