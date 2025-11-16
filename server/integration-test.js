/* Integration test runner: spawns local server with in-memory queue and runs test-admin-queue.js
   Usage: node integration-test.js
*/

import { spawn } from "child_process";
import path from "path";
import axios from "axios";

const BASE = process.env.BASE || "http://localhost:3001";
const TOKEN = process.env.CW_TOKEN || "";

async function waitForServerReady(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await axios.get(url + "/health");
      if (res.status === 200) return true;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function run() {
  console.log("Starting integration test...");

  const serverProcess = spawn("node", ["index.js"], {
    cwd: path.resolve("./server"),
    env: { ...process.env, REDIS_URL: "", PORT: 3001 },
  });

  serverProcess.stdout.on("data", (d) =>
    console.log(`[server] ${d.toString().trim()}`)
  );
  serverProcess.stderr.on("data", (d) =>
    console.error(`[server error] ${d.toString().trim()}`)
  );

  const ready = await waitForServerReady(BASE);
  if (!ready) {
    console.error("Server not ready in time; aborting.");
    serverProcess.kill();
    process.exit(1);
  }

  console.log("Server is ready - running test script");

  const testScript = spawn("node", ["test-admin-queue.js"], {
    cwd: path.resolve("./server"),
    env: {
      ...process.env,
      BASE,
      CW_TOKEN: TOKEN,
      ADMIN_TOKEN: process.env.ADMIN_TOKEN || "devtoken",
    },
  });
  testScript.stdout.on("data", (d) =>
    console.log(`[test] ${d.toString().trim()}`)
  );
  testScript.stderr.on("data", (d) =>
    console.error(`[test error] ${d.toString().trim()}`)
  );

  await new Promise((resolve) => {
    testScript.on("exit", (code) => {
      console.log(`Test script exited with ${code}`);
      resolve(code);
    });
  });

  console.log("Shutting down server");
  serverProcess.kill();
}

run().catch((err) => console.error("Integration Test Failed:", err));
