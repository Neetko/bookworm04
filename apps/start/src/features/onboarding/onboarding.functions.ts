import { createServerFn } from "@tanstack/react-start"
import { getOnboardingIdentity } from "./profile.server"
import {
  isPlaceholderUsername,
  normalizeFavoriteGenres,
  normalizeUsername,
  sanitizeUsername,
  usernameError,
} from "./validation"

function escapeLikeLiteral(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

export const getOnboardingState = createServerFn({ method: "GET" }).handler(async () => {
  const identity = await getOnboardingIdentity()
  if (identity.status !== "ok") return identity
  return {
    status: identity.profile.onboarding_completed_at ? "complete" as const : "ok" as const,
    username: isPlaceholderUsername(identity.profile.username) ? "" : sanitizeUsername(identity.profile.username),
    favoriteGenres: normalizeFavoriteGenres(identity.profile.favorite_genres),
  }
})

export const checkOnboardingUsername = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({
    username: input && typeof input === "object" && "username" in input
      ? sanitizeUsername(input.username).slice(0, 101)
      : "",
  }))
  .handler(async ({ data }) => {
    const validationError = usernameError(data.username)
    if (validationError) return { status: "invalid" as const, available: false, message: validationError }

    const identity = await getOnboardingIdentity()
    if (identity.status !== "ok") return { status: identity.status, available: false, message: "Sign in again to continue" }

    const { data: matches, error } = await identity.admin.from("user_profiles")
      .select("auth_user_id,username")
      .ilike("username", escapeLikeLiteral(data.username))
      .limit(5)
    if (error) return { status: "unavailable" as const, available: false, message: "Could not check username" }
    const wanted = normalizeUsername(data.username)
    const collision = (matches ?? []).some((row) =>
      row.auth_user_id !== identity.user.id && normalizeUsername(row.username) === wanted
    )
    return {
      status: "ok" as const,
      available: !collision,
      message: collision ? "That username is already taken" : "Username available",
    }
  })
