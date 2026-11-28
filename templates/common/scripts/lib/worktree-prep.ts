#!/usr/bin/env bun
/**
 * Worktree environment prep — dev-sync self-provisioning helpers.
 * @version 1.0.0
 */
// v1.0.0 (2026-11-28, U-20261128-005 — spec
//           docs/designs/2026-11-28-sync-worktree-robustness-design.md §5):
//           fresh-worktree provisioning was an operator secret (nested
//           `bun install`, the gitignored .venv) — every fresh-worktree run
//           failed noisily before a hand-provision pass. dev-sync now
//           self-provisions through this generic, variant-agnostic lib (the
//           core script carries no variant names; variant behavior is declared
//           in the variant-owned variant.json and executed from the
//           variant-owned script — AGENTS.md pluggable-hook rule):
//             - enumerateNestedPackages(root): depth-2 package.json scan,
//               excluding external/ (vendored trees own their install story),
//               Projects/, node_modules interiors, and dot-dirs; entries carry
//               hasNodeModules and the runner installs only the absent ones
//               (warm runs stay zero-cost).
//             - pythonProvisionCommand(variantJson): reads the optional
//               script_manifest.provision.python manifest field.
//             - runEnvironmentPrep(root, opts): the runner — no-op unless
//               <root>/variant.json exists (a workspace-root sync can therefore
//               never bun install inside Projects/*); nested installs run once
//               (absent-node_modules gate); the Python env provision runs only
//               when <root>/.venv/bin/python3 is absent AND the manifest
//               declares the hook (`bun <path> --soft` — the provisioner is
//               stamp-idempotent and --soft degrades a failure to a warning so
//               a wheel-download hiccup never blocks a docs-only sync);
//               otherwise silent skip. NOTHING is mirrored (no .env, no .venv
//               copy — provisioning replaces mirroring entirely).

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface NestedPackageEntry {
  /** Absolute dir carrying package.json. */
  dir: string;
  /** Dir name relative to root (diagnostics). */
  name: string;
  /** True when <dir>/node_modules already exists (install already provisioned). */
  hasNodeModules: boolean;
}

export interface EnvironmentPrepReport {
  /** True when the step no-oped because <root>/variant.json does not exist (workspace-root context). */
  disabled: boolean;
  /** Nested package dirs where `bun install` was run (or planned, in dry-run). */
  nestedInstalled: string[];
  /** Nested package dirs skipped because node_modules already exists. */
  nestedSkipped: string[];
  /** "ran" = provision hook executed; "present" = .venv already provisioned; "undeclared" = no manifest hook; "failed-soft" = hook ran and exited non-zero (non-fatal); "planned" = dry-run. */
  python: "ran" | "present" | "undeclared" | "failed-soft" | "planned";
  /** The declared provision script path (when any). */
  pythonCommand: string | null;
  /** Non-fatal failure notes (nested install exit codes, python --soft failure). */
  warnings: string[];
}

const EXCLUDED_DIR_NAMES = new Set(["external", "Projects", "node_modules"]);

function isExcludedDir(name: string): boolean {
  return EXCLUDED_DIR_NAMES.has(name) || name.startsWith(".");
}

/** Depth-2 package.json scan of `root` — every nested package dir, with
 * hasNodeModules so callers can filter to the install-needed set. Excludes
 * external/, Projects/, node_modules interiors, and dot-dirs at every level. */
export function enumerateNestedPackages(root: string): NestedPackageEntry[] {
  const out: NestedPackageEntry[] = [];
  let level1: string[];
  try {
    level1 = readdirSync(root);
  } catch {
    return out;
  }
  for (const l1 of level1) {
    if (isExcludedDir(l1)) continue;
    const l1Path = join(root, l1);
    let l1Stat: import("node:fs").Stats;
    try {
      l1Stat = statSync(l1Path);
    } catch {
      continue;
    }
    if (!l1Stat.isDirectory()) continue;
    if (existsSync(join(l1Path, "package.json"))) {
      out.push({ dir: l1Path, name: l1, hasNodeModules: existsSync(join(l1Path, "node_modules")) });
    }
    let level2: string[];
    try {
      level2 = readdirSync(l1Path);
    } catch {
      continue;
    }
    for (const l2 of level2) {
      if (isExcludedDir(l2)) continue;
      const l2Path = join(l1Path, l2);
      let l2Stat: import("node:fs").Stats;
      try {
        l2Stat = statSync(l2Path);
      } catch {
        continue;
      }
      if (!l2Stat.isDirectory()) continue;
      if (existsSync(join(l2Path, "package.json"))) {
        out.push({ dir: l2Path, name: `${l1}/${l2}`, hasNodeModules: existsSync(join(l2Path, "node_modules")) });
      }
    }
  }
  return out;
}

