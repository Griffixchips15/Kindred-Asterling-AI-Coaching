const fs = require('fs');

const path = 'artifacts/api-server/src/lib/chatRoutes.http.test.ts';
let code = fs.readFileSync(path, 'utf8');

if (code.includes('dailyUsageTable')) {
  console.log('Still contains dailyUsageTable!');
} else {
  console.log('dailyUsageTable is removed from chatRoutes.http.test.ts');
}

if (code.includes('ollamaClient')) {
  console.log('Still contains ollamaClient!');
} else {
  console.log('ollamaClient is removed from chatRoutes.http.test.ts');
}
