const fs = require('fs');

const tsconfigPath = 'artifacts/api-server/tsconfig.json';
let config = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

// We can set noImplicitAny to false or remove these tests because they're full of any errors from a previous setup?
// No, the issue is that in my first fix for api-server, I didn't successfully address:
// src/lib/chatRoutes.http.test.ts(26,3): error TS2305: Module '"@workspace/db"' has no exported member 'dailyUsageTable'.
// But wait, the previous build showed NO errors for `chatRoutes.http.test.ts` regarding `dailyUsageTable` or `ollamaClient` !
// They were fixed! The output now has entirely different errors like `parameter implicitly has an any type`,
// or `has not been built from source file`. Those are existing workspace errors not caused by my change, but I can see if there is any other error related to my changes.
