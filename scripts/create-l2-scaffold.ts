#!/usr/bin/env bun
// @version 1.7.0
/**
 * create-l2-scaffold.ts
 *
 * Automates Phase A scaffold creation for new workspace variants (L2 / Projects/).
 * Replaces the manual process used for safety-os (which required 18+ remediation
 * steps to fix gaps). Future variants run this script instead of hand-copying.
 *
 * Usage:
 *   bun scripts/create-l2-scaffold.ts <variant-name> [--domain <type>] [--dry-run]
 *   bun scripts/create-l2-scaffold.ts safety-os --domain ehs
 *
 * Note: all external commands are run via execFileSync (no shell) to avoid
 * command-injection; the variant name is additionally regex-validated.
 *
 * @docs/VERSION_MANIFEST.md 1.5.0
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { includeScriptInL2, parseScriptLayers } from './helpers/layer-filter.ts';
import { parsePmMd, extractVariantOverrides } from './helpers/pm-md-parser.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_ROOT = path.resolve(__dirname, "..");
const COMMON_DIR = path.join(WORKSPACE_ROOT, "templates", "common");
const COMMON_SCRIPTS_DIR = path.join(COMMON_DIR, "scripts");
const TODAY = new Date().toISOString().split("T")[0];
// Workaround: Bun 1.3.14 cannot parse escaped backticks (${BT}) inside template literals.
// Use ${BT} interpolation instead of inline backtick characters in markdown content.
const BT = "`";


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let FILE_COUNT = 0;

function log(msg: string): void {
  console.log(msg);
}

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

/** Count files created under a path (recursive) for the completion summary. */
function countFiles(target: string): number {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (stat.isFile()) return 1;
  let n = 0;
  for (const entry of fs.readdirSync(target)) {
    n += countFiles(path.join(target, entry));
  }
  return n;
}

function copyItem(src: string, dst: string): void {
  if (!fs.existsSync(src)) {
    log(`  ⚠️  Source missing, skipped: ${path.relative(WORKSPACE_ROOT, src)}`);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
  FILE_COUNT += countFiles(dst);
}

function writeFile(dst: string, content: string): void {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, content, "utf8");
  FILE_COUNT += 1;
}

function ensureDir(dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
}

function gitkeep(dir: string): void {
  ensureDir(dir);
  writeFile(path.join(dir, ".gitkeep"), "");
}

