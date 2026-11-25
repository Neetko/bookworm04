import { queryOptions } from "@tanstack/react-query"
import { getMessageDetail, getMessageList, type MessageFolder } from "./read.functions"

export function messageListQuery(folder: MessageFolder, page: number) {
  return queryOptions({
    queryKey: ["messages", "list", folder, page] as const,
    queryFn: () => getMessageList({ data: { folder, page } }),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  })
}

export function messageDetailQuery(id: string) {
  return queryOptions({
    queryKey: ["messages", "detail", id] as const,
    queryFn: () => getMessageDetail({ data: { id } }),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  })
}
