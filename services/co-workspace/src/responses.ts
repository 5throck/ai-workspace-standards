import type { TenantRecord } from "./tenant";
import { anthropicEvent, anthropicStream, messagePayload, messageId } from "./anthropic";
import { generateContentPayload, geminiError, geminiStream } from "./gemini";
import { chunkData, completionId, completionPayload, completionUsage, doneData } from "./openai";
import { HttpError, jsonResponse } from "./http";
import { startHeartbeat, sseStream, SSE_HEADERS, sseData, turnProgressComment } from "./sse";
import { TurnTiming, turnLogKey } from "./timing";
import type { GatewayState } from "./state";
import { assertPrincipalQuota, assertQuota } from "./access";
import { runChat, usageSummary } from "./chat";

/** 2026-10-03 review M1: SSE error frames previously embedded `String(err)` — fs paths,
 * spawn stderr tails and provider errors went to the client. Intentional rejections
 * (HttpError: quota 429, access 403, ensureReady 409) keep their message; anything else
 * is logged server-side and reported generically. */
function sseErrorMessage(err: unknown): string {
  if (err instanceof HttpError) return err.message;
  console.error("[co-workspace] turn stream error:", err);
  return "internal error during turn";
}

/** Native chat → raw Hermes events (SSE) + a terminal done event. */
export function nativeChatResponse(state: GatewayState, rec: TenantRecord, message: string): Response {
  const stream = sseStream(async (sink) => {
      try {
        // R7 UX: while the team is still provisioning, stream its progress stages as `: …`
        // comment frames (wire-legal SSE comments) so the wait is visible in the client.
        let current = state.registry.get(rec.tenantId) ?? rec;
        if (current.status === "provisioning") {
          const deadline = Date.now() + state.cfg.scaffoldTimeoutMs + 5_000;
          while (Date.now() < deadline) {
            current = state.registry.get(rec.tenantId) ?? current;
            const last = current.progress?.[current.progress.length - 1];
            sink.enqueue(
              new TextEncoder().encode(
                `: provisioning: ${last ? `[${last.stage}] ${last.label}` : current.status + "…"}\n\n`,
              ),
            );
            if (current.status !== "provisioning" || sink.isClosed()) break;
            await Bun.sleep(1000);
          }
          if (current.status === "failed") {
            throw new Error(`team provisioning failed: ${current.error ?? "unknown"}`);
          }
          if (current.status === "provisioning") {
            throw new Error("team provisioning timed out — try again shortly");
          }
        }
        assertQuota(state.cfg, current);
        assertPrincipalQuota(state, current.ownerPrincipal ?? "anonymous");
        if (sink.isClosed()) return;
        // T-20260930-010: show the silent thinking phase immediately and keep the
        // connection warm while the model works (native clients already see every raw
        // Hermes event; the comment frames cover the gap before the first event).
        const enc = new TextEncoder();
        sink.enqueue(enc.encode(": thinking…\n\n"));
        startHeartbeat(sink);
        const timing = new TurnTiming(turnLogKey(rec.tenantId));
        let sawFirstFrame = false;
        const result = await runChat(state, current, message, (evt) => {
          if (!sawFirstFrame) {
            sawFirstFrame = true;
            timing.mark("t_first_sse_frame", { surface: "native", evt: evt.type });
          }
          sink.enqueue(sseData(evt));
        }, sink.onProc);
        sink.enqueue(
          sseData({
            type: "done",
            sessionId: result.sessionId ?? null,
            exitCode: result.exitCode,
            finalText: result.finalText,
            usage: usageSummary(result),
          }),
        );
      } catch (err) {
        sink.enqueue(sseData({ type: "error", error: sseErrorMessage(err) }));
      }
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

/** OpenAI chat completions: stream=true → role chunk, content chunks, finish chunk, [DONE];
 * stream=false → single completion JSON. */
export async function openaiChatResponse(
  state: GatewayState,
  rec: TenantRecord,
  message: string,
  stream: boolean,
  provisioning?: Promise<void>,
): Promise<Response> {
  if (!stream) {
    const result = await runChat(state, rec, message);
    return jsonResponse(
      completionPayload(
        completionId(),
        rec.variant,
        Math.floor(Date.now() / 1000),
        result.finalText,
        completionUsage(result.result?.tokens),
      ),
    );
  }
  const id = completionId();
  const created = Math.floor(Date.now() / 1000);
  const model = rec.variant;
  let sentRole = false;
  const body = sseStream(async (sink) => {
      const enc = new TextEncoder();
      try {
        // P8: while a lazy tenant is provisioning, stream progress as SSE comments
        // (`: …` lines are wire-legal and ignored by OpenAI clients, visible to humans).
        if (provisioning) {
          const emitTrail = () => {
            for (const p of state.registry.get(rec.tenantId)?.progress ?? []) {
              sink.enqueue(enc.encode(`: provisioning: [${p.stage}] ${p.label}\n`));
            }
          };
          emitTrail();
          let ticks = 0;
          const timer = setInterval(() => {
            ticks += 1;
            const cur = state.registry.get(rec.tenantId) ?? rec;
            if (cur.progress?.length) {
              const last = cur.progress[cur.progress.length - 1];
              sink.enqueue(enc.encode(`: provisioning: [${last.stage}] ${last.label}\n`));
            } else {
              sink.enqueue(enc.encode(`: provisioning: ${cur.status}…\n`));
            }
            if (ticks > 900) clearInterval(timer);
          }, 1000);
          sink.track(timer);
          try {
            await provisioning;
          } finally {
            clearInterval(timer); // H4: also on rejection
          }
          sink.enqueue(enc.encode(": provisioning: ready\n\n"));
        }
        if (sink.isClosed()) return;
        // T-20260930-010: the OpenAI builder forwards only `text` events, so clients saw
        // nothing for the whole thinking phase — emit an immediate comment frame, keep a
        // heartbeat running, and map tool/system events to progress comments.
        startHeartbeat(sink);
        sink.enqueue(enc.encode(": thinking…\n\n"));
        const timing = new TurnTiming(turnLogKey(rec.tenantId));
        let sawFirstFrame = false;
        const result = await runChat(state, rec, message, (evt) => {
          if (!sawFirstFrame) {
            sawFirstFrame = true;
            timing.mark("t_first_sse_frame", { surface: "openai", evt: evt.type });
          }
          const progress = turnProgressComment(evt);
          if (progress) sink.enqueue(enc.encode(progress));
          if (evt.type !== "text" || typeof evt.text !== "string") return;
          if (!sentRole) {
            sentRole = true;
            sink.enqueue(enc.encode(chunkData(id, model, created, { role: "assistant" }, null)));
          }
          sink.enqueue(enc.encode(chunkData(id, model, created, { content: evt.text }, null)));
        }, sink.onProc);
        sink.enqueue(enc.encode(chunkData(id, model, created, {}, "stop")));
        sink.enqueue(enc.encode(doneData()));
      } catch (err) {
        sink.enqueue(
          enc.encode(
            `data: ${JSON.stringify({ error: { message: sseErrorMessage(err) } })}\n\n`,
          ),
        );
        sink.enqueue(enc.encode(doneData()));
      }
  });
  return new Response(body, { headers: SSE_HEADERS });
}

/** Anthropic Messages surface: stream=true → message_start / content_block_* / message_delta /
 * message_stop SSE frames; stream=false → single message envelope. */
export async function anthropicChatResponse(
  state: GatewayState,
  rec: TenantRecord,
  message: string,
  stream: boolean,
): Promise<Response> {
  if (!stream) {
    const result = await runChat(state, rec, message);
    const tokens = (result.tokens ?? {}) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    return jsonResponse(
      messagePayload(messageId(), rec.variant, result.finalText, {
        input_tokens: n(tokens.input),
        output_tokens: n(tokens.output),
      }),
    );
  }
  const id = messageId();
  const model = rec.variant;
  const frames = anthropicStream(id, model);
  const body = sseStream(async (sink) => {
      try {
        let startedContent = false;
        const enqueue = (frameset: Uint8Array[]) => frameset.forEach((f) => sink.enqueue(f));
        const enc = new TextEncoder();
        enqueue(frames.messageStart());
        // T-20260930-010: immediate progress frame + heartbeat; the Anthropic builder
        // forwards only `text`, so tool/system events surface as SSE comments.
        startHeartbeat(sink);
        sink.enqueue(enc.encode(": thinking…\n\n"));
        const timing = new TurnTiming(turnLogKey(rec.tenantId));
        let sawFirstFrame = false;
        const result = await runChat(state, rec, message, (evt) => {
          if (!sawFirstFrame) {
            sawFirstFrame = true;
            timing.mark("t_first_sse_frame", { surface: "anthropic", evt: evt.type });
          }
          const progress = turnProgressComment(evt);
          if (progress) sink.enqueue(enc.encode(progress));
          if (evt.type !== "text" || typeof evt.text !== "string") return;
          if (!startedContent) {
            startedContent = true;
            enqueue(frames.contentStart());
          }
          enqueue(frames.contentDelta(evt.text));
        }, sink.onProc);
        if (startedContent) enqueue(frames.contentStop());
        const tokens = (result.tokens ?? {}) as Record<string, unknown>;
        const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
        enqueue(frames.messageStop(n(tokens.input), n(tokens.output)));
      } catch (err) {
        sink.enqueue(
          anthropicEvent("error", {
            type: "error",
            error: { type: "api_error", message: sseErrorMessage(err) },
          }),
        );
      }
  });
  return new Response(body, { headers: SSE_HEADERS });
}

/** Gemini wire (Antigravity/Gemini ecosystem): stream=true → per-delta candidate chunks then a
 * terminal chunk with finishReason STOP + usageMetadata; stream=false → single generateContent
 * envelope. */
export async function geminiChatResponse(
  state: GatewayState,
  rec: TenantRecord,
  message: string,
  stream: boolean,
): Promise<Response> {
  if (!stream) {
    const result = await runChat(state, rec, message);
    const tokens = (result.tokens ?? {}) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    return jsonResponse(
      generateContentPayload(result.finalText, {
        promptTokenCount: n(tokens.input),
        candidatesTokenCount: n(tokens.output),
        totalTokenCount: n(tokens.total),
      }),
    );
  }
  const frames = geminiStream();
  const body = sseStream(async (sink) => {
      startHeartbeat(sink);
      const enc = new TextEncoder();
      // T-20260930-010: parity with the other surfaces — immediate progress frame and
      // tool/system events as comments (the Gemini builder forwards only `text` deltas).
      sink.enqueue(enc.encode(": thinking…\n\n"));
      const timing = new TurnTiming(turnLogKey(rec.tenantId));
      let sawFirstFrame = false;
      try {
        const result = await runChat(state, rec, message, (evt) => {
          if (!sawFirstFrame) {
            sawFirstFrame = true;
            timing.mark("t_first_sse_frame", { surface: "gemini", evt: evt.type });
          }
          const progress = turnProgressComment(evt);
          if (progress) sink.enqueue(enc.encode(progress));
          if (evt.type !== "text" || typeof evt.text !== "string") return;
          frames.delta(evt.text).forEach((f) => sink.enqueue(f));
        }, sink.onProc);
        const tokens = (result.tokens ?? {}) as Record<string, unknown>;
        const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
        frames.end(n(tokens.input), n(tokens.output)).forEach((f) => sink.enqueue(f));
      } catch (err) {
        sink.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify(geminiError(500, sseErrorMessage(err)))}\n\n`,
          ),
        );
      }
  });
  return new Response(body, { headers: SSE_HEADERS });
}
