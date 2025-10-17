import { test } from "@playwright/test";

// Placeholder smoke coverage. These scenarios require an HTTP server,
// which the CI harness wires up separately. Until that lands we keep
// them skipped so Playwright is on the radar without failing locally.
test.describe.skip("Startpage smoke", () => {
  test("focus input clears before navigation and on bfcache restore", async ({ page }) => {
    // TODO: Implement once we have an automated dev server in CI.
  });

  test("`bm ls` shows modal with bookmark aliases", async ({ page }) => {
    // TODO: Implement once modal hooks are exposed for E2E tests.
  });

  test("switching profiles updates document title", async ({ page }) => {
    // TODO: Implement when fixture profiles are available for tests.
  });

  test("`tz add UTC` updates the clocks panel", async ({ page }) => {
    // TODO: Implement when we can persist clock state across reloads in tests.
  });

  test("timer lifecycle covers add/list/remove", async ({ page }) => {
    // TODO: Implement when browser notifications/timers are stubbed for Playwright.
  });
});
