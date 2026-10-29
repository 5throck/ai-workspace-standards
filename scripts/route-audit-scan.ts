#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-29, T-20261029-005 — design docs/designs/2026-10-29-route-audit-scan-fleet-design.md):
//          initial. Fleet-general write-route audit tripwire generalized from
//          Projects/co-newbiz/scripts/co-newbiz/route-audit-scan.ts v1.0.0
//          (co-newbiz PR #742, FR-SEC-07 — swept 226 write routes to 0 unaudited;
//          Step 2f 2026-10-29 extraction). Co-newbiz specifics parameterized:
//          audit-token patterns moved from a hardcoded regex to the host-supplied
//          `routeAudit.auditTokenPatterns` config block (docs/workspace-schema.json,
//          the platform_surfaces/designLint block precedent; script constants carry
//          the co-newbiz defaults verbatim), the shared-infrastructure exclusion
//          (co-newbiz's SHARED_INFRA set) became optional `routeAudit.sharedInfra`,
//          and the allowlist moved from a sibling JSON file into the same block
//          (`routeAudit.allowlist`, { "<root-relative route.ts path>": "<reason>" }).
//          Delivered L0+L1 via the scripts domain. NOT wired into audit.ts or
//          dev-sync.ts — wiring is a deliberate follow-up once a host project
//          adopts the routeAudit block (T-20261029-005 scope note).
/**
 * route-audit-scan — write-route audit tripwire (fleet-general).
 *
 * Every Route Handler file (Next.js App Router `route.ts`) exporting a
 * state-changing method (POST/PUT/PATCH/DELETE) must reach an audit-write
 * token: an `auditTokenPatterns` match in the route file itself or in a local
 * module reachable through its relative-import graph within MAX_DEPTH hops.
 * Intentionally-unaudited write routes are exempted only through the
 * `routeAudit.allowlist` block with a mandatory reason (>= 10 chars).
 *
 * Token presence is a TRIPWIRE, not proof that every branch audits — the
 * behavioral assertions belong to the host project's write-route tests
 * (same posture as the co-newbiz source, PR #742 FR-SEC-07).
 *
 * Config — ONE mechanism (designLint precedent, T-20261029-005):
 *   docs/workspace-schema.json `routeAudit` block under the TARGET ROOT:
 *     {
 *       "auditTokenPatterns": ["\\bappendAudit\\s*\\(", ...],  // regex sources
 *       "allowlist": { "app/api/x/route.ts": "why this route is unaudited" },
 *       "sharedInfra": ["auth.ts", ...],   // optional; basenames whose audit
 *                                          tokens never count as route-level
 *     }
 *   A block that is present but malformed is a HARD ERROR (never a silent
 *   fallback); a missing block or unreadable schema file falls back to the
 *   documented co-newbiz defaults below. Keys are matched against paths
 *   relative to the TARGET ROOT, POSIX separators on every platform.
 *
 * API-surface discovery (design-lint scan-root convention): the target root's
 * `app/` and `src/` directories are walked for `route.ts` files when they
 * exist; node_modules/dist/build/generated and dot-directories are never
 * entered. No route.ts found anywhere is a SKIP (exit-0 contribution), never
 * an error — invoking the scan is itself the project opt-in.
 *
 * Definition guard: a token match immediately preceded by `function` (a
 * declaration such as `function appendAudit(`) never counts — only call sites
 * do (ported from the co-newbiz source's negative lookbehind, generalized to
 * arbitrary pattern lists).
 *
 * Allowlist semantics (co-newbiz, verbatim): wildcard `*` in a key is
 * rejected; a reason shorter than 10 chars is rejected; a key that is not a
 * discovered write route is rejected as stale. All three fail the scan.
 *
 * Exit codes: 0 (PASS or SKIP), 1 (at least one unaudited write route or
 * allowlist error), usage errors via die().
 *
 * Usage:
 *   bun scripts/route-audit-scan.ts [--dir <project-root>] [--json]
 *
 * Standalone: nothing wires it into core audit.ts / dev-sync.ts (T-20261029-005
 * scope note — wiring follows host adoption).
 *
 * @module route-audit-scan
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { die } from "./lib/error-handling.ts";

const VERSION = "1.0.0";
const SCRIPT_NAME = "route-audit-scan.ts";
const SCHEMA_REL = join("docs", "workspace-schema.json");

/** Import-follow budget: route file + up to MAX_DEPTH import hops (co-newbiz semantics). */
export const MAX_DEPTH = 3;

