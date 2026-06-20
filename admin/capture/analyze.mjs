#!/usr/bin/env npx tsx
/**
 * admin/capture/analyze.mjs
 * Telemetry Diff Analyzer for captured Antigravity traffic vs plugin implementation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Import local constants to compare what the plugin currently generates
import { getAntigravityHeaders, getRandomizedHeaders } from "../../src/constants.ts";
import { buildFingerprintHeaders, generateFingerprint } from "../../src/plugin/fingerprint.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_LOG_FILE = path.join(__dirname, "capture.jsonl");

// Read arguments
const args = process.argv.slice(2);
const logFile = args[0] && !args[0].startsWith("-") ? args[0] : DEFAULT_LOG_FILE;
const jsonOutput = args.includes("--json");

if (!fs.existsSync(logFile)) {
  console.error(`Capture log file not found at: ${logFile}`);
  console.log("Please run a capture session first using `admin/capture/proxy`.");
  process.exit(1);
}

// Parse captured sessions
const content = fs.readFileSync(logFile, "utf-8");
const lines = content.trim().split("\n").filter(Boolean);
const captures = lines.map(line => JSON.parse(line));

if (captures.length === 0) {
  console.log("No request captures found in the log file.");
  process.exit(0);
}

// Group by endpoint type
const groups = {};
for (const cap of captures) {
  if (!groups[cap.endpointType]) {
    groups[cap.endpointType] = [];
  }
  groups[cap.endpointType].push(cap);
}

// Generate the headers the plugin currently produces for comparison
const fingerprint = generateFingerprint();
const fingerprintHeaders = buildFingerprintHeaders(fingerprint);

const pluginDefaultHeaders = { ...getAntigravityHeaders(), ...fingerprintHeaders };
const pluginRandomizedAntigravity = { ...getRandomizedHeaders("antigravity"), ...fingerprintHeaders };
const pluginRandomizedCLI = { ...getRandomizedHeaders("antigravity-cli"), ...fingerprintHeaders };

if (jsonOutput) {
  console.log(JSON.stringify({
    captured: groups,
    plugin: {
      default: pluginDefaultHeaders,
      antigravityMode: pluginRandomizedAntigravity,
      cliMode: pluginRandomizedCLI,
    }
  }, null, 2));
  process.exit(0);
}

console.log(`\n======================================================`);
console.log(`TELEMETRY CAPTURE ANALYSIS`);
console.log(`Analyzed Log: ${logFile}`);
console.log(`Total Requests Captured: ${captures.length}`);
console.log(`======================================================\n`);

for (const [endpoint, reqs] of Object.entries(groups)) {
  console.log(`🤖 Endpoint: ${endpoint.toUpperCase()} (${reqs.length} requests captured)`);
  
  // Aggregate headers across all requests of this type
  const headerUsage = {};
  const headerValues = {};
  
  for (const req of reqs) {
    for (const [name, val] of Object.entries(req.headers)) {
      const canonicalName = name.toLowerCase();
      headerUsage[canonicalName] = (headerUsage[canonicalName] || 0) + 1;
      
      if (!headerValues[canonicalName]) {
        headerValues[canonicalName] = new Set();
      }
      headerValues[canonicalName].add(val);
    }
  }

  // Print summary table
  console.log("-".repeat(80));
  console.log(
    ` ${"Header Name".padEnd(25)} | ${"Seen %".padEnd(8)} | ${"Sample Values (Up to 3)"}`
  );
  console.log("-".repeat(80));
  
  for (const name of Object.keys(headerUsage).sort()) {
    const pct = Math.round((headerUsage[name] / reqs.length) * 100) + "%";
    const samples = Array.from(headerValues[name]).slice(0, 3).join(" | ");
    console.log(
      ` ${name.padEnd(25)} | ${pct.padEnd(8)} | ${samples}`
    );
  }
  console.log("-".repeat(80));

  // Determine comparison based on endpoint
  let referenceHeaders = {};
  let comparisonLabel = "";

  if (endpoint === "streamGenerateContent" || endpoint === "generateContent") {
    // In request.ts, content generation under 'antigravity' style defaults to userAgent override only
    // or CLI headers under cli-mode. Let's compare both.
    referenceHeaders = {
      "User-Agent (plugin-antigravity)": pluginRandomizedAntigravity["User-Agent"],
      "Client-Metadata (plugin-antigravity)": "NONE SENT (STRIPPED BY DEFAULT)",
      "User-Agent (plugin-cli)": pluginRandomizedCLI["User-Agent"],
      "Client-Metadata (plugin-cli)": pluginRandomizedCLI["Client-Metadata"],
    };
    comparisonLabel = "Plugin Request Settings (Content Generation Mode)";
  } else {
    // Other endpoints (onboard, loadCodeAssist, quota, search) use full default header stack
    referenceHeaders = pluginDefaultHeaders;
    comparisonLabel = "Plugin Default Headers (getAntigravityHeaders)";
  }

  console.log(`\n🔍 GAP ANALYSIS vs ${comparisonLabel}:`);
  
  // 1. Missing Headers (what the real IDE sends but we do not)
  const missingHeaders = [];
  for (const capturedName of Object.keys(headerUsage)) {
    const inPlugin = Object.keys(referenceHeaders).some(
      n => n.toLowerCase() === capturedName.toLowerCase() || n.toLowerCase().startsWith(capturedName.toLowerCase() + " ")
    );
    if (!inPlugin) {
      missingHeaders.push(capturedName);
    }
  }

  if (missingHeaders.length > 0) {
    console.log(`  ❌ MISSING headers (sent by IDE, missing from plugin):`);
    for (const h of missingHeaders) {
      console.log(`     • ${h} (values: ${Array.from(headerValues[h]).slice(0, 2).join(" | ")})`);
    }
  } else {
    console.log("  ✅ No missing headers detected.");
  }

  // 2. Extra Headers (what we send but the real IDE does not)
  const extraHeaders = [];
  for (const pluginName of Object.keys(referenceHeaders)) {
    const cleanName = pluginName.split(" ")[0].toLowerCase();
    const inCaptured = Object.keys(headerUsage).some(n => n.toLowerCase() === cleanName);
    if (!inCaptured && !pluginName.includes("plugin-cli")) {
      extraHeaders.push(pluginName);
    }
  }

  if (extraHeaders.length > 0) {
    console.log(`  ⚠️  EXTRA headers (sent by plugin, missing from real IDE):`);
    for (const h of extraHeaders) {
      console.log(`     • ${h}`);
    }
  }

  // 3. Format differences for standard headers (UA, Metadata, etc.)
  console.log("  📝 Header value checks:");
  for (const stdHeader of ["user-agent", "client-metadata", "x-goog-api-client"]) {
    if (headerUsage[stdHeader]) {
      const realSamples = Array.from(headerValues[stdHeader]);
      
      let pluginVal = "";
      if (stdHeader === "user-agent") {
        pluginVal = `Antigravity Mode: "${pluginRandomizedAntigravity["User-Agent"]}"\n                  CLI Mode:         "${pluginRandomizedCLI["User-Agent"]}"`;
      } else if (stdHeader === "client-metadata") {
        pluginVal = `Antigravity Mode: "${pluginDefaultHeaders["Client-Metadata"]}"\n                  CLI Mode:         "${pluginRandomizedCLI["Client-Metadata"]}"`;
      } else if (stdHeader === "x-goog-api-client") {
        pluginVal = `"${pluginDefaultHeaders["X-Goog-Api-Client"]}"`;
      }

      console.log(`     • ${stdHeader}:`);
      console.log(`       Real IDE: "${realSamples[0]}"`);
      console.log(`       Plugin:   ${pluginVal}`);
    }
  }

  console.log("\n" + "=".repeat(80) + "\n");
}
