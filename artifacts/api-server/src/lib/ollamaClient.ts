export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
};

export type OllamaToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type OllamaChatOptions = {
  model: string;
  system: string;
  messages: OllamaMessage[];
  tools: unknown[];
};

export type OllamaChatResult = {
  content: string;
  toolCalls: OllamaToolCall[];
  doneReason?: string;
};

export async function chatWithOllama(options: OllamaChatOptions): Promise<OllamaChatResult> {
  const baseUrl = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("OLLAMA_BASE_URL is not configured");
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: options.model,
      messages: [{ role: "system", content: options.system }, ...options.messages],
      tools: options.tools,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const body = (await response.json()) as {
    message?: { content?: string; tool_calls?: OllamaToolCall[] };
    done_reason?: string;
  };
  return {
    content: body.message?.content ?? "",
    toolCalls: body.message?.tool_calls ?? [],
    doneReason: body.done_reason,
  };
}
