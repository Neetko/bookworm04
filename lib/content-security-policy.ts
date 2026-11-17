const IMAGE_SOURCES = [
  "https://covers.openlibrary.org",
  "https://books.google.com",
  "https://books.googleusercontent.com",
]

export function buildContentSecurityPolicy(input: {
  nonce: string
  supabaseUrl: string
  isDevelopment: boolean
}) {
  const supabase = new URL(input.supabaseUrl)
  const supabaseOrigin = supabase.origin
  const realtimeOrigin = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${input.nonce}' 'strict-dynamic'${input.isDevelopment ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    // React components and Radix use style attributes; script execution remains nonce-gated.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin} ${IMAGE_SOURCES.join(" ")}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} ${realtimeOrigin}${input.isDevelopment ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(input.isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}
