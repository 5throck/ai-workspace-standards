#!/usr/bin/env bun
// @version 1.30.0
// v1.30.0 (2026-09-25, ADR-0088 W2): `hermes` joins the --platform profiles —
//           hermes-primary keeps .hermes/ and drops the legacy instruction twins
//           (AGENTS.md is the Hermes instruction file); all other profiles are
//           hermes-opt-out. Usage strings and validation extended.
// v1.29.0 (2026-09-25, T-20260924-003 — spec
//           docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.3):
//           §2.3b generalizes from pm.md-only to EVERY agents/*.md carrying
//           `extends:` frontmatter — the 13 variant i18n-specialist.md
//           extends-stubs resolve against templates/common bodies at scaffold
//           time (one log line per resolved stub); pm.md keeps the H12
//           canonical-prose check.
// v1.28.1 (2026-09-24, spec docs/designs/2026-09-24-platform-ssot-constant-design.md):
//           behavior-neutral constant adoption — the two canonical 5-element
//           skill-base literals (legacy-skill sweep, l2_propagate sweep)
//           become PLATFORM_SKILL_BASES (lib/platforms.ts). NO behavior change.
// v1.28.0 (2026-09-24, scaffold hygiene bundle — spec
//           docs/designs/2026-09-24-scaffold-hygiene-bundle-design.md, R6/D5):
//           the argument parse loop gains a catch-all — any `--` token that
//           matched no known flag, or a known flag left without a value, is a
//           HARD ERROR (exit 1) that names the offending token, lists the six
//           valid flags, and prints the usage line, BEFORE any write. This
//           command re-initializes a directory, so silently dropping explicit
//           intent is not acceptable: a live `--varaint co-design` run
//           proceeded on the positional fallback and built the right thing
//           only by luck. Uniform across all flags (`--varaint`,
//           `--platfrom`, and a trailing valueless `--variant` all fail the
//           same way). `--yes`/`-y` are exempt from the catch-all: the
//           auto-confirm prompt scan consumes them from process.argv
//           directly, not through this loop. Value-consumption semantics (a
//           flag eating the next `--` token as its value) stay as documented
//           residual risk RR1 of the same design.
// v1.27.0 (2026-09-24, skills registry overlay reconcile — spec
//           docs/designs/2026-09-24-skills-registry-overlay-reconcile-design.md,
//           T-20260924-008): every fresh scaffold delivered a broken
//           skills/SKILLS.md — the variant overlay walk clobbered the common
//           63-row seed registry with the variant's 4-row (or non-registry)
//           index, and the post-scaffold audit then reported 31 missing-row +
//           1 last_reviewed-drift errors (35 scanned) on every co-design
//           scaffold. Two changes: (1) the overlay walk now skips
//           skills/SKILLS.md (local skip, NOT the shared
//           SCAFFOLD_COMMON_OWNED_FILES set — that set drives validate-templates
//           WS-07 "variants must not carry the file", wrong policy for a file
//           variants legitimately ship as template docs), so the common
//           registry survives as the seed; (2) a post-settle reconcile section
//           (§6.4) runs after the last skill-tree mutation (the
//           l2_propagate:false sweep) and before the workspace-script sweep:
//           pruneSkillRegistryRows drops rows for undelivered skills
//           (region-pruned k-*, swept L1-only skills, workspace-root-only
//           seeds), collectDeliveredSkills + reconcileSkillRegistry update
//           version/last_reviewed from the DELIVERED SKILL.md frontmatter
//           (delivered frontmatter wins the shadow case — the audit's own
//           comparison basis) and append rows for variant-exclusive skills
//           (e.g. service-design). Two placement/alignment passes complete the
//           audit contract fleet-wide (found by the --all-variants E2E): fold
//           the seed's `### Variant-Exclusive Skills` rows into the `###
//           Workspace Skills` table (skill-lifecycle-audit.ts's registry parser
//           reads ONLY the latter) and align surviving rows' status/owner with
//           the delivered frontmatter (the design §10 remedy, applied
//           scaffold-side only — reconcileSkillRegistry stays frozen, AC8).
//           Idempotent; non-fatal (INFO skip when the
//           registry is absent) — the post-scaffold audit stays the gate.
//           Shared machinery lives in helpers/skills-registry.ts v1.1.0;
//           upgrade-project imports the moved frontmatter parser verbatim.
// v1.26.0 (2026-09-24, scaffold identity overview — spec
//           2026-09-24-scaffold-identity-overview-design): §5.2 renders the new
//           identity seed docs/project.md from
//           templates/common/docs/project.template.md (SSOT) via the shared
//           applySubstitutions() token map, then removes the raw .template.md
//           copy from the delivered tree (also in NEW_PROJECT_CLEANUP_FILES —
//           upgrades never resurrect it). New additive flags --description
//           "<one sentence>" and --type web|cli|api|mcp fill the identity
//           fields; when a flag is absent the template's TODO(project-overview)
//           fallback line stays (matches the audit.ts placeholder regex family,
//           so an undescribed project is WARN-visible from its first audit).
//           docs/context.md's Overview section is a byte-stable pointer to
//           docs/project.md (template footer 2.13), so the upgrade wholesale
//           SYNC can never again destroy project identity in place.
// v1.25.0 (2026-09-23, adopt-project engine prerequisites): §2.3b extends-stub
//           resolution and §2.5 L1-B metadata strip extracted verbatim to
//           scripts/helpers/resolve-pm-stub.ts so the adopt-project settling pass can
//           normalize agents/pm.md without a third copy of the logic. Behavior
//           unchanged (same H12 non-canonical prose warning, same output bytes).
// v1.23.0: graft build (§7.7) tries the global `graft` binary before bunx —
//          a bunx native postinstall failure (tree-sitter-kotlin on Windows)
//          leaves a partial temp cache that breaks every later bunx call
//          (spec 2026-09-20-graft-scaffold-resilience).
// v1.22.0: --platform 'both' renamed to 'all' and its meaning expanded to cover
//           all three platforms (claude+antigravity+codex, not just the first
//           two) — 'all' now keeps CLAUDE.md, GEMINI.md, CODEX.md, and .codex/
//           together; single-platform values (claude/antigravity/codex) still
//           drop the others as before.
// v1.21.0: T-20260917-009 — VARIANT_OVERLAY_SKIP derives from the upgrade-policy
//           SCAFFOLD_COMMON_OWNED_FILES classification (same SSOT as
//           validate-templates WS-07); the local hand list is gone.
// v1.20.0: T-20260916-002 — scaffold provenance fallback aligned with the M11
//           fail-loud policy (docs/designs/2026-09-16-new-project-provenance-
//           alignment-design.md): the old resolution chain
//           `--version <tag> || templates/VERSION || silent "unknown"` loses
//           its silent tail. Without --version, templates/VERSION is read via
//           helpers/template-version.ts resolveProvenanceVersion() — a missing
//           or unparseable SSOT aborts pre-flight (before any scaffolding
//           work), so no project can ever record an "unknown" provenance
//           version. An explicit --version value is still accepted as-is.
// v1.19.0: T-20260916-010 — variant templates stopped shipping a stub
//           docs/VERSION_MANIFEST.md (the stub class retired by the new
//           validate-templates `variant-version-manifest` arm); the project's
//           full manifest is now generated post-delivery by §7.8, which runs
//           the project's own scripts/generate-version-manifest.ts
//           (cwd = projectDir) BEFORE the post-scaffold audit. Loud non-fatal
//           warn-and-continue on failure (mirror of the §7.7 graft build
//           semantics) — the audit's VERSION_MANIFEST gates catch a missing
//           or stale manifest either way.
// v1.18.0: Wave 2 scaffold-delivery validation batch
//           (docs/designs/2026-09-16-scaffold-delivery-validation-design.md).
//           H12/T-20260915-010: when a resolved variant pm.md extends-stub
//           body is NOT the canonical stub prose (canonicalPmStubBody in
//           helpers/scaffold-markers.ts), print a loud warning naming the
//           variant and file before continuing — the body would be silently
//           discarded by the L1-body attach. H13/T-20260915-003: the
//           delivery-skip data (COPY_SKIP_ENTRIES, WORKSPACE_ONLY_FILES,
//           L1_ONLY_AGENTS, L1_ONLY_DIRS, cleanup files, legacy L0 skills)
//           now imports from helpers/scaffold-markers.ts so the delivery-tree
//           parity derivation cannot drift from this script's behavior.
// v1.16.0: Bare project names scaffold under Projects/<name> (canonical layout) instead
//           of the workspace root — root-level scaffolds are how the 2026-09-12
//           root-upgrade incident litter accumulated (memory/2026-09-12.md). Path-like
//           names (containing '/') remain explicit workspace-relative destinations so
//           scripts/test-new-project.ts keeps scaffolding into tests/.temp/. A resolved
//           target that escapes the workspace root is rejected.
// v1.15.1: T-20260912-022 — usage strings now list `codex` in the --platform
//           choices (argument validation already accepted it; docs-only fix).
// v1.15.0: T-20260912-004 — pm.md extends-stub resolution is now frontmatter-based
//           (`extends:` present) instead of requiring an empty body, so the five
//           prose-stub variants (co-export, co-hr, co-news, co-price, co-safety)
//           scaffold a full PM agent instead of a body-less one; variant_overrides /
//           remove_sections are rendered into body sections and stripped from the
//           merged frontmatter (ADR-0039/0034 scaffold-time contract). T-20260912-006
//           — §2.5b sanitizer blanks the L0-reference text instead of dropping the
//           line (docs/context.md version footer survives for upgrade version-sync);
//           shared pattern moved to helpers/l0-ref-policy.ts.
// new-project.ts — Scaffold a new project under Projects/ (or an explicit workspace-relative path)
// Usage: bun scripts/new-project.ts "<project-name>" [--variant <variant>] [--platform claude|antigravity|codex|hermes|all] [--version X.Y.Z] [--country <CODE>] [--description "<one sentence>"] [--type web|cli|api|mcp]
//
// Migrated from new-project.sh/ps1 per ADR-0036. No file permission manipulation.

