// Final step shared by every journal write transaction. It does two things,
// both inside the surrounding transaction so they happen before the save
// commits:
//
//   1. Serializes a freshly written DB row into its plain JSON shape (MongoDB
//      returns Date objects for timestamp columns, which must become
//      strings before they go out as a JSON response).
//   2. Validates that serialized row against the matching OpenAPI/Zod response
//      schema. If the row can't be represented to the client — an extra,
//      missing, or mis-typed column — the schema throws, the surrounding
//      transaction rolls back, and no record the API contract can't serialize
//      ever persists. Parsing also strips columns the contract doesn't expose
//      (e.g. userId), so the returned value is exactly the client-facing shape.
//
// Keeping it in its own module lets the write tests mock it to throw mid-save
// and prove the whole transaction rolls back, leaving no orphaned or partial
// rows behind.

// Structural type for a Zod (or any) response schema so this module doesn't
// need a direct zod dependency — it only ever calls `.parse`.
export interface ResponseSchema<T> {
  parse(value: unknown): T;
}

export function finalizeWrite<T>(row: unknown, schema: ResponseSchema<T>): T {
  return schema.parse(JSON.parse(JSON.stringify(row)));
}
