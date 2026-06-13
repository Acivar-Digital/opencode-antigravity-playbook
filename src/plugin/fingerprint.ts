/**
 * Device Fingerprint Generator for Rate Limit Mitigation
 *
 * Ported from antigravity-claude-proxy PR #170
 * https://github.com/badrisnarayanan/antigravity-claude-proxy/pull/170
 *
 * Generates randomized device fingerprints to help distribute API usage
 * across different apparent device identities.
 */

import * as crypto from "node:crypto";
import * as os from "node:os";
import { getAntigravityVersion } from "../constants";

const OS_VERSIONS: Record<string, string[]> = {
  darwin: ["10.15.7", "11.6.8", "12.6.3", "13.5.2", "14.2.1", "14.5"],
  win32: ["10.0.19041", "10.0.19042", "10.0.19043", "10.0.22000", "10.0.22621", "10.0.22631"],
  linux: ["5.15.0", "5.19.0", "6.1.0", "6.2.0", "6.5.0", "6.6.0"],
};

const ARCHITECTURES = ["x64", "arm64"];

const IDE_TYPES = [
  "ANTIGRAVITY",
] as const;

const PLATFORMS = [
  "WINDOWS",
  "MACOS",
] as const;

const SDK_CLIENTS = [
  "google-cloud-sdk vscode_cloudshelleditor/0.1",
  "google-cloud-sdk vscode/1.86.0",
  "google-cloud-sdk vscode/1.87.0",
  "google-cloud-sdk vscode/1.96.0",
];

export interface ClientMetadata {
  ideType: string;
  platform: string;
  pluginType: string;
}

export interface Fingerprint {
  deviceId: string;
  sessionToken: string;
  userAgent: string;
  apiClient: string;
  clientMetadata: ClientMetadata;
  createdAt: number;
  /** @deprecated Kept for backward compat with stored fingerprints */
  quotaUser?: string;
  chromeVersion?: string;
  chromeFullVersion?: string;
  osPlatform?: string;
  osArch?: string;
  osBitness?: string;
}

/**
 * Fingerprint version for history tracking.
 * Stores a snapshot of a fingerprint with metadata about when/why it was saved.
 */
export interface FingerprintVersion {
  fingerprint: Fingerprint;
  timestamp: number;
  reason: 'initial' | 'regenerated' | 'restored';
}

/** Maximum number of fingerprint versions to keep per account */
export const MAX_FINGERPRINT_HISTORY = 5;

export interface FingerprintHeaders {
  "User-Agent": string;
  "sec-ch-ua"?: string;
  "sec-ch-ua-mobile"?: string;
  "sec-ch-ua-platform"?: string;
  "sec-ch-ua-arch"?: string;
  "sec-ch-ua-bitness"?: string;
  "sec-ch-ua-full-version"?: string;
  "sec-ch-ua-full-version-list"?: string;
  "sec-ch-ua-form-factors"?: string;
  "sec-ch-ua-wow64"?: string;
  "sec-ch-ua-model"?: string;
  "x-client-data"?: string;
  "x-browser-channel"?: string;
  "x-browser-year"?: string;
  "x-browser-copyright"?: string;
  "x-browser-validation"?: string;
  "x-chrome-id-consistency-request"?: string;
  "x-goog-update-appid"?: string;
  "x-goog-update-interactivity"?: string;
  "x-goog-update-updater"?: string;
}

const PLATFORM_CHOICES = ["darwin", "win32", "linux"] as const;
type PlatformChoice = typeof PLATFORM_CHOICES[number];

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function platformToDisplayName(platform: string): "WINDOWS" | "MACOS" | "LINUX" {
  if (platform === "win32") return "WINDOWS";
  if (platform === "linux") return "LINUX";
  return "MACOS";
}

function generateDeviceId(): string {
  return crypto.randomUUID();
}

function generateSessionToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate a randomized device fingerprint.
 * Each fingerprint represents a unique "device" identity.
 */
export function generateFingerprint(): Fingerprint {
  const platform = randomFrom(PLATFORM_CHOICES);
  const arch = randomFrom(ARCHITECTURES);

  let userAgent = "";
  let chromePlatform = "Linux";
  let chromeArch = "x86";
  const bitness = "64";

  const chromeFullVersion = "149.0.7827.53";
  const chromeVersion = "149";

  if (platform === "win32") {
    userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
    chromePlatform = "Windows";
    chromeArch = arch === "arm64" ? "arm" : "x86";
  } else if (platform === "darwin") {
    userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
    chromePlatform = "macOS";
    chromeArch = arch === "arm64" ? "arm" : "x86";
  } else {
    userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
    chromePlatform = "Linux";
    chromeArch = "x86";
  }

  return {
    deviceId: generateDeviceId(),
    sessionToken: generateSessionToken(),
    userAgent,
    apiClient: randomFrom(SDK_CLIENTS),
    clientMetadata: {
      ideType: randomFrom(IDE_TYPES),
      platform: platformToDisplayName(platform),
      pluginType: "GEMINI",
    },
    createdAt: Date.now(),
    chromeVersion,
    chromeFullVersion,
    osPlatform: chromePlatform,
    osArch: chromeArch,
    osBitness: bitness,
  };
}

