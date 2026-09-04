# Next.js Feature Specification

## Description

<Describe the user-visible behavior in one or two sentences.>

## Requirements

- Use TypeScript and the existing Next.js App Router.
- Put reusable components under `frontend/components/`.
- Put routes under `frontend/app/` using App Router file conventions.
- Prefer Server Components. Add `"use client"` only when browser APIs, state, or event handlers require it.
- Reuse existing dependencies. If another package is genuinely required, name it here and explain why.
- Include accessibility requirements and expected empty, loading, and error states when relevant.
- Do not include secrets, credentials, or production data.

## Acceptance Criteria

- <Describe concrete behavior that can be checked.>
- `pnpm --filter frontend lint` passes.
- `pnpm --filter frontend typecheck` passes.

## Expected Output

File: <relative path inside `frontend`, for example `components/NavBar.tsx` or `app/account/page.tsx`>
