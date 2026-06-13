import * as fs from 'fs';

let content = fs.readFileSync('src/plugin/transform/model-resolver.ts', 'utf8');

// Rename preferGeminiCli to preferAntigravityCli
content = content.replace(/const preferGeminiCli/g, 'const preferAntigravityCli');
content = content.replace(/preferGeminiCli \? "antigravity-cli"/g, 'preferAntigravityCli ? "antigravity-cli"');

// Remove gemini-cli block
content = content.replace(/if \(headerStyle === "gemini-cli"\) \{[\s\S]*?return \{[\s\S]*?\.\.\.resolveModelWithTier\(transformedModel\),[\s\S]*?\};\n  \}\n/g, '');

fs.writeFileSync('src/plugin/transform/model-resolver.ts', content);
