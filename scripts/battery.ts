#!/usr/bin/env bun
// @version 1.1.0
// battery.ts — recorded-exit-code compensation battery (meeting 2026-11-20, issue B5)
//
// v1.1.0 (2026-11-25, T-20261124-017 — design
//   docs/designs/2026-11-24-fleet-test-baseline-design.md §4.5, ADR-0106): the
//   battery runs the CI command set. (1) Tests: `bun scripts/test-runner.ts all`,
//   the single fleet entry point, with the project as cwd. The `bun run test` and
//   `bun test` fallbacks are removed; a project without the runner records an
//   exit-1 row without spawning. Each test row carries the runner's
//   TEST-RUN-SUMMARY line as `summary` (the exit code stays the verdict). (2)
//   Dependency audit: `bun scripts/dependency-audit.ts` when that file exists,
//   the raw `bun audit` only when it does not — exactly what the CI
//   `Dependency Audit` job runs, waivers included. (3) The documentation audit is
//   its own command: `bun scripts/audit.ts` when the file exists. The
//   `hasScript("audit")` branch is removed. v1.0.0 ran the documentation audit in
//   the audit slot in 14 members and no dependency audit at all.
//
// v1.0.0 (2026-11-20, meeting-2026-11-20-batch-runner-hardening): the 2026-11-19
//   billing-wall exception merge (co-deck#252) was approved by a shell harness that
//   matched stdout patterns instead of the process exit code, so a failing suite
//   (exit 1) merged as if green. The prompt clause "bun audit (fail on high/critical)"
//   was likewise parsing, not asserting. This runner executes the battery, records
//   {cmd, exit, stdoutSha256} per command to a JSONL ledger, and FAILS on any non-zero
//   exit — output text is recorded for evidence, never used as the verdict.
//
// Usage:
//   bun scripts/battery.ts --project <dir> [--record <jsonl>] [--timeout <sec>]
//   bun scripts/battery.ts --project <dir> -- <extra command...>
//
// Exit codes: 0 all commands exited 0 · 1 at least one non-zero exit · 2 usage/IO
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

type Row = {
  at: string;
  project: string;
  cmd: string;
  exit: number;
  stdoutSha256: string;
  tail: string;
  /** The runner's TEST-RUN-SUMMARY line when the command printed one (v1.1.0). */
  summary?: string;
};

function die(msg: string): never {
  console.error(`✗ battery: ${msg}`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const flag = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const projectFlag = flag("project");
if (!projectFlag) die("requires --project <dir>");
if (!existsSync(projectFlag)) die(`project path does not exist: ${projectFlag}`);
const project: string = projectFlag;

const recordPath = flag("record");
const timeoutSec = Number(flag("timeout") ?? "900");
if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) die(`bad --timeout`);

const extraIdx = argv.indexOf("--");
const extra = extraIdx >= 0 ? argv.slice(extraIdx + 1) : [];

const hasFile = (rel: string): boolean => existsSync(join(project, rel));

const RUNNER = "scripts/test-runner.ts";
const commands: { cmd: string[]; skipSpawn?: boolean }[] = [];
// Dependency audit: the CI wrapper when the project carries it, else the raw command.
commands.push({
  cmd: hasFile("scripts/dependency-audit.ts") ? ["bun", "scripts/dependency-audit.ts"] : ["bun", "audit"],
});
// Documentation audit: its own command (v1.0.0 reached it only through the `audit` script).
if (hasFile("scripts/audit.ts")) commands.push({ cmd: ["bun", "scripts/audit.ts"] });
// Test suite: the single fleet entry point. A missing runner is a failed row, not a skip.
commands.push(hasFile(RUNNER) ? { cmd: ["bun", RUNNER, "all"] } : { cmd: ["bun", RUNNER, "all"], skipSpawn: true });
for (const e of extra) commands.push({ cmd: ["sh", "-c", e] });

const rows: Row[] = [];
let failures = 0;

for (const { cmd, skipSpawn } of commands) {
  const started = Date.now();
  let stdout = "";
  let exit = 1;
  try {
    if (skipSpawn) {
      stdout = `battery: ${RUNNER} is missing in the project — the fleet entry point cannot run`;
    } else {
      const proc = Bun.spawnSync(cmd, {
        cwd: project,
        stdout: "pipe",
        stderr: "pipe",
        timeout: timeoutSec * 1000,
      });
      stdout = `${proc.stdout?.toString() ?? ""}${proc.stderr?.toString() ?? ""}`;
      exit = proc.exitCode ?? 1;
    }
  } catch (e) {
    stdout = `spawn failed: ${(e as Error).message}`;
    exit = 1;
  }
  const sha = createHash("sha256").update(stdout).digest("hex");
  const tail = stdout.trim().split("\n").slice(-3).join(" ⏎ ").slice(0, 300);
  const summaryLine = stdout.split(/\r?\n/).find((l) => l.startsWith("TEST-RUN-SUMMARY "));
  const row: Row = { at: new Date().toISOString(), project, cmd: cmd.join(" "), exit, stdoutSha256: sha, tail };
  if (summaryLine) row.summary = summaryLine;
  rows.push(row);
  if (exit !== 0) failures += 1;
  const ms = Date.now() - started;
  console.log(`${exit === 0 ? "✓" : "✗"} ${cmd.join(" ")} → exit ${exit} (${ms}ms)`);
  if (exit !== 0) console.log(`    ${tail}`);
}

if (recordPath) {
  mkdirSync(dirname(recordPath), { recursive: true });
  appendFileSync(recordPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`✓ recorded ${rows.length} row(s) → ${recordPath}`);
}

if (failures > 0) {
  console.error(`✗ battery FAILED: ${failures}/${rows.length} command(s) exited non-zero — no merge on this evidence`);
  process.exit(1);
}
console.log(`✓ battery passed: ${rows.length}/${rows.length} commands exited 0`);
