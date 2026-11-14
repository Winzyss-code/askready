import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.ASKREADY_TEST_URL || "http://localhost:3000",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: [
      "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${join(tmpdir(), "askready-voice-fixture.wav")}%noloop`,
    ] },
    screenshot: "only-on-failure",
  },
});
