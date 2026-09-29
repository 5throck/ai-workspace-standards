/** Server-sent events (SSE) streaming plumbing: heartbeat, sink lifecycle, data encoding. */

/** P2-11 (QA fair): keep SSE connections alive through silent tool phases — a comment ping
 * every 15s, cleared when the stream ends or the client cancels. */
export function startHeartbeat(sink: SseSink): void {
  const ping = new TextEncoder().encode(": ping\n\n");
  sink.track(setInterval(() => sink.enqueue(ping), 15_000));
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
 * Cancel support is hermes-only: the antigravity/claude/codex run functions expose no
 * onSpawn/kill hook, so their turns run to completion after a disconnect (known limitation). */
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
