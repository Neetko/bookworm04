import { ThemeToggle } from "../components/theme-toggle"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { formatDate, formatDateTime } from "../features/date-format"
import { ownProfileQuery } from "../features/profile/queries"
import type { ActivityMetadata } from "../features/profile/validation"
import styles from "../features/profile/profile.module.css"
import { BookCover } from "../components/book-cover"

export const Route = createFileRoute("/profile")({
  loader: async ({ context }) => {
    const result = await context.queryClient.ensureQueryData(ownProfileQuery())
    if (result.status === "unauthorized") throw redirect({ to: "/auth" })
    if (result.status === "not-found") throw redirect({ to: "/onboarding" })
    return result
  },
  head: () => ({ meta: [{ title: "Your profile — Bookworm" }] }),
  component: ProfilePage,
  errorComponent: ProfileError,
})

function ProfileError() {
  return <main className={styles.shell}><h1>Profile</h1><p>Your profile could not be loaded.</p></main>
}

function activityText(type: string, metadata: ActivityMetadata | null, username: string) {
  const actor = (metadata?.actor?.username ?? username) || "Someone"
  const title = metadata?.title?.title ?? "a title"
  const list = metadata?.list?.name ?? "a list"
  const club = metadata?.club?.name ?? "a club"
  const achievement = metadata?.achievement?.name ?? "an achievement"
  switch (type) {
    case "review_posted": return `${actor} reviewed ${title}${metadata?.rating ? ` (${metadata.rating}/10)` : ""}.`
    case "title_finished": return `${actor} finished reading ${title}.`
    case "list_created": return `${actor} created the list “${list}”.`
    case "list_item_added": return list === "Current Reading" ? `${actor} started reading ${title}.` : `${actor} added ${title} to “${list}”.`
    case "club_created": return `${actor} created the club “${club}”.`
    case "club_joined": return `${actor} joined “${club}”.`
    case "achievement_earned": return `${actor} earned ${achievement}.`
    default: return `${actor} did something new.`
  }
}

