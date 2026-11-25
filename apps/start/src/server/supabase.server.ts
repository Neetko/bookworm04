import { createServerClient, parseCookieHeader } from "@supabase/ssr"
import { getRequest, setCookie, setResponseHeader } from "@tanstack/react-start/server"

function publicSupabaseConfig() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()
  const key = (
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim()

  if (!url || !key) {
    throw new Error("Supabase public configuration is missing")
  }

  return { url, key }
}

// Construct a fresh client inside each request. Supabase's default cookie
// names and options match the existing Next app's @supabase/ssr session.
export function createRequestSupabaseClient() {
  const { url, key } = publicSupabaseConfig()
  const requestCookies = parseCookieHeader(getRequest().headers.get("cookie") ?? "")
  const jar = new Map(requestCookies.flatMap(({ name, value }) =>
    value === undefined ? [] : [[name, value] as const]
  ))

  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return Array.from(jar, ([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          jar.set(name, value)
          setCookie(name, value, options)
        }

        // A refreshed session must never be cached by a shared proxy or CDN.
        setResponseHeader("Cache-Control", "private, no-store, max-age=0")
      },
    },
  })
}

export type RequestSupabaseClient = ReturnType<typeof createRequestSupabaseClient>
