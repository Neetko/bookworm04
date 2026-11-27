import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { StaffMfa } from "../features/staff/staff-mfa"
import { getSuggestionAdmin } from "../features/staff/staff.functions"
import { GENRES, type Genre } from "../features/titles/catalog"
import styles from "../features/staff/staff.module.css"

export const Route = createFileRoute("/admin/suggestions")({
  loader: async () => { const data = await getSuggestionAdmin(); if (data.status === "unauthorized") throw redirect({ to: "/auth" }); return data },
  head: () => ({ meta: [{ title: "Review suggestions | Bookworm" }] }),
  component: SuggestionsPage,
})

type Suggestion = Extract<Awaited<ReturnType<typeof getSuggestionAdmin>>, { status: "ok" }>["suggestions"][number]

function SuggestionCard({ item, onDone }: { item: Suggestion; onDone: () => Promise<void> }) {
  const initial = (item.finalGenres.length ? item.finalGenres : item.suggestedGenres.length ? item.suggestedGenres : item.algorithmGenres).filter((genre): genre is Genre => (GENRES as readonly string[]).includes(genre))
  const [genres, setGenres] = useState<Genre[]>(initial)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")
  async function review(action: "approve" | "dismiss") {
    setBusy(true); setFeedback("")
    const response = await fetch("/api/staff/suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suggestionId: item.id, action, genres }) })
    const body = await response.json().catch(() => null) as { error?: string } | null
    setBusy(false); if (!response.ok) { setFeedback(body?.error ?? "Could not review suggestion"); return }
    await onDone()
  }
  return <article className={styles.card}><h2>{item.title ?? "Untitled"}</h2><p className={styles.muted}>By {item.author ?? "Unknown author"} · suggested by {item.suggestedBy ?? "Unknown"}</p><div className={styles.genres}>{GENRES.map((genre) => <label key={genre}><input type="checkbox" checked={genres.includes(genre)} onChange={() => setGenres((current) => current.includes(genre) ? current.filter((value) => value !== genre) : [...current, genre])} />{genre}</label>)}</div><div className={styles.actions}><button className={styles.button} disabled={busy || !genres.length} onClick={() => void review("approve")}>Approve</button><button className={styles.button} disabled={busy} onClick={() => void review("dismiss")}>Dismiss</button><Link to="/titles/$id" params={{ id: item.titleId }}>View title</Link></div>{feedback && <p className={styles.error}>{feedback}</p>}</article>
}

function SuggestionsPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  if (data.status === "mfa") return <Shell><StaffMfa /></Shell>
  if (data.status === "forbidden") return <Shell><p className={styles.error}>Moderator or administrator access required.</p></Shell>
  if (data.status !== "ok") return <Shell><p className={styles.error}>Suggestion review is unavailable.</p></Shell>
  return <Shell><p className={styles.muted}>Staff tools</p><h1 className={styles.title}>Suggestions</h1><p>Review pending title metadata before it becomes public.</p>{data.suggestions.length ? data.suggestions.map((item) => <SuggestionCard key={item.id} item={item} onDone={() => router.invalidate()} />) : <section className={styles.card}><p>No pending suggestions.</p></section>}</Shell>
}

function Shell({ children }: { children: React.ReactNode }) { return <div className={styles.page}><header className={styles.header}><Link to="/">BOOKWORM</Link><nav><Link to="/admin/moderators" search={{ q: "" }}>Moderators</Link></nav></header><main className={styles.main}>{children}</main></div> }
