import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";
import type { AIProvider, AIRequest, AIResponse, AIToolCall } from "./types";
import { AIProviderError } from "./errors";

type BedrockDocument = NonNullable<
  NonNullable<ContentBlock["toolUse"]>["input"]
>;

interface BedrockRuntime {
  send(
    command: ConverseCommand,
    options?: { abortSignal?: AbortSignal },
  ): Promise<{
    output?: { message?: Message };
    stopReason?: string;
  }>;
}

export class BedrockProvider implements AIProvider {
  readonly name = "bedrock" as const;

  constructor(
    private readonly region: string,
    private readonly modelId: string,
    private readonly client: BedrockRuntime = new BedrockRuntimeClient({ region }),
  ) {}

  async chat(request: AIRequest): Promise<AIResponse> {
    if (!this.region || !this.modelId) {
      throw new AIProviderError(
        "invalid_request",
        "AWS_REGION and BEDROCK_MODEL_ID are required",
      );
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, request.timeoutMs);
    const abort = () => controller.abort();
    request.signal?.addEventListener("abort", abort, { once: true });
    if (request.signal?.aborted) controller.abort();

    try {
      const response = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          system: [{ text: request.system }],
          messages: toBedrockMessages(request.messages),
          toolConfig: request.tools?.length
            ? {
                tools: request.tools.map((tool) => ({
                  toolSpec: {
                    name: tool.name,
                    description: tool.description,
                    inputSchema: {
                      json: tool.inputSchema as BedrockDocument,
                    },
                  },
                })),
              }
            : undefined,
          inferenceConfig: { maxTokens: 1024 },
        }),
        { abortSignal: controller.signal },
      );

      const content = response.output?.message?.content;
      if (!Array.isArray(content)) {
        throw new AIProviderError(
          "malformed_response",
          "Bedrock response is missing message content",
        );
      }
      return {
        content: content
          .flatMap((block) => (typeof block.text === "string" ? [block.text] : []))
          .join(""),
        toolCalls: parseToolCalls(content),
        finishReason: response.stopReason,
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (timedOut) {
        throw new AIProviderError("timeout", "Bedrock request timed out", true, {
          cause: error,
        });
      }
      if (request.signal?.aborted) {
        throw new AIProviderError("aborted", "AI request was cancelled", false, {
          cause: error,
        });
      }
      throw classifyBedrockError(error);
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", abort);
    }
  }
}

function toBedrockMessages(messages: AIRequest["messages"]): Message[] {
  const result: Message[] = [];
  for (const message of messages) {
    const role: Message["role"] =
      message.role === "assistant" ? "assistant" : "user";
    const content: ContentBlock[] = [];
    if (message.role === "tool") {
      if (!message.toolCallId) {
        throw new AIProviderError(
          "invalid_request",
          "Bedrock tool results require a tool call ID",
        );
      }
      content.push({
        toolResult: {
          toolUseId: message.toolCallId,
          content: [{ text: message.content }],
        },
      });
    } else {
      if (message.content) content.push({ text: message.content });
      for (const call of message.toolCalls ?? []) {
        content.push({
          toolUse: {
            toolUseId: call.id,
            name: call.name,
            input: call.arguments as BedrockDocument,
          },
        });
      }
    }
    const previous = result.at(-1);
    if (previous?.role === role) {
      previous.content = [...(previous.content ?? []), ...content];
    } else {
      result.push({ role, content });
    }
  }
  return result;
}

function parseToolCalls(content: ContentBlock[]): AIToolCall[] {
  return content.flatMap((block) => {
    const tool = block.toolUse;
    if (!tool) return [];
    if (
      typeof tool.toolUseId !== "string" ||
      typeof tool.name !== "string" ||
      !tool.input ||
      typeof tool.input !== "object" ||
      Array.isArray(tool.input)
    ) {
      throw new AIProviderError(
        "malformed_response",
        "Bedrock returned an invalid tool call",
      );
    }
    return [{
      id: tool.toolUseId,
      name: tool.name,
      arguments: tool.input as Record<string, unknown>,
    }];
  });
}

function classifyBedrockError(error: unknown): AIProviderError {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  if (["AccessDeniedException", "UnrecognizedClientException"].includes(name))
    return new AIProviderError("authentication", "Bedrock denied the request", false, {
      cause: error,
    });
  if (["ThrottlingException", "ServiceQuotaExceededException"].includes(name))
    return new AIProviderError("rate_limited", "Bedrock rate limit reached", true, {
      cause: error,
    });
  if (name === "ValidationException")
    return new AIProviderError("invalid_request", "Bedrock rejected the request", false, {
      cause: error,
    });
  return new AIProviderError("unavailable", "Bedrock is unavailable", true, {
    cause: error,
  });
}