/**
 * Default audit-token patterns — the co-newbiz FR-SEC-07 names, verbatim
 * (appendAudit(), a local audit() helper wrapping it, auditTokenUse(), or a raw
 * audit_log insert). Documented here AND mirrored in the workspace root's
 * docs/workspace-schema.json routeAudit block (tests/unit pins the two in
 * lockstep). Host projects with different audit token names declare their own
 * block — the script never hardcodes another project's vocabulary.
 */
export const DEFAULT_AUDIT_TOKEN_PATTERNS: readonly string[] = [
  "\\bappendAudit\\s*\\(",
  "\\bauditTokenUse\\s*\\(",
  "\\baudit\\s*\\(",
  "INTO\\s+audit_log\\b",
];

/** Route Handler file name (Next.js App Router convention) and the write methods that make one state-changing. */
const ROUTE_FILE = "route.ts";
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** `export async function POST(` or `export const POST =` — co-newbiz WRITE_HANDLER, verbatim shape. */
const WRITE_HANDLER =
  /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\b/;

/** Relative (local) imports only: `from "./x"`, `import "../y"` — co-newbiz IMPORT_RE, verbatim shape. */
const IMPORT_RE = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;

/** Directory names never entered during route discovery (design-lint walk convention + dot-dirs). */
const EXCLUDED_DIRS = new Set(["node_modules", "dist", "build", "generated"]);

/** Minimum allowlist reason length (co-newbiz: `reason.trim().length < 10` is an error). */
const MIN_REASON_LENGTH = 10;

// ---------------------------------------------------------------------------
// Config (the ONE mechanism: docs/workspace-schema.json routeAudit block)
// ---------------------------------------------------------------------------

export interface RouteAuditConfig {
  /** Regex-source strings; every match is a counted audit write (call sites only). */
  auditTokenPatterns: string[];
  /** { "<root-relative POSIX route.ts path>": "<reason>" } — intentional exemptions. */
  allowlist: Record<string, string>;
  /** Basenames whose audit tokens never count as route-level audit (co-newbiz SHARED_INFRA). */
  sharedInfra: string[];
  /** Where the effective config came from — surfaced in every report. */
  source: "schema" | "defaults";
}

/** Hard input-contract error for a present-but-malformed routeAudit block (fail loud, never silently fall back). */
export class RouteAuditConfigError extends Error {}

/** The fallback config — documented co-newbiz defaults, empty exemptions. */
export function defaultRouteAuditConfig(): RouteAuditConfig {
  return {
    auditTokenPatterns: [...DEFAULT_AUDIT_TOKEN_PATTERNS],
    allowlist: {},
    sharedInfra: [],
    source: "defaults",
  };
}

/**
 * Load the `routeAudit` block from `<root>/docs/workspace-schema.json`
 * (designLint precedent, T-20261022-045/046 loading shape). A missing block or
 * an unreadable/unparseable schema file falls back to the co-newbiz defaults;
 * a PRESENT block that violates the shape is a hard RouteAuditConfigError —
 * a malformed tripwire config must never silently degrade into defaults.
 */
