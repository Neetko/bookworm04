"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-browser"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const exchange = async () => {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)
      if (exchangeError || !data.session) {
        router.replace("/auth?error=sign-in-callback")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("onboarding_completed_at")
        .eq("auth_user_id", data.session.user.id)
        .maybeSingle()

      if (profileError) {
        router.replace("/auth?error=profile-check")
        return
      }

      router.replace(profile?.onboarding_completed_at ? "/" : "/onboarding")
    }
    void exchange()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Signing you in…</p>
    </div>
  )
}
