#!/usr/bin/env bun
// @version 1.12.4
/**
 * create-l3-scaffold.ts
 *
 * Automates Phase A scaffold creation for new workspace variants (L3 / Projects/).
 * Replaces the manual process used for safety-os (which required 18+ remediation
 * steps to fix gaps). Future variants run this script instead of hand-copying.
 *
 * Usage:
 *   bun scripts/create-l3-scaffold.ts <variant-name> [--domain <type>] [--country <CODE>] [--dry-run]
 *   bun scripts/create-l3-scaffold.ts safety-os --domain security
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
import { includeScriptInL3, parseScriptLayers } from './helpers/layer-filter.ts';
import { parsePmMd, extractVariantOverrides } from './helpers/pm-md-parser.ts';
import { generateReadme, generateReadmeKo, type VariantMetadata } from './helpers/generate-variant.ts';
import { isVariantType } from './helpers/registries/variant-type-registry.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_ROOT = path.resolve(__dirname, "..");
const COMMON_DIR = path.join(WORKSPACE_ROOT, "templates", "common");
const COMMON_SCRIPTS_DIR = path.join(COMMON_DIR, "scripts");
const TODAY = new Date().toISOString().split("T")[0];
// Workaround: Bun 1.3.14 cannot parse escaped backticks (\`) inside template literals.
// Use \` interpolation instead of inline backtick characters in markdown content.
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

/**
 * Canonical `co-`-prefixed variant slug.
 *
 * Callers may pass either bare (`newbiz`) or already-prefixed (`co-newbiz`) names.
 * Prefixing unconditionally produced `co-co-newbiz` in variant.json and in every
 * derived path (templates/co-co-newbiz/, AGENTS.md header, collision check), so the
 * prefix is applied only when it is actually missing.
 */
function toVariantSlug(name: string): string {
  return name.startsWith("co-") ? name : `co-${name}`;
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
  country: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  let variant = "";
  let domain: string | null = null;
  let country = "";
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--domain") {
      domain = argv[++i] ?? null;
    } else if (a.startsWith("--domain=")) {
      domain = a.split("=")[1] ?? null;
    } else if (a === "--country") {
      country = argv[++i] ?? "";
      // Validate country pattern
      if (country && !/^[A-Z]{2,4}$/.test(country)) {
        fail(`Invalid --country value: '${country}'. Use ISO 3166-1 alpha-2 (KR, US), region code (EU, ASEAN), or omit for region-neutral.`);
      }
    } else if (a.startsWith("--country=")) {
      country = a.split("=")[1] ?? "";
      if (country && !/^[A-Z]{2,4}$/.test(country)) {
        fail(`Invalid --country value: '${country}'. Use ISO 3166-1 alpha-2 (KR, US), region code (EU, ASEAN), or omit for region-neutral.`);
      }
    } else if (!a.startsWith("--")) {
      if (!variant) variant = a;
    }
  }

  if (!variant) {
    fail(
      "Missing <variant-name>. " +
        "Usage: bun scripts/create-l3-scaffold.ts <variant-name> [--domain <type>] [--country <CODE>] [--dry-run]",
    );
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(variant)) {
    fail(
      `Invalid variant-name "${variant}". Use lowercase alphanumerics and hyphens only ` +
        `(e.g. "safety-os").`,
    );
  }

  return { variant, domain, country, dryRun };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Copy common overlay
// ─────────────────────────────────────────────────────────────────────────────

