import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { env } from "node:process";

// Load .env file manually (no dependencies)
const envPath = path.resolve(new URL(".", import.meta.url).pathname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

import healthHandler from "./api/health.js";
import pingHandler from "./api/ping.js";
import clockinHandler from "./api/clockin.js";
import testClockinHandler from "./api/test-clockin.js";
import testClockoutHandler from "./api/test-clockout.js";
import clockoutHandler from "./api/clockout.js";
import telegramWebhookHandler from "./api/telegram-webhook.js";
import setupWebhookHandler from "./api/setup-webhook.js";

function createVercelRes(res) {
  let statusCode = 200;
  let body = {};
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    },
  };
}

async function parseBody(req) {
  return new Promise((resolve) => {
    if (req.method !== "POST") return resolve();
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        req.body = JSON.parse(body);
      } catch {
        req.body = body;
      }
      resolve();
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    const vercelRes = createVercelRes(res);

    await parseBody(req);

    if (path === "/api/health") return await healthHandler(req, vercelRes);
    if (path === "/api/ping") return await pingHandler(req, vercelRes);
    if (path === "/api/clockin") return await clockinHandler(req, vercelRes);
    if (path === "/api/test-clockin") return await testClockinHandler(req, vercelRes);
    if (path === "/api/test-clockout") return await testClockoutHandler(req, vercelRes);
    if (path === "/api/clockout") return await clockoutHandler(req, vercelRes);
    if (path === "/api/telegram-webhook") return await telegramWebhookHandler(req, vercelRes);
    if (path === "/api/setup-webhook") return await setupWebhookHandler(req, vercelRes);

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  console.log("Endpoints:");
    console.log(`  GET  http://localhost:${PORT}/api/health`);
    console.log(`  GET  http://localhost:${PORT}/api/ping`);
    console.log(`  GET  http://localhost:${PORT}/api/test-clockin`);
    console.log(`  GET  http://localhost:${PORT}/api/test-clockout`);
    console.log(`  POST http://localhost:${PORT}/api/clockin`);
    console.log(`  POST http://localhost:${PORT}/api/clockout`);
    console.log(`  POST http://localhost:${PORT}/api/telegram-webhook`);
    console.log(`  POST http://localhost:${PORT}/api/setup-webhook`);
});
