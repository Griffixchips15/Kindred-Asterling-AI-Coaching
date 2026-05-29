// Final step shared by every journal write transaction: serialize a freshly
// written DB row into its plain JSON shape (Drizzle returns Date objects for
// timestamp/date columns, which must become strings before they go out as a
// JSON response). It runs inside the surrounding transaction, so it is the one
// dependent step that follows each insert/update. Keeping it in its own module
// lets the write tests mock it to throw mid-save and prove the whole
// transaction rolls back, leaving no orphaned or partial rows behind.
export function finalizeWrite<T>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
}