// Top-level templates/common/ entries that must NOT be blanket-copied into an L3
// scaffold: workspace-only artifacts (node_modules, bun.lock, propagation-map.json,
// .gateguard-state — none of these belong in a project checkout), items handled by
// a dedicated step elsewhere in this script (docs/, agents/, scripts/, skills/,
// memory/, package.json — each needs L3-specific filtering or stub generation, not
// a raw copy), items synced by a separate mechanism (.agents/ — populated later by
// scripts/sync-skills.ts, not at scaffold time), and files that must stay a
// Phase-A-specific stub rather than the L0 original (README.md, README_ko.md,
// AGENTS.md, SECURITY.md — see generateStubs()).
//
// Everything else is copied by default. This mirrors the "default include, explicit
// exclude" pattern new-project.ts's copyDir(commonDir, projectDir) uses, rather than
// the previous allowlist ("default exclude, explicit include"): an allowlist silently
// drops any new file added to templates/common/ until someone remembers to list it
// here — that's exactly how docs/context.md (added 2026-05-27) and .claude/skills.json
// + .gemini/skills.json went missing from every L3 scaffold for months.
const COMMON_OVERLAY_EXCLUDE = new Set([
  '.agents', '.gateguard-state', 'node_modules', 'bun.lock', 'propagation-map.json',
  'docs', 'agents', 'scripts', 'skills', 'memory', 'package.json',
  'README.md', 'README_ko.md', 'AGENTS.md', 'SECURITY.md',
]);

