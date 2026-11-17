import { chromium } from "@playwright/test"
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import sharp from "sharp"

const baseURL = (process.env.SHOWCASE_BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const outputDirectory = path.join(process.cwd(), "docs", "images")

const demoReader = {
  email: process.env.SHOWCASE_DEMO_EMAIL || "demo@bookworm.test",
  password: process.env.SHOWCASE_DEMO_PASSWORD || "BookwormDemo!2026",
  username: process.env.SHOWCASE_DEMO_USERNAME || "Demo Reader",
}

const frankensteinId = "8118851f-6df9-4724-bfe2-20495087fd3b"

async function waitForVisuals(page) {
  await page.waitForLoadState("domcontentloaded")
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
  await page.evaluate(async () => {
    document.querySelectorAll("nextjs-portal").forEach((portal) => {
      portal.style.display = "none"
    })

    const ready = Promise.all([
      document.fonts.ready,
      ...Array.from(document.images, (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true })
              image.addEventListener("error", resolve, { once: true })
            })
      ),
    ])
    await Promise.race([ready, new Promise((resolve) => window.setTimeout(resolve, 8_000))])
  })
}

async function saveWebp(page, filename, options = {}) {
  const png = await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    type: "png",
    ...options,
  })

  const destination = path.join(outputDirectory, filename)
  await sharp(png).webp({ quality: 84, effort: 6 }).toFile(destination)

  const { size } = await fs.stat(destination)
  process.stdout.write(`${filename}: ${Math.ceil(size / 1024)} KB\n`)
}

async function signInAsDemoReader(page) {
  await page.goto(`${baseURL}/`)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByLabel("Email address").fill(demoReader.email)
  await page.getByLabel("Your Password").fill(demoReader.password)
  await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("heading", { name: "Welcome back" }).waitFor()
  await page.getByRole("button", { name: new RegExp(demoReader.username, "i") }).waitFor()
}

await fs.mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch()

try {
  const desktop = await browser.newContext({
    colorScheme: "dark",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  })

  const guest = await desktop.newPage()
  guest.setDefaultTimeout(15_000)
  process.stdout.write("Capturing guest catalog…\n")
  await guest.goto(`${baseURL}/search-titles`)
  await guest.getByRole("heading", { name: "Search Titles" }).waitFor()
  await waitForVisuals(guest)
  await saveWebp(guest, "bookworm-catalog.webp")

  await guest.setViewportSize({ width: 1440, height: 1100 })
  process.stdout.write("Capturing guest title discussion…\n")
  await guest.goto(`${baseURL}/titles/${frankensteinId}`)
  await guest.getByRole("heading", { name: "Frankenstein" }).waitFor()
  await guest.getByRole("tab", { name: "Discussion" }).click()
  await guest.getByText("Read-only discussion").waitFor()
  await waitForVisuals(guest)
  await saveWebp(guest, "bookworm-title-discussion.webp")
  await desktop.close()

  const signedIn = await browser.newContext({
    colorScheme: "dark",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  })
  const readerHome = await signedIn.newPage()
  readerHome.setDefaultTimeout(15_000)
  process.stdout.write("Capturing signed-in reader home…\n")
  await signInAsDemoReader(readerHome)
  await readerHome.getByText("Ava Quill").first().waitFor()
  await waitForVisuals(readerHome)
  await saveWebp(readerHome, "bookworm-reader-home.webp")
  await signedIn.close()

  const mobile = await browser.newContext({
    colorScheme: "dark",
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  })
  const mobileCatalog = await mobile.newPage()
  mobileCatalog.setDefaultTimeout(15_000)
  process.stdout.write("Capturing mobile catalog…\n")
  await mobileCatalog.goto(`${baseURL}/search-titles`)
  await mobileCatalog.getByRole("heading", { name: "Search Titles" }).waitFor()
  await waitForVisuals(mobileCatalog)
  await saveWebp(mobileCatalog, "bookworm-mobile-catalog.webp")
  await mobile.close()
} finally {
  await browser.close()
}
