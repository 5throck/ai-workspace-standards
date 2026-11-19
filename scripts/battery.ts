#!/usr/bin/env bun
// @version 1.0.0
// battery.ts — recorded-exit-code compensation battery (meeting 2026-11-20, issue B5)
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

function hasScript(name: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(project, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return Boolean(pkg.scripts?.[name]);
  } catch {
    return false;
  }
}

const commands: string[][] = [];
// Dependency audit: prefer the project's own script if it exists, else bun audit.
commands.push(hasScript("audit") ? ["bun", "run", "audit"] : ["bun", "audit"]);
// Test suite: the project's own entry point, exit-code asserted.
commands.push(hasScript("test") ? ["bun", "run", "test"] : ["bun", "test"]);
for (const e of extra) commands.push(["sh", "-c", e]);

const rows: Row[] = [];
let failures = 0;

for (const cmd of commands) {
  const started = Date.now();
  let stdout = "";
  let exit = 1;
  try {
    const proc = Bun.spawnSync(cmd, {
      cwd: project,
      stdout: "pipe",
      stderr: "pipe",
      timeout: timeoutSec * 1000,
    });
    stdout = `${proc.stdout?.toString() ?? ""}${proc.stderr?.toString() ?? ""}`;
    exit = proc.exitCode ?? 1;
  } catch (e) {
    stdout = `spawn failed: ${(e as Error).message}`;
    exit = 1;
  }
  const sha = createHash("sha256").update(stdout).digest("hex");
  const tail = stdout.trim().split("\n").slice(-3).join(" ⏎ ").slice(0, 300);
  rows.push({ at: new Date().toISOString(), project, cmd: cmd.join(" "), exit, stdoutSha256: sha, tail });
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
