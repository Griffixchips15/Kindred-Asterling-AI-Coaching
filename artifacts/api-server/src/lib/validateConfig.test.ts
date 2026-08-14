import { afterEach, describe, expect, it } from "vitest";
import { validateRuntimeConfig } from "./validateConfig";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function baseEnv(): void {
  process.env = {
    ...originalEnv,
    NODE_ENV: "test",
    DATABASE_URL: "postgres://test",
    PORT: "8080",
    AI_PROVIDER: "disabled",
  };
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.AWS_REGION;
  delete process.env.BEDROCK_MODEL_ID;
}

describe("AI provider configuration", () => {
  it("allows startup with AI disabled", () => {
    baseEnv();
    expect(validateRuntimeConfig).not.toThrow();
  });

  it("validates only OpenAI variables when OpenAI is selected", () => {
    baseEnv();
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "server-only-secret";
    process.env.OPENAI_MODEL = "model";
    expect(validateRuntimeConfig).not.toThrow();
  });

  it("accepts Bedrock with a region and inference profile model ID", () => {
    baseEnv();
    process.env.AI_PROVIDER = "bedrock";
    process.env.AWS_REGION = "us-east-1";
    process.env.BEDROCK_MODEL_ID =
      "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
    expect(validateRuntimeConfig).not.toThrow();
  });

  it("requires both Bedrock variables", () => {
    baseEnv();
    process.env.AI_PROVIDER = "bedrock";
    expect(validateRuntimeConfig).toThrow(/AWS_REGION, BEDROCK_MODEL_ID/);
  });

  it("reports only the selected provider's missing variables", () => {
    baseEnv();
    process.env.AI_PROVIDER = "openai";
    expect(validateRuntimeConfig).toThrow(/OPENAI_API_KEY, OPENAI_MODEL/);
  });
});
