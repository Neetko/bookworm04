export function appOrigin() {
  const configured = process.env.PUBLIC_APP_ORIGIN?.trim()
  const origin = configured || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3101")
  if (!origin) throw new Error("PUBLIC_APP_ORIGIN is required")

  const parsed = new URL(origin)
  if (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error("PUBLIC_APP_ORIGIN must be an origin")
  }
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:" && !isLocal) {
    throw new Error("PUBLIC_APP_ORIGIN must use HTTPS in production")
  }
  return parsed.origin
}

export function sameOriginPath(path: string) {
  return new URL(path, `${appOrigin()}/`).toString()
}
