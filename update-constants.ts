import * as fs from 'fs';

let content = fs.readFileSync('src/constants.ts', 'utf8');

// Remove GEMINI_CLI_ENDPOINT
content = content.replace(/\/\*\*[\s\S]*?GEMINI_CLI_ENDPOINT[\s\S]*?\*\/\nexport const GEMINI_CLI_ENDPOINT = [^\n]*\n/g, '');
content = content.replace(/export const GEMINI_CLI_ENDPOINT = [^\n]*\n/g, '');

// Remove GEMINI_CLI_HEADERS
content = content.replace(/export const GEMINI_CLI_HEADERS = \{[\s\S]*?\} as const;\n/g, '');

// Remove from HeaderStyle
content = content.replace(/export type HeaderStyle = "antigravity" \| "gemini-cli" \| "antigravity-cli";/, 'export type HeaderStyle = "antigravity" | "antigravity-cli";');
content = content.replace(/export type HeaderStyle = "antigravity" \| "antigravity-cli" \| "gemini-cli";/, 'export type HeaderStyle = "antigravity" | "antigravity-cli";');

// Remove from getRandomizedHeaders
content = content.replace(/if \(style === "gemini-cli"\) \{[\s\S]*?\n\s*\}/g, '');

fs.writeFileSync('src/constants.ts', content);
