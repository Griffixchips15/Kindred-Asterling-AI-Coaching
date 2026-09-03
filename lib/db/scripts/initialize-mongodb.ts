import { closeDatabase, initializeDatabase, pingDatabase } from "../src/index";

try {
  await initializeDatabase();
  await pingDatabase();
  console.log("MongoDB indexes initialized and connection verified.");
} finally {
  await closeDatabase();
}
