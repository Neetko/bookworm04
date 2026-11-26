import { createFileRoute } from "@tanstack/react-router"
import { saveWriterWork } from "../features/writer/write.server"
export const Route = createFileRoute("/api/clubs/$id/works")({ server: { handlers: { POST: ({ request, params }) => saveWriterWork(request, params.id) } } })