import {
  existsSync, mkdirSync, rmSync, readdirSync, statSync,
  readFileSync, writeFileSync, copyFileSync, appendFileSync, chmodSync, mkdtempSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { resolve, join, dirname, basename, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyContextTemplate, DEFAULT_PM_ROLE_DESCRIPTIONS } from './helpers/template-utils.ts';
import { rollbackPartialProject } from './helpers/rollback-partial-project.ts';
import { blankL0Refs } from './helpers/l0-ref-policy.ts';
import { resolveProvenanceVersion } from './helpers/template-version.ts';
import {
  NEW_PROJECT_COPY_SKIP_ENTRIES,
  NEW_PROJECT_WORKSPACE_ONLY_FILES,
  NEW_PROJECT_L1_ONLY_AGENTS,
  NEW_PROJECT_L1_ONLY_DIRS,
  NEW_PROJECT_CLEANUP_FILES,
  NEW_PROJECT_LEGACY_L0_SKILLS,
  VERSION_MANIFEST_GENERATOR_RELPATH,
  VERSION_MANIFEST_RELPATH,
  decideManifestGeneration,
  isCanonicalPmStubBody,
} from './helpers/scaffold-markers.ts';
import { resolveAgentExtendsStub, stripL1BMetadata } from './helpers/resolve-pm-stub.ts';
import { applySubstitutions } from './helpers/substitute-placeholders.ts';
import {
  alignSkillRegistryRowsWithFrontmatter,
  collectDeliveredSkills,
  foldVariantExclusiveRowsIntoWorkspaceSection,
  pruneSkillRegistryRows,
  reconcileSkillRegistry,
} from './helpers/skills-registry.ts';
import { SCAFFOLD_COMMON_OWNED_FILES } from './lib/upgrade-policy.ts';
import { PLATFORM_SKILL_BASES } from './lib/platforms.ts';

// ── Argument parsing ───────────────────────────────────────────────────────────
let projectName = '';
let variant = '';
let templateVer = '';
let platform = 'all';
let country = '';
let projectDescription = '';
let projectType = '';

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variant' && args[i + 1]) { variant = args[++i]; continue; }
  if (args[i] === '--description' && args[i + 1]) {
    projectDescription = args[++i];
    continue;
  }
  if (args[i] === '--type' && args[i + 1]) {
    projectType = args[++i];
    if (!['web', 'cli', 'api', 'mcp'].includes(projectType)) {
      console.error(`❌ Invalid --type value: '${projectType}'. Use one of: web, cli, api, mcp.`);
      if (import.meta.main) {
        process.exit(1);
      }
    }
    continue;
  }
  if (args[i] === '--version' && args[i + 1]) {
    templateVer = args[++i];
    // Strict allowlist: only alphanumeric, dots, hyphens, underscores — no shell metacharacters
    if (!/^[a-zA-Z0-9._-]+$/.test(templateVer)) {
      console.error(`❌ Invalid --version value: '${templateVer}'. Only letters, numbers, dots, hyphens, underscores allowed.`);
      if (import.meta.main) {
        process.exit(1);
      }
    }
    continue;
  }
  if (args[i] === '--platform' && args[i + 1]) { platform = args[++i]; continue; }
  if (args[i] === '--country' && args[i + 1]) {
    country = args[++i];
    // Validate country pattern: ISO 3166-1 alpha-2 or well-known region codes (EU, ASEAN)
    if (!/^[A-Z]{2,4}$/.test(country)) {
      console.error(`❌ Invalid --country value: '${country}'. Use ISO 3166-1 alpha-2 (KR, US), region code (EU, ASEAN), or omit for region-neutral.`);
      if (import.meta.main) {
        process.exit(1);
      }
    }
    continue;
  }
  if (!projectName && !args[i].startsWith('--')) { projectName = args[i]; continue; }
  if (projectName && !variant && !args[i].startsWith('--')) { variant = args[i]; continue; }
  // R6 (2026-09-24-scaffold-hygiene-bundle-design, D5): catch-all — a `--` token
  // that reached this point matched no known flag, or was a known flag left
  // without a value (those guards require a truthy next token). Hard error
  // before any write: this command re-initializes a directory, so
  // explicit-but-typo'd intent (`--varaint`, `--platfrom`) must never be
  // silently dropped. `--yes` is exempt — the auto-confirm prompt scan below
  // consumes it from process.argv directly (it never takes a value here).
  if (args[i].startsWith('--') && args[i] !== '--yes') {
    console.error(`❌ Unknown flag: '${args[i]}'.`);
    console.error('   Valid flags: --variant <co-variant> | --description "<one sentence>" | --type web|cli|api|mcp | --version X.Y.Z | --platform claude|antigravity|codex|hermes|all | --country <CODE>');
    console.error('   Usage: bun scripts/new-project.ts "<project-name>" [--variant <variant>] [--platform claude|antigravity|codex|hermes|all] [--version X.Y.Z] [--country <CODE>] [--description "<one sentence>"] [--type web|cli|api|mcp]');
    if (import.meta.main) {
      process.exit(1);
    }
    continue;
  }
}

if (!projectName) {
  console.error('Usage: bun scripts/new-project.ts "<project-name>" [--variant <variant>] [--platform claude|antigravity|codex|hermes|all] [--version X.Y.Z] [--country <CODE>] [--description "<one sentence>"] [--type web|cli|api|mcp]');
  console.error('       --description/--type are optional; when omitted, docs/project.md keeps its TODO(project-overview) fallback lines.');
  if (import.meta.main) {
    process.exit(1);
  }
}

// Validate project name
if (!/^[a-zA-Z0-9_/.\-]+$/.test(projectName) || projectName.includes('..')) {
  console.error(`❌ Invalid project name: '${projectName}'`);
  console.error('   Only letters, numbers, hyphens (-), underscores (_), and dots (.) are allowed, without path traversal (..).');
  if (import.meta.main) {
    process.exit(1);
  }
}
if (projectName.length > 64) {
  console.error(`❌ Project name too long (${projectName.length} chars). Maximum is 64 characters.`);
  if (import.meta.main) {
    process.exit(1);
  }
}

// Validate platform
if (!['claude', 'antigravity', 'all', 'codex', 'hermes'].includes(platform)) {
  console.error('❌ --platform must be: claude, antigravity, codex, hermes, or all (default: all)');
  if (import.meta.main) {
    process.exit(1);
  }
}

// ── Workspace root resolution ──────────────────────────────────────────────────
const workspaceRoot = resolve(import.meta.dir, '..');
// Bare names scaffold under Projects/<name> (canonical layout). Path-like names
// (containing '/') are explicit workspace-relative destinations — the E2E harness
// (scripts/test-new-project.ts) scaffolds into tests/.temp/ this way.
const projectDir = projectName.includes('/')
  ? resolve(workspaceRoot, projectName)
  : join(workspaceRoot, 'Projects', projectName);
