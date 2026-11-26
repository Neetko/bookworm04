import { queryOptions } from "@tanstack/react-query"
import { getDiary } from "./diary.functions"
import type { DiarySearch } from "./validation"

export function diaryQuery(search: DiarySearch) {
  return queryOptions({
    queryKey: ["diary", search] as const,
    queryFn: () => getDiary({ data: search }),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  })
}