export function loadRouteAuditConfig(root: string): RouteAuditConfig {
  const p = join(root, SCHEMA_REL);
  if (!existsSync(p)) return defaultRouteAuditConfig();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    // Corrupt schema: not this scan's remediation scope — defaults still tripwire.
    return defaultRouteAuditConfig();
  }
  const raw = (parsed as Record<string, unknown> | null)?.routeAudit;
  if (raw === undefined || raw === null) return defaultRouteAuditConfig();
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new RouteAuditConfigError(
      `routeAudit block in ${SCHEMA_REL} must be an object with auditTokenPatterns (string[]) + optional allowlist (object) / sharedInfra (string[]) — got ${Array.isArray(raw) ? "array" : typeof raw}`,
    );
  }
  const block = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (!Array.isArray(block.auditTokenPatterns)) {
    problems.push('missing or non-array "auditTokenPatterns"');
  } else {
    block.auditTokenPatterns.forEach((v, i) => {
      if (typeof v !== "string" || v.trim() === "") problems.push(`auditTokenPatterns[${i}] is not a non-empty string`);
    });
  }
  if (block.allowlist !== undefined && (typeof block.allowlist !== "object" || block.allowlist === null || Array.isArray(block.allowlist))) {
    problems.push('"allowlist" must be an object of { "<route path>": "<reason>" }');
  } else if (block.allowlist !== undefined) {
    for (const [k, v] of Object.entries(block.allowlist as Record<string, unknown>)) {
      if (typeof v !== "string") problems.push(`allowlist["${k}"] reason is not a string`);
    }
  }
  if (block.sharedInfra !== undefined && (!Array.isArray(block.sharedInfra) || block.sharedInfra.some((v) => typeof v !== "string"))) {
    problems.push('"sharedInfra" must be an array of file basenames');
  }
  if (problems.length > 0) {
    throw new RouteAuditConfigError(
      `routeAudit block in ${SCHEMA_REL} is malformed:\n  - ${problems.join("\n  - ")}\nRepair: fix the block shape (auditTokenPatterns: string[] required; allowlist: object; sharedInfra: string[]) — a malformed tripwire config never silently falls back to defaults.`,
    );
  }
  const patterns = block.auditTokenPatterns as string[];
  // Validate compilability HERE (config boundary) — an unparseable pattern must
  // fail at load, before any scan work, never midway through a run.
  compileAuditTokenPatterns(patterns);
  return {
    auditTokenPatterns: patterns,
    allowlist: (block.allowlist as Record<string, string> | undefined) ?? {},
    sharedInfra: (block.sharedInfra as string[] | undefined) ?? [],
    source: "schema",
  };
}

/** Compile regex sources (global — matchAll iteration over every candidate match); an unparseable pattern is a hard error naming it (never a silent skip). */
export function compileAuditTokenPatterns(patterns: readonly string[]): RegExp[] {
  return patterns.map((src) => {
    try {
      return new RegExp(src, "g");
    } catch (err) {
      throw new RouteAuditConfigError(`auditTokenPatterns entry is not a valid regex: "${src}" (${(err as Error).message})`);
    }
  });
}

// ---------------------------------------------------------------------------
// Detection primitives (co-newbiz logic, ported + parameterized)
// ---------------------------------------------------------------------------

/** Distinct write methods exported by a Route Handler source. */
export function writeMethods(src: string): string[] {
  const out = new Set<string>();
  for (const line of src.split(/\r?\n/)) {
    const m = WRITE_HANDLER.exec(line);
    if (m) out.add(m[1] ?? m[2]);
  }
  return [...out];
}

/** 1-based line of the first write-method export (offender file:line anchor). */
export function firstWriteLine(src: string): number {
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (WRITE_HANDLER.exec(lines[i]!)) return i + 1;
  }
  return 0;
}

/**
 * True when the match at `index` is a declaration, not a call site: the text
 * before it ends with `function` + whitespace (co-newbiz's `(?<!function\s)`
 * lookbehind, generalized from the hardcoded alternation to any pattern list).
 */
export function isDefinitionMatch(src: string, index: number): boolean {
  const before = src.slice(0, index);
  return /(?:^|[^\w$])function\s*$/.test(before);
}

/** Any audit-token match (call sites only) in the given source. matchAll: zero-width-match safe, no /g lastIndex state to reset. */
export function hasAuditToken(src: string, tokens: readonly RegExp[]): boolean {
  for (const re of tokens) {
    for (const m of src.matchAll(re)) {
      if (!isDefinitionMatch(src, m.index)) return true;
    }
  }
  return false;
}

