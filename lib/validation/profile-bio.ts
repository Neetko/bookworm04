export const MAX_PROFILE_BIO_LENGTH = 2_000

export function parseProfileBio(value: FormDataEntryValue | null): string {
  if (value === null) return ""
  if (typeof value !== "string") {
    throw new Error("Bio must be text")
  }
  if (value.length > MAX_PROFILE_BIO_LENGTH) {
    throw new Error(`Bio must be ${MAX_PROFILE_BIO_LENGTH} characters or fewer`)
  }
  return value
}
