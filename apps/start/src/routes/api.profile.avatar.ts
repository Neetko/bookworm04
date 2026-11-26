import { createFileRoute } from "@tanstack/react-router"
import { handleAvatarUpload } from "../features/profile/avatar-write.server"

export const Route = createFileRoute("/api/profile/avatar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleAvatarUpload(request)
        } catch (error) {
          console.error("Avatar upload failed", error)
          return Response.json({ error: "Failed to upload avatar" }, { status: 500 })
        }
      },
    },
  },
})
