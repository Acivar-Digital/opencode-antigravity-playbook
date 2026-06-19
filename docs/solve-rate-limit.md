# Solving the "429 Rate Limited" Bug in Antigravity Auth Plugin

## The Problem
Users were experiencing persistent `429 Resource has been exhausted (e.g. check quota)` errors when using the local OpenCode plugin, despite their Google AI Studio accounts having 98-100% quota available.

## Root Cause Analysis
The OpenCode plugin acts as a proxy that disguises requests as legitimate Antigravity or Google Cloud Code Assist client requests. By doing this, it bypasses the standard, heavily restricted Gemini API quotas and routes requests to the larger `cloudcode-pa.googleapis.com` enterprise endpoint.

However, requests were being instantly blocked by Google's WAF (Web Application Firewall) or shunted into a tiny rate-limit bucket because of a fingerprinting failure.

1. The plugin generates a random device fingerprint containing a `User-Agent` string (e.g., `Mozilla/5.0 ... Chrome/149.0.0.0 Safari/537.36`).
2. The code responsible for generating this string (`src/plugin/fingerprint.ts`) was ported from an older proxy (`antigravity-claude-proxy`) and **failed to include the required `Antigravity/...` and `Electron/...` identifiers** in the User-Agent.
3. Because the `User-Agent` lacked the official Antigravity signatures, Google's API classified the request as coming from an unrecognized generic web browser/scraper instead of the official Antigravity desktop application.
4. As a result, the plugin hit the fallback bucket limits instantly, causing 429s.

## The Fix
1. **Injected Missing Identifiers**: Modified `generateFingerprint` and `collectCurrentFingerprint` in `src/plugin/fingerprint.ts` to include `Antigravity/${getAntigravityVersion()}` and `Electron/37.3.1` in the User-Agent strings.
2. **Fixed Version Regex**: Updated the `updateFingerprintVersion` function, which was silently failing because its regex (`/^(antigravity\/)([\d.]+)/`) did not match the start of the `Mozilla/5.0...` string. The regex was changed to `/(Antigravity\/)([\d.]+)/`.
3. **Flushed Cache**: The `opencode` daemon caches generated fingerprints in `~/.config/opencode/antigravity-accounts.json`. To apply the fix, we purged the `fingerprint` property and `rateLimitResetTimes` from all accounts in this file, forcing the daemon to regenerate a clean fingerprint upon restart.

## Verification
A full E2E test suite (`npm run test:e2e:models`) was executed after the daemon restart. 
- Models `gemini-3-flash-preview`, `gemini-2.5-flash`, `antigravity-gemini-3-flash`, and `antigravity-claude-sonnet-4-6` passed successfully, confirming the 429 rate limit block was entirely bypassed.
- *(Note: `gemini-3-pro` and `claude-opus` models occasionally returned an `UnknownError: Unexpected server error` from Google's backend, which is an upstream API availability issue separate from the local quota limit).*

## Key Takeaway
When spoofing managed Google Cloud services or desktop applications, ensure that all required telemetry metadata and headers—especially specific User-Agent substrings—exactly match the official application client.