// Containment guard (incident 2026-09-12): never resolve to — or outside — the
// workspace root itself.
if (resolve(projectDir) === workspaceRoot || relative(workspaceRoot, resolve(projectDir)).startsWith('..')) {
  console.error(`❌ Project directory escapes the workspace: ${projectDir}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

// H7 (2026-09-15 project review): a path-like name landing inside a managed
// top-level directory scaffolds a full project tree exactly where the fleet
// auto-detects variants (templates/co-*) or ships undeclared content
// (scripts/, docs/, agents/) — the litter class behind the 2026-09-12
// root-upgrade incident. 'tests' stays allowed: the E2E harness scaffolds
// into tests/.temp/ by design.
const MANAGED_TOP_LEVEL_DIRS = new Set([
  'templates', 'scripts', 'docs', 'agents', 'skills', 'memory', 'graft',
  '.github', '.claude', '.gemini', '.agents', '.codex',
]);
if (projectName.includes('/') && MANAGED_TOP_LEVEL_DIRS.has(projectName.split('/')[0])) {
  console.error(`❌ Project target '${projectName}' resolves inside the managed '${projectName.split('/')[0]}/' directory.`);
  console.error('   Scaffold into Projects/ (bare name) or tests/.temp/ instead.');
  if (import.meta.main) {
    process.exit(1);
  }
}

// ── Scaffold provenance version (fail-loud fallback) ──────────────────────────
// T-20260916-002 (M11 residual): the old resolution chain was
//   --version <tag> || templates/VERSION || silent "unknown".
// The silent tail is gone (policy parity with create-l3-scaffold.ts):
// without --version, templates/VERSION must be readable — a missing or
// unparseable SSOT aborts here, BEFORE any scaffolding work (tag extraction,
// readiness gate, copy), so no project can ever record an "unknown"
// provenance version in docs/<variant>.context.md or .claude/template-version.txt.
let templateVersion = '';
try {
  templateVersion = resolveProvenanceVersion(templateVer, workspaceRoot);
} catch (err) {
  console.error(`❌ ${(err as Error).message}`);
  if (import.meta.main) {
    process.exit(1);
  }
  throw err; // imported (non-main) context: never fall through with no version
}

// ── Variant detection & validation ────────────────────────────────────────────
function getValidVariants(fromTag?: string): string[] {
  if (fromTag) {
    const result = spawnSync('git', ['-C', workspaceRoot, 'archive', fromTag, '--list'], { encoding: 'utf8' });
    if (result.status !== 0) return [];
    return result.stdout
      .split('\n')
      .filter(l => /^templates\/co-[^/]+\/variant\.json$/.test(l))
      .map(l => l.replace('templates/', '').replace('/variant.json', ''))
      .sort();
  }
  if (!existsSync(join(workspaceRoot, 'templates'))) return [];
  return readdirSync(join(workspaceRoot, 'templates'))
    .filter(d => d.startsWith('co-'))
    .sort();
}

const tag = templateVer ? `template-v${templateVer}` : '';
const validVariants = getValidVariants(tag || undefined);

if (tag && validVariants.length === 0) {
  console.error(`❌ Could not detect variants from tag '${tag}'. Tag may not exist.`);
  console.error('   To list available tags: git tag --list \'template-v*\'');
  if (import.meta.main) {
    process.exit(1);
  }
}

if (!variant) {
  console.error('\n[INFO] No variant specified. Please choose one:');
  validVariants.forEach(v => console.error(`   ${v}`));
  console.error(`\n   Usage: bun scripts/new-project.ts "${projectName}" --variant <variant>\n`);
  if (import.meta.main) {
    process.exit(1);
  }
}

if (!validVariants.includes(variant)) {
  console.error(`❌ Invalid variant: ${variant}`);
  console.error(`   Valid variants: ${validVariants.join(' ')}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

// ── Directory resolution (with optional git-tag extraction) ───────────────────
let commonDir = join(workspaceRoot, 'templates', 'common');
let templatesDir = join(workspaceRoot, 'templates', variant);
let tempDir = '';

if (tag) {
  // Verify tag exists
  const tagCheck = spawnSync('git', ['-C', workspaceRoot, 'tag', '-l', tag], { encoding: 'utf8' });
  if (!tagCheck.stdout.trim()) {
    console.error(`❌ Template version not found: ${tag}`);
    console.error('   Run: bun scripts/list-template-versions.ts');
    if (import.meta.main) {
      process.exit(1);
    }
  }
  // Extract from tag into temp dir (cross-platform: uses Node.js fs, no mktemp/tar dependency)
  tempDir = mkdtempSync(join(tmpdir(), 'new-project-'));
  const archivePath = join(tempDir, '_archive.tar');
  const archiveRes = spawnSync(
    'git', ['-C', workspaceRoot, 'archive', '--output', archivePath, tag, 'templates/common/', `templates/${variant}/`],
    { encoding: 'utf8' }
  );
  // tar is available on modern Windows 10/11, macOS, and Linux
  const extract = archiveRes.status === 0
    ? spawnSync('tar', ['-x', '-C', tempDir, '-f', archivePath], { encoding: 'utf8' })
    : archiveRes;
  if (extract.status !== 0) {
    console.error(`❌ Failed to extract template version ${tag}`);
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    if (import.meta.main) {
      process.exit(1);
    }
  }
  commonDir = join(tempDir, 'templates', 'common');
  templatesDir = join(tempDir, 'templates', variant);
  if (!existsSync(templatesDir)) {
    console.error(`❌ Variant '${variant}' not found in template version ${tag}`);
    rmSync(tempDir, { recursive: true, force: true });
    if (import.meta.main) {
      process.exit(1);
    }
  }
  console.log(`📦 Using template version: ${tag}`);
}

// Register cleanup on exit
if (tempDir) {
  process.on('exit', () => { try { rmSync(tempDir, { recursive: true, force: true }); } catch (err) { console.error(`[new-project] Error: ${err}`); } });
  if (import.meta.main) {
    process.on('SIGINT', () => { rmSync(tempDir, { recursive: true, force: true }); process.exit(130); });
  }
}

// ── Pre-flight checks ──────────────────────────────────────────────────────────
if (existsSync(projectDir)) {
  console.error(`❌ Directory already exists: ${projectDir}`);
  if (import.meta.main) {
    process.exit(1);
  }
}
if (!existsSync(templatesDir)) {
  console.error(`❌ Template variant not found: ${templatesDir}`);
  console.error(`   Available variants: ${validVariants.join(' ')}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

// Variant status check
const variantJsonPath = join(templatesDir, 'variant.json');
if (existsSync(variantJsonPath)) {
  const vj = JSON.parse(readFileSync(variantJsonPath, 'utf8'));
  if (vj.status && vj.status !== 'stable') {
    console.log(`⚠️  Variant '${variant}' has status: ${vj.status}`);
    console.log('   This variant may not be fully implemented.');
    const autoYes = process.argv.includes('--yes') || process.argv.includes('-y') || process.env.CI === 'true' || process.env.CI === '1';
    const answer = autoYes ? 'y' : (prompt('   Continue anyway? [y/N] ') ?? '');
    if (!['y', 'Y'].includes(answer)) {
      console.log('Aborted.');
      if (import.meta.main) {
        process.exit(1);
      }
    }
  }
}

// Variant Readiness Gate (pre-flight): refuse to scaffold from a variant that is
// not READY (broken agent/skill manifest paths, missing PROMOTION_CHECKLIST.md,
// missing README/AGENTS.md, inconsistent country_config). A project may only be
// created from a validated variant.
const gateScript = join(workspaceRoot, 'scripts', 'validate-variant-readiness.ts');
if (existsSync(gateScript)) {
  console.log(`\nRunning Variant Readiness Gate for variant '${variant}'...`);
  const gateResult = spawnSync(process.execPath, [gateScript, '--variant', variant], { encoding: 'utf8' });
  if (gateResult.status !== 0) {
    console.error(`\n❌ Variant '${variant}' failed the Variant Readiness Gate.`);
    console.error('   A project may only be created from a READY variant.');
    console.error(`   Run: bun scripts/validate-variant-readiness.ts --variant ${variant}`);
    if (import.meta.main) process.exit(1);
  } else {
    console.log(`✅ Variant '${variant}' passed the Variant Readiness Gate.`);
  }
}

// ── Country/jurisdiction selection ──────────────────────────────────────────────
let selectedCountry = '';
const autoYes = process.argv.includes('--yes') || process.argv.includes('-y') || process.env.CI === 'true' || process.env.CI === '1';

// Check if variant has country_config
let countryConfig: { profiles_dir?: string; supported?: string[]; default?: string | null } | undefined;
if (existsSync(variantJsonPath)) {
  try {
    const variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8')) as Record<string, unknown>;
    countryConfig = variantJson.country_config as { profiles_dir?: string; supported?: string[]; default?: string | null } | undefined;
  } catch (e) {
    // variant.json parse error - skip country config
  }
}

if (countryConfig?.supported && countryConfig.supported.length > 0) {
  // Variant has country_config - handle country selection
  if (country) {
    // --country flag provided
    if (!countryConfig.supported.includes(country)) {
      console.error(`❌ Country '${country}' not supported by variant '${variant}'.`);
      console.error(`   Supported: ${countryConfig.supported.join(', ')}`);
      if (import.meta.main) {
        process.exit(1);
      }
    }
    selectedCountry = country;
  } else if (!autoYes) {
    // Interactive prompting
    console.log(`\n🌐 This variant supports country-specific profiles. Select target jurisdiction:`);
    const profilesDir = join(templatesDir, countryConfig.profiles_dir || 'docs/countries');
    const options: string[] = [];

    for (const code of countryConfig.supported) {
      const profilePath = join(profilesDir, `${code}.md`);
      let displayName = code;
      if (existsSync(profilePath)) {
        try {
          const profileContent = readFileSync(profilePath, 'utf-8');
          const nameMatch = profileContent.match(/^name:\s*(.+)$/m);
          if (nameMatch) displayName = `${code} — ${nameMatch[1].trim()}`;
        } catch (e) {
          // Profile read error - use code only
        }
      }
      options.push(`${options.length + 1}. ${displayName}`);
    }
    options.push(`${options.length + 1}. Region-neutral (no target jurisdiction)`);

    console.log(options.join('\n'));
    const answer = prompt(`Select jurisdiction [1-${options.length}, default: ${options.length}]: `) ?? `${options.length}`;
    const selection = parseInt(answer, 10);

    if (isNaN(selection) || selection < 1 || selection > options.length) {
      console.log('Invalid selection. Defaulting to region-neutral.');
      selectedCountry = ''; // Region-neutral
    } else if (selection === options.length) {
      selectedCountry = ''; // Region-neutral
    } else {
      selectedCountry = countryConfig.supported[selection - 1];
    }
  } else {
    // --yes or CI: default to region-neutral
    selectedCountry = '';
  }
} else {
  // Variant does not have country_config
  if (country) {
    console.error(`❌ Variant '${variant}' does not support country profiles.`);
    console.error('   The --country flag is only valid for variants with country_config.');
    if (import.meta.main) {
      process.exit(1);
    }
  }
  selectedCountry = ''; // Region-neutral
}

// ── Lifecycle governance pre-check ────────────────────────────────────────────
const governanceJson = join(workspaceRoot, 'docs', 'templates', 'lifecycle-governance.json');
if (existsSync(join(workspaceRoot, 'scripts', 'validate-templates.ts')) && existsSync(governanceJson)) {
  console.log(`\nRunning lifecycle governance pre-check for variant '${variant}'…`);
  const govResult = spawnSync(process.execPath, [join(workspaceRoot, 'scripts', 'helpers', 'lifecycle-governance.ts')], { encoding: 'utf8' });
  const mandatoryDomains = govResult.status === 0 ? govResult.stdout.trim() : 'variant,agent,skill';

  const validateResult = spawnSync(
    process.execPath, [join(workspaceRoot, 'scripts', 'validate-templates.ts'), '--variant', variant, '--json'],
    { encoding: 'utf8' }
  );
  const validateOutput = validateResult.stdout || '{"errors":[{"check":"validate-failed","message":"validate-templates.ts failed to run"}]}';

  const validateCheck = spawnSync(
    process.execPath, [join(workspaceRoot, 'scripts', 'helpers', 'validate-output.ts'), mandatoryDomains, validateOutput],
    { encoding: 'utf8' }
  );
  if (validateCheck.status !== 0) {
    console.error(`\n❌ Lifecycle governance pre-check FAILED for variant '${variant}'.`);
    console.error('   Fix the issues above before creating a project from this variant.');
    console.error(`   Run: bun scripts/validate-templates.ts --variant ${variant}`);
    if (import.meta.main) {
      process.exit(1);
    }
  }
  console.log(`  ✅ Lifecycle governance pre-check passed (mandatory domains: ${mandatoryDomains})`);
}

// ── Template validation ────────────────────────────────────────────────────────
const templateValidationHelper = join(workspaceRoot, 'scripts', 'helpers', 'template-validation.ts');
if (existsSync(templateValidationHelper)) {
  console.log('Validating template integrity…');
  const result = spawnSync(process.execPath, [templateValidationHelper, variant, commonDir, templatesDir], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr);
    if (import.meta.main) {
      process.exit(1);
    }
  }
}

// ── Helper: copy directory recursively ────────────────────────────────────────
// Entries that must never be copied into a scaffolded project (mirrors
// create-l3-scaffold.ts's overlay exclude): dependency trees
// (templates/common/node_modules alone is ~35MB — projects run their own
// `bun install`) and Gateguard's local state file. T-20260915-003 (H13): the
// list lives in the shared scaffold-markers contract module so the
// delivery-tree parity derivation stays faithful to this script.
const COPY_SKIP_ENTRIES = new Set(NEW_PROJECT_COPY_SKIP_ENTRIES);

function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (entry === '.DS_Store') continue; // OS cruft — never copy into a scaffolded project
    if (COPY_SKIP_ENTRIES.has(entry)) continue;
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
    }
  }
}

// ── Helper: make all files in directory user-writable ─────────────────────────
// Template files may have read-only bits set (e.g. scripts/README.md).
// This ensures subsequent write steps (merge-package-scripts, write-scripts-snapshot)
// can open them without EPERM. This is NOT security permission manipulation —
// it only restores the default user-writable state that OS-created files have.
function makeWritable(dir: string): void {
  for (const f of walkFiles(dir)) {
    try {
      const mode = statSync(f).mode;
      if (!(mode & 0o200)) chmodSync(f, mode | 0o200);
    } catch (err) {
      console.error(`[new-project] Error: ${err}`);
    }
  }
}

// ── Helper: walk all files in a directory ─────────────────────────────────────
function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkFiles(full);
    else yield full;
  }
}

// ── 1. Copy common/ (shared infrastructure) ───────────────────────────────────
if (!existsSync(commonDir)) {
  console.error(`❌ Common templates directory not found: ${commonDir}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

console.log(`🚀 Scaffolding new project: ${projectName}`);
mkdirSync(projectDir, { recursive: true });

// M13: from this point on, any failure (explicit process.exit(1) — of which
// this script has many — or an uncaught exception) must not leave a broken,
// half-scaffolded project directory behind. Node/Bun's 'exit' event fires
// synchronously in both cases, making it a single, low-risk hook point
// without restructuring the rest of this script's control flow.
if (import.meta.main) {
  process.on('exit', (code) => {
    if (code === 0) return;
    const result = rollbackPartialProject(projectDir, workspaceRoot);
    if (result.rolledBack) {
      console.error(`🧹 Rolled back partially-created project directory: ${projectDir}`);
    }
  });
}

// Workspace-only files that must NOT be copied into new projects
// (single source: helpers/scaffold-markers.ts — T-20260915-003)
const WORKSPACE_ONLY_FILES = [...NEW_PROJECT_WORKSPACE_ONLY_FILES];
copyDir(commonDir, projectDir);
// Ensure all copied files are user-writable (template storage may set read-only bits)
makeWritable(projectDir);
for (const f of WORKSPACE_ONLY_FILES) {
  const fp = join(projectDir, f);
  if (existsSync(fp)) { rmSync(fp); console.log(`  🗑️  Excluded workspace-only file: ${f}`); }
}

// ── 2.5c. Generate project root package.json ─────────────────────────────
// Self-contained projects use a single root package.json as SSOT.
// All runtime dependencies (js-yaml, etc.) and scripts are resolved from root.
const templatePkg = join(commonDir, 'package.json');
if (!existsSync(templatePkg)) {
  throw new Error(`Template package.json not found: ${templatePkg}`);
}
const pkg = JSON.parse(readFileSync(templatePkg, 'utf-8'));
// Slugify: lowercase, non-alphanumeric → hyphen, collapse, trim edges
let slug = projectName
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');
// Fallback priority: projectName → basename(projectDir) → "workspace" (with warning)
// Note: "workspace" can collide if multiple non-Latin-named projects exist in same workspace
if (!slug) {
  slug = basename(projectDir)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'workspace';
  console.log(`  ⚠️  Project name "${projectName}" produced no valid slug — using "${slug}"`);
}
pkg.name = slug;
writeFileSync(join(projectDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(`  ✅ Root package.json generated (name: ${pkg.name})`);

// ── L1-only agent files ──────────────────────────────────────────────────
// (single source: helpers/scaffold-markers.ts — T-20260915-003)
const L1_ONLY_AGENTS = [...NEW_PROJECT_L1_ONLY_AGENTS];
for (const a of L1_ONLY_AGENTS) {
  const fp = join(projectDir, a);
  if (existsSync(fp)) { rmSync(fp); console.log(`  🗑️  Excluded L1-only agent: ${a}`); }
}

// L1-only directories (single source: helpers/scaffold-markers.ts — T-20260915-003;
// the same list is re-applied after the variant overlay in §2.6b)
const L1_ONLY_DIRS = [...NEW_PROJECT_L1_ONLY_DIRS];
for (const d of L1_ONLY_DIRS) {
  const dp = join(projectDir, d);
  if (existsSync(dp)) { rmSync(dp, { recursive: true }); console.log(`  🗑️  Excluded L1-only directory: ${d}`); }
}

// ── 2.5b. Sanitize: blank L0 CONSTITUTION.md references in all .md files ────
// Defense-in-depth: blank the L0-reference text (CONSTITUTION.md / docs/constitution/)
// inside affected lines of files that should not reference L0 in generated L2 variant
// projects. T-20260912-006: the previous implementation DROPPED the whole line, which
// deleted a docs/context.md version footer that merely cited an L0 rule — permanently
// silencing upgrade-project's version-sync (VERSION_FOOTER_RE needs the footer line).
// blankL0Refs() preserves line structure and removes only the matched text.
let sanitizedCount = 0;
for (const f of walkFiles(projectDir)) {
  if (!f.endsWith('.md')) continue;
  const original = readFileSync(f, 'utf-8');
  const cleaned = blankL0Refs(original);
  if (cleaned !== original) {
    writeFileSync(f, cleaned);
    sanitizedCount++;
  }
}
if (sanitizedCount > 0) {
  console.log(`  🧹 Sanitized ${sanitizedCount} file(s): blanked L0 CONSTITUTION references`);
}

// Clear memory log files (new projects start with empty memory/)
const memoryDir = join(projectDir, 'memory');
if (existsSync(memoryDir)) {
  for (const f of walkFiles(memoryDir)) {
    if (f.endsWith('.md')) rmSync(f);
  }
  console.log('  🗑️  Cleared memory/*.md (new projects start with empty memory/)');

  // Seed memory/MEMORY.md — mirrors create-l3-scaffold.ts. sync-md.ts treats a missing
  // "## Sessions" index as a legacy file needing migration on every run; a fresh project
  // starts with the canonical structure instead (2026-09-21 review M-13).
  writeFileSync(
    join(memoryDir, 'MEMORY.md'),
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
  console.log('  ✅ Seeded memory/MEMORY.md (empty index)');
}

// ── 2.6. Flatten docs/_common/ → docs/ ───────────────────────────────────────
const commonDocs = join(projectDir, 'docs', '_common');
if (existsSync(commonDocs)) {
  copyDir(commonDocs, join(projectDir, 'docs'));
  rmSync(commonDocs, { recursive: true });
  console.log('  ✅ docs/_common/ → docs/ (flattened)');
}

// ── 2. Overlay variant/ on top ────────────────────────────────────────────────
if (!existsSync(templatesDir)) {
  console.error(`❌ Variant templates directory not found: ${templatesDir}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

console.log('📝 Copying variant templates...');
// Files a variant MUST NOT overlay — owned by templates/common/ (copied earlier in
// this pass) and sacred to the project. A variant-level docs/context.md would clobber
// the canonical immutable context that was just laid down (see CONSTITUTION.md §10).
// The set derives from the upgrade-policy SCAFFOLD_COMMON_OWNED_FILES classification —
// the same SSOT validate-templates WS-07 enforces (no variant copy may exist at all);
// this skip is defense-in-depth at scaffold time. (T-20260917-009)
for (const srcFile of walkFiles(templatesDir)) {
  const relPath = relative(templatesDir, srcFile).replace(/\\/g, '/');
  if (SCAFFOLD_COMMON_OWNED_FILES.has(relPath)) {
    console.log(`  ⏭️  Skipped variant overlay (owned by templates/common/): ${relPath}`);
    continue;
  }
  // T-20260924-008: the variant skills registry must not clobber the common
  // 63-row seed — the variant copies are template-side documentation (co-design
  // ships 4 rows, co-abap a non-registry table), and letting them win left every
  // scaffold with a registry that contradicts the delivered tree. The common
  // registry stays as the seed; the §6.4 reconcile below prunes/updates/appends
  // rows to match the final delivered tree. Local skip, NOT SCAFFOLD_COMMON_
  // OWNED_FILES: that set drives validate-templates WS-07 (variants must not
  // carry the file at all) — variants legitimately ship their SKILLS.md.
  if (relPath === 'skills/SKILLS.md') {
    console.log(`  ⏭️  Skipped variant overlay (registry reconcile seeds from common): ${relPath}`);
    continue;
  }
  const destFile = join(projectDir, relPath);
  mkdirSync(dirname(destFile), { recursive: true });
  copyFileSync(srcFile, destFile);
}
// Ensure variant-overlaid files are also writable
makeWritable(projectDir);

// ── 2.3b. Resolve variant agents/*.md extends-stubs against the L1 bodies ────
// Logic extracted verbatim to scripts/helpers/resolve-pm-stub.ts (v1.25.0, adopt-project
// engine prerequisites) so the adopt-project settling pass can normalize pm.md without a
// third copy. v1.29.0 (T-20260924-003, R2.3): generalized from pm.md-only to EVERY
// agents/*.md carrying `extends:` frontmatter (the 13 variant i18n-specialist.md
// stubs resolve here too); pm.md keeps the H12 canonical-prose check injected.
{
  const projAgentsDir = join(projectDir, 'agents');
  if (existsSync(projAgentsDir)) {
    for (const fname of readdirSync(projAgentsDir).filter(f => f.endsWith('.md')).sort()) {
      const agentPath = join(projAgentsDir, fname);
      const stubResult = resolveAgentExtendsStub(
        agentPath,
        join(commonDir, 'agents', fname),
        variant,
        fname === 'pm.md' ? { isCanonicalStubBody: isCanonicalPmStubBody } : undefined,
      );
      const rel = `agents/${fname}`;
      if (stubResult.resolved && stubResult.nonCanonical) {
        console.warn(
          `  ⚠️  ${rel}: variant '${variant}' ships a NON-canonical extends-stub body ` +
            `(${stubResult.proseBodyLength} chars) in templates/${variant}/agents/${fname} — it is not the ` +
            `canonical stub prose and will be DISCARDED when the templates/common body is attached. ` +
            `If this body holds real variant content, inline it and remove \`extends:\`; ` +
            `otherwise restore the canonical stub.`
        );
      }
      if (stubResult.resolved && stubResult.shape === 'prose') {
        console.log(`  ✅ ${rel}: resolved prose extends-stub against templates/common body`);
      } else if (stubResult.resolved) {
        console.log(`  ✅ ${rel}: resolved empty extends-stub against templates/common body`);
      } else if (stubResult.missingL1) {
        console.log(`  ⚠️  ${rel}: extends-stub but templates/common/agents/${fname} is missing — project ships a stub agent`);
      }
    }
  }
}

// ── 2.4. Prune country-scoped assets ───────────────────────────────────────────
const pruneHelper = join(workspaceRoot, 'scripts', 'helpers', 'prune-country-scoped-assets.ts');
if (existsSync(pruneHelper)) {
  console.log(`🌐 Pruning country-scoped assets${selectedCountry ? ` for ${selectedCountry}` : ' (region-neutral)'}…`);
  const pruneResult = spawnSync(process.execPath, [pruneHelper, projectDir, selectedCountry || 'none', variant || 'none'], { stdio: 'inherit' });
  if (pruneResult.status !== 0) {
    console.error('❌ Prune helper failed');
    // T-012-BUG: called with only (projectDir); the required workspaceRoot argument was
    // missing, so at runtime resolve(undefined) threw inside the helper and the partial-
    // project rollback never ran (the script crashed instead of exiting cleanly).
    // Passing workspaceRoot (same as the existing call above) restores the intended behavior.
    rollbackPartialProject(projectDir, workspaceRoot);
    if (import.meta.main) {
      process.exit(1);
    }
  }
} else {
  console.warn('⚠️  prune-country-scoped-assets.ts not found — skipping country-scoped asset pruning');
}
console.log('  ✅ Variant templates copied');

// ── 2.3a. Purge Windows device-name artifacts copied from the template ─────────
// copyDir ignores .gitignore, so a device-name file (e.g. `nul`) that somehow lands in a
// templates/co-*/ directory ships into every project scaffolded from that variant — observed
// live: templates/co-deck/nul (created 2026-08-17 by an external tool) propagated into every
// co-deck scaffold, where it blocked deleting the project directory from PowerShell. Delete
// such files here, at the propagation point, so a scaffold is clean even if a template
// regresses. audit.ts sweeps the templates/ tree too, but that runs later and elsewhere.
{
  const DEVICE_NAMES = new Set([
    'nul', 'NUL', 'con', 'CON', 'prn', 'PRN', 'aux', 'AUX',
    ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
    ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
  ]);
  const SKIP = new Set(['node_modules', '.git', '.venv', '.bun', 'dist', 'build']);
  const purge = (dir: string, depth: number): number => {
    if (depth > 8) return 0;
    let entries: import('node:fs').Dirent[];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
    let removed = 0;
    for (const entry of entries) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) removed += purge(p, depth + 1);
        continue;
      }
      if (!DEVICE_NAMES.has(entry.name)) continue;
      // Forward-slash path: Git Bash's rm mis-handles backslash forms. Shell-free argument
      // passing; trust the exit status (fs.existsSync is unreliable for device-name paths).
      const rm = spawnSync('bash', ['-c', 'rm -f -- "$1"', 'rm', p.split('\\').join('/')], { encoding: 'utf-8' });
      let purged = rm.status === 0;
      if (!purged && process.platform === 'win32') {
        // Windows fallback (T-20260910-031): bash (Git Bash) is unavailable or failed.
        // The extended-length prefix (\\?\C:\...) bypasses Win32 reserved-device-name
        // resolution, letting fs unlink `nul`/`con`/`aux` artifacts that Node otherwise
        // cannot address (CLAUDE.md §1 Windows safeguard).
        try {
          rmSync('\\\\?\\' + resolve(p), { force: true });
          purged = true;
        } catch { /* reported below */ }
      }
      if (purged) {
        console.log(`  🗑️  Purged device-name artifact from scaffold: ${p}`);
        removed++;
      } else {
        console.warn(`  ⚠️  Could not purge device-name artifact: ${p}`);
      }
    }
    return removed;
  };
  purge(projectDir, 1);
}

// ── 2.6a. Create deliverables/ subdirectories (co-consult) ──────────────────────
if (variant === 'co-consult') {
  const delRoot = join(projectDir, 'deliverables');
  const delDirs = [
    { name: 'reports', desc: 'Final deliverables, client-ready reports' },
    { name: 'drafts', desc: 'Work-in-progress documents and drafts' },
    { name: 'research', desc: 'Research notes, source materials, data' },
    { name: 'presentations', desc: 'Client presentation decks' },
  ];
  for (const d of delDirs) {
    const dir = join(delRoot, d.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'README.md'), [
      `# deliverables/${d.name}/`,
      '',
      d.desc + '.',
      '',
      '## Output Destination',
      '',
      'See Output Destination Mapping in `docs/co-consult.context.md` for per-agent paths and naming conventions.',
      '',
    ].join('\n'));
  }
  console.log('  ✅ deliverables/{reports,drafts,research,presentations}/ created');
}

