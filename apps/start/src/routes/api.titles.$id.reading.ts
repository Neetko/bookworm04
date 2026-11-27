import { createFileRoute } from "@tanstack/react-router"
import { handleTitleEngagement } from "../features/titles/engagement.server"

export const Route = createFileRoute("/api/titles/$id/reading")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handleTitleEngagement(request, params.id),
    },
  },
})
