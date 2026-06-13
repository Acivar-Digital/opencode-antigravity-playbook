#!/usr/bin/env node
/**
 * admin/check-health.mjs
 * Wrapper to run the Antigravity Account Monitor
 */

import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const monitorPath = join(__dirname, "../scripts/monitor.mjs");
const args = process.argv.slice(2);

const child = fork(monitorPath, args, {
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
