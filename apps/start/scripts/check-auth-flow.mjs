import assert from "node:assert/strict"

process.env.NODE_ENV = "production"
process.env.PUBLIC_APP_ORIGIN = "https://bookworm.test"
process.env.SUPABASE_URL = "https://example.supabase.co"
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key"

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "reader@example.com",
  user_metadata: {},
  app_metadata: { provider: "google" },
  created_at: "2026-01-01T00:00:00.000Z",
}

const nativeFetch = globalThis.fetch
let onboardingCompletedAt = "2026-01-01T00:00:00.000Z"

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url)
  if (url.pathname === "/auth/v1/token") {
    return Response.json({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user,
    })
  }
  if (url.pathname === "/auth/v1/user") return Response.json(user)
  if (url.pathname === "/rest/v1/user_profiles") {
    return Response.json(onboardingCompletedAt ? [{ onboarding_completed_at: onboardingCompletedAt }] : [])
  }
  return nativeFetch(input, init)
}

const { default: server } = await import("../.output/server/_ssr/ssr.mjs")

const start = await server.fetch(new Request("https://bookworm.test/api/auth/google", {
  method: "POST",
  headers: {
    origin: "https://bookworm.test",
    "content-type": "application/x-www-form-urlencoded",
  },
  body: "mode=signin",
}))

assert.equal(start.status, 303)
const googleUrl = new URL(start.headers.get("location"))
assert.equal(googleUrl.origin, "https://example.supabase.co")
assert.equal(googleUrl.pathname, "/auth/v1/authorize")
assert.equal(googleUrl.searchParams.get("provider"), "google")
assert.equal(googleUrl.searchParams.get("redirect_to"), "https://bookworm.test/auth/callback")
assert.ok(googleUrl.searchParams.get("code_challenge"))
assert.equal(googleUrl.searchParams.get("code_challenge_method"), "s256")

const verifierCookie = start.headers.getSetCookie().find((value) => value.includes("code-verifier="))
assert.ok(verifierCookie, "OAuth initiation must write the PKCE verifier cookie")
const cookiePair = verifierCookie.split(";", 1)[0]

async function callback(expectedPath) {
  const response = await server.fetch(new Request("https://bookworm.test/auth/callback?code=test-code", {
    headers: { cookie: cookiePair },
  }))
  assert.equal(response.status, 303)
  assert.equal(response.headers.get("location"), `https://bookworm.test${expectedPath}`)
  const cookies = response.headers.getSetCookie()
  assert.ok(cookies.some((value) => value.includes("code-verifier=;")), "Callback must clear the verifier")
  assert.ok(cookies.some((value) => value.includes("sb-example-auth-token=")), "Callback must write the session")
}

await callback("/")
onboardingCompletedAt = null
await callback("/onboarding")

console.log("Google OAuth PKCE initiation, session exchange, sign-in, and sign-up redirects passed.")
