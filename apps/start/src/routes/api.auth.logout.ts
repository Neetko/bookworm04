import { createFileRoute } from "@tanstack/react-router"
import { sameOriginPath } from "../server/auth-url.server"
import { createRequestSupabaseClient } from "../server/supabase.server"

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async () => {
        const supabase = createRequestSupabaseClient()
        const { error } = await supabase.auth.signOut()
        if (error) return new Response("Could not sign out", { status: 502 })
        return Response.redirect(sameOriginPath("/"), 303)
      },
    },
  },
})
