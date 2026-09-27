/**
 * OpenAI wire translation (ADR-0092 D2/D7). Model ids are variant ids; one completion is served
 * by one Hermes turn — only the latest user message is forwarded, because the Hermes session
 * (resume latest) already holds the conversation history.
 */

export interface ParsedChatRequest {
  model: string;
  user: string;
  message: string;
  stream: boolean;
}

export type ParseResult = { ok: true; req: ParsedChatRequest } | { ok: false; error: string };

export function modelsPayload(variants: string[]) {
  return {
    object: "list",
    data: variants.map((v) => ({ id: v, object: "model", created: 0, owned_by: "team-gateway" })),
  };
}

export function parseChatRequest(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "request body must be a JSON object" };
  }
  const raw = body as Record<string, unknown>;
  const model = typeof raw.model === "string" ? raw.model.trim() : "";
  if (!model) return { ok: false, error: "model is required" };
  const messages = Array.isArray(raw.messages) ? raw.messages : [];
  const lastUser = [...messages]
    .reverse()
    .find((m) => m && typeof m === "object" && (m as any).role === "user" && typeof (m as any).content === "string");
  if (!lastUser) {
    return { ok: false, error: "messages must contain a user message with string content" };
  }
  const user =
    typeof raw.user === "string" && raw.user.trim() ? raw.user.trim() : "default";
  return {
    ok: true,
    req: {
      model,
      user,
      message: (lastUser as any).content as string,
      stream: raw.stream === true,
    },
  };
}

export function completionId(): string {
  return `chatcmpl-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function chunkData(
  id: string,
  model: string,
  created: number,
  delta: { role?: string; content?: string },
  finishReason: string | null,
): string {
  const payload = {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export function doneData(): string {
  return "data: [DONE]\n\n";
}

export interface CompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Map a Hermes `result.tokens` block ({input, output, total, ...}) to OpenAI usage. */
export function completionUsage(tokens: unknown): CompletionUsage {
  const t = (tokens ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    prompt_tokens: n(t.input),
    completion_tokens: n(t.output),
    total_tokens: n(t.total),
  };
}

export function completionPayload(
  id: string,
  model: string,
  created: number,
  content: string,
  usage?: CompletionUsage,
) {
  return {
    id,
    object: "chat.completion",
    created,
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