// ── 2.5. Strip L1-B metadata from agents/pm.md ────────────────────────────────
// Logic extracted verbatim to scripts/helpers/resolve-pm-stub.ts (v1.25.0) — shared
// with the adopt-project settling pass. Behavior unchanged.
const projectDate = new Date().toISOString().slice(0, 10);
const pmMd = join(projectDir, 'agents', 'pm.md');
if (existsSync(pmMd)) {
  stripL1BMetadata(pmMd, projectDate);
  console.log('  ✅ agents/pm.md: stripped L1-B metadata (@resolved-from, formal_name, variant); regenerated lifecycle with project-local dates');
}

// ── 2.6b. Remove template-only docs/ subdirs (variant overlay may re-add; removed here after overlay)
for (const d of L1_ONLY_DIRS) { // docs/specs stays (ADR-0074) — not in L1_ONLY_DIRS
  const dp = join(projectDir, d);
  if (existsSync(dp)) { rmSync(dp, { recursive: true }); console.log(`  🗑️  Removed template-only dir: ${d}`); }
}

// ── 2.7. Apply platform profile ───────────────────────────────────────────────
if (platform === 'claude') { const f = join(projectDir, 'GEMINI.md'); if (existsSync(f)) rmSync(f); }
if (platform === 'antigravity') { const f = join(projectDir, 'CLAUDE.md'); if (existsSync(f)) rmSync(f); }
// ADR-0077 §10: `codex` is a codex-primary profile — keeps CODEX.md + .codex/ and drops the
// legacy twins. `all` keeps every platform's files, including CODEX.md/.codex/. Single-platform
// legacy profiles (`claude`/`antigravity`) are codex-opt-out: the twin and platform dir are
// template overlay, removed here unless explicitly opted in.
if (platform !== 'codex' && platform !== 'all') {
  for (const f of [join(projectDir, 'CODEX.md'), join(projectDir, '.codex')]) {
    if (existsSync(f)) rmSync(f, { recursive: true });
  }
}
// ADR-0088: `hermes` is a hermes-primary profile — Hermes reads AGENTS.md natively, so the
// legacy instruction twins are dropped (codex-primary analogy). `.hermes/` is kept by `hermes`
// and `all`; every other profile is hermes-opt-out (platform dir = template overlay).
if (platform === 'hermes') {
  for (const f of [join(projectDir, 'CLAUDE.md'), join(projectDir, 'GEMINI.md')]) {
    if (existsSync(f)) rmSync(f);
  }
}
if (platform !== 'hermes' && platform !== 'all') {
  const h = join(projectDir, '.hermes');
  if (existsSync(h)) rmSync(h, { recursive: true });
}

