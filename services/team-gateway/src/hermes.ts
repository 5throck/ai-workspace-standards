/**
 * Headless Hermes session bridge (ADR-0092 D3): `hermes chat -q --format stream-json`.
 *
 * Wire protocol, verified against the installed CLI source (hermes_cli/stream_json.py) — one
 * JSON object per stdout line, each carrying "timestamp":
 *   {"type":"system","subtype":"init","model":...,"session_id":...}
 *   {"type":"text","text":"..."}
 *   {"type":"tool_use","name":...,"tool_call_id"?,"input"?}
 *   {"type":"tool_result","name":...,"output","duration_ms","is_error"}
 *   {"type":"result","session_id","exit_code","text","tokens":{...},"duration_ms","error"?}   (terminal)
 * The parser is defensive: non-JSON lines and unknown types surface as `raw` events instead of
 * aborting the stream.
 */

export interface HermesEvent {
  type: string;
  [key: string]: unknown;
}

export function parseHermesLine(line: string): HermesEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const obj: unknown = JSON.parse(trimmed);
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      return obj as HermesEvent;
    }
    return { type: "raw", line: trimmed };
  } catch {
    return { type: "raw", line: trimmed };
  }
}

export interface HermesSpawnOptions {
  hermesBin: string;
  projectDir: string;
  hermesHome: string;
  message: string;
  /** Named conversation thread for this tenant (`--continue NAME --create-if-missing`):
   * deterministic "send to this thread, making it if needed" semantics. A named thread is
   * used instead of `--resume latest` because the MRU lookup only covers the CLI source
   * family (run_agent.CLI_FAMILY_SOURCES) and skips non-default sources. */
  sessionName: string;
  runBudgetSeconds: number;
  maxTurns: number;
  extraArgs?: string[];
  env?: Record<string, string | undefined>;
}

export function hermesArgs(o: HermesSpawnOptions): string[] {
  const args = [
    o.hermesBin,
    "chat",
    "--format",
    "stream-json",
    "--in",
    o.projectDir,
    "--continue",
    o.sessionName,
    "--create-if-missing",
    "--accept-hooks",
    "--max-turns",
    String(o.maxTurns),
    "--run-budget",
    String(o.runBudgetSeconds),
    "--query-file",
    "-",
  ];
  args.push(...(o.extraArgs ?? []));
  return args;
}

/** Per-tenant isolation: HERMES_HOME points at the tenant home so config, credentials, and the
 * session store (state.db) never cross tenants (ADR-0092 D5/D6). */
export function hermesEnv(o: HermesSpawnOptions, base: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  return { ...base, HERMES_HOME: o.hermesHome, HERMES_ACCEPT_HOOKS: "1" };
}

export interface HermesTurnResult {
  exitCode: number | null;
  sessionId?: string;
  finalText: string;
  result?: HermesEvent;
  /** Token counts from the terminal result envelope (chat runs emit no separate usage report —
   * `--usage-file` is a top-level `-z`-mode feature that does not propagate to `chat`). */
  tokens?: Record<string, unknown>;
  stderrTail: string;
}

/** Run one conversation turn. `onEvent` receives every parsed JSONL event as it arrives
 * (streaming); the returned summary carries the terminal result and token counts. */
export async function runHermesTurn(
  o: HermesSpawnOptions,
  onEvent?: (evt: HermesEvent) => void,
): Promise<HermesTurnResult> {
  const proc = Bun.spawn(hermesArgs(o), {
    cwd: o.projectDir,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: hermesEnv(o, o.env ?? process.env),
  });
  proc.stdin.write(o.message);
  proc.stdin.end();

  let sessionId: string | undefined;
  let result: HermesEvent | undefined;
  let finalText = "";
  let buffer = "";
  const decoder = new TextDecoder();
  const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();

  const handleLine = (line: string) => {
    const evt = parseHermesLine(line);
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

  if (result && typeof result.text === "string" && result.text) finalText = result.text;
  const tokens =
    result && typeof result.tokens === "object" && result.tokens !== null
      ? (result.tokens as Record<string, unknown>)
      : undefined;

  return {
    exitCode,
    sessionId,
    finalText,
    result,
    tokens,
    stderrTail: stderr.slice(-2000),
  };
}
