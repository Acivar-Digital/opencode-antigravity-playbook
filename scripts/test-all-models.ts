#!/usr/bin/env npx tsx
/**
 * E2E test: say hi to every Google Antigravity model.
 *
 * Tests all 14 models configured in opencode.json "google" provider.
 * Uses `opencode run` so the full plugin stack is exercised (token refresh,
 * header injection, v1internal wrapping, response unwrapping).
 *
 * Usage:
 *   npx tsx scripts/test-all-models.ts              # test all 14 models
 *   npx tsx scripts/test-all-models.ts --dry-run    # list models only
 *   npx tsx scripts/test-all-models.ts --model google/antigravity-gemini-3-flash
 *   npx tsx scripts/test-all-models.ts --timeout 60000
 */

import { spawn } from "child_process";

// ---------------------------------------------------------------------------
// Model list — must match opencode.json provider.google.models keys
// ---------------------------------------------------------------------------
const MODELS: string[] = [
  // Antigravity header style (models with "antigravity-" prefix)
  "google/antigravity-gemini-3-pro",
  "google/antigravity-gemini-3.1-pro",
  "google/antigravity-gemini-3-flash",
  "google/antigravity-gemini-3.5-flash-low",
  "google/antigravity-gemini-3.5-flash-extra-low",
  "google/antigravity-gemini-3.5-flash-high",
  "google/antigravity-claude-sonnet-4-6",
  "google/antigravity-claude-opus-4-6-thinking",

  // Antigravity CLI header style (models without prefix)
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-3-flash-preview",
  "google/gemini-3-pro-preview",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3.1-pro-preview-customtools",
];

const TEST_PROMPT = "Reply with exactly one word: HI";
const DEFAULT_TIMEOUT_MS = 90_000;

interface TestResult {
  model: string;
  success: boolean;
  error?: string;
  duration: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseArgs(): {
  filterModel: string | null;
  dryRun: boolean;
  help: boolean;
  timeout: number;
} {
  const args = process.argv.slice(2);
  const modelIdx = args.indexOf("--model");
  const timeoutIdx = args.indexOf("--timeout");

  return {
    filterModel: modelIdx !== -1 ? args[modelIdx + 1] ?? null : null,
    dryRun: args.includes("--dry-run"),
    help: args.includes("--help") || args.includes("-h"),
    timeout:
      timeoutIdx !== -1
        ? parseInt(args[timeoutIdx + 1] || String(DEFAULT_TIMEOUT_MS), 10)
        : DEFAULT_TIMEOUT_MS,
  };
}

function printHelp(): void {
  console.log(`
E2E All-Models Test Script

Usage:
  npx tsx scripts/test-all-models.ts [options]

Options:
  --model <model>    Test a specific model (partial match OK)
  --timeout <ms>     Timeout per model (default: ${DEFAULT_TIMEOUT_MS})
  --dry-run          List models without testing
  --help, -h         Show this help

Examples:
  npx tsx scripts/test-all-models.ts --dry-run
  npx tsx scripts/test-all-models.ts --model antigravity-gemini-3-flash
  npx tsx scripts/test-all-models.ts --timeout 60000
`);
}

function runModel(model: string, timeoutMs: number): Promise<TestResult> {
  const start = Date.now();

  return new Promise((resolve) => {
    const proc = spawn(
      "opencode",
      ["run", TEST_PROMPT, "--model", model],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({
        model,
        success: false,
        error: `Timeout after ${timeoutMs}ms`,
        duration: Date.now() - start,
      });
    }, timeoutMs);

    proc.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const duration = Date.now() - start;
      if (code !== 0) {
        const msg = (stderr || stdout || `exit ${code}`).trim().slice(0, 300);
        resolve({ model, success: false, error: msg, duration });
      } else {
        resolve({ model, success: true, duration });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ model, success: false, error: err.message, duration: Date.now() - start });
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const { filterModel, dryRun, help, timeout } = parseArgs();

  if (help) {
    printHelp();
    return;
  }

  let models = MODELS;
  if (filterModel) {
    models = models.filter(
      (m) => m === filterModel || m.endsWith(filterModel) || m.includes(filterModel),
    );
  }

  if (models.length === 0) {
    console.log("No models match the filter.");
    return;
  }

  console.log(
    `\n🧪 Google Antigravity Model Tests — ${models.length} models\n${"=".repeat(60)}\n`,
  );

  if (dryRun) {
    for (const m of models) console.log(`  ${m}`);
    console.log(`\n${models.length} models would be tested.\n`);
    return;
  }

  let passed = 0;
  let failed = 0;
  const failures: { model: string; error: string }[] = [];

  for (const model of models) {
    process.stdout.write(`  ${model.padEnd(55)} ... `);
    const result = await runModel(model, timeout);

    if (result.success) {
      console.log(`✅  (${(result.duration / 1000).toFixed(1)}s)`);
      passed++;
    } else {
      console.log(`❌  FAIL`);
      console.log(`     ${result.error}`);
      failures.push({ model, error: result.error ?? "Unknown" });
      failed++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Summary: ${passed} passed, ${failed} failed\n`);

  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f.model}: ${f.error}`);
    process.exit(1);
  }
}

main().catch(console.error);