// Remove .cmd files
for (const f of walkFiles(projectDir)) {
  if (f.endsWith('.cmd')) rmSync(f);
}

// ── 3.6. Agent Override Merge (VARIANT-SECTION substitution) ──────────────────
if (existsSync(variantJsonPath)) {
  const agentOverrideMerge = join(workspaceRoot, 'scripts', 'lib', 'agent-override-merge.ts');
  const mergeResult = spawnSync(process.execPath, [agentOverrideMerge, commonDir, templatesDir, projectDir], {
    encoding: 'utf8',
    stdio: 'inherit',
  });
  // M9 (2026-09-15 project review): unchecked helper spawns shipped broken
  // scaffolds with a success banner. Every helper below fails loud now.
  if (mergeResult.status !== 0) {
    console.error(`❌ Helper failed: agent-override-merge (exit ${mergeResult.status})`);
    if (import.meta.main) process.exit(1);
  }
}

// ── 4. Create ACTIVE.md if country was selected ──────────────────────────────────
if (selectedCountry && countryConfig?.profiles_dir) {
  const countriesDir = join(projectDir, countryConfig.profiles_dir);
  if (existsSync(countriesDir)) {
    const activePath = join(countriesDir, 'ACTIVE.md');
    let countryName = selectedCountry;
    const profilePath = join(countriesDir, `${selectedCountry}.md`);
    if (existsSync(profilePath)) {
      try {
        const profileContent = readFileSync(profilePath, 'utf-8');
        const nameMatch = profileContent.match(/^name:\s*(.+)$/m);
        if (nameMatch) countryName = nameMatch[1].trim();
      } catch (e) {
        // Profile read error - use code
      }
    }
    const activeContent = `# Active Country Profile

Active jurisdiction: ${selectedCountry} — ${countryName}. See ${countryConfig.profiles_dir}/${selectedCountry}.md. Set at scaffold time; change by editing this file.
`;
    writeFileSync(activePath, activeContent);
    console.log(`  📄 Created ${countryConfig.profiles_dir}/ACTIVE.md (points to ${selectedCountry})`);
  } else {
    // T-20260921-014 (review M-16): the profiles directory was silently missing —
    // the scaffold produced no jurisdiction artifact at all. Warn loud instead.
    console.warn(`  ⚠️  Country profiles directory '${countryConfig.profiles_dir}/' not found in the scaffolded tree — ACTIVE.md was NOT created`);
  }
}

// ── 5. Remove .gitkeep placeholders ───────────────────────────────────────────
for (const f of walkFiles(projectDir)) {
  if (basename(f) === '.gitkeep') rmSync(f);
}

// ── 5. Substitute placeholders ────────────────────────────────────────────────
const substitutePlaceholders = join(workspaceRoot, 'scripts', 'helpers', 'substitute-placeholders.ts');
if (existsSync(substitutePlaceholders)) {
  // Get country display name for {{COUNTRY}} placeholder
  let countryDisplayName = '';
  if (selectedCountry) {
    // T-20260921-014 (review M-16): honor the variant's profiles_dir instead of
    // hardcoding docs/countries — a variant with a custom profiles_dir otherwise
    // got a fallback-to-code display name in every {{COUNTRY}} marker.
    const profilesDir = countryConfig?.profiles_dir ?? join('docs', 'countries');
    const profilePath = join(projectDir, profilesDir, `${selectedCountry}.md`);
    if (existsSync(profilePath)) {
      try {
        const profileContent = readFileSync(profilePath, 'utf-8');
        const nameMatch = profileContent.match(/^name:\s*(.+)$/m);
        if (nameMatch) countryDisplayName = nameMatch[1].trim();
      } catch (e) {
        // Profile read error - fall back to code
        countryDisplayName = selectedCountry;
      }
    } else {
      countryDisplayName = selectedCountry;
    }
  }

  const substituteResult = spawnSync(process.execPath, [substitutePlaceholders, projectDir, basename(projectName), 'A new project', '', variant, countryDisplayName], { stdio: 'inherit' });
  if (substituteResult.status !== 0) {
    console.error(`❌ Helper failed: substitute-placeholders (exit ${substituteResult.status}) — live {{markers}} would ship in the project`);
    if (import.meta.main) process.exit(1);
  }
} else {
  console.log('⚠️  Placeholder substitution skipped (helper missing)');
}

