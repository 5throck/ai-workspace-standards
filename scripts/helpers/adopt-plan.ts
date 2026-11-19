#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-11-20, T-20261120-001 — design
//          docs/designs/2026-11-20-adoption-gaps-batch-design.md): settling helpers for
//          the four verified adoption gaps — context-overlay stack substitution
//          (applyStackSubstitutions + parseStackArg), unfilled-stub detection
//          (detectContextOverlayStubs), report-only L2-root-artifact hygiene scan
//          (ADOPTION_HYGIENE_ROOT_ARTIFACTS + scanHygieneRootArtifacts), and
//          pre-standard docs/context.md assessment (assessContextStandardVersion).
// v1.0.0 (2026-09-23, adopt-project conversion — spec 2026-09-23-adopt-project-conversion):
//          pure scan/plan logic for the adopt-project conversion flow (external project →
//          workspace standard, in place). No filesystem writes, no subprocesses — every
//          function takes its inputs as paths/lists so the whole module is unit-testable
//          without a TTY (meeting finding: Architect R1 #6, plan-builder/plan-executor split).
/**
 * Adopt-plan: derive WHAT a conversion will do before doing it.
 *
 * The delivery engine (scripts/upgrade-project.ts) resolves conflicts off git-dirt and
 * recorded versions — both absent in a never-scaffolded foreign project — so adopt must
 * pre-declare every collision itself (meeting P0-1/P0-2): this module derives the FULL
 * delivered-path set from the upgrade-policy SSOT (iterEffectiveTemplateFiles +
 * resolveClaim), finds foreign files at those paths, and inventories the traces the
 * interactive confirmation presents (workflow artifacts, hook managers, secret-shaped
 * tracked files, foreign skills needing manifest protection).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { iterEffectiveTemplateFiles, resolveClaim } from "../lib/upgrade-policy.ts";

// ============================================================================
// TYPES
// ============================================================================

export const ADOPT_PLAN_VERSION = 1;

export interface DeliveredPath {
  rel: string;
  source: "common" | "variant";
  claimPass: string;
}

export interface Collision {
  rel: string;
  claimPass: string;
}

export interface HookManagerFinding {
  kind: "husky" | "simple-git-hooks" | "lefthook" | "pre-commit-config" | "custom-githooks";
  detail: string;
}

export interface WorkflowTrace {
  rel: string;
  kind: "docs" | "ci" | "platform-twin" | "agent-doc" | "build";
}

export interface AdoptionPlan {
  planVersion: number;
  variant: string;
  platform: string;
  projectName: string;
  deliveredPathCount: number;
  collisions: Collision[];
  retainedForeignScripts: string[];
  foreignSkills: string[];
  hookManagerFindings: HookManagerFinding[];
  secretShapedTrackedFiles: string[];
  workflowTraces: WorkflowTrace[];
  roster: string[];
  deliveredThenRemoved: string[];
}

// ============================================================================
// DELIVERED-PATH DERIVATION
// ============================================================================

const TEMPLATE_SKIP_DIRS = new Set(["node_modules", ".git", ".gateguard-state", ".DS_Store"]);

function walkTemplateFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (TEMPLATE_SKIP_DIRS.has(entry.name)) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkTemplateFiles(join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

/**
 * The FULL effective delivered-path set for a variant: templates/<variant> overlaid on
 * templates/common (variant wins, docs/context.md common-owned), each path annotated
 * with its upgrade-policy claim pass. This is the collision scan's authority — the same
 * deny-list inversion the engine uses, so a path missed here is a path the engine may
 * clobber.
 */
export function deriveDeliveredPaths(commonDir: string, variantDir: string | null): Map<string, DeliveredPath> {
  const delivered = new Map<string, DeliveredPath>();
  const effective: Array<{ rel: string; source: "common" | "variant" }> = [];
  for (const f of iterEffectiveTemplateFiles(commonDir, variantDir && existsSync(variantDir) ? variantDir : null)) {
    effective.push({ rel: f.rel, source: f.source });
  }
  for (const { rel, source } of effective) {
    delivered.set(rel, { rel, source, claimPass: resolveClaim(rel).pass });
  }
  return delivered;
}

// ============================================================================
// FOREIGN-CONTENT SCANS
// ============================================================================

