import { GoogleGenAI } from "@google/genai";

const apiKey =
  process.env.GEMINI_API_KEY ?? process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY must be set (or AI_INTEGRATIONS_GEMINI_API_KEY if using the Replit-managed integration).",
  );
}

const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

export const ai = new GoogleGenAI(
  baseUrl
    ? {
        apiKey,
        httpOptions: {
          apiVersion: "",
          baseUrl,
        },
      }
    : { apiKey },
);
