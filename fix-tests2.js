const fs = require('fs');

const apiTestPath = 'artifacts/api-server/src/lib/chatRoutes.http.test.ts';
let code = fs.readFileSync(apiTestPath, 'utf8');

// Replace ollama stuff with anthropic
code = code.replace(/import \{ chatWithOllama \} from "\.\/ollamaClient";\n/, '');
code = code.replace(/vi\.mock\("\.\/ollamaClient", \(\) => \(\{\n  chatWithOllama: vi\.fn\(\),\n\}\)\);\n/, 'vi.mock("@workspace/integrations-anthropic-ai", () => ({\n  anthropic: {\n    messages: {\n      create: vi.fn(),\n    }\n  }\n}));\n\nimport { anthropic } from "@workspace/integrations-anthropic-ai";\n');
code = code.replace(/const createMock = vi\.mocked\(chatWithOllama\);/g, 'const createMock = vi.mocked(anthropic!.messages.create as any);');


// Find any dailyUsageTable imports or db deletes
code = code.replace(/  dailyUsageTable,\n/g, '');
code = code.replace(/    await db\.delete\(dailyUsageTable\)\.where\(eq\(dailyUsageTable\.userId, id\)\);\n/g, '');

// Save back
fs.writeFileSync(apiTestPath, code);