function resolveLocal(from: string, spec: string, sharedInfra: ReadonlySet<string>): string | null {
  const base = resolve(dirname(from), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(cand) && statSync(cand).isFile() && /\.(ts|tsx)$/.test(cand) && !sharedInfra.has(cand.split("/").pop() ?? "")) {
      return cand;
    }
  }
  return null;
}

/** True when the file, or a local module reachable within `depth` import hops, carries an audit token. Cycle-safe. */
export function reachesAudit(file: string, tokens: readonly RegExp[], depth = MAX_DEPTH, sharedInfra: ReadonlySet<string> = new Set(), seen: Set<string> = new Set()): boolean {
  if (seen.has(file) || !existsSync(file)) return false;
  seen.add(file);
  const src = readFileSync(file, "utf8");
  if (hasAuditToken(src, tokens)) return true;
  if (depth <= 0) return false;
  for (const m of src.matchAll(IMPORT_RE)) {
    const next = resolveLocal(file, m[1]!, sharedInfra);
    if (next && reachesAudit(next, tokens, depth - 1, sharedInfra, seen)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Route discovery (design-lint scan-root convention)
// ---------------------------------------------------------------------------

/** Conventional App Router roots walked for route.ts, relative to the target root. */
export const API_SURFACE_ROOTS = ["app", "src"] as const;

function* walkRouteFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || EXCLUDED_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkRouteFiles(p);
    else if (e.isFile() && e.name === ROUTE_FILE) yield p;
  }
}

/** All route.ts files under the target root's existing API-surface roots (app/, src/), sorted. Empty when no surface exists. */
export function discoverRouteFiles(root: string): string[] {
  const out: string[] = [];
  for (const r of API_SURFACE_ROOTS) {
    const dir = join(root, r);
    if (existsSync(dir)) out.push(...walkRouteFiles(dir));
  }
  return [...new Set(out)].sort();
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

export interface UnauditedRoute {
  /** Root-relative POSIX path. */
  route: string;
  /** Absolute path (host OS separators). */
  file: string;
  /** 1-based line of the first write-method export. */
  line: number;
  /** Exported write methods, canonical order. */
  methods: string[];
}

export interface RouteAuditReport {
  ok: boolean;
  /** true when the target root has no API surface — exit-0 contribution (design-lint skip convention). */
  skipped: boolean;
  skipReason?: string;
  targetRoot: string;
  configSource: "schema" | "defaults";
  writeRoutes: number;
  unaudited: UnauditedRoute[];
  allowlistErrors: string[];
}

export function scanRouteAudit(root: string, config: RouteAuditConfig): RouteAuditReport {
  const rootResolved = resolve(root);
  const tokens = compileAuditTokenPatterns(config.auditTokenPatterns);
  const sharedInfra = new Set(config.sharedInfra);
  const posix = (f: string) => relative(rootResolved, f).split("\\").join("/");

  const routeFiles = discoverRouteFiles(rootResolved);
  if (routeFiles.length === 0) {
    return {
      ok: true,
      skipped: true,
      skipReason: `no API surface under ${rootResolved} (looked for ${API_SURFACE_ROOTS.map((r) => `${r}/**/${ROUTE_FILE}`).join(", ")})`,
      targetRoot: rootResolved,
      configSource: config.source,
      writeRoutes: 0,
      unaudited: [],
      allowlistErrors: [],
    };
  }

  const writeRoutes = routeFiles
    .map((f) => {
      const src = readFileSync(f, "utf8");
      const methods = writeMethods(src);
      return { file: f, src, methods, line: methods.length > 0 ? firstWriteLine(src) : 0 };
    })
    .filter((r) => r.methods.length > 0)
    .sort((a, b) => a.file.localeCompare(b.file));

  const writeRel = new Set(writeRoutes.map((r) => posix(r.file)));

  // Allowlist validation — co-newbiz semantics, verbatim: wildcard rejected,
  // reason mandatory (>= 10 chars), stale keys (not a discovered write route) rejected.
  const allowlistErrors: string[] = [];
  for (const [route, reason] of Object.entries(config.allowlist)) {
    if (route.includes("*")) allowlistErrors.push(`wildcard allowlist entry not allowed: ${route}`);
    if (!reason || reason.trim().length < MIN_REASON_LENGTH) allowlistErrors.push(`allowlist entry needs a reason (>= ${MIN_REASON_LENGTH} chars): ${route}`);
    if (!writeRel.has(route)) allowlistErrors.push(`allowlist entry is not a write route (stale?): ${route}`);
  }

  const unaudited: UnauditedRoute[] = [];
  for (const r of writeRoutes) {
    const rel = posix(r.file);
    if (config.allowlist[rel] !== undefined) continue;
    if (!reachesAudit(r.file, tokens, MAX_DEPTH, sharedInfra)) {
      unaudited.push({ route: rel, file: r.file, line: r.line, methods: ["POST", "PUT", "PATCH", "DELETE"].filter((m) => r.methods.includes(m)) });
    }
  }

  return {
    ok: unaudited.length === 0 && allowlistErrors.length === 0,
    skipped: false,
    targetRoot: rootResolved,
    configSource: config.source,
    writeRoutes: writeRoutes.length,
    unaudited,
    allowlistErrors,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printReport(r: RouteAuditReport, json: boolean): number {
  if (json) {
    console.log(JSON.stringify(r, null, 2));
    return r.ok ? 0 : 1;
  }
  if (r.skipped) {
    console.log(`${SCRIPT_NAME}: SKIP — ${r.skipReason}`);
    return 0;
  }
  for (const u of r.unaudited) {
    console.log(`route-audit  ${u.route}:${u.line}  state-changing handler (${u.methods.join("/")}) with no audit token in its local import graph (depth-${MAX_DEPTH})`);
  }
  for (const e of r.allowlistErrors) console.log(`route-audit  ${e}`);
  const verdict = r.ok ? "PASS" : "FAIL";
  console.log(
    `${SCRIPT_NAME}: ${verdict} — ${r.writeRoutes} write route(s), ${r.unaudited.length} unaudited, ${r.allowlistErrors.length} allowlist error(s). (audit tokens: ${r.configSource === "schema" ? "routeAudit block" : "co-newbiz defaults"})`,
  );
  return r.ok ? 0 : 1;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(`Usage: bun scripts/${SCRIPT_NAME} [--dir <project-root>] [--json]`);
    console.log("");
    console.log("Write-route audit tripwire: every route.ts exporting POST/PUT/PATCH/DELETE must reach an auditTokenPatterns match within its local import graph (depth-3), or be listed with a >= 10-char reason in the routeAudit.allowlist block.");
    console.log(`Config: <project-root>/${SCHEMA_REL} routeAudit block (auditTokenPatterns + optional allowlist/sharedInfra); missing block falls back to the documented co-newbiz defaults.`);
    process.exit(0);
  }
  let dir: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--json") continue;
    if (arg === "--dir") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) die(`--dir requires a path argument (got ${value ?? "nothing"}) — usage: bun scripts/${SCRIPT_NAME} [--dir <path>] [--json]`);
      dir = value;
      i += 1;
      continue;
    }
    die(`unknown argument '${arg}' — usage: bun scripts/${SCRIPT_NAME} [--dir <path>] [--json]`);
  }
  const rootArg = dir ?? process.cwd();
  const root = isAbsolute(rootArg) ? resolve(rootArg) : resolve(process.cwd(), rootArg);
  if (!existsSync(root)) die(`Target root does not exist: ${root}`);
  let config: RouteAuditConfig;
  let report: RouteAuditReport;
  try {
    config = loadRouteAuditConfig(root);
    report = scanRouteAudit(root, config);
  } catch (err) {
    die(`${SCRIPT_NAME}: ${(err as Error).message}`);
  }
  process.exit(printReport(report, args.includes("--json")));
}
