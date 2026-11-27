import { createFileRoute } from "@tanstack/react-router"
import { sameOriginPath } from "../server/auth-url.server"
import { createRequestSupabaseClient } from "../server/supabase.server"

export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null)
        const mode = form?.get("mode") === "signup" ? "signup" : "signin"
        const supabase = createRequestSupabaseClient()
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: sameOriginPath("/auth/callback"),
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
          },
        })

        if (error || !data.url) {
          return Response.redirect(sameOriginPath(`/auth?mode=${mode}&error=google-start`), 303)
        }
        // The request-scoped Supabase client writes its PKCE verifier with
        // Start's setCookie helper; Start merges it into this redirect.
        return Response.redirect(data.url, 303)
      },
    },
  },
})
