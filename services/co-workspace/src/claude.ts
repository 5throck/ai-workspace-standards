/**
 * Wave C1: Claude Code runtime adapter (`claude -p --output-format stream-json --verbose`).
 * Wire captured live (2026-09-27, claude 2.1.274):
 *   {"type":"system","subtype":"init","session_id":"..."}
 *   {"type":"assistant","message":{"content":[{"type":"text","text":"..."}], "usage":{...}}}
 *   {"type":"user",...} / {"type":"result","subtype":"success","session_id","result","usage":{...}}
 * Continuity: `--resume <session_id>` (session id from the registry, like hermes threads).
 * Provider disclosure: Anthropic. Credentials: operator's `claude login` — never copied.
 */

import type { HermesEvent, HermesTurnResult } from "./hermes";
import { allowlistedEnv } from "./hermes";

export interface ClaudeSpawnOptions {
  claudeBin: string;
  /** Interpreter prefix for claudeBin — Windows CI passes ["bun"] so a plain .ts fake
   * binary can stand in for the real executable. Production never sets it. */
  binPrefix?: string[];
  projectDir: string;
  message: string;
  sessionId?: string;
  /** 2026-10-03 review H1: enforced EXTERNALLY (kill timer) — `claude -p` has no budget
   * flag, so an unbounded turn used to wedge the tenant forever (chatLocks never settles,
   * cancel/delete no-ops). Timed-out turns report exit code 124. */
  timeoutMs?: number;
  extraArgs?: string[];
  env?: Record<string, string | undefined>;
  /** QA-07 parity (2026-10-03 review H1): register the live process so cancel/delete work
   * for claude turns exactly as they do for hermes turns. */
  onSpawn?: (proc: { kill: (code?: number) => void }) => void;
}

export function claudeArgs(o: ClaudeSpawnOptions): string[] {
  const args = [
    ...(o.binPrefix ?? []),
    o.claudeBin,
    "-p",
    o.message,
    "--output-format",
    "stream-json",
    "--verbose",
  ];
  if (o.sessionId) args.push("--resume", o.sessionId);
  args.push(...(o.extraArgs ?? []));
  return args;
}

export function parseClaudeLine(line: string): HermesEvent | null {
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
  if (rec.type === "system" && rec.subtype === "init" && typeof rec.session_id === "string") {
    return { type: "system", subtype: "init", session_id: rec.session_id, raw: rec };
  }
  if (rec.type === "assistant" && typeof rec.message === "object" && rec.message !== null) {
    const message = rec.message as { content?: Array<{ type: string; text?: string }>; usage?: Record<string, unknown> };
    for (const block of message.content ?? []) {
      if (block.type === "text" && block.text) {
        return { type: "text", text: block.text, raw: rec };
      }
    }
    return { type: "claude_assistant", raw: rec };
  }
  if (rec.type === "result") {
    const usage = (rec.usage ?? {}) as Record<string, unknown>;
    return {
      type: "result",
      session_id: typeof rec.session_id === "string" ? rec.session_id : undefined,
      exit_code: rec.subtype === "success" ? 0 : 1,
      text: typeof rec.result === "string" ? rec.result : "",
      tokens: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        total: usage.total_tokens ?? ((usage.input_tokens as number) + (usage.output_tokens as number)),
      },
      raw: rec,
    };
  }
  return { type: "raw", line: trimmed };
}

export async function runClaudeTurn(
  o: ClaudeSpawnOptions,
  onEvent?: (evt: HermesEvent) => void,
): Promise<HermesTurnResult> {
  const proc = Bun.spawn(claudeArgs(o), {
    cwd: o.projectDir,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: allowlistedEnv(o.env ?? process.env),
  });
  o.onSpawn?.(proc);

  // External watchdog (2026-10-03 review H1): the CLI has no budget flag.
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
    const evt = parseClaudeLine(line);
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
    tokens: { input: n(rawTokens.input), output: n(rawTokens.output), total: n(rawTokens.total) },
    stderrTail: stderr.slice(-2000),
  };
}
