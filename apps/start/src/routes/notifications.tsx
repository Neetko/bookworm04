import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { useEffect, useState, type ReactNode } from "react"
import { formatDateTime } from "../features/date-format"
import { notificationListQuery } from "../features/notifications/queries"
import type { NotificationRow } from "../features/notifications/service.server"
import type { NotificationCursor } from "../features/notifications/validation"
import styles from "../features/notifications/notifications.module.css"

type NotificationPage = {
  results: NotificationRow[]
  nextCursor: NotificationCursor | null
}

export const Route = createFileRoute("/notifications")({
  loader: async ({ context }) => {
    const result = await context.queryClient.ensureQueryData(notificationListQuery())
    if (result.status === "unauthorized") throw redirect({ to: "/auth" })
    return result
  },
  head: () => ({ meta: [{ title: "Notifications — Bookworm" }] }),
  component: NotificationsPage,
  errorComponent: NotificationError,
})

function NotificationError() {
  return <main className={styles.shell}><h1>Notifications</h1><p>Notifications could not be loaded.</p></main>
}

function entityLink(href: string | null, label: string): ReactNode {
  return href ? <a href={href}>{label}</a> : <span>{label}</span>
}

function invitationResolution(notification: NotificationRow) {
  return notification.metadata?.resolution?.action ?? notification.metadata?.invitation?.status ?? null
}

function applicationResolution(notification: NotificationRow) {
  return notification.metadata?.resolution?.action ?? notification.metadata?.application?.status ?? null
}

function notificationTimestamp(notification: NotificationRow) {
  return notification.metadata?.resolution?.respondedAt
    ?? notification.metadata?.invitation?.respondedAt
    ?? notification.metadata?.application?.respondedAt
    ?? notification.createdAt
}

function notificationLabel(notification: NotificationRow): ReactNode {
  const actorName = notification.metadata?.actor?.username ?? "Someone"
  const titleName = notification.metadata?.title?.title ?? "a title"
  const clubName = notification.metadata?.club?.name ?? "the club"
  const actorId = notification.metadata?.actor?.id
  const clubId = notification.metadata?.club?.id
  const actor = entityLink(actorId ? `/users/${encodeURIComponent(actorId)}` : null, actorName)
  const club = entityLink(clubId
    ? notification.eventType === "club_application_received"
      ? `/community/clubs/${encodeURIComponent(clubId)}/manage`
      : `/community/clubs/${encodeURIComponent(clubId)}`
    : null, clubName)

  switch (notification.eventType) {
    case "discussion_post_like": return <>{actor} liked your discussion post.</>
    case "review_like": return <>{actor} liked your review for {titleName}.</>
    case "followed": return <>{actor} followed you.</>
    case "friendship": return <>{actor} is now your friend.</>
    case "bookmarked_discussion_post": return <>New discussion post in {titleName}.</>
    case "moderator_assigned": return <>{actor} made you a moderator.</>
    case "club_application_received": {
      const resolution = applicationResolution(notification)
      if (resolution === "approved" || resolution === "accepted") return <>{actor}&apos;s request to join {club} was approved.</>
      if (resolution === "declined") return <>{actor}&apos;s request to join {club} was declined.</>
      if (resolution === "withdrawn") return <>{actor} withdrew their request to join {club}.</>
      return <>{actor} applied to join {club}.</>
    }
    case "club_application_approved": return <>{actor} approved your request to join {club}.</>
    case "club_application_declined": return <>{actor} declined your request to join {club}.</>
    case "club_invited_to_club": {
      const resolution = invitationResolution(notification)
      if (resolution === "accepted") return <>You accepted the invitation to join {club}.</>
      if (resolution === "declined") return <>You declined the invitation to join {club}.</>
      if (resolution === "revoked") return <>Your invitation to join {club} was revoked.</>
      if (resolution === "expired") return <>Your invitation to join {club} expired.</>
      return <>{actor} invited you to join {club}.</>
    }
    case "club_invitation_accepted": return <>{actor} accepted your invitation to join {club}.</>
    case "club_invitation_declined": return <>{actor} declined your invitation to join {club}.</>
    case "club_membership_removed": return <>{actor} removed you from {club}{notification.metadata?.membership?.reason ? `: ${notification.metadata.membership.reason}.` : "."}</>
    default: return <>{actor} sent you a notification.</>
  }
}

async function fetchNotificationPage(cursor: NotificationCursor | null): Promise<NotificationPage> {
  const search = cursor ? `?${new URLSearchParams({ before: cursor.createdAt, beforeId: cursor.id })}` : ""
  const response = await fetch(`/api/notifications${search}`, { cache: "no-store" })
  const body = await response.json().catch(() => null) as NotificationPage | null
  if (!response.ok || !body || !Array.isArray(body.results)) throw new Error("Notifications could not be loaded")
  return body
}

