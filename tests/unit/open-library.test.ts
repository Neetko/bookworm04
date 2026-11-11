import { describe, expect, it } from "vitest"
import { buildOpenLibraryCoverUrlFromCoverId } from "@/lib/open-library"

describe("Open Library helpers", () => {
  it("builds cover URLs for valid cover ids", () => {
    expect(buildOpenLibraryCoverUrlFromCoverId(123, "L")).toBe(
      "https://covers.openlibrary.org/b/id/123-L.jpg?default=false"
    )
  })

  it("ignores missing or invalid cover ids", () => {
    expect(buildOpenLibraryCoverUrlFromCoverId(null)).toBeNull()
    expect(buildOpenLibraryCoverUrlFromCoverId(0)).toBeNull()
  })
})
