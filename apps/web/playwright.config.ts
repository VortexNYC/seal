import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from "dotenv";

import { authStatePath } from "./e2e/fixtures/paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* 2 workers on CI (matches 2-vCPU runner) — serial describe blocks handle
     their own ordering, so file-level parallelism is safe. */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["junit", { outputFile: "playwright-report/results.xml" }],
    ["list"],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5180",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video on failure */
    video: "retain-on-failure",

    /* Navigation timeout — fail fast, don't burn 30s waiting */
    navigationTimeout: 10000,

    /* Action timeout — clicks/fills should resolve in <5s */
    actionTimeout: 5000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "setup-auth",
      testMatch: "**/auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "setup-app",
      testMatch: "**/app.setup.ts",
      dependencies: ["setup-auth"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
    },
    {
      name: "setup-backend",
      testMatch: "**/backend.setup.ts",
      dependencies: ["setup-app"],
    },
    {
      name: "smoke-contract",
      testMatch: "**/smoke-contract.e2e.ts",
      dependencies: ["setup-backend"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
    },
    {
      name: "chromium",
      testMatch: "**/*.e2e.ts",
      testIgnore: "**/smoke-contract.e2e.ts",
      dependencies: ["smoke-contract"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
    },

    {
      name: "firefox",
      testMatch: "**/*.e2e.ts",
      testIgnore: "**/smoke-contract.e2e.ts",
      dependencies: ["smoke-contract"],
      use: {
        ...devices["Desktop Firefox"],
        storageState: authStatePath,
      },
    },

    {
      name: "webkit",
      testMatch: "**/*.e2e.ts",
      testIgnore: "**/smoke-contract.e2e.ts",
      dependencies: ["smoke-contract"],
      use: {
        ...devices["Desktop Safari"],
        storageState: authStatePath,
      },
    },

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome",
      testMatch: "**/*.e2e.ts",
      testIgnore: "**/smoke-contract.e2e.ts",
      dependencies: ["smoke-contract"],
      use: {
        ...devices["Pixel 5"],
        storageState: authStatePath,
      },
    },
    {
      name: "Mobile Safari",
      testMatch: "**/*.e2e.ts",
      testIgnore: "**/smoke-contract.e2e.ts",
      dependencies: ["smoke-contract"],
      use: {
        ...devices["iPhone 12"],
        storageState: authStatePath,
      },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:5180",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120000,
  },

  /* Global timeout — 20s per test, not 60s */
  timeout: 20000,

  /* Expect timeout — assertions fail in 5s, not 10s */
  expect: {
    timeout: 5000,
  },

  /* Output folder for test artifacts */
  outputDir: "test-results",
});
