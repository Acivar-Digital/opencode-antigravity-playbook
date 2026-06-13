#!/usr/bin/env node
/**
 * Antigravity Account Monitor
 *
 * Usage:
 *   node scripts/monitor.mjs                   # one-shot snapshot
 *   node scripts/monitor.mjs --watch           # refresh every 60s
 *   node scripts/monitor.mjs --watch --interval 30   # custom interval (seconds)
 *   node scripts/monitor.mjs --live            # fetch live quota from Google (slower)
 *   node scripts/monitor.mjs --watch --live    # live quota + auto-refresh
 *
 * Shows:
 *   - Account enabled/disabled state
 *   - verificationRequired flag
 *   - Cached quota (from antigravity-quota-state.json) OR live quota (--live)
 *   - Rate-limit cooldowns
 *   - Alert summary for anything unhealthy
 */

import { readFileSync, watchFile } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Config ──────────────────────────────────────────────────────────────────

const CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const CLOUD_CODE_BASE = "https://cloudcode-pa.googleapis.com";
const USER_AGENT = "antigravity/windows/amd64";
const FALLBACK_PROJECT_ID = "bamboo-precept-lgxtn";

// ── Paths ────────────────────────────────────────────────────────────────────

function configDir() {
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode");
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "opencode");
}

const ACCOUNTS_PATH = join(configDir(), "antigravity-accounts.json");
const QUOTA_STATE_PATH = join(configDir(), "antigravity-quota-state.json");

// ── ANSI ─────────────────────────────────────────────────────────────────────

const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  blue:   "\x1b[34m",
  cyan:   "\x1b[36m",
  white:  "\x1b[37m",
  bgRed:  "\x1b[41m",
};

function color(text, ...codes) {
  return `${codes.join("")}${text}${C.reset}`;
}

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let watch = false;
  let live = false;
  let intervalSec = 60;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--watch" || a === "-w") { watch = true; continue; }
    if (a === "--live" || a === "-l") { live = true; continue; }
    if ((a === "--interval" || a === "-i") && args[i + 1]) {
      const n = Number.parseInt(args[i + 1], 10);
      if (!Number.isNaN(n) && n > 0) intervalSec = n;
      i++;
    }
  }

  return { watch, live, intervalSec };
}

// ── File loading ──────────────────────────────────────────────────────────────

function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

// ── Time formatting ────────────────────────────────────────────────────────────

