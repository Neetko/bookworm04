import { createFileRoute } from "@tanstack/react-router"
import { sameOriginPath } from "../server/auth-url.server"
import { createRequestSupabaseClient } from "../server/supabase.server"

export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      POST: async () => {
        const supabase = createRequestSupabaseClient()
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: sameOriginPath("/auth/callback"),
            skipBrowserRedirect: true,
          },
        })

        if (error || !data.url) {
          return new Response("Could not start Google sign-in", { status: 502 })
        }
        return Response.redirect(data.url, 303)
      },
    },
  },
})
