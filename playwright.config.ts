import { defineConfig } from "@playwright/test";

const agentDemoMode = process.env.AUTOSCRIPTS_AGENT_DEMO === "1";

export default defineConfig({
  testDir: "./tests",
  ...(agentDemoMode
    ? {
        use: {
          headless: false,
          launchOptions: { slowMo: 700 },
        },
      }
    : {}),
});
