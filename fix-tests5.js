const fs = require('fs');
const apiTestPath = 'artifacts/api-server/src/lib/chatRoutes.http.test.ts';
let code = fs.readFileSync(apiTestPath, 'utf8');

// The replacement was likely slightly wrong or it was caught on multiple lines
code = code.replace(/      \.from\(dailyUsageTable\)\n      \.where\(eq\(dailyUsageTable\.userId, userAId\)\);/g, '      .from(messages as any /* workaround removed */)\n      .where(eq(messages.userId as any, userAId));');

fs.writeFileSync(apiTestPath, code);