function copyCommonOverlay(projectDir: string): void {
  log("📦 Copying templates/common/ overlay…");

  for (const entry of fs.readdirSync(COMMON_DIR)) {
    if (COMMON_OVERLAY_EXCLUDE.has(entry)) continue;
    copyItem(path.join(COMMON_DIR, entry), path.join(projectDir, entry));
  }

  // Protect docs/context.md from accidental merge overwrites (matches new-project.ts
  // §5.7). templates/common/.gitattributes doesn't carry this rule itself — it's
  // scaffold-time-only, since it only makes sense once docs/context.md actually exists
  // in the project — so every scaffolding path has to add it explicitly.
  const gitattributesPath = path.join(projectDir, '.gitattributes');
  const gaRule = 'docs/context.md merge=ours\n';
  if (fs.existsSync(gitattributesPath)) {
    const ga = fs.readFileSync(gitattributesPath, 'utf8');
    if (!ga.includes('docs/context.md')) {
      fs.appendFileSync(gitattributesPath, `\n${gaRule}`);
    }
  } else {
    writeFile(gitattributesPath, gaRule);
  }

  // scripts/ — copy everything except L0-only scripts (resolved via layer-filter).
  const dstScripts = path.join(projectDir, "scripts");
  ensureDir(dstScripts);
  for (const entry of fs.readdirSync(COMMON_SCRIPTS_DIR)) {
    if (!includeScriptInL3(entry)) continue; // skip L0 scripts
    copyItem(path.join(COMMON_SCRIPTS_DIR, entry), path.join(dstScripts, entry));
  }
  log(`  ✅ scripts/ copied (Tier 3 bootstrap/setup scripts excluded)`);

  // ── Filter SCRIPTS.md for this L3 draft ─────────────────────────────────────
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
    name: toVariantSlug(variant),
    displayName,
    description: "TODO: describe this variant",
    variant_type: domain ?? "TODO",
    status: "beta",
    version: "0.1.0",
    inherits_common: "templates/common",
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
    ...(domain === 'lecture' ? {
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
    created_at: TODAY,
    phaseAComplete: false,
    promotionChecklist: "PROMOTION_CHECKLIST.md",
  };
  writeFile(
    path.join(projectDir, "variant.json"),
    JSON.stringify(variantJson, null, 2) + "\n",
  );

  // docs/<variant>.context.md stub
  const contextMd = `# ${variant} Context

> Auto-generated scaffold stub — update after Phase A.

## Overview

<!-- Describe the variant's purpose and domain scope -->

## Agents

<!-- List agent roster with tier and model -->

## Skills

<!-- List variant-specific skills -->

## Domain Configuration

<!-- Domain-specific settings and workflows -->
`;
  const docsDir = path.join(projectDir, "docs");
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  writeFile(path.join(docsDir, `${variant}.context.md`), contextMd);

  // _ORIGIN.md
  const domainAddendum = domain
    ? `
### Domain (\`${domain}\`) specific additions
` +
      `- Domain-specific document folders created under \`docs/\` (see Step 6 output)
` +
      `- Add domain workflows, regulations, evidence-models as needed (see Phase B steps)
`
    : "";
  const originMd = `# _ORIGIN.md — Scaffold Provenance

> Generated by \`scripts/create-l3-scaffold.ts\` on **${TODAY}**.

## Inheritance

| Field | Value |
|-------|-------|
| Workspace common version | \`${commonVersion}\` |
| Variant name | \`${toVariantSlug(variant)}\` |
| Domain | \`${domain ?? "(none)"}\` |
| Creation date | ${TODAY} |
| Phase A complete | \`false\` |

## ⚠️ Reconcile Survival Warning

During **Phase B reconcile**, any file copied verbatim from L0 (workspace root /
\`templates/common/\`) that is **identical** to its L0 counterpart will be pruned as
redundant. To survive reconcile, the following files MUST diverge from L0 by adding
variant-specific content **before** Phase B:

- \`CLAUDE.md\` — add a \`## ${displayName} Context\` section
- \`GEMINI.md\` — add an identical \`## ${displayName} Context\` section (platform parity)
- \`AGENTS.md\` — add variant-specific agent roster entries
- \`README.md\` / \`README_ko.md\` — must contain variant-specific content (regenerate via \`scripts/generate-l3-readme.ts\`)
- \`variant.json\` — complete all \`TODO:\` fields

## Files Requiring ${displayName}-specific Additions

- [ ] \`CLAUDE.md\` — variant context section
- [ ] \`GEMINI.md\` — variant context section (parity with CLAUDE.md)
- [ ] \`AGENTS.md\` — variant agent roster
- [ ] \`agents/*.md\` — variant agent definitions (3-Section: Legal Basis / Role / Protocols)
- [ ] \`skills/<domain-skill>/SKILL.md\` — domain skills
- [ ] \`README.md\` / \`README_ko.md\` — regenerate via \`bun scripts/generate-l3-readme.ts\` once agents/skills exist
- [ ] \`variant.json\` — description, type, agent_overrides, skill_manifest
- [ ] \`SECURITY.md\` — complete security policy
- [ ] \`PROMOTION_CHECKLIST.md\` — finalize Phase B conditions for this domain
${domainAddendum}
## Phase B Manual Copy Steps

When promoting from \`Projects/${variant}/\` to \`templates/${toVariantSlug(variant)}/\`:

1. Copy variant-specific \`agents/\`, \`skills/\`, and domain doc folders.
2. ${domain ? "Copy domain-specific assets (workflows/, regulations/, evidence-models/) if present." : "Copy any domain-specific document folders created under docs/."}
3. Verify CLAUDE.md / GEMINI.md / AGENTS.md diverge from L0 (reconcile survival).
4. From workspace root: run the template parity check script (L0-only — see workspace scripts/SCRIPTS.md).
5. Run \`bun scripts/audit.ts\` — must pass with 0 errors.

## Common Skills Sync Note

Root skills under \`skills/\` were copied from \`templates/common/skills/\` at version
\`${commonVersion}\`. Do **not** hand-edit common skills here; instead, edit them at L0
and re-sync, or they will diverge and break reconcile. Variant-specific skills belong
in their own subdirectories and are tracked in \`variant.json → skill_manifest\`.
`;
  writeFile(path.join(projectDir, "_ORIGIN.md"), originMd);

  // _COMMON_VERSION.md
  const commonVersionMd = `# _COMMON_VERSION.md

| Field | Value |
|-------|-------|
| Snapshot date | ${TODAY} |
| Common version | \`${commonVersion}\` |
| Source | \`templates/common/\` |

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

TODO: document how secrets/credentials are handled (see \`.env.sample\`).
`;
  writeFile(path.join(projectDir, "SECURITY.md"), securityMd);

  // docs/VERSION_MANIFEST.md
  const versionManifestMd = `# docs/VERSION_MANIFEST.md

> Stub. This variant inherits version governance from the workspace root.
> See the workspace root \`docs/VERSION_MANIFEST.md\` for the canonical manifest.

| Component | Version | Source |
|-----------|---------|--------|
| common overlay | \`${commonVersion}\` | templates/common/ |
| variant (${toVariantSlug(variant)}) | \`0.1.0\` | this project |

> TODO: regenerate with \`bun scripts/generate-version-manifest.ts\` once agents/skills are defined.
`;
  writeFile(path.join(projectDir, "docs", "VERSION_MANIFEST.md"), versionManifestMd);

  // memory/MEMORY.md — the dry-run output has always advertised this file, but it was
  // never written. Its absence is not cosmetic: scripts/sync-md.ts treats a missing
  // "## Sessions" heading as a legacy index needing migration, and its migration branch
  // appends the Meetings/ADRs sections on every run. Seeding the canonical structure here
  // keeps that branch from ever firing.
  ensureDir(path.join(projectDir, 'memory'));
  writeFile(
    path.join(projectDir, 'memory', 'MEMORY.md'),
    `# Memory Index

## Sessions

| Date | Summary |
|------|---------|

## Meetings

| Date | Topic | File |
|------|-------|------|

## ADRs

| ID | Title | Status | File |
|----|-------|--------|------|
`,
  );

  // README.md / README_ko.md — render from templates/common/docs/README{,_ko}.template.md
  // via the shared renderer (the same one l3-to-variant-pipeline.ts uses at Phase B).
  // Bootstrap metadata yields the real 7-section structure with graceful empty-roster /
  // empty-skills placeholders; re-run `bun scripts/generate-l3-readme.ts` after agents
  // and skills exist to populate the Meet-the-AI-Team / Skills sections.
  // variant_type stays `domain ?? "TODO"` in variant.json (above), but the renderer's
  // Variant Type section calls getVariantTypeDescription(), which requires a registry-
  // valid VariantType — so fall back to 'collaboration' purely for rendering safety.
  const bootstrapMetadata: VariantMetadata = {
    name: toVariantSlug(variant),
    description: `TODO: describe the ${displayName} variant.`,
    variantType: domain && isVariantType(domain) ? domain : 'collaboration',
    status: 'beta',
    version: '0.1.0',
    inherits_common: 'templates/common',
    agentRoster: [],
    skills: [],
  };
  generateReadme(projectDir, bootstrapMetadata);
  generateReadmeKo(projectDir, bootstrapMetadata);
  FILE_COUNT += 2; // generateReadme/generateReadmeKo write via applyTemplate, bypassing the local writeFile counter

  // AGENTS.md — header only, workspace roster removed, TODO section added.
  // Emits the §-numbered scaffold plus empty VARIANT-* injection markers and the
  // COMMON-AGENTS Language Policy block so l3-to-variant-pipeline.ts Phase 3.5
  // passes without auto-regeneration on a fresh scaffold.
  const variantMarkers = [
    "VARIANT-AGENTS-START",
    "VARIANT-AGENT-DETAILS-START",
    "VARIANT-DISPATCH-TRIGGERS-START",
    "VARIANT-PHASE-GATE-START",
    "VARIANT-SUBAGENT-ROSTER-START",
    "VARIANT-ROLE-BOUNDARY-START",
  ]
    .map((m) => `<!-- ${m} -->\n<!-- ${m.replace("-START", "-END")} -->`)
    .join("\n");
  const agentsMd = `# AGENTS.md

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in \`CLAUDE.md\` (Claude Code), \`GEMINI.md\` (Gemini CLI).

## §1: Agent Ecosystem Overview

> **Canonical agent index** for the ${displayName} variant.
> Full agent definitions live in \`agents/\`.
> **Agent architecture and governance rules**: See the project governance documentation.

---

## TODO: Add Variant Agents

Define this variant's agents in \`agents/<name>.md\` (3-Section structure:
Legal Basis / Role / Protocols), then register them in the roster table below.

| Agent | File | Tier | Role |
|-------|------|------|------|
| _TODO_ | \`agents/_TODO_.md\` | — | _TODO_ |

> Run \`bun run agent:verify\` after adding agents.

${variantMarkers}
`;
  writeFile(path.join(projectDir, "AGENTS.md"), agentsMd);
  // Append the COMMON-AGENTS Language Policy block verbatim from the L1 baseline.
  const commonAgentsMd = fs.readFileSync(path.join("templates", "common", "AGENTS.md"), "utf-8");
  const blockStart = commonAgentsMd.indexOf("<!-- COMMON-AGENTS:START -->");
  const blockEnd = commonAgentsMd.indexOf("<!-- COMMON-AGENTS:END -->");
  if (blockStart !== -1 && blockEnd !== -1) {
    const block = commonAgentsMd.slice(blockStart, blockEnd) + "<!-- COMMON-AGENTS:END -->\n";
    fs.appendFileSync(path.join(projectDir, "AGENTS.md"), "\n" + block);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6: Domain-specific docs subdirectories
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_DOC_DIRS: Record<string, string[]> = {
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

  // docs/context.md — the immutable common project-context file (SSOT: templates/common/docs/context.md).
  // It lives directly under templates/common/docs/, not inside docs/_common/, so the loop above never
  // picks it up. new-project.ts gets this file for free via its full copyDir(commonDir, projectDir);
  // this L3 path has to copy it explicitly, or every scaffolded project silently ships without it.
  copyItem(path.join(COMMON_DIR, 'docs', 'context.md'), path.join(projectDir, 'docs', 'context.md'));
  log('  ✅ docs/context.md copied (immutable common project context)');

  // The copy above is still the raw common template — [Project Name] / <variant-name> / <variant>
  // placeholders unresolved. new-project.ts's substitute-placeholders.ts helper would do this,
  // but it sweeps every text file in the project — several copied skill docs (e.g.
  // scripts/SCRIPTS.md's `templates/co-*/scripts/<variant>/` example) use the same literal
  // <variant> token as illustrative doc text, not a placeholder, and would get corrupted.
  // Scope the substitution to just the one file that actually needs it.
  const slug = toVariantSlug(variant);
  const contextMdPath = path.join(projectDir, 'docs', 'context.md');
  if (fs.existsSync(contextMdPath)) {
    const substituted = fs.readFileSync(contextMdPath, 'utf8')
      .replace(/\[Project Name\]/g, slug)
      .replace(/<variant-name>/g, slug)
      .replace(/`([^`]*)<variant>([^`]*)`/g, `\`$1${slug}$2\``);
    fs.writeFileSync(contextMdPath, substituted, 'utf8');
    log('  ✅ docs/context.md placeholders substituted ([Project Name], <variant-name>, <variant>)');
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
> Register each agent in \`AGENTS.md\` and run \`bun run agent:verify\`.
`;
  writeFile(path.join(projectDir, "agents", "README.md"), agentsReadme);

  // agents/README_ko.md — Korean placeholder
  const agentsReadmeKo = `# agents/

> TODO: 이 variant의 에이전트 정의 파일을 여기에 추가하세요.
>
> 각 에이전트 파일은 3-Section 구조를 따라야 합니다:
> 1. **Legal Basis** — 역할의 권한/법적 근거
> 2. **Role** — 책임과 범위
> 3. **Protocols** — 운영 절차와 디스패치 규칙
>
> \`AGENTS.md\`에 각 에이전트를 등록하고 \`bun run agent:verify\`를 실행하세요.
`;
  writeFile(path.join(projectDir, "agents", "README_ko.md"), agentsReadmeKo);

  const displayName = toDisplayName(variant);

  // pm.md additive skeleton with variant_overrides support
  // The lifecycle block is required by scripts/validate-agents.ts (FRONTMATTER_REQUIRED_FIELDS
  // = lifecycle.phase, lifecycle.governance). Without it a freshly scaffolded project fails
  // its own `bun scripts/audit.ts` immediately — and since audit is a FATAL gate in the
  // /sync pipeline, the project cannot make its first commit until someone hand-patches
  // this stub. The matching governance record is written just below.
  const pmMd = `---
name: pm
variant: ${toVariantSlug(variant)}
owner: "architect"
status: "active"
version: "0.1.0"
last_updated: "${TODAY}"
lifecycle:
  phase: production
  created: ${TODAY}
  last_updated: ${TODAY}
  governance: docs/lifecycle/agents/pm.md
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

  // Governance record referenced by pm.md's lifecycle.governance field. validate-agents.ts
  // warns when docs/lifecycle/agents/ is missing, and the pair must be created together —
  // a lifecycle block pointing at a nonexistent record is worse than neither.
  writeFile(
    path.join(projectDir, "docs", "lifecycle", "agents", "pm.md"),
    `# Agent Governance Record — pm

## Overview

- **Agent Name**: pm
- **Role**: Project Manager (PM) Agent — variant override extending the workspace PM template
- **Phase**: production
- **Variant**: ${toVariantSlug(variant)}

## Phase History

- **${TODAY}**: Initial release — scaffolded by \`create-l3-scaffold.ts\`.

## Acceptance Criteria

- [x] Defined in \`agents/pm.md\`
- [x] Uses the \`extends\` pattern (ADR-0033) rather than duplicating the workspace PM
- [x] Carries \`lifecycle\` frontmatter with \`phase\` and \`governance\`
- [x] Validated by \`scripts/validate-agents.ts\`
- [ ] TODO: variant_overrides filled in (governance workflow, agent roster, dispatch protocol)
`,
  );
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
  // package.json lives at the project root (written by writePackageJson), not under
  // scripts/. The old check looked for scripts/package.json — a path no template has
  // ever populated — so install was silently skipped on every scaffold. The resulting
  // project appeared to work only because Bun resolves imports by walking up to the
  // parent workspace's node_modules; a standalone clone of the project's own git repo
  // had neither manifest nor dependencies.
  if (!fs.existsSync(path.join(projectDir, "package.json"))) {
    log("⚠️  package.json missing — skipping bun install");
    return;
  }
  log("📦 Running bun install …");
  try {
    runNoShell("bun", ["install"], { cwd: projectDir });
    log("✅ bun install complete");
  } catch (e) {
    log(`⚠️  bun install failed (non-fatal): ${(e as Error).message}`);
    log(`    Manual retry: cd ${projectDir} && bun install`);
  }
}

/**
 * Write the project's package.json, derived from templates/common/package.json.
 *
 * Adapted rather than copied verbatim:
 *  - `name` / `description` become variant-specific
 *  - `workspace-scripts: true` is an L0 marker and must not propagate
 *  - `private: true` is added — L3 prototypes are not published
 *  - `scripts` entries whose target .ts is absent from this scaffold are pruned,
 *    since Tier 3 bootstrap scripts are excluded from L3 copies
 */
function writePackageJson(projectDir: string, variant: string): void {
  const srcPath = path.join(COMMON_DIR, "package.json");
  if (!fs.existsSync(srcPath)) {
    log("  ⚠️  templates/common/package.json missing — skipping package.json generation");
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(srcPath, "utf8")) as Record<string, unknown>;
  const slug = toVariantSlug(variant);

  pkg.name = slug;
  pkg.description = `${toDisplayName(variant)} — L3 variant prototype scaffolded from templates/common`;
  pkg.private = true;
  delete pkg["workspace-scripts"];

  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const kept: Record<string, string> = {};
  const pruned: string[] = [];
  for (const [key, cmd] of Object.entries(scripts)) {
    const target = cmd.split(/\s+/).find((t) => t.startsWith("scripts/") && t.endsWith(".ts"));
    if (!target || fs.existsSync(path.join(projectDir, target))) {
      kept[key] = cmd;
    } else {
      pruned.push(key);
    }
  }
  pkg.scripts = kept;

  writeFile(path.join(projectDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  log(
    `  ✅ package.json written (${Object.keys(kept).length} scripts` +
      (pruned.length ? `, ${pruned.length} pruned: ${pruned.join(", ")}` : "") +
      ")",
  );
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
  log("  6. Regenerate README.md/README_ko.md  → bun scripts/generate-l3-readme.ts (re-run after any agent/skill change)");
  log("  7. Complete variant.json (description, type, agent_overrides, skill_manifest)");
  log("  8. Define PROMOTION_CHECKLIST.md conditions for your domain");
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
  const templateVariantDir = path.join(WORKSPACE_ROOT, "templates", toVariantSlug(args.variant));

  // Step 1: duplicate / existence checks
  if (fs.existsSync(projectDir)) {
    fail(`Projects/${args.variant}/ already exists. Choose a different name or remove it first.`);
  }
  if (fs.existsSync(templateVariantDir)) {
    log(`⚠️  templates/${toVariantSlug(args.variant)}/ already exists — proceeding with L3 scaffold anyway.`);
  }
  if (!fs.existsSync(COMMON_DIR)) {
    fail(`templates/common/ not found at ${COMMON_DIR}`);
  }

  log(`🚀 Creating L3 scaffold: Projects/${args.variant}/  (domain: ${args.domain ?? "none"})`);

  // Step 2: create directory (or dry-run preview)
  if (args.dryRun) {
    log("");
    log("🔍 DRY RUN — the following would be created:");
    log(`  Projects/${args.variant}/`);
    log("    ├─ common overlay: every templates/common/ top-level file/dir NOT in");
    log("    │     COMMON_OVERLAY_EXCLUDE — .gitignore, .env.sample, .githooks/, .github/,");
    log("    │     .claude/{settings.json,commands/,skills/,skills.json}, .gemini/{...}, CHANGELOG.md");
    log("    ├─ .gitattributes + 'docs/context.md merge=ours' protection rule");
    log("    ├─ scripts/ (Tier 3 bootstrap/setup scripts excluded), scripts/hooks/,");
    log("    │     scripts/package.json, scripts/SCRIPTS.md");
    log("    ├─ skills/ (all common skills)");
    log("    ├─ docs/context.md (immutable, placeholders substituted) + docs/_common/*");
    log("    ├─ stubs: variant.json, _ORIGIN.md, _COMMON_VERSION.md,");
    log("    │     PROMOTION_CHECKLIST.md, SECURITY.md, README.md, README_ko.md, AGENTS.md");
    log("    ├─ docs/VERSION_MANIFEST.md + domain doc folders");
    log("    ├─ memory/MEMORY.md");
    log("    ├─ package.json (adapted from templates/common/package.json)");
    log("    └─ agents/README.md");
    log("");
    log("  Then: git init + hooks, bun install (project root), post-scaffold audit");
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

  // Step 4.5: Prune country-scoped assets — MUST run after copyRootSkills():
  // Step 3's overlay excludes top-level skills/ (COMMON_OVERLAY_EXCLUDE), so a
  // prune placed before Step 4 would miss skills/k-* that Step 4 copies in afterward.
  const pruneHelper = path.join(WORKSPACE_ROOT, "scripts", "helpers", "prune-country-scoped-assets.ts");
  if (fs.existsSync(pruneHelper)) {
    const country = args.country || "none";
    log(`🌐 Pruning country-scoped assets${args.country ? ` for ${args.country}` : " (region-neutral)"}…`);
    runNoShell(process.execPath, [pruneHelper, projectDir, country], { cwd: WORKSPACE_ROOT, quiet: false });
  } else {
    log("⚠️  prune-country-scoped-assets.ts not found — skipping country-scoped asset pruning");
  }

  // Step 5: stub files
  generateStubs(projectDir, args.variant, args.domain);

  // Step 6: domain docs + agents/
  createDomainDocs(projectDir, args.domain, args.variant);

  // Step 6.5: lecture-type specific setup (html-themes + presentations/)
  if (args.domain === 'lecture') {
    createLectureScaffold(projectDir);
  }

  // Step 6.6: write .claude/template-version.txt — provenance for upgrade-project.ts
  // (mirrors new-project.ts §5.6 field order: variant/version/platform/country/created)
  const claudeDir = path.join(projectDir, ".claude");
  fs.mkdirSync(claudeDir, { recursive: true });
  const versionFile = path.join(WORKSPACE_ROOT, "templates", "VERSION");
  const templateVersion = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, "utf8").trim() : "unknown";
  const scaffoldCountry = args.country || "none";
  fs.writeFileSync(
    path.join(claudeDir, "template-version.txt"),
    `variant=${toVariantSlug(args.variant)}\nversion=${templateVersion}\nplatform=both\ncountry=${scaffoldCountry}\ncreated=${new Date().toISOString()}\n`
  );
  log(`🧾 Wrote .claude/template-version.txt (variant=${toVariantSlug(args.variant)}, version=${templateVersion}, country=${scaffoldCountry})`);

  // Step 7: git init
  initGit(projectDir);

  // Step 8: package.json + bun install
  writePackageJson(projectDir, args.variant);
  bunInstall(projectDir);

  // Step 9: post-scaffold audit — new-project.ts self-verifies immediately after
  // scaffolding; this script previously didn't, so scaffold defects (like the missing
  // docs/context.md this version fixes) surfaced only later, whenever someone happened
  // to run /sync's pre-commit audit gate. Non-fatal: a fresh L3 draft still has TODOs
  // by design (agents/pm.md placeholders, etc.), so failures here are informational.
  log("\nRunning post-scaffold audit…");
  try {
    runNoShell('bun', [path.join(projectDir, 'scripts', 'audit.ts'), '--skip-memory'], { cwd: projectDir });
    log(`\n✅ Project scaffold verified: Projects/${args.variant}/`);
  } catch {
    log('\n⚠️  Project scaffolded but audit found issues — review above before continuing.');
  }

  // Step 9b: skill/scripts layout guard — detect foreign-variant skills and recursive
  // scripts/<variant>/ nesting at scaffold time instead of letting the defects surface
  // later in audits (docs/designs/2026-08-28-skill-hygiene-and-conventions-design.md).
  {
    const issues: string[] = [];
    const skillsDir = path.join(projectDir, "skills");
    if (fs.existsSync(skillsDir)) {
      // Foreign-variant skills: a skill whose scope names a DIFFERENT variant.
      const walkSkills = (dir: string): string[] => {
        const found: string[] = [];
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!e.isDirectory()) continue;
          const sm = path.join(dir, e.name, "SKILL.md");
          if (fs.existsSync(sm)) found.push(sm);
          else found.push(...walkSkills(path.join(dir, e.name)));
        }
        return found;
      };
      for (const sm of walkSkills(skillsDir)) {
        const content = fs.readFileSync(sm, "utf8");
        const scope = (/^scope:\s*(\S+)/m.exec(content) || [])[1];
        if (scope && /^co-/.test(scope) && scope !== args.variant) {
          issues.push(`foreign-variant skill (scope: ${scope}): ${path.relative(projectDir, sm)}`);
        }
      }
    }
    const nestedScripts = path.join(projectDir, "scripts", toVariantSlug(args.variant), "scripts");
    if (fs.existsSync(nestedScripts)) {
      issues.push(`recursive scripts/${toVariantSlug(args.variant)}/scripts/ nesting detected`);
    }
    if (issues.length > 0) {
      log(`\n⚠️  Layout guard findings (${issues.length}) — review before first commit:`);
      for (const issue of issues) log(`   - ${issue}`);
    } else {
      log(`\n✅ Layout guard clean: no foreign-variant skills, no scripts/ recursion`);
    }
  }

  // Step 10: summary
  printSummary(args.variant);
}

main();
