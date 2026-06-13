import * as fs from 'fs';

let content = fs.readFileSync('src/plugin/request.ts', 'utf8');

content = content.replace(/\} else if \(headerStyle === "antigravity-cli"\) \{[\s\S]*?\} else \{[\s\S]*?\n  \}/, '} else {\n    // antigravity-cli mode\n    const cliHeaders = getRandomizedHeaders("antigravity-cli", requestedModel);\n    headers.set("User-Agent", cliHeaders["User-Agent"]);\n    if (cliHeaders["Client-Metadata"]) {\n      headers.set("Client-Metadata", cliHeaders["Client-Metadata"]);\n    }\n  }');

// Also replace `ANTIGRAVITY_CLI_HEADERS,` in imports from constants if it's unused or just let TS complain and fix it.
content = content.replace(/ANTIGRAVITY_CLI_HEADERS,\n/g, '');

fs.writeFileSync('src/plugin/request.ts', content);