/** Foreign files at delivered paths — every one must be relocated before delivery. */
export function scanCollisions(projectDir: string, delivered: Map<string, DeliveredPath>): Collision[] {
  const collisions: Collision[] = [];
  for (const d of delivered.values()) {
    if (existsSync(join(projectDir, d.rel))) {
      collisions.push({ rel: d.rel, claimPass: d.claimPass });
    }
  }
  return collisions.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * Foreign TypeScript scripts under scripts/ that the delivery will NOT overwrite
 * (not in the delivered set) — they stay in place but must be registered in the
 * project's SCRIPTS.md or the project audit's registry-consistency check fails.
 * test-* harnesses are exempt (same exclusion as the audit).
 */
export function scanRetainedForeignScripts(projectDir: string, delivered: Map<string, DeliveredPath>): string[] {
  const scriptsDir = join(projectDir, "scripts");
  if (!existsSync(scriptsDir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(scriptsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.startsWith("test-")) continue;
    const rel = `scripts/${entry.name}`;
    if (delivered.has(rel)) continue;
    out.push(rel);
  }
  return out.sort();
}

// ============================================================================
// REFUSAL-GRADE PRE-FLIGHT SCANS
// ============================================================================

const SECRET_PATH_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\..+)?$/, // .env, .env.local, .env.production
  /\.(pem|key|p12|pfx)$/i, // key material
  /credential/i,
  /secret/i,
  /service-account.*\.json$/i, // GCP-style service accounts
];

/** Secret-shaped paths among the supplied tracked-file list. Refusal-grade: --yes cannot bypass. */
export function findSecretShapedFiles(trackedFiles: string[]): string[] {
  return trackedFiles.filter((f) => SECRET_PATH_PATTERNS.some((p) => p.test(f))).sort();
}

const GOVERNED_GITHOOKS = new Set(["pre-commit", "pre-push", "commit-msg", "post-checkout", "pre-rebase"]);

/** Hook-manager conflicts that would fight the workspace's .githooks enforcement. Refusal-grade. */
export function detectHookManagerConflicts(projectDir: string): HookManagerFinding[] {
  const findings: HookManagerFinding[] = [];
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const prepare = pkg.scripts?.prepare ?? "";
      if (/\bhusky\b/.test(prepare))
        findings.push({ kind: "husky", detail: "package.json scripts.prepare runs husky" });
      if (/simple-git-hooks/.test(prepare))
        findings.push({ kind: "simple-git-hooks", detail: "package.json scripts.prepare runs simple-git-hooks" });
      if (/lefthook/.test(prepare))
        findings.push({ kind: "lefthook", detail: "package.json scripts.prepare runs lefthook" });
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if (deps["husky"]) findings.push({ kind: "husky", detail: `husky is a declared dependency (${deps["husky"]})` });
      if (deps["simple-git-hooks"])
        findings.push({
          kind: "simple-git-hooks",
          detail: `simple-git-hooks is a declared dependency (${deps["simple-git-hooks"]})`,
        });
      if (deps["lefthook"])
        findings.push({ kind: "lefthook", detail: `lefthook is a declared dependency (${deps["lefthook"]})` });
    } catch {
      // unparseable package.json — the settling merge will report it; not a hook finding
    }
  }
  if (existsSync(join(projectDir, ".husky"))) findings.push({ kind: "husky", detail: ".husky/ directory present" });
  if (existsSync(join(projectDir, ".pre-commit-config.yaml")))
    findings.push({ kind: "pre-commit-config", detail: ".pre-commit-config.yaml present" });
  const gh = join(projectDir, ".githooks");
  if (existsSync(gh)) {
    const extra = readdirSync(gh).filter((f) => !GOVERNED_GITHOOKS.has(f) && f !== "README.md");
    if (extra.length > 0)
      findings.push({ kind: "custom-githooks", detail: `.githooks/ carries non-governed hooks: ${extra.join(", ")}` });
  }
  return findings;
}

// ============================================================================
// CONFIRMATION INPUT SCANS
// ============================================================================

/** Existing workflow artifacts the PM Gateway adoption will coexist with. */
export function scanWorkflowTraces(projectDir: string): WorkflowTrace[] {
  const traces: WorkflowTrace[] = [];
  const check = (rel: string, kind: WorkflowTrace["kind"]) => {
    if (existsSync(join(projectDir, rel))) traces.push({ rel, kind });
  };
  check("CONTRIBUTING.md", "docs");
  check("CLAUDE.md", "platform-twin");
  check("GEMINI.md", "platform-twin");
  check("CODEX.md", "platform-twin");
  check("AGENTS.md", "agent-doc");
  check("Makefile", "build");
  const wfDir = join(projectDir, ".github", "workflows");
  if (existsSync(wfDir)) {
    for (const f of readdirSync(wfDir)) {
      if (f.endsWith(".yml") || f.endsWith(".yaml")) traces.push({ rel: `.github/workflows/${f}`, kind: "ci" });
    }
  }
  return traces;
}

