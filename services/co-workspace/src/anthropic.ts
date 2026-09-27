/**
 * Anthropic Messages API wire translation (ADR-0092 D2). Model ids are variant ids; one
 * completion is served by one Hermes turn — only the latest user message is forwarded, because
 * the Hermes named thread already holds the conversation history. Wire shapes follow the
 * Anthropic Messages API: POST /v1/messages with `message_start` / `content_block_*` /
 * `message_delta` / `message_stop` SSE events when stream=true.
 *
 * Phase 0 notes: `system` is ignored (the tenant agent team defines its own instructions from
 * AGENTS.md); `max_tokens` is accepted but not enforced (Hermes run ceilings apply instead);
 * tenant keying uses `metadata.user_id` when present.
 */

export interface ParsedAnthropicRequest {
  model: string;
  user: string;
  message: string;
  stream: boolean;
}

export type ParseResult = { ok: true; req: ParsedAnthropicRequest } | { ok: false; error: string };

function textFromContent(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((block) =>
        block && typeof block === "object" && (block as any).type === "text" && typeof (block as any).text === "string"
          ? (block as any).text
          : "",
      )
      .filter(Boolean);
    if (parts.length) return parts.join("\n");
  }
  return null;
}

export function parseAnthropicRequest(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "request body must be a JSON object" };
  }
  const raw = body as Record<string, unknown>;
  const model = typeof raw.model === "string" ? raw.model.trim() : "";
  if (!model) return { ok: false, error: "model is required" };
  if (typeof raw.max_tokens !== "number") {
    return { ok: false, error: "max_tokens is required (accepted but not enforced in Phase 0)" };
  }
  const messages = Array.isArray(raw.messages) ? raw.messages : [];
  const lastUser = [...messages]
    .reverse()
    .find((m) => m && typeof m === "object" && (m as any).role === "user");
  const text = lastUser ? textFromContent((lastUser as any).content) : null;
  if (text === null) {
    return { ok: false, error: "messages must contain a user message with string or text-block content" };
  }
  const metadata = raw.metadata as Record<string, unknown> | undefined;
  const user =
    typeof metadata?.user_id === "string" && metadata.user_id.trim() ? metadata.user_id.trim() : "default";
  return { ok: true, req: { model, user, message: text, stream: raw.stream === true } };
}

export function messageId(): string {
  return `msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

/** Non-streaming response envelope. */
export function messagePayload(
  id: string,
  model: string,
  content: string,
  usage: { input_tokens: number; output_tokens: number },
) {
  return {
    id,
    type: "message",
    role: "assistant",
    model,
    content: [{ type: "text", text: content }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage,
  };
}

/** Rough token estimate for the count_tokens stub (chars/4); not a tokenizer. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function countTokensPayload(inputTokens: number) {
  return { input_tokens: inputTokens };
}

/** SSE frame: `event: <type>\ndata: <json>\n\n` per the Anthropic streaming wire. */
export function anthropicEvent(type: string, data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

export interface AnthropicStreamHandles {
  messageStart(): Uint8Array[];
  contentStart(): Uint8Array[];
  contentDelta(text: string): Uint8Array[];
  contentStop(): Uint8Array[];
  messageStop(inputTokens: number, outputTokens: number): Uint8Array[];
}

/** Frame builders bound to one message id/model — ordering matches the Anthropic wire:
 * message_start → content_block_start → content_block_delta* → content_block_stop →
 * message_delta → message_stop. */
export function anthropicStream(id: string, model: string): AnthropicStreamHandles {
  const enc = (type: string, data: Record<string, unknown>) =>
    new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  return {
    messageStart: () => [
      enc("message_start", {
        type: "message_start",
        message: {
          id,
          type: "message",
          role: "assistant",
          model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      }),
    ],
    contentStart: () => [enc("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })],
    contentDelta: (text: string) => [
      enc("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }),
    ],
    contentStop: () => [enc("content_block_stop", { type: "content_block_stop", index: 0 })],
    messageStop: (inputTokens: number, outputTokens: number) => [
      enc("message_delta", {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: outputTokens },
      }),
      enc("message_stop", {
        type: "message_stop",
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      }),
    ],
  };
}
