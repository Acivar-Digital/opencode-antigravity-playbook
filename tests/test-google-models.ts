#!/usr/bin/env npx tsx
/**
 * Google Antigravity Model Availability & Rotation Test
 *
 * Tests all Google/Antigravity OAuth models by sending "Hi" and checking:
 * 1. Model responds successfully
 * 2. Which account (email) was used (via stderr debug output)
 * 3. Account rotation across sequential requests
 *
 * Usage:
 *   npx tsx tests/test-google-models.ts              # test all models
 *   npx tsx tests/test-google-models.ts --dry-run    # list models only
 *   npx tsx tests/test-google-models.ts --model google/gemini-2.5-flash
 *   npx tsx tests/test-google-models.ts --rotation   # rotation stress test
 *   npx tsx tests/test-google-models.ts --help
 */

import { spawn } from "child_process";
import { readFileSync } from "fs";

// ─── Model list (all Google/Antigravity OAuth models) ───────────────────────

interface ModelTest {
  model: string;
  category: "gemini-3" | "gemini-2.5" | "claude";
}

const MODELS: ModelTest[] = [
  // Gemini 3 (Antigravity)
  { model: "google/antigravity-gemini-3-pro", category: "gemini-3" },
  { model: "google/antigravity-gemini-3-flash", category: "gemini-3" },
  { model: "google/antigravity-gemini-3.1-pro", category: "gemini-3" },
  { model: "google/antigravity-gemini-3.5-flash-low", category: "gemini-3" },
  { model: "google/antigravity-gemini-3.5-flash-extra-low", category: "gemini-3" },
  { model: "google/antigravity-gemini-3.5-flash-high", category: "gemini-3" },

  // Gemini 2.5 (Antigravity CLI)
  { model: "google/gemini-2.5-flash", category: "gemini-2.5" },
  { model: "google/gemini-2.5-pro", category: "gemini-2.5" },

  // Preview models (Antigravity CLI)
  { model: "google/gemini-3-flash-preview", category: "gemini-3" },
  { model: "google/gemini-3-pro-preview", category: "gemini-3" },
  { model: "google/gemini-3.1-pro-preview", category: "gemini-3" },
  { model: "google/gemini-3.1-pro-preview-customtools", category: "gemini-3" },

  // Claude (via Antigravity)
  { model: "google/antigravity-claude-sonnet-4-6", category: "claude" },
  { model: "google/antigravity-claude-opus-4-6-thinking", category: "claude" },
];

const TEST_PROMPT = "Reply with exactly: HI";
const DEFAULT_TIMEOUT_MS = 90_000;

// ─── Types ──────────────────────────────────────────────────────────────────

interface TestResult {
  model: string;
  category: string;
  success: boolean;
  error?: string;
  duration: number;
  accountUsed?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseArgs(): {
  filterModel: string | null;
  filterCategory: string | null;
  dryRun: boolean;
  help: boolean;
  timeout: number;
  rotation: boolean;
} {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? (args[i + 1] ?? null) : null;
  };
  return {
    filterModel: get("--model"),
    filterCategory: get("--category"),
    dryRun: args.includes("--dry-run"),
    help: args.includes("--help") || args.includes("-h"),
    timeout: parseInt(get("--timeout") || String(DEFAULT_TIMEOUT_MS), 10),
    rotation: args.includes("--rotation"),
  };
}

function printHelp(): void {
  console.log(`
Google Antigravity Model & Rotation Test

Usage:
  npx tsx tests/test-google-models.ts [options]

Options:
  --model <name>       Test specific model (e.g. google/gemini-2.5-flash)
  --category <cat>     Filter by category (gemini-3, gemini-2.5, claude)
  --timeout <ms>       Per-model timeout (default: 90000)
  --rotation           Rotation stress test (sends 3 requests to same model)
  --dry-run            List models without testing
  --help, -h           Show this help

Examples:
  npx tsx tests/test-google-models.ts --dry-run
  npx tsx tests/test-google-models.ts --model google/gemini-2.5-flash
  npx tsx tests/test-google-models.ts --category gemini-3
  npx tsx tests/test-google-models.ts --rotation
`);
}

/** Extract which account email was used from stderr debug output */
function extractAccountEmail(stderr: string): string | undefined {
  // Plugin logs: "[antigravity] Using account: <email>" or similar
  const patterns = [
    /\[antigravity\]\s+(?:Using|Selected|Active)\s+account[:\s]+(\S+@\S+)/i,
    /account[:\s]+(\S+@\S+).*(?:token|auth|refresh)/i,
    /email[:\s]+(\S+@\S+)/i,
  ];
  for (const pat of patterns) {
    const m = stderr.match(pat);
    if (m) return m[1];
  }
  return undefined;
}

function loadAccounts(): { email: string; enabled: boolean }[] {
  try {
    const data = JSON.parse(readFileSync("/home/yapilwsl/.config/opencode/antigravity-accounts.json", "utf-8"));
    return (data.accounts || []).map((a: any) => ({
      email: a.email,
      enabled: a.enabled !== false,
    }));
  } catch {
    return [];
  }
}

// ─── Core test ──────────────────────────────────────────────────────────────

