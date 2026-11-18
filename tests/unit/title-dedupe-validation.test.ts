import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { parseTitleDedupeSubmissionInput, titleDedupeSubmissionSchema } from "@/lib/validation/title-dedupe"

const titleId = randomUUID()

function selectedWork(index: number) {
  return {
    workId: `OL${index}W`,
    title: `Work ${index}`,
    author: "A. Author",
    firstPublishYear: 1900,
    editionCount: 2,
    coverUrl: "https://covers.openlibrary.org/b/id/12345-M.jpg?default=false",
    subjects: ["Literature"],
  }
}

describe("title dedupe submission boundary", () => {
  it("accepts at most the fifteen works shown by the search and strips extra fields", () => {
    const works = Array.from({ length: 15 }, (_, index) => ({
      ...selectedWork(index + 1),
      linkedElsewhereTitles: [{ title: "Untrusted extra data" }],
    }))

    const valid = titleDedupeSubmissionSchema.safeParse({ titleId, selectedWorks: works })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.selectedWorks).toHaveLength(15)
      expect(valid.data.selectedWorks[0]).not.toHaveProperty("linkedElsewhereTitles")
    }

    expect(titleDedupeSubmissionSchema.safeParse({
      titleId,
      selectedWorks: [...works, selectedWork(16)],
    }).success).toBe(false)
  })

  it("rejects arbitrary work IDs, oversized metadata, and non-Open-Library cover URLs", () => {
    expect(titleDedupeSubmissionSchema.safeParse({
      titleId,
      selectedWorks: [{ ...selectedWork(1), workId: "../../internal" }],
    }).success).toBe(false)

    expect(titleDedupeSubmissionSchema.safeParse({
      titleId,
      selectedWorks: [{ ...selectedWork(1), subjects: ["x".repeat(201)] }],
    }).success).toBe(false)

    expect(titleDedupeSubmissionSchema.safeParse({
      titleId,
      selectedWorks: [{ ...selectedWork(1), coverUrl: "https://google.example.test/cover.jpg" }],
    }).success).toBe(false)
  })

  it("rejects oversized arrays before parsing their elements", () => {
    const works = new Array(16).fill(null)
    Object.defineProperty(works, 0, {
      get() { throw new Error("Visited an oversized work") },
    })

    expect(() => parseTitleDedupeSubmissionInput({ titleId, selectedWorks: works }))
      .toThrow("Too many selected Open Library works")
    expect(() => parseTitleDedupeSubmissionInput({
      titleId,
      selectedWorks: [{ ...selectedWork(1), subjects: new Array(31).fill("Literature") }],
    })).toThrow("Too many Open Library subjects")
  })
})
