import { defineConfig } from "@playwright/test";

// Teste end-to-end pe aplicațiile reale (admin :3000, oaspeți :3001) și baza de date demo.
// Folosește Chrome-ul instalat local (fără descărcare de browsere). În CI: channel "chromium".
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 }, // prima compilare a unei pagini în modul dev durează
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    channel: process.env.CI ? undefined : "chrome",
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    { command: "pnpm --filter @adonis/admin dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 180_000 },
    { command: "pnpm --filter @adonis/guest dev", url: "http://localhost:3001", reuseExistingServer: true, timeout: 180_000 },
  ],
});
