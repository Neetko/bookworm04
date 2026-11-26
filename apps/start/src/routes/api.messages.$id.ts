import { createFileRoute } from "@tanstack/react-router"
import { handleMessageDelete, handleMessageUpdate } from "../features/messages/write.server"

export const Route = createFileRoute("/api/messages/$id")({
  server: { handlers: {
    PATCH: ({ request, params }) => handleMessageUpdate(request, params.id),
    DELETE: ({ params }) => handleMessageDelete(params.id),
  } },
})
