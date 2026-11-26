import { createFileRoute } from "@tanstack/react-router"
import { handleClubAvatar } from "../features/clubs/write.server"

export const Route = createFileRoute("/api/clubs/$id/avatar")({
  server: { handlers: { POST: ({ request, params }) => handleClubAvatar(request, params.id) } },
})
