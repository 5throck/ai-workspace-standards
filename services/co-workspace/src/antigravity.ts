/**
 * Antigravity runtime adapter (`agy -p --output-format stream-json`) — ADR-0092 Addendum 3.
 * Normalizes agy's NDJSON events into the gateway's HermesEvent shape so the SSE translators,
 * quota accounting, and registry stay runtime-agnostic:
 *   {"event":"init","conversation_id":"..."}
 *   {"event":"step_update","step_update":{"state":"ACTIVE","step_type":"agent_response","text_delta":"..."}}
 *   {"event":"result","result":{"conversation_id":"...","status":"SUCCESS","response":"...","usage":{...}}}
 * Continuity is explicit: turn 1 creates a conversation; later turns pass
 * `--conversation <id>` captured from the registry (deterministic, no MRU lookups).
 */

import type { HermesEvent, HermesTurnResult } from "./hermes";
import { allowlistedEnv } from "./hermes";

export interface AntigravitySpawnOptions {
  agyBin: string;
  /** Interpreter prefix for agyBin — Windows CI passes ["bun"]. Production never sets it. */
  binPrefix?: string[];
  projectDir: string;
  message: string;
  /** Previous conversation id for this tenant; when set, resumes it via `--conversation`. */
  conversationId?: string;
  printTimeoutSeconds: number;
  extraArgs?: string[];
  env?: Record<string, string | undefined>;
  /** 2026-10-03 review H1: `--print-timeout` bounds the CLI, but the outer kill timer is
   * the hard stop (exit code 124) — parity with the hermes run budget. */
  timeoutMs?: number;
  /** QA-07 parity (2026-10-03 review H1): register the live process for cancel/delete. */
  onSpawn?: (proc: { kill: (code?: number) => void }) => void;
}

export function agyArgs(o: AntigravitySpawnOptions): string[] {
  const args = [
    ...(o.binPrefix ?? []),
    o.agyBin,
    "-p",
    o.message,
    "--output-format",
    "stream-json",
    "--print-timeout",
    `${o.printTimeoutSeconds}s`,
  ];
  if (o.conversationId) args.push("--conversation", o.conversationId);
  args.push(...(o.extraArgs ?? []));
  return args;
}

/** Normalize one agy NDJSON line into the shared event shape. */
export function parseAgyLine(line: string): HermesEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return { type: "raw", line: trimmed };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { type: "raw", line: trimmed };
  }
  const rec = obj as Record<string, unknown>;
  if (rec.event === "init" && typeof rec.conversation_id === "string") {
    return { type: "system", subtype: "init", session_id: rec.conversation_id, raw: rec };
  }
  if (rec.event === "step_update" && typeof rec.step_update === "object" && rec.step_update !== null) {
    const step = rec.step_update as Record<string, unknown>;
    if (step.step_type === "agent_response" && typeof step.text_delta === "string" && step.text_delta) {
      return { type: "text", text: step.text_delta, raw: rec };
    }
    return { type: "agy_step", raw: rec };
  }
  if (rec.event === "result" && typeof rec.result === "object" && rec.result !== null) {
    const result = rec.result as Record<string, unknown>;
    const usage = (result.usage ?? {}) as Record<string, unknown>;
    return {
      type: "result",
      session_id: typeof result.conversation_id === "string" ? result.conversation_id : undefined,
      exit_code: result.status === "SUCCESS" ? 0 : 1,
      text: typeof result.response === "string" ? result.response : "",
      tokens: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        total: usage.total_tokens,
      },
      raw: rec,
    };
  }
  return { type: "raw", line: trimmed };
}

/** Run one Antigravity conversation turn; normalizes into HermesTurnResult so the server's
 * quota/registry/wire layers stay runtime-agnostic. */
export async function runAntigravityTurn(
  o: AntigravitySpawnOptions,
  onEvent?: (evt: HermesEvent) => void,
): Promise<HermesTurnResult> {
  const proc = Bun.spawn(agyArgs(o), {
    cwd: o.projectDir,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: allowlistedEnv(o.env ?? process.env),
  });
  o.onSpawn?.(proc);

  // Outer watchdog (2026-10-03 review H1) — backstops `--print-timeout`.
  let timedOut = false;
  const watchdog = o.timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        try {
          proc.kill(9);
        } catch {
          /* already exited */
        }
      }, o.timeoutMs)
    : undefined;

  let sessionId: string | undefined;
  let result: HermesEvent | undefined;
  let finalText = "";
  let buffer = "";
  const decoder = new TextDecoder();
  const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();

  const handleLine = (line: string) => {
    const evt = parseAgyLine(line);
    if (!evt) return;
    if (evt.type === "system" && typeof evt.session_id === "string") {
      sessionId = evt.session_id;
    } else if (evt.type === "text" && typeof evt.text === "string") {
      finalText += evt.text;
    } else if (evt.type === "result") {
      result = evt;
      if (typeof evt.session_id === "string") sessionId = evt.session_id;
    }
    onEvent?.(evt);
  };

  const readLoop = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        handleLine(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
      }
    }
    if (buffer.trim()) handleLine(buffer);
  })();

  const [stderr, exitCode] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
    readLoop,
  ]);
  if (watchdog) clearTimeout(watchdog);

  if (result && typeof result.text === "string" && result.text) finalText = result.text;
  const rawTokens = (result?.tokens ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  return {
    exitCode: timedOut ? 124 : exitCode,
    sessionId,
    finalText,
    result,
    tokens: {
      input: n(rawTokens.input),
      output: n(rawTokens.output),
      total: n(rawTokens.total),
    },
    stderrTail: stderr.slice(-2000),
  };
}
