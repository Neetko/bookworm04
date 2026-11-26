import { createFileRoute } from "@tanstack/react-router"
import { handleProfileUpdate } from "../features/profile/write.server"

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        try {
          return await handleProfileUpdate(request)
        } catch (error) {
          console.error("Profile update failed", error)
          return Response.json({ error: "Failed to update profile" }, { status: 500 })
        }
      },
    },
  },
})
