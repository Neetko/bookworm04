"use client"

import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"
import { supabase } from "@/lib/supabase-browser"
import { Navigation } from "@/components/navigation"
import { authUiMode } from "@/lib/auth-ui-config"

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-md mx-auto p-6">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={authUiMode === "google" ? ["google"] : []}
          onlyThirdPartyProviders={authUiMode === "google"}
          redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`}
        />
      </div>
    </div>
  )
}
