import { createFileRoute } from "@tanstack/react-router"
import { handleMessageWrite } from "../features/messages/write.server"

export const Route = createFileRoute("/api/messages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleMessageWrite(request)
        } catch (error) {
          console.error("Message write failed", error)
          return Response.json({ error: "Failed to send message" }, { status: 500 })
        }
      },
    },
  },
})
