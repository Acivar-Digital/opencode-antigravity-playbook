# Admin Tools Revamp Plan (Compute-Based Quota Adaptation)

**Date:** June 20, 2026
**Context:** Google's migration to an active compute-based usage model involving a 5-hour local dynamic rolling window and a hard 7-day weekly cap.

## 1. The GCP Account Requirement & Checking Limits

### How do we even check the limits?
The Antigravity plugin and admin tools monitor quotas by hitting Google's undocumented internal endpoint:
`POST https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`

### Do we need a GCP account?
**Yes.** Google's internal Cloud Code API strictly requires the request to be associated with a Google Cloud Platform (GCP) project. 

Currently, `admin/fetch-now.mjs` and `src/plugin/project.ts` attempt to do this automatically by calling `v1internal:loadCodeAssist`, which asks Google to spin up a hidden managed project (returned as `cloudaicompanionProject`). 
However, under the new compute rules, Google often restricts the creation of these managed projects for accounts under high load. If `loadCodeAssist` fails, the `fetchAvailableModels` request will return `403 Forbidden` or `400 Bad Request` unless a manual GCP project is provided.

**Required Action:** Users must create a free GCP project, enable the "Cloud AI Companion API", and add the `projectId` to their `antigravity-accounts.json` under `account.projectId`. The admin tools will then inject this into the `fetchAvailableModels` payload:
```javascript
// Payload sent to Google to check live quotas
const body = { project: account.projectId }; 
```

---

## 2. Structural Code Insertions & Impacted Files

### A. Fixing the Fiduciary Trap (`admin/reset-accounts.mjs`)
**Impacted File:** `admin/reset-accounts.mjs`
**Current Code to Remove:**
```javascript
// Currently wipes out the reality of Google's hard bans
account.rateLimitResetTimes = {};
account.cachedQuota = {};
```
**Code to Insert:**
```javascript
// Only clear transient local blockages. Preserve Google's truth.
account.enabled = true;
account.coolingDownUntil = null;
account.cooldownReason = null;
account.verificationRequired = false;
account.verificationRequiredAt = null;
account.verificationRequiredReason = null;
account.verificationUrl = null;

// DO NOT touch account.rateLimitResetTimes or account.cachedQuota
// We must respect the Fiduciary rule: if Google says they are out of compute, they are out of compute.
```

### B. Shared Compute Aggregation (`scripts/monitor.mjs` & `admin/fetch-now.mjs`)
**Impacted Files:** `scripts/monitor.mjs`, `admin/fetch-now.mjs`
**The Problem:** Google now issues a *shared* compute quota across the entire account/project, but the API still returns an array of models, all repeating the exact same `remainingFraction` and `resetTime`. We need to aggregate them so the UI isn't spammed with 10 identical progress bars.

**Code to Insert (Aggregation Logic in `monitor.mjs`):**
```javascript
// Inside renderDashboard(), when formatting quotaGroups:
const groupedByQuota = new Map();

for (const [modelName, g] of Object.entries(quotaGroups)) {
  const signature = `${g.remaining}_${g.resetTime}`;
  if (!groupedByQuota.has(signature)) {
    groupedByQuota.set(signature, { models: [], quota: g });
  }
  groupedByQuota.get(signature).models.push(modelName);
}

// Render the aggregated pools
for (const [signature, group] of groupedByQuota.entries()) {
  const modelList = group.models.length > 2 
    ? `${group.models[0]}, ${group.models[1]} + ${group.models.length - 2} more`
    : group.models.join(", ");
    
  const bar = progressBar(group.quota.remaining);
  const title = group.models.length > 1 ? `Shared Pool (${modelList})` : modelList;
  
  // Render the single unified bar
  console.log(`     ${title.padEnd(45)}  ${bar}`);
}
```

### C. The 5-Hour Rolling Window Heuristics
**Impacted Files:** `scripts/monitor.mjs`, `admin/fetch-now.mjs`, `src/plugin/quota.ts`
**The Problem:** The codebase currently hardcodes `> 12 hours` as the definition of a weekly cap exhaustion.

**Code to Insert (Replacing the 12-hour logic):**
```javascript
// Updated heuristic based on the 5-hour local dynamic window
const msUntilReset = Date.parse(resetTime) - Date.now();

let windowStatus = "Unknown";
let weeklyCapExhausted = false;

if (msUntilReset <= 0) {
  windowStatus = "Resetting...";
} else if (msUntilReset <= 5 * 3600_1000) {
  // Within the 5-hour local dynamic window
  windowStatus = `Dynamic Window (resets in ${formatDuration(msUntilReset)})`;
  weeklyCapExhausted = false;
} else {
  // Exceeds 5 hours: This is a hard cap (7-day or standard 24h penalty)
  windowStatus = `Hard Cap Exhausted (resets in ${formatDuration(msUntilReset)})`;
  weeklyCapExhausted = true; // Signals the rotation manager to permanently skip this account for the session
}
```

---

## 3. Deployment & Testing Strategy
1. **Update the Scripts:** Apply the exact insertions above to the respective `.mjs` and `.ts` files.
2. **Execute `admin/fetch-now`:** Run the manual fetch script. Verify that it correctly maps the 5-hour boundary and successfully persists the data to `antigravity-accounts.json` without destroying the quota blocks.
3. **Execute `admin/health --live`:** Verify the UI aggregation. The terminal should now display clean, unified "Shared Pool" progress bars instead of spamming 10 individual models.
4. **Execute `admin/reset`:** Manually sabotage `antigravity-accounts.json` by adding dummy `cachedQuota` data. Run the reset tool and verify that the `cachedQuota` **survives** the reset, proving the fiduciary fix is active.
