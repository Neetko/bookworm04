import { defineConfig, devices } from "@playwright/test"

const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim()
const requireRemoteBaseURL = process.env.PLAYWRIGHT_REQUIRE_BASE_URL === "1"
const baseURL = remoteBaseURL || "http://localhost:3000"

if (requireRemoteBaseURL && !remoteBaseURL) {
  throw new Error("Set PLAYWRIGHT_BASE_URL before running production smoke tests.")
}

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
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
