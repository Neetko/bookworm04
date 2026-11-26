import { createFileRoute } from "@tanstack/react-router"
import { handleFollow } from "../features/social/follow.server"

export const Route = createFileRoute("/api/users/$id/follow")({ server: { handlers: { POST: ({ request, params }) => handleFollow(request, params.id) } } })
