/**
 * Bridge to the workspace scaffold engine, `scripts/new-project.ts` (ADR-0092 D4).
 * Subprocess boundary only: the engine executes at module top level (no importable API)
 * and rejects destinations outside the workspace clone, so tenants are scaffolded as
 * `Projects/<name>` and relocated to the data directory by the caller.
 */

import { resolve } from "node:path";
import { tail } from "./util";

export interface ScaffoldRequest {
  workspaceDir: string;
  variant: string;
  projectName: string;
  description?: string;
  country?: string;
  templateVersion?: string;
  timeoutMs?: number;
}

export function scaffoldArgs(req: ScaffoldRequest): string[] {
  const args = [
    "scripts/new-project.ts",
    req.projectName,
    "--variant",
    req.variant,
    "--platform",
    "hermes",
    "--type",
    "web",
    "--yes",
  ];
  if (req.description) args.push("--description", req.description.replace(/^-+/, "")); // SEC-11: no argv flag injection
  if (req.country) args.push("--country", req.country);
  if (req.templateVersion) args.push("--version", req.templateVersion);
  return args;
}

export interface ScaffoldResult {
  /** Directory the scaffold engine produced: `<workspaceDir>/Projects/<projectName>`. */
  sourceDir: string;
  stdoutTail: string;
  stderrTail: string;
}

export async function scaffoldProject(req: ScaffoldRequest): Promise<ScaffoldResult> {
  const proc = Bun.spawn([process.execPath, ...scaffoldArgs(req)], {
    cwd: req.workspaceDir,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    env: { ...process.env, CI: "1" },
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill(9);
    } catch {
      /* already exited */
    }
  }, req.timeoutMs ?? 600_000);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);

  if (exitCode !== 0) {
    const detail = timedOut
      ? `timed out after ${req.timeoutMs}ms`
      : `exit code ${exitCode}`;
    throw new Error(`new-project.ts ${detail}: ${tail(stderr || stdout)}`);
  }
  return {
    sourceDir: resolve(req.workspaceDir, "Projects", req.projectName),
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  };
}
