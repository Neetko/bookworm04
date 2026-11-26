import { createFileRoute } from "@tanstack/react-router"
import { loadUnreadCounts } from "../features/notifications/service.server"

export const Route = createFileRoute("/api/notifications/counts")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await loadUnreadCounts()
          if (result.status === "unauthorized") {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
          }
          return Response.json({
            notifications: result.notifications,
            messages: result.messages,
            total: result.total,
          })
        } catch (error) {
          console.error("Unread count read failed", error)
          return Response.json({ error: "Failed to load unread counts" }, { status: 500 })
        }
      },
    },
  },
})
