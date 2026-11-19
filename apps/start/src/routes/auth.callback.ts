import { createFileRoute } from "@tanstack/react-router"
import { sameOriginPath } from "../server/auth-url.server"
import { createRequestSupabaseClient } from "../server/supabase.server"

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get("code")
        if (!code) return Response.redirect(sameOriginPath("/auth?error=sign-in-callback"), 303)

        const supabase = createRequestSupabaseClient()
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          return Response.redirect(sameOriginPath("/auth?error=sign-in-callback"), 303)
        }

        const { data: auth, error: userError } = await supabase.auth.getUser()
        if (userError || !auth.user) {
          return Response.redirect(sameOriginPath("/auth?error=sign-in-callback"), 303)
        }

        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("onboarding_completed_at")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle()
        if (profileError) {
          return Response.redirect(sameOriginPath("/auth?error=profile-check"), 303)
        }

        return Response.redirect(sameOriginPath(profile?.onboarding_completed_at ? "/" : "/onboarding"), 303)
      },
    },
  },
})
