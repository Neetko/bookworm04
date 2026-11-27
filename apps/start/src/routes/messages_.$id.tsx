import { ThemeToggle } from "../components/theme-toggle"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router"
import { useEffect, useState, type FormEvent } from "react"
import { formatDateTime } from "../features/date-format"
import { messageDetailQuery } from "../features/messages/queries"
import type { MessageFolder } from "../features/messages/read.functions"
import styles from "../features/messages/messages.module.css"

function folderFromSearch(value: unknown): MessageFolder {
  return value === "sent" || value === "drafts" ? value : "inbox"
}

export const Route = createFileRoute("/messages_/$id")({
  validateSearch: (search) => ({ folder: folderFromSearch(search.folder), page: Number.isSafeInteger(Number(search.page)) && Number(search.page) > 0 ? Number(search.page) : 1 }),
  loader: async ({ params, context }) => {
    const result = await context.queryClient.ensureQueryData(messageDetailQuery(params.id))
    if (result.status === "unauthorized") throw redirect({ to: "/auth" })
    if (result.status === "not-found") throw notFound()
    return result
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.subject} — Bookworm` : "Message — Bookworm" }] }),
  component: MessageDetailPage,
  notFoundComponent: () => <main className={styles.shell}><h1>Message not found</h1><Link to="/messages" search={{ folder: "inbox", page: 1 }}>Back to messages</Link></main>,
  errorComponent: () => <main className={styles.shell}><h1>Message unavailable</h1><Link to="/messages" search={{ folder: "inbox", page: 1 }}>Back to messages</Link></main>,
})

function plainText(html: string) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+\n/g, "\n").trim()
}

function MessageDetailPage() {
  const message = Route.useLoaderData()
  const { id } = Route.useParams()
  const { folder, page } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")
  useEffect(() => {
    if (message.type !== "inbox" || message.read) return
    void fetch(`/api/messages/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isRead: true }) }).then(() => queryClient.invalidateQueries({ queryKey: ["messages"] }))
  }, [id, message.read, message.type, queryClient])

  async function remove() {
    if (!window.confirm("Delete this message?")) return
    setBusy(true); setFeedback("")
    const response = await fetch(`/api/messages/${encodeURIComponent(id)}`, { method: "DELETE" })
    const body = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) { setBusy(false); setFeedback(body?.error ?? "Could not delete message"); return }
    await queryClient.invalidateQueries({ queryKey: ["messages"] })
    await navigate({ to: "/messages", search: { folder, page } })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback("")
    const form = new FormData(event.currentTarget)
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const status = submitter?.value === "draft" ? "draft" : "sent"
    const payload = { title: String(form.get("title") ?? ""), recipient: String(form.get("recipient") ?? ""), body: String(form.get("body") ?? ""), status, ...(message.type === "draft" ? {} : { replyTo: message.id }) }
    const response = await fetch(message.type === "draft" ? `/api/messages/${encodeURIComponent(id)}` : "/api/messages", { method: message.type === "draft" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    const body = await response.json().catch(() => null) as { error?: string } | null
    setBusy(false)
    if (!response.ok) { setFeedback(body?.error ?? "Could not save message"); return }
    await queryClient.invalidateQueries({ queryKey: ["messages"] })
    await navigate({ to: "/messages", search: { folder: status === "draft" ? "drafts" : "sent", page: 1 } })
  }

  const recipient = message.type === "inbox" ? message.from : message.to
  return <main className={styles.shell}>
    <div className={styles.top}><Link to="/">Bookworm</Link><Link to="/messages" search={{ folder, page }}>Back to messages</Link><ThemeToggle /></div>
    <article className={styles.detail}><header><p className={styles.eyebrow}>{message.type === "inbox" ? "From" : "To"} {recipient}</p><h1>{message.subject}</h1><time dateTime={message.date}>{formatDateTime(message.date)}</time></header>
      <div className={styles.content} dangerouslySetInnerHTML={{ __html: message.body }} /><div className={styles.detailActions}><button type="button" disabled={busy} onClick={() => void remove()}>Delete</button></div>
      <form className={styles.detailForm} onSubmit={submit}><h2>{message.type === "draft" ? "Edit draft" : "Reply"}</h2><label>Recipient<input name="recipient" defaultValue={recipient} maxLength={100} /></label><label>Subject<input name="title" defaultValue={message.type === "draft" ? message.subject : `Re: ${message.subject}`} maxLength={200} required /></label><label>Message<textarea name="body" defaultValue={message.type === "draft" ? plainText(message.body) : ""} maxLength={10_000} rows={7} required /></label><div className={styles.composeActions}><button name="status" value="sent" disabled={busy}>{busy ? "Saving…" : "Send"}</button>{message.type === "draft" && <button name="status" value="draft" disabled={busy}>Save draft</button>}</div></form>
      {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    </article>
  </main>
}
