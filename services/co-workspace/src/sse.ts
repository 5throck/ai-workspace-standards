/** Server-sent events (SSE) streaming plumbing: heartbeat, sink lifecycle, data encoding. */

/** P2-11 (QA fair): keep SSE connections alive through silent tool phases — a comment ping
 * every 15s, cleared when the stream ends or the client cancels. */
export function startHeartbeat(sink: SseSink): void {
  const ping = new TextEncoder().encode(": ping\n\n");
  sink.track(setInterval(() => sink.enqueue(ping), 15_000));
}

/** T-20260930-010 (perceived-latency quick win): surface progress-worthy Hermes events as
 * `: …` comment frames so the OpenAI/Anthropic/Gemini builders (which forward only `text`)
 * still show tool activity during the silent thinking phase. Comments are wire-legal SSE
 * and ignored by protocol clients. Returns null for events that should not surface. */
export function turnProgressComment(evt: { type: string; [key: string]: unknown }): string | null {
  if (evt.type === "tool_use" && typeof evt.name === "string") return `: tool: ${evt.name}…\n\n`;
  if (evt.type === "tool_result" && typeof evt.name === "string") {
    const ms = typeof evt.duration_ms === "number" ? ` (${evt.duration_ms}ms)` : "";
    return `: tool: ${evt.name} done${ms}\n\n`;
  }
  if (evt.type === "system") return ": turn: runtime ready\n\n";
  return null;
}

export interface SseSink {
  /** Never throws; a no-op once the client cancelled or the stream closed. */
  enqueue(chunk: Uint8Array): void;
  isClosed(): boolean;
  /** Register a timer to clear on close/cancel. */
  track(timer: ReturnType<typeof setInterval>): void;
  /** Pass to runChat's `onProc` so a client disconnect kills THIS stream's turn. */
  onProc(proc: { kill: (code?: number) => void }): void;
}

/** Shared SSE plumbing (T-20260929-008): tracks client disconnect via cancel(), makes
 * enqueue/close safe after cancel, clears timers, and kills the turn this stream started.
 * Every runtime now registers its live process via the uniform `onSpawn` contract
 * (2026-10-03 review H1), so a disconnect kills the turn regardless of runtime. */
export function sseStream(run: (sink: SseSink) => Promise<void>): ReadableStream<Uint8Array> {
  let closed = false;
  let proc: { kill: (code?: number) => void } | undefined;
  const timers = new Set<ReturnType<typeof setInterval>>();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const clearTimers = () => {
    for (const t of timers) clearInterval(t);
    timers.clear();
  };
  const sink: SseSink = {
    enqueue(chunk) {
      if (closed) return;
      try {
        controller.enqueue(chunk);
      } catch {
        closed = true;
        clearTimers();
      }
    },
    isClosed: () => closed,
    track: (t) => {
      if (closed) clearInterval(t);
      else timers.add(t);
    },
    onProc(p) {
      proc = p;
      if (closed) p.kill(); // cancelled while queued behind another turn
    },
  };
  return new ReadableStream<Uint8Array>({
    async start(c) {
      controller = c;
      try {
        await run(sink);
      } catch {
        // run() handles its own errors; never let one escape as an unhandled rejection
      } finally {
        clearTimers();
        if (!closed) {
          closed = true;
          try {
            c.close();
          } catch {
            // already closed/cancelled
          }
        }
      }
    },
    cancel() {
      closed = true;
      clearTimers();
      try {
        proc?.kill();
      } catch {
        // process already gone
      }
    },
  });
}

export const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
};

export function sseData(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}
