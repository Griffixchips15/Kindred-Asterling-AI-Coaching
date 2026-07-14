import Anthropic from "@anthropic-ai/sdk";

const apiKey =
  process.env.ANTHROPIC_API_KEY ??
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY must be set (or AI_INTEGRATIONS_ANTHROPIC_API_KEY if using the Replit-managed integration).",
  );
}

export const anthropic = new Anthropic({
  apiKey,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});
