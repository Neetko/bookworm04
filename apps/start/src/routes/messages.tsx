import { ThemeToggle } from "../components/theme-toggle"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { formatDate } from "../features/date-format"
import type { MessageFolder } from "../features/messages/read.functions"
import { messageListQuery } from "../features/messages/queries"
import styles from "../features/messages/messages.module.css"

async function writeMessage(data: { title: string; recipient: string; body: string; status: "sent" | "draft" }) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const result = await response.json().catch(() => ({ error: "Message could not be sent." })) as { id?: string; error?: string }
  if (!response.ok) throw new Error(result.error ?? "Message could not be sent.")
  return result
}

function folderFromSearch(value: unknown): MessageFolder {
  return value === "sent" || value === "drafts" ? value : "inbox"
}

export const Route = createFileRoute("/messages")({
  validateSearch: (search) => ({
    folder: folderFromSearch(search.folder),
    page: Number.isSafeInteger(Number(search.page)) && Number(search.page) > 0
      ? Math.min(10_000, Number(search.page)) : 1,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const result = await context.queryClient.ensureQueryData(messageListQuery(deps.folder, deps.page))
    if (result.status === "unauthorized") throw redirect({ to: "/auth" })
    return result
  },
  head: () => ({ meta: [{ title: "Messages — Bookworm" }] }),
  component: MessagesPage,
  errorComponent: MessageError,
})

function MessageError() {
  return <main className={styles.shell}><h1>Messages</h1><p>Sign in to see your messages.</p><Link to="/auth">Sign in</Link></main>
}

function MessagesPage() {
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(messageListQuery(search.folder, search.page))
  const queryClient = useQueryClient()
  const router = useRouter()
  const [composeOpen, setComposeOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const send = useMutation({
    mutationFn: writeMessage,
    onSuccess: async (_result, variables) => {
      setFeedback(variables.status === "draft" ? "Draft saved." : "Message sent.")
      setComposeOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["messages"] })
      await router.invalidate()
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : "Message could not be sent."),
  })
  if (data.status !== "ok") return null
  const { folder, page, counts, results } = data
  const folders: Array<[MessageFolder, string]> = [["inbox", "Inbox"], ["sent", "Sent"], ["drafts", "Drafts"]]
  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback("")
    const data = new FormData(event.currentTarget)
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const status = submitter?.value === "draft" ? "draft" as const : "sent" as const
    send.mutate({
      recipient: String(data.get("recipient") ?? ""),
      title: String(data.get("title") ?? ""),
      body: String(data.get("body") ?? ""),
      status,
    })
  }
  return (
    <main className={styles.shell}>
      <div className={styles.top}><Link to="/">Bookworm</Link><Link to="/auth">Account</Link><ThemeToggle /></div>
      <div className={styles.heading}><div><h1>Messages</h1><p>Your private conversations</p></div><button className={styles.composeButton} type="button" onClick={() => setComposeOpen((open) => !open)}>New message</button></div>
      {composeOpen && <form className={styles.compose} onSubmit={submitMessage}>
        <label>Recipient username<input name="recipient" maxLength={100} autoComplete="off" /></label>
        <label>Subject<input name="title" required maxLength={200} /></label>
        <label>Message<textarea name="body" required maxLength={10_000} rows={6} /></label>
        <div className={styles.composeActions}><button type="submit" name="status" value="sent" disabled={send.isPending}>{send.isPending ? "Saving…" : "Send"}</button><button type="submit" name="status" value="draft" disabled={send.isPending}>Save draft</button></div>
      </form>}
      {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
      <nav className={styles.folders} aria-label="Message folders">
        {folders.map(([key, label]) => <Link key={key} to="/messages" search={{ folder: key, page: 1 }} className={key === folder ? styles.active : undefined}>{label} <span>{counts[key]}</span></Link>)}
      </nav>
      <div className={styles.list}>
        {results.length ? results.map((message) => (
          <Link key={message.id} to="/messages/$id" params={{ id: message.id }} search={{ folder, page }} className={styles.row}>
            <div className={styles.avatar} aria-hidden="true">{(folder === "inbox" ? message.from : message.to).slice(0, 1).toUpperCase()}</div>
            <div className={styles.rowBody}>
              <div className={styles.rowMeta}><strong>{folder === "inbox" ? message.from : message.to}</strong><time dateTime={message.date}>{formatDate(message.date)}</time></div>
              <h2>{message.subject}</h2>
              <p>{message.preview}</p>
            </div>
            {!message.read && folder === "inbox" && <span className={styles.unread} aria-label="Unread" />}
          </Link>
        )) : <div className={styles.empty}>No messages in this folder.</div>}
      </div>
      <nav className={styles.pages} aria-label="Message pages">
        {page > 1 && <Link to="/messages" search={{ folder, page: page - 1 }}>Previous</Link>}
        <span>Page {page}</span>
        {results.length === 20 && <Link to="/messages" search={{ folder, page: page + 1 }}>Next</Link>}
      </nav>
    </main>
  )
}
