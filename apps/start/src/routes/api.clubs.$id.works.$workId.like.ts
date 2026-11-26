import { createFileRoute } from "@tanstack/react-router"
import { toggleWriterLike } from "../features/writer/write.server"
export const Route = createFileRoute("/api/clubs/$id/works/$workId/like")({ server: { handlers: { POST: ({ params }) => toggleWriterLike(params.id, params.workId) } } })