// ── 5.2. Render docs/project.md (project identity seed — spec 2026-09-24-scaffold-identity-overview-design) ──
// The SSOT is templates/common/docs/project.template.md: copied into the project
// tree by the common copy, rendered here into docs/project.md, then removed from
// the delivered tree (also listed in NEW_PROJECT_CLEANUP_FILES, so upgrades never
// re-deliver the raw copy — upgrade-policy TEMPLATE_ONLY). The render reuses the
// shared applySubstitutions() token map (behavior identical to the §5 sweep), then
// fills the --description/--type identity fields; absent flags keep the template's
// TODO(project-overview) fallback lines, which match the audit.ts placeholder
// regex family so an undescribed project stays WARN-visible.
{
  const identityTemplatePath = join(commonDir, 'docs', 'project.template.md');
  const deliveredTemplateCopy = join(projectDir, 'docs', 'project.template.md');
  const identityOutPath = join(projectDir, 'docs', 'project.md');
  if (existsSync(identityTemplatePath)) {
    try {
      let identity = applySubstitutions(readFileSync(identityTemplatePath, 'utf-8'), {
        projectName: basename(projectName),
        description: projectDescription || 'A new project',
        characteristics: '',
        variantName: variant,
        countryDisplayName: '',
      });
      if (projectDescription) {
        identity = identity.replace(
          /^- \*\*Description\*\*: TODO\(project-overview\): \[One-sentence description[^\]]*\]$/m,
          () => `- **Description**: ${projectDescription}`,
        );
      }
      if (projectType) {
        identity = identity.replace(
          /^- \*\*Type\*\*: TODO\(project-overview\): \[TBD\][^\n]*$/m,
          () => `- **Type**: ${projectType}`,
        );
      }
      writeFileSync(identityOutPath, identity, 'utf-8');
      console.log('  ✅ docs/project.md rendered from the identity seed template');
    } catch (err) {
      console.error(`❌ Failed to render docs/project.md from the identity seed: ${(err as Error).message}`);
      if (import.meta.main) process.exit(1);
    }
    // The raw .template.md copy never ships: rendered output replaces it.
    if (existsSync(deliveredTemplateCopy)) {
      rmSync(deliveredTemplateCopy);
      console.log('  🗑️  Removed raw template copy: docs/project.template.md');
    }
  } else if ((projectDescription || projectType) && existsSync(join(projectDir, 'docs'))) {
    console.warn('  ⚠️  docs/project.template.md not found in the template source — docs/project.md was NOT rendered (old template version?)');
  }
}

// ── 5.5b. Update lifecycle.statusSince in variant.json ────────────────────────
// (projectDate is declared at §2.5, which also needs it)
const projVariantJson = join(projectDir, 'variant.json');
if (existsSync(projVariantJson)) {
  const helper = join(workspaceRoot, 'scripts', 'helpers', 'update-variant-lifecycle.ts');
  if (existsSync(helper)) {
    const r = spawnSync(process.execPath, [helper, projectDir, projectDate, variant], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error(`❌ Helper failed: update-variant-lifecycle (exit ${r.status})`);
      if (import.meta.main) process.exit(1);
    }
  }
}

// ── 5.5c. Write scripts-snapshot.json ─────────────────────────────────────────
const scriptsMd = join(workspaceRoot, 'scripts', 'SCRIPTS.md');
if (existsSync(scriptsMd)) {
  const helper = join(workspaceRoot, 'scripts', 'helpers', 'write-scripts-snapshot.ts');
  if (existsSync(helper)) {
    const r = spawnSync(process.execPath, [helper, projectDir, projectDate, variant, 'templates/common/scripts'], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error(`❌ Helper failed: write-scripts-snapshot (exit ${r.status})`);
      if (import.meta.main) process.exit(1);
    }
  }
}

// ── 5.5. Record template provenance ───────────────────────────────────────────
// templateVersion was resolved pre-flight (T-20260916-002): an explicit
// --version value wins as-is, otherwise the templates/VERSION SSOT read
// fail-loud via helpers/template-version.ts resolveProvenanceVersion() (M11
// parity with create-l3-scaffold.ts). The previous silent "unknown" fallback
// is removed — the downstream output formats are unchanged.
const variantContextMd = join(projectDir, 'docs', `${variant}.context.md`);

// Regenerate context.md from canonical template (SSOT: templates/common/docs/variant.context.template.md)
// H6 (2026-09-15 project review): read the canonical template from commonDir —
// the tag's extracted copy when --version <tag> is used.
const contextTemplatePath = join(commonDir, 'docs', 'variant.context.template.md');
if (existsSync(contextTemplatePath) && !existsSync(variantContextMd)) {
  applyContextTemplate(contextTemplatePath, variantContextMd, {
    variantName: variant,
    version: templateVersion,
    pmRoleDescription: DEFAULT_PM_ROLE_DESCRIPTIONS[variant] ?? 'Workflow management, dispatch, quality gates',
  });
  console.log(`  ✅ context.md generated from canonical template`);
}

if (existsSync(variantContextMd)) {
  const ctx = readFileSync(variantContextMd, 'utf8');
  if (!ctx.includes('Template-Version:')) {
    const jurisdictionLine = selectedCountry ? `- **Target-Jurisdiction**: ${selectedCountry}\n` : `- **Target-Jurisdiction**: region-neutral\n`;
    appendFileSync(variantContextMd, `\n## Template Provenance\n\n- **Template-Version**: ${templateVersion}\n- **Template-Variant**: ${variant}\n${jurisdictionLine}`);
  }
}

// ── 5.6. Write .claude/template-version.txt ───────────────────────────────────
const claudeDir = join(projectDir, '.claude');
mkdirSync(claudeDir, { recursive: true });
const countryLine = selectedCountry ? `country=${selectedCountry}\n` : `country=none\n`;
writeFileSync(
  join(claudeDir, 'template-version.txt'),
  `variant=${variant}\nversion=${templateVersion}\nplatform=${platform}\n${countryLine}created=${new Date().toISOString()}\n`
);

// ── 5.6b. Inject AGENTS.md Skills into docs/context.md ───────────────────────
const injectSkills = join(workspaceRoot, 'scripts', 'helpers', 'inject-skills.ts');
if (existsSync(injectSkills)) {
  const r = spawnSync(process.execPath, [injectSkills, projectDir], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`❌ Helper failed: inject-skills (exit ${r.status})`);
    if (import.meta.main) process.exit(1);
  }
}

// ── 5.7. Protect context.md from accidental overwrites ────────────────────────
const gitattributes = join(projectDir, '.gitattributes');
if (existsSync(gitattributes)) {
  const ga = readFileSync(gitattributes, 'utf8');
  if (!ga.includes('docs/context.md')) {
    appendFileSync(gitattributes, '\ndocs/context.md merge=ours\n');
  }
} else {
  writeFileSync(gitattributes, 'docs/context.md merge=ours\n');
}

// ── 5a. Refresh README hashes (v1.24.0, T-20260921-002) ──────────────────────
// Placeholder substitution rewrites README.md after the template recorded its
// content_hash, and README_ko.md's translated_from_hash goes stale with it —
// the project's very first /sync then fails verify-readme-sync twice. Refresh
// both hashes now, from the FINAL substituted bodies.
{
  const strip = (t: string): string => t.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  const bodyHash = (t: string): string => createHash('sha256').update(strip(t), 'utf-8').digest('hex');
  const enPath = join(projectDir, 'README.md');
  const koPath = join(projectDir, 'README_ko.md');
  if (existsSync(enPath)) {
    const en = readFileSync(enPath, 'utf-8');
    const h = bodyHash(en);
    const updated = /^content_hash:/m.test(en)
      ? en.replace(/^content_hash:\s*.+$/m, `content_hash: ${h}`)
      : en.replace(/^(---\r?\n[\s\S]*?)(---)/m, `$1content_hash: ${h}\n$2`);
    writeFileSync(enPath, updated, 'utf-8');
    if (existsSync(koPath)) {
      const ko = readFileSync(koPath, 'utf-8');
      const koUpdated = /^translated_from_hash:/m.test(ko)
        ? ko.replace(/^translated_from_hash:\s*.+$/m, `translated_from_hash: ${h}`)
        : ko.replace(/^(---\r?\n[\s\S]*?)(---)/m, `$1translated_from_hash: ${h}\n$2`);
      writeFileSync(koPath, koUpdated, 'utf-8');
    }
    console.log('  ✅ README content hashes refreshed (EN + KO)');
  }
}

// ── 6. Cleanup Strictly L0 Files ──────────────────────────────────────────────
const layerFilter = join(workspaceRoot, 'scripts', 'helpers', 'layer-filter.ts');
let l0Scripts: string[] = [];
if (existsSync(layerFilter)) {
  const result = spawnSync(process.execPath, [layerFilter, '--scripts-l0-only', '--format=list'], { encoding: 'utf8' });
  if (result.status === 0) {
    l0Scripts = result.stdout.split('\n').filter(Boolean);
  }
} else {
  l0Scripts = ['validate-templates.ts', 'create-l3-scaffold.ts', 'l3-to-variant-pipeline.ts', 'fix-script-versions.ts'];
}
for (const s of l0Scripts) {
  const fp = join(projectDir, 'scripts', s);
  if (existsSync(fp)) rmSync(fp, { recursive: true, force: true });
}

// Remove workspace-only artifacts (single source: helpers/scaffold-markers.ts — T-20260915-003)
const cleanupFiles = [...NEW_PROJECT_CLEANUP_FILES];
for (const f of cleanupFiles) {
  const fp = join(projectDir, f);
  if (existsSync(fp)) rmSync(fp);
}

