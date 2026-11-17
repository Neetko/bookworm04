import { describe, expect, it } from "vitest"
import { buildContentSecurityPolicy } from "@/lib/content-security-policy"

describe("content security policy", () => {
  it("blocks executable message payloads and external exfiltration in production", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      supabaseUrl: "https://example.supabase.co",
      isDevelopment: false,
    })

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'")
    expect(policy).toContain("script-src-attr 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("base-uri 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("connect-src 'self' https://example.supabase.co wss://example.supabase.co")
    expect(policy).toContain("img-src 'self' data: blob: https://example.supabase.co")
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).not.toMatch(/script-src [^;]*'unsafe-inline'/)
    expect(policy).not.toContain("https://attacker.example")
  })

  it("permits development tools without weakening production scripts", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "dev-nonce",
      supabaseUrl: "http://127.0.0.1:54321",
      isDevelopment: true,
    })

    expect(policy).toContain("'unsafe-eval'")
    expect(policy).toContain("ws://127.0.0.1:54321")
    expect(policy).not.toContain("upgrade-insecure-requests")
  })
})
