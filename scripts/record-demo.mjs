// Records one real session for the landing page: real models, real database, one new anonymous account
// (so it uses that account's free session). Run against a running app, then cut with the ffmpeg steps it prints.
//   node scripts/record-demo.mjs --base http://localhost:3000
// Writes the raw video and the moments worth keeping to test-results/demo/. Nothing here is mocked.
import { chromium } from "@playwright/test";
import { mkdir, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://localhost:3000";
const out = path.resolve("test-results/demo");
await mkdir(out, { recursive: true });

const viewport = { width: 400, height: 760 };
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport, deviceScaleFactor: 2, recordVideo: { dir: out, size: { width: viewport.width * 2, height: viewport.height * 2 } } });
const page = await context.newPage();
const started = Date.now();
const moments = [];
// A moment is a stretch of the recording to keep, and how much to speed it up.
const mark = (label, speed = 1) => { moments.push({ label, at: (Date.now() - started) / 1000, speed }); console.log(`${((Date.now() - started) / 1000).toFixed(1)}s ${label}`); };
const typeLike = async (locator, text) => { await locator.click(); await locator.pressSequentially(text, { delay: 12 }); };

try {
  await page.goto(`${base}/practice/raise?example=1`);
  await page.getByText("Example case loaded").waitFor();
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(600);
  mark("setup", 1.5);
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Start with this example" }).click();
  await page.getByRole("heading", { name: "Your intention" }).waitFor({ timeout: 60_000 });
  mark("opening", 1);
  await page.getByRole("status").filter({ hasText: /^Your turn$/ }).waitFor({ timeout: 60_000 });
  mark("answer", 2.5);
  const answer = page.getByRole("textbox", { name: "Your answer", exact: true });
  await typeLike(answer, "I hear you. I'm asking for a 10% raise. I cut weekly reporting from five hours to three.");
  await page.getByRole("button", { name: "Send answer", exact: true }).click();
  await page.waitForTimeout(400);
  mark("reply", 1);
  await page.getByRole("status").filter({ hasText: /^Your turn$/ }).waitFor({ timeout: 60_000 });
  mark("second answer", 3);
  await typeLike(answer, "Maybe we could look at it again sometime?");
  await page.getByRole("button", { name: "Send answer", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /^Your turn$/ }).waitFor({ timeout: 60_000 });
  mark("coaching", 2.5);
  await page.getByRole("button", { name: "Finish & get coaching" }).click();
  await page.getByRole("heading", { name: "Three changes to try" }).waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1200);
  mark("changes", 1.5);
  await page.getByRole("heading", { name: "Three changes to try" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(2200);
  await page.getByRole("link", { name: "Retry this moment" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.getByRole("link", { name: "Retry this moment" }).click();
  await page.getByText("Try:", { exact: true }).waitFor({ timeout: 60_000 });
  mark("retry", 2.5);
  await page.getByRole("button", { name: "Stop playback" }).click({ timeout: 5000 }).catch(() => undefined);
  await typeLike(answer, "I understand the budget is frozen. I'm asking for a 10% raise to start in the Q1 budget. I cut weekly reporting from five hours to three and trained two new colleagues. Can we confirm it at our 1:1 on January 15th?");
  await page.getByRole("button", { name: "Send answer", exact: true }).click();
  await page.getByRole("heading", { name: "One objection. Two answers." }).waitFor({ timeout: 120_000 });
  mark("comparison", 1);
  await page.waitForTimeout(3500);
  await page.getByRole("heading", { name: "One objection. Two answers." }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);
  mark("end");
} finally {
  await context.close();
  await browser.close();
}

// The video this run just wrote: the newest one in the folder.
const videos = await Promise.all((await readdir(out)).filter((name) => name.endsWith(".webm") && name !== "raw.webm").map(async (name) => ({ file: path.join(out, name), time: (await stat(path.join(out, name))).mtimeMs })));
const video = videos.sort((a, b) => a.time - b.time).pop()?.file;
if (video) await rename(video, path.join(out, "raw.webm"));
await writeFile(path.join(out, "moments.json"), JSON.stringify(moments, null, 2));
console.log(`Recorded ${path.join(out, "raw.webm")} with ${moments.length} moments.`);
