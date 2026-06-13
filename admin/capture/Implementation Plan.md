# Spoofing Antigravity IDE Telemetry Headers

The analysis of the legitimate traffic capture from the proxy reveals significant discrepancies between the `opencode-antigravity-auth` plugin's current headers and the real Google Antigravity IDE traffic. To ensure our requests are indistinguishable from the legitimate application and to mitigate rate limiting or blocking, we will apply the following updates.

## Proposed Changes

### `src/constants.ts`
Remove extra/invalid headers that the plugin currently injects but the real IDE does not:
- **[MODIFY] src/constants.ts**: 
  - Update `getAntigravityHeaders()` to stop returning `X-Goog-Api-Client` and `Client-Metadata`.
  - Update `getRandomizedHeaders()` to stop returning these headers for `antigravity` mode.
  - Update the `HeaderSet` type to make these optional or remove them.

### `src/plugin/fingerprint.ts`
Implement robust Chrome browser header spoofing based on the gap analysis:
- **[MODIFY] src/plugin/fingerprint.ts**:
  - Update `generateFingerprint()` to build a highly realistic Chrome `User-Agent` string (`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36`) and populate the fingerprint state with the associated metadata (e.g., version `149.0.7827.53`, platform `Linux`, bitness `64`).
  - Update `buildFingerprintHeaders(fingerprint)` to output the missing telemetry headers:
    - `sec-ch-ua`: `"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"`
    - `sec-ch-ua-mobile`: `?0`
    - `sec-ch-ua-platform`: `"Linux"`
    - `sec-ch-ua-arch`: `"x86"`
    - `sec-ch-ua-bitness`: `"64"`
    - `sec-ch-ua-full-version`: `"149.0.7827.53"`
    - `sec-ch-ua-full-version-list`: `"Google Chrome";v="149.0.7827.53", "Chromium";v="149.0.7827.53", "Not)A;Brand";v="24.0.0.0"`
    - `sec-ch-ua-form-factors`: `"Desktop"`
    - `sec-ch-ua-wow64`: `?0`
    - `sec-ch-ua-model`: `""`
    - `x-client-data`: A generic valid `x-client-data` string (e.g. `CIy2yQEIprbJAQipncoBCP/4ygEIkqHLAQiHoM0BCK7LlDAIl8+UMAjGz5QwCIHQlDAI9dGUMA==`) to replicate Chrome Variations data.
    - `x-browser-channel`: `stable`
    - `x-browser-year`: `2026`
    - `x-browser-copyright`: `Copyright 2026 Google LLC. All Rights Reserved.`
    - `x-browser-validation`: A realistic stub or random valid-looking base64.
    - `x-chrome-id-consistency-request`: `version=1,client_id=77185425430.apps.googleusercontent.com,device_id=2f4ff896-3c72-4ff1-83d0-1262e93770ed,sync_account_id=114222513075580195089,signin_mode=all_accounts,signout_mode=show_confirmation`
    - Google Update/Ext Headers: Add stubs for `x-goog-update-appid`, `x-goog-update-interactivity`, `x-goog-update-updater`.

### `src/plugin/request.ts`
Ensure the newly constructed headers are properly injected into outgoing requests.
- **[MODIFY] src/plugin/request.ts**:
  - In `prepareAntigravityRequest()`, inject the new headers returned by `buildFingerprintHeaders()` into the `headers` object for `antigravity` mode.
  - Verify that standard HTTP headers like `accept-language` and `accept` match what was observed in the capture (if not handled by `node-fetch`/the browser engine natively).

## Open Questions

> [!WARNING]
> Hardcoding Chrome 149 and 2026 for the browser year might eventually become stale, but for the current goal of mimicking the proxy capture accurately, it is best to stick with what was verified in the gap analysis. Should I parameterize the OS/architecture to match the host running the plugin, or hardcode it strictly to match the capture (`Linux x86_64`)?

## User Review Required

Please review the proposed plan. If approved, I will implement these changes to eliminate the fingerprinting gaps.
