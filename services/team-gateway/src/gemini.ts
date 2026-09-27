/**
 * Gemini API wire translation (ADR-0092 D2 addendum) — the Antigravity/Gemini-ecosystem
 * contract (`POST /v1beta/models/{model}:generateContent` and `:streamGenerateContent?alt=sse`).
 * Antigravity itself exposes no public model-serving API spec; its ecosystem clients speak the
 * Gemini generateContent wire, so that is the contract served here. Model ids are variant ids;
 * one completion is served by one Hermes turn — only the latest user turn is forwarded, because
 * the Hermes named thread already holds the conversation history.
 *
 * Phase 0 notes: `systemInstruction` is ignored (the tenant agent team defines its own
 * instructions from AGENTS.md); `generationConfig` is accepted but not enforced (Hermes run
 * ceilings apply instead); tenant keying uses the optional gateway-extension `user` field
 * (Gemini wire has no native user field), defaulting to `default`.
 */

export interface ParsedGeminiRequest {
  model: string;
  user: string;
  message: string;
  stream: boolean;
}

export type ParseResult = { ok: true; req: ParsedGeminiRequest } | { ok: false; error: string };

function textFromParts(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null;
  const texts = parts
    .map((part) =>
      part && typeof part === "object" && typeof (part as any).text === "string" ? (part as any).text : "",
    )
    .filter(Boolean);
  return texts.length ? texts.join("\n") : null;
}

export function parseGeminiRequest(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "request body must be a JSON object" };
  }
  const raw = body as Record<string, unknown>;
  const contents = Array.isArray(raw.contents) ? raw.contents : [];
  const lastUser = [...contents]
    .reverse()
    .find((c) => c && typeof c === "object" && (c as any).role === "user");
  const text = lastUser ? textFromParts((lastUser as any).parts) : null;
  if (text === null) {
    return { ok: false, error: "contents must contain a user turn with text parts" };
  }
  const user = typeof raw.user === "string" && raw.user.trim() ? raw.user.trim() : "default";
  return { ok: true, req: { model: "", user, message: text, stream: false } };
}

export function messageId(): string {
  return `msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function generateContentPayload(content: string, usage: {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}) {
  return {
    candidates: [
      {
        content: { role: "model", parts: [{ text: content }] },
        finishReason: "STOP",
        index: 0,
      },
    ],
    usageMetadata: usage,
    modelVersion: "team-gateway",
  };
}

export function countTokensPayload(totalTokens: number) {
  return { totalTokens };
}

/** Rough token estimate for the countTokens stub (chars/4); not a tokenizer. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function geminiEvent(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export interface GeminiStreamHandles {
  /** Text-delta chunk (role + index are fixed per candidate). */
  delta(text: string): Uint8Array[];
  /** Terminal chunk: finishReason STOP + usageMetadata. */
  end(inputTokens: number, outputTokens: number): Uint8Array[];
}

export function geminiStream(): GeminiStreamHandles {
  return {
    delta: (text: string) => [
      geminiEvent({
        candidates: [{ content: { role: "model", parts: [{ text }] }, index: 0 }],
      }),
    ],
    end: (inputTokens: number, outputTokens: number) => [
      geminiEvent({
        candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "STOP", index: 0 }],
        usageMetadata: {
          promptTokenCount: inputTokens,
          candidatesTokenCount: outputTokens,
          totalTokenCount: inputTokens + outputTokens,
        },
        modelVersion: "team-gateway",
      }),
    ],
  };
}

/** Gemini error envelope. */
export function geminiError(status: number, message: string) {
  const statusName =
    status === 400 ? "INVALID_ARGUMENT" : status === 404 ? "NOT_FOUND" : status >= 500 ? "INTERNAL" : "FAILED_PRECONDITION";
  return { error: { code: status, message, status: statusName } };
}
