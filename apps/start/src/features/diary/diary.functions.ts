import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { loadDiary } from "./diary.server"
import { normalizeDiarySearch } from "./validation"

const searchSchema = z.object({
  filterBy: z.enum(["none", "genre", "author", "title"]),
  genres: z.string().max(500),
  author: z.string().max(200),
  title: z.string().max(200),
}).strict()

export const getDiary = createServerFn({ method: "GET" })
  .validator(searchSchema)
  .handler(({ data }) => loadDiary(normalizeDiarySearch(data)))
