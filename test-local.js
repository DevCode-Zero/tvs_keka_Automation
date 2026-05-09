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
import testClockoutHandler from "./api/test-clockout.js";
import clockoutHandler from "./api/clockout.js";

function createRequest(method, path) {
  return { method, url: path };
}

async function handleRoute(req) {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (path === "/api/health") return await healthHandler(req);
  if (path === "/api/test-clockout") return await testClockoutHandler(req);
  if (path === "/api/clockout") return await clockoutHandler(req);

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const response = await handleRoute(req);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
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
  console.log(`  GET  http://localhost:${PORT}/api/test-clockout`);
  console.log(`  POST http://localhost:${PORT}/api/clockout`);
});