/** Agents the variant template will install (roster shown in the mapping confirmation). */
export function listVariantRoster(variantDir: string): string[] {
  const agentsDir = join(variantDir, "agents");
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md") && f !== "pm.md" && !f.startsWith("README"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

/**
 * Skills present in the project (SSOT root + platform mirrors) that neither the common
 * nor the variant template provides. The manifest seed protects these from the engine's
 * registry-driven skill prunes (v1.17.1 symmetry, meeting P0-2).
 */
export function listForeignSkills(projectDir: string, commonDir: string, variantDir: string | null): string[] {
  const templateSkills = new Set<string>();
  for (const base of [commonDir, ...(variantDir && existsSync(variantDir) ? [variantDir] : [])]) {
    const skillsDir = join(base, "skills");
    if (!existsSync(skillsDir)) continue;
    for (const e of readdirSync(skillsDir, { withFileTypes: true })) {
      if (e.isDirectory()) templateSkills.add(e.name);
    }
  }
  const foreign = new Set<string>();
  const skillsRoot = join(projectDir, "skills");
  if (existsSync(skillsRoot)) {
    for (const e of readdirSync(skillsRoot, { withFileTypes: true })) {
      if (e.isDirectory() && !templateSkills.has(e.name)) foreign.add(e.name);
    }
  }
  return [...foreign].sort();
}

// ============================================================================
// SETTLING HELPERS — context overlay + hygiene (v1.1.0, T-20261120-001)
// ============================================================================

/** The six tech-stack rows of templates/common/docs/variant.context.template.md, keyed by the --stack key. */
export const STACK_ROW_LABELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "language", label: "Language" },
  { key: "framework", label: "Framework" },
  { key: "database", label: "Database" },
  { key: "libraries", label: "Key Libraries" },
  { key: "package-manager", label: "Package Manager" },
  { key: "testing", label: "Testing" },
];

/**
 * Parse a --stack value ("language=Python 3.11+, framework=FastAPI") into the
 * substitution map. Keys are matched against STACK_ROW_LABELS (unknown keys are kept
 * verbatim — the caller warns); values are trimmed and never empty. Pure.
 */
