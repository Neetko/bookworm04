import { createServerFn } from "@tanstack/react-start"
import { loadOwnProfile } from "./profile.server"

export const getOwnProfile = createServerFn({ method: "GET" })
  .handler(loadOwnProfile)
