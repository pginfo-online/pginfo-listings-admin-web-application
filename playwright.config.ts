import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.ADMIN_E2E_ORIGIN ?? "http://localhost:3000";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  workers: 1,
  timeout: 60000,
  reporter: "list",
});
