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

  return { nonce, scriptCount: scripts.length }
}

const first = await inspectResponse()
const second = await inspectResponse()
await inspectResponse("/__missing_route__", 404)
assert.notEqual(first.nonce, second.nonce, "CSP nonce was reused across requests")
console.log(`Security headers passed on 200 and 404; ${first.scriptCount} scripts use each fresh nonce.`)