export function parseStackArg(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue; // no '=' or empty key — skip silently (caller may warn on unknown keys)
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

/**
 * Fill the six tech-stack cells of a generated variant.context.md overlay. Label-anchored
 * (matches `| **<Label>** | <cell> |`), so the template's example text may evolve freely;
 * only keys present in `stack` (with a known row label) are replaced. Pure — returns the
 * content; the caller writes when it changed.
 */
export function applyStackSubstitutions(content: string, stack: Readonly<Record<string, string>>): string {
  let modified = content;
  for (const { key, label } of STACK_ROW_LABELS) {
    const value = stack[key]?.trim();
    if (!value) continue;
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rowRe = new RegExp(`(\\| \\*\\*${escaped}\\*\\* \\| )([^|]*)(\\|)`, "m");
    if (!rowRe.test(modified)) continue;
    // "$" doubling keeps replacement-string semantics literal ($&, $1 in values);
    // the trailing space is normalized (template cells are "| value |" shaped).
    modified = modified.replace(rowRe, `$1${value.replace(/\$/g, "$$$$")} $3`);
  }
  return modified;
}

/** Stub-marker classes the variant.context.template.md ships unfilled (T-20261120-001 gap 1). */
export interface OverlayStubFinding {
  marker: string;
  section: string;
  remediation: string;
}

const OVERLAY_STUB_CHECKS: ReadonlyArray<{ marker: string; test: RegExp; section: string; remediation: string }> = [
  {
    marker: "tech-stack placeholder cells",
    test: /\[e\.g\.,/,
    section: "Tech Stack",
    remediation:
      'fill the six stack rows (re-run adoption with --stack "language=…,…" or edit docs/<variant>.context.md)',
  },
  {
    marker: "[Domain] heading",
    test: /^#{1,3} \[Domain\] Guidelines$/m,
    section: "Guidelines",
    remediation: 'rename the section to the variant\'s domain (e.g. "## Coding Guidelines")',
  },
  {
    marker: "guidelines INSTRUCTION marker",
    test: /<!-- INSTRUCTION:/,
    section: "Guidelines",
    remediation: "replace the instruction comment with variant-specific guideline content",
  },
  {
    marker: "guidelines placeholder body",
    test: /Replace this placeholder with variant-specific guidelines/,
    section: "Guidelines",
    remediation: "write the variant's guidelines body (audit.ts flags an empty REQUIRED section)",
  },
];

/**
 * Detect unfilled stub markers in a generated/existing variant.context.md overlay.
 * Returns one finding per marker class present (order: template order). Pure.
 */
export function detectContextOverlayStubs(content: string): OverlayStubFinding[] {
  return OVERLAY_STUB_CHECKS.filter((c) => c.test.test(content)).map(({ marker, section, remediation }) => ({
    marker,
    section,
    remediation,
  }));
}

// ============================================================================
// ADOPTION HYGIENE — L2-only root artifacts (v1.1.0, T-20261120-001 gap 2)
// ============================================================================

/**
 * Root files the effective L2 template tree can deliver that an L3 project must not
 * keep, with the reason each is L2-only. Report-only: the settling pass WARNs naming
 * the files, it never deletes. PROMOTION_CHECKLIST.md is the variant promotion gate
 * (validate-variant-readiness.ts B1 — template-side requirement); variant.json is the
 * L2 identity manifest that scaffold parity removes post-delivery, so a leftover means
 * the settling removal did not run.
 */
export const ADOPTION_HYGIENE_ROOT_ARTIFACTS: Readonly<Record<string, string>> = {
  "PROMOTION_CHECKLIST.md":
    "L2 promotion-gate artifact (validate-variant-readiness B1 — template-side); an L3 project has nothing left to promote",
  "variant.json":
    "L2 variant-template identity manifest — scaffold parity removes it after delivery; a leftover means the settling removal did not run",
};

/** Members of the hygiene list found among the supplied root-file names. Pure. */
export function scanHygieneRootArtifacts(rootFiles: ReadonlyArray<string>): Array<{ file: string; reason: string }> {
  return rootFiles
    .filter((f) => Object.hasOwn(ADOPTION_HYGIENE_ROOT_ARTIFACTS, f))
    .sort()
    .map((file) => ({ file, reason: ADOPTION_HYGIENE_ROOT_ARTIFACTS[file] }));
}

// ============================================================================
// PRE-STANDARD docs/context.md ASSESSMENT (v1.1.0, T-20261120-001 gap 4)
// ============================================================================

export type ContextStandardVerdict = "fresh" | "stale" | "no-footer";

export interface ContextStandardAssessment {
  /** major.minor parsed from the project footer, or null when absent/unparsable. */
  projectVersion: string | null;
  /** major.minor parsed from the canonical template footer, or null. */
  canonicalVersion: string | null;
  verdict: ContextStandardVerdict;
}

const CONTEXT_VERSION_FOOTER_RE = /context\.md version:\s*(\d+)\.(\d+)/;

function parseContextFooterVersion(content: string): string | null {
  const m = content.match(CONTEXT_VERSION_FOOTER_RE);
  return m ? `${m[1]}.${m[2]}` : null;
}

/**
 * Assess a project's docs/context.md against the canonical standard
 * (templates/common/docs/context.md). The footer carries the context.md STANDARD
 * version ("*context.md version: 2.16 — …"), independent of templates/VERSION.
 * Verdicts: "stale" (project footer older than canonical or missing) and "fresh"
 * (equal, or project ahead) are exhaustive. Pure.
 */
export function assessContextStandardVersion(
  projectContent: string,
  canonicalContent: string,
): ContextStandardAssessment {
  const projectVersion = parseContextFooterVersion(projectContent);
  const canonicalVersion = parseContextFooterVersion(canonicalContent);
  if (projectVersion === null) {
    return { projectVersion, canonicalVersion, verdict: "no-footer" };
  }
  if (canonicalVersion !== null) {
    const [pMaj, pMin] = projectVersion.split(".").map(Number);
    const [cMaj, cMin] = canonicalVersion.split(".").map(Number);
    if (pMaj < cMaj || (pMaj === cMaj && pMin < cMin)) {
      return { projectVersion, canonicalVersion, verdict: "stale" };
    }
  }
  return { projectVersion, canonicalVersion, verdict: "fresh" };
}

// ============================================================================
// PLAN ASSEMBLY
// ============================================================================

export interface PlanInputs {
  variant: string;
  platform: string;
  projectName: string;
  commonDir: string;
  variantDir: string | null;
  projectDir: string;
  trackedFiles: string[];
}

export function buildAdoptionPlan(inputs: PlanInputs): AdoptionPlan {
  const delivered = deriveDeliveredPaths(inputs.commonDir, inputs.variantDir);
  const collisions = scanCollisions(inputs.projectDir, delivered);
  return {
    planVersion: ADOPT_PLAN_VERSION,
    variant: inputs.variant,
    platform: inputs.platform,
    projectName: inputs.projectName,
    deliveredPathCount: delivered.size,
    collisions,
    retainedForeignScripts: scanRetainedForeignScripts(inputs.projectDir, delivered),
    foreignSkills: listForeignSkills(inputs.projectDir, inputs.commonDir, inputs.variantDir),
    hookManagerFindings: detectHookManagerConflicts(inputs.projectDir),
    secretShapedTrackedFiles: findSecretShapedFiles(inputs.trackedFiles),
    workflowTraces: scanWorkflowTraces(inputs.projectDir),
    roster: inputs.variantDir ? listVariantRoster(inputs.variantDir) : [],
    // Scaffold parity: new-project deletes these after delivery (NEW_PROJECT_CLEANUP_FILES
    // semantics) — adopt records them so the settling pass removes the same set.
    deliveredThenRemoved: ["variant.json"],
  };
}
