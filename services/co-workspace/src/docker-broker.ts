/**
 * Docker socket broker for CO_WORKSPACE_ISOLATION=docker (T-20260930-027, design B.1).
 *
 * A RAW TCP front end (Bun.listen) in front of the Docker unix socket. The earlier
 * Bun.serve + fetch broker could not carry `attach` (hijacked stream, half-close) and let a
 * compromised gateway smuggle requests. This version:
 *   - accepts exactly ONE request per client connection, parsed strictly (16 KiB head cap,
 *     head/body timeouts, no Transfer-Encoding, no duplicate headers, no obs-fold, no bare CR/LF);
 *     client bytes beyond the declared body of that one request are never forwarded;
 *   - decides every request with the pure policy module (docker-broker-policy.ts): endpoint
 *     allowlist (no inspect, no resize), query allowlist, create-body allowlist with a canonical
 *     rebuild (the raw body is never forwarded), lstat walk of the bind sources;
 *   - resolves every container ref with an INTERNAL inspect (never relayed) and only forwards
 *     containers named co-workspace-turn-* that carry this instance's label, rewritten to the
 *     full 64-hex Id; re-checks the binds on disk right before /start;
 *   - rebuilds every upstream request head from scratch (client headers are never forwarded).
 * Residual risk: a compromised gateway can still race the symlink check between /start's
 * re-check and the daemon's mount (TOCTOU); rootless Docker or userns-remap is the only full fix.
 *
 * Run (same gateway image, command override in docker-compose.isolation.yml):
 *   bun src/docker-broker.ts
 *
 * Env: CO_WORKSPACE_BROKER_PORT (2375), CO_WORKSPACE_BROKER_SOCKET (/var/run/docker.sock),
 * CO_WORKSPACE_BROKER_MAX_CONN (64), plus the policy inputs read by loadPolicyConfig
 * (CO_WORKSPACE_RUNTIME_IMAGE, CO_WORKSPACE_DATA_DIR_HOST, CO_WORKSPACE_INSTANCE_ID, HERMES_BIN,
 * CO_WORKSPACE_CONTAINER_MEMORY / _CPUS / _PIDS_LIMIT).
 */

import type { Socket, TCPSocketListener } from "bun";
import {
  checkRoute,
  loadPolicyConfig,
  MAX_CREATE_BODY_BYTES,
  NAME_RE,
  semanticEqual,
  SUBPATH_BASE_RE,
  validateBindsOnDisk,
  validateCreate,
  filterContainerList,
  type PolicyConfig,
  type RouteDecision,
} from "./docker-broker-policy";

export interface BrokerConfig {
  policy: PolicyConfig;
  socketPath: string;
  port: number;
  hostname: string;
  maxConn: number;
  headTimeoutMs: number;
  bodyTimeoutMs: number;
  /** Timeout for buffered and piped upstream exchanges (not wait, not attach). */
  upstreamTimeoutMs: number;
  /** Defense in depth for the /coworkspace/volume control route (T-20260930-038): when set,
   * requests must carry X-Co-Workspace-Token with this exact value. The internal dockerapi
   * network is the primary control; the token is optional extra hardening. */
  brokerToken?: string;
  /** Image for the broker-internal volume init/rm helper containers (pinned by digest in
   * docker-compose.volume.yml). */
  volumeInitImage: string;
  log: (line: string) => void;
}

export function loadBrokerConfig(env: Record<string, string | undefined> = process.env): BrokerConfig {
  const maxConn = Number(env.CO_WORKSPACE_BROKER_MAX_CONN ?? 64);
  return {
    policy: loadPolicyConfig(env),
    socketPath: env.CO_WORKSPACE_BROKER_SOCKET || "/var/run/docker.sock",
    port: Number(env.CO_WORKSPACE_BROKER_PORT ?? 2375),
    hostname: "0.0.0.0",
    maxConn: Number.isInteger(maxConn) && maxConn > 0 ? maxConn : 64,
    volumeInitImage: env.CO_WORKSPACE_VOLUME_INIT_IMAGE || "alpine:3.20",
    brokerToken: env.CO_WORKSPACE_BROKER_TOKEN || undefined,
    headTimeoutMs: 10_000,
    bodyTimeoutMs: 10_000,
    upstreamTimeoutMs: 30_000,
    log: (line) => console.log(`[docker-broker] ${line}`),
  };
}

