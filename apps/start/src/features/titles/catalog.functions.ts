import { createServerFn } from "@tanstack/react-start"
import { getCatalogDetail, searchCatalog } from "./catalog.server"
import { normalizeCatalogSearch } from "./catalog"
import { searchExternalCatalog } from "./external.server"

export const getCatalogTitles = createServerFn({ method: "GET" })
  .validator((data: unknown) => normalizeCatalogSearch(data))
  .handler(({ data }) => searchCatalog(data))

export const getTitleDetail = createServerFn({ method: "GET" })
  .validator((data: unknown) => ({
    id: data && typeof data === "object" && "id" in data && typeof data.id === "string"
      ? data.id.slice(0, 100)
      : "",
  }))
  .handler(({ data }) => getCatalogDetail(data.id))

export const getCatalogSearchPage = createServerFn({ method: "GET" })
  .validator((data: unknown) => normalizeCatalogSearch(data))
  .handler(async ({ data }) => {
    const [titles, external] = await Promise.all([searchCatalog(data), searchExternalCatalog(data)])
    return { titles, external }
  })
