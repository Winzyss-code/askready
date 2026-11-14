// Exercise the real compiled Next.js handlers without opening a listening socket.
// Default: unconfigured/error behavior. --live: real Supabase sign-in/storage.
import assert from "node:assert/strict";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { MockedResponse } from "next/dist/server/lib/mock-request.js";

const live = process.argv.includes("--live");
if (!live) {
  // Empty values prevent Next from loading real credentials from .env.local.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
}

// Next snapshots process.env during import; set test overrides before loading it.
const { default: next } = await import("next");
const app = next({ dev: false, hostname: "localhost", port: 3000 });
await app.prepare();
const handle = app.getRequestHandler();

async function request(url, { method = "GET", body, headers = {} } = {}) {
  const chunks = [];
  const req = new IncomingMessage(new Socket());
  req.url = url;
  req.method = method;
  req.headers = { host: "localhost:3000", ...headers };
  if (body !== undefined) req.push(Buffer.from(body));
  req.push(null);
  const res = new MockedResponse({
    resWriter(chunk) { chunks.push(Buffer.from(chunk)); return true; },
  });
  await handle(req, res);
  if (!res.writableFinished) await new Promise((resolve, reject) => {
    res.once("finish", resolve);
    res.once("error", reject);
  });
  return { status: res.statusCode, body: Buffer.concat(chunks).toString("utf8"), headers: res.getHeaders() };
}

async function checkLiveAuth() {
  const headers = { origin: "http://localhost:3000", "content-type": "application/json" };
  const signIn = async (cookie) => {
    const response = await request("/api/auth", {
      method: "POST", body: "{}", headers: { ...headers, ...(cookie ? { cookie } : {}) },
    });
    const data = JSON.parse(response.body);
    // Only report our safe error code; never dump cookie/token responses.
    assert.equal(response.status, 200, `Live auth failed: ${data.error?.code ?? "unexpected response"}`);
    assert.equal(data.storage, "ready");
    assert.ok(typeof data.user?.id === "string", "Expected an authenticated identity");
    assert.ok(!/access_token|refresh_token/.test(response.body), "Auth JSON must not expose tokens");
    return { response, data };
  };

  const first = await signIn();
  const cookies = first.response.headers["set-cookie"];
  assert.ok(Array.isArray(cookies) && cookies.length === 2, "Expected access and refresh cookies");
  for (const cookie of cookies) {
    assert.ok(/; HttpOnly/i.test(cookie), "Auth cookies must be HTTP-only");
    assert.ok(/; Secure/i.test(cookie), "Production auth cookies must be secure");
    assert.ok(/; SameSite=Lax/i.test(cookie), "Auth cookies must use SameSite=Lax");
  }
  const cookieHeader = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  const resumed = await signIn(cookieHeader);
  assert.ok(resumed.data.user.id === first.data.user.id, "Refresh must preserve the anonymous identity");
  assert.equal(resumed.response.headers["set-cookie"], undefined, "A valid session must not create a new account");

  const refreshCookie = cookies.find((cookie) => cookie.startsWith("askready-refresh="));
  assert.ok(refreshCookie, "Expected a refresh cookie");
  const renewed = await signIn(refreshCookie.split(";")[0]);
  assert.ok(renewed.data.user.id === first.data.user.id, "Token renewal must preserve the anonymous identity");
  assert.ok(Array.isArray(renewed.response.headers["set-cookie"]), "Renewal must set fresh cookies");
  console.log("PASS: live Supabase anonymous sign-in, storage access, secure cookies, identity persistence and token renewal.");
  console.log("This creates one anonymous test account. RLS isolation is checked separately with supabase/tests/rls.sql.");
}

async function checkUnconfiguredApp() {
  const home = await request("/");
  assert.equal(home.status, 200);
  assert.match(home.body, /Practice is not available yet/);
  assert.doesNotMatch(home.body, /Your anonymous account is connected/);
  assert.equal(home.headers["x-frame-options"], "DENY");

  const health = await request("/api/health");
  assert.equal(health.status, 503);
  assert.equal(JSON.parse(health.body).status, "needs_configuration");

  const headers = { origin: "http://localhost:3000", "content-type": "application/json" };
  const auth = await request("/api/auth", { method: "POST", body: "{}", headers });
  assert.equal(auth.status, 503);
  assert.equal(JSON.parse(auth.body).error.code, "NOT_CONFIGURED");
  assert.equal(auth.headers["set-cookie"], undefined);

  const loopback = await request("/api/auth", {
    method: "POST", body: "{}",
    headers: { ...headers, host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
  });
  assert.equal(loopback.status, 503, "Matching loopback origins must reach configuration validation");

  const crossOrigin = await request("/api/auth", {
    method: "POST", body: "{}", headers: { ...headers, origin: "https://example.com" },
  });
  assert.equal(crossOrigin.status, 403);

  const malformed = await request("/api/auth", { method: "POST", body: "{", headers });
  assert.equal(malformed.status, 400);
  assert.equal(JSON.parse(malformed.body).error.code, "INVALID_JSON");

  const extraFields = await request("/api/auth", { method: "POST", body: '{"user_id":"spoofed"}', headers });
  assert.equal(extraFields.status, 400);

  const oversized = await request("/api/auth", { method: "POST", body: "x".repeat(17_000), headers });
  assert.equal(oversized.status, 413);

  const wrongType = await request("/api/auth", {
    method: "POST", body: "{}", headers: { ...headers, "content-type": "text/plain" },
  });
  assert.equal(wrongType.status, 415);

  let throttled = false;
  for (let i = 0; i < 16; i++) {
    const response = await request("/api/auth", { method: "POST", body: "{}", headers });
    if (response.status === 429) { throttled = true; break; }
  }
  assert.ok(throttled, "Repeated auth requests must be throttled");

  const missing = await request("/not-a-real-page");
  assert.equal(missing.status, 404);
  console.log("PASS: production rendering, honest readiness, origin guard, input limits, auth throttling and 404.");
}

try {
  if (live) await checkLiveAuth();
  else await checkUnconfiguredApp();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await app.close();
}
