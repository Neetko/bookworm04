"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const exchange = async () => {
      try {
        await supabase.auth.exchangeCodeForSession(window.location.href)
      } finally {
        router.replace("/")
      }
    }
    exchange()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Signing you in…</p>
    </div>
  )
}
