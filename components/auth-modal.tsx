"use client"

import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  view?: "sign_in" | "sign_up"
}

export function AuthModal({ open, onOpenChange, view = "sign_in" }: AuthModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <Auth
          supabaseClient={supabase}
          view={view}
          appearance={{ theme: ThemeSupa }}
          providers={["google"]}
          onlyThirdPartyProviders
          redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`}
        />
      </DialogContent>
    </Dialog>
  )
}
