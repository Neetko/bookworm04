import { createFileRoute } from "@tanstack/react-router"
import { handleClubMutation } from "../features/clubs/write.server"

export const Route = createFileRoute("/api/clubs/$id")({
  server: { handlers: { POST: ({ request, params }) => handleClubMutation(request, params.id) } },
})
