export type AIErrorCategory =
  | "aborted"
  | "timeout"
  | "unavailable"
  | "rate_limited"
  | "authentication"
  | "malformed_response"
  | "invalid_request"
  | "unknown";

export class AIProviderError extends Error {
  constructor(
    public readonly category: AIErrorCategory,
    message: string,
    public readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AIProviderError";
  }
}

export function normalizeProviderError(error: unknown): AIProviderError {
  if (error instanceof AIProviderError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new AIProviderError("aborted", "AI request was cancelled", false, {
      cause: error,
    });
  }
  return new AIProviderError(
    "unavailable",
    "AI provider is unavailable",
    true,
    {
      cause: error,
    },
  );
}

export function errorForStatus(status: number): AIProviderError {
  if (status === 401 || status === 403)
    return new AIProviderError(
      "authentication",
      "AI provider rejected its credentials",
    );
  if (status === 429)
    return new AIProviderError(
      "rate_limited",
      "AI provider rate limit reached",
      true,
    );
  if (status === 408 || status >= 500)
    return new AIProviderError(
      "unavailable",
      "AI provider is unavailable",
      true,
    );
  return new AIProviderError(
    "invalid_request",
    "AI provider rejected the request",
  );
}
