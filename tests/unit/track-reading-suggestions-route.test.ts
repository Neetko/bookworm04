import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerClient } from "@/lib/supabase-server"
import { GET } from "@/app/api/track-reading/suggestions/route"
import { createFakeSupabase } from "./fake-supabase"

vi.mock("@/lib/supabase-server", () => ({ createServerClient: vi.fn() }))

function request(params: Record<string, string>) {
  const url = new URL("https://bookworm.test/api/track-reading/suggestions")
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return new Request(url)
}

describe("reading suggestion search", () => {
  beforeEach(() => vi.clearAllMocks())

  it("combines raw title and author matches, preserving eight recent genre matches", async () => {
    const titles = Array.from({ length: 12 }, (_, index) => ({
      id: `title-${index}`,
      title: index % 2 === 0 ? `Book ${index}` : `Other ${index}`,
      author: index % 2 === 0 ? `Author ${index}` : `Book Writer ${index}`,
      created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      genre: [index === 11 ? "HORROR" : "FANTASY"],
    }))
    const fake = createFakeSupabase({ tables: { titles } })
    let orCalls = 0
    vi.mocked(createServerClient).mockResolvedValue({
      ...fake,
      from(table: string) {
        const query = fake.from(table)
        query.or = () => {
          orCalls += 1
          throw new Error("Search text was parsed as a combined filter")
        }
        return query
      },
    } as any)

    const response = await GET(request({ q: "Book", genres: "FANTASY" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results.map((result: { id: string }) => result.id)).toEqual([
      "title-10", "title-9", "title-8", "title-7",
      "title-6", "title-5", "title-4", "title-3",
    ])
    expect(body.results[0]).toEqual({ id: "title-10", title: "Book 10", author: "Author 10" })
    expect(orCalls).toBe(0)
  })

  it("rejects oversized text and genre input before requesting the database", async () => {
    const longText = "x".repeat(201)
    expect((await GET(request({ q: longText }))).status).toBe(400)
    expect((await GET(request({ title: longText }))).status).toBe(400)
    expect((await GET(request({ author: longText }))).status).toBe(400)
    expect((await GET(request({ q: "Book", genres: longText }))).status).toBe(400)
    expect(createServerClient).not.toHaveBeenCalled()
  })
})
