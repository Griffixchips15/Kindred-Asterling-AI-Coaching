---
name: Chat AI provider
description: Which LLM powers Kindred chat and why, plus the Anthropic message-shape constraint.
---

# Kindred chat runs on Replit-managed Anthropic (Claude), not Gemini

The chat coach uses Claude (`claude-sonnet-4-6`) through Replit's managed
Anthropic integration (`@workspace/integrations-anthropic-ai`), configured via
`AI_INTEGRATIONS_ANTHROPIC_BASE_URL` / `AI_INTEGRATIONS_ANTHROPIC_API_KEY`.

**Why:** the user's own Google Cloud billing was broken, so a no-user-key,
Replit-credit-billed provider was chosen. Disclosed to the user. `GEMINI_API_KEY`
is no longer used by chat (the gemini lib may still be a harmless dependency).

**How to apply:** when touching `artifacts/api-server/src/routes/chat.ts`, keep
the call on the Anthropic SDK shape: `system` is a top-level string (not a
message), `messages` is `{role:"user"|"assistant", content:string}[]`, and the
array must START with a user turn (drop leading assistant/onboarding turns).
Only use models from the managed list — never invent model names.
