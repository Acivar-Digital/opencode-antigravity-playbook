# Antigravity IDE Telemetry Capture Tools

This directory contains utility tools designed to intercept, decrypt, and log HTTP/HTTPS traffic from the Google Antigravity IDE to understand exactly what headers and telemetry are being sent.

---

## 🛠️ Tools Overview

### 1. `proxy`
A lightweight MITM (Man-in-the-Middle) HTTPS decryption proxy.
- **Path**: `admin/capture/proxy`
- **Port**: Defaults to `8888` (configurable with `--port <number>`)
- **Key Files Created**:
  - `admin/capture/certs/rootCA.pem`: Root CA certificate you must trust to decrypt HTTPS.
  - `admin/capture/capture.jsonl`: The output log file containing structured request details with redacted auth tokens.

### 2. `analyze`
A comparison analyzer that reads the logged requests and does a side-by-side gap analysis against the plugin's header configurations.
- **Path**: `admin/capture/analyze`
- **Output**: Detailed stdout table highlighting missing or extra headers, and formatting mismatches.

---

## 🚀 How to Capture and Analyze Traffic

### Step 1: Start the Proxy
In a separate terminal or background shell, run:
```bash
admin/capture/proxy
```
This will print the location of the generated Root CA (`rootCA.pem`).

### Step 2: Trust the Root CA
To allow the proxy to decrypt HTTPS traffic without certificate errors:
- **macOS**: Double-click `admin/capture/certs/rootCA.pem`, add it to the Keychain, double-click it in Keychain Access, and set "When using this certificate" to **Always Trust**.
- **Linux**: Copy the certificate to your system certificate store (e.g., `/usr/local/share/ca-certificates/` or `/etc/ca-certificates/trust-source/anchors/`) and run the update tool (e.g., `sudo update-ca-certificates`).
- **Windows**: Install the certificate into the "Trusted Root Certification Authorities" store.

### Step 3: Run the IDE via Proxy
Launch the Antigravity IDE with the `HTTPS_PROXY` environment variable set:
```bash
export HTTPS_PROXY=http://127.0.0.1:8888
# Launch your Antigravity IDE here (e.g. VS Code, Cursor, or your specific GUI instance)
```

### Step 4: Run Telemetry Analysis
Once you have interacted with the IDE, stop the proxy (`Ctrl+C`) and run the analyzer to compare headers:
```bash
admin/capture/analyze
```
The script will output a table of all captured headers per endpoint, identifying missing headers, extra headers, and mismatches.
