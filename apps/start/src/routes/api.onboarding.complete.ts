import { createFileRoute } from "@tanstack/react-router"
import { handleOnboardingComplete } from "../features/onboarding/write.server"

export const Route = createFileRoute("/api/onboarding/complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleOnboardingComplete(request)
        } catch (error) {
          console.error("Onboarding write failed", error)
          return Response.json({ error: "Could not finish setup" }, { status: 500 })
        }
      },
    },
  },
})
