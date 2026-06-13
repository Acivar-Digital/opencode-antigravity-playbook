# Task: Enable Chrome Telemetry Spoofing for Antigravity-CLI requests

## Background
The plugin currently supports two request paths:
1. `antigravity`: Injects high-fidelity browser/Chrome telemetry headers (`sec-ch-ua-*`, `x-client-data`, etc.) using a persistent per-account fingerprint.
2. `antigravity-cli`: Uses a minimal User-Agent (`antigravity/cli/1.0.1 ${os}/${arch}`) and a simple JSON string in `Client-Metadata`.

To align `antigravity-cli` with the high-fidelity headers and minimize detection risk on Google's production endpoints, we want to upgrade the `antigravity-cli` path to also support full Chrome browser telemetry spoofing.

---

## Technical Approach

### 1. Update `buildFingerprintHeaders` in `src/plugin/fingerprint.ts`
Verify if `buildFingerprintHeaders` or the `Fingerprint` interface requires style-dependent overrides. For the CLI, we can generate a fingerprint containing `ideType: "ANTIGRAVITY_CLI"` or `pluginType: "NONE"`, but we want the actual HTTP headers to emulate a real Google Chrome browser.
- Ensure `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`, `sec-ch-ua-platform-version`, `x-client-data`, and `x-chrome-id-consistency-request` are properly generated and structured for both.

### 2. Update `prepareAntigravityRequest` in `src/plugin/request.ts`
Look at lines `1541-1565` in `src/plugin/request.ts`:
```typescript
  if (headerStyle === "antigravity") {
    // Use randomized headers as the fallback pool for Antigravity mode
    const selectedHeaders = getRandomizedHeaders("antigravity", requestedModel);

    // Antigravity mode: Match Antigravity Manager behavior
    const fingerprint = options?.fingerprint ?? getSessionFingerprint();
    const fingerprintHeaders = buildFingerprintHeaders(fingerprint);

    // Set all fingerprint-derived Chrome telemetry headers
    for (const [key, value] of Object.entries(fingerprintHeaders)) {
      if (value !== undefined) {
        headers.set(key, value);
      }
    }
    if (!headers.has("User-Agent") && selectedHeaders["User-Agent"]) {
      headers.set("User-Agent", selectedHeaders["User-Agent"]);
    }
  } else {
    // antigravity-cli mode
    const cliHeaders = getRandomizedHeaders("antigravity-cli", requestedModel);
    headers.set("User-Agent", cliHeaders["User-Agent"]);
    if (cliHeaders["Client-Metadata"]) {
      headers.set("Client-Metadata", cliHeaders["Client-Metadata"]);
    }
  }
```

We should update this so that:
- In `antigravity-cli` mode, if a fingerprint is available or generated, we also build and inject the Chrome telemetry headers.
- If we inject the Chrome browser spoofing headers (such as `sec-ch-ua`, `x-client-data`, etc.), we must ensure the `User-Agent` matches a browser User-Agent rather than `antigravity/cli/...` (since mixing a CLI User-Agent with browser Client Hints/`x-client-data` is an obvious signature anomaly).
- Or, if keeping the `antigravity-cli` User-Agent, we should carefully decide which headers are safe to send. (Typically, we want `antigravity-cli` requests to look like authentic browser requests or authentic CLI requests without mixed signals).
- **Recommended Strategy:** Make the `antigravity-cli` header path use a separate, dedicated "Browser Profile" or reuse the account's Chrome browser fingerprint but adjust the `x-chrome-id-consistency-request` or `Client-Metadata` headers to reflect CLI mode if absolutely required, OR fully emulate the Chrome browser for both paths (using different sandbox/prod endpoints as the only distinction).

### 3. Verify and Run Tests
Verify all changes by running the test suite:
```bash
npm run typecheck
npm test
```
Ensure that any tests checking headers are updated to handle the new telemetry mappings.
