import Anthropic from "@anthropic-ai/sdk";

const apiKey =
  process.env.ANTHROPIC_API_KEY ??
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn(
    "ANTHROPIC_API_KEY not set — Anthropic features will be unavailable.",
  );
}

export const anthropic = apiKey
  ? new Anthropic({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    })
  : null;
