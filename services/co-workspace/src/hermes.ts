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
  /** Interpreter prefix for hermesBin — Windows CI passes ["bun"] so a plain .ts fake
   * binary can stand in for the real executable (shebang scripts are not directly
   * exec-able there). Production never sets it. */
  binPrefix?: string[];
  /** Static provider credential (design 2026-09-29-co-workspace-provider-key-config):
   * injected into the turn env under the resolved name (docker `-e` / process env) —
   * the name comes from resolveLlmProviderKey (OPENAI_API_KEY / ANTHROPIC_API_KEY /
   * GOOGLE_API_KEY). Hermes's provider config comes from the tenant config.yaml. */
  providerKeyEnv?: { name: string; value: string };
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
  /** Comma-separated toolsets passed as `-t` on every spawn (Phase 2 toolset scoping). */
  toolsets?: string;
  /** QA-07: called with the live child process so the server can cancel a running turn. */
  onSpawn?: (proc: { kill: (code?: number) => void }) => void;
  env?: Record<string, string | undefined>;
  /** Phase 2 isolation (design docs/designs/2026-09-27-co-workspace-phase2-hardening-design.md, D3): when set, the
   * session runs inside an ephemeral sibling container — only the tenant project dir and
   * Hermes home are mounted, at the fixed in-container paths /work/project, /work/hermes-home.
   * `hostProjectDir`/`hostHermesHome` override the `-v` source paths for the case where the
   * gateway itself runs inside a container (mount sources resolve on the HOST, so they must be
   * host-visible paths; defaults = the gateway-local paths, correct for bare-metal hosts). */
  container?: {
    image: string;
    hostProjectDir?: string;
    hostHermesHome?: string;
    hostAuthDir?: string;
    memory?: string;
    cpus?: string;
    pidsLimit?: number;
  };
  /** Shared Nous credential store (HERMES_SHARED_AUTH_DIR) — one token store across the
   * operator + all tenants, refreshed in place (ADR-0092 Addendum 4). */
  sharedAuthDir?: string;
}

const MOUNT_PROJECT = "/work/project";
const MOUNT_HERMES_HOME = "/work/hermes-home";
const MOUNT_SHARED_AUTH = "/work/shared-auth";

/** The inner Hermes command. `paths` lets the container adapter substitute mount points for
 * host paths (`--in`) while keeping a single command contract. */