/** Convert "safety-os" → "Safety Os"-style display name. */
function toDisplayName(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Read the common version from SCRIPTS.md header, fall back to "1.0.0". */
function readCommonVersion(): string {
  try {
    const scriptsMd = fs.readFileSync(
      path.join(COMMON_SCRIPTS_DIR, "SCRIPTS.md"),
      "utf8",
    );
    const m = scriptsMd.match(/inherits[_-]?common["']?\s*[:=]\s*["']?(\d+\.\d+\.\d+)/i);
    if (m) return m[1];
  } catch {
    /* ignore */
  }
  return "1.0.0";
}

/** Run an external command without a shell (injection-safe). */
function runNoShell(
  cmd: string,
  cmdArgs: string[],
  opts: { cwd: string; quiet?: boolean },
): void {
  execFileSync(cmd, cmdArgs, {
    cwd: opts.cwd,
    stdio: opts.quiet ? "ignore" : "inherit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument parsing
// ─────────────────────────────────────────────────────────────────────────────

interface Args {
  variant: string;
  domain: string | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  let variant = "";
  let domain: string | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--domain") {
      domain = argv[++i] ?? null;
    } else if (a.startsWith("--domain=")) {
      domain = a.split("=")[1] ?? null;
    } else if (!a.startsWith("--")) {
      if (!variant) variant = a;
    }
  }

  if (!variant) {
    fail(
      "Missing <variant-name>. " +
        "Usage: bun scripts/create-l2-scaffold.ts <variant-name> [--domain <type>] [--dry-run]",
    );
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(variant)) {
    fail(
      `Invalid variant-name "${variant}". Use lowercase alphanumerics and hyphens only ` +
        `(e.g. "safety-os").`,
    );
  }

  return { variant, domain, dryRun };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Copy common overlay
// ─────────────────────────────────────────────────────────────────────────────

function copyCommonOverlay(projectDir: string): void {
  log("📦 Copying templates/common/ overlay…");

  // Top-level files & directories (excluding scripts/ which is filtered below).
  const overlayItems = [
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".env.sample",
    ".githooks",
    ".claude/settings.json",
    ".claude/commands",
    ".claude/skills",
    ".gemini/settings.json",
    ".gemini/commands",
    ".gemini/skills",
    "CHANGELOG.md",
  ];

  for (const item of overlayItems) {
    copyItem(path.join(COMMON_DIR, item), path.join(projectDir, item));
  }

  copyItem(path.join(COMMON_DIR, 'CLAUDE.md'), path.join(projectDir, 'CLAUDE.md'));
  copyItem(path.join(COMMON_DIR, 'GEMINI.md'), path.join(projectDir, 'GEMINI.md'));

  // scripts/ — copy everything except L0-only scripts (resolved via layer-filter).
  const dstScripts = path.join(projectDir, "scripts");
  ensureDir(dstScripts);
  for (const entry of fs.readdirSync(COMMON_SCRIPTS_DIR)) {
    if (!includeScriptInL2(entry)) continue; // skip L0 scripts
    copyItem(path.join(COMMON_SCRIPTS_DIR, entry), path.join(dstScripts, entry));
  }
  log(`  ✅ scripts/ copied (Tier 3 bootstrap/setup scripts excluded)`);

  // ── Filter SCRIPTS.md for L2 ───────────────────────────────────────────────
  // copyCommonOverlay copies SCRIPTS.md verbatim from L1, which includes L0-only
  // registry rows.  Strip those rows so the project's SCRIPTS.md accurately
  // reflects what's on disk (matches new-project.ts §6.5 behavior).
  const projectScriptsMd = path.join(dstScripts, "SCRIPTS.md");
  if (fs.existsSync(projectScriptsMd)) {
    const layers = parseScriptLayers(projectScriptsMd);
    const mdContent = fs.readFileSync(projectScriptsMd, "utf-8");
    const lines = mdContent.split("\n");
    const out: string[] = [];
    let inRegistry = false;
    let headerParsed = false;
    let removed = 0;

    for (const line of lines) {
      if (/^## Registry/.test(line)) { inRegistry = true; headerParsed = false; out.push(line); continue; }
      if (inRegistry && /^## /.test(line)) { inRegistry = false; out.push(line); continue; }
      if (inRegistry) {
        const trimmed = line.trim();
        if (trimmed.startsWith("|-")) { out.push(line); continue; }
        if (!trimmed.startsWith("|")) { out.push(line); continue; }
        const cols = trimmed.split("|").slice(1, -1).map((c: string) => c.trim());
        if (cols.length < 6) { out.push(line); continue; }
        if (!headerParsed) { headerParsed = true; out.push(line); continue; }
        const scriptName = cols[0].replace(/`/g, "");
        const layer = layers.get(scriptName) ?? "L0+L1";
        if (layer === "L0") { removed++; continue; }
      }
      out.push(line);
    }

    const rewritten = out.join("\n")
      .replace(
        "> This file is the Single Source of Truth (Tier 1 SSOT) for all scripts in `scripts/` (workspace root).\n" +
        "> Template `templates/common/scripts/` (Tier 2) is a snapshot published from here via `bun run propagate:apply`.\n" +
        "> Project `scripts/` (Tier 3) is a snapshot created from Tier 2 at `new-project` time.",
        "> This file is a **project-level snapshot** (Tier 3) of the scripts that were scaffolded\n" +
        "> from the common template. L0-only entries have been stripped.\n" +
        "> For the authoritative registry, see the workspace root `scripts/SCRIPTS.md`."
      )
      .replace(
        "*SCRIPTS.md maintained by: workspace maintainer (L0 SSOT)*",
        "*SCRIPTS.md — project snapshot (auto-generated at scaffold time)*"
      );

    fs.writeFileSync(projectScriptsMd, rewritten, "utf-8");
    log(`  📝 Filtered SCRIPTS.md: removed ${removed} L0-only registry entries`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Copy root skills
// ─────────────────────────────────────────────────────────────────────────────

function copyRootSkills(projectDir: string): void {
  log("📦 Copying templates/common/skills/ …");
  const srcSkills = path.join(COMMON_DIR, "skills");
  const dstSkills = path.join(projectDir, "skills");
  copyItem(srcSkills, dstSkills);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Generate stub files
// ─────────────────────────────────────────────────────────────────────────────

function generateStubs(
  projectDir: string,
  variant: string,
  domain: string | null,
): void {
  log("📝 Generating stub files…");
  const displayName = toDisplayName(variant);
  const commonVersion = readCommonVersion();

  // variant.json
  const variantJson = {
    name: `co-${variant}`,
    displayName,
    description: "TODO: describe this variant",
    type: "TODO: security|development|design|consulting|collaboration",
    status: "beta",
    version: "0.1.0",
    inherits_common: commonVersion,
    agent_overrides: {
      pm: {
        type: "additive",
        reason: "TODO: describe PM override",
        since: TODAY,
        reviewed_by: "architect",
        overrides: ["agent-roster", "governance-workflow", "dispatch-protocol"],
      },
    },
    skill_manifest: { variant_specific: [] },
    lifecycle: {
      statusSince: TODAY,
      lastTransition: `initial → beta on ${TODAY}`,
      stablePromotedOn: null,
    },
    // Lecture-type extension fields
    ...(variant === 'deck' ? {
      agent_manifest: {
        variant_agents_dir: "agents",
        pipeline_order: ["version", "research", "source-verifier", "storyline", "design", "image-curator", "html-build", "measure", "pdf-export"],
        optional: ["source-verifier", "image-curator"],
        notes: "source-verifier: skip with --skip-verify. image-curator: skip if all slides use image_role: none."
      },
      theme_manifest: {
        themes_dir: "docs/html-themes",
        base_css: "docs/html-themes/base/base.css",
        available: ["classic", "minimal", "visual-heavy", "academic"],
        default: "classic",
        overrides_dir: "docs/html-themes/overrides",
        notes: "CSS variable override themes. DOM structure immutable across themes."
      },
      lecture_profile: {
        template_path: "docs/lecture-profile.md",
        required_fields: ["title", "audience", "level"],
        notes: "Scaffolded on new-project creation. Agents load this file at stage start."
      }
    } : {}),
    createdAt: TODAY,
    phaseAComplete: false,
    promotionChecklist: "PROMOTION_CHECKLIST.md",
  };
  writeFile(
    path.join(projectDir, "variant.json"),
    JSON.stringify(variantJson, null, 2) + "\n",
  );

  // _ORIGIN.md
  const domainAddendum = domain
    ? `
### Domain (${BT}${domain}${BT}) specific additions
` +
      `- Domain-specific document folders created under ${BT}docs/${BT} (see Step 6 output)
` +
      `- Add domain workflows, regulations, evidence-models as needed (see Phase B steps)
`
    : "";
  const originMd = `# _ORIGIN.md — Scaffold Provenance

> Generated by ${BT}scripts/create-l2-scaffold.ts${BT} on **${TODAY}**.

## Inheritance

| Field | Value |
|-------|-------|
| Workspace common version | ${BT}${commonVersion}${BT} |
| Variant name | ${BT}co-${variant}${BT} |
| Domain | ${BT}${domain ?? "(none)"}${BT} |
| Creation date | ${TODAY} |
| Phase A complete | ${BT}false${BT} |

## ⚠️ Reconcile Survival Warning

During **Phase B reconcile**, any file copied verbatim from L0 (workspace root /
${BT}templates/common/${BT}) that is **identical** to its L0 counterpart will be pruned as
redundant. To survive reconcile, the following files MUST diverge from L0 by adding
variant-specific content **before** Phase B:

- ${BT}CLAUDE.md${BT} — add a ${BT}## ${displayName} Context${BT} section
- ${BT}GEMINI.md${BT} — add an identical ${BT}## ${displayName} Context${BT} section (platform parity)
- ${BT}AGENTS.md${BT} — add variant-specific agent roster entries
- ${BT}README.md${BT} / ${BT}README_ko.md${BT} — replace placeholder with real variant description
- ${BT}variant.json${BT} — complete all ${BT}TODO:${BT} fields

## Files Requiring ${displayName}-specific Additions

- [ ] ${BT}CLAUDE.md${BT} — variant context section
- [ ] ${BT}GEMINI.md${BT} — variant context section (parity with CLAUDE.md)
- [ ] ${BT}AGENTS.md${BT} — variant agent roster
- [ ] ${BT}agents/*.md${BT} — variant agent definitions (3-Section: Legal Basis / Role / Protocols)
- [ ] ${BT}skills/<domain-skill>/SKILL.md${BT} — domain skills
- [ ] ${BT}variant.json${BT} — description, type, agent_overrides, skill_manifest
- [ ] ${BT}SECURITY.md${BT} — complete security policy
- [ ] ${BT}PROMOTION_CHECKLIST.md${BT} — finalize Phase B conditions for this domain
${domainAddendum}
## Phase B Manual Copy Steps

When promoting from ${BT}Projects/${variant}/${BT} to ${BT}templates/co-${variant}/${BT}:

1. Copy variant-specific ${BT}agents/${BT}, ${BT}skills/${BT}, and domain doc folders.
2. ${domain ? "Copy domain-specific assets (workflows/, regulations/, evidence-models/) if present." : "Copy any domain-specific document folders created under docs/."}
3. Verify CLAUDE.md / GEMINI.md / AGENTS.md diverge from L0 (reconcile survival).
4. From workspace root: run the template parity check script (L0-only — see workspace scripts/SCRIPTS.md).
5. Run ${BT}bun scripts/audit.ts${BT} — must pass with 0 errors.

## Common Skills Sync Note

Root skills under ${BT}skills/${BT} were copied from ${BT}templates/common/skills/${BT} at version
${BT}${commonVersion}${BT}. Do **not** hand-edit common skills here; instead, edit them at L0
and re-sync, or they will diverge and break reconcile. Variant-specific skills belong
in their own subdirectories and are tracked in ${BT}variant.json → skill_manifest${BT}.
`;
  writeFile(path.join(projectDir, "_ORIGIN.md"), originMd);

  // _COMMON_VERSION.md
  const commonVersionMd = `# _COMMON_VERSION.md

| Field | Value |
|-------|-------|
| Snapshot date | ${TODAY} |
| Common version | ${BT}${commonVersion}${BT} |
| Source | ${BT}templates/common/${BT} |

> This snapshot records the workspace common version this variant was scaffolded
> against. Update when re-syncing common assets.
`;
  writeFile(path.join(projectDir, "_COMMON_VERSION.md"), commonVersionMd);

  // PROMOTION_CHECKLIST.md
  const promotionMd = `# PROMOTION_CHECKLIST.md — Phase B Promotion Conditions

| # | Condition | Verification | Status |
|---|-----------|--------------|--------|
| 1 | All agents defined with 3-Section structure | bun run agent:verify | Pending |
| 2 | All domain SKILL.md files completed | bun scripts/validate-skills.ts | Pending |
| 3 | Domain workflows completed with legal_basis field (if applicable) | bun scripts/audit.ts | Pending |
| 4 | Audit script passes with 0 errors | bun scripts/audit.ts | Pending |
| 5 | AGENTS.md updated with variant agent roster | bun run agent:verify | Pending |
| 6 | Platform parity validated (CLAUDE.md ↔ GEMINI.md) | From workspace root: run template parity check (L0-only script) | Pending |
| 7 | _ORIGIN.md Phase B manual steps reviewed | Human review | Pending |
`;
  writeFile(path.join(projectDir, "PROMOTION_CHECKLIST.md"), promotionMd);

  // SECURITY.md
  const securityMd = `# SECURITY.md — ${displayName}

> TODO: complete before Phase B

## Reporting a Vulnerability

TODO: describe the disclosure process for this variant.

## Scope

TODO: define security scope, threat model, and data-handling policy.

## Secrets Management

TODO: document how secrets/credentials are handled (see ${BT}.env.sample${BT}).
`;
  writeFile(path.join(projectDir, "SECURITY.md"), securityMd);

  // docs/VERSION_MANIFEST.md
  const versionManifestMd = `# docs/VERSION_MANIFEST.md

> Stub. This variant inherits version governance from the workspace root.
> See the workspace root ${BT}docs/VERSION_MANIFEST.md${BT} for the canonical manifest.

| Component | Version | Source |
|-----------|---------|--------|
| common overlay | ${BT}${commonVersion}${BT} | templates/common/ |
| variant (co-${variant}) | ${BT}0.1.0${BT} | this project |

> TODO: regenerate with ${BT}bun scripts/generate-version-manifest.ts${BT} once agents/skills are defined.
`;
  writeFile(path.join(projectDir, "docs", "VERSION_MANIFEST.md"), versionManifestMd);

  ensureDir(path.join(projectDir, 'memory'));

  // README.md
  const readmeMd = `# ${displayName} (co-${variant})

> TODO: describe the ${displayName} variant.

**Status**: beta · **Version**: 0.1.0 · **Created**: ${TODAY}

## Overview

TODO: explain what this variant does and who it is for.

## Getting Started

TODO: setup and usage instructions.

---

_Scaffolded via ${BT}scripts/create-l2-scaffold.ts${BT} on ${TODAY}. See ${BT}_ORIGIN.md${BT} for provenance._
`;
  writeFile(path.join(projectDir, "README.md"), readmeMd);

  // README_ko.md
  const readmeKoMd = `# ${displayName} (co-${variant})

> TODO: ${displayName} variant 설명을 작성하세요.

**상태**: beta · **버전**: 0.1.0 · **생성일**: ${TODAY}

## 개요

TODO: 이 variant가 무엇을 하는지, 누구를 위한 것인지 설명하세요.

## 시작하기

TODO: 설치 및 사용 방법.

---

_${TODAY}에 ${BT}scripts/create-l2-scaffold.ts${BT}로 스캐폴딩됨. 출처는 ${BT}_ORIGIN.md${BT} 참조._
`;
  writeFile(path.join(projectDir, "README_ko.md"), readmeKoMd);

  // AGENTS.md — header only, workspace roster removed, TODO section added.
  const agentsMd = `# AGENTS.md — co-${variant}

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in ${BT}CLAUDE.md${BT} (Claude Code), ${BT}GEMINI.md${BT} (Gemini CLI).

> **Canonical agent index** for the ${displayName} variant.
> Full agent definitions live in ${BT}agents/${BT}.
> **Agent architecture and governance rules**: See the project governance documentation.

---

## TODO: Add Variant Agents

Define this variant's agents in ${BT}agents/<name>.md${BT} (3-Section structure:
Legal Basis / Role / Protocols), then register them in the roster table below.

| Agent | File | Tier | Role |
|-------|------|------|------|
| _TODO_ | ${BT}agents/_TODO_.md${BT} | — | _TODO_ |

> Run ${BT}bun run agent:verify${BT} after adding agents.
`;
  writeFile(path.join(projectDir, "AGENTS.md"), agentsMd);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6: Domain-specific docs subdirectories
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_DOC_DIRS: Record<string, string[]> = {
  ehs: ["docs/reports", "docs/procedures", "docs/blueprint"],
  development: ["docs/drafts", "docs/reports", "docs/research"],
  design: ["docs/drafts", "docs/reports", "docs/research"],
  security: ["docs/drafts", "docs/reports", "docs/research"],
  game: ["docs/drafts", "docs/reports", "docs/research"],
  consulting: ["deliverables/reports", "deliverables/drafts", "deliverables/research", "deliverables/presentations"],
  collaboration: ["docs/drafts", "docs/reports", "docs/research"],
  lecture: ["docs/drafts", "docs/reports", "docs/research"],
};
const DEFAULT_DOC_DIRS = ["docs/drafts", "docs/reports", "docs/research"];

function createDomainDocs(projectDir: string, domain: string | null, variant: string): void {
  log("📁 Creating docs/ subdirectories…");

  const commonDocsDir = path.join(COMMON_DIR, 'docs', '_common');
  if (fs.existsSync(commonDocsDir)) {
    const destDocsDir = path.join(projectDir, 'docs');
    ensureDir(destDocsDir);
    for (const entry of fs.readdirSync(commonDocsDir)) {
      copyItem(path.join(commonDocsDir, entry), path.join(destDocsDir, entry));
    }
    log('  ✅ docs/_common/ files copied');
  }

  const dirs = (domain && DOMAIN_DOC_DIRS[domain]) || DEFAULT_DOC_DIRS;
  if (domain && !DOMAIN_DOC_DIRS[domain]) {
    log(`  ⚠️  Unknown domain "${domain}" — using default doc layout.`);
  }
  for (const d of dirs) {
    gitkeep(path.join(projectDir, d));
  }
  log(`  ✅ {${dirs.join(", ")}}/ created`);

  // agents/ directory with README placeholder.
  const agentsReadme = `# agents/

> TODO: add this variant's agent definition files here.
>
> Each agent file must follow the 3-Section structure:
> 1. **Legal Basis** — authority/regulatory grounding for the role
> 2. **Role** — responsibilities and scope
> 3. **Protocols** — operating procedures and dispatch rules
>
> Register each agent in ${BT}AGENTS.md${BT} and run ${BT}bun run agent:verify${BT}.
`;
  writeFile(path.join(projectDir, "agents", "README.md"), agentsReadme);

  const displayName = toDisplayName(variant);

  // pm.md additive skeleton with variant_overrides support
  const pmMd = `---
owner: "architect"
status: "active"
extends: ../../../agents/pm.md
remove_sections:
  - "## Governance Workflow"
  - "## Updated Role"
  - "## Agent Roster"
  - "## Dispatch Protocol"
  - "### Phase Determination (Deliverable-Type Gate)"
variant_overrides:
  governance_workflow: |
    <!-- VARIANT-SECTION: governance-workflow -->
    ## Governance Workflow

    TODO: Add ${displayName}-specific governance workflow overrides here.

    This section replaces the workspace PM's governance workflow with variant-specific logic.
    <!-- END VARIANT-SECTION -->
  agent_roster: |
    <!-- VARIANT-SECTION: agent-roster -->
    ## Agent Roster

    TODO: Add ${displayName}-specific agent roster here.

    This section replaces the workspace PM's agent roster with variant-specific agents.
    <!-- END VARIANT-SECTION -->
  dispatch_protocol: |
    <!-- VARIANT-SECTION: dispatch-protocol -->
    ## Dispatch Protocol

    TODO: Add ${displayName}-specific dispatch protocol here.

    This section replaces the workspace PM's dispatch protocol with variant-specific logic.
    <!-- END VARIANT-SECTION -->
---
# Project Manager (PM)

> **⚠️ Additive Override Variant**: This file overrides specific sections of the workspace PM.
> Do NOT duplicate the entire workspace PM file. Only add variant-specific changes within the sections below.

<!-- VARIANT-SECTION: governance-workflow -->
## Governance Workflow

TODO: Add ${displayName}-specific governance workflow overrides here.

This section replaces the workspace PM's governance workflow with variant-specific logic.
<!-- END VARIANT-SECTION -->

<!-- VARIANT-SECTION: agent-roster -->
## Agent Roster

TODO: Add ${displayName}-specific agent roster here.

This section replaces the workspace PM's agent roster with variant-specific agents.
<!-- END VARIANT-SECTION -->

<!-- VARIANT-SECTION: dispatch-protocol -->
## Dispatch Protocol

TODO: Add ${displayName}-specific dispatch protocol here.

This section replaces the workspace PM's dispatch protocol with variant-specific logic.
<!-- END VARIANT-SECTION -->
`;
  writeFile(path.join(projectDir, "agents", "pm.md"), pmMd);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 7-9: git init, bun install, setup.sh
// ─────────────────────────────────────────────────────────────────────────────

function initGit(projectDir: string): void {
  log("🔧 Initializing git repository…");
  try {
    runNoShell("git", ["init"], { cwd: projectDir, quiet: true });
    runNoShell("git", ["config", "core.hooksPath", ".githooks"], {
      cwd: projectDir,
      quiet: true,
    });
    log("✅ git repository initialized, .githooks configured");
  } catch (e) {
    log(`⚠️  git init failed: ${(e as Error).message}`);
    log(
      `    Manual retry: cd ${projectDir} && git init && git config core.hooksPath .githooks`,
    );
  }
}

function bunInstall(projectDir: string): void {
  const scriptsDir = path.join(projectDir, "scripts");
  if (!fs.existsSync(path.join(scriptsDir, "package.json"))) {
    log("⚠️  scripts/package.json missing — skipping bun install");
    return;
  }
  log("📦 Running bun install in scripts/ …");
  try {
    runNoShell("bun", ["install"], { cwd: scriptsDir });
    log("✅ bun install complete");
  } catch (e) {
    log(`⚠️  bun install failed (non-fatal): ${(e as Error).message}`);
    log(`    Manual retry: cd ${path.join(projectDir, "scripts")} && bun install`);
  }
}

function runSetup(projectDir: string): void {
  const setupSh = path.join(COMMON_SCRIPTS_DIR, "setup.sh").replace(/\\/g, "/");
  if (!fs.existsSync(setupSh)) {
    log("⚙️  setup.sh not found — skipping (legacy bootstrap step)");
    return;
  }
  log("⚙️  Running setup.sh …");
  try {
    runNoShell("bash", [setupSh, "--skip-commit", "--skip-license-check"], {
      cwd: projectDir,
    });
    log("✅ setup.sh complete");
  } catch (e) {
    log(`⚠️  setup.sh failed (non-fatal): ${(e as Error).message}`);
    log(
      `    Manual retry: cd ${projectDir} && bash "${setupSh}" --skip-commit --skip-license-check`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 10: Completion summary
// ─────────────────────────────────────────────────────────────────────────────

function printSummary(variant: string): void {
  const displayName = toDisplayName(variant);
  log("");
  log(`✅ Projects/${variant}/ scaffold complete (${FILE_COUNT} files created)`);
  log("");
  log("📋 Required next steps (see skills/create-variant/SKILL.md):");
  log(`  1. Edit CLAUDE.md  → add ## ${displayName} Context section`);
  log(`  2. Edit GEMINI.md  → add identical ## ${displayName} Context section (parity)`);
  log("  3. Edit AGENTS.md  → add variant-specific agent entries");
  log("  4. Create agents/<name>.md files (3-Section: Legal Basis / Role / Protocols)");
  log("  5. Create domain-specific skills in skills/<domain-skill>/SKILL.md");
  log("  6. Complete variant.json (description, type, agent_overrides, skill_manifest)");
  log("  7. Define PROMOTION_CHECKLIST.md conditions for your domain");
  log("");
  log("⚠️  Git hooks active — run commits via /sync pipeline only");
  log(
    "⚠️  CLAUDE.md/GEMINI.md must differ from workspace root (add variant section) for Phase B reconcile survival",
  );
}

function createLectureScaffold(projectDir: string): void {
  log("🎨 Creating lecture-specific scaffold (docs/html-themes/, presentations/)…");
  // html-themes directory structure
  for (const dir of [
    "docs/html-themes",
    "docs/html-themes/base",
    "docs/html-themes/overrides",
    "presentations",
  ]) {
    ensureDir(path.join(projectDir, dir));
  }
  // presentations/.gitkeep so the folder is tracked
  writeFile(path.join(projectDir, "presentations", ".gitkeep"), "");
  log("    ├─ docs/html-themes/base/");
  log("    ├─ docs/html-themes/overrides/");
  log("    └─ presentations/");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const projectDir = path.join(WORKSPACE_ROOT, "Projects", args.variant);
  const templateVariantDir = path.join(WORKSPACE_ROOT, "templates", `co-${args.variant}`);

  // Step 1: duplicate / existence checks
  if (fs.existsSync(projectDir)) {
    fail(`Projects/${args.variant}/ already exists. Choose a different name or remove it first.`);
  }
  if (fs.existsSync(templateVariantDir)) {
    log(`⚠️  templates/co-${args.variant}/ already exists — proceeding with L2 scaffold anyway.`);
  }
  if (!fs.existsSync(COMMON_DIR)) {
    fail(`templates/common/ not found at ${COMMON_DIR}`);
  }

  log(`🚀 Creating L2 scaffold: Projects/${args.variant}/  (domain: ${args.domain ?? "none"})`);

  // Step 2: create directory (or dry-run preview)
  if (args.dryRun) {
    log("");
    log("🔍 DRY RUN — the following would be created:");
    log(`  Projects/${args.variant}/`);
    log("    ├─ common overlay: .gitignore, .env.sample, .githooks/,");
    log("    │     .claude/{settings.json,commands/,skills/}, .gemini/{...}, CHANGELOG.md");
    log("    ├─ scripts/ (Tier 3 bootstrap/setup scripts excluded), scripts/hooks/,");
    log("    │     scripts/package.json, scripts/SCRIPTS.md");
    log("    ├─ skills/ (all common skills)");
    log("    ├─ stubs: variant.json, _ORIGIN.md, _COMMON_VERSION.md,");
    log("    │     PROMOTION_CHECKLIST.md, SECURITY.md, README.md, README_ko.md, AGENTS.md");
    log("    ├─ docs/VERSION_MANIFEST.md + domain doc folders");
    log("    ├─ memory/MEMORY.md");
    log("    └─ agents/README.md");
    log("");
    log("  Then: git init + hooks, bun install (scripts/), setup.sh");
    log("");
    log("Dry run complete — no files written.");
    return;
  }

  // Step 2 (real): create directory
  ensureDir(projectDir);

  // Step 3: common overlay
  copyCommonOverlay(projectDir);

  // Step 4: root skills
  copyRootSkills(projectDir);

  // Step 5: stub files
  generateStubs(projectDir, args.variant, args.domain);

  // Step 6: domain docs + agents/
  createDomainDocs(projectDir, args.domain, args.variant);

  // Step 6.5: lecture-type specific setup (html-themes + presentations/)
  if (args.variant === 'deck') {
    createLectureScaffold(projectDir);
  }

  // Step 7: git init
  initGit(projectDir);

  // Step 8: bun install
  bunInstall(projectDir);

  // Step 9: setup.sh
  runSetup(projectDir);

  // Step 10: summary
  printSummary(args.variant);
}

main();
