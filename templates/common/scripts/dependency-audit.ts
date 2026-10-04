#!/usr/bin/env bun
/**
 * dependency-audit.ts — Fleet dependency-vulnerability gate with a reviewed
 * advisory-waiver channel (T-20261003-011).
 * @version 1.1.0
 *
 * Replaces the inline `bun audit` severity grep in the CI dependency-audit job
 * (templates/common/.github/workflows/ci.yml). Gate semantics are unchanged:
 * fail on any high/critical finding, report low/moderate, and treat empty or
 * unparseable audit output as a loud infrastructure failure.
 *
 * v1.0.0 (2026-10-03, T-20261003-011):
 *  - Advisory-waiver channel: a project may carry .github/dependency-waivers.toml
 *    (same reviewed-exception precedent as the gitleaks allowlist configs) to
 *    suppress specific no-fix advisories. Strict schema; unknown keys, bad
 *    types, malformed dates, duplicate waivers, and expired revisit-by dates
 *    all FAIL CLOSED.
 *  - Stale-waiver guard: every waiver must match a finding still present in
 *    the audit output (package + GHSA advisory id); a waiver whose advisory
 *    no longer appears FAILS the run so the entry is reviewed and removed
 *    instead of silently rotting.
 *  - Version-drift guard: when node_modules carries the waived package, the
 *    installed version must equal the waiver's pinned version — a changed
 *    tree invalidates the recorded decision.
 *  - Scope contradiction guard: a `dev-only` waiver for a package declared in
 *    package.json `dependencies` (production) FAILS.
 *
 * Waiver file (.github/dependency-waivers.toml) — ONLY `[[waiver]]` entries:
 *
 *   [[waiver]]
 *   advisory   = "GHSA-xxxx-xxxx-xxxx"   # GitHub Security Advisory id (required)
 *   package    = "braces"                # affected npm package name (required)
 *   version    = "3.0.3"                 # exact installed version pin (required)
 *   scope      = "dev-only"              # dev-only | production (required)
 *   reason     = "no upstream fix; ..."  # non-empty rationale (required)
 *   decided_by = "T-... ticket / review" # non-empty review note (required)
 *   revisit_by = "2027-01-03"            # mandatory revisit date (required)
 *
 * v1.1.0 (2026-10-05, T-20261004-029):
 *  - Manifest-skip: a repository with no root package.json (docs-only projects
 *    like co-safety, which declare no npm dependencies) now SKIPS with a
 *    notice instead of failing on bun's "No package.json was found" error —
 *    the gate audits declared npm dependencies, and an absent manifest means
 *    there is nothing to audit.
 *
 * Usage:
 *   bun scripts/dependency-audit.ts [--waiver-file <path>]
 *
 * Exit codes: 0 = pass (or skipped: nothing to audit), 1 = fail (finding, waiver, or infrastructure).
 */

import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';

const VERSION = '1.1.0';

const DEFAULT_WAIVER_FILE = path.join('.github', 'dependency-waivers.toml');
const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low'];
/** Severities that trip the gate (matches the L0 root gate threshold). */
const FAILING_SEVERITIES = new Set(['critical', 'high']);

/** One advisory record as emitted by `bun audit --json`. */
export interface AuditAdvisory {
  id: number | string;
  url?: string;
  title?: string;
  severity?: string;
  vulnerable_versions?: string;
}

/** `bun audit --json` top level: package name -> advisory list. */
export type AuditFindings = Record<string, AuditAdvisory[]>;

export interface Waiver {
  advisory: string;
  package: string;
  version: string;
  scope: 'dev-only' | 'production';
  reason: string;
  decided_by: string;
  revisit_by: string;
}

/** Error subclass so the gate can distinguish waiver/policy failures from infra ones. */
export class GateError extends Error {}

function fail(message: string): never {
  console.error(`[FAIL] ${message}`);
  throw new GateError(message);
}

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────

/** Extract the GHSA advisory id from a bun advisory URL (or any string). */
export function extractGhsa(value: string | undefined): string | null {
  if (!value) return null;
  const m = value.match(/GHSA(?:-[23456789cfghjmpqrvwx]{4}){3,4}/i);
  return m ? m[0].toUpperCase() : null;
}

/** Strict `YYYY-MM-DD` validation (real calendar date, not just the shape). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, mo, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Strict waiver-file parse + schema validation.
 * Throws Error on ANY deviation — the channel must fail closed, never loosen.
 * Only top-level key allowed: `waiver` (array of tables).
 */
