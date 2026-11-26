import { createFileRoute } from "@tanstack/react-router"
import { handleTitleSuggestions } from "../features/titles/suggestions.server"

export const Route = createFileRoute("/api/track-reading/suggestions")({ server: { handlers: { GET: ({ request }) => handleTitleSuggestions(request) } } })
