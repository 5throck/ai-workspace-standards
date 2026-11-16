#!/usr/bin/env bun
// @version 1.0.0
/**
 * humanize-adapter.ts — the ONLY coupling point between this project and the
 * two Korean AI-tell clones (spec docs/designs/2026-11-16-humanize-external-design.md).
 *
 * Clones (project-local, gitignored, delivered by the external-deps machinery):
 *   external/humanize/   — https://github.com/5throck/Humanize (MIT) lint server + rules.js
 *   external/im-not-ai/  — https://github.com/epoko77-ai/im-not-ai (MIT) agent family + rulebook
 * Both are consumed AS-IS; agents call this adapter and never touch clone files.
 *
 * Usage:
 *   bun scripts/humanize/humanize-adapter.ts paths [--json]
 *   bun scripts/humanize/humanize-adapter.ts serve [--port N]
 *   bun scripts/humanize/humanize-adapter.ts analyze <file> [--url U] [--json]
 *   bun scripts/humanize/humanize-adapter.ts selftest
 * Global option: --project <dir> (default: process.cwd()).
 *
 * `analyze` is advisory: when the lint server is unreachable it prints
 * "humanize: lint unavailable (server unreachable)" and exits 0, so it can
 * never block a build.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const HUMANIZE_DIR = "external/humanize";
export const IM_NOT_AI_DIR = "external/im-not-ai";

const REFS = "skills/humanize-korean/references";

/** Key files the adapter relies on, relative to the project root. The
 *  im-not-ai agent file is a path INSIDE the clone (not a project agent), so it
 *  is joined from segments — keeps the project agent-reference lint from
 *  mistaking it for one of our own agents. */
export const KEY_FILES: ReadonlyArray<{ clone: string; path: string }> = [
  { clone: "humanize", path: `${HUMANIZE_DIR}/serve.ts` },
  { clone: "humanize", path: `${HUMANIZE_DIR}/rules.js` },
  { clone: "im-not-ai", path: [IM_NOT_AI_DIR, "agents", "humanize-monolith.md"].join("/") },
  { clone: "im-not-ai", path: `${IM_NOT_AI_DIR}/${REFS}/ai-tell-taxonomy.md` },
  { clone: "im-not-ai", path: `${IM_NOT_AI_DIR}/${REFS}/quick-rules.header.md` },
  { clone: "im-not-ai", path: `${IM_NOT_AI_DIR}/${REFS}/quick-rules.footer.md` },
];

export const DEFAULT_PORT = 8765;
export const UNAVAILABLE_MSG = "humanize: lint unavailable (server unreachable)";

export interface Finding {
  id: string;
  cat: string;
  name: string;
  severity: number;
  count: number;
}
/** Response shape of Humanize `POST /api/analyze` (rules.js analyze()). */
export interface AnalyzeResult {
  findings: Finding[];
  s1: number;
  s2: number;
  total: number;
}

export function resolveKeyFiles(projectDir: string): Array<{ clone: string; path: string; present: boolean }> {
  return KEY_FILES.map((f) => ({ ...f, present: existsSync(join(projectDir, f.path)) }));
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
  if (!existsSync(join(cwd, "serve.ts"))) {
    console.error(`humanize: clone missing at ${HUMANIZE_DIR} — run: bun scripts/external-deps.ts install --id humanize`);
    return 1;
  }
  const r = spawnSync("bun", ["serve.ts", "--port", String(port)], { cwd, stdio: "inherit" });
  return r.status ?? 1;
}

async function cmdAnalyze(file: string | undefined, url: string, json: boolean): Promise<number> {
  if (!file) {
    console.error("usage: analyze <file> [--url U] [--json]");
    return 2;
  }
  if (!existsSync(file)) {
    console.error(`humanize: file not found: ${file}`);
    return 2;
  }
  const text = readFileSync(file, "utf8");
  let result: AnalyzeResult;
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // Server reachable but rejected the input (empty / too long): report, never block.
      console.log(`humanize: lint skipped (HTTP ${res.status}: ${(await res.text()).slice(0, 200)})`);
      return 0;
    }
    result = (await res.json()) as AnalyzeResult;
  } catch {
    console.log(UNAVAILABLE_MSG);
    return 0;
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  console.log(`humanize: ${result.total} finding(s) (S1 ${result.s1}, S2 ${result.s2})`);
  for (const f of topPatterns(result)) console.log(`  [S${f.severity}] ${f.id} ${f.name} x${f.count}`);
  return 0;
}

function cmdSelftest(projectDir: string): number {
  const missing = missingKeyFiles(projectDir);
  if (missing.length === 0) {
    console.log(`humanize selftest: ok (${KEY_FILES.length} key files present)`);
    return 0;
  }
  console.error("humanize selftest: FAIL — missing key files:");
  for (const m of missing) console.error(`  ${m}`);
  return 1;
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
      const url = flag(rest, "--url") ?? process.env.HUMANIZE_URL ?? `http://localhost:${DEFAULT_PORT}`;
      return cmdAnalyze(file, url, json);
    }
    case "selftest":
      return cmdSelftest(projectDir);
    default:
      console.error("usage: humanize-adapter.ts <paths|serve|analyze|selftest> [options]");
      return 2;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
