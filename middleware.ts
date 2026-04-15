import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getSupabasePublicEnv } from "@/lib/supabase-config"

const { url, anonKey: anon, isConfigured } = getSupabasePublicEnv()

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 })
      },
    },
  })

  if (!isConfigured) {
    console.warn("Supabase public environment variables are missing. Skipping auth refresh in middleware.")
    return response
  }

  // Touching auth ensures expired sessions get refreshed and cookies are updated.
  try {
    await supabase.auth.getUser()
  } catch (error) {
    console.error("Supabase auth refresh failed in middleware; continuing without refreshed session.", error)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
