// Every project runs against the built site as the Worker will serve it: `pnpm preview`
// (wrangler dev on PREVIEW_PORT, default 8788) applies _headers and _redirects and the 404
// handling; a second checkout sets its own port so the two never read each other's build. Set
// PLAYWRIGHT_BASE_URL to run against a deployed preview instead, in which case no server is
// started. Projects: a11y in both themes (axe, keyboard, reduced motion, reflow, theme),
// behaviour (content, disclosures, mobile menu, network), screens (the seven widths in both
// themes, attached as artifacts), headers (the response headers, also run against the deployed
// preview) and pdf (the résumé file).
import { defineConfig, devices } from "@playwright/test";

const port = process.env.PREVIEW_PORT ?? "8788";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const chrome = devices["Desktop Chrome"];
const a11ySpecs = /e2e[\\/](a11y|keyboard|reduced-motion|reflow|theme)\.spec\.ts$/;

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A handful of workers: the screens project opens sixteen contexts, and the preview is one
  // wrangler process that should not be swamped.
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "a11y-light", testMatch: a11ySpecs, use: { ...chrome, colorScheme: "light" } },
    { name: "a11y-dark", testMatch: a11ySpecs, use: { ...chrome, colorScheme: "dark" } },
    {
      name: "behaviour",
      testMatch: /e2e[\\/](content|disclosure|mobile-menu|network)\.spec\.ts$/,
      use: { ...chrome },
    },
    { name: "screens", testMatch: /e2e[\\/]screenshots\.spec\.ts$/, use: { ...chrome } },
    { name: "headers", testMatch: /e2e[\\/]headers\.spec\.ts$/ },
    { name: "pdf", testMatch: /pdf\.spec\.ts$/, use: { ...chrome } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm preview",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 90_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
