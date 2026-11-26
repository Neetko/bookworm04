type BoundedFormDataResult =
  | { ok: true; value: FormData }
  | { ok: false; status: number; error: string }

export async function readBoundedFormData(
  request: Request,
  maxBytes: number,
): Promise<BoundedFormDataResult> {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return { ok: false, status: 415, error: "Expected multipart form data" }
  }

  const contentLength = request.headers.get("content-length")
  if (contentLength) {
    const declaredBytes = Number(contentLength)
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      return { ok: false, status: 400, error: "Invalid content length" }
    }
    if (declaredBytes > maxBytes) {
      return { ok: false, status: 413, error: "Upload is too large" }
    }
  }

  if (!request.body) return { ok: false, status: 400, error: "Upload is empty" }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        return { ok: false, status: 413, error: "Upload is too large" }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, status: 400, error: "Could not read upload" }
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    const value = await new Response(body, {
      headers: { "Content-Type": contentType },
    }).formData()
    return { ok: true, value }
  } catch {
    return { ok: false, status: 400, error: "Invalid multipart form data" }
  }
}
