import "server-only"

export function isPostgresUniqueViolation(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: unknown }).code === "23505"
  )
}
