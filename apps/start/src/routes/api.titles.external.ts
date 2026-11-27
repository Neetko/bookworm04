import { createFileRoute } from "@tanstack/react-router"
import { handleExternalCatalogIngest } from "../features/titles/external.server"

export const Route = createFileRoute("/api/titles/external")({
  server: { handlers: { POST: ({ request }) => handleExternalCatalogIngest(request) } },
})
