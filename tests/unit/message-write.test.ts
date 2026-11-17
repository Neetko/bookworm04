import { describe, expect, it } from "vitest"
import { MAX_MESSAGE_REQUEST_BYTES, parseMessageWrite, readMessageJson } from "@/lib/message-write"

describe("message writes", () => {
  it("sanitizes executable markup and rejects hidden, oversized, or forged fields", () => {
    const valid = parseMessageWrite({
      title: "Hello",
      recipient: "reader",
      body: '<p>Hi</p><img src=x onerror="alert(1)">',
      status: "sent",
    })
    expect(valid?.body).toBe("<p>Hi</p>")
    expect(parseMessageWrite({ title: "Hello", recipient: "reader", body: "<img src=x>" })).toBeNull()
    expect(parseMessageWrite({ title: "Hello", recipient: "reader", body: "Hi", sender_profile_id: "forged" })).toBeNull()
    expect(parseMessageWrite({ title: "Hello", recipient: "reader", body: "x".repeat(20_001) })).toBeNull()
    expect(parseMessageWrite({ title: "Hello", body: "Hi" })).toBeNull()
  })

  it("bounds the actual request body even when the length header is absent", async () => {
    const request = new Request("https://bookworm.example/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "x".repeat(MAX_MESSAGE_REQUEST_BYTES) }),
    })
    expect(await readMessageJson(request)).toMatchObject({ ok: false, status: 413 })
  })

  it("rejects malformed or non-JSON input", async () => {
    const malformed = new Request("https://bookworm.example/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    })
    expect(await readMessageJson(malformed)).toMatchObject({ ok: false, status: 400 })

    const wrongType = new Request("https://bookworm.example/api/messages", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    })
    expect(await readMessageJson(wrongType)).toMatchObject({ ok: false, status: 415 })
  })
})
