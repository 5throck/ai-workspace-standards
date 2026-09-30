/**
 * Per-stage turn timing logs (T-20260930-011, measurement plan in
 * docs/reports/2026-09-30-co-workspace-turn-latency-research.md §4): one structured
 * JSON line per stage, keyed by the turn container name, with milliseconds since the
 * timer's t0 and since the previous stage. Disable with CO_WORKSPACE_TURN_TIMING=0.
 */

const enabled = () => process.env.CO_WORKSPACE_TURN_TIMING !== "0";

/** Deterministic per-tenant turn log key so the chat.ts / hermes.ts / responses.ts lines
 * join on one value (turnContainerName is unique per call — a container name, not a key). */
export function turnLogKey(tenantId: string): string {
  return "co-workspace-turn-" + tenantId.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 36);
}

export class TurnTiming {
  private t0 = Date.now();
  private last = this.t0;

  constructor(private turn: string) {}

  /** Emit one structured line for a named stage; extra fields merge into the line. */
  mark(stage: string, extra?: Record<string, unknown>): void {
    if (!enabled()) return;
    const now = Date.now();
    const line = {
      ts: new Date().toISOString(),
      turn: this.turn,
      stage,
      ms_total: now - this.t0,
      ms_stage: now - this.last,
      ...extra,
    };
    this.last = now;
    console.log(`[turn-timing] ${JSON.stringify(line)}`);
  }
}
