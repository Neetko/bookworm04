import { createFileRoute } from "@tanstack/react-router"
import { handleListMutation } from "../features/lists/write.server"

export const Route = createFileRoute("/api/profile/lists")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleListMutation(request)
        } catch (error) {
          console.error("List update failed", error)
          return Response.json({ error: "Failed to update list" }, { status: 500 })
        }
      },
    },
  },
})
