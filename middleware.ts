import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getSupabasePublicEnv } from "@/lib/supabase-config"

const { url, anonKey: anon, isConfigured } = getSupabasePublicEnv()

function redirectWithRefreshedCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = pathname
  redirectUrl.search = ""

  const redirectResponse = NextResponse.redirect(redirectUrl)
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
  return redirectResponse
}

function isProtectedPage(pathname: string) {
  return ["/diary", "/messages", "/notifications", "/profile", "/admin"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  if (!isConfigured) {
    console.warn("Supabase public environment variables are missing. Skipping auth refresh in middleware.")
    return response
  }

  // Touching auth ensures expired sessions get refreshed and cookies are updated.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname
    const isApiRoute = pathname.startsWith("/api/")
    const isAuthCallback = pathname === "/auth/callback"

    if (!user && !isApiRoute && isProtectedPage(pathname)) {
      return redirectWithRefreshedCookies(request, response, "/auth")
    }

    if (user && !isApiRoute && !isAuthCallback) {
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("onboarding_completed_at")
        .eq("auth_user_id", user.id)
        .maybeSingle()

      if (profileError) {
        console.error("Failed to enforce onboarding in middleware.", profileError)
      } else if (!profile?.onboarding_completed_at && pathname !== "/onboarding") {
        return redirectWithRefreshedCookies(request, response, "/onboarding")
      } else if (profile?.onboarding_completed_at && (pathname === "/onboarding" || pathname === "/auth")) {
        return redirectWithRefreshedCookies(request, response, "/")
      }
    }
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
