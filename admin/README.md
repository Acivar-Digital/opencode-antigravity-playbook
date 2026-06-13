# Antigravity Administrator Tools

This directory contains administrative tools for checking and resetting the state of your configured Google OAuth accounts.

## Tools Overview

### 1. `health`
Checks the current health status of all configured accounts.
- **Path**: `admin/health`
- **Options**:
  - `admin/health` (reads local cache data)
  - `admin/health --live` (queries Google API live to fetch real-time quota remaining fractions)
  - `admin/health --watch` (constantly monitors and updates every 30 seconds)

---

### 2. `reset`
Force-resets the status of all accounts inside `antigravity-accounts.json` back to healthy.
- **Path**: `admin/reset`
- **Use Case**: Run this command when you believe the account usage is not reflecting the correct situation (e.g., if accounts are stuck in `enabled: false`, cooling down, or showing verification requirements when they shouldn't).
- **Actions performed**:
  - Sets `enabled: true` for all accounts.
  - Clears `coolingDownUntil` and `cooldownReason`.
  - Resets `verificationRequired` to `false` and clears all verification fields.
  - Clears rate limit reset times and cached quotas.
  - Resets active index cursors to `0`.

---

### 3. `check-health.mjs`
The underlying Node.js module that powers the `health` checker.

---

### 4. `reset-accounts.mjs`
The underlying Node.js module that powers the `reset` tool.
