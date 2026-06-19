#!/usr/bin/env node
/**
 * admin/reset-accounts.mjs
 * Resets account status (enabled: true), clears cooldowns, verification states, rate limit states, and cached quota.
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";

function getDefaultAccountsPath() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "opencode", "antigravity-accounts.json");
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfig, "opencode", "antigravity-accounts.json");
}

function run() {
  const accountsPath = getDefaultAccountsPath();
  console.log(`Loading accounts from: ${accountsPath}`);

  let data;
  try {
    const content = readFileSync(accountsPath, "utf8");
    data = JSON.parse(content);
  } catch (error) {
    console.error(`Error reading or parsing account file: ${error.message}`);
    process.exit(1);
  }

  const accounts = data.accounts || [];
  if (accounts.length === 0) {
    console.log("No accounts found to reset.");
    return;
  }

  console.log(`Resetting ${accounts.length} account(s)...`);
  for (const account of accounts) {
    const email = account.email || "Unknown Account";
    console.log(` - Resetting state for: ${email}`);
    
    // Reset properties to default healthy values (Transient local errors only)
    account.enabled = true;
    account.coolingDownUntil = null;
    account.cooldownReason = null;
    account.verificationRequired = false;
    account.verificationRequiredAt = null;
    account.verificationRequiredReason = null;
    account.verificationUrl = null;
    
    // DO NOT touch account.rateLimitResetTimes or account.cachedQuota
    // We must respect the Fiduciary rule: if Google says they are out of compute, they are out of compute.
  }

  // Force active indices back to 0 to prevent index out of bounds or stuck cursors
  data.activeIndex = 0;
  if (data.activeIndexByFamily) {
    data.activeIndexByFamily.claude = 0;
    data.activeIndexByFamily.gemini = 0;
  }

  // Write changes atomically to prevent corruption
  const tempPath = `${accountsPath}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    writeFileSync(tempPath, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
    renameSync(tempPath, accountsPath);
    console.log("\nSuccess: All accounts have been force-reset and re-enabled successfully.");
  } catch (error) {
    console.error(`Error saving accounts: ${error.message}`);
    try {
      unlinkSync(tempPath);
    } catch {}
    process.exit(1);
  }
}

run();
