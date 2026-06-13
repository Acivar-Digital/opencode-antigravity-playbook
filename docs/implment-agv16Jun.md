# Skill: Antigravity Multi-Account Round-Robin Rotation

This document outlines the implementation and verification of persistent multi-account round-robin rotation for the OpenCode Antigravity Auth plugin.

## Context
Google OAuth account rotation distributes rate limits and quotas across multiple accounts. In CLI environments, consecutive runs of `opencode run` launch independent processes. Previously, the selected `activeIndex` was not written to disk on selection, meaning subsequent CLI invocations would load the same stale index.

## Implementation Details
In `src/plugin/accounts.ts`, inside the `getCurrentOrNextForFamily` method, the plugin was updated to persist the new active index to disk when selecting a new account under the `round-robin` or `hybrid` strategies:

```typescript
    if (strategy === 'round-robin') {
      const next = this.getNextForFamily(family, model, headerStyle, softQuotaThresholdPercent, softQuotaCacheTtlMs);
      if (next) {
        this.markTouchedForQuota(next, quotaKey);
        this.currentAccountIndexByFamily[family] = next.index;
        this.requestSaveToDisk();
      }
      return next;
    }
```

## Verification Results
1. **Configured Pool**: 6 enabled accounts and 1 disabled account.
2. **Execution**: Ran `opencode run "hi"` 7 times sequentially.
3. **Log Output Trace**:
   - Run 1 -> Selected: `yapily77@gmail.com (1/6)`
   - Run 2 -> Selected: `yapcheeleong@gmail.com (2/6)`
   - Run 3 -> Selected: `arthityap77@gmail.com (3/6)`
   - Run 4 -> Selected: `yapfrandb@gmail.com (4/6)`
   - Run 5 -> Selected: `haimy726524@gmail.com (5/6)`
   - Run 6 -> Selected: `yapily77@gmail.com (1/6)` (Wrapped back to first account)
   - Run 7 -> Selected: `yapcheeleong@gmail.com (2/6)`

The verification confirms that the round-robin routing logic successfully persists across separate process invocations.
