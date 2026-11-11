type ExternalJsonFetchOptions = {
  source: string
  timeoutMs?: number
  retries?: number
  revalidateSeconds?: number
  init?: RequestInit & { next?: { revalidate?: number } }
}

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_REVALIDATE_SECONDS = 60 * 60 * 24
const DEFAULT_RETRY_DELAY_MS = 150
const MAX_RETRY_DELAY_MS = 2_000

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after")?.trim()
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, seconds * 1_000))
    }

    const retryAt = Date.parse(retryAfter)
    if (Number.isFinite(retryAt)) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, retryAt - Date.now()))
    }
  }

  return Math.min(MAX_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS * (attempt + 1))
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500
}

export async function fetchExternalJson<T>(
  input: string | URL,
  options: ExternalJsonFetchOptions
): Promise<T | null> {
  const url = input.toString()
  const retries = Math.max(0, options.retries ?? 1)
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        ...options.init,
        signal: controller.signal,
        cache: options.init?.cache ?? "force-cache",
        next: options.init?.next ?? { revalidate: options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS },
      })

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < retries) {
          await wait(getRetryDelayMs(response, attempt))
          continue
        }
        console.warn(`${options.source} failed`, response.status)
        return null
      }

      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await wait(Math.min(MAX_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS * (attempt + 1)))
        continue
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  console.warn(`${options.source} failed (network/parse)`, lastError)
  return null
}
