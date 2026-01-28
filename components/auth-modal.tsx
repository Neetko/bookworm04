"use client"

import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"
import { supabase } from "@/lib/supabase-browser"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  view?: "sign_in" | "sign_up"
}

export function AuthModal({ open, onOpenChange, view = "sign_in" }: AuthModalProps) {
  const title = view === "sign_up" ? "Sign up" : "Sign in"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Authenticate to access Bookworm.</DialogDescription>
        </DialogHeader>
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
