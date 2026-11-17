"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { Bell, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { acceptClubInvitation, declineClubInvitation } from "@/app/actions/clubs"
import {
  notifyUnreadCountsChanged,
  parseNotificationCursor,
  type NotificationCursor,
} from "@/lib/notifications"

interface NotificationRow {
  id: string
  event_type: string
  is_read: boolean
  created_at: string
  metadata?: {
    actor?: { id: string; username?: string | null; avatarUrl?: string | null }
    title?: { id: string; title?: string | null; coverUrl?: string | null }
    role?: { name?: string | null }
    club?: { id?: string | null; name?: string | null; avatarUrl?: string | null }
    invitation?: { id?: string | null; status?: string | null; respondedAt?: string | null }
    application?: { id?: string | null; status?: string | null; respondedAt?: string | null }
    membership?: { reason?: string | null }
    resolution?: { action?: string | null; respondedAt?: string | null }
  } | null
}

const getInvitationResolution = (notification: NotificationRow) =>
  notification.metadata?.resolution?.action ?? notification.metadata?.invitation?.status ?? null

const getApplicationResolution = (notification: NotificationRow) =>
  notification.metadata?.resolution?.action ?? notification.metadata?.application?.status ?? null

const getNotificationTimestamp = (notification: NotificationRow) =>
  notification.metadata?.resolution?.respondedAt ??
  notification.metadata?.invitation?.respondedAt ??
  notification.metadata?.application?.respondedAt ??
  notification.created_at

const getNextCursor = (value: unknown): NotificationCursor | null => {
  if (!value || typeof value !== "object") return null

  const candidate = value as { createdAt?: unknown; id?: unknown }
  const parsed = parseNotificationCursor(
    typeof candidate.createdAt === "string" ? candidate.createdAt : null,
    typeof candidate.id === "string" ? candidate.id : null
  )

  return parsed?.cursor ?? null
}

const buildNotificationsUrl = (cursor: NotificationCursor | null) => {
  if (!cursor) return "/api/notifications"

  const params = new URLSearchParams({
    before: cursor.createdAt,
    beforeId: cursor.id,
  })
  return `/api/notifications?${params.toString()}`
}

const NotificationEntityLink = ({
  href,
  label,
}: {
  href: string | null
  label: string
}) => {
  if (!href) return <span>{label}</span>

  return (
    <Link href={href} className="font-medium text-primary transition-colors hover:text-primary/80">
      {label}
    </Link>
  )
}

