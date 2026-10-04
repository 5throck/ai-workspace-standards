/**
 * T-20260930-027: pure policy for the co-workspace Docker socket broker (design B.2).
 * No sockets, no Bun.serve, no process.env reads at import time. Decides:
 *   - which routes/queries may reach dockerd (checkRoute),
 *   - whether a /containers/create body is exactly the gateway's turn container (validateCreate),
 *     and rebuilds a canonical body ONLY from validated values,
 *   - whether bind sources are real directories under the data dir (validateBindsOnDisk),
 *   - which containers a list response may reveal (filterContainerList).
 */

import { lstatSync as fsLstatSync, realpathSync as fsRealpathSync } from "node:fs";
import { resolve as pathResolve } from "node:path";

// ---------------------------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------------------------

export interface PolicyConfig {
  runtimeImage: string;
  /** Host-side data dir (bind sources must live under `<dataDirHost>/storage`). Undefined = every create is rejected. */
  dataDirHost?: string;
  /** Named tenant data volume (T-20260930-038 volume-subpath mode). Set = volume mode: the
   * broker validates HostConfig.Mounts instead of Binds and skips the on-disk lstat walk
   * (the daemon enforces subpath containment). Exactly one of dataDirHost/dataVolume storage
   * validations is active per boot. */
  dataVolume?: string;
  instanceId: string;
  hermesBin: string;
  memoryCapBytes: number;
  cpuCap: number;
  pidsCap: number;
}

export const NAME_PREFIX = "co-workspace-turn-";
/** Matches hermes.ts turnContainerName(): prefix + sanitized tenant (<=36) + "-" + 8 hex. */
export const NAME_RE = /^co-workspace-turn-[A-Za-z0-9_.-]{1,36}-[0-9a-f]{8}$/;
const HEX_ID_RE = /^[0-9a-f]{12,64}$/;
const TENANT_RE = /^[A-Za-z0-9_.-]{1,128}$/;
const PN_RE = /^(?!\.{1,2}$)[A-Za-z0-9@._+-]{1,128}$/;
/** Docker's own volume-name charset (design 2026-09-30, section 2). */
export const VOLUME_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;
/**
 * Tenant storage subpath inside the data volume: storage/<P>/<N>/(project|hermes-home|claude-home|codex-home).
 * <P>/<N> reuse PN_RE. The regex alone rejects "..", ".", absolute, empty, backslash and any
 * traversal shape; callers additionally deny ".." / leading "/" for an explicit log reason.
 * (2026-10-03 sibling-turns design D3: the non-hermes runtime homes joined the leaf set.)
 */
export const SUBPATH_RE =
  /^storage\/((?!\.{1,2}$)[A-Za-z0-9@._+-]{1,128})\/((?!\.{1,2}$)[A-Za-z0-9@._+-]{1,128})\/(project|hermes-home|claude-home|codex-home)$/;
/** Tenant subpath BASE inside the data volume (storage/<P>/<N>): the form the gateway sends to
 * the /coworkspace/volume control route; the helper appends the leaves itself. */
export const SUBPATH_BASE_RE =
  /^storage\/((?!\.{1,2}$)[A-Za-z0-9@._+-]{1,128})\/((?!\.{1,2}$)[A-Za-z0-9@._+-]{1,128})$/;

export const MAX_CREATE_BODY_BYTES = 64 * 1024;
const MAX_JSON_DEPTH = 32;
const MAX_FILTERS_LEN = 4096;
const PROVIDER_KEY_ENVS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "ZAI_API_KEY"];
/** 2026-10-04: claude provider-key turns inject ANTHROPIC_AUTH_TOKEN alongside
 * ANTHROPIC_API_KEY (bearer-gateway support) — same credential, so it does not
 * count toward the one-provider-key limit. */
const PROVIDER_TOKEN_ENVS = ["ANTHROPIC_AUTH_TOKEN"];
const MOUNT_PROJECT = "/work/project";
const MOUNT_HERMES_HOME = "/work/hermes-home";

/** 2026-10-03 sibling-turns design (D1/D2): the runtime profiles an isolated turn may run,
 * keyed by the create body's Entrypoint[0]. Single source for the broker's validation AND
 * the gateway's spawn argv — the two MUST agree. Each profile fixes the per-tenant home
 * leaf, its in-container mount path, and the required (fixed-value) env pairs; values are
 * never client-supplied. `agy` is deliberately absent: the antigravity CLI is login-only
 * and has no verifiable Linux artifact (cli-provider-key design). */
export const RUNTIME_TURN_PROFILES: Record<string, {
  homeLeaf: "hermes-home" | "claude-home" | "codex-home";
  mount: string;
  requiredEnv: Record<string, string>;
}> = {
  hermes: { homeLeaf: "hermes-home", mount: "/work/hermes-home", requiredEnv: { HERMES_HOME: "/work/hermes-home", HERMES_ACCEPT_HOOKS: "1" } },
  claude: { homeLeaf: "claude-home", mount: "/work/claude-home", requiredEnv: { CLAUDE_CONFIG_DIR: "/work/claude-home" } },
  codex: { homeLeaf: "codex-home", mount: "/work/codex-home", requiredEnv: { CODEX_HOME: "/work/codex-home" } },
};

/** Optional claude-only env: the custom Anthropic-compatible endpoint. Validated as a
 * strict https URL (no whitespace/quotes/backslashes, bounded length) — it is not secret
 * and reaches the create body as a literal NAME=value pair. */
