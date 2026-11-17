"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase-browser"

type AuthContextType = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let active = true

    const routeSignedInUser = async (authenticatedUser: User, refreshCompleted = false) => {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("onboarding_completed_at")
        .eq("auth_user_id", authenticatedUser.id)
        .maybeSingle()

      if (!active || error) return
      if (!profile?.onboarding_completed_at && pathname !== "/onboarding") {
        router.replace("/onboarding")
        return
      }

      if (profile?.onboarding_completed_at && pathname.startsWith("/auth")) {
        router.replace("/")
      } else if (profile?.onboarding_completed_at && refreshCompleted) {
        router.refresh()
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) void routeSignedInUser(session.user)
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)

      if (event === "SIGNED_IN" && session?.user) {
        // Run the profile query after Supabase finishes dispatching the auth event.
        window.setTimeout(() => void routeSignedInUser(session.user, true), 0)
      }
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [pathname, router])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      router.replace("/")
      router.refresh()
    }
  }

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