const buildLabel = (notification: NotificationRow) => {
  const actorName = notification.metadata?.actor?.username ?? "Someone"
  const titleName = notification.metadata?.title?.title ?? "a title"
  const clubName = notification.metadata?.club?.name ?? "the club"
  const invitationResolution = getInvitationResolution(notification)
  const applicationResolution = getApplicationResolution(notification)
  const actorHref = notification.metadata?.actor?.id
    ? `/users/${encodeURIComponent(notification.metadata.actor.id)}`
    : null
  const clubHref = notification.metadata?.club?.id
    ? notification.event_type === "club_application_received"
      ? `/community/clubs/${encodeURIComponent(notification.metadata.club.id)}/manage`
      : `/community/clubs/${encodeURIComponent(notification.metadata.club.id)}`
    : null

  const actorNode = <NotificationEntityLink href={actorHref} label={actorName} />
  const clubNode = <NotificationEntityLink href={clubHref} label={clubName} />

  switch (notification.event_type) {
    case "discussion_post_like":
      return <>{actorNode} liked your discussion post.</>
    case "review_like":
      return <>{actorNode} liked your review for {titleName}.</>
    case "followed":
      return <>{actorNode} followed you.</>
    case "friendship":
      return <>{actorNode} is now your friend.</>
    case "bookmarked_discussion_post":
      return `New discussion post in ${titleName}.`
    case "moderator_assigned":
      return <>{actorNode} made you a moderator.</>
    case "club_application_received":
      if (applicationResolution === "approved" || applicationResolution === "accepted") {
        return <>{actorNode}&apos;s request to join {clubNode} was approved.</>
      }
      if (applicationResolution === "declined") {
        return <>{actorNode}&apos;s request to join {clubNode} was declined.</>
      }
      if (applicationResolution === "withdrawn") {
        return <>{actorNode} withdrew their request to join {clubNode}.</>
      }
      return <>{actorNode} applied to join {clubNode}.</>
    case "club_application_approved":
      return <>{actorNode} approved your request to join {clubNode}.</>
    case "club_application_declined":
      return <>{actorNode} declined your request to join {clubNode}.</>
    case "club_invited_to_club":
      if (invitationResolution === "accepted") {
        return <>You accepted the invitation to join {clubNode}.</>
      }
      if (invitationResolution === "declined") {
        return <>You declined the invitation to join {clubNode}.</>
      }
      if (invitationResolution === "revoked") {
        return <>Your invitation to join {clubNode} was revoked.</>
      }
      if (invitationResolution === "expired") {
        return <>Your invitation to join {clubNode} expired.</>
      }
      return <>{actorNode} invited you to join {clubNode}.</>
    case "club_invitation_accepted":
      return <>{actorNode} accepted your invitation to join {clubNode}.</>
    case "club_invitation_declined":
      return <>{actorNode} declined your invitation to join {clubNode}.</>
    case "club_membership_removed":
      return (
        <>
          {actorNode} removed you from {clubNode}
          {notification.metadata?.membership?.reason
            ? `: ${notification.metadata.membership.reason}.`
            : "."}
        </>
      )
    default:
      return <>{actorNode} sent you a notification.</>
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isMarking, setIsMarking] = useState(false)
  const [inviteActionId, setInviteActionId] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<NotificationCursor | null>(null)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(buildNotificationsUrl(null), { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to load notifications")
      const data = await response.json()
      setNotifications(Array.isArray(data?.results) ? data.results : [])
      setNextCursor(getNextCursor(data?.nextCursor))
    } catch (error) {
      console.error(error)
      toast.error("Unable to load notifications")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const loadMoreNotifications = async () => {
    if (nextCursor === null || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const response = await fetch(buildNotificationsUrl(nextCursor), { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to load more notifications")
      const data = await response.json()
      const nextRows = Array.isArray(data?.results) ? (data.results as NotificationRow[]) : []

      setNotifications((current) => {
        const byId = new Map(current.map((notification) => [notification.id, notification]))
        nextRows.forEach((notification) => byId.set(notification.id, notification))
        return Array.from(byId.values())
      })
      setNextCursor(getNextCursor(data?.nextCursor))
    } catch (error) {
      console.error(error)
      toast.error("Unable to load more notifications")
    } finally {
      setIsLoadingMore(false)
    }
  }

  const markNotificationRead = useCallback(async (notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) => {
        if (notification.id !== notificationId || notification.is_read) return notification
        return { ...notification, is_read: true }
      })
    )

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationId }),
        keepalive: true,
      })
      if (!response.ok) throw new Error("Failed to mark notification read")
      notifyUnreadCountsChanged()
    } catch (error) {
      console.error(error)
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, is_read: false } : notification
        )
      )
    }
  }, [])

  const handleMarkAllRead = async () => {
    setIsMarking(true)
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      if (!response.ok) throw new Error("Failed to mark notifications read")
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))
      notifyUnreadCountsChanged()
    } catch (error) {
      console.error(error)
      toast.error("Unable to mark notifications read")
    } finally {
      setIsMarking(false)
    }
  }

  const handleInvitationAction = async (notification: NotificationRow, action: "accept" | "decline") => {
    const invitationId = notification.metadata?.invitation?.id
    if (!invitationId) return

    setInviteActionId(notification.id)
    try {
      if (action === "accept") {
        await acceptClubInvitation(invitationId)
        toast.success("Invitation accepted")
      } else {
        await declineClubInvitation(invitationId)
        toast.success("Invitation declined")
      }

      await loadNotifications()
      notifyUnreadCountsChanged()
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(action === "accept" ? "Unable to accept invitation" : "Unable to decline invitation")
    } finally {
      setInviteActionId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="font-ui max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={isMarking || notifications.every((notification) => notification.is_read)}
            >
              Mark all read
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="text-sm text-muted-foreground">You are all caught up.</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-4 ${notification.is_read ? "bg-muted/40" : "bg-background"}`}
                  onClickCapture={() => {
                    if (!notification.is_read) void markNotificationRead(notification.id)
                  }}
                >
                  {(() => {
                    const invitationResolution = getInvitationResolution(notification)
                    const canRespondToInvitation =
                      notification.event_type === "club_invited_to_club" &&
                      !!notification.metadata?.invitation?.id &&
                      (invitationResolution === null || invitationResolution === "pending")

                    return (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{buildLabel(notification)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(getNotificationTimestamp(notification)), {
                              addSuffix: true,
                            })}
                          </div>
                        </div>
                        {canRespondToInvitation ? (
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleInvitationAction(notification, "accept")}
                              disabled={inviteActionId === notification.id}
                            >
                              {inviteActionId === notification.id && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInvitationAction(notification, "decline")}
                              disabled={inviteActionId === notification.id}
                            >
                              Decline
                            </Button>
                          </div>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
              ))
            )}
            {nextCursor !== null ? (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={loadMoreNotifications} disabled={isLoadingMore}>
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Load more
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
