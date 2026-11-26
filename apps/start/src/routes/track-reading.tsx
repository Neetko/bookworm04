import { createFileRoute, redirect } from "@tanstack/react-router"
import { normalizeCatalogSearch } from "../features/titles/catalog"

export const Route = createFileRoute("/track-reading")({
  validateSearch: (search) => ({
    q: typeof search.q === "string" ? search.q.trim().slice(0, 100) : "",
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/search-titles",
      search: normalizeCatalogSearch({ q: search.q }),
      replace: true,
    })
  },
})
