import { createFileRoute } from "@tanstack/react-router"
import { handleInviteCandidates } from "../features/social/invite-candidates.server"

export const Route = createFileRoute("/api/community/clubs/$id/invite-candidates")({ server: { handlers: { GET: ({ request, params }) => handleInviteCandidates(request, params.id) } } })
