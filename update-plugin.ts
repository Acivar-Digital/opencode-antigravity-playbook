import * as fs from 'fs';

let content = fs.readFileSync('src/plugin.ts', 'utf8');

// Replace (headerStyle === "antigravity-cli" ? "antigravity-cli" : "gemini-cli") -> "antigravity-cli"
content = content.replace(/headerStyle === "antigravity" \? "gemini-antigravity" : \(headerStyle === "antigravity-cli" \? "antigravity-cli" : "gemini-cli"\)/g, 'headerStyle === "antigravity" ? "gemini-antigravity" : "antigravity-cli"');

// Remove other references to gemini-cli in strings or comments
content = content.replace(/antigravity-cli\/gemini-cli/g, 'antigravity-cli');
content = content.replace(/headerStyle === "antigravity-cli" \|\| headerStyle === "gemini-cli"/g, 'headerStyle === "antigravity-cli"');
content = content.replace(/headerStyle === "gemini-cli" \|\| headerStyle === "antigravity-cli"/g, 'headerStyle === "antigravity-cli"');
content = content.replace(/headerStyle === "gemini-cli"/g, 'headerStyle === "antigravity-cli"');

content = content.replace(/fallbackStyle === "gemini-cli" \? "Gemini CLI" : "Antigravity"/g, 'fallbackStyle === "antigravity-cli" ? "Antigravity CLI" : "Antigravity"');
content = content.replace(/headerStyle === "antigravity-cli" \? "Antigravity CLI" : \(headerStyle === "gemini-cli" \? "Gemini CLI" : "Antigravity"\)/g, 'headerStyle === "antigravity-cli" ? "Antigravity CLI" : "Antigravity"');
content = content.replace(/fallbackStyle === "antigravity-cli" \? "Antigravity CLI" : \(fallbackStyle === "gemini-cli" \? "Gemini CLI" : "Antigravity"\)/g, 'fallbackStyle === "antigravity-cli" ? "Antigravity CLI" : "Antigravity"');
content = content.replace(/fallbackName = fallbackStyle === "antigravity" \? "Antigravity" : \(fallbackStyle === "antigravity-cli" \? "Antigravity CLI" : "Gemini CLI"\)/g, 'fallbackName = fallbackStyle === "antigravity" ? "Antigravity" : "Antigravity CLI"');

content = content.replace(/fallbackName = fallbackStyle === "antigravity-cli" \? "Antigravity CLI" : "Gemini CLI"/g, 'fallbackName = "Antigravity CLI"');
content = content.replace(/currentName = headerStyle === "antigravity-cli" \? "Antigravity CLI" : "Gemini CLI"/g, 'currentName = "Antigravity CLI"');

fs.writeFileSync('src/plugin.ts', content);