// Safety-net: remove any workspace-only skills that bypassed propagation filtering
// (l2_propagate: false). Primary enforcement is in propagate-to-templates.ts via
// layer-filter.ts — this block catches manual additions to templates/common/skills/.
// Also removes legacy hardcoded L0-only skills (scope: workspace).
// (single source: helpers/scaffold-markers.ts — T-20260915-003)
const LEGACY_L0_SKILLS = NEW_PROJECT_LEGACY_L0_SKILLS;
for (const skill of LEGACY_L0_SKILLS) {
  for (const base of PLATFORM_SKILL_BASES) {
    const dp = join(projectDir, base, skill);
    if (existsSync(dp)) rmSync(dp, { recursive: true });
  }
}
// T-20260910-023: the sweep runs over all five skill locations, not just the
// SSOT mirror — a workspace-only skill that leaked into the L1 platform dirs
// (`.claude/skills/`, `.gemini/skills/`, `.agents/skills/`, `.codex/skills/`)
// would otherwise survive into the scaffolded project and register with the
// platform harness. (.agents/skills was missing until the 2026-09-21 review C-1.)
const projectSkillBases = PLATFORM_SKILL_BASES;
for (const base of projectSkillBases) {
  const baseDir = join(projectDir, base);
  if (!existsSync(baseDir)) continue;
  for (const skillName of readdirSync(baseDir)) {
    const skillMd = join(baseDir, skillName, 'SKILL.md');
    if (existsSync(skillMd)) {
      const content = readFileSync(skillMd, 'utf-8');
      if (/^l2_propagate:\s*false\b/m.test(content)) {
        rmSync(join(baseDir, skillName), { recursive: true });
        console.log(`  🗑️  Excluded L1-only skill (${base}): ${skillName}`);
      }
    }
  }
}

// ── 6.4. Reconcile skills/SKILLS.md against the delivered skill tree ─────────
// T-20260924-008 (spec 2026-09-24-skills-registry-overlay-reconcile): the last
// mutation of the delivered skills/ tree happened above — the k-* region prune
// (§2.4), the legacy-L0 removal, and the l2_propagate:false sweep. This is the
// first point where the delivered tree is final, and it sits upstream of the
// consumers that read the registry or the tree (skill-graph generation §7.7,
// VERSION_MANIFEST skills↔manifest parity §7.8, and the post-scaffold audit,
// whose skill-lifecycle-audit enforces a registry↔tree bijection in BOTH
// directions). The seed is the common registry (the §2 overlay skip above
// protected it); this step then makes the delivered registry a pure function
// of the delivered tree, in five passes:
//   1. FOLD — move the seed's `### Variant-Exclusive Skills` rows into the
//      `### Workspace Skills` table (the audit's parser reads ONLY the latter
//      when the heading exists; rows left behind reported `Missing registry
//      row` on 7/13 variants during the fleet E2E) and drop the emptied
//      template-side section.
//   2. PRUNE — drop rows for undelivered skills (region-pruned k-*, swept
//      L1-only skills, workspace-root-only seeds).
//   3. RECONCILE — update version/last_reviewed from the DELIVERED SKILL.md
//      frontmatter (delivered frontmatter wins the shadow case — it is exactly
//      what the audit compares) and append rows for variant-exclusive skills
//      (e.g. co-design's service-design). Shared with the upgrade path.
//   4. ALIGN — rewrite surviving rows' status/owner cells from the delivered
//      frontmatter (the design §10 remedy, applied scaffold-side only: the
//      shared reconcileSkillRegistry stays frozen so upgrade output is
//      byte-identical — AC8).
//   5. WRITE — only when the content changed.
// Idempotent (a second run changes nothing) and non-fatal (INFO skip when the
// registry is absent) — the post-scaffold audit is the gate.
{
  const registryPath = join(projectDir, 'skills', 'SKILLS.md');
  const skillsDir = join(projectDir, 'skills');
  if (!existsSync(registryPath)) {
    console.log('  ℹ️  skills/SKILLS.md not found — skipping registry reconcile');
  } else {
    const before = readFileSync(registryPath, 'utf-8');

    // Pass 1 — fold variant-exclusive rows into the audit-visible section.
    const folded = foldVariantExclusiveRowsIntoWorkspaceSection(before);
    if (folded.moved > 0) {
      console.log(`  📥 FOLDED ${folded.moved} variant-exclusive row(s) into the Workspace section`);
    }

    // Pass 2 — prune to the delivered tree. Keep-set is DIR-based (dirs
    // containing a SKILL.md), not collect-based: a delivered SKILL.md whose
    // frontmatter lacks a parseable version keeps its seed row, and the
    // reconcile below skips it — matching the upgrade path's
    // `if (!fm.version) continue` delivery semantics (D3).
    const keepNames = new Set<string>();
    if (existsSync(skillsDir)) {
      for (const entry of readdirSync(skillsDir)) {
        if (existsSync(join(skillsDir, entry, 'SKILL.md'))) keepNames.add(entry);
      }
    }
    const { content: prunedContent, pruned } = pruneSkillRegistryRows(folded.content, keepNames);

    // Passes 3+4 — reconcile from the delivered frontmatter, then align
    // status/owner (the scaffold-only stronger rule).
    const delivered = collectDeliveredSkills(skillsDir);
    const { content: reconciledContent, updated, added } = reconcileSkillRegistry(prunedContent, delivered);
    const { content: finalContent, aligned } = alignSkillRegistryRowsWithFrontmatter(reconciledContent, delivered);

    for (const skill of pruned) {
      console.log(`  ✂️  PRUNED registry row: ${skill} (skill not delivered)`);
    }
    for (const skill of updated) {
      console.log(`  🔄 UPDATED registry row: ${skill} (version/last_reviewed from delivered SKILL.md)`);
    }
    for (const skill of added) {
      console.log(`  ➕ ADDED registry row: ${skill} (newly delivered skill)`);
    }
    for (const skill of aligned) {
      console.log(`  🔧 ALIGNED registry row: ${skill} (status/owner from delivered SKILL.md)`);
    }
    if (finalContent !== before) {
      writeFileSync(registryPath, finalContent, 'utf-8');
    }
    console.log(
      `  ✅ skills/SKILLS.md reconciled against delivered tree ` +
        `(${delivered.length} skills: ${folded.moved} folded, ${pruned.length} pruned, ` +
        `${updated.length} updated, ${added.length} added, ${aligned.length} aligned)`,
    );
  }
}

// Safety-net: remove any workspace-only scripts that bypassed propagation filtering
// (@l2-propagate: false header). Primary enforcement is in propagate-to-templates.ts
// via layer-filter.ts — this block catches manual additions to templates/common/scripts/.
const projectScriptsDir = join(projectDir, 'scripts');
if (existsSync(projectScriptsDir)) {
  for (const scriptName of readdirSync(projectScriptsDir)) {
    if (!scriptName.endsWith('.ts')) continue;
    const scriptPath = join(projectScriptsDir, scriptName);
    try {
      const content = readFileSync(scriptPath, 'utf-8');
      if (/^\/\/ @l2-propagate:\s*false\b/m.test(content)) {
        rmSync(scriptPath);
        console.log(`  🗑️  Excluded L1-only script: ${scriptName}`);
      }
    } catch (err) {
      console.error(`[new-project] Error: ${err}`);
    }
  }
}

// ── 6.5 Filter SCRIPTS.md for L2 ─────────────────────────────────────────────
// The bulk copy from templates/common/ brings the full L0+L1 registry into the
// project.  After L0-only .ts files are removed above, SCRIPTS.md still contains
// their rows — causing "Ghost entry" errors in verify-scripts.ts.  Strip those
// rows and rewrite the header to reflect the L2 snapshot context.
const projectScriptsMd = join(projectScriptsDir, 'SCRIPTS.md');
if (l0Scripts.length > 0 && existsSync(projectScriptsMd)) {
  const mdContent = readFileSync(projectScriptsMd, 'utf-8');
  const l0Set = new Set(l0Scripts.map(s => s.replace(/`/g, '')));

  const lines = mdContent.split('\n');
  const out: string[] = [];
  let inRegistry = false;
  let headerParsed = false;
  let removed = 0;

  for (const line of lines) {
    // Track registry boundaries (same delimiters verify-scripts.ts uses)
    if (/^## Registry/.test(line)) {
      inRegistry = true;
      headerParsed = false;
      out.push(line);
      continue;
    }
    if (inRegistry && /^## /.test(line)) {
      inRegistry = false;
      out.push(line);
      continue;
    }

    if (inRegistry) {
      const trimmed = line.trim();
      // Skip separator row
      if (trimmed.startsWith('|-')) { out.push(line); continue; }
      if (!trimmed.startsWith('|')) { out.push(line); continue; }

      // Extract script name (first column, between pipes)
      const cols = trimmed.split('|').slice(1, -1).map(c => c.trim());
      if (cols.length < 6) { out.push(line); continue; }

      if (!headerParsed) { headerParsed = true; out.push(line); continue; }

      const scriptName = cols[0].replace(/`/g, '');
      if (l0Set.has(scriptName)) {
        removed++;
        continue; // drop L0-only row
      }
    }

    out.push(line);
  }

  // Rewrite header to reflect L2 snapshot context
  const rewritten = out.join('\n')
    .replace(
      '> This file is the Single Source of Truth (Tier 1 SSOT) for all scripts in `scripts/` (workspace root).\n' +
      '> Template `templates/common/scripts/` (Tier 2) is a snapshot published from here via `bun run propagate:apply`.\n' +
      '> Project `scripts/` (Tier 3) is a snapshot created from Tier 2 at `new-project` time.',
      '> This file is a **project-level snapshot** (Tier 3) of the scripts that were scaffolded\n' +
      '> from the common template at `new-project` time. L0-only entries have been stripped.\n' +
      '> For the authoritative registry, see the workspace root `scripts/SCRIPTS.md`.'
    )
    .replace(
      '*SCRIPTS.md maintained by: workspace maintainer (L0 SSOT)*',
      '*SCRIPTS.md — project snapshot (auto-generated at scaffold time)*'
    );

  writeFileSync(projectScriptsMd, rewritten, 'utf-8');
  console.log(`  📝 Filtered SCRIPTS.md: removed ${removed} L0-only registry entries`);
}

// ── 7. Initialize git ──────────────────────────────────────────────────────────
process.chdir(projectDir);
// v1.24.0 (T-20260921-003): git init without cwd reinitialized the PARENT
// workspace repo (git walks up to an existing work tree) — the scaffold
// inherited the workspace origin and its first /sync opened PRs there.
spawnSync('git', ['init'], { stdio: 'inherit', cwd: projectDir });
spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });

// Set git identity if missing
const emailCheck = spawnSync('git', ['config', 'user.email'], { encoding: 'utf8' });
if (!emailCheck.stdout.trim()) {
  spawnSync('git', ['config', 'user.email', 'scaffold-bot@local']);
  spawnSync('git', ['config', 'user.name', 'Scaffold Bot']);
}

