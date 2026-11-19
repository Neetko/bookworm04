import { createFileRoute } from "@tanstack/react-router"

// A side-effect-free API route used by the security smoke test. It exercises
// request middleware exactly as future mutation routes will.
export const Route = createFileRoute("/api/security-check")({
  server: {
    handlers: {
      POST: () => new Response(null, { status: 204 }),
    },
  },
})
