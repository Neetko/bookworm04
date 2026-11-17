import { describe, expect, it } from "vitest"
import { isPostgresUniqueViolation } from "@/lib/server/postgres-errors"

describe("isPostgresUniqueViolation", () => {
  it("recognizes a Postgres unique-constraint error", () => {
    expect(isPostgresUniqueViolation({ code: "23505" })).toBe(true)
  })

  it("rejects unrelated and malformed errors", () => {
    expect(isPostgresUniqueViolation({ code: "23503" })).toBe(false)
    expect(isPostgresUniqueViolation(new Error("duplicate"))).toBe(false)
    expect(isPostgresUniqueViolation(null)).toBe(false)
  })
})
