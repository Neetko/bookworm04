import { createFileRoute } from "@tanstack/react-router"
import { handleSuggestionReview } from "../features/staff/staff.server"

export const Route = createFileRoute("/api/staff/suggestions")({ server: { handlers: { POST: ({ request }) => handleSuggestionReview(request) } } })
