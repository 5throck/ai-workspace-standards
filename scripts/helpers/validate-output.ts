#!/usr/bin/env bun
/**
 * validate-output.ts — Evaluate validate-templates.ts --json output against the mandatory lifecycle domains
 * @version 1.1.0
 *
 * v1.1.0 (2026-11-17, design docs/designs/2026-11-17-new-project-precheck-argv-design.md, T-20261117-009):
 *   - Import-safe: all CLI work runs under import.meta.main.
 *   - Exports evaluateValidationOutput / describeSpawnFailure / runGovernancePrecheck so new-project.ts
 *     evaluates the validator JSON in-process (no argv payload, no 32K Windows command-line limit).
 *   - CLI reads the JSON from stdin when the JSON argument is "-" or absent; new --variant <name> option
 *     scopes blocking errors to that variant plus "common".
 *   - Unparsable input is no longer a silent pass: exit 2 (fail-closed).
 *
 * Usage:
 *   bun scripts/helpers/validate-output.ts <domains> [<json> | -] [--variant <name>]
 *
 * Exits with:
 *   0 no mandatory domain errors
 *   1 mandatory domain errors found (each printed to stderr)
 *   2 input is not parsable validate-templates JSON
 */

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PrecheckIssue {
  variant?: string;
  check?: string;
  message?: string;
  fix?: string;
}

export type PrecheckVerdict =
  | { kind: "pass"; blocking: []; outOfScope: PrecheckIssue[] }
  | { kind: "blocked"; blocking: PrecheckIssue[]; outOfScope: PrecheckIssue[] }
  | { kind: "unparsable"; reason: string; preview: string };

const PREVIEW_CHARS = 200;
const VALIDATOR_MAX_BUFFER = 16 * 1024 * 1024;
const DEFAULT_DOMAINS = "variant,agent,skill";

/** Pure. Parses validate-templates --json text and partitions mandatory-domain errors. */
export function evaluateValidationOutput(
  jsonText: string,
  opts: { mandatoryDomains: string[]; variant?: string },
): PrecheckVerdict {
  const preview = jsonText.slice(0, PREVIEW_CHARS);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    return { kind: "unparsable", reason: error instanceof Error ? error.message : String(error), preview };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "unparsable", reason: "top-level JSON value is not an object", preview };
  }
  const errors = (parsed as { errors?: unknown }).errors;
  if (errors !== undefined && !Array.isArray(errors)) {
    return { kind: "unparsable", reason: '"errors" is not an array', preview };
  }

  const blocking: PrecheckIssue[] = [];
  const outOfScope: PrecheckIssue[] = [];
  for (const err of (errors ?? []) as PrecheckIssue[]) {
    const check = err?.check ?? "";
    if (!opts.mandatoryDomains.some((domain) => check.includes(domain))) continue;
    const inScope = opts.variant === undefined || err.variant === opts.variant || err.variant === "common";
    (inScope ? blocking : outOfScope).push(err);
  }
  if (blocking.length > 0) return { kind: "blocked", blocking, outOfScope };
  return { kind: "pass", blocking: [], outOfScope };
}

/** Pure. Returns a one-paragraph failure description, or null when the spawn ran normally. */
export function describeSpawnFailure(label: string, result: SpawnSyncReturns<string>): string | null {
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code ?? "unknown";
    return `${label} could not start: ${code} (${result.error.message})`;
  }
  if (result.status === null) {
    return `${label} was terminated by signal ${result.signal ?? "unknown"}`;
  }
  if (!result.stdout) {
    const tail = (result.stderr ?? "").trimEnd().split("\n").slice(-20).join("\n");
    return `${label} exited ${result.status} with no output${tail ? `:\n${tail}` : ""}`;
  }
  return null;
}

/** Runs the whole lifecycle governance pre-check. spawn is injectable for tests. */
export function runGovernancePrecheck(opts: { workspaceRoot: string; variant: string; spawn?: typeof spawnSync }): {
  ok: boolean;
  mandatoryDomains: string;
  lines: string[];
} {
  const spawn = opts.spawn ?? spawnSync;
  const { workspaceRoot, variant } = opts;
  const lines: string[] = [];
  const repro = `bun scripts/validate-templates.ts --variant ${variant}`;

  let mandatoryDomains = DEFAULT_DOMAINS;
  const gov = spawn(process.execPath, [join(workspaceRoot, "scripts", "helpers", "lifecycle-governance.ts")], {
    encoding: "utf8",
  });
  const govFailure = describeSpawnFailure("lifecycle-governance.ts", gov);
  if (gov.status === 0 && !govFailure) {
    mandatoryDomains = gov.stdout.trim() || DEFAULT_DOMAINS;
  } else {
    const reason = govFailure ?? `lifecycle-governance.ts exited ${gov.status}`;
    lines.push(`  ⚠️  ${reason}; using default domains ${DEFAULT_DOMAINS}`);
  }

  const validate = spawn(
    process.execPath,
    [join(workspaceRoot, "scripts", "validate-templates.ts"), "--variant", variant, "--json"],
    { encoding: "utf8", maxBuffer: VALIDATOR_MAX_BUFFER },
  );
  const spawnFailure = describeSpawnFailure("validate-templates.ts", validate);
  if (spawnFailure) {
    lines.push(`  ❌ ${spawnFailure}`, `  Run: ${repro}`);
    return { ok: false, mandatoryDomains, lines };
  }

  const verdict = evaluateValidationOutput(validate.stdout, {
    mandatoryDomains: mandatoryDomains.split(","),
    variant,
  });
  if (verdict.kind === "unparsable") {
    lines.push(
      `  ❌ validate-templates.ts output is not valid JSON: ${verdict.reason}`,
      `     stdout starts with: ${JSON.stringify(verdict.preview)}`,
      `  Run: ${repro} --json`,
    );
    return { ok: false, mandatoryDomains, lines };
  }

  if (verdict.outOfScope.length > 0) {
    lines.push(
      `  ${verdict.outOfScope.length} finding(s) outside ${variant}/common — not blocking; run bun scripts/validate-templates.ts`,
    );
  }
  if (verdict.kind === "blocked") {
    for (const err of verdict.blocking) {
      lines.push(`  ❌ [${err.check ?? "unknown"}] ${err.message ?? "unknown error"}`);
      if (err.fix) lines.push(`     fix: ${err.fix}`);
    }
    lines.push(`  Run: ${repro}`);
    return { ok: false, mandatoryDomains, lines };
  }
  return { ok: true, mandatoryDomains, lines };
}

function main(argv: string[]): number {
  const args = [...argv];
  let variant: string | undefined;
  const vi = args.indexOf("--variant");
  if (vi !== -1) {
    variant = args[vi + 1];
    args.splice(vi, 2);
  }
  const [domainsArg, ...rest] = args;
  if (!domainsArg) {
    console.error("Usage: bun validate-output.ts <comma-separated-domains> [<json-string> | -] [--variant <name>]");
    return 1;
  }
  const jsonArg = rest.join(" ");
  const jsonText = jsonArg && jsonArg !== "-" ? jsonArg : readFileSync(0, "utf-8");
  const verdict = evaluateValidationOutput(jsonText, { mandatoryDomains: domainsArg.split(","), variant });

  if (verdict.kind === "unparsable") {
    console.error(`ERROR: Could not parse validation output: ${verdict.reason}`);
    console.error(`  input starts with: ${JSON.stringify(verdict.preview)}`);
    return 2;
  }
  if (verdict.kind === "blocked") {
    for (const err of verdict.blocking) {
      console.error(`  ❌ ${err.message || err.check || "unknown error"}`);
    }
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
