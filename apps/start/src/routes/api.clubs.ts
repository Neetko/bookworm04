import { createFileRoute } from "@tanstack/react-router"
import { handleClubCreate } from "../features/clubs/write.server"

export const Route = createFileRoute("/api/clubs")({
  server: { handlers: { POST: ({ request }) => handleClubCreate(request) } },
})