// ── 7.5. Install dependencies ──────────────────────────────────────────────
// Self-contained projects install all dependencies at root level.
// Scripts resolve modules from root node_modules/ — no separate scripts/ install needed.
function bunInstall(dir: string): void {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) {
    console.log('  ⚠️  package.json missing — skipping bun install');
    return;
  }
  try {
    // Verify bun is available (ENOENT guard for environments without bun)
    const bunCheck = spawnSync('bun', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
    if (bunCheck.error || bunCheck.status !== 0) {
      console.log('  ⚠️  bun not available — skipping dependency installation');
      console.log(`       Manual retry: cd "${dir}" && bun install`);
      return;
    }
    console.log('  📦 Running bun install …');
    const result = spawnSync('bun', ['install'], { stdio: 'inherit', cwd: dir });
    if (result.status !== 0) {
      console.log('  ⚠️  bun install failed (non-fatal — scripts may fail)');
      console.log(`       Manual retry: cd "${dir}" && bun install`);
    } else {
      console.log('  ✅ bun install complete');
    }
  } catch (err) {
    // Catch ENOENT (bun not installed) or permission errors
    console.log(`  ⚠️  bun not available (${(err as Error).message}) — skipping install`);
    console.log(`       Manual retry: cd "${dir}" && bun install`);
  }
}
bunInstall(projectDir);

// ── 7.6. Scaffold-time skill graph generation (ADR-0060 Amendment 3, 2026-08-29) ──
// Generates the project's own docs/skill-graph.json immediately at scaffold time,
// instead of waiting for the first /sync (where dev-sync.ts step 4.65 would
// otherwise generate it for the first time). Runs the already-propagated
// generate-skill-graph.ts INSIDE the new project directory (cwd = projectDir) —
// same plain, non-scope invocation dev-sync.ts's step 4.65 already uses — so the
// generator's own run-context auto-detection (no templates/ dir present) tags
// every discovered skill/agent L3, matching a project-local run. This does NOT
// copy any upstream (L0/template) graph — "projects never receive a copy of any
// upstream graph" (Amendment 2) — it derives fresh from whatever the variant
// overlay just placed in projectDir/skills, projectDir/agents.
// Non-fatal: a missing bun, a missing generator script, or any generation error
// degrades gracefully to the existing lazy behavior (first /sync still runs
// step 4.65 regardless) rather than blocking project creation.
console.log('\nGenerating initial skill graph…');
try {
  const projectGeneratorScript = join(projectDir, 'scripts', 'generate-skill-graph.ts');
  if (!existsSync(projectGeneratorScript)) {
    console.log('  ⚠️  scripts/generate-skill-graph.ts not found in scaffolded project — skipping (will run on first /sync)');
  } else {
    const bunCheck = spawnSync('bun', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
    if (bunCheck.error || bunCheck.status !== 0) {
      console.log('  ⚠️  bun not available — skipping initial skill graph generation (will run on first /sync)');
    } else {
      const genResult = spawnSync('bun', [projectGeneratorScript], { stdio: 'inherit', cwd: projectDir });
      if (genResult.status === 0) {
        console.log('  ✅ Initial docs/skill-graph.json generated (L3)');
      } else {
        console.log('  ⚠️  Skill graph generation failed (non-fatal — will run on first /sync)');
      }
    }
  }
} catch (err) {
  console.log(`  ⚠️  Skill graph generation errored (non-fatal): ${(err as Error).message}`);
}

// ── 7.7. Graft index build (ADR-0076) ─────────────────────────────────────────
// The template ships the full graft surface (MCP entries, skill, hooks); give the
// fresh project its repo graph right away. Non-fatal: bunx/graft may be unavailable
// (offline), and every graft tool self-refreshes the graph before answering, so a
// skipped build self-heals on first use.
console.log('\nBuilding graft repo index…');
// graft-first, bunx fallback (spec 2026-09-20-graft-scaffold-resilience): bunx
// installs the package on first run, and a native postinstall failure (observed
// with tree-sitter-kotlin on Windows) leaves a partial temp cache that breaks
// every later bunx call. The global binary skips that install path entirely.
const graftDirect = spawnSync('graft', ['build'], { stdio: 'inherit', cwd: projectDir });
if (graftDirect.status === 0) {
  console.log('  ✅ graft/ index created');
} else {
  console.log('  ⚠️  global graft unavailable or failed — falling back to bunx');
  try {
    const graftResult = spawnSync('bunx', ['@nanonets/graft', 'build'], { stdio: 'inherit', cwd: projectDir });
    if (graftResult.status === 0) {
      console.log('  ✅ graft/ index created (via bunx)');
    } else {
      console.log('  ⚠️  graft build failed (non-fatal) — run `graft build` or `bunx @nanonets/graft build` in the project later.');
    }
  } catch (err) {
    console.log(`  ⚠️  graft build skipped (non-fatal): ${(err as Error).message}`);
  }
}

// ── 7.8. Version manifest generation (T-20260916-010) ─────────────────────────
// Variant templates no longer ship a stub docs/VERSION_MANIFEST.md (the stub
// class is retired — validate-templates `variant-version-manifest` arm). The
// project's steady-state manifest is the FULL generated one, so generate it
// right after content delivery and BEFORE the post-scaffold audit, by running
// the project's own generator (cwd = projectDir — the generator is
// cwd-relative and must run under bun). Non-fatal warn-and-continue, mirroring
// the §7.7 graft build semantics: a missing bun or a generation failure
// degrades gracefully, and the audit immediately after enforces the
// VERSION_MANIFEST gates (skills↔manifest parity + --check drift), so a
// skipped generation can never ship silently.
console.log('\nGenerating version manifest…');
try {
  const decision = decideManifestGeneration(
    existsSync(join(projectDir, VERSION_MANIFEST_GENERATOR_RELPATH)),
    (() => {
      const bunCheck = spawnSync('bun', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
      return !bunCheck.error && bunCheck.status === 0;
    })(),
  );
  switch (decision.action) {
    case 'generate': {
      const genResult = spawnSync(
        'bun',
        [join(projectDir, VERSION_MANIFEST_GENERATOR_RELPATH)],
        { stdio: 'inherit', cwd: projectDir },
      );
      if (genResult.status === 0) {
        console.log(`  ✅ ${VERSION_MANIFEST_RELPATH} generated (full project manifest)`);
      } else {
        console.log(`  ⚠️  Version manifest generation failed (non-fatal) — run \`bun ${VERSION_MANIFEST_GENERATOR_RELPATH}\` in the project later.`);
      }
      break;
    }
    case 'skip-missing-generator':
      console.log(`  ⚠️  ${VERSION_MANIFEST_GENERATOR_RELPATH} not found in scaffolded project — skipping (audit will flag the missing manifest)`);
      break;
    case 'skip-no-bun':
      console.log('  ⚠️  bun not available — skipping version manifest generation');
      break;
  }
} catch (err) {
  console.log(`  ⚠️  Version manifest generation errored (non-fatal): ${(err as Error).message}`);
}

// ── 6.5. Security Bootstrap Verification ──────────────────────────────────────
console.log('\nRunning security bootstrap verification…');
let securityOk = true;

function check(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✅ ${label}`); }
  else { console.log(`  ❌ ${label}`); securityOk = false; }
}

check('.gitleaks.toml present', existsSync(join(projectDir, '.gitleaks.toml')));
check('.githooks/pre-commit present', existsSync(join(projectDir, '.githooks', 'pre-commit')));

const gitattributesContent = existsSync(gitattributes) ? readFileSync(gitattributes, 'utf8') : '';
check('.gitattributes has eol=lf', gitattributesContent.includes('eol=lf'));

const gitignoreContent = existsSync(join(projectDir, '.gitignore')) ? readFileSync(join(projectDir, '.gitignore'), 'utf8') : '';
check('.gitignore excludes .env', gitignoreContent.includes('.env'));

const hooksPathResult = spawnSync('git', ['-C', projectDir, 'config', 'core.hooksPath'], { encoding: 'utf8' });
check('git core.hooksPath configured', hooksPathResult.stdout.includes('.githooks'));

if (!securityOk) {
  console.error('\n❌ Security bootstrap check FAILED. Fix the issues above before using this project.');
  console.error("   Run 'bun scripts/audit.ts' after fixing to verify.");
  if (import.meta.main) {
    process.exit(1);
  }
}
console.log('  ✅ All security bootstrap checks passed');

// ── 8. Post-scaffold audit ────────────────────────────────────────────────────
console.log('\nRunning post-scaffold audit…');
// Run the new project's own audit to validate the scaffold result
const projectAuditScript = join(projectDir, 'scripts', 'audit.ts');
const workspaceAuditScript = join(workspaceRoot, 'scripts', 'audit.ts');
const auditScript = existsSync(projectAuditScript) ? projectAuditScript : workspaceAuditScript;
const auditResult = spawnSync(process.execPath, [auditScript, '--skip-memory'], { stdio: 'inherit', cwd: projectDir });

if (auditResult.status === 0) {
  console.log(`\n✅ Project '${projectName}' scaffolded and verified at: ${projectDir}`);
} else {
  console.log('\n⚠️  Project scaffolded but audit found issues — review above before continuing.');
}

// ── 9. Environment setup ──────────────────────────────────────────────────────
console.log('\nRunning environment setup…');
const setupTs = join(projectDir, 'scripts', 'setup.ts');
const setupSh = join(projectDir, 'scripts', 'setup.sh');
if (existsSync(setupTs)) {
  const result = spawnSync(process.execPath, [setupTs], { stdio: 'inherit', cwd: projectDir });
  if (result.status !== 0) console.log("\n⚠️  Setup encountered an error — run 'bun scripts/setup.ts' manually to retry.");
} else if (existsSync(setupSh)) {
  // Pass relative path to bash to avoid Windows path separator issues
  const result = spawnSync('bash', ['scripts/setup.sh'], { stdio: 'inherit', cwd: projectDir });
  if (result.status !== 0) console.log("\n⚠️  Setup encountered an error — run 'bash scripts/setup.sh' manually to retry.");
}

// ── 10. Final banner ──────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\x1b[36m📂 PROJECT DIRECTORY:\x1b[0m ${projectDir}`);
console.log('');
console.log('\x1b[33m⚠️  Your shell is still at the workspace root.\x1b[0m');
console.log('   Run the following command to move into your new project:');
console.log('');
console.log(`   \x1b[32mcd "${projectDir}"\x1b[0m`);
console.log('');
console.log('   All subsequent work (git, scripts, sessions) must be run');
console.log('   from inside this directory, not the workspace root.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
if (existsSync(join(templatesDir, 'docs', '_examples'))) {
  console.log('Extension templates (ADR, analyst agent, skill, daily log):');
  console.log(`  → ${join(templatesDir, 'docs', '_examples')}/`);
}
