import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = Number(process.env.SMOKE_PORT || 3011);
const baseUrl = (process.env.SMOKE_BASE_URL || `http://${host}:${port}`).trim();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(timeoutMs = 45000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/login`, { redirect: "manual" });
      if (res.status < 500) return;
      lastError = new Error(`Unexpected status ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(400);
  }
  throw new Error(`Server did not become ready in ${timeoutMs}ms. Last error: ${String(lastError)}`);
}

async function runChecks() {
  const loginRes = await fetch(`${baseUrl}/login`, { redirect: "manual" });
  assert.equal(loginRes.status, 200, "GET /login should return 200");

  const homeRes = await fetch(`${baseUrl}/`, { redirect: "manual" });
  assert.equal(homeRes.status, 307, "Unauthenticated GET / should redirect");
  const location = homeRes.headers.get("location") ?? "";
  assert.ok(
    location.startsWith("/login?next=%2F"),
    `GET / redirect location should start with /login?next=%2F (got "${location}")`,
  );

  const tasksRes = await fetch(`${baseUrl}/api/tasks`, { redirect: "manual" });
  assert.equal(tasksRes.status, 401, "Unauthenticated GET /api/tasks should return 401");
  const tasksPayload = await tasksRes.json();
  assert.equal(tasksPayload.error, "Unauthorized", "Unauthorized API response should include error");
}

async function shutdown(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await sleep(400);
  if (!child.killed) {
    child.kill("SIGKILL");
  }
}

async function main() {
  let stdoutLog = "";
  let stderrLog = "";
  let dev = null;
  if (!process.env.SMOKE_BASE_URL) {
    dev = spawn("npm", ["run", "dev", "--", "--hostname", host, "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    dev.stdout.on("data", (chunk) => {
      stdoutLog += chunk.toString();
    });
    dev.stderr.on("data", (chunk) => {
      stderrLog += chunk.toString();
    });
  }

  try {
    await waitForServerReady();
    await runChecks();
    console.log(`Smoke checks passed on ${baseUrl}`);
  } catch (error) {
    const details = [
      `Smoke checks failed on ${baseUrl}`,
      error instanceof Error ? error.message : String(error),
      "---- next dev stdout ----",
      stdoutLog.slice(-4000),
      "---- next dev stderr ----",
      stderrLog.slice(-4000),
    ].join("\n");
    throw new Error(details);
  } finally {
    await shutdown(dev);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
