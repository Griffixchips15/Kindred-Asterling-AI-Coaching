---
name: DB date serialization
description: Drizzle returns JS Date objects but Zod schemas expect strings — always serialize before parsing.
---

# DB Date Serialization

**Rule:** Always wrap Drizzle query results in `JSON.parse(JSON.stringify(result))` before passing to any Zod `.parse()` call in API route handlers.

**Why:** Drizzle ORM returns native JS `Date` objects for timestamp/date columns, but the Orval-generated Zod schemas expect `string` (ISO 8601). Without this step, Zod validation fails at runtime with type errors even though TypeScript compiles fine.

**How to apply:** Every route that reads from the DB and returns a Zod-validated response must use this pattern:
```typescript
res.json(SomeZodSchema.parse(JSON.parse(JSON.stringify(rows))));
```
