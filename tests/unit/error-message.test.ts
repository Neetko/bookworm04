import { describe, expect, it } from "vitest"
import { getErrorMessage } from "@/lib/errors"

describe("getErrorMessage", () => {
  it("returns the message from an Error", () => {
    expect(getErrorMessage(new Error("Request failed"), "Fallback")).toBe("Request failed")
  })

  it("supports serialized error-shaped values", () => {
    expect(getErrorMessage({ message: "Not allowed" }, "Fallback")).toBe("Not allowed")
  })

  it("uses the fallback for unknown or empty values", () => {
    expect(getErrorMessage({ message: "  " }, "Fallback")).toBe("Fallback")
    expect(getErrorMessage(null, "Fallback")).toBe("Fallback")
  })
})
