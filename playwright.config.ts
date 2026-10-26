import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "packages/client/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "npm run dev -w @clave/server",
      url: "http://127.0.0.1:8787/healthz",
      reuseExistingServer: !process.env.CI,
      // Rooms a run leaves unfinished hold their place for 72 hours, and only fifty may be
      // open at once — enough runs against a stored database and every online spec fails
      // with "The dance floor is full". The suite dances on a floor it sweeps every time.
      env: { CLAVE_DB_PATH: ":memory:" },
    },
    {
      command: "npm run dev -w @clave/client -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