function formatDuration(ms) {
  if (ms <= 0) return "now";
  const totalSec = Math.round(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatAge(ms) {
  if (ms < 60_000) return "just now";
  return `${formatDuration(ms)} ago`;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function progressBar(fraction, width = 18) {
  if (typeof fraction !== "number") return color("░".repeat(width) + " ???", C.dim);
  const pct = Math.round(fraction * 100);
  const filled = Math.round(fraction * width);
  const empty = width - filled;
  const barColor = fraction < 0.2 ? C.red : fraction < 0.5 ? C.yellow : C.green;
  const bar = color("█".repeat(filled), barColor) + color("░".repeat(empty), C.dim);
  const label = color(`${pct}%`.padStart(4), barColor);
  return `${bar} ${label}`;
}

// ── Live quota fetch ──────────────────────────────────────────────────────────

async function refreshToken(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Token refresh ${res.status}: ${txt.slice(0, 150)}`);
  }
  return (await res.json()).access_token;
}

async function loadProjectId(accessToken) {
  const res = await fetch(`${CLOUD_CODE_BASE}/v1internal:loadCodeAssist`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ metadata: { ideType: "ANTIGRAVITY" } }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  if (typeof data.cloudaicompanionProject === "string") return data.cloudaicompanionProject;
  if (data.cloudaicompanionProject?.id) return data.cloudaicompanionProject.id;
  return "";
}

function classifyGroup(modelName) {
  const lower = modelName.toLowerCase();
  if (lower.includes("claude")) return "claude";
  if (!lower.includes("gemini-3")) return null;
  return lower.includes("flash") ? "gemini-flash" : "gemini-pro";
}

async function fetchLiveQuota(account) {
  const token = await refreshToken(account.refreshToken);
  let projectId = await loadProjectId(token);
  if (!projectId) {
    projectId = account.managedProjectId || account.projectId || FALLBACK_PROJECT_ID;
  }

  const res = await fetch(`${CLOUD_CODE_BASE}/v1internal:fetchAvailableModels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(projectId ? { project: projectId } : {}),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`fetchAvailableModels ${res.status}: ${txt.slice(0, 150)}`);
  }

  const data = await res.json();
  const groups = {};
  for (const [name, info] of Object.entries(data.models || {})) {
    const g = classifyGroup(name);
    if (!g || !info?.quotaInfo) continue;
    const frac = info.quotaInfo.remainingFraction ?? 0;
    const reset = info.quotaInfo.resetTime;
    if (!groups[g]) {
      groups[g] = { remaining: frac, resetTime: reset, count: 1 };
    } else {
      groups[g].remaining = Math.min(groups[g].remaining, frac);
      groups[g].count++;
      if (reset) {
        const ts = Date.parse(reset);
        const existing = Date.parse(groups[g].resetTime || "");
        if (!Number.isFinite(existing) || ts < existing) {
          groups[g].resetTime = reset;
        }
      }
    }
  }
  return { groups, projectId };
}

// ── Cached quota loader ───────────────────────────────────────────────────────

function getCachedQuota(email, quotaState) {
  if (!quotaState?.accounts?.[email]) return null;
  const entry = quotaState.accounts[email];
  const groups = {};
  for (const model of entry.models || []) {
    const g = model.family === "claude" ? "claude"
      : model.family === "gemini_pro" ? "gemini-pro"
      : model.family === "gemini_flash" ? "gemini-flash"
      : null;
    if (!g) continue;
    if (!groups[g]) {
      groups[g] = {
        remaining: model.remainingFraction,
        resetTime: model.resetTime,
        count: 1,
      };
    } else {
      groups[g].remaining = Math.min(groups[g].remaining, model.remainingFraction);
      groups[g].count++;
    }
  }
  return { groups, lastRefresh: entry.lastRefresh };
}

// ── Rate limit checker ────────────────────────────────────────────────────────

function getActiveCooldowns(account) {
  const now = Date.now();
  const active = [];
  for (const [key, resetTime] of Object.entries(account.rateLimitResetTimes || {})) {
    if (resetTime > now) {
      active.push({ key, resetIn: resetTime - now });
    }
  }
  if (account.coolingDownUntil && account.coolingDownUntil > now) {
    active.push({ key: `cooldown(${account.cooldownReason || "?"})`, resetIn: account.coolingDownUntil - now });
  }
  return active;
}

// ── Main render ───────────────────────────────────────────────────────────────

async function renderDashboard(opts) {
  const { live } = opts;

  const accountsData = safeReadJson(ACCOUNTS_PATH);
  const quotaState = safeReadJson(QUOTA_STATE_PATH);

  if (!accountsData?.accounts?.length) {
    console.log(color("No accounts found in " + ACCOUNTS_PATH, C.red));
    return;
  }

  const accounts = accountsData.accounts;
  const now = Date.now();

  // ── Header ────────────────────────────────────────────────────────────────
  const timestamp = new Date().toLocaleTimeString();
  const source = live ? color("live", C.cyan) : color("cached", C.dim);
  console.log("");
  console.log(color("╔══════════════════════════════════════════════════════════════╗", C.blue));
  console.log(color("║", C.blue) + color("  ANTIGRAVITY ACCOUNT MONITOR", C.bold + C.white) + color(`                  ${timestamp}  `, C.dim) + color("║", C.blue));
  console.log(color("╚══════════════════════════════════════════════════════════════╝", C.blue));
  console.log(`  Quota source: ${source}  |  Accounts file: ${ACCOUNTS_PATH}`);
  console.log("");

  const alerts = [];

  for (const [idx, account] of accounts.entries()) {
    const label = account.email || `Account ${idx + 1}`;
    const enabled = account.enabled !== false;
    const verReq = account.verificationRequired === true;

    // ── Account header ────────────────────────────────────────────────────
    const statusDot = !enabled ? color("●", C.red)
      : verReq ? color("●", C.yellow)
      : color("●", C.green);

    const statusTag = !enabled ? color(" DISABLED", C.red + C.bold)
      : verReq ? color(" VERIFY REQUIRED", C.yellow + C.bold)
      : color(" OK", C.green);

    console.log(`  ${statusDot} ${color(label, C.bold)}${statusTag}`);

    // Track alerts
    if (!enabled) {
      alerts.push(`${label}: DISABLED`);
    } else if (verReq) {
      const reason = account.verificationRequiredReason ? ` (${account.verificationRequiredReason})` : "";
      alerts.push(`${label}: verification required${reason}`);
    }

    // ── Cooldowns ─────────────────────────────────────────────────────────
    const cooldowns = getActiveCooldowns(account);
    if (cooldowns.length > 0) {
      for (const cd of cooldowns) {
        console.log(`     ${color("⏸", C.yellow)} Rate-limited: ${cd.key} — clears in ${formatDuration(cd.resetIn)}`);
      }
      alerts.push(`${label}: rate-limited on ${cooldowns.map(c => c.key).join(", ")}`);
    }

    // ── Quota ─────────────────────────────────────────────────────────────
    let quotaGroups = null;
    let quotaError = null;
    let quotaAge = null;

    if (live) {
      try {
        const result = await fetchLiveQuota(account);
        quotaGroups = result.groups;
      } catch (err) {
        quotaError = err.message;
      }
    } else {
      const cached = getCachedQuota(account.email, quotaState);
      if (cached) {
        quotaGroups = cached.groups;
        if (cached.lastRefresh) {
          quotaAge = now - cached.lastRefresh;
        }
      } else {
        quotaError = "No cached quota data";
      }
    }

    if (quotaError) {
      console.log(`     ${color("✗", C.red)} Quota: ${color(quotaError, C.dim)}`);
      alerts.push(`${label}: quota fetch error — ${quotaError}`);
    } else if (quotaGroups) {
      const ageStr = quotaAge !== null
        ? color(` (data: ${formatAge(quotaAge)})`, quotaAge > 6 * 3600_000 ? C.yellow : C.dim)
        : "";

      const groupDefs = [
        { key: "claude",       label: "Claude      " },
        { key: "gemini-pro",   label: "Gemini Pro  " },
        { key: "gemini-flash", label: "Gemini Flash" },
      ];

      let anyGroup = false;
      for (const gd of groupDefs) {
        const g = quotaGroups[gd.key];
        if (!g) continue;
        anyGroup = true;
        const bar = progressBar(g.remaining);
        const resetStr = g.resetTime
          ? (() => {
              const ms = Date.parse(g.resetTime) - now;
              if (ms <= 0) return color(" (resetting...)", C.dim);
              const isWeekly = ms > 12 * 3600_000;
              return color(` (resets in ${formatDuration(ms)}${isWeekly ? " — weekly cap" : ""})`, isWeekly ? C.yellow : C.dim);
            })()
          : "";
        console.log(`     ${gd.label}  ${bar}${resetStr}`);

        // Warn if exhausted
        if (typeof g.remaining === "number" && g.remaining <= 0) {
          alerts.push(`${label}: ${gd.label.trim()} EXHAUSTED${resetStr}`);
        }
      }
      if (!anyGroup) {
        console.log(`     ${color("No quota groups returned", C.dim)}${ageStr}`);
      } else if (ageStr) {
        console.log(`     ${ageStr.trim()}`);
      }
    }

    // ── Last used ─────────────────────────────────────────────────────────
    if (account.lastUsed && account.lastUsed > 0) {
      const age = now - account.lastUsed;
      console.log(`     ${color("Last used:", C.dim)} ${formatAge(age)}`);
    }

    console.log("");
  }

  // ── Alert summary ─────────────────────────────────────────────────────────
  if (alerts.length > 0) {
    console.log(color("══════════════════════════════════════════════════════════════", C.red));
    console.log(color(`  ALERTS (${alerts.length})`, C.red + C.bold));
    console.log(color("══════════════════════════════════════════════════════════════", C.red));
    for (const a of alerts) {
      console.log(`  ${color("!", C.red + C.bold)} ${a}`);
    }
    console.log("");
  } else {
    console.log(color("  All accounts healthy.", C.green + C.bold));
    console.log("");
  }

  // ── Total enabled ─────────────────────────────────────────────────────────
  const total = accounts.length;
  const enabled = accounts.filter(a => a.enabled !== false).length;
  const verBlocked = accounts.filter(a => a.verificationRequired === true).length;
  console.log(
    color("  Summary: ", C.dim) +
    color(`${enabled}/${total} enabled`, enabled === total ? C.green : C.yellow) +
    (verBlocked > 0 ? color(`  ${verBlocked} need verification`, C.yellow) : "")
  );
  console.log("");
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!opts.watch) {
    await renderDashboard(opts);
    return;
  }

  // Watch mode: clear screen and re-render on interval
  const render = async () => {
    process.stdout.write("\x1b[2J\x1b[H"); // clear screen
    await renderDashboard(opts).catch(err => {
      console.error(color("Render error: " + err.message, C.red));
    });
    console.log(color(`  Refreshing every ${opts.intervalSec}s — Ctrl+C to stop`, C.dim));
  };

  await render();
  const timer = setInterval(render, opts.intervalSec * 1000);

  process.on("SIGINT", () => {
    clearInterval(timer);
    console.log("\nMonitor stopped.");
    process.exit(0);
  });
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
