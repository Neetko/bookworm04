import { queryOptions } from "@tanstack/react-query"
import { getOwnProfile } from "./profile.functions"

export function ownProfileQuery() {
  return queryOptions({
    queryKey: ["profile", "own"] as const,
    queryFn: () => getOwnProfile(),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  })
}
