import { createFileRoute } from "@tanstack/react-router"
import { handleInvitationResponse } from "../features/notifications/write.server"

export const Route = createFileRoute("/api/notifications/invitation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleInvitationResponse(request)
        } catch (error) {
          console.error("Invitation response failed", error)
          return Response.json({ error: "Failed to update invitation" }, { status: 500 })
        }
      },
    },
  },
})