function announceCountChange() {
  window.dispatchEvent(new Event("bookworm:notification-counts-changed"))
}

function NotificationsPage() {
  const { data } = useSuspenseQuery(notificationListQuery())
  const queryClient = useQueryClient()
  const [notifications, setNotifications] = useState<NotificationRow[]>(data.status === "ok" ? data.results : [])
  const [nextCursor, setNextCursor] = useState<NotificationCursor | null>(data.status === "ok" ? data.nextCursor : null)
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    if (data.status !== "ok") return
    setNotifications(data.results)
    setNextCursor(data.nextCursor)
  }, [data])

  if (data.status !== "ok") return null

  async function refreshFirstPage() {
    const page = await fetchNotificationPage(null)
    setNotifications(page.results)
    setNextCursor(page.nextCursor)
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  async function markRead(id: string) {
    const notification = notifications.find((item) => item.id === id)
    if (!notification || notification.isRead) return
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item))
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        keepalive: true,
      })
      if (!response.ok) throw new Error("Notification could not be updated")
      announceCountChange()
    } catch {
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: false } : item))
    }
  }

  async function markAllRead() {
    setBusy("all")
    setFeedback("")
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      if (!response.ok) throw new Error("Notifications could not be updated")
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
      announceCountChange()
    } catch {
      setFeedback("Unable to mark notifications read.")
    } finally {
      setBusy(null)
    }
  }

  async function loadMore() {
    if (!nextCursor) return
    setBusy("more")
    setFeedback("")
    try {
      const page = await fetchNotificationPage(nextCursor)
      setNotifications((current) => {
        const merged = new Map(current.map((item) => [item.id, item]))
        for (const item of page.results) merged.set(item.id, item)
        return [...merged.values()]
      })
      setNextCursor(page.nextCursor)
    } catch {
      setFeedback("Unable to load more notifications.")
    } finally {
      setBusy(null)
    }
  }

  async function respond(notification: NotificationRow, action: "accept" | "decline") {
    const invitationId = notification.metadata?.invitation?.id
    if (!invitationId) return
    setBusy(notification.id)
    setFeedback("")
    try {
      const response = await fetch("/api/notifications/invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, action }),
      })
      if (!response.ok) throw new Error("Invitation could not be updated")
      await refreshFirstPage()
      announceCountChange()
      setFeedback(action === "accept" ? "Invitation accepted." : "Invitation declined.")
    } catch {
      setFeedback(action === "accept" ? "Unable to accept invitation." : "Unable to decline invitation.")
    } finally {
      setBusy(null)
    }
  }

  return <main className={styles.shell}>
    <div className={styles.top}><Link to="/">Bookworm</Link><Link to="/messages" search={{ folder: "inbox", page: 1 }}>Messages</Link></div>
    <div className={styles.heading}><div><h1>Notifications</h1><p>Updates from readers, titles, and clubs</p></div><button className={styles.button} type="button" onClick={markAllRead} disabled={busy !== null || notifications.every((item) => item.isRead)}>Mark all read</button></div>
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    <section className={styles.list} aria-label="Notifications">
      {notifications.length === 0 ? <div className={styles.empty}>You are all caught up.</div> : notifications.map((notification) => {
        const resolution = invitationResolution(notification)
        const canRespond = notification.eventType === "club_invited_to_club"
          && Boolean(notification.metadata?.invitation?.id)
          && (resolution === null || resolution === "pending")
        return <article key={notification.id} className={`${styles.row} ${notification.isRead ? "" : styles.unread}`} onClickCapture={() => { void markRead(notification.id) }}>
          <div className={styles.rowTop}><p className={styles.label}>{notificationLabel(notification)}</p><time className={styles.time} dateTime={notificationTimestamp(notification)}>{formatDateTime(notificationTimestamp(notification))}</time></div>
          {canRespond && <div className={styles.actions}><button className={styles.button} type="button" onClick={() => { void respond(notification, "accept") }} disabled={busy === notification.id}>Accept</button><button className={styles.button} type="button" onClick={() => { void respond(notification, "decline") }} disabled={busy === notification.id}>Decline</button></div>}
        </article>
      })}
    </section>
    {nextCursor && <div className={styles.more}><button className={styles.button} type="button" onClick={loadMore} disabled={busy !== null}>{busy === "more" ? "Loading…" : "Load more"}</button></div>}
  </main>
}
