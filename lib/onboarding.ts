export const PLACEHOLDER_USERNAME_PREFIX = "Bookworm"
export const MAX_USERNAME_LENGTH = 100

export function sanitizeUsernameInput(value: string | null | undefined) {
  return (value ?? "").trim()
}

export function normalizeUsernameLookup(value: string | null | undefined) {
  return sanitizeUsernameInput(value).toLocaleLowerCase()
}

export function validateUsernameInput(value: string | null | undefined) {
  const username = sanitizeUsernameInput(value)

  if (!username) return "Username is required"
  if (username.length > MAX_USERNAME_LENGTH) {
    return `Username must be ${MAX_USERNAME_LENGTH} characters or fewer`
  }

  return null
}

export function isPlaceholderUsername(value: string | null | undefined) {
  const username = sanitizeUsernameInput(value)
  if (!username) return false

  return /^Bookworm(?:\d{4}|[a-f0-9]{8})$/i.test(username)
}