export function parseWaiverFile(text: string): Waiver[] {
  let parsed: unknown;
  try {
    parsed = Bun.TOML.parse(text);
  } catch (e) {
    throw new Error(
      `waiver file is not valid TOML (fail-closed): ${(e as Error).message}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('waiver file must be a TOML table with [[waiver]] entries');
  }
  const root = parsed as Record<string, unknown>;
  for (const key of Object.keys(root)) {
    if (key !== 'waiver') {
      throw new Error(
        `unknown top-level key "${key}" — only [[waiver]] entries are allowed (strict schema)`,
      );
    }
  }
  const rawList = root['waiver'];
  if (rawList === undefined) return [];
  if (!Array.isArray(rawList)) {
    throw new Error('"waiver" must be an array of tables ([[waiver]])');
  }

  const REQUIRED: Array<{ key: keyof Waiver; kind: 'string' }> = [
    { key: 'advisory', kind: 'string' },
    { key: 'package', kind: 'string' },
    { key: 'version', kind: 'string' },
    { key: 'scope', kind: 'string' },
    { key: 'reason', kind: 'string' },
    { key: 'decided_by', kind: 'string' },
    { key: 'revisit_by', kind: 'string' },
  ];
  const ALLOWED_KEYS = new Set(REQUIRED.map((r) => r.key as string));

  const waivers: Waiver[] = [];
  rawList.forEach((raw, i) => {
    const where = `waiver[${i}]`;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`${where} must be a [[waiver]] table`);
    }
    const entry = raw as Record<string, unknown>;
    for (const key of Object.keys(entry)) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new Error(`${where}: unknown key "${key}" (strict schema)`);
      }
    }
    for (const { key } of REQUIRED) {
      const v = entry[key];
      if (typeof v !== 'string' || v.trim() === '') {
        throw new Error(`${where}: "${key}" is required and must be a non-empty string`);
      }
    }

    const advisory = String(entry['advisory']).trim().toUpperCase();
    if (!/^GHSA(?:-[0-9A-Z]{4}){3,4}$/.test(advisory)) {
      throw new Error(`${where}: "advisory" must be a GHSA id (GHSA-xxxx-xxxx-xxxx), got "${advisory}"`);
    }
    const pkg = String(entry['package']).trim();
    if (!/^[@a-zA-Z0-9._/-]+$/.test(pkg)) {
      throw new Error(`${where}: "package" does not look like an npm package name: "${pkg}"`);
    }
    const version = String(entry['version']).trim();
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
      throw new Error(`${where}: "version" must be an exact semver pin (x.y.z), got "${version}"`);
    }
    const scope = String(entry['scope']).trim();
    if (scope !== 'dev-only' && scope !== 'production') {
      throw new Error(`${where}: "scope" must be "dev-only" or "production", got "${scope}"`);
    }
    const revisit = String(entry['revisit_by']).trim();
    if (!isValidIsoDate(revisit)) {
      throw new Error(`${where}: "revisit_by" must be a valid YYYY-MM-DD date, got "${revisit}"`);
    }

    waivers.push({
      advisory,
      package: pkg,
      version,
      scope: scope as Waiver['scope'],
      reason: String(entry['reason']).trim(),
      decided_by: String(entry['decided_by']).trim(),
      revisit_by: revisit,
    });
  });

  // Duplicate waivers are a review smell — each entry must be a distinct decision.
  const seen = new Set<string>();
  for (const w of waivers) {
    const key = `${w.advisory}|${w.package}`;
    if (seen.has(key)) {
      throw new Error(`duplicate waiver for ${key} — one decision per advisory/package`);
    }
    seen.add(key);
  }
  return waivers;
}

/** A waiver past its revisit-by date fails the run (forces review). */
export function expiredWaivers(waivers: Waiver[], todayIso: string): Waiver[] {
  return waivers.filter((w) => w.revisit_by < todayIso);
}

export interface MatchResult {
  /** Findings suppressed by a matching waiver (visible in output, never silent). */
  suppressed: Array<{ pkg: string; advisory: AuditAdvisory; waiver: Waiver }>;
  /** Waivers that matched no remaining finding — stale, fail-closed. */
  stale: Waiver[];
  /** Waivers whose pinned version differs from the installed one — stale, fail-closed. */
  versionDrift: Array<{ waiver: Waiver; installed: string }>;
  /** Findings still standing after suppression. */
  remaining: Array<{ pkg: string; advisory: AuditAdvisory }>;
}

/** Installed version of a package from node_modules, or null when unavailable. */
export function installedVersion(pkg: string, repoRoot = '.'): string | null {
  const pkgJson = path.join(repoRoot, 'node_modules', ...pkg.split('/'), 'package.json');
  if (!existsSync(pkgJson)) return null;
  try {
    const data = JSON.parse(readFileSync(pkgJson, 'utf-8'));
    return typeof data?.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

/**
 * Match waivers against findings.
 * A waiver applies when the package name AND the advisory GHSA id match.
 */
export function matchWaivers(
  findings: AuditFindings,
  waivers: Waiver[],
  repoRoot = '.',
): MatchResult {
  const result: MatchResult = { suppressed: [], stale: [], versionDrift: [], remaining: [] };
  const remainingPerPkg: Record<string, AuditAdvisory[]> = {};
  for (const [pkg, advisories] of Object.entries(findings)) {
    remainingPerPkg[pkg] = [...advisories];
  }

  for (const waiver of waivers) {
    const candidates = remainingPerPkg[waiver.package] ?? [];
    const idx = candidates.findIndex((a) => extractGhsa(a.url) === waiver.advisory);
    if (idx === -1) {
      result.stale.push(waiver);
      continue;
    }
    const advisory = candidates[idx];
    const installed = installedVersion(waiver.package, repoRoot);
    if (installed === null) {
      console.warn(
        `[WARN] waiver ${waiver.advisory} (${waiver.package}): installed version unavailable (no node_modules) — version pin ${waiver.version} not verified`,
      );
    } else if (installed !== waiver.version) {
      result.versionDrift.push({ waiver, installed });
      continue;
    }
    candidates.splice(idx, 1);
    result.suppressed.push({ pkg: waiver.package, advisory, waiver });
  }

  for (const [pkg, advisories] of Object.entries(remainingPerPkg)) {
    for (const advisory of advisories) {
      result.remaining.push({ pkg, advisory });
    }
  }
  return result;
}

/** Unknown severity strings are treated as high — fail closed on surprises. */
export function normalizeSeverity(severity: string | undefined): string {
  const s = String(severity ?? '').toLowerCase();
  return SEVERITY_ORDER.includes(s) ? s : 'high';
}

/** `dev-only` waiver for a package declared in production dependencies is a contradiction. */
export function scopeContradictions(
  waivers: Waiver[],
  packageJson: Record<string, unknown>,
): string[] {
  const deps = (packageJson['dependencies'] ?? {}) as Record<string, unknown>;
  const contradictions: string[] = [];
  for (const w of waivers) {
    if (w.scope === 'dev-only' && Object.prototype.hasOwnProperty.call(deps, w.package)) {
      contradictions.push(
        `${w.advisory} (${w.package}) is waived as dev-only but is declared in package.json "dependencies" (production)`,
      );
    }
  }
  return contradictions;
}

// ── Orchestration ────────────────────────────────────────────────────────────

async function runBunAudit(): Promise<string> {
  const proc = Bun.spawn(['bun', 'audit', '--json'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  if (stdout.trim() === '') {
    const stderr = await new Response(proc.stderr).text();
    fail(
      `bun audit produced no stdout output (possible registry/infrastructure failure). stderr: ${
        stderr.trim().split('\n')[0] || '(empty)'
      }`,
    );
  }
  return stdout;
}

/** Parse the audit JSON. Noise on surrounding lines is tolerated; garbage is not. */
export function parseAuditJson(output: string): AuditFindings {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed) as AuditFindings;
  } catch {
    // fall through: scan for an embedded JSON object (bun logs may prefix lines)
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as AuditFindings;
    } catch {
      // fall through to the loud failure below
    }
  }
  throw new GateError('bun audit output is not valid JSON (infrastructure failure) — refusing to guess');
}

function loadPackageJson(repoRoot = '.'): Record<string, unknown> {
  const p = path.join(repoRoot, 'package.json');
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

function printHelp(): void {
  console.log(`dependency-audit.ts v${VERSION} — fleet dependency-vulnerability gate with advisory waivers

Usage:
  bun scripts/dependency-audit.ts [--waiver-file <path>]

Behavior:
  - Skips with a notice (exit 0) when the repo has no root package.json —
    nothing to audit (T-20261004-029).
  - Runs \`bun audit --json\`; fails on empty/unparseable output (infrastructure).
  - Fails on any remaining high/critical finding; reports low/moderate.
  - Suppresses findings matching a reviewed waiver in
    ${DEFAULT_WAIVER_FILE} (override with --waiver-file).
  - FAILS CLOSED on: malformed waiver file, unknown keys, expired revisit-by
    date, stale waiver (advisory no longer in audit output), version drift,
    duplicate waivers, dev-only scope contradiction.
`);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  let waiverFile = DEFAULT_WAIVER_FILE;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      return 0;
    }
    if (args[i] === '--waiver-file') {
      waiverFile = args[i + 1] ?? '';
      i++;
      continue;
    }
    console.error(`[FAIL] unknown argument: ${args[i]} (see --help)`);
    return 1;
  }
  if (!waiverFile) {
    console.error('[FAIL] --waiver-file requires a path');
    return 1;
  }

  // 0. Manifest-skip (T-20261004-029): a repo with no root package.json has no
  //    declared npm dependencies to audit — passing with a notice is correct,
  //    not a gate bypass (bun audit itself would hard-error on the same input).
  if (!existsSync(path.join(process.cwd(), 'package.json'))) {
    console.log(
      '[SKIP] no package.json at repo root — no declared npm dependencies to audit; gate not applicable (passing with notice).',
    );
    return 0;
  }

  // 1. Audit output first — an infra failure must surface even with a bad waiver file.
  const auditOutput = await runBunAudit();
  let findings: AuditFindings;
  try {
    findings = parseAuditJson(auditOutput);
  } catch (e) {
    console.error(`[FAIL] ${(e as Error).message}`);
    return 1;
  }
  const totalFindings = Object.values(findings).reduce((n, list) => n + list.length, 0);
  console.log(`bun audit: ${totalFindings} advisory finding(s) across ${Object.keys(findings).length} package(s)`);

  // 2. Load the waiver channel (optional file, strict parse).
  let waivers: Waiver[] = [];
  if (existsSync(waiverFile)) {
    console.log(`Waiver file: ${waiverFile}`);
    try {
      waivers = parseWaiverFile(readFileSync(waiverFile, 'utf-8'));
    } catch (e) {
      console.error(`[FAIL] ${(waiverFile)}: ${(e as Error).message}`);
      return 1;
    }
    console.log(`Waivers loaded: ${waivers.length}`);
  } else {
    console.log(`Waiver file: ${waiverFile} (absent — no waivers in effect)`);
  }

  // 3. Fail-closed waiver policy checks that do not need findings.
  const todayIso = new Date().toISOString().slice(0, 10);
  const expired = expiredWaivers(waivers, todayIso);
  if (expired.length > 0) {
    console.error('[FAIL] expired waiver(s) — past their revisit-by date, review required:');
    for (const w of expired) {
      console.error(`       - ${w.advisory} (${w.package} ${w.version}) revisit_by=${w.revisit_by} decided_by=${w.decided_by}`);
    }
    return 1;
  }
  const contradictions = scopeContradictions(waivers, loadPackageJson());
  if (contradictions.length > 0) {
    console.error('[FAIL] waiver scope contradiction(s):');
    for (const c of contradictions) console.error(`       - ${c}`);
    return 1;
  }

  // 4. Match waivers against findings; stale/missing matches fail closed.
  const match = matchWaivers(findings, waivers);
  if (match.versionDrift.length > 0) {
    console.error('[FAIL] waiver version drift — the recorded decision no longer matches the tree, review required:');
    for (const { waiver, installed } of match.versionDrift) {
      console.error(`       - ${waiver.advisory} (${waiver.package}): pinned ${waiver.version}, installed ${installed}`);
    }
    return 1;
  }
  if (match.stale.length > 0) {
    console.error('[FAIL] stale waiver(s) — advisory/package no longer present in audit output, remove the waiver via review:');
    for (const w of match.stale) {
      console.error(`       - ${w.advisory} (${w.package} ${w.version}) revisit_by=${w.revisit_by}`);
    }
    return 1;
  }

  if (match.suppressed.length > 0) {
    console.log(`Waived findings (reviewed suppression — ${match.suppressed.length}):`);
    for (const { pkg, advisory, waiver } of match.suppressed) {
      console.log(
        `  [WAIVED] ${pkg} ${waiver.version} — ${waiver.advisory} (${normalizeSeverity(advisory.severity)}) scope=${waiver.scope} revisit_by=${waiver.revisit_by}`,
      );
      console.log(`           reason: ${waiver.reason} | decided_by: ${waiver.decided_by}`);
    }
  }

  // 5. Severity gate over the remaining findings (threshold parity with the L0 gate).
  const remaining = match.remaining;
  const failing = remaining.filter((f) => FAILING_SEVERITIES.has(normalizeSeverity(f.advisory.severity)));
  if (failing.length > 0) {
    console.error(`[FAIL] ${failing.length} high/critical vulnerabilit(y/ies) not covered by any waiver:`);
    for (const { pkg, advisory } of failing) {
      console.error(`       - ${pkg} — ${advisory.title ?? '(untitled)'} (${extractGhsa(advisory.url) ?? advisory.id}, ${advisory.severity})`);
      if (advisory.url) console.error(`         ${advisory.url}`);
    }
    return 1;
  }

  const reported = remaining.filter((f) => !FAILING_SEVERITIES.has(normalizeSeverity(f.advisory.severity)));
  if (reported.length > 0) {
    console.log(`Non-failing findings reported (low/moderate only — informational):`);
    for (const { pkg, advisory } of reported) {
      console.log(`  [REPORTED] ${pkg} — ${advisory.title ?? '(untitled)'} (${extractGhsa(advisory.url) ?? advisory.id}, ${advisory.severity})`);
    }
  }

  console.log('Security check passed (no high/critical vulnerabilities outside reviewed waivers).');
  return 0;
}

process.exitCode = await main();
