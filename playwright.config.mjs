import { defineConfig } from "@playwright/test";

const externalBaseUrl = process.env.LEADTEK_TEST_URL;

export default defineConfig({
  testDir: "tests",
  outputDir: "/tmp/leadtek-report-test-results",
  webServer: externalBaseUrl ? undefined : {
    command: "node scripts/serve-static.mjs 18180",
    url: "http://127.0.0.1:18180/",
    reuseExistingServer: false,
    timeout: 10000,
  },
  use: {
    baseURL: externalBaseUrl || "http://127.0.0.1:18180/",
    browserName: "chromium",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
});