export function hermesArgs(
  o: HermesSpawnOptions,
  paths: { projectDir?: string } = {},
): string[] {
  const args = [
    ...(o.binPrefix ?? []),
    o.hermesBin,
    "chat",
    "--format",
    "stream-json",
    "--in",
    paths.projectDir ?? o.projectDir,
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
  if (o.toolsets) args.push("-t", o.toolsets);
  args.push(...(o.extraArgs ?? []));
  return args;
}

/** Full spawn argv for the configured isolation mode (D3): process mode runs the inner command
 * directly; docker mode wraps it in an ephemeral sibling container (`docker run --rm -i`) with
 * only the tenant project dir and Hermes home mounted — nothing else is reachable. */
export function hermesSpawnArgv(o: HermesSpawnOptions): string[] {
  const inner = hermesArgs(o, o.container ? { projectDir: MOUNT_PROJECT } : {});
  if (!o.container) return inner;
  return [
    "docker",
    "run",
    "--rm",
    "--interactive",
    // SEC-10: resource caps + privilege hardening (network stays open — the runtime needs
    // provider egress; egress policy is the iron-proxy path).
    ...(o.container.memory ? ["--memory", o.container.memory] : []),
    ...(o.container.cpus ? ["--cpus", o.container.cpus] : []),
    ...(o.container.pidsLimit ? ["--pids-limit", String(o.container.pidsLimit)] : []),
    "--security-opt",
    "no-new-privileges",
    "--cap-drop",
    "ALL",
    // Run as the hermes image's unprivileged user: its entrypoint shim short-circuits for
    // non-root, so no SETUID caps are needed under the cap-drop above.
    "--user",
    "10000:10000",
    "--entrypoint",
    o.hermesBin,
    "--workdir",
    MOUNT_PROJECT,
    "-v",
    `${o.container.hostProjectDir ?? o.projectDir}:${MOUNT_PROJECT}`,
    "-v",
    `${o.container.hostHermesHome ?? o.hermesHome}:${MOUNT_HERMES_HOME}`,
    "-e",
    `HERMES_HOME=${MOUNT_HERMES_HOME}`,
    "-e",
    "HERMES_ACCEPT_HOOKS=1",
    ...(o.providerKeyEnv ? ["-e", o.providerKeyEnv.name] : []),
    ...(o.sharedAuthDir
      ? [
          "-v",
          `${o.container.hostAuthDir ?? o.sharedAuthDir}:${MOUNT_SHARED_AUTH}`,
          "-e",
          `HERMES_SHARED_AUTH_DIR=${MOUNT_SHARED_AUTH}`,
        ]
      : []),
    o.container.image,
    ...inner.slice(1), // drop the bin — it moved to --entrypoint
  ];
}

/** P2-4 (QA fair): spawned runtimes get an ALLOWLIST env — never the full gateway env, which
 * carries operator secrets (CO_WORKSPACE_API_KEYS etc.). Providers inherit their own prefixed
 * vars so each CLI reaches its own credentials. */
const ENV_ALLOW_EXACT = new Set([
  "PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "LC_ALL", "TZ", "TMPDIR",
  "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY",
  "GOOGLE_API_KEY", "GEMINI_API_KEY", // gemini provider keys (exact — the GOOGLE_ prefix is NOT allowed)
]);
const ENV_ALLOW_PREFIX = /^(HERMES_|ANTHROPIC_|OPENAI_|XDG_)/i;
/** Defense in depth: gateway-only secrets are denied even if a future prefix/exact change would
 * match them (GOOGLE_CLIENT_* is the gateway's SSO secret and must never reach spawned agents). */
const ENV_DENY = /^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOOGLE_REDIRECT_URI|CO_WORKSPACE_)/i;

export function allowlistedEnv(base: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined || ENV_DENY.test(k)) continue;
    if (ENV_ALLOW_EXACT.has(k) || ENV_ALLOW_PREFIX.test(k)) out[k] = v;
  }
  return out;
}

/** Per-tenant isolation: HERMES_HOME points at the tenant home so config, credentials, and the
 * session store (state.db) never cross tenants (ADR-0092 D5/D6) — EXCEPT the shared Nous
 * credential store, which every tenant points at so runtime refreshes stay valid everywhere
 * (ADR-0092 Addendum 4; per-tenant auth.json copies went stale and killed the shared refresh token). */
export function hermesEnv(o: HermesSpawnOptions, base: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    ...allowlistedEnv(base),
    HERMES_HOME: o.hermesHome,
    HERMES_ACCEPT_HOOKS: "1",
  };
  if (o.sharedAuthDir) env.HERMES_SHARED_AUTH_DIR = o.sharedAuthDir;
  if (o.providerKeyEnv) env[o.providerKeyEnv.name] = o.providerKeyEnv.value;
  return env;
}

/** Env of the `docker run` CLI process. The provider key is passed as a bare `-e NAME` in the
 * argv (never `NAME=value`, which leaks via ps / docker inspect of the CLI) and docker copies
 * it from THIS env — so it is injected explicitly, independent of the prefix allowlist. */
export function dockerCliEnv(o: HermesSpawnOptions, base: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const env = allowlistedEnv(base);
  // The docker CLI locates its daemon/config through DOCKER_* (HOST, CONTEXT, CONFIG, ...).
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && /^DOCKER_/.test(k)) env[k] = v;
  }
  if (o.providerKeyEnv) env[o.providerKeyEnv.name] = o.providerKeyEnv.value;
  return env;
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
  const proc = Bun.spawn(hermesSpawnArgv(o), {
    cwd: o.container ? undefined : o.projectDir,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: o.container
      ? dockerCliEnv(o, o.env ?? process.env)
      : hermesEnv(o, o.env ?? process.env),
  });
  o.onSpawn?.(proc); // QA-07: cancel support — the server can kill a running turn
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