/**
 * Collect fingerprint based on actual current system.
 * Uses real OS info instead of randomized values.
 */
export function collectCurrentFingerprint(): Fingerprint {
  const platform = os.platform();
  const arch = os.arch();

  let userAgent = "";
  let chromePlatform = "Linux";
  let chromeArch = "x86";
  const bitness = "64";

  const chromeFullVersion = "149.0.7827.53";
  const chromeVersion = "149";

  if (platform === "win32") {
    userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
    chromePlatform = "Windows";
    chromeArch = arch === "arm64" ? "arm" : "x86";
  } else if (platform === "darwin") {
    userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
    chromePlatform = "macOS";
    chromeArch = arch === "arm64" ? "arm" : "x86";
  } else {
    userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
    chromePlatform = "Linux";
    chromeArch = "x86";
  }

  return {
    deviceId: generateDeviceId(),
    sessionToken: generateSessionToken(),
    userAgent,
    apiClient: "google-cloud-sdk vscode_cloudshelleditor/0.1",
    clientMetadata: {
      ideType: "ANTIGRAVITY",
      platform: platformToDisplayName(platform),
      pluginType: "GEMINI",
    },
    createdAt: Date.now(),
    chromeVersion,
    chromeFullVersion,
    osPlatform: chromePlatform,
    osArch: chromeArch,
    osBitness: bitness,
  };
}

/**
 * Update the version in a fingerprint's userAgent to match the current runtime version.
 * Called after version fetcher resolves so saved fingerprints always carry the latest version.
 * Returns true if the userAgent was changed.
 */
export function updateFingerprintVersion(fingerprint: Fingerprint): boolean {
  const currentVersion = getAntigravityVersion();
  const versionPattern = /^(antigravity\/)([\d.]+)/;
  const match = fingerprint.userAgent.match(versionPattern);

  if (!match || match[2] === currentVersion) {
    return false;
  }

  fingerprint.userAgent = fingerprint.userAgent.replace(versionPattern, `$1${currentVersion}`);
  return true;
}

/**
 * Build HTTP headers from a fingerprint object.
 * These headers are used to identify the "device" making API requests.
 */
export function buildFingerprintHeaders(fingerprint: Fingerprint | null): Partial<FingerprintHeaders> {
  if (!fingerprint) {
    return {};
  }

  const chromePlatform = fingerprint.osPlatform || "Linux";
  const chromeArch = fingerprint.osArch || "x86";
  const chromeVersion = fingerprint.chromeVersion || "149";
  const chromeFullVersion = fingerprint.chromeFullVersion || "149.0.7827.53";
  const bitness = fingerprint.osBitness || "64";
  const deviceId = fingerprint.deviceId;

  return {
    "User-Agent": fingerprint.userAgent,
    "sec-ch-ua": `"Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not)A;Brand";v="24"`,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": `"${chromePlatform}"`,
    "sec-ch-ua-arch": `"${chromeArch}"`,
    "sec-ch-ua-bitness": `"${bitness}"`,
    "sec-ch-ua-full-version": `"${chromeFullVersion}"`,
    "sec-ch-ua-full-version-list": `"Google Chrome";v="${chromeFullVersion}", "Chromium";v="${chromeFullVersion}", "Not)A;Brand";v="24.0.0.0"`,
    "sec-ch-ua-form-factors": `"Desktop"`,
    "sec-ch-ua-wow64": "?0",
    "sec-ch-ua-model": `""`,
    "x-client-data": "CIy2yQEIprbJAQipncoBCP/4ygEIkqHLAQiHoM0BCK7LlDAIl8+UMAjGz5QwCIHQlDAI9dGUMA==",
    "x-browser-channel": "stable",
    "x-browser-year": "2026",
    "x-browser-copyright": "Copyright 2026 Google LLC. All Rights Reserved.",
    "x-browser-validation": "6oL9V4vp1rUBqdZ3fRIxeb13+WE=",
    "x-chrome-id-consistency-request": `version=1,client_id=77185425430.apps.googleusercontent.com,device_id=${deviceId},sync_account_id=114222513075580195089,signin_mode=all_accounts,signout_mode=show_confirmation`,
    "x-goog-update-appid": "hdokiejnpimakedhajhdlcegeplioahd,nmmhkkegccagdldgiimedpiccmgmieda",
    "x-goog-update-interactivity": "bg",
    "x-goog-update-updater": `chrome-${chromeFullVersion}`,
  };
}

/**
 * Session-level fingerprint instance.
 * Generated once at module load, persists for the lifetime of the process.
 */
let sessionFingerprint: Fingerprint | null = null;

/**
 * Get or create the session fingerprint.
 * Returns the same fingerprint for all calls within a session.
 */
export function getSessionFingerprint(): Fingerprint {
  if (!sessionFingerprint) {
    sessionFingerprint = generateFingerprint();
  }
  return sessionFingerprint;
}

/**
 * Regenerate the session fingerprint.
 * Call this to get a fresh identity (e.g., after rate limiting).
 */
export function regenerateSessionFingerprint(): Fingerprint {
  sessionFingerprint = generateFingerprint();
  return sessionFingerprint;
}
