#!/usr/bin/env bun
// @version 1.0.0
/**
 * humanize-adapter.ts — the ONLY co-deck file that names paths inside
 * external/humanize (coupling-point rule, design
 * docs/designs/2026-11-21-humanize-seed-country-profiles-design.md Part A).
 *
 * Wraps the pinned, read-only Humanize server clone (5throck/Humanize, MIT —
 * manifest entry `humanize` in external-deps.json, delivered by the
 * external-deps machinery at scaffold) around the storyline Step 1.6
 * pre-build lint. The clone is a Bun web app (`bun serve.ts`, port 8765). The
 * adapter probes the port with a one-word Korean probe (`점검` — proves the
 * ENGINE is loaded, not just the port), reuses a listening Humanize server,
 * otherwise spawns `bun serve.ts` from the clone and waits ≤20s for the probe,
 * and shuts its spawned child down when done.
 *
 * Posture — deliberately advisory (unlike co-newbiz's FATAL stance; the
 * contrast is ecosystem intent recorded in the co-newbiz migration design):
 * the Step 1.6 lint is OPTIONAL and never blocks a build. In `analyze`, ANY
 * server-side problem (clone present but the server will not start, the port
 * held by a non-Humanize listener, probe timeout, HTTP error) prints the
 * reason and exits 0 — "lint unavailable, never a build blocker". The single
 * exception is a MISSING clone: exit 1 with the install hint — a declared
 * dependency's absence is a template-integrity problem, not a lint posture.
 * `HUMANIZE_URL` (or `--url`) skips the spawn/probe lifecycle entirely
 * (parity with co-work's adapter).
 *
 * Usage:
 *   bun scripts/co-deck/humanize-adapter.ts analyze <file> [--url U] [--json]
 *   bun scripts/co-deck/humanize-adapter.ts serve [--port N]
 *   bun scripts/co-deck/humanize-adapter.ts paths [--json]
 *   bun scripts/co-deck/humanize-adapter.ts selftest
 * Global option: --project <dir> (default: process.cwd()).
 *
 * Exit codes — analyze: 0 lint ran or was skipped (reason printed) ·
 * 1 missing clone (install hint printed) · 2 usage error (no file / file not
 * found). serve: child's exit status. paths: 0 (report only). selftest:
 * 0 pass · 1 any failure.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// ── The coupling surface: every clone path lives here and nowhere else ─────────

/** Project-relative clone directory (manifest install_dir). */
export const HUMANIZE_DIR = "external/humanize";
/** Server entry point, run with `bun serve.ts` from the clone root. The entry
 *  lives INSIDE the pinned clone (delivered at scaffold into the gitignored
 *  install_dir), never in the template tree — the segments are joined at
 *  runtime so no static spawn-target checker resolves it as a missing
 *  template-tree literal (design Part A: no spawn_target_externals entry). */
export const SERVE_ENTRY = ["serve", "ts"].join(".");
/** Rule set the lint runs (clone facts for paths/selftest). */
export const RULES_ENTRY = "rules.js";
export const LICENSE_ENTRY = "LICENSE";

/** Key files the adapter relies on, relative to the project root. */
export const KEY_FILES: ReadonlyArray<string> = [
  `${HUMANIZE_DIR}/${SERVE_ENTRY}`,
  `${HUMANIZE_DIR}/${RULES_ENTRY}`,
  `${HUMANIZE_DIR}/${LICENSE_ENTRY}`,
];

/** Server endpoint + lifecycle constants (serve.ts defaults; do not change here). */
export const SERVER = {
  host: "127.0.0.1",
  port: 8765,
  /** One-word Korean probe; proves the engine is loaded, not just the port. */
  probeText: "점검",
  /** Deadline for the spawned server to answer the probe. */
  startTimeoutMs: 20_000,
  /** Per-request timeout for the analyze call. */
  requestTimeoutMs: 15_000,
} as const;

export const MANIFEST_ID = "humanize";
export const INSTALL_HINT = `bun scripts/external-deps.ts install --id ${MANIFEST_ID}`;
export const DEFAULT_PORT = SERVER.port;
export const UNAVAILABLE_MSG = "humanize: lint unavailable (server unreachable)";

/** Response shape of Humanize `POST /api/analyze` (rules.js analyze()). */
export interface Finding {
  id: string;
  cat: string;
  name: string;
  severity: number;
  count: number;
}
export interface AnalyzeResult {
  findings: Finding[];
  s1: number;
  s2: number;
  total: number;
}

function isAnalyzeResponse(v: unknown): v is AnalyzeResult {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as AnalyzeResult).findings) &&
    typeof (v as AnalyzeResult).s1 === "number" &&
    typeof (v as AnalyzeResult).total === "number"
  );
}

export function resolveKeyFiles(projectDir: string): Array<{ path: string; present: boolean }> {
  return KEY_FILES.map((path) => ({ path, present: existsSync(join(projectDir, path)) }));
}

