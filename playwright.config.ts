import { defineConfig } from "@playwright/test";

const agentDemoMode = process.env.AUTOSCRIPTS_AGENT_DEMO === "1";

export default defineConfig({
  testDir: "./tests",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(agentDemoMode ? { headless: false, launchOptions: { slowMo: 700 } } : {}),
  },
});
