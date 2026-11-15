import { test, expect } from "@playwright/test";

test("voice and text rehearsal, grounded coaching, retry, refresh, and responsive screens", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const screenshot = async (name: string) => page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Say the hard thing. Practice it out loud first." })).toBeVisible();
  await screenshot("landing-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await fits();
  await screenshot("landing-mobile");
  // The quick start: a clearly labelled, made-up case, filled in and editable, without starting a session.
  await page.getByRole("link", { name: "Or try a ready-made example" }).click();
  await expect(page.getByText("Example case loaded")).toBeVisible();
  await expect(page.getByLabel("Your job role")).toHaveValue("Operations analyst");
  await expect(page.getByText("“Budgets are frozen. Why now?”").first()).toBeVisible();
  await fits();
  await page.goto("/");
  await page.getByRole("link", { name: "Pricing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Pro waitlist" })).toBeVisible();
  await fits();
  await screenshot("pricing-mobile");
  await page.getByRole("link", { name: "Start practicing free" }).click();
  await expect(page.getByLabel("Your job role")).toBeVisible();
  await page.getByRole("button", { name: "Start my rehearsal" }).click();
  expect(await page.getByLabel("Your job role").evaluate((element: HTMLInputElement) => element.validity.valueMissing)).toBe(true);
  await page.getByLabel("Your job role").fill("Operations analyst");
  await page.getByLabel("What raise are you asking for?").fill("A 10% raise");
  await page.getByLabel("Achievement 1").fill("Reduced weekly reporting time from 5 hours to 3 hours");
  await page.getByLabel("Achievement 2").fill("Trained two new colleagues");
  await page.getByLabel("What might your manager say?").fill("The budget is frozen until next quarter");
  await screenshot("setup-mobile");
  await fits();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screenshot("setup-desktop");
  // The opening streams its own voice with the reply, so it never needs a separate speech request.
  let speechRequests = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/speak")) speechRequests++; });
  await page.getByRole("button", { name: "Start my rehearsal" }).click();
  await expect(page.getByRole("heading", { name: "Your intention" })).toBeVisible();
  expect(speechRequests).toBe(0);
  const stop = page.getByRole("button", { name: "Stop playback" });
  if (await stop.isVisible()) await stop.click();

  // Exercise real MediaRecorder encoding and Whisper with synthetic mic input.
  await page.getByRole("button", { name: "Record an answer" }).click();
  await expect(page.getByRole("button", { name: /Stop recording/ })).toBeVisible();
  await page.waitForTimeout(12_000); // Capture the known speech fixture in real time.
  await page.getByRole("button", { name: /Stop recording/ }).click();
  await expect(page.getByRole("textbox", { name: "Your answer", exact: true })).not.toHaveValue("");
  await expect(page.getByText("Review the transcript, then send your answer.", { exact: false })).toBeVisible();
  const voiceText = await page.getByRole("textbox", { name: "Your answer", exact: true }).inputValue();
  expect(voiceText.toLowerCase()).toMatch(/raise|reporting|colleagues/);

  // Blocked playback (as on a phone that wasn't tapped) and no browser voice must leave a readable reply and usable text entry.
  await page.route("**/api/speak", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"code":"TEST_OUTAGE"}}' }));
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Test block", "NotAllowedError"));
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: undefined, configurable: true });
  });
  await page.getByRole("button", { name: "Send answer", exact: true }).click();
  await expect(page.getByText("Playback was blocked or isn’t available.", { exact: false })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your answer", exact: true })).toBeEnabled();

  // Permission denial must automatically offer the same text practice path.
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Test denial", "NotAllowedError"); };
  });
  await page.getByRole("button", { name: "Record an answer" }).click();
  await expect(page.getByText("Microphone access was denied.", { exact: false })).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("I understand the budget is frozen. I have been working hard. Could we revisit this next quarter?");
  await page.getByRole("button", { name: "Send answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Finish & get coaching" })).toBeEnabled();
  await screenshot("practice-desktop");
  await page.getByRole("button", { name: "Finish & get coaching" }).click();
  // Steps appear as the server reaches them.
  await expect(page.getByText("Reading your answers")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Three changes to try" })).toBeVisible({ timeout: 90_000 }); // a real model call
  await expect(page.getByRole("heading", { name: "You said", exact: true })).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Say this instead", exact: true })).toHaveCount(3);
  await screenshot("feedback-desktop");
  await page.getByRole("link", { name: "Retry this moment" }).click();
  await expect(page.getByRole("heading", { name: "Try that moment again." })).toBeVisible();
  await expect(page.getByText("Try:", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your answer", exact: true })).toBeEnabled();
  await page.evaluate(() => Object.defineProperty(window, "MediaRecorder", { value: undefined, configurable: true }));
  await page.getByRole("button", { name: "Record an answer" }).click();
  await expect(page.getByText("Recording isn’t supported here.", { exact: false })).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("I understand the budget is frozen until next quarter. I am asking for a 10% raise based on reducing reporting from 5 hours to 3 hours and training two colleagues. Can we agree on the criteria now and set a decision meeting for the start of next quarter?");
  await page.getByRole("button", { name: "Send answer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "One objection. Two answers." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Your (answer|second answer) to “/);
  await expect(page.getByRole("row")).toHaveCount(7);
  const resultUrl = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: "One objection. Two answers." })).toBeVisible();
  expect(page.url()).toBe(resultUrl);
  await screenshot("comparison-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await fits();
  await screenshot("comparison-mobile");
  expect(errors).toEqual([]);
});
