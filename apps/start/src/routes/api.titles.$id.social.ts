import { createFileRoute } from "@tanstack/react-router"
import { handleTitleSocial } from "../features/titles/social.server"

export const Route = createFileRoute("/api/titles/$id/social")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handleTitleSocial(request, params.id),
    },
  },
})
