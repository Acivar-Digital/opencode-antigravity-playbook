import {
  ANTIGRAVITY_ENDPOINT_PROD,
  getAntigravityHeaders,
  ANTIGRAVITY_PROVIDER_ID,
} from "../constants.js";
import { accessTokenExpired, formatRefreshParts, parseRefreshParts } from "./auth.js";
import { logQuotaFetch, logQuotaStatus } from "./debug.js";
import { ensureProjectContext } from "./project.js";
import { refreshAccessToken } from "./token.js";
import type { PluginClient, OAuthAuthDetails } from "./types.js";
import type { AccountMetadataV3 } from "./storage.js";

const FETCH_TIMEOUT_MS = 10000;

export interface ModelQuota {
  remainingFraction?: number;
  resetTime?: string;
  weeklyCapExhausted?: boolean;
}

export interface QuotaSummary {
  models: Record<string, ModelQuota>;
  modelCount: number;
  error?: string;
}

// Legacy Gemini CLI API quota types have been removed.

export type AccountQuotaStatus = "ok" | "disabled" | "error";

export interface AccountQuotaResult {
  index: number;
  email?: string;
  status: "ok" | "disabled" | "error";
  error?: string;
  disabled?: boolean;
  quota?: QuotaSummary;
  updatedAccount?: AccountMetadataV3;
}

interface FetchAvailableModelsResponse {
  models?: Record<string, FetchAvailableModelEntry>;
}

interface FetchAvailableModelEntry {
  quotaInfo?: {
    remainingFraction?: number;
    resetTime?: string;
  };
  displayName?: string;
  modelName?: string;
}

function buildAuthFromAccount(account: AccountMetadataV3): OAuthAuthDetails {
  return {
    type: "oauth",
    refresh: formatRefreshParts({
      refreshToken: account.refreshToken,
      projectId: account.projectId,
      managedProjectId: account.managedProjectId,
    }),
    access: undefined,
    expires: undefined,
  };
}

function normalizeRemainingFraction(value: unknown): number {
  // If value is missing or invalid, treat as exhausted (0%)
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function parseResetTime(resetTime?: string): number | null {
  if (!resetTime) return null;
  const timestamp = Date.parse(resetTime);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return timestamp;
}

function aggregateQuota(models?: Record<string, FetchAvailableModelEntry>): QuotaSummary {
  const modelsMap: Record<string, ModelQuota> = {};
  if (!models) {
    return { models: modelsMap, modelCount: 0 };
  }

  let totalCount = 0;
  for (const [modelName, entry] of Object.entries(models)) {
    const quotaInfo = entry.quotaInfo;
    if (!quotaInfo) {
      continue;
    }
    totalCount += 1;

    const remainingFraction = normalizeRemainingFraction(quotaInfo.remainingFraction);
    const resetTime = quotaInfo.resetTime;
    const resetTimestamp = parseResetTime(resetTime);

    let weeklyCapExhausted: boolean | undefined;
    if (resetTime && resetTimestamp !== null) {
      weeklyCapExhausted = resetTimestamp - Date.now() > 12 * 60 * 60 * 1000;
    }

    modelsMap[modelName] = {
      remainingFraction,
      resetTime,
      weeklyCapExhausted,
    };
  }

  return { models: modelsMap, modelCount: totalCount };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAvailableModels(
  accessToken: string,
  projectId: string,
): Promise<FetchAvailableModelsResponse> {
  const endpoint = ANTIGRAVITY_ENDPOINT_PROD;
  const quotaUserAgent = getAntigravityHeaders()["User-Agent"] || "antigravity/windows/amd64";
  const errors: string[] = [];

  const body = projectId ? { project: projectId } : {};
  const response = await fetchWithTimeout(`${endpoint}/v1internal:fetchAvailableModels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": quotaUserAgent,
    },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return (await response.json()) as FetchAvailableModelsResponse;
  }

  const message = await response.text().catch(() => "");
  const snippet = message.trim().slice(0, 200);
  errors.push(
    `fetchAvailableModels ${response.status} at ${endpoint}${snippet ? `: ${snippet}` : ""}`,
  );

  throw new Error(errors.join("; ") || "fetchAvailableModels failed");
}



function applyAccountUpdates(account: AccountMetadataV3, auth: OAuthAuthDetails): AccountMetadataV3 | undefined {
  const parts = parseRefreshParts(auth.refresh);
  if (!parts.refreshToken) {
    return undefined;
  }

  const updated: AccountMetadataV3 = {
    ...account,
    refreshToken: parts.refreshToken,
    projectId: parts.projectId ?? account.projectId,
    managedProjectId: parts.managedProjectId ?? account.managedProjectId,
  };

  const changed =
    updated.refreshToken !== account.refreshToken ||
    updated.projectId !== account.projectId ||
    updated.managedProjectId !== account.managedProjectId;

  return changed ? updated : undefined;
}

export async function checkAccountsQuota(
  accounts: AccountMetadataV3[],
  client: PluginClient,
  providerId = ANTIGRAVITY_PROVIDER_ID,
): Promise<AccountQuotaResult[]> {
  const results: AccountQuotaResult[] = [];
  
  logQuotaFetch("start", accounts.length);

  for (const [index, account] of accounts.entries()) {
    const disabled = account.enabled === false;

    let auth = buildAuthFromAccount(account);

    try {
      if (accessTokenExpired(auth)) {
        const refreshed = await refreshAccessToken(auth, client, providerId);
        if (!refreshed) {
          throw new Error("Token refresh failed");
        }
        auth = refreshed;
      }

      const projectContext = await ensureProjectContext(auth);
      auth = projectContext.auth;
      const updatedAccount = applyAccountUpdates(account, auth);

      let quotaResult: QuotaSummary;
      const antigravityResponse = await fetchAvailableModels(auth.access ?? "", projectContext.effectiveProjectId)
        .catch((error): FetchAvailableModelsResponse => ({ models: undefined }));

      if (antigravityResponse.models === undefined) {
        quotaResult = {
          models: {},
          modelCount: 0,
          error: "Failed to fetch Antigravity quota",
        };
      } else {
        quotaResult = aggregateQuota(antigravityResponse.models);
      }

      results.push({
        index,
        email: account.email,
        status: "ok",
        disabled,
        quota: quotaResult,
        updatedAccount,
      });

      for (const [modelName, modelQuota] of Object.entries(quotaResult.models)) {
        const remainingPercent = (modelQuota.remainingFraction ?? 0) * 100;
        logQuotaStatus(account.email, index, remainingPercent, modelName);
      }
    } catch (error) {
      results.push({
        index,
        email: account.email,
        status: "error",
        disabled,
        error: error instanceof Error ? error.message : String(error),
      });
      logQuotaFetch("error", undefined, `account=${account.email ?? index} error=${error instanceof Error ? error.message : String(error)}`);
    }
  }

  logQuotaFetch("complete", accounts.length, `ok=${results.filter(r => r.status === "ok").length} errors=${results.filter(r => r.status === "error").length}`);
  return results;
}
