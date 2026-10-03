/**
 * Wave C2: Codex CLI runtime adapter (`codex exec --json`).
 * Wire captured live (2026-09-27, codex CLI):
 *   {"type":"thread.started","thread_id":"..."}
 *   {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
 *   {"type":"turn.completed","usage":{...}}
 * Continuity: `codex exec resume <thread_id> --json` (thread id from the registry).
 * Provider disclosure: OpenAI. Credentials: operator's `codex login` — never copied.
 */

import type { HermesEvent, HermesTurnResult, HermesSpawnOptions } from "./hermes";
import { allowlistedEnv, turnSpawnArgv, dockerCliEnv, containerKillHandle } from "./hermes";

export interface CodexSpawnOptions {
  codexBin: string;
  /** Interpreter prefix for codexBin — Windows CI passes ["bun"] (fake .ts binaries). */
  binPrefix?: string[];
  projectDir: string;
  message: string;
  threadId?: string;
  /** 2026-10-03 review H1: codex has no budget flag — enforced externally (kill timer),
   * exit code 124 on timeout, so a hung turn can no longer wedge the tenant forever. */
  timeoutMs?: number;
  extraArgs?: string[];
  env?: Record<string, string | undefined>;
  /** QA-07 parity (2026-10-03 review H1): register the live process for cancel/delete. */
  onSpawn?: (proc: { kill: (code?: number) => void }) => void;
  /** 2026-10-03 sibling-turns design (D5): docker-isolated turn — wraps the CLI in an
   * ephemeral sibling container via the shared turnSpawnArgv builder. */
  container?: HermesSpawnOptions["container"];
  /** Secret provider key (bare `-e NAME`; the value rides the docker CLI env). */
  providerKeyEnv?: { name: string; value: string };
}

export function codexArgs(o: CodexSpawnOptions): string[] {
  const args = [...(o.binPrefix ?? []), o.codexBin, "exec"];
  if (o.threadId) {
    args.push("resume", o.threadId);
  }
  args.push("--json", o.message);
  args.push(...(o.extraArgs ?? []));
  return args;
}

export function parseCodexLine(line: string): HermesEvent | null {
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
  if (rec.type === "thread.started" && typeof rec.thread_id === "string") {
    return { type: "system", subtype: "init", session_id: rec.thread_id, raw: rec };
  }
  if (rec.type === "item.completed" && typeof rec.item === "object" && rec.item !== null) {
    const item = rec.item as Record<string, unknown>;
    if (item.type === "agent_message" && typeof item.text === "string") {
      return { type: "text", text: item.text, raw: rec };
    }
    if (item.type === "error") {
      return { type: "text", text: `⚠ ${item.message ?? "codex item error"}`, raw: rec };
    }
    return { type: "codex_item", raw: rec };
  }
  if (rec.type === "turn.completed") {
    const usage = (rec.usage ?? {}) as Record<string, unknown>;
    return {
      type: "result",
      exit_code: 0,
      text: "",
      tokens: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        total: usage.total_tokens,
      },
      raw: rec,
    };
  }
  if (rec.type === "error" && typeof rec.message === "string") {
    return { type: "raw", line: trimmed, error: rec.message };
  }
  return { type: "raw", line: trimmed };
}

export async function runCodexTurn(
  o: CodexSpawnOptions,
  onEvent?: (evt: HermesEvent) => void,
): Promise<HermesTurnResult> {
  // 2026-10-03 sibling-turns design (D5): container mode wraps the same inner argv in the
  // shared docker-run builder (project + codex-home mounts, CODEX_HOME, provider key via
  // bare -e).
  const argv = o.container
    ? turnSpawnArgv({
        entrypointBin: "codex",
        innerArgs: codexArgs(o),
        container: o.container,
        projectSource: o.container.hostProjectDir ?? o.projectDir,
        homeLeaf: "codex-home",
        homeSource: o.container.hostRuntimeHome ?? "",
        envPairs: ["CODEX_HOME=/work/codex-home"],
        providerKeyEnv: o.providerKeyEnv,
      })
    : codexArgs(o);
  const proc = Bun.spawn(argv, {
    cwd: o.container ? undefined : o.projectDir,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: o.container
      ? dockerCliEnv(o.providerKeyEnv, o.env ?? process.env)
      : allowlistedEnv(o.env ?? process.env),
  });
  o.onSpawn?.(o.container ? containerKillHandle(proc, o.container) : proc);

  // External watchdog (2026-10-03 review H1).
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
    const evt = parseCodexLine(line);
    if (!evt) return;
    if (evt.type === "system" && typeof evt.session_id === "string") {
      sessionId = evt.session_id;
    } else if (evt.type === "text" && typeof evt.text === "string") {
      finalText += evt.text;
    } else if (evt.type === "result") {
      result = evt;
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
    exitCode: timedOut ? 124 : exitCode === 0 ? 0 : (result?.exit_code as number) ?? exitCode,
    sessionId,
    finalText,
    result,
    tokens: { input: n(rawTokens.input), output: n(rawTokens.output), total: n(rawTokens.total) },
    stderrTail: stderr.slice(-2000),
  };
}