const MAX_HEAD_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
/** Pause the producing side when the consumer's write queue exceeds this. */
const HIGH_WATER = 1024 * 1024;
const HEX64_RE = /^[0-9a-f]{64}$/;
const CRLF2 = Buffer.from("\r\n\r\n");

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  403: "Forbidden",
  404: "Not Found",
  408: "Request Timeout",
  413: "Payload Too Large",
  431: "Request Header Fields Too Large",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

// ---------------------------------------------------------------------------------------------
// Strict request-head parsing
// ---------------------------------------------------------------------------------------------

interface ParsedHead {
  method: string;
  target: string;
  /** Lower-case header names; duplicates are rejected during parsing. */
  headers: Record<string, string>;
  contentLength: number;
}

type HeadResult = { ok: true; head: ParsedHead } | { ok: false; status: number; reason: string };

const REQUEST_LINE_RE = /^(GET|HEAD|POST|DELETE) (\S+) HTTP\/1\.1$/;
const HEADER_RE = /^([A-Za-z0-9-]+):[ \t]*(.*?)[ \t]*$/;
// Visible ASCII, space and tab only in header values.
const HEADER_VALUE_RE = /^[\t\x20-\x7e]*$/;

export function parseRequestHead(text: string): HeadResult {
  const lines = text.split("\r\n");
  for (const l of lines) {
    if (l.includes("\r") || l.includes("\n")) return { ok: false, status: 400, reason: "bare CR or LF in head" };
  }
  const rl = lines[0].match(REQUEST_LINE_RE);
  if (!rl) return { ok: false, status: 400, reason: "malformed request line" };
  const headers: Record<string, string> = {};
  for (const l of lines.slice(1)) {
    if (l.startsWith(" ") || l.startsWith("\t")) return { ok: false, status: 400, reason: "obs-fold header" };
    const m = l.match(HEADER_RE);
    if (!m) return { ok: false, status: 400, reason: "malformed header" };
    const name = m[1].toLowerCase();
    if (!HEADER_VALUE_RE.test(m[2])) return { ok: false, status: 400, reason: "control character in header" };
    if (Object.prototype.hasOwnProperty.call(headers, name)) return { ok: false, status: 400, reason: `duplicate header ${name}` };
    headers[name] = m[2];
  }
  if (headers["transfer-encoding"] !== undefined) return { ok: false, status: 400, reason: "transfer-encoding not allowed" };
  let contentLength = 0;
  const cl = headers["content-length"];
  if (cl !== undefined) {
    if (!/^\d{1,6}$/.test(cl)) return { ok: false, status: 400, reason: "invalid content-length" };
    contentLength = Number(cl);
  }
  return { ok: true, head: { method: rl[1], target: rl[2], headers, contentLength } };
}

// ---------------------------------------------------------------------------------------------
// Backpressure-aware writer
// ---------------------------------------------------------------------------------------------

type AnySocket = Socket<unknown>;

class Writer {
  private queue: Buffer[] = [];
  private queued = 0;
  private finish: "none" | "end" | "shutdown" = "none";
  onLow?: () => void;
  constructor(private readonly sock: AnySocket) {}

  get backlog(): number {
    return this.queued;
  }

  write(data: Uint8Array): void {
    if (this.finish !== "none" || data.length === 0) return;
    if (this.queued > 0) {
      this.push(Buffer.from(data));
      return;
    }
    const n = this.sock.write(data);
    if (n < data.length) this.push(Buffer.from(data.subarray(Math.max(n, 0))));
  }

  private push(b: Buffer): void {
    this.queue.push(b);
    this.queued += b.length;
  }

  /** Called from the socket's drain handler. */
  drain(): void {
    while (this.queue.length) {
      const b = this.queue[0];
      const n = this.sock.write(b);
      if (n < b.length) {
        this.queue[0] = b.subarray(Math.max(n, 0));
        this.queued -= Math.max(n, 0);
        return;
      }
      this.queue.shift();
      this.queued -= b.length;
    }
    if (this.queued < HIGH_WATER) this.onLow?.();
    this.applyFinish();
  }

  /** Flush then half-close (FIN) the write side; reading continues. */
  shutdown(): void {
    if (this.finish === "none") this.finish = "shutdown";
    if (this.queued === 0) this.applyFinish();
  }

  /** Flush then close. */
  end(): void {
    this.finish = "end";
    if (this.queued === 0) this.applyFinish();
  }