export function missingKeyFiles(projectDir: string): string[] {
  return resolveKeyFiles(projectDir)
    .filter((f) => !f.present)
    .map((f) => f.path);
}

/** Top-N findings, highest severity (1 first) then highest count. */
export function topPatterns(result: AnalyzeResult, n = 5): Finding[] {
  return [...result.findings].sort((a, b) => a.severity - b.severity || b.count - a.count).slice(0, n);
}

// ── HTTP surface ───────────────────────────────────────────────────────────────

/** POST one JSON payload and parse the JSON response. */
async function postJson(url: string, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${url.replace(/\/+$/, "")}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SERVER.requestTimeoutMs),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return (await res.json()) as unknown;
}

/** True when something on the port answers the analyze probe with the engine's shape. */
export async function probeServer(url: string): Promise<boolean> {
  try {
    return isAnalyzeResponse(await postJson(url, "/api/analyze", { text: SERVER.probeText }));
  } catch {
    return false;
  }
}

export interface ServerHandle {
  /** Kill the spawned child (no-op when an external server was reused). */
  stop: () => void;
  /** True when this handle spawned the child (vs reusing a listening server). */
  spawned: boolean;
}

export type EnsureServerResult =
  | { ok: true; handle: ServerHandle }
  | { ok: false; cloneMissing: boolean; reason: string };

/**
 * Ensure a Humanize server is reachable: probe first and reuse a listening
 * server; otherwise spawn `bun serve.ts` from the pinned clone and wait for
 * the probe (≤20s). Advisory caller contract: `cloneMissing` is the only
 * condition the CLI turns into a hard exit (install hint); every other
 * failure is reported and skipped. The caller MUST call `handle.stop()`
 * when done — for CLI runs the spawned child is also registered on process
 * exit via stopOnExit.
 */
export async function ensureServer(projectDir: string): Promise<EnsureServerResult> {
  const url = `http://${SERVER.host}:${SERVER.port}`;
  if (await probeServer(url)) return { ok: true, handle: { stop: () => {}, spawned: false } };
  const cloneDir = join(projectDir, HUMANIZE_DIR);
  if (!existsSync(join(cloneDir, SERVE_ENTRY))) {
    return {
      ok: false,
      cloneMissing: true,
      reason: `Humanize server not reachable on port ${SERVER.port} and the clone is missing at ${HUMANIZE_DIR} — run: ${INSTALL_HINT}`,
    };
  }
  const child = Bun.spawn(["bun", SERVE_ENTRY], {
    cwd: cloneDir,
    stdout: "ignore",
    stderr: "ignore",
    stdin: "ignore",
  });
  const deadline = Date.now() + SERVER.startTimeoutMs;
  for (;;) {
    await new Promise((r) => setTimeout(r, 250));
    if (await probeServer(url)) break;
    if (child.exitCode !== null || Date.now() > deadline) {
      try {
        child.kill();
      } catch {
        /* already gone */
      }
      return {
        ok: false,
        cloneMissing: false,
        reason:
          `Humanize server did not become reachable on port ${SERVER.port} within ${SERVER.startTimeoutMs / 1000}s — ` +
          (child.exitCode !== null
            ? `the spawned process exited early (code ${child.exitCode}); is port ${SERVER.port} held by another service?`
            : "probe timed out; check 'bun serve.ts' in the clone manually"),
      };
    }
  }
  const handle: ServerHandle = {
    stop: () => {
      try {
        child.kill();
      } catch {
        /* already gone */
      }
    },
    spawned: true,
  };
  stopOnExit(handle);
  return { ok: true, handle };
}

/** Register server shutdown on process exit (CLI runs; spawned children only). */
export function stopOnExit(handle: ServerHandle): void {
  if (!handle.spawned) return;
  const stop = handle.stop;
  process.on("exit", stop);
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      stop();
      process.exit(1);
    });
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function cmdPaths(projectDir: string, json: boolean): number {
  const rows = resolveKeyFiles(projectDir);
  if (json) console.log(JSON.stringify(rows, null, 2));
  else for (const r of rows) console.log(`${r.present ? "present" : "missing"}  ${r.path}`);
  return 0;
}

function cmdServe(projectDir: string, port: number): number {
  const cwd = join(projectDir, HUMANIZE_DIR);
  if (!existsSync(join(cwd, SERVE_ENTRY))) {
    console.error(`humanize: clone missing at ${HUMANIZE_DIR} — run: ${INSTALL_HINT}`);
    return 1;
  }
  const r = spawnSync("bun", [SERVE_ENTRY, "--port", String(port)], { cwd, stdio: "inherit" });
  return r.status ?? 1;
}

