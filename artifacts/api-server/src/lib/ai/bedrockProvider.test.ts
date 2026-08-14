import { describe, expect, it, vi } from "vitest";
import { BedrockProvider } from "./bedrockProvider";

const baseRequest = {
  system: "You are Kindred.",
  messages: [{ role: "user" as const, content: "How was my morning?" }],
  timeoutMs: 1_000,
};

describe("BedrockProvider", () => {
  it("normalizes text and tool-use responses", async () => {
    const send = vi.fn().mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [
            { text: "Let me check." },
            {
              toolUse: {
                toolUseId: "tool-1",
                name: "get_recent_morning_logs",
                input: { limit: 7 },
              },
            },
          ],
        },
      },
      stopReason: "tool_use",
    });
    const provider = new BedrockProvider("us-east-1", "profile-id", { send });

    await expect(provider.chat(baseRequest)).resolves.toEqual({
      content: "Let me check.",
      toolCalls: [
        {
          id: "tool-1",
          name: "get_recent_morning_logs",
          arguments: { limit: 7 },
        },
      ],
      finishReason: "tool_use",
    });
  });

  it("sends tool results back with the matching tool-use ID", async () => {
    const send = vi.fn().mockResolvedValue({
      output: { message: { role: "assistant", content: [{ text: "Done." }] } },
      stopReason: "end_turn",
    });
    const provider = new BedrockProvider("us-east-1", "profile-id", { send });
    await provider.chat({
      ...baseRequest,
      messages: [
        ...baseRequest.messages,
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "tool-1", name: "lookup", arguments: { limit: 1 } },
          ],
        },
        { role: "tool", content: '{"ok":true}', toolCallId: "tool-1" },
      ],
    });

    const input = send.mock.calls[0][0].input;
    expect(input.messages.at(-1)).toEqual({
      role: "user",
      content: [
        {
          toolResult: {
            toolUseId: "tool-1",
            content: [{ text: '{"ok":true}' }],
          },
        },
      ],
    });
  });
});
