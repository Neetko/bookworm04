import { createFileRoute } from "@tanstack/react-router"
import { handleRecipientSearch } from "../features/messages/write.server"

export const Route = createFileRoute("/api/messages/recipients")({
  server: { handlers: { GET: ({ request }) => handleRecipientSearch(request) } },
})
