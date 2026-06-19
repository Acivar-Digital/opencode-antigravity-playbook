# Plan: Google OAuth in OpenCode — Current State & Path Forward

## Situation Assessment

The Google OAuth setup in OpenCode **already works** as of today. The plugin is loaded, accounts are configured, and the single-endpoint fix (commit `4bb628a`) resolved the infinite retry loop that killed the Pro account.

### What's currently working

| Component | Status |
|-----------|--------|
| Plugin loads from `ocagvrotate/dist/index.js` | ✅ Configured in `opencode.json` |
| `google` provider with 14 models | ✅ 10 Gemini + 4 Claude models |
| OAuth token refresh | ✅ `refreshAccessToken()` → `oauth2.googleapis.com/token` |
| Single endpoint (`cloudcode-pa.googleapis.com`) | ✅ No more dead sandbox fallbacks |
| Account rotation (sticky strategy) | ✅ 3 active accounts |
| Claude transform path (thinking block stripping, schema sanitization) | ✅ Live code for your Opus/Sonnet usage |
| Token exchange (`exchangeAntigravity`) | ✅ PKCE flow → refresh token + project ID |

### Active accounts (sticky strategy)

| Index | Email | Status | Claude quota | Gemini quota |
|-------|-------|--------|-------------|--------------|
| 1 | yapfrandb@gmail.com | ✅ Enabled | 100% | 99.99% |
| 2 | yapcheeleong@gmail.com | ❌ Disabled | 100% | 96.46% |
| 3 | yapily77@gmail.com | ❌ Disabled | 0% (exhausted) | 100% |
| 4 | emilywonderme@gmail.com | ✅ Enabled | 100% | 100% |
| 0 | arthityap77@gmail.com | ❌ Disabled | 100% | 99.84% |
| 5 | haimy726524@gmail.com | ❌ Disabled | 96.3% | 100% |

### Known issue

- `yapfrandb@gmail.com` Pro account was likely banned by Google due to the 412 rapid-fire retry loop (June 18, 2026, 13:59–14:05 UTC). Unclear if recoverable.

---

## Immediate Plan: Verify & Harden

The system works. The priority is to **verify it works end-to-end** and **prevent another account loss**.

### Step 1: Live test with single account

Switch to a single enabled account and verify a full request cycle:

1. Set `account_selection_strategy: "sticky"` (already done)
2. Ensure only `yapfrandb@gmail.com` is enabled (index 1 — already done)
3. Run OpenCode with `google/antigravity-claude-opus-4-6-thinking` model
4. Send a simple prompt, verify response comes back
5. Check logs for any 429/412/503 errors

### Step 2: Verify token refresh works

The refresh tokens were updated recently. Verify they're valid:

```bash
curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com" \
  -d "client_secret=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" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=<token from antigravity-accounts.json>"
```

Do this for each account to confirm no token is revoked.

### Step 3: Harden rate limiting (prevent repeat of yapfrandb loss)

Current backoff tiers in `accounts.ts`:
- `CAPACITY_BACKOFF_TIERS_MS = [5000, 10000, 20000, 30000, 60000]`
- `MODEL_CAPACITY_EXHAUSTED_BASE_BACKOFF = 45_000` (+ ±15s jitter)
- `RATE_LIMIT_EXCEEDED_BACKOFF = 30_000`

These are already conservative. The 412 retry storm was caused by the **dead sandbox endpoints** (removed in `4bb628a`). With single-endpoint fail-fast, a 429 now triggers account rotation instead of infinite retry.

**No code changes needed** — the fix is already deployed.

### Step 4: Enable more accounts for rotation

Currently only `yapfrandb` and `emilywonderme` are enabled. `yapfrandb` was the burned account. Recommend:

- Keep `yapfrandb` disabled until you confirm Google unbanned it
- Enable `yapcheeleong` (index 2) as secondary — has 96.46% Gemini quota
- Enable `arthityap77` (index 0) as tertiary — has 99.84% Gemini quota
- Keep `yapily77` disabled — Claude quota exhausted (0%)
- Keep `haimy726524` disabled — user preference

This gives you 3 active accounts (emilywonderme + yapcheeleong + arthityap77) with healthy quotas.

---

## Execution Steps (in order)

1. **Test refresh tokens** for all 6 accounts via curl
2. **Enable yapcheeleong and arthityap77** in `antigravity-accounts.json`
3. **Rebuild plugin** (`npm run build`) — no code changes needed unless step 1 reveals issues
4. **Test live** — run OpenCode with a Google model, verify response
5. **Monitor** — watch logs for 429s, verify account rotation triggers correctly

---

## Risks

| Risk | Mitigation |
|------|-----------|
| yapfrandb still banned by Google | Use other accounts; try re-auth later |
| Refresh token expired/revoked | Re-run OAuth flow (`authorizeAntigravity` → browser → `exchangeAntigravity`) |
| cloudcode-pa.googleapis.com goes down | No fallback — fail fast. User switches to literouter provider. |
| Claude Opus 4.6 thinking model has issues | Check `isClaudeThinkingModel` path in request.ts |

---

## No Code Changes Needed

The plugin is already in a working state. The plan is purely operational:
1. Verify tokens
2. Enable more accounts
3. Test live
4. Monitor