async function runModel(model: string, prompt: string, timeoutMs: number): Promise<{ success: boolean; stdout: string; stderr: string; error?: string; duration: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const proc = spawn("opencode", ["run", prompt, "--model", model], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ success: false, stdout, stderr, error: `Timeout after ${timeoutMs}ms`, duration: Date.now() - start });
    }, timeoutMs);

    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        stdout,
        stderr,
        error: code !== 0 ? `Exit ${code}: ${(stderr || stdout).slice(0, 300)}` : undefined,
        duration: Date.now() - start,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, stdout, stderr, error: err.message, duration: Date.now() - start });
    });
  });
}

// ─── Print account table ────────────────────────────────────────────────────

function printAccountTable(): void {
  const accounts = loadAccounts();
  console.log(`\n📋 Configured Accounts (${accounts.length}):`);
  console.log("─".repeat(60));
  for (const a of accounts) {
    const status = a.enabled ? "✅ enabled " : "❌ disabled";
    console.log(`  ${status}  ${a.email}`);
  }
  console.log("─".repeat(60));
  console.log();
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { filterModel, filterCategory, dryRun, help, timeout, rotation } = parseArgs();
  if (help) { printHelp(); return; }

  printAccountTable();

  // ── Rotation stress test ───────────────────────────────────────────────
  if (rotation) {
    console.log("🔄 Rotation Stress Test");
    console.log("Sending 5 sequential requests to google/gemini-2.5-flash...\n");
    console.log("(With sticky strategy, all should use the same account unless rate-limited)\n");

    const model = "google/gemini-2.5-flash";
    const accountsUsed: string[] = [];

    for (let i = 1; i <= 5; i++) {
      process.stdout.write(`  Request ${i}/5 ... `);
      const r = await runModel(model, TEST_PROMPT, timeout);
      const email = extractAccountEmail(r.stderr) || "unknown";
      accountsUsed.push(email);

      if (r.success) {
        console.log(`✅ ${(r.duration / 1000).toFixed(1)}s  [account: ${email}]`);
      } else {
        console.log(`❌ FAIL  [account: ${email}]`);
        console.log(`    ${r.error?.slice(0, 120)}`);
      }

      // Small delay between requests
      if (i < 5) await new Promise((r) => setTimeout(r, 2000));
    }

    // Check rotation
    const unique = new Set(accountsUsed);
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Accounts used: ${unique.size} unique out of 5 requests`);
    if (unique.size === 1) {
      console.log("→ Sticky: all requests used the same account (expected with sticky strategy)");
    } else {
      console.log("→ Rotation detected: accounts changed between requests");
      console.log("  This happens when an account hits a rate limit");
    }
    console.log(`  Sequence: ${accountsUsed.join(" → ")}`);
    return;
  }

  // ── Standard model availability test ───────────────────────────────────
  let tests = MODELS;
  if (filterModel) tests = tests.filter((t) => t.model === filterModel || t.model.endsWith(filterModel));
  if (filterCategory) tests = tests.filter((t) => t.category === filterCategory);

  if (tests.length === 0) {
    console.log("No models match the filter.");
    return;
  }

  console.log(`🧪 Google Antigravity Model Tests (${tests.length} models)`);
  console.log("=".repeat(70) + "\n");

  if (dryRun) {
    for (const t of tests) {
      console.log(`  ${t.model.padEnd(55)} [${t.category}]`);
    }
    console.log(`\n${tests.length} models would be tested.`);
    return;
  }

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    process.stdout.write(`  ${t.model.padEnd(55)} `);
    const r = await runModel(t.model, TEST_PROMPT, timeout);
    const email = extractAccountEmail(r.stderr);

    if (r.success) {
      console.log(`✅ ${(r.duration / 1000).toFixed(1)}s${email ? `  [${email}]` : ""}`);
      passed++;
    } else {
      console.log(`❌ FAIL`);
      console.log(`    ${r.error?.slice(0, 150)}`);
      failed++;
    }

    results.push({
      model: t.model,
      category: t.category,
      success: r.success,
      error: r.error,
      duration: r.duration,
      accountUsed: email,
    });

    // Small delay to avoid hammering
    await new Promise((r) => setTimeout(r, 1500));
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Summary: ${passed} passed, ${failed} failed\n`);

  // Group by category
  const categories = [...new Set(results.map((r) => r.category))];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.success).length;
    console.log(`  ${cat}: ${catPassed}/${catResults.length} passed`);
  }

  // Account usage summary
  const accountUsage = new Map<string, number>();
  for (const r of results) {
    if (r.accountUsed) {
      accountUsage.set(r.accountUsed, (accountUsage.get(r.accountUsed) || 0) + 1);
    }
  }
  if (accountUsage.size > 0) {
    console.log(`\n  Account usage:`);
    for (const [email, count] of accountUsage) {
      console.log(`    ${email}: ${count} request(s)`);
    }
  }

  if (failed > 0) {
    console.log(`\n  Failed models:`);
    for (const r of results.filter((r) => !r.success)) {
      console.log(`    - ${r.model}: ${r.error?.slice(0, 80)}`);
    }
    process.exit(1);
  }
}

main().catch(console.error);
