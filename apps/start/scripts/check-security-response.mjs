import assert from "node:assert/strict"

const url = process.env.START_PREVIEW_URL ?? "http://127.0.0.1:3101/"

async function inspectResponse(path = "/", expectedStatus = 200) {
  const response = await fetch(new URL(path, url), { cache: "no-store" })
  const html = await response.text()
  const csp = response.headers.get("content-security-policy") ?? ""
  const nonce = csp.match(/'nonce-([a-f0-9]{32})'/)?.[1]

  assert.equal(response.status, expectedStatus)
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0")
  assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin")
  assert.match(csp, /script-src-attr 'none'/)
  assert.doesNotMatch(csp, /'unsafe-inline'/)
  assert.ok(nonce, "missing 128-bit CSP nonce")

  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(([tag]) => tag)
  assert.ok(scripts.length > 0, "no rendered scripts to inspect")
  for (const script of scripts) {
    assert.match(script, new RegExp(`\\bnonce="${nonce}"`))
  }
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/)

  return { nonce, scriptCount: scripts.length, html }
}

const first = await inspectResponse()
const second = await inspectResponse()
const about = await inspectResponse("/about")
await inspectResponse("/__missing_route__", 404)
await inspectResponse("/messages/not-a-uuid?folder=inbox&page=1", 404)
assert.notEqual(first.nonce, second.nonce, "CSP nonce was reused across requests")
assert.notEqual(first.nonce, about.nonce, "CSP nonce was reused on the public route")
assert.match(about.html, /About Bookworm \| Bookworm/)
assert.match(about.html, /about-[A-Za-z0-9_-]+\.css/)

async function inspectMutation(headers, expectedStatus) {
  const response = await fetch(new URL("/api/security-check", url), {
    method: "POST",
    headers,
  })

  assert.equal(response.status, expectedStatus)
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0")
  assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin")
}

await inspectMutation({ Origin: new URL(url).origin }, 204)
await inspectMutation({ Origin: "https://cross-origin.invalid" }, 403)
await inspectMutation({ "Sec-Fetch-Site": "cross-site", Origin: new URL(url).origin }, 403)
await inspectMutation({}, 403)

for (const path of [
  "/messages?folder=inbox&page=1",
  "/messages/00000000-0000-0000-0000-000000000000?folder=inbox&page=1",
  "/onboarding",
  "/notifications",
  "/profile",
  "/diary?filterBy=none&genres=&author=&title=",
]) {
  const messagesRedirect = await fetch(new URL(path, url), {
    cache: "no-store",
    redirect: "manual",
  })
  assert.equal(messagesRedirect.status, 307)
  assert.equal(messagesRedirect.headers.get("location"), "/auth")
  assert.equal(messagesRedirect.headers.get("cache-control"), "private, no-store, max-age=0")
}

const trackReadingRedirect = await fetch(new URL("/track-reading?q=Dune", url), {
  cache: "no-store",
  redirect: "manual",
})
assert.equal(trackReadingRedirect.status, 307)
assert.match(trackReadingRedirect.headers.get("location") ?? "", /^\/search-titles\?/)
assert.equal(trackReadingRedirect.headers.get("cache-control"), "private, no-store, max-age=0")

async function inspectMessageWrite(payload, expectedStatus) {
  const response = await fetch(new URL("/api/messages", url), {
    method: "POST",
    headers: {
      Origin: new URL(url).origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  assert.equal(response.status, expectedStatus)
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0")
}

await inspectMessageWrite({ title: "Hello", recipient: "reader", body: "Hello" }, 401)
await inspectMessageWrite({ title: "Hello", recipient: "reader", body: "x".repeat(100_001) }, 413)

async function inspectOnboardingWrite(payload, expectedStatus) {
  const response = await fetch(new URL("/api/onboarding/complete", url), {
    method: "POST",
    headers: {
      Origin: new URL(url).origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  assert.equal(response.status, expectedStatus)
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0")
}

await inspectOnboardingWrite({ username: "Reader", favoriteGenres: ["FANTASY"] }, 401)
await inspectOnboardingWrite({ username: "Reader", favoriteGenres: ["x".repeat(16_001)] }, 413)

for (const path of ["/api/notifications", "/api/notifications/counts"]) {
  const response = await fetch(new URL(path, url), { cache: "no-store" })
  assert.equal(response.status, 401)
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0")
}

async function inspectNotificationWrite(path, method, payload, expectedStatus) {
  const response = await fetch(new URL(path, url), {
    method,
    headers: {
      Origin: new URL(url).origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  assert.equal(response.status, expectedStatus)
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0")
}

await inspectNotificationWrite("/api/notifications", "PATCH", { markAll: true }, 401)
await inspectNotificationWrite("/api/notifications", "PATCH", { id: "x".repeat(4_097) }, 413)
await inspectNotificationWrite("/api/notifications/invitation", "POST", {
  invitationId: "00000000-0000-4000-8000-000000000001",
  action: "accept",
}, 401)
await inspectNotificationWrite("/api/notifications/invitation", "POST", { action: "x".repeat(4_097) }, 413)

async function inspectProfileWrite(payload, expectedStatus) {
  const response = await fetch(new URL("/api/profile", url), {
    method: "PATCH",
    headers: {
      Origin: new URL(url).origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  assert.equal(response.status, expectedStatus)
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0")
}

await inspectProfileWrite({ username: "Reader", bio: "Hello" }, 401)
await inspectProfileWrite({ username: "Reader", bio: "x".repeat(8_193) }, 413)

async function inspectDiaryWrite(method, payload, expectedStatus) {
  const response = await fetch(new URL("/api/diary", url), {
    method,
    headers: {
      Origin: new URL(url).origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  assert.equal(response.status, expectedStatus)
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0")
}

await inspectDiaryWrite("POST", {
  titleId: "00000000-0000-0000-0000-000000000000",
  progress: { mode: "pages", currentPage: 1, totalPages: 100 },
  noteText: "Safe note",
}, 401)
await inspectDiaryWrite("PATCH", {
  entryId: "00000000-0000-0000-0000-000000000000",
  noteText: "Safe note",
}, 401)
await inspectDiaryWrite("PATCH", {
  entryId: "00000000-0000-0000-0000-000000000000",
  noteText: "x".repeat(64_001),
}, 413)
console.log(`Security headers passed on public, 404, and mutation responses; ${first.scriptCount} scripts use each fresh nonce.`)
