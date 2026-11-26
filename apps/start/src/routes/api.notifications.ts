import { createFileRoute } from "@tanstack/react-router"
import { loadNotificationPage } from "../features/notifications/service.server"
import { parseNotificationCursor } from "../features/notifications/validation"
import { handleNotificationRead } from "../features/notifications/write.server"

export const Route = createFileRoute("/api/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const search = new URL(request.url).searchParams
          const parsed = parseNotificationCursor(search.get("before"), search.get("beforeId"))
          if (!parsed) return Response.json({ error: "Invalid notification cursor" }, { status: 400 })
          const result = await loadNotificationPage(parsed.cursor)
          if (result.status === "unauthorized") {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
          }
          return Response.json({ results: result.results, nextCursor: result.nextCursor })
        } catch (error) {
          console.error("Notification read failed", error)
          return Response.json({ error: "Failed to load notifications" }, { status: 500 })
        }
      },
      PATCH: async ({ request }) => {
        try {
          return await handleNotificationRead(request)
        } catch (error) {
          console.error("Notification update failed", error)
          return Response.json({ error: "Failed to update notifications" }, { status: 500 })
        }
      },
    },
  },
})
