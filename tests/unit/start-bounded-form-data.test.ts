import { describe, expect, it } from "vitest"
import { readBoundedFormData } from "../../apps/start/src/server/bounded-form-data.server"

describe("TanStack bounded multipart reader", () => {
  it("parses multipart data within the byte limit", async () => {
    const form = new FormData()
    form.set("file", new File(["safe"], "avatar.txt", { type: "text/plain" }))
    const request = new Request("https://bookworm.test/upload", { method: "POST", body: form })
    const result = await readBoundedFormData(request, 4_096)
    expect(result.ok).toBe(true)
    if (result.ok) expect((result.value.get("file") as File).name).toBe("avatar.txt")
  })

  it("rejects a declared body larger than the limit without parsing it", async () => {
    const request = new Request("https://bookworm.test/upload", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=x",
        "Content-Length": "4097",
      },
      body: "--x--",
    })
    await expect(readBoundedFormData(request, 4_096)).resolves.toEqual({
      ok: false,
      status: 413,
      error: "Upload is too large",
    })
  })

  it("rejects non-multipart input", async () => {
    const request = new Request("https://bookworm.test/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
    const result = await readBoundedFormData(request, 4_096)
    expect(result).toEqual({ ok: false, status: 415, error: "Expected multipart form data" })
  })
})
