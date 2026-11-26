import { queryOptions } from "@tanstack/react-query"
import { getNotificationFirstPage } from "./read.functions"

export function notificationListQuery() {
  return queryOptions({
    queryKey: ["notifications", "list"] as const,
    queryFn: () => getNotificationFirstPage(),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  })
}