function ProfilePage() {
  const { data } = useSuspenseQuery(ownProfileQuery())
  const queryClient = useQueryClient()
  const [activeList, setActiveList] = useState("to-read")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState("")
  if (data.status !== "ok") return null

  const selected = data.lists.find((list) => list.type === activeList || list.id === activeList)
    ?? data.lists[0]
  const earnedBadges = 1
    + (data.stats.booksRead >= 10 ? 1 : 0)
    + (data.stats.reviewsWritten >= 20 ? 1 : 0)
    + (data.stats.booksRead >= 100 ? 1 : 0)
    + (data.points.filter((point) => point.points > 0).length >= 5 ? 1 : 0)

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFeedback("")
    const form = new FormData(event.currentTarget)
    try {
      const avatar = form.get("avatar")
      if (avatar instanceof File && avatar.size > 0) {
        if (avatar.size > 2 * 1024 * 1024) throw new Error("Avatar must be 2MB or smaller")
        if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(avatar.type)) {
          throw new Error("Avatar must be a PNG, JPEG, WebP, or GIF image")
        }
      }
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") ?? ""),
          bio: String(form.get("bio") ?? ""),
        }),
      })
      const body = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? "Profile could not be updated")

      if (avatar instanceof File && avatar.size > 0) {
        const avatarForm = new FormData()
        avatarForm.set("file", avatar)
        const avatarResponse = await fetch("/api/profile/avatar", {
          method: "POST",
          body: avatarForm,
        })
        const avatarBody = await avatarResponse.json().catch(() => null) as { error?: string } | null
        if (!avatarResponse.ok) {
          await queryClient.refetchQueries({ queryKey: ["profile", "own"] })
          throw new Error(`Profile details saved, but ${avatarBody?.error?.toLowerCase() ?? "the avatar could not be uploaded"}`)
        }
      }
      await queryClient.refetchQueries({ queryKey: ["profile", "own"] })
      setFeedback("Profile updated.")
      setEditing(false)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Profile could not be updated")
    } finally {
      setSaving(false)
    }
  }

  return <main className={styles.shell}>
    <div className={styles.top}><Link to="/">Bookworm</Link><nav><Link to="/diary" search={{ filterBy: "none", genres: "", author: "", title: "" }}>Diary</Link><Link to="/notifications">Notifications</Link><Link to="/messages" search={{ folder: "inbox", page: 1 }}>Messages</Link><ThemeToggle /></nav></div>
    <section className={styles.hero}>
      {data.profile.avatarUrl ? <img className={styles.avatar} src={data.profile.avatarUrl} alt="" width="104" height="104" /> : <div className={styles.avatarFallback} aria-hidden="true">{data.profile.username.slice(0, 1).toUpperCase() || "U"}</div>}
      <div><div className={styles.heroTop}><div><h1>{data.profile.username || "Anonymous"}</h1><p className={styles.email}>{data.profile.email}</p></div><button className={styles.button} type="button" onClick={() => { setEditing((value) => !value); setFeedback("") }}>Edit profile</button></div><p className={styles.bio}>{data.profile.bio || "No bio yet."}</p><p className={styles.member}>Member since {formatDate(data.profile.createdAt)}</p></div>
    </section>
    {editing && <form className={styles.edit} onSubmit={submitProfile}><label>Username<input name="username" defaultValue={data.profile.username} maxLength={100} required /></label><label>Avatar<span className={styles.fileHelp}>PNG, JPEG, WebP, or GIF; max 2MB.</span><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label><label>Bio<textarea name="bio" defaultValue={data.profile.bio} maxLength={2_000} rows={5} /></label><button className={styles.button} type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>{feedback && <p className={styles.feedback} role="status">{feedback}</p>}</form>}
    {!editing && feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    <section className={styles.stats} aria-label="Reading statistics"><div className={styles.stat}><strong>{data.stats.booksRead}</strong><span>Books read</span></div><div className={styles.stat}><strong>{data.stats.reviewsWritten}</strong><span>Reviews</span></div><div className={styles.stat}><strong>{earnedBadges}</strong><span>Badges earned</span></div></section>
    <div className={styles.layout}>
      <section className={styles.panel}><div className={styles.sectionHeader}><h2>Title lists</h2><Link to="/profile/edit-lists">Manage lists</Link></div><div className={styles.tabs}>{data.lists.map((list) => <button key={list.id} type="button" className={`${styles.tab} ${selected?.id === list.id ? styles.active : ""}`} onClick={() => setActiveList(list.type === "custom" ? list.id : list.type)}>{list.name}</button>)}</div>{selected?.items.length ? <ul className={styles.titles}>{selected.items.map((title) => <li className={styles.title} key={title.titleId}>{title.coverUrl ? <BookCover src={title.coverUrl} alt="" width="42" height="62" sizes="42px" loading="lazy" /> : <span className={styles.coverFallback}>{title.title.slice(0, 1)}</span>}<div><Link to="/titles/$id" params={{ id: title.titleId }} preload="intent"><strong>{title.title}</strong></Link><span>{title.author ?? "Unknown author"}</span></div></li>)}</ul> : <p className={styles.empty}>This list is empty.</p>}</section>
      <div><section className={styles.panel}><h2>Points by genre</h2>{data.points.length ? <ul className={styles.points}>{data.points.map((point) => <li key={point.genre}><span>{point.genre}</span><strong>{point.points}</strong></li>)}</ul> : <p className={styles.empty}>No points yet.</p>}</section><section className={styles.panel}><h2>Recent activity</h2>{data.activity.length ? <ul className={styles.activity}>{data.activity.map((event) => <li key={event.id}><p>{activityText(event.type, event.metadata, data.profile.username)}</p><time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time></li>)}</ul> : <p className={styles.empty}>No recent activity yet.</p>}</section></div>
    </div>
  </main>
}