export interface PythonProvision {
  /** The declared script path (variant-owned), e.g. scripts/<variant>/setup-python-env.ts. */
  script: string;
}

/** Reads the optional `script_manifest.provision.python` field. Absent or
 * malformed manifests yield null (variants without Python deps are unaffected). */
export function pythonProvisionCommand(variantJson: unknown): PythonProvision | null {
  if (variantJson === null || typeof variantJson !== "object") return null;
  const manifest = (variantJson as Record<string, unknown>).script_manifest;
  if (manifest === null || typeof manifest !== "object") return null;
  const provision = (manifest as Record<string, unknown>).provision;
  if (provision === null || typeof provision !== "object") return null;
  const python = (provision as Record<string, unknown>).python;
  if (typeof python !== "string" || python.trim() === "") return null;
  return { script: python.trim() };
}

export interface RunEnvironmentPrepOpts {
  /** Injectable executor (unit tests); default spawns via Bun. cmd is ["bun", ...args]. */
  exec?: (cmd: string[], cwd: string) => Promise<{ exitCode: number; stderr?: string }>;
  /** Plan-only: report what would run without spawning anything. */
  dryRun?: boolean;
}

/** The runner behind dev-sync's environment-prep step. Idempotent across
 * repeated runs: warm fixtures enumerate to no install-needed dirs and
 * provision "present". */
export async function runEnvironmentPrep(
  root: string,
  opts: RunEnvironmentPrepOpts = {},
): Promise<EnvironmentPrepReport> {
  const report: EnvironmentPrepReport = {
    disabled: false,
    nestedInstalled: [],
    nestedSkipped: [],
    python: "undeclared",
    pythonCommand: null,
    warnings: [],
  };
  const variantJsonPath = join(root, "variant.json");
  if (!existsSync(variantJsonPath)) {
    report.disabled = true;
    return report;
  }
  const exec =
    opts.exec ??
    (async (cmd: string[], cwd: string) => {
      const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
      const exitCode = await proc.exited;
      return { exitCode, stderr: await new Response(proc.stderr).text() };
    });

  // 1. Nested installs (design §5.3 step 1) — install only where node_modules
  //    is absent; present dirs are reported as skipped (zero-cost warm runs).
  for (const entry of enumerateNestedPackages(root)) {
    if (entry.hasNodeModules) {
      report.nestedSkipped.push(entry.dir);
      continue;
    }
    if (opts.dryRun) {
      report.nestedInstalled.push(entry.dir);
      continue;
    }
    const res = await exec(["bun", "install"], entry.dir);
    if (res.exitCode === 0) {
      report.nestedInstalled.push(entry.dir);
    } else {
      report.warnings.push(
        `bun install in ${entry.dir} exited ${res.exitCode}${res.stderr ? `: ${res.stderr.trim().split("\n")[0]}` : ""}`,
      );
    }
  }

  // 2. Python env via the variant-declared hook (design §5.3 step 2).
  let variantJson: unknown = null;
  try {
    variantJson = JSON.parse(await Bun.file(variantJsonPath).text());
  } catch (err) {
    report.warnings.push(`variant.json unparseable, python provision skipped: ${(err as Error).message}`);
  }
  const provision = pythonProvisionCommand(variantJson);
  const venvPython = join(root, ".venv", "bin", "python3");
  if (existsSync(venvPython)) {
    report.python = "present";
    report.pythonCommand = provision?.script ?? null;
  } else if (provision) {
    report.pythonCommand = provision.script;
    if (opts.dryRun) {
      report.python = "planned";
    } else {
      const scriptPath = join(root, provision.script);
      if (!existsSync(scriptPath)) {
        report.warnings.push(`provision script missing: ${provision.script} — python env not provisioned (non-fatal)`);
        report.python = "failed-soft";
      } else {
        const res = await exec(["bun", provision.script, "--soft"], root);
        if (res.exitCode === 0) {
          report.python = "ran";
        } else {
          report.python = "failed-soft";
          report.warnings.push(
            `provision hook ${provision.script} --soft exited ${res.exitCode} (non-fatal; provision locally when Python-dependent suites must run)`,
          );
        }
      }
    }
  }
  return report;
}
