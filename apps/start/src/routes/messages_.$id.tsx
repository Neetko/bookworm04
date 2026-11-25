import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router"
import { formatDateTime } from "../features/date-format"
import { messageDetailQuery } from "../features/messages/queries"
import type { MessageFolder } from "../features/messages/read.functions"
import styles from "../features/messages/messages.module.css"

function folderFromSearch(value: unknown): MessageFolder {
  return value === "sent" || value === "drafts" ? value : "inbox"
}

export const Route = createFileRoute("/messages_/$id")({
  validateSearch: (search) => ({
    folder: folderFromSearch(search.folder),
    page: Number.isSafeInteger(Number(search.page)) && Number(search.page) > 0 ? Number(search.page) : 1,
  }),
  loader: async ({ params, context }) => {
    const result = await context.queryClient.ensureQueryData(messageDetailQuery(params.id))
    if (result.status === "unauthorized") throw redirect({ to: "/auth" })
    if (result.status === "not-found") throw notFound()
    return result
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.subject} — Bookworm` : "Message — Bookworm" }] }),
  component: MessageDetailPage,
  notFoundComponent: () => <main className={styles.shell}><h1>Message not found</h1><Link to="/messages" search={{ folder: "inbox", page: 1 }}>Back to messages</Link></main>,
  errorComponent: MessageError,
})

function MessageError() {
  return <main className={styles.shell}><h1>Message unavailable</h1><p>Sign in, or return to your inbox.</p><Link to="/messages" search={{ folder: "inbox", page: 1 }}>Back to messages</Link></main>
}

function MessageDetailPage() {
  const message = Route.useLoaderData()
  const { folder, page } = Route.useSearch()
  return (
    <main className={styles.shell}>
      <div className={styles.top}><Link to="/">Bookworm</Link><Link to="/messages" search={{ folder, page }}>Back to messages</Link></div>
      <article className={styles.detail}>
        <header><p className={styles.eyebrow}>{message.type === "inbox" ? "From" : "To"} {message.type === "inbox" ? message.from : message.to}</p><h1>{message.subject}</h1><time dateTime={message.date}>{formatDateTime(message.date)}</time></header>
        <div className={styles.content} dangerouslySetInnerHTML={{ __html: message.body }} />
      </article>
    </main>
  )
}
