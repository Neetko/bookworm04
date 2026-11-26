export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string }

export async function readBoundedJson(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return { ok: false, status: 415, error: "JSON request required" }
  }

  const statedLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(statedLength) && statedLength > maxBytes) {
    return { ok: false, status: 413, error: "Request is too large" }
  }
  if (!request.body) return { ok: false, status: 400, error: "Invalid JSON" }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let byteCount = 0
  let text = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteCount += value.byteLength
      if (byteCount > maxBytes) {
        await reader.cancel()
        return { ok: false, status: 413, error: "Request is too large" }
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" }
  } finally {
    reader.releaseLock()
  }
}
