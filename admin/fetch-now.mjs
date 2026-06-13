#!/usr/bin/env node
/**
 * admin/fetch-now.mjs
 * Fetches the live quota from Google and updates antigravity-accounts.json
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";

const CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const CLOUD_CODE_BASE = "https://cloudcode-pa.googleapis.com";
const USER_AGENT = "antigravity/windows/amd64";
const FALLBACK_PROJECT_ID = "bamboo-precept-lgxtn";

function getDefaultAccountsPath() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "opencode", "antigravity-accounts.json");
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfig, "opencode", "antigravity-accounts.json");
}

function parseArgs() {
  const args = process.argv.slice(2);
  let path = getDefaultAccountsPath();
  let accountIndex = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--path" && args[i + 1]) {
      path = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--account" && args[i + 1]) {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (!Number.isNaN(parsed)) {
        accountIndex = parsed - 1;
      }
      i += 1;
    }
  }
  return { path, accountIndex };
}

async function postJson(url, token, body, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Token refresh failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

async function loadProjectId(accessToken) {
  const body = { metadata: { ideType: "ANTIGRAVITY" } };
  try {
    const response = await postJson(`${CLOUD_CODE_BASE}/v1internal:loadCodeAssist`, accessToken, body);
    if (!response.ok) {
      return "";
    }
    const payload = await response.json();
    if (typeof payload.cloudaicompanionProject === "string") {
      return payload.cloudaicompanionProject;
    }
    if (payload.cloudaicompanionProject && typeof payload.cloudaicompanionProject.id === "string") {
      return payload.cloudaicompanionProject.id;
    }
  } catch (err) {
    // Silently ignore load code assist failures matching check-quota behavior
  }
  return "";
}

function classifyGroup(modelName) {
  const lower = modelName.toLowerCase();
  if (lower.includes("claude")) return "claude";
  if (!lower.includes("gemini-3")) return null;
  if (lower.includes("flash")) return "gemini-flash";
  return "gemini-pro";
}

function updateGroup(groups, group, remainingFraction, resetTime) {
  const entry = groups[group] || { modelCount: 0 };
  entry.modelCount += 1;
  if (typeof remainingFraction === "number") {
    if (entry.remainingFraction === undefined) {
      entry.remainingFraction = remainingFraction;
    } else {
      entry.remainingFraction = Math.min(entry.remainingFraction, remainingFraction);
    }
  }
  if (resetTime) {
    const timestamp = Date.parse(resetTime);
    if (Number.isFinite(timestamp)) {
      if (!entry.resetTime) {
        entry.resetTime = resetTime;
      } else {
        const existing = Date.parse(entry.resetTime);
        if (!Number.isFinite(existing) || timestamp < existing) {
          entry.resetTime = resetTime;
        }
      }
    }
  }
  
  // Weekly cap logic
  if (entry.resetTime) {
    const ts = Date.parse(entry.resetTime);
    if (ts - Date.now() > 12 * 60 * 60 * 1000) {
      entry.weeklyCapExhausted = true;
    } else {
      entry.weeklyCapExhausted = false;
    }
  } else {
    entry.weeklyCapExhausted = false;
  }
  
  groups[group] = entry;
}

function printGroup(label, entry) {
  if (!entry || !entry.modelCount) return;
  const remaining = typeof entry.remainingFraction === "number" ? Math.round(entry.remainingFraction * 100) : null;
  const status = remaining === null ? "UNKNOWN" : remaining <= 0 ? "LIMITED" : "OK";
  const details = [];
  if (remaining !== null) details.push(`remaining ${remaining}%`);
  if (entry.resetTime) {
    const delta = Date.parse(entry.resetTime) - Date.now();
    if (delta <= 0) {
      details.push("resets now");
    } else {
      const totalSeconds = Math.round(delta / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      details.push(`resets in ${hours}h ${minutes}m`);
    }
  }
  const suffix = details.length ? ` (${details.join(", ")})` : "";
  console.log(`   ${label}: ${status}${suffix}`);
}

async function run() {
  const { path, accountIndex } = parseArgs();
  let payload;
  try {
    payload = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`Failed to read ${path}: ${err.message}`);
    process.exit(1);
  }
  const accounts = payload.accounts || [];

  if (accounts.length === 0) {
    console.log("No accounts found.");
    return;
  }

  const selected = accountIndex === null
    ? accounts.map((account, index) => ({ account, index }))
    : accounts
      .map((account, index) => ({ account, index }))
      .filter((item) => item.index === accountIndex);

  let hasUpdates = false;

  for (const { account, index } of selected) {
    const label = account.email || `Account ${index + 1}`;
    const disabled = account.enabled === false ? " (disabled)" : "";
    console.log(`\n${index + 1}. ${label}${disabled}`);

    if (account.enabled === false) {
      console.log(`   Skipping disabled account`);
      continue;
    }

    try {
      const accessToken = await refreshAccessToken(account.refreshToken);
      let projectId = await loadProjectId(accessToken);
      if (!projectId) {
        projectId = account.managedProjectId || account.projectId || FALLBACK_PROJECT_ID;
      }

      const body = projectId ? { project: projectId } : {};
      let response;
      try {
        response = await postJson(
          `${CLOUD_CODE_BASE}/v1internal:fetchAvailableModels`,
          accessToken,
          body,
        );
      } catch (fetchErr) {
        console.log(`   error: fetch failed - ${fetchErr.message}`);
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.log(`   error: fetchAvailableModels returned ${response.status} - ${text.trim().slice(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const groups = {};
      const models = data.models || {};
      for (const [modelName, info] of Object.entries(models)) {
        const group = classifyGroup(modelName);
        if (!group) continue;
        if (!info || !info.quotaInfo) continue;
        const remaining = info.quotaInfo.remainingFraction ?? 0;
        updateGroup(groups, group, remaining, info.quotaInfo.resetTime);
      }
      
      printGroup("Claude", groups["claude"]);
      printGroup("Gemini 3 Pro", groups["gemini-pro"]);
      printGroup("Gemini 3 Flash", groups["gemini-flash"]);
      
      // Update account in payload
      account.cachedQuota = groups;
      account.cachedQuotaUpdatedAt = Date.now();
      hasUpdates = true;
      console.log(`   ✓ Updated cached quota`);
      
    } catch (error) {
      console.log(`   error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  if (hasUpdates) {
    const tempPath = `${path}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      writeFileSync(tempPath, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
      renameSync(tempPath, path);
      console.log(`\nSaved updated quota state to ${path}`);
    } catch (err) {
      console.error(`\nFailed to save updated quota state to ${path}: ${err.message}`);
      try { unlinkSync(tempPath); } catch {}
    }
    
    // Also try to update the legacy quota-state file if it exists so `health` works
    const configDir = dirname(path);
    const legacyPath = join(configDir, "antigravity-quota-state.json");
    try {
      const legacyState = JSON.parse(readFileSync(legacyPath, "utf8"));
      if (legacyState && legacyState.accounts) {
        let legacyUpdated = false;
        for (const { account } of selected) {
          if (account.email && legacyState.accounts[account.email] && account.cachedQuota) {
            const models = [];
            for (const [group, data] of Object.entries(account.cachedQuota)) {
              let family = group;
              if (group === "gemini-pro") family = "gemini_pro";
              if (group === "gemini-flash") family = "gemini_flash";
              
              models.push({
                family: family,
                remainingFraction: data.remainingFraction,
                resetTime: data.resetTime || ""
              });
            }
            legacyState.accounts[account.email].models = models;
            legacyState.accounts[account.email].lastRefresh = Date.now();
            legacyUpdated = true;
          }
        }
        if (legacyUpdated) {
          const legacyTempPath = `${legacyPath}.${randomBytes(6).toString("hex")}.tmp`;
          try {
            writeFileSync(legacyTempPath, JSON.stringify(legacyState, null, 2), { encoding: "utf8", mode: 0o600 });
            renameSync(legacyTempPath, legacyPath);
            console.log(`Updated legacy quota state in ${legacyPath}`);
          } catch (writeErr) {
            console.warn(`Legacy quota-state update failed during write: ${writeErr.message}`);
            try { unlinkSync(legacyTempPath); } catch {}
          }
        }
      }
    } catch (err) {
      console.warn(`Legacy quota-state update skipped: ${err.message}`);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
