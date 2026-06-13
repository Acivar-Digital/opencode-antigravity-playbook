#!/usr/bin/env node
/**
 * admin/capture/proxy.mjs
 * Lightweight HTTPS MITM proxy for capturing Google Antigravity IDE headers.
 * Uses system `openssl` to generate dynamic certificates.
 */

import * as http from "node:http";
import * as https from "node:https";
import * as net from "node:net";
import * as tls from "node:tls";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CERTS_DIR = path.join(__dirname, "certs");
const CA_KEY = path.join(CERTS_DIR, "rootCA.key");
const CA_PEM = path.join(CERTS_DIR, "rootCA.pem");
const LOG_FILE = path.join(__dirname, "capture.jsonl");

// Setup certs directory
if (!fs.existsSync(CERTS_DIR)) {
  fs.mkdirSync(CERTS_DIR, { recursive: true });
}

// Generate root CA if missing
function ensureRootCA() {
  if (fs.existsSync(CA_KEY) && fs.existsSync(CA_PEM)) {
    return;
  }
  console.log("Generating self-signed Root CA for HTTPS decryption...");
  try {
    execSync(`openssl genrsa -out "${CA_KEY}" 2048`, { stdio: "ignore" });
    fs.chmodSync(CA_KEY, 0o600);
    execSync(`openssl req -x509 -new -nodes -key "${CA_KEY}" -sha256 -days 3650 -subj "/CN=Antigravity Capture CA/O=Development/OU=Telemetry Check" -out "${CA_PEM}"`, { stdio: "ignore" });

    console.log(`\n======================================================`);
    console.log(`ROOT CA GENERATED SUCCESSFULLY.`);
    console.log(`To capture HTTPS traffic, you MUST trust the Root CA certificate:`);
    console.log(`👉 Certificate Path: ${CA_PEM}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error("Failed to generate Root CA with openssl. Please ensure 'openssl' is installed and in your PATH.", err);
    process.exit(1);
  }
}

// Cache of generated certificates
const certCache = new Map();

// Generate or retrieve a certificate for a specific host
function getCertForHost(hostname) {
  if (certCache.has(hostname)) {
    return certCache.get(hostname);
  }

  const certPath = path.join(CERTS_DIR, `${hostname}.crt`);
  const hostKeyPath = path.join(CERTS_DIR, `${hostname}.key`);
  const csrPath = path.join(CERTS_DIR, `${hostname}.csr`);

  if (!fs.existsSync(certPath) || !fs.existsSync(hostKeyPath)) {
    try {
      // Generate per-host key
      execSync(`openssl genrsa -out "${hostKeyPath}" 2048`, { stdio: "ignore" });
      fs.chmodSync(hostKeyPath, 0o600);

      // Create a config extension file for SAN (Subject Alternative Name)
      const extPath = path.join(CERTS_DIR, `${hostname}.ext`);
      const extContent = `authorityKeyIdentifier=keyid,issuer\nbasicConstraints=CA:FALSE\nkeyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment\nsubjectAltName = @alt_names\n\n[alt_names]\nDNS.1 = ${hostname}\n`;
      fs.writeFileSync(extPath, extContent);

      // Generate CSR
      execSync(`openssl req -new -key "${hostKeyPath}" -subj "/CN=${hostname}" -out "${csrPath}"`, { stdio: "ignore" });
      // Sign with Root CA
      execSync(`openssl x509 -req -in "${csrPath}" -CA "${CA_PEM}" -CAkey "${CA_KEY}" -CAcreateserial -out "${certPath}" -days 365 -sha256 -extfile "${extPath}"`, { stdio: "ignore" });

      // Clean up temp CSR and extension files
      try {
        fs.unlinkSync(csrPath);
        fs.unlinkSync(extPath);
      } catch {}
    } catch (err) {
      console.error(`Failed to generate cert for ${hostname}:`, err.message);
      return null;
    }
  }

  const certData = {
    key: fs.readFileSync(hostKeyPath),
    cert: fs.readFileSync(certPath),
  };
  certCache.set(hostname, certData);
  return certData;
}

// Main logic to log requests to JSONL
function logRequest(req, isHttps = false) {
  const headers = {};
  for (const [key, val] of Object.entries(req.headers)) {
    // Redact sensitive headers but keep structure information
    if (key === "authorization") {
      headers[key] = val.startsWith("Bearer ") ? "Bearer [REDACTED]" : "[REDACTED]";
    } else if (key === "cookie" || key === "x-goog-api-key" || key === "x-api-key") {
      headers[key] = "[REDACTED]";
    } else {
      headers[key] = val;
    }
  }

  const host = req.headers.host || "";
  const scheme = isHttps ? "https://" : "http://";
  let url = req.url.startsWith("http") ? req.url : `${scheme}${host}${req.url}`;

  // Redact sensitive query parameters from logged URL
  try {
    const parsedUrl = new URL(url);
    for (const key of Array.from(parsedUrl.searchParams.keys())) {
      if (/^(access_token|api_key|apikey|token|key|secret|password|auth)$/i.test(key)) {
        parsedUrl.searchParams.set(key, "[REDACTED]");
      }
    }
    url = parsedUrl.toString();
  } catch {}

  // Check if this is a Google AI / Cloud Code Companion endpoint
  let endpointType = "other";
  if (url.includes("v1internal:streamGenerateContent") || url.includes("streamGenerateContent")) {
    endpointType = "streamGenerateContent";
  } else if (url.includes("v1internal:generateContent") || url.includes("generateContent")) {
    endpointType = "generateContent";
  } else if (url.includes("v1internal:loadCodeAssist") || url.includes("loadCodeAssist")) {
    endpointType = "loadCodeAssist";
  } else if (url.includes("v1internal:fetchAvailableModels") || url.includes("fetchAvailableModels")) {
    endpointType = "fetchAvailableModels";
  } else if (url.includes("v1internal:onboardUser") || url.includes("onboardUser")) {
    endpointType = "onboardUser";
  } else if (url.includes("retrieveUserQuota")) {
    endpointType = "retrieveUserQuota";
  }

  const entry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url,
    headers,
    endpointType,
  };

  console.log(`[CAPTURE] [${entry.endpointType.toUpperCase()}] ${entry.method} ${entry.url}`);
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
}

// Start MITM Server
async function startProxy(port = 8888) {
  ensureRootCA();

  // Create a silent local HTTPS server for decrypting intercepted traffic
  const secureContexts = new Map();
  const mitmHttpsServer = https.createServer({
    SNICallback: (servername, cb) => {
      let ctx = secureContexts.get(servername);
      if (!ctx) {
        const certs = getCertForHost(servername);
        if (certs) {
          ctx = tls.createSecureContext(certs);
          secureContexts.set(servername, ctx);
        }
      }
      cb(null, ctx);
    }
  }, (req, res) => {
    logRequest(req, true);

    // Forward to actual destination
    const targetUrl = new URL(req.url, `https://${req.headers.host}`);
    const options = {
      method: req.method,
      headers: req.headers,
    };

    const upstreamReq = https.request(targetUrl, options, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    });

    upstreamReq.on("error", (err) => {
      console.error("[MITM Upstream Request Error]", err.message);
      res.writeHead(502);
      res.end("Bad Gateway");
    });

    req.pipe(upstreamReq);
  });

  // Listen on a random dynamic port locally for internal redirection
  mitmHttpsServer.listen(0, "127.0.0.1", () => {
    const mitmPort = mitmHttpsServer.address().port;

    // Create the outer HTTP proxy that handles normal HTTP proxy requests and CONNECT tunnels
    const proxyServer = http.createServer((req, res) => {
      logRequest(req, false);

      // Normal HTTP Proxy Request
      try {
        const targetUrl = new URL(req.url);
        const options = {
          method: req.method,
          headers: req.headers,
        };

        const upstreamReq = http.request(targetUrl, options, (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
          upstreamRes.pipe(res);
        });

        upstreamReq.on("error", (err) => {
          res.writeHead(502);
          res.end("Bad Gateway");
        });

        req.pipe(upstreamReq);
      } catch (err) {
        res.writeHead(400);
        res.end("Invalid URL format");
      }
    });

    // Handle CONNECT tunnels (for HTTPS)
    proxyServer.on("connect", (req, clientSocket, head) => {
      const [host, rawPort] = req.url.split(":");
      const portNum = parseInt(rawPort || "443", 10);

      // We only intercept cloudcode / Google AI companion hosts
      // For all other hosts (e.g. standard google APIs, telemetry endpoints), we just do a blind TCP bypass
      // to avoid breaking browser/IDE certificate checks for non-relevant traffic.
      const isTargetHost = host.includes("googleapis.com") || host.includes("google.com");

      if (isTargetHost) {
        // Redirect client traffic to our local MITM TLS Decryption server
        const mitmSocket = net.connect(mitmPort, "127.0.0.1", () => {
          clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          if (head && head.length > 0) {
            mitmSocket.write(head);
          }
          clientSocket.pipe(mitmSocket);
          mitmSocket.pipe(clientSocket);
        });

        mitmSocket.on("error", (err) => {
          clientSocket.end();
        });
        clientSocket.on("error", () => {
          mitmSocket.end();
        });
      } else {
        // Blind TCP Tunnel bypass (no decryption)
        const targetSocket = net.connect(portNum, host, () => {
          clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          if (head && head.length > 0) {
            targetSocket.write(head);
          }
          clientSocket.pipe(targetSocket);
          targetSocket.pipe(clientSocket);
        });

        targetSocket.on("error", (err) => {
          clientSocket.end();
        });
        clientSocket.on("error", () => {
          targetSocket.end();
        });
      }
    });

    proxyServer.listen(port, () => {
      console.log(`\n======================================================`);
      console.log(`ANTIGRAVITY MITM CAPTURE PROXY RUNNING.`);
      console.log(`👉 Proxy Address: http://127.0.0.1:${port}`);
      console.log(`👉 Log File:      ${LOG_FILE}`);
      console.log(`👉 Root CA PEM:   ${CA_PEM}`);
      console.log(`======================================================`);
      console.log(`\nInstructions:`);
      console.log(`1. Trust the Root CA certificate in your OS / browser.`);
      console.log(`2. Export HTTPS_PROXY=http://127.0.0.1:${port}`);
      console.log(`3. Run the Antigravity IDE or trigger requests.`);
      console.log(`4. Press Ctrl+C to stop the proxy.\n`);
    });
  });
}

// CLI args parsing
const args = process.argv.slice(2);
let port = 8888;
if (args.includes("--port")) {
  const idx = args.indexOf("--port");
  if (idx !== -1 && args[idx + 1]) {
    port = parseInt(args[idx + 1], 10);
  }
}

startProxy(port);
