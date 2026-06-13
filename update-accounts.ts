import * as fs from 'fs';

let content = fs.readFileSync('src/plugin/accounts.ts', 'utf8');

// Remove "gemini-cli" from BaseQuotaKey
content = content.replace(/export type BaseQuotaKey = "claude" \| "gemini-antigravity" \| "antigravity-cli" \| "gemini-cli";/, 'export type BaseQuotaKey = "claude" | "gemini-antigravity" | "antigravity-cli";');
content = content.replace(/export type BaseQuotaKey = "claude" \| "gemini-antigravity" \| "gemini-cli" \| "antigravity-cli";/, 'export type BaseQuotaKey = "claude" | "gemini-antigravity" | "antigravity-cli";');

// Remove gemini-cli logic in getQuotaKey
content = content.replace(/const base = headerStyle === "antigravity-cli" \? "antigravity-cli" : \(headerStyle === "gemini-cli" \? "gemini-cli" : "gemini-antigravity"\);/, 'const base = headerStyle === "antigravity-cli" ? "antigravity-cli" : "gemini-antigravity";');
content = content.replace(/const base = headerStyle === "gemini-cli" \? "gemini-cli" : "gemini-antigravity";/, 'const base = headerStyle === "antigravity-cli" ? "antigravity-cli" : "gemini-antigravity";');

// Remove gemini-cli from isRateLimitedForFamily
content = content.replace(/const cliIsLimited = isRateLimitedForHeaderStyle\(account, family, "antigravity-cli", model\) && isRateLimitedForHeaderStyle\(account, family, "gemini-cli", model\);/, 'const cliIsLimited = isRateLimitedForHeaderStyle(account, family, "antigravity-cli", model);');

// Remove from clearAllRateLimitsForFamily
content = content.replace(/const cliKey = getQuotaKey\(family, "gemini-cli", model\);\n\s*delete account\.rateLimitResetTimes\[antigravityKey\];\n\s*delete account\.rateLimitResetTimes\[agCliKey\];\n\s*delete account\.rateLimitResetTimes\[cliKey\];/, 'delete account.rateLimitResetTimes[antigravityKey];\n        delete account.rateLimitResetTimes[agCliKey];');

// Remove from getAvailableHeaderStyle
content = content.replace(/if \(!isRateLimitedForHeaderStyle\(account, family, "gemini-cli", model\)\) \{\n\s*return "gemini-cli";\n\s*\}/g, '');

fs.writeFileSync('src/plugin/accounts.ts', content);
