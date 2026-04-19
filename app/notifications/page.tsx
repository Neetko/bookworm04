"use client"

import { useCallback, useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { Bell } from "lucide-react"
import { toast } from "sonner"

interface NotificationRow {
  id: string
  event_type: string
  is_read: boolean
  created_at: string
  metadata?: {
    actor?: { id: string; username?: string | null; avatarUrl?: string | null }
    title?: { id: string; title?: string | null; coverUrl?: string | null }
    role?: { name?: string | null }
  } | null
}

const buildLabel = (notification: NotificationRow) => {
  const actorName = notification.metadata?.actor?.username ?? "Someone"
  const titleName = notification.metadata?.title?.title ?? "a title"

  switch (notification.event_type) {
    case "discussion_post_like":
      return `${actorName} liked your discussion post.`
    case "review_like":
      return `${actorName} liked your review for ${titleName}.`
    case "followed":
      return `${actorName} followed you.`
    case "friendship":
      return `${actorName} is now your friend.`
    case "bookmarked_discussion_post":
      return `New discussion post in ${titleName}.`
    case "moderator_assigned":
      return `${actorName} made you a moderator.`
    default:
      return `${actorName} sent you a notification.`
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMarking, setIsMarking] = useState(false)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/notifications")
      if (!response.ok) throw new Error("Failed to load notifications")
      const data = await response.json()
      setNotifications(Array.isArray(data?.results) ? data.results : [])
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
    } catch (error) {
      console.error(error)
      toast.error("Unable to mark notifications read")
    } finally {
      setIsMarking(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isMarking}>
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
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{buildLabel(notification)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