  private applyFinish(): void {
    if (this.queued > 0) return;
    if (this.finish === "shutdown") this.sock.shutdown();
    else if (this.finish === "end") this.sock.end();
  }
}

// ---------------------------------------------------------------------------------------------
// Broker
// ---------------------------------------------------------------------------------------------

interface CacheEntry {
  name: string;
  /** Binds recorded at create (only known for containers created through this broker process). */
  binds?: string[];
  /** Canonical mounts recorded at create (volume mode, T-20260930-038). */
  mounts?: unknown[];
}

type Phase = "head" | "body" | "busy" | "relay" | "tunnel" | "done";

interface ClientState {
  phase: Phase;
  buf: Buffer;
  head?: ParsedHead;
  decision?: Extract<RouteDecision, { allowed: true }>;
  started: number;
  timer?: ReturnType<typeof setTimeout>;
  writer: Writer;
  upstream?: AnySocket;
  upWriter?: Writer;
  counted: boolean;
  logged: boolean;
  clientEnded: boolean;
  upstreamEnded: boolean;
}

export interface BrokerHandle {
  port: number;
  stop(): Promise<void>;
}

export function startBroker(cfg: BrokerConfig): BrokerHandle {
  const cache = new Map<string, CacheEntry>();
  const clients = new Set<AnySocket>();
  const upstreams = new Set<AnySocket>();
  let active = 0;

  const st = (c: AnySocket) => c.data as ClientState;

  function logLine(s: ClientState, verdict: string, reason: string): void {
    if (s.logged) return;
    s.logged = true;
    const method = s.head?.method ?? "-";
    const norm = s.decision?.norm ?? "-";
    cfg.log(`${method} ${norm} ${verdict} ${reason.replace(/\s+/g, "_") || "-"} ${Date.now() - s.started}ms`);
  }

  function clearTimer(s: ClientState): void {
    if (s.timer) clearTimeout(s.timer);
    s.timer = undefined;
  }

  function closeAll(c: AnySocket): void {
    const s = st(c);
    s.phase = "done";
    clearTimer(s);
    try {
      s.upstream?.end();
    } catch {
      /* already closed */
    }
    try {
      c.end();
    } catch {
      /* already closed */
    }
  }

  function respond(c: AnySocket, status: number, message: string, verdict = "deny"): void {
    const s = st(c);
    logLine(s, verdict, message);
    clearTimer(s);
    s.phase = "done";
    const body = status === 204 ? "" : JSON.stringify({ message: `docker broker: ${message}` });
    const isHead = s.head?.method === "HEAD";
    const head =
      `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? "Error"}\r\n` +
      `Content-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n`;
    s.writer.write(Buffer.from(isHead ? head : head + body));
    s.writer.end();
    try {
      s.upstream?.end();
    } catch {
      /* ignore */
    }
  }

  function respondRaw(c: AnySocket, status: number, statusText: string, contentType: string, apiVersion: string | null, body: Buffer): void {
    const s = st(c);
    clearTimer(s);
    s.phase = "done";
    const safeText = /^[\x20-\x7e]{0,64}$/.test(statusText) && statusText ? statusText : STATUS_TEXT[status] ?? "OK";
    let head = `HTTP/1.1 ${status} ${safeText}\r\n`;
    if (contentType && /^[\x20-\x7e]{1,128}$/.test(contentType)) head += `Content-Type: ${contentType}\r\n`;
    if (apiVersion && /^[0-9.]{1,8}$/.test(apiVersion)) head += `Api-Version: ${apiVersion}\r\n`;
    const noBody = s.head?.method === "HEAD" || status === 204 || status === 304;
    head += `Content-Length: ${noBody ? 0 : body.length}\r\nConnection: close\r\n\r\n`;
    s.writer.write(Buffer.from(head));
    if (!noBody) s.writer.write(body);
    s.writer.end();
  }

  /** Rebuilt upstream head: never forwards client headers except sanitized UA / content type. */
  function upstreamHead(method: string, path: string, h: Record<string, string>, bodyLen: number, upgrade: boolean): string {
    const ua = h["user-agent"] && /^[\x20-\x7e]{1,256}$/.test(h["user-agent"]) ? h["user-agent"] : "co-workspace-docker-broker";
    let head = `${method} ${path} HTTP/1.1\r\nHost: docker\r\nUser-Agent: ${ua}\r\n`;
    const ct = h["content-type"];
    if (ct && /^[A-Za-z0-9!#$%&'*+.^_`|~/-]{1,100}(;[\x20-\x7e]{0,100})?$/.test(ct)) head += `Content-Type: ${ct}\r\n`;
    if (method === "POST" || bodyLen > 0) head += `Content-Length: ${bodyLen}\r\n`;
    head += upgrade ? "Connection: Upgrade\r\nUpgrade: tcp\r\n\r\n" : "Connection: close\r\n\r\n";
    return head;
  }

  async function upstreamFetch(path: string, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
    const { timeoutMs, ...rest } = init;
    return fetch(`http://docker${path}`, {
      ...rest,
      unix: cfg.socketPath,
      signal: AbortSignal.timeout(timeoutMs ?? cfg.upstreamTimeoutMs),
    } as RequestInit);
  }

  async function readCapped(res: Response): Promise<Buffer | null> {
    if (!res.body) return Buffer.alloc(0);
    const reader = res.body.getReader();
    const parts: Buffer[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      parts.push(Buffer.from(value));
    }
    return Buffer.concat(parts);
  }

  function forwardQuery(rawQuery: string): string {
    const q = new URLSearchParams(rawQuery).toString();
    return q ? `?${q}` : "";
  }

  function forgetRef(ref: string): void {
    for (const [id, e] of cache) if (id.startsWith(ref) || e.name === ref) cache.delete(id);
  }

  type Resolved =
    | { ok: true; id: string; name: string; binds: unknown; mounts: unknown }
    | { ok: false; status: number; reason: string };

  /** Internal inspect; the daemon's answer is never relayed to the client. */
  async function resolveRef(versionPrefix: string, ref: string): Promise<Resolved> {
    let res: Response;
    try {
      res = await upstreamFetch(`${versionPrefix}/containers/${encodeURIComponent(ref)}/json`, { method: "GET" });
    } catch {
      return { ok: false, status: 502, reason: "upstream unreachable" };
    }
    const body = await readCapped(res).catch(() => null);
    if (res.status === 404) {
      forgetRef(ref);
      return { ok: false, status: 404, reason: "no such container" };
    }
    if (res.status !== 200 || !body) return { ok: false, status: 502, reason: "container lookup failed" };
    let info: any;
    try {
      info = JSON.parse(body.toString("utf8"));
    } catch {
      return { ok: false, status: 502, reason: "container lookup failed" };
    }
    const id = info?.Id;
    const rawName = info?.Name;
    if (typeof id !== "string" || !HEX64_RE.test(id)) return { ok: false, status: 502, reason: "container lookup failed" };
    if (typeof rawName !== "string" || !rawName.startsWith("/") || !NAME_RE.test(rawName.slice(1))) {
      return { ok: false, status: 403, reason: "container not managed by this gateway" };
    }
    const name = rawName.slice(1);
    const labels = info?.Config?.Labels;
    if (!labels || typeof labels !== "object" || labels["co-workspace.instance"] !== cfg.policy.instanceId) {
      return { ok: false, status: 403, reason: "container not managed by this gateway" };
    }
    if (NAME_RE.test(ref) ? ref !== name : !id.startsWith(ref)) {
      return { ok: false, status: 403, reason: "container ref mismatch" };
    }
    const prev = cache.get(id);
    cache.set(id, { name, binds: prev?.binds, mounts: prev?.mounts });
    return { ok: true, id, name, binds: info?.HostConfig?.Binds, mounts: info?.HostConfig?.Mounts };
  }

  async function handleCreate(c: AnySocket, d: Extract<RouteDecision, { allowed: true }>, body: Buffer): Promise<void> {
    const s = st(c);
    const verdict = validateCreate(body.toString("utf8"), cfg.policy, d.name!);
    if (!verdict.ok) return respond(c, 403, verdict.reason);
    // Volume mode (T-20260930-038): no host paths exist to walk - the daemon enforces subpath
    // containment inside the named volume, so the on-disk lstat walk is skipped entirely.
    if (cfg.policy.dataVolume === undefined) {
      const disk = validateBindsOnDisk(verdict.facts.binds, cfg.policy.dataDirHost);
      if (!disk.ok) return respond(c, 403, disk.reason);
    }

    let res: Response;
    try {
      res = await upstreamFetch(`${d.versionPrefix}${d.norm}${forwardQuery(d.rawQuery)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": s.head?.headers["user-agent"] ?? "co-workspace-docker-broker" },
        body: verdict.canonicalText,
      });
    } catch {
      return respond(c, 502, "upstream unreachable", "error");
    }
    const out = await readCapped(res).catch(() => null);
    if (!out) return respond(c, 502, "upstream response too large or failed", "error");
    if (res.status === 201) {
      try {
        const id = JSON.parse(out.toString("utf8"))?.Id;
        if (typeof id === "string" && HEX64_RE.test(id)) {
          cache.set(id, { name: d.name!, binds: verdict.facts.binds, mounts: verdict.facts.mounts });
        }
      } catch {
        /* relay anyway */
      }
    }
    logLine(s, "allow", `status_${res.status}`);
    respondRaw(c, res.status, res.statusText, res.headers.get("content-type") ?? "application/json", res.headers.get("api-version"), out);
  }

  async function handleList(c: AnySocket, d: Extract<RouteDecision, { allowed: true }>): Promise<void> {
    const s = st(c);
    let res: Response;
    try {
      res = await upstreamFetch(`${d.versionPrefix}${d.norm}${forwardQuery(d.rawQuery)}`, { method: "GET" });
    } catch {
      return respond(c, 502, "upstream unreachable", "error");
    }
    const out = await readCapped(res).catch(() => null);
    if (!out) return respond(c, 502, "upstream response too large or failed", "error");
    let body = out;
    if (res.status === 200) {
      try {
        body = Buffer.from(JSON.stringify(filterContainerList(JSON.parse(out.toString("utf8")), cfg.policy)));
      } catch {
        return respond(c, 502, "upstream list unparseable", "error");
      }
    }
    logLine(s, "allow", `status_${res.status}`);
    respondRaw(c, res.status, res.statusText, "application/json", res.headers.get("api-version"), body);
  }

  function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
  }

  function sameBinds(a: unknown, b: string[] | undefined): boolean {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  }

  /** Piped and upgrade routes: raw upstream connection with a rebuilt head. */
  async function handleStream(c: AnySocket, d: Extract<RouteDecision, { allowed: true }>): Promise<void> {
    const s = st(c);
    let path = `${d.versionPrefix}${d.norm}`;
    if (d.ref !== undefined) {
      const r = await resolveRef(d.versionPrefix, d.ref);
      if (s.phase === "done") return;
      if (!r.ok) return respond(c, r.status, r.reason, r.status === 502 ? "error" : "deny");
      if (d.op === "start") {
        if (cfg.policy.dataVolume !== undefined) {
          const recordedMounts = cache.get(r.id)?.mounts;
          if (!recordedMounts) return respond(c, 403, "start of a container not created through this broker");
          if (!semanticEqual(r.mounts, recordedMounts)) return respond(c, 403, "mounts changed since create");
        } else {
          const recorded = cache.get(r.id)?.binds;
          if (!recorded) return respond(c, 403, "start of a container not created through this broker");
          if (!sameBinds(r.binds, recorded)) return respond(c, 403, "binds changed since create");
          const disk = validateBindsOnDisk(recorded, cfg.policy.dataDirHost);
          if (!disk.ok) return respond(c, 403, disk.reason);
        }
      }
      if (d.op === "delete") cache.delete(r.id);
      const action = d.op === "delete" ? "" : `/${d.op}`;
      path = `${d.versionPrefix}/containers/${r.id}${action}`;
    }
    path += forwardQuery(d.rawQuery);
    const upgrade = d.mode === "upgrade";
    const headers = s.head!.headers;
    const upHead = upstreamHead(s.head!.method, path, upgrade ? { ...headers, "content-type": headers["content-type"] ?? "text/plain" } : headers, 0, upgrade);

    let upHeadBuf = Buffer.alloc(0);
    let upHeadDone = !upgrade;
    let up: AnySocket;
    try {
      up = await Bun.connect({
        unix: cfg.socketPath,
        allowHalfOpen: true,
        socket: {
          data(u, chunk) {
            if (s.phase === "done") return;
            if (!upHeadDone) {
              upHeadBuf = Buffer.concat([upHeadBuf, chunk]);
              const i = upHeadBuf.indexOf(CRLF2);
              if (i < 0) {
                if (upHeadBuf.length > MAX_HEAD_BYTES) {
                  logLine(s, "error", "upstream head too large");
                  closeAll(c);
                }
                return;
              }
              upHeadDone = true;
              const firstLine = upHeadBuf.subarray(0, upHeadBuf.indexOf("\r\n")).toString("latin1");
              if (/^HTTP\/1\.1 101 /.test(firstLine + " ")) {
                s.phase = "tunnel";
                logLine(s, "allow", "upgraded");
              } else {
                logLine(s, "allow", "upgrade_refused");
              }
              s.writer.write(upHeadBuf);
              upHeadBuf = Buffer.alloc(0);
            } else {
              s.writer.write(chunk);
            }
            if (s.writer.backlog > HIGH_WATER) u.pause();
          },
          drain() {
            s.upWriter?.drain();
          },
          end() {
            s.upstreamEnded = true;
            if (s.phase === "tunnel" && !s.clientEnded) {
              s.writer.shutdown();
            } else {
              clearTimer(s);
              s.phase = "done";
              s.writer.end();
              up?.end();
            }
          },
          close() {
            upstreams.delete(up);
            clearTimer(s);
            if (s.phase !== "done") {
              s.phase = "done";
              s.writer.end();
            }
          },
          error() {
            /* close follows */
          },
        },
      });
    } catch {
      return respond(c, 502, "upstream unreachable", "error");
    }
    upstreams.add(up);
    if (s.phase === "done") {
      up.end();
      return;
    }
    s.upstream = up;
    s.upWriter = new Writer(up);
    s.upWriter.onLow = () => c.resume();
    s.writer.onLow = () => up.resume();
    s.phase = "relay";
    if (!upgrade) logLine(s, "allow", d.op);
    s.upWriter.write(Buffer.from(upHead, "latin1"));
    if (d.op !== "wait" && !upgrade) {
      s.timer = setTimeout(() => {
        logLine(s, "error", "upstream timeout");
        closeAll(c);
      }, cfg.upstreamTimeoutMs);
    }
  }

  /** Parse + validate the POST /coworkspace/volume control body, then run the helper. */
  async function handleVolumeControl(c: AnySocket, body: Buffer): Promise<void> {
    const s = st(c);
    if (cfg.brokerToken !== undefined) {
      const tok = s.head?.headers["x-co-workspace-token"];
      if (tok !== cfg.brokerToken) return respond(c, 403, "volume control token mismatch");
    }
    if (cfg.policy.dataVolume === undefined) return respond(c, 403, "volume control route requires volume mode");
    let req: { op?: unknown; subpath?: unknown };
    try {
      req = JSON.parse(body.toString("utf8"));
    } catch {
      return respond(c, 400, "control body must be JSON");
    }
    if (!isPlainObject(req)) return respond(c, 400, "control body must be a JSON object");
    if (req.op !== "init" && req.op !== "rm") return respond(c, 400, "op must be init or rm");
    if (typeof req.subpath !== "string") return respond(c, 400, "subpath must be a string");
    if (req.subpath.includes("..") || req.subpath.startsWith("/")) return respond(c, 400, "subpath not allowed");
    // The gateway sends the tenant BASE (storage/<P>/<N>); the helper appends the project /
    // hermes-home leaves itself (design 2026-09-30, section 5). Leaf-carrying subpaths are the
    // create-body concern (SUBPATH_RE), not this control route's.
    if (!SUBPATH_BASE_RE.test(req.subpath)) return respond(c, 400, "subpath not allowed");
    logLine(s, "allow", `volume_${req.op}`);
    try {
      await runVolumeHelper(req.op, req.subpath);
    } catch (e) {
      return respond(c, 502, `volume helper failed: ${String((e as Error)?.message ?? e).slice(0, 300)}`, "error");
    }
    return respond(c, 204, "ok");
  }

  /**
   * Broker-internal volume helper (design 2026-09-30, section 5): create -> start -> wait ->
   * delete a short-lived alpine container that mkdir/chowns (init) or rm -rf (rm) a tenant
   * subpath inside the data volume. The name is deliberately outside NAME_RE, so the gateway
   * can never route it; the body is broker-constructed from the regex-validated subpath (its
   * charset contains no shell metacharacters) and the config image - no client bytes.
   *
   * LIVE-VERIFIED CONSTRAINT (dockerd 29.8.1): the daemon lstats VolumeOptions.Subpath at
   * START and refuses a mount whose subpath does not exist yet. The init helper therefore
   * mounts the volume ROOT (no Subpath) and creates the subpath itself; subpath mounts only
   * work after init. rm mounts the root for the same reason (and because the leaf dirs may
   * not exist). The helper is broker-spawned with fixed argv components, so the extra
   * volume-root visibility is within the broker's existing root-equivalent trust.
   */
  async function runVolumeHelper(op: "init" | "rm", subpath: string): Promise<void> {
    const name = `co-workspace-vol-control-${Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0")}`;
    const leaf = op === "init"
      ? "mkdir -p /v/" + subpath + "/project /v/" + subpath + "/hermes-home && chown -R 10000:10000 /v/" + subpath + " && chmod 700 /v/" + subpath
      : "rm -rf /v/" + subpath;
    const body = JSON.stringify({
      Image: cfg.volumeInitImage,
      Cmd: ["sh", "-c", leaf],
      Labels: { "co-workspace.volctl": "1" },
      HostConfig: {
        // Volume ROOT mount (no Subpath): the daemon lstats VolumeOptions.Subpath at start,
        // so a subpath mount would fail before mkdir could run (live-verified, 29.8.1).
        Mounts: [{ Type: "volume", Source: cfg.policy.dataVolume, Target: "/v" }],
      },
    });
    const mk = async (path: string, init: RequestInit): Promise<Response> => upstreamFetch(path, { timeoutMs: 60_000, ...init });
    const id = await (async () => {
      const res = await mk(`/containers/create?name=${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const out = await readCapped(res).catch(() => null);
      const parsed = out ? JSON.parse(out.toString("utf8")) : {};
      if (res.status !== 201 || typeof parsed?.Id !== "string") {
        throw new Error(`helper create failed (${res.status}): ${String(parsed?.message ?? "no body").slice(0, 200)}`);
      }
      return parsed.Id as string;
    })();
    try {
      const start = await mk(`/containers/${id}/start`, { method: "POST" });
      if (start.status !== 204) throw new Error(`helper start failed (${start.status})`);
      const wait = await mk(`/containers/${id}/wait`, { method: "POST" });
      const wout = await readCapped(wait).catch(() => null);
      const code = wout ? (JSON.parse(wout.toString("utf8"))?.StatusCode) : undefined;
      if (wait.status !== 200 || code !== 0) {
        // Best-effort stderr tail from the daemon's multiplexed log stream.
        let tail = `exit ${String(code)}`;
        try {
          const logs = await mk(`/containers/${id}/logs?stdout=1&stderr=1&tail=40`, { method: "GET" });
          const lout = await readCapped(logs).catch(() => null);
          if (lout) {
            // Strip 8-byte docker stream frame headers; non-TTY logs only (helper has no Tty).
            const parts: string[] = [];
            let off = 0;
            while (off + 8 <= lout.length) {
              const n = lout.readUInt32BE(off + 4);
              parts.push(lout.subarray(off + 8, Math.min(off + 8 + n, lout.length)).toString("utf8"));
              off += 8 + n;
            }
            tail += ": " + parts.join("").slice(-400);
          }
        } catch {
          /* tail is best effort */
        }
        throw new Error(`helper failed (${tail.slice(0, 480)})`);
      }
    } finally {
      await mk(`/containers/${id}?force=1&v=1`, { method: "DELETE" }).catch(() => {});
    }
  }

  async function dispatch(c: AnySocket, body: Buffer): Promise<void> {
    const s = st(c);
    const d = s.decision!;
    try {
      if (d.op === "create") await handleCreate(c, d, body);
      else if (d.op === "list") await handleList(c, d);
      else if (d.op === "volume") await handleVolumeControl(c, body);
      else if (d.op === "volinspect") await handleStream(c, d);
      else await handleStream(c, d);
    } catch (e) {
      if (s.phase !== "done") respond(c, 500, "internal error", "error");
    }
  }

  function onHeadComplete(c: AnySocket, headText: string, rest: Buffer): void {
    const s = st(c);
    const parsed = parseRequestHead(headText);
    if (!parsed.ok) return respond(c, parsed.status, parsed.reason);
    s.head = parsed.head;
    const decision = checkRoute(parsed.head.method, parsed.head.target, cfg.policy, parsed.head.headers);
    if (!decision.allowed) return respond(c, decision.status, decision.reason);
    s.decision = decision;
    const len = parsed.head.contentLength;
    if (decision.op === "create") {
      if (len > MAX_CREATE_BODY_BYTES) return respond(c, 413, "create body too large");
    } else if (decision.op === "volume") {
      if (len > MAX_CREATE_BODY_BYTES) return respond(c, 413, "control body too large");
    } else if (len !== 0) {
      return respond(c, 400, "request body not allowed on this route");
    }
    s.buf = rest;
    s.phase = "body";
    clearTimer(s);
    s.timer = setTimeout(() => respond(c, 408, "body timeout"), cfg.bodyTimeoutMs);
    onBodyData(c);
  }

  function onBodyData(c: AnySocket): void {
    const s = st(c);
    const len = s.head!.contentLength;
    if (s.buf.length > len) {
      logLine(s, "deny", "pipelined");
      closeAll(c);
      return;
    }
    if (s.buf.length < len) return;
    clearTimer(s);
    const body = s.buf;
    s.buf = Buffer.alloc(0);
    s.phase = "busy";
    void dispatch(c, body);
  }

  const listener: TCPSocketListener<ClientState> = Bun.listen<ClientState>({
    hostname: cfg.hostname,
    port: cfg.port,
    allowHalfOpen: true,
    socket: {
      open(c) {
        const s: ClientState = {
          phase: "head",
          buf: Buffer.alloc(0),
          started: Date.now(),
          writer: new Writer(c as AnySocket),
          counted: false,
          logged: false,
          clientEnded: false,
          upstreamEnded: false,
        };
        c.data = s;
        clients.add(c as AnySocket);
        if (active >= cfg.maxConn) {
          respond(c as AnySocket, 503, "too many connections", "limit");
          return;
        }
        active++;
        s.counted = true;
        s.timer = setTimeout(() => {
          if (s.phase === "head") respond(c as AnySocket, 408, "head timeout");
        }, cfg.headTimeoutMs);
      },
      data(c, chunk) {
        const s = c.data;
        const sock = c as AnySocket;
        switch (s.phase) {
          case "head": {
            s.buf = Buffer.concat([s.buf, chunk]);
            const i = s.buf.indexOf(CRLF2);
            if (i < 0) {
              if (s.buf.length > MAX_HEAD_BYTES) respond(sock, 431, "request head too large");
              return;
            }
            if (i > MAX_HEAD_BYTES) return respond(sock, 431, "request head too large");
            onHeadComplete(sock, s.buf.subarray(0, i).toString("latin1"), s.buf.subarray(i + 4));
            return;
          }
          case "body":
            s.buf = Buffer.concat([s.buf, chunk]);
            onBodyData(sock);
            return;
          case "tunnel":
            s.upWriter!.write(chunk);
            if (s.upWriter!.backlog > HIGH_WATER) sock.pause();
            return;
          case "done":
            return;
          default:
            // busy / relay: bytes beyond the one parsed request are never forwarded.
            logLine(s, "deny", "pipelined");
            closeAll(sock);
        }
      },
      drain(c) {
        c.data.writer.drain();
      },
      end(c) {
        const s = c.data;
        s.clientEnded = true;
        if (s.phase === "tunnel") {
          if (s.upstreamEnded) closeAll(c as AnySocket);
          else s.upWriter!.shutdown();
        } else if (s.phase === "head" || s.phase === "body") {
          clearTimer(s);
          s.phase = "done";
          c.end();
        }
        // busy / relay: the response is still sent to the half-closed client.
      },
      close(c) {
        const s = c.data;
        clients.delete(c as AnySocket);
        if (s?.counted) {
          s.counted = false;
          active--;
        }
        if (!s) return;
        clearTimer(s);
        if (s.phase !== "done") logLine(s, "abort", "client closed");
        s.phase = "done";
        try {
          s.upstream?.end();
        } catch {
          /* ignore */
        }
      },
      error() {
        /* close follows */
      },
    },
  });

  return {
    port: listener.port,
    async stop() {
      listener.stop(true);
      for (const u of upstreams) {
        try {
          u.end();
        } catch {
          /* ignore */
        }
      }
      for (const c of clients) {
        try {
          c.end();
        } catch {
          /* ignore */
        }
      }
      await Bun.sleep(0);
    },
  };
}

if (import.meta.main) {
  const cfg = loadBrokerConfig();
  const h = startBroker(cfg);
  cfg.log(
    `listening on ${cfg.hostname}:${h.port} -> unix:${cfg.socketPath} (instance ${cfg.policy.instanceId}, image ${cfg.policy.runtimeImage}, max ${cfg.maxConn} conns)`,
  );
}