export function isValidRuntimeBaseUrl(v: string): boolean {
  return /^https:\/\/[^\s"'\\]{1,293}$/.test(v);
}

/** Docker memory string ("2g", "512m", "1024k", "1073741824", "1.5g") -> bytes (x1024 units). NaN when invalid. */
export function parseDockerMemory(str: string): number {
  const m = str.match(/^\s*(\d+(?:\.\d+)?)\s*([bkmgt]?)b?\s*$/i);
  if (!m) return NaN;
  const mult: Record<string, number> = { "": 1, b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 };
  return Math.floor(Number(m[1]) * mult[m[2].toLowerCase()]);
}

function numOr0(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Mirrors the gateway defaults in src/config.ts. Throws on an unparseable memory/cpu cap (fail closed at boot). */
export function loadPolicyConfig(env: Record<string, string | undefined>): PolicyConfig {
  const memStr = env.CO_WORKSPACE_CONTAINER_MEMORY ?? "2g";
  const memoryCapBytes = parseDockerMemory(memStr);
  if (!Number.isFinite(memoryCapBytes) || memoryCapBytes <= 0) {
    throw new Error(`invalid CO_WORKSPACE_CONTAINER_MEMORY: ${memStr}`);
  }
  const cpuStr = env.CO_WORKSPACE_CONTAINER_CPUS ?? "2";
  const cpuCap = Number(cpuStr);
  if (!Number.isFinite(cpuCap) || cpuCap <= 0) throw new Error(`invalid CO_WORKSPACE_CONTAINER_CPUS: ${cpuStr}`);
  const dataDirHost = env.CO_WORKSPACE_DATA_DIR_HOST || undefined;
  const dataVolume = env.CO_WORKSPACE_DATA_VOLUME || undefined;
  if (dataVolume && !VOLUME_NAME_RE.test(dataVolume)) {
    throw new Error(`invalid CO_WORKSPACE_DATA_VOLUME: ${dataVolume}`);
  }
  return {
    runtimeImage: env.CO_WORKSPACE_RUNTIME_IMAGE ?? "co-workspace-runtime:latest",
    dataDirHost: dataDirHost ? stripTrailingSlash(dataDirHost) : undefined,
    dataVolume,
    instanceId: env.CO_WORKSPACE_INSTANCE_ID || "default",
    hermesBin: env.HERMES_BIN || "hermes",
    memoryCapBytes,
    cpuCap,
    pidsCap: numOr0(env.CO_WORKSPACE_CONTAINER_PIDS_LIMIT) || 256,
  };
}

function stripTrailingSlash(p: string): string {
  let s = p;
  while (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

// ---------------------------------------------------------------------------------------------
// Strict JSON scanner
// ---------------------------------------------------------------------------------------------

export type ScanResult = { ok: true; value: unknown } | { ok: false; reason: string };

class ScanError extends Error {}

/**
 * Validates `text` as JSON with a small recursive-descent tokenizer, rejecting any object that
 * has duplicate keys or keys equal ignoring case (after escape decoding), plus depth/size guards.
 * JSON.parse alone collapses duplicates (last wins), which lets a smuggled second key bypass checks.
 */
export function scanJson(text: string, maxBytes = MAX_CREATE_BODY_BYTES, maxDepth = MAX_JSON_DEPTH): ScanResult {
  if (Buffer.byteLength(text, "utf8") > maxBytes) return { ok: false, reason: "body too large" };
  let i = 0;
  const n = text.length;
  const ws = () => {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) i++;
      else break;
    }
  };
  const fail = (msg: string): never => {
    throw new ScanError(`invalid JSON: ${msg} at ${i}`);
  };
  const ESC: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
  const str = (): string => {
    if (text[i] !== '"') fail("expected string");
    i++;
    let out = "";
    while (true) {
      if (i >= n) fail("unterminated string");
      const ch = text[i];
      if (ch === '"') {
        i++;
        return out;
      }
      if (text.charCodeAt(i) < 0x20) fail("control character in string");
      if (ch === "\\") {
        const e = text[i + 1];
        if (e === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("bad unicode escape");
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else if (e !== undefined && Object.prototype.hasOwnProperty.call(ESC, e)) {
          out += ESC[e];
          i += 2;
        } else {
          fail("bad escape");
        }
      } else {
        out += ch;
        i++;
      }
    }
  };
  const num = () => {
    const m = text.slice(i, i + 64).match(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/);
    if (!m) fail("bad number");
    i += m![0].length;
  };
  const lit = (word: string) => {
    if (text.startsWith(word, i)) i += word.length;
    else fail("unexpected token");
  };
  const value = (depth: number, path: string) => {
    if (depth > maxDepth) throw new ScanError("JSON nesting too deep");
    ws();
    const ch = text[i];
    if (ch === "{") {
      i++;
      const seen = new Set<string>();
      ws();
      if (text[i] === "}") {
        i++;
        return;
      }
      while (true) {
        ws();
        const key = str();
        const p = path ? `${path}.${key}` : key;
        if (seen.has(key.toLowerCase())) throw new ScanError(`duplicate key ${p}`);
        seen.add(key.toLowerCase());
        ws();
        if (text[i] !== ":") fail("expected ':'");
        i++;
        value(depth + 1, p);
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return;
        }
        fail("expected ',' or '}'");
      }
    } else if (ch === "[") {
      i++;
      ws();
      if (text[i] === "]") {
        i++;
        return;
      }
      let idx = 0;
      while (true) {
        value(depth + 1, `${path}[${idx++}]`);
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return;
        }
        fail("expected ',' or ']'");
      }
    } else if (ch === '"') {
      str();
    } else if (ch === "t") lit("true");
    else if (ch === "f") lit("false");
    else if (ch === "n") lit("null");
    else if (ch === "-" || (ch !== undefined && ch >= "0" && ch <= "9")) num();
    else fail("unexpected token");
  };
  try {
    value(0, "");
    ws();
    if (i !== n) fail("trailing data");
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    if (e instanceof ScanError) return { ok: false, reason: e.message };
    return { ok: false, reason: "invalid JSON" };
  }
}

// ---------------------------------------------------------------------------------------------
// Create body validation
// ---------------------------------------------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

export interface CreateFacts {
  name: string;
  tenant: string;
  principal: string;
  project: string;
  /** Validated bind strings as forwarded (host source:target[:rw]). Empty in volume mode. */
  binds: string[];
  /** Host source paths of the binds (for validateBindsOnDisk). Empty in volume mode. */
  bindSources: string[];
  /** Canonical mounts recorded at create (volume mode only; empty in bind mode). */
  mounts: Obj[];
}

export type CreateResult =
  | { ok: true; canonical: Obj; canonicalText: string; facts: CreateFacts }
  | { ok: false; reason: string };

class Reject extends Error {}
const rej = (reason: string): never => {
  throw new Reject(reason);
};

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const has = (o: Obj, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isEmptyish = (v: unknown) =>
  v === null || (Array.isArray(v) && v.length === 0) || (isObj(v) && Object.keys(v).length === 0);

/** Deep equality where null, [] and {} are all equal. */
export function semanticEqual(a: unknown, b: unknown): boolean {
  if (isEmptyish(a) && isEmptyish(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => semanticEqual(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => has(b, k) && semanticEqual(a[k], b[k]));
  }
  return a === b;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function checkKeys(o: Obj, allowed: Set<string>, path: string, forbidden: Set<string> = new Set()) {
  for (const k of Object.keys(o)) {
    const p = path ? `${path}.${k}` : k;
    if (forbidden.has(k)) rej(`forbidden key ${p}`);
    if (!allowed.has(k)) rej(`unknown key ${p}`);
  }
}

const TOP_KEYS = new Set([
  "Hostname", "Domainname", "User", "AttachStdin", "AttachStdout", "AttachStderr", "Tty", "OpenStdin",
  "StdinOnce", "Env", "Cmd", "Image", "Volumes", "WorkingDir", "Entrypoint", "Labels", "HostConfig",
  "NetworkingConfig",
]);

const HC_DEFAULT_FALSE = ["Privileged", "PublishAllPorts", "ReadonlyRootfs", "OomKillDisable"];
const HC_DEFAULT_EMPTY_STRING = [
  "ContainerIDFile", "VolumeDriver", "CgroupnsMode", "IpcMode", "Cgroup", "PidMode", "UTSMode", "UsernsMode",
  "Isolation", "CgroupParent", "CpusetCpus", "CpusetMems",
];
const HC_DEFAULT_ZERO = [
  "OomScoreAdj", "ShmSize", "CpuShares", "BlkioWeight", "CpuPeriod", "CpuQuota", "CpuRealtimePeriod",
  "CpuRealtimeRuntime", "MemoryReservation", "MemorySwap", "CpuCount", "CpuPercent", "IOMaximumIOps",
  "IOMaximumBandwidth",
];
const HC_DEFAULT_NULLISH = [
  "VolumesFrom", "CapAdd", "Dns", "DnsOptions", "DnsSearch", "ExtraHosts", "GroupAdd", "Links",
  "BlkioWeightDevice", "BlkioDeviceReadBps", "BlkioDeviceWriteBps", "BlkioDeviceReadIOps",
  "BlkioDeviceWriteIOps", "Devices", "DeviceCgroupRules", "DeviceRequests", "Ulimits", "MaskedPaths",
  "ReadonlyPaths", "PortBindings",
];
const HC_REAL = [
  "Binds", "AutoRemove", "Init", "CapDrop", "SecurityOpt", "NetworkMode", "Memory", "NanoCpus", "PidsLimit",
  "RestartPolicy", "LogConfig", "ConsoleSize", "MemorySwappiness",
];
const HC_KEYS = new Set([...HC_DEFAULT_FALSE, ...HC_DEFAULT_EMPTY_STRING, ...HC_DEFAULT_ZERO, ...HC_DEFAULT_NULLISH, ...HC_REAL]);
const HC_FORBIDDEN = new Set(["User", "Mounts", "Runtime", "Sysctls", "Tmpfs", "StorageOpt", "Annotations"]);

/** Zero-valued endpoint settings exactly as docker CLI 29.8.1 sends them. */
const ENDPOINT_ZERO: Obj = {
  IPAMConfig: null, Links: null, Aliases: null, DriverOpts: null, GwPriority: 0, NetworkID: "", EndpointID: "",
  Gateway: "", IPAddress: "", MacAddress: "", IPPrefixLen: 0, IPv6Gateway: "", GlobalIPv6Address: "",
  GlobalIPv6PrefixLen: 0, DNSNames: null,
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const isPosInt = (v: unknown, max: number) => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= max;

function strArray(v: unknown, path: string, maxEach: number, maxTotal: number): string[] {
  if (!Array.isArray(v)) rej(`${path} must be an array of strings`);
  let total = 0;
  const out: string[] = [];
  for (const s of v as unknown[]) {
    if (typeof s !== "string") rej(`${path} must be an array of strings`);
    if ((s as string).length > maxEach) rej(`${path} entry too long`);
    total += (s as string).length;
    out.push(s as string);
  }
  if (total > maxTotal) rej(`${path} too large`);
  return out;
}

/** Tenant part of a validated turn container name (between the prefix and "-<8hex>"). */
export function tenantPartOfName(name: string): string {
  return name.slice(NAME_PREFIX.length, -9);
}

/**
 * Validates a /containers/create body (design B.2 b+c) for container `name` (the `name` query
 * value). Returns a canonical body rebuilt ONLY from validated values.
 */
export function validateCreate(bodyText: string, cfg: PolicyConfig, name: string): CreateResult {
  try {
    if (!NAME_RE.test(name)) rej("container name not allowed");
    if (!cfg.dataVolume && !cfg.dataDirHost) rej("data dir host not configured");
    const scanned = scanJson(bodyText);
    if (!scanned.ok) return { ok: false, reason: scanned.reason };
    const body = scanned.value;
    if (!isObj(body)) rej("create body must be a JSON object");
    const b = body as Obj;
    checkKeys(b, TOP_KEYS, "");
    const out: Obj = {};

    // --- simple top-level fields ---
    for (const k of ["Hostname", "Domainname"]) {
      if (has(b, k)) {
        if (b[k] !== "") rej(`${k} must be empty`);
        out[k] = "";
      }
    }
    if (b.User !== "10000:10000") rej('User must be "10000:10000"');
    out.User = "10000:10000";
    for (const k of ["AttachStdin", "AttachStdout", "AttachStderr"]) {
      if (b[k] !== true) rej(`${k} must be true`);
      out[k] = true;
    }
    if (has(b, "Tty")) {
      if (b.Tty !== false) rej("Tty must be false");
      out.Tty = false;
    }
    for (const k of ["OpenStdin", "StdinOnce"]) {
      if (b[k] !== true) rej(`${k} must be true`);
      out[k] = true;
    }

    // --- Env ---
    // 2026-10-03 sibling-turns design (D1/D2): the Entrypoint selects the runtime profile —
    // read it FIRST (read-only peek; validated in place at the Entrypoint check below) so the
    // env contract and the home mounts can be entrypoint-specific.
    const epRaw = Array.isArray(b.Entrypoint) && b.Entrypoint.length === 1 ? String(b.Entrypoint[0]) : "";
    const profile = RUNTIME_TURN_PROFILES[epRaw === cfg.hermesBin ? "hermes" : epRaw];
    if (!profile) rej("Entrypoint not allowed");
    const env = strArray(b.Env, "Env", 16 * 1024, 64 * 1024);
    const envNames = new Set<string>();
    let providerCount = 0;
    const envOut: string[] = [];
    for (const e of env) {
      const eq = e.indexOf("=");
      if (eq <= 0) rej("Env entry must be NAME=value");
      const k = e.slice(0, eq);
      const v = e.slice(eq + 1);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) rej("Env entry must be NAME=value");
      if (envNames.has(k)) rej(`duplicate Env ${k}`);
      envNames.add(k);
      if (profile && k in profile.requiredEnv) {
        if (v !== profile.requiredEnv[k]) rej(`Env ${k} must be ${profile.requiredEnv[k]}`);
      } else if (k === "ANTHROPIC_BASE_URL" && epRaw === "claude") {
        if (!isValidRuntimeBaseUrl(v)) rej("Env ANTHROPIC_BASE_URL must be a https URL (<= 300 chars, no whitespace/quotes)");
      } else if (PROVIDER_TOKEN_ENVS.includes(k)) {
        // bearer-token variant of the same credential — allowed, not counted as a second provider key
      } else if (PROVIDER_KEY_ENVS.includes(k)) {
        if (++providerCount > 1) rej("Env has more than one provider key");
      } else {
        rej(`Env ${k} not allowed`);
      }
      envOut.push(`${k}=${v}`);
    }
    for (const [rk, rv] of Object.entries(profile?.requiredEnv ?? {})) {
      if (!envNames.has(rk)) rej(`Env missing required entry ${rk}=${rv}`);
    }
    out.Env = envOut;

    // --- Cmd / Image / Volumes / WorkingDir / Entrypoint ---
    out.Cmd = strArray(b.Cmd, "Cmd", 4096, 32 * 1024);
    if (b.Image !== cfg.runtimeImage) rej("Image not allowed");
    out.Image = cfg.runtimeImage;
    if (has(b, "Volumes")) {
      if (!(b.Volumes === null || (isObj(b.Volumes) && Object.keys(b.Volumes).length === 0))) rej("Volumes must be empty");
      out.Volumes = b.Volumes === null ? null : {};
    }
    if (b.WorkingDir !== MOUNT_PROJECT) rej("WorkingDir must be /work/project");
    out.WorkingDir = MOUNT_PROJECT;
    if (!Array.isArray(b.Entrypoint) || b.Entrypoint.length !== 1 || !RUNTIME_TURN_PROFILES[b.Entrypoint[0] === cfg.hermesBin ? "hermes" : String(b.Entrypoint[0])]) {
      rej("Entrypoint not allowed");
    }
    out.Entrypoint = b.Entrypoint;

    // --- Labels ---
    if (!isObj(b.Labels)) rej("Labels required");
    const labels = b.Labels as Obj;
    checkKeys(labels, new Set(["co-workspace.turn", "co-workspace.instance", "co-workspace.tenant"]), "Labels");
    if (labels["co-workspace.turn"] !== "1") rej("label co-workspace.turn must be 1");
    if (labels["co-workspace.instance"] !== cfg.instanceId) rej("label co-workspace.instance mismatch");
    const tenant = labels["co-workspace.tenant"];
    if (typeof tenant !== "string" || !TENANT_RE.test(tenant)) rej("label co-workspace.tenant invalid");
    if ((tenant as string).slice(0, 36) !== tenantPartOfName(name)) rej("label co-workspace.tenant does not match container name");
    out.Labels = {
      "co-workspace.instance": cfg.instanceId,
      "co-workspace.tenant": tenant as string,
      "co-workspace.turn": "1",
    };

    // --- HostConfig ---
    if (!isObj(b.HostConfig)) rej("HostConfig required");
    const hc = b.HostConfig as Obj;
    const volumeMode = cfg.dataVolume !== undefined;
    // HC_FORBIDDEN is mode-dependent: Mounts is only reachable in volume mode.
    const hcForbidden = volumeMode ? new Set([...HC_FORBIDDEN].filter((k) => k !== "Mounts")) : HC_FORBIDDEN;
    // Volume mode adds Mounts to the allowlist (it is forbidden in bind mode).
    checkKeys(hc, volumeMode ? new Set([...HC_KEYS, "Mounts"]) : HC_KEYS, "HostConfig", hcForbidden);
    const hcOut: Obj = {};
    let bindRes: ReturnType<typeof validateBindShape> | undefined;
    let mres: ReturnType<typeof validateMounts> | undefined;
    let mounts: Obj[] = [];
    if (volumeMode) {
      if (has(hc, "Binds") && !isEmptyish(hc.Binds)) rej("HostConfig.Binds not allowed in volume mode");
      hcOut.Binds = null;
      mres = validateMounts(hc.Mounts, cfg, profile!.homeLeaf);
      mounts = mres.mounts;
      hcOut.Mounts = mounts;
    } else {
      bindRes = validateBindShape(hc.Binds, cfg.dataDirHost as string, profile!.homeLeaf);
      hcOut.Binds = bindRes.binds;
    }
    for (const k of HC_DEFAULT_FALSE) {
      if (has(hc, k)) {
        if (hc[k] !== false) rej(`HostConfig.${k} must be false`);
        hcOut[k] = false;
      }
    }
    for (const k of HC_DEFAULT_EMPTY_STRING) {
      if (has(hc, k)) {
        if (hc[k] !== "") rej(`HostConfig.${k} must be empty`);
        hcOut[k] = "";
      }
    }
    for (const k of HC_DEFAULT_ZERO) {
      if (has(hc, k)) {
        if (hc[k] !== 0) rej(`HostConfig.${k} must be 0`);
        hcOut[k] = 0;
      }
    }
    for (const k of HC_DEFAULT_NULLISH) {
      if (has(hc, k)) {
        if (!isEmptyish(hc[k])) rej(`HostConfig.${k} must be empty`);
        hcOut[k] = clone(hc[k]); // validated: null, [] or {}
      }
    }
    if (hc.AutoRemove !== true) rej("HostConfig.AutoRemove must be true");
    hcOut.AutoRemove = true;
    if (hc.Init !== true) rej("HostConfig.Init must be true");
    hcOut.Init = true;
    if (!Array.isArray(hc.CapDrop) || hc.CapDrop.length !== 1 || hc.CapDrop[0] !== "ALL") rej('HostConfig.CapDrop must be ["ALL"]');
    hcOut.CapDrop = ["ALL"];
    if (!Array.isArray(hc.SecurityOpt) || hc.SecurityOpt.length !== 1 || hc.SecurityOpt[0] !== "no-new-privileges") {
      rej('HostConfig.SecurityOpt must be ["no-new-privileges"]');
    }
    hcOut.SecurityOpt = ["no-new-privileges"];
    let netMode = "default";
    if (has(hc, "NetworkMode")) {
      if (hc.NetworkMode !== "default" && hc.NetworkMode !== "bridge") rej("HostConfig.NetworkMode not allowed");
      netMode = hc.NetworkMode as string;
      hcOut.NetworkMode = netMode;
    }
    if (!isPosInt(hc.Memory, cfg.memoryCapBytes)) rej("HostConfig.Memory missing or above cap");
    hcOut.Memory = hc.Memory as number;
    if (!isPosInt(hc.NanoCpus, Math.round(cfg.cpuCap * 1e9))) rej("HostConfig.NanoCpus missing or above cap");
    hcOut.NanoCpus = hc.NanoCpus as number;
    if (!isPosInt(hc.PidsLimit, cfg.pidsCap)) rej("HostConfig.PidsLimit missing or above cap");
    hcOut.PidsLimit = hc.PidsLimit as number;
    if (has(hc, "RestartPolicy")) {
      if (!semanticEqual(hc.RestartPolicy, { Name: "no", MaximumRetryCount: 0 })) rej("HostConfig.RestartPolicy not allowed");
      hcOut.RestartPolicy = { Name: "no", MaximumRetryCount: 0 };
    }
    if (has(hc, "LogConfig")) {
      if (!semanticEqual(hc.LogConfig, { Type: "", Config: {} })) rej("HostConfig.LogConfig not allowed");
      hcOut.LogConfig = { Type: "", Config: {} };
    }
    if (has(hc, "ConsoleSize")) {
      if (!Array.isArray(hc.ConsoleSize) || !semanticEqual(hc.ConsoleSize, [0, 0])) rej("HostConfig.ConsoleSize not allowed");
      hcOut.ConsoleSize = [0, 0];
    }
    if (has(hc, "MemorySwappiness")) {
      if (hc.MemorySwappiness !== -1 && hc.MemorySwappiness !== null) rej("HostConfig.MemorySwappiness not allowed");
      hcOut.MemorySwappiness = hc.MemorySwappiness === null ? null : -1;
    }
    out.HostConfig = hcOut;

    // --- NetworkingConfig ---
    if (has(b, "NetworkingConfig") && b.NetworkingConfig !== null) {
      const nc = b.NetworkingConfig;
      if (!isObj(nc)) rej("NetworkingConfig must be an object");
      checkKeys(nc as Obj, new Set(["EndpointsConfig"]), "NetworkingConfig");
      const ec = (nc as Obj).EndpointsConfig;
      if (ec !== undefined && !isEmptyish(ec)) {
        if (!isObj(ec)) rej("NetworkingConfig.EndpointsConfig must be an object");
        const eps = Object.keys(ec as Obj);
        if (eps.length !== 1 || eps[0] !== netMode) rej("NetworkingConfig.EndpointsConfig must only configure the default network");
        const ep = (ec as Obj)[netMode];
        if (!isObj(ep)) rej("NetworkingConfig endpoint must be an object");
        checkKeys(ep as Obj, new Set(Object.keys(ENDPOINT_ZERO)), `NetworkingConfig.EndpointsConfig.${netMode}`);
        for (const [k, v] of Object.entries(ep as Obj)) {
          if (!semanticEqual(v, ENDPOINT_ZERO[k])) rej(`NetworkingConfig.EndpointsConfig.${netMode}.${k} must be zero`);
        }
        out.NetworkingConfig = { EndpointsConfig: { [netMode]: clone(ENDPOINT_ZERO) } };
      }
    }

    return {
      ok: true,
      canonical: out,
      canonicalText: JSON.stringify(out),
      facts: {
        name,
        tenant: tenant as string,
        principal: (volumeMode ? mres : bindRes)!.principal,
        project: (volumeMode ? mres : bindRes)!.project,
        binds: bindRes?.binds ?? [],
        bindSources: bindRes?.sources ?? [],
        mounts,
      },
    };
  } catch (e) {
    if (e instanceof Reject) return { ok: false, reason: e.message };
    return { ok: false, reason: "create body rejected", error: String((e as Error)?.message ?? e) } as { ok: false; reason: string; error?: string };
  }
}

function validateBindShape(
  v: unknown,
  dataDirHost: string,
  homeLeaf: "hermes-home" | "claude-home" | "codex-home",
): { binds: string[]; sources: string[]; principal: string; project: string } {
  if (!Array.isArray(v) || v.length !== 2) rej("HostConfig.Binds must have exactly 2 entries");
  const data = escapeRe(stripTrailingSlash(dataDirHost));
  const re = new RegExp(`^(${data}/storage/([^/:]+)/([^/:]+)/(project|${homeLeaf})):/work/(project|${homeLeaf})(?::(rw))?$`);
  const binds: string[] = [];
  const sources: string[] = [];
  const seen = new Set<string>();
  let principal = "";
  let project = "";
  for (const raw of v as unknown[]) {
    if (typeof raw !== "string") rej("bind must be a string");
    const m = (raw as string).match(re);
    if (!m) rej(`bind not allowed: ${(raw as string).slice(0, 256)}`);
    const [, src, p, nm, suffix, target] = m!;
    if (!PN_RE.test(p) || !PN_RE.test(nm)) rej("bind principal/name segment not allowed");
    if (suffix !== target) rej("bind source/target mismatch");
    if (seen.has(target)) rej("duplicate bind target");
    seen.add(target);
    if (binds.length === 0) {
      principal = p;
      project = nm;
    } else if (p !== principal || nm !== project) {
      rej("binds must share the same principal and name");
    }
    binds.push(raw as string);
    sources.push(src);
  }
  // The runtime home must be the entrypoint's own leaf (2026-10-03 sibling-turns design D3):
  // exactly one project bind + one <homeLeaf> bind — a claude container must not receive the
  // credential-bearing hermes home, and vice versa. (seen stores the target LEAF — the regex
  // captures `/work/(leaf)` as leaf-only.)
  if (!seen.has("project") || !seen.has(homeLeaf)) {
    rej(`binds must be /work/project + /work/${homeLeaf} for this entrypoint`);
  }
  return { binds, sources, principal, project };
}

// ---------------------------------------------------------------------------------------------
// Volume-mode mount validation (T-20260930-038)
// ---------------------------------------------------------------------------------------------

const MOUNT_KEYS = new Set(["Type", "Source", "Target", "ReadOnly", "VolumeOptions"]);

/**
 * Volume-mode create validation and canonical rebuild (design 2026-09-30, section 4.1).
 * Key-allowlisted entries only; extra keys rejected. The canonical rebuild re-emits ONLY
 * validated fields (Type/Source/Target/VolumeOptions.Subpath) - everything else the CLI sent
 * (Consistency, NoCopy, Labels, DriverConfig, ...) is dropped and re-defaulted by the daemon.
 */
export function validateMounts(
  v: unknown,
  cfg: Pick<PolicyConfig, "dataVolume">,
  homeLeaf: "hermes-home" | "claude-home" | "codex-home",
): { mounts: Obj[]; principal: string; project: string } {
  const dv = cfg.dataVolume as string;
  if (!Array.isArray(v) || v.length !== 2) rej("HostConfig.Mounts must have exactly 2 entries");
  const seen = new Set<string>();
  let principal = "";
  let project = "";
  const mounts: Obj[] = [];
  for (const e of v as unknown[]) {
    if (!isObj(e)) rej("mount entry must be an object");
    checkKeys(e as Obj, MOUNT_KEYS, "HostConfig.Mounts[]");
    const m = e as Obj;
    if (m.Type !== "volume") rej("mount Type must be volume");
    if (m.Source !== dv) rej("mount Source not allowed");
    if (m.Target !== MOUNT_PROJECT && m.Target !== `/work/${homeLeaf}`) rej("mount Target not allowed");
    if (seen.has(m.Target as string)) rej("duplicate mount target");
    if (has(m, "ReadOnly") && m.ReadOnly !== false) rej("mount ReadOnly must be false");
    if (!has(m, "VolumeOptions") || !isObj(m.VolumeOptions)) rej("mount VolumeOptions object required");
    const vo = m.VolumeOptions as Obj;
    checkKeys(vo, new Set(["Subpath"]), "HostConfig.Mounts[].VolumeOptions");
    const sp = vo.Subpath;
    if (typeof sp !== "string") rej("mount Subpath must be a string");
    const s = sp as string;
    if (s.includes("..") || s.startsWith("/")) rej("mount Subpath not allowed");
    if (!SUBPATH_RE.test(s)) rej("mount Subpath not allowed");
    const cm = s.match(SUBPATH_RE)!;
    const [, p, n, leaf] = cm!;
    if (!principal) {
      principal = p;
      project = n;
    } else if (p !== principal || n !== project) {
      rej("mounts must share the same principal and name");
    }
    // Leaf must correspond to the mount target (the /work/project mount -> .../project).
    if ((m.Target === MOUNT_PROJECT) !== (leaf === "project")) rej("mount Subpath/target mismatch");
    if (m.Target !== MOUNT_PROJECT && leaf !== homeLeaf) rej("mount Subpath/target mismatch");
    seen.add(m.Target as string);
    mounts.push({ Type: "volume", Source: dv, Target: m.Target, VolumeOptions: { Subpath: s } });
  }
  // Exactly 2 entries with distinct validated targets => both present exactly once. Canonical
  // order is project first regardless of client order (same invariant as the bind rebuild).
  mounts.sort((a, b) => (a.Target === MOUNT_PROJECT ? -1 : 1));
  return { mounts, principal, project };
}
// On-disk bind containment (symlink walk)
// ---------------------------------------------------------------------------------------------

export interface FsOps {
  lstatSync: (p: string) => { isDirectory(): boolean; isSymbolicLink(): boolean };
  realpathSync: (p: string) => string;
}

const defaultFs: FsOps = { lstatSync: fsLstatSync, realpathSync: (p) => fsRealpathSync(p) };

/**
 * lstat-walks from dataDirHost down to every bind source: each component (dataDirHost included)
 * must be a real directory, not a symlink, and realpath(leaf) must equal leaf. Fails closed on
 * any error (EACCES, ENOENT, ...). Does NOT close the check-to-mount TOCTOU window.
 */
export function validateBindsOnDisk(
  binds: string[],
  dataDirHost: string | undefined,
  fsOps: FsOps = defaultFs,
): { ok: true } | { ok: false; reason: string } {
  if (!dataDirHost) return { ok: false, reason: "data dir host not configured" };
  const data = stripTrailingSlash(dataDirHost);
  try {
    for (const bind of binds) {
      const idx = bind.lastIndexOf(":/work/");
      const src = idx > 0 ? bind.slice(0, idx) : bind;
      if (!src.startsWith(data + "/")) return { ok: false, reason: "bind source outside data dir" };
      const rest = src.slice(data.length + 1).split("/");
      if (rest.some((s) => s === "" || s === "." || s === "..")) return { ok: false, reason: "bind source not normalized" };
      let cur = data;
      const components = [data];
      for (const s of rest) {
        cur = `${cur}/${s}`;
        components.push(cur);
      }
      for (const c of components) {
        const st = fsOps.lstatSync(c);
        if (st.isSymbolicLink()) return { ok: false, reason: `bind path component is a symlink: ${c}` };
        if (!st.isDirectory()) return { ok: false, reason: `bind path component is not a directory: ${c}` };
      }
      const real = fsOps.realpathSync(src);
      if (pathResolve(real) !== pathResolve(src)) return { ok: false, reason: "bind source realpath mismatch" };
    }
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code ?? "error";
    return { ok: false, reason: `bind source check failed (${code})` };
  }
}

// ---------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------

export type RouteOp = "ping" | "version" | "list" | "create" | "attach" | "start" | "wait" | "kill" | "delete" | "volume" | "volinspect";

export type RouteDecision =
  | {
      allowed: true;
      op: RouteOp;
      mode: "buffered" | "piped" | "upgrade";
      /** Path without the version prefix, e.g. "/containers/create". */
      norm: string;
      /** "/v1.56" or "" when the client sent an unversioned path. */
      versionPrefix: string;
      /** Raw query string without "?" (already allowlisted). */
      rawQuery: string;
      ref?: string;
      /** `name` query value for create. */
      name?: string;
    }
  | { allowed: false; status: number; reason: string };

export function isValidRef(ref: string): boolean {
  return NAME_RE.test(ref) || HEX_ID_RE.test(ref);
}

const PATH_RE = /^(\/v1\.\d{1,2})?(\/[A-Za-z0-9_./-]*)$/;
const CONTAINER_ROUTE_RE = /^\/containers\/([^/]+)(?:\/(attach|start|wait|kill))?$/;

function deny(reason: string, status = 403): RouteDecision {
  return { allowed: false, status, reason };
}

/**
 * Route + query policy (design B.2 a). `headers` keys must be lower-case. The decision is made on
 * the path with the version prefix stripped.
 */
export function checkRoute(
  method: string,
  targetWithQuery: string,
  _cfg?: PolicyConfig,
  headers: Record<string, string | undefined> = {},
): RouteDecision {
  const q = targetWithQuery.indexOf("?");
  const path = q === -1 ? targetWithQuery : targetWithQuery.slice(0, q);
  const rawQuery = q === -1 ? "" : targetWithQuery.slice(q + 1);
  if (path.includes("%")) return deny("percent-encoding not allowed in path", 400);
  const m = path.match(PATH_RE);
  if (!m) return deny("malformed path", 400);
  const versionPrefix = m[1] ?? "";
  const norm = m[2];
  const segs = norm.split("/").slice(1);
  if (segs.some((s) => s === "" || s === "." || s === "..")) return deny("non-normalized path", 400);

  if (rawQuery.includes("#")) return deny("fragment not allowed", 400);
  const query = new Map<string, string>();
  for (const [k, v] of new URLSearchParams(rawQuery)) {
    if (query.has(k)) return deny(`duplicate query key ${k}`);
    query.set(k, v);
  }
  const unknownKey = (allowed: string[]): RouteDecision | null => {
    for (const k of query.keys()) if (!allowed.includes(k)) return deny(`query key not allowed: ${k}`);
    return null;
  };
  const base = { allowed: true as const, norm, versionPrefix, rawQuery };

  if (norm === "/_ping") {
    if (method !== "GET" && method !== "HEAD") return deny("method not allowed");
    return unknownKey([]) ?? { ...base, op: "ping", mode: "piped" };
  }
  if (norm === "/version") {
    if (method !== "GET") return deny("method not allowed");
    return unknownKey([]) ?? { ...base, op: "version", mode: "piped" };
  }
  if (norm === "/containers/json") {
    if (method !== "GET") return deny("method not allowed");
    const bad = unknownKey(["all", "filters"]);
    if (bad) return bad;
    const all = query.get("all");
    if (all !== undefined && !["0", "1", "true", "false"].includes(all)) return deny("query all not allowed");
    const filters = query.get("filters");
    if (filters !== undefined) {
      if (filters.length > MAX_FILTERS_LEN) return deny("query filters too long");
      if (!scanJson(filters, MAX_FILTERS_LEN).ok) return deny("query filters must be JSON");
    }
    return { ...base, op: "list", mode: "buffered" };
  }
  if (norm === "/containers/create") {
    if (method !== "POST") return deny("method not allowed");
    const bad = unknownKey(["name"]);
    if (bad) return bad;
    const name = query.get("name");
    if (name === undefined || !NAME_RE.test(name)) return deny("container name not allowed");
    return { ...base, op: "create", mode: "buffered", name };
  }

  // T-20260930-038: broker-internal volume lifecycle control route. Volume mode only (403 in
  // bind mode, unconditionally); handled in docker-broker.ts OUTSIDE the docker-path policy
  // with a broker-constructed body — the gateway can only name op + a regex-validated subpath.
  if (norm === "/coworkspace/volume") {
    if (!_cfg?.dataVolume) return deny("volume control route requires volume mode");
    if (method !== "POST") return deny("method not allowed");
    return unknownKey([]) ?? { ...base, op: "volume", mode: "buffered" };
  }

  // T-20260930-038: the gateway's volume-mode boot probe runs `docker volume inspect <name>`
  // with DOCKER_HOST pointing at this broker. Allow exactly that: GET of THIS boot's data
  // volume only, volume mode only. The response is volume metadata (no host paths).
  if (norm.startsWith("/volumes/")) {
    if (!_cfg?.dataVolume) return deny("volume routes require volume mode");
    if (method !== "GET") return deny("method not allowed");
    if (norm !== `/volumes/${_cfg.dataVolume}`) return deny("only the data volume may be inspected");
    return unknownKey([]) ?? { ...base, op: "volinspect", mode: "piped" };
  }
  if (norm === "/volumes") {
    return deny("volume listing not allowed");
  }

  const cm = norm.match(CONTAINER_ROUTE_RE);
  if (!cm) return deny("route not allowed");
  const ref = cm[1];
  const action = cm[2];
  if (!isValidRef(ref)) return deny("container ref not allowed");

  if (action === undefined) {
    if (method !== "DELETE") return deny("method not allowed");
    const bad = unknownKey(["force", "v"]);
    if (bad) return bad;
    const force = query.get("force");
    if (force !== undefined && !["0", "1", "true", "false"].includes(force)) return deny("query force not allowed");
    const v = query.get("v");
    if (v !== undefined && !["0", "1"].includes(v)) return deny("query v not allowed");
    return { ...base, op: "delete", mode: "piped", ref };
  }
  if (method !== "POST") return deny("method not allowed");
  if (action === "attach") {
    const keys = ["stream", "stdin", "stdout", "stderr"];
    const bad = unknownKey(keys);
    if (bad) return bad;
    if (!keys.every((k) => query.get(k) === "1")) return deny("attach requires stream=1&stdin=1&stdout=1&stderr=1");
    if ((headers.upgrade ?? "").toLowerCase() !== "tcp") return deny("attach requires Upgrade: tcp");
    return { ...base, op: "attach", mode: "upgrade", ref };
  }
  if (action === "start") {
    return unknownKey([]) ?? { ...base, op: "start", mode: "piped", ref };
  }
  if (action === "wait") {
    const bad = unknownKey(["condition"]);
    if (bad) return bad;
    const c = query.get("condition");
    if (c !== undefined && !["removed", "not-running", "next-exit"].includes(c)) return deny("query condition not allowed");
    return { ...base, op: "wait", mode: "piped", ref };
  }
  const bad = unknownKey(["signal"]);
  if (bad) return bad;
  const sig = query.get("signal");
  if (sig !== undefined && !["SIGKILL", "SIGTERM", "KILL", "TERM", "9", "15"].includes(sig)) return deny("query signal not allowed");
  return { ...base, op: "kill", mode: "piped", ref };
}

// ---------------------------------------------------------------------------------------------
// List filter
// ---------------------------------------------------------------------------------------------

/** Keeps only this instance's turn containers. Never throws; malformed entries are dropped. */
export function filterContainerList(list: unknown, cfg: Pick<PolicyConfig, "instanceId">): unknown[] {
  if (!Array.isArray(list)) return [];
  return list.filter((c) => {
    try {
      if (!isObj(c)) return false;
      const names = c.Names;
      const labels = c.Labels;
      if (!Array.isArray(names) || !isObj(labels)) return false;
      if (labels["co-workspace.instance"] !== cfg.instanceId) return false;
      return names.length > 0 && names.every((nm) => typeof nm === "string" && NAME_RE.test(nm.replace(/^\//, "")));
    } catch {
      return false;
    }
  });
}
