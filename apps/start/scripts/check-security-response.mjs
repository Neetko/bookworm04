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
console.log(`Security headers passed on public, 404, and mutation responses; ${first.scriptCount} scripts use each fresh nonce.`)
