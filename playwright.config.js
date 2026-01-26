import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "playwright-report/test-results",
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});
