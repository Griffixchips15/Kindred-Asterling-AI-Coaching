import { AIProviderError, normalizeProviderError } from "./errors";

export async function fetchWithDeadline(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort();
  outerSignal?.addEventListener("abort", abort, { once: true });
  if (outerSignal?.aborted) controller.abort();
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut)
      throw new AIProviderError("timeout", "AI request timed out", true, {
        cause: error,
      });
    if (outerSignal?.aborted)
      throw new AIProviderError("aborted", "AI request was cancelled", false, {
        cause: error,
      });
    throw normalizeProviderError(error);
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener("abort", abort);
  }
}
