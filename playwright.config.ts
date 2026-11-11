import { defineConfig, devices } from "@playwright/test"

const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim()
const requireRemoteBaseURL = process.env.PLAYWRIGHT_REQUIRE_BASE_URL === "1"
const baseURL = remoteBaseURL || "http://localhost:3000"

if (requireRemoteBaseURL && !remoteBaseURL) {
  throw new Error("Set PLAYWRIGHT_BASE_URL before running production smoke tests.")
}

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: remoteBaseURL
    ? undefined
    : {
        command: "pnpm dev --port 3000",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