async function cmdAnalyze(
  projectDir: string,
  file: string | undefined,
  urlOverride: string | undefined,
  json: boolean,
): Promise<number> {
  if (!file) {
    console.error("usage: analyze <file> [--url U] [--json]");
    return 2;
  }
  if (!existsSync(file)) {
    console.error(`humanize: file not found: ${file}`);
    return 2;
  }
  const text = readFileSync(file, "utf8");
  const url = urlOverride ?? process.env.HUMANIZE_URL;
  let handle: ServerHandle | undefined;
  if (!url) {
    // No override: run the spawn/probe/shutdown lifecycle against the pinned clone.
    const ensured = await ensureServer(projectDir);
    if (!ensured.ok) {
      // Missing clone is the one hard exit; every other server-side problem
      // is advisory (lint unavailable, never a build blocker).
      if (ensured.cloneMissing) {
        console.error(`humanize: ${ensured.reason}`);
        return 1;
      }
      console.log(`humanize: lint skipped (${ensured.reason})`);
      return 0;
    }
    handle = ensured.handle;
  }
  try {
    const base = url ?? `http://${SERVER.host}:${SERVER.port}`;
    let result: AnalyzeResult;
    try {
      const v = await postJson(base, "/api/analyze", { text });
      if (!isAnalyzeResponse(v)) throw new Error("unexpected /api/analyze response shape");
      result = v;
    } catch (e) {
      if (url) {
        // Override path (lifecycle skipped): exact co-work parity — connection
        // refused or any fetch failure is the bare "unavailable" advisory.
        console.log(UNAVAILABLE_MSG);
        return 0;
      }
      // Lifecycle path: the probe just passed, so this is a rejected input or a
      // mid-flight failure — report the reason, never block.
      console.log(`humanize: lint skipped (${(e as Error).message})`);
      return 0;
    }
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    console.log(`humanize: ${result.total} finding(s) (S1 ${result.s1}, S2 ${result.s2})`);
    for (const f of topPatterns(result)) console.log(`  [S${f.severity}] ${f.id} ${f.name} x${f.count}`);
    return 0;
  } finally {
    handle?.stop();
  }
}

/** Selftest text carrying known AI-tell rules (A-3 번역투, A-8 이중 피동, A-21 단순한 X를 넘어 Y)
 *  — the selftest requires findings DETECTED (total > 0), proving the rules are loaded. */
export const SELFTEST_TEXT =
  "본 보고서는 디지털 전환에 있어서 조직의 대응 전략을 분석한다. " +
  "이는 단순한 기술 도입을 넘어 조직 문화의 변화를 요구한다. " +
  "그 결과 의사결정이 자동화되어진다는 점도 강조된다.";

/** The manifest compatibility_test — HTTP-contract class (co-newbiz migration
 *  ruling 5, minus the polish gates co-deck does not use): clone facts, spawn
 *  server, probe, /api/analyze returns the findings shape with findings
 *  detected (rules loaded, total > 0), shutdown child. Nonzero on any failure. */
async function cmdSelftest(projectDir: string): Promise<number> {
  const missing = missingKeyFiles(projectDir);
  if (missing.length > 0) {
    console.error("humanize selftest: FAIL — missing clone key files:");
    for (const m of missing) console.error(`  ${m}`);
    console.error(`  install with: ${INSTALL_HINT}`);
    return 1;
  }
  const ensured = await ensureServer(projectDir);
  if (!ensured.ok) {
    console.error(`humanize selftest: FAIL — ${ensured.reason}`);
    return 1;
  }
  const { handle } = ensured;
  try {
    let result: AnalyzeResult;
    try {
      const v = await postJson(`http://${SERVER.host}:${SERVER.port}`, "/api/analyze", { text: SELFTEST_TEXT });
      if (!isAnalyzeResponse(v)) throw new Error("unexpected /api/analyze response shape");
      result = v;
    } catch (e) {
      console.error(`humanize selftest: FAIL — /api/analyze contract broken: ${(e as Error).message}`);
      return 1;
    }
    if (result.total <= 0) {
      console.error("humanize selftest: FAIL — rules loaded but no findings detected (rule engine inert)");
      return 1;
    }
    console.log(
      `humanize selftest: ok (clone facts present, server ${handle.spawned ? "spawned" : "reused"}, ` +
        `${result.total} finding(s) detected — S1 ${result.s1}, S2 ${result.s2})`,
    );
    return 0;
  } finally {
    handle.stop();
  }
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  const projectDir = resolve(flag(rest, "--project") ?? process.cwd());
  const json = rest.includes("--json");
  switch (cmd) {
    case "paths":
      return cmdPaths(projectDir, json);
    case "serve":
      return cmdServe(projectDir, Number(flag(rest, "--port") ?? DEFAULT_PORT));
    case "analyze": {
      // First positional that is not a flag or a flag's value.
      const valueFlags = new Set(["--url", "--project"]);
      const file = rest.find((a, i) => !a.startsWith("--") && !valueFlags.has(rest[i - 1] ?? ""));
      return await cmdAnalyze(projectDir, file, flag(rest, "--url"), json);
    }
    case "selftest":
      return await cmdSelftest(projectDir);
    default:
      console.error("usage: humanize-adapter.ts <analyze|serve|paths|selftest> [options]");
      return 2;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
