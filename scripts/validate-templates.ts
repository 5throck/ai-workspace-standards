#!/usr/bin/env bun
/**
 * Template Lifecycle Validation Script
 * @version 1.46.1
 *
 * v1.46.1 (2026-09-26, ADR-0090 program closure — design Addendum 3): the
 *         size-budget arm's WARN message and header note record the user
 *         decision that the W4 FAIL promotion is cancelled and the budget
 *         stays a WARN-level visibility metric permanently.
 * v1.46.0 (2026-09-26, ADR-0090 W0): two WARN-stage arms precede the AGENTS.md
 *         thin-dispatcher restructure — `agents-md-size-budget` (every
 *         AGENTS.md ≤15,000 chars at L0/L1/L2; per user decision 2026-09-26
 *         (design Addendum 3) this stays a WARN-level visibility metric — the
 *         W4 FAIL promotion is cancelled) and
 *         `agents-md-pointer-integrity` (markdown references to
 *         docs/governance/*.md, docs/constitution/*.md and the layer's
 *         context.md must resolve on disk; multi-base resolution: workspace
 *         root, templates/common, layer dir). Vacuous until W1 populates
 *         pointers — by design (C: validators precede restructuring).
 * v1.44.0 → v1.45.0 (2026-09-25, registry & platform-policy completeness batch
 *          — spec docs/designs/2026-09-25-registry-policy-completeness-design.md,
 *          W5/R5.6): new VA-08 skill-registry-sync check — one cross-surface
 *          pass over every skill registry table (root Workspace Skills rows,
 *          root Variant-Exclusive catalog, common scaffold seed, curated
 *          variant registries) via collectWorkspaceRegistryFindings
 *          (skills-registry helper v1.2.0), asserting rows match the SKILL.md
 *          frontmatter they document. Wired once in the main flow next to the
 *          mirror-parity checks. Severity: WARN per ADR-0055 soak.
 *          TODO(promotion): flip VA-08 findings to fail when
 *          tickets/governance/T-20260925-007.yaml promotes (not_before 2026-10-09).
 * v1.43.0 → v1.44.0 (2026-09-25, registry & platform-policy completeness batch
 *          — spec docs/designs/2026-09-25-registry-policy-completeness-design.md,
 *          R3): new VA-07 variant-mirror version-sync check (verifier-expansion
 *          §17.1 advisory A1 follow-up) — collectMirrorVersionMismatches (pure,
 *          exported) compares SKILL.md frontmatter versions across a variant's
 *          .claude/.gemini/.agents/.codex mirror skills (present in >= 2
 *          mirrors; missing version is a finding), cross-checks curated
 *          skills/SKILLS.md registry rows where they exist (mirror-only
 *          adapted copies skipped), honors the VA-03 mirror-parity: skip /
 *          gemini-parity: skip vocabulary, and is wired beside VA-03 in the
 *          stable-variant loop. Severity: WARN soak per ADR-0055 — promotion
 *          ticket T-20260925-006 (not_before 2026-10-09, separate from
 *          T-20260925-002 whose enumerated scope stays intact). Day-one green:
 *          0 mismatches across the 13-variant fleet.
 * v1.42.0 → v1.43.0 (2026-09-25, inventory decisions batch — spec
 *          docs/designs/2026-09-25-inventory-decisions-batch-design.md,
 *          T-20260924-002 R1.3-R1.5): C-CM-04 platform-skills sweep consumes
 *          the contract's new common_platform_skill_exclusions section (five
 *          documented exclusions: create-variant/promote-variant/simulate-
 *          pipeline L0-only, graft claude-only, sound-synth variant-scoped);
 *          a stale exclusion (dir gone from every mirror tree) FAILs;
 *          PLATFORM_SOURCE_KEYS gains codex_source (C-CM-03b now verifies
 *          .codex mirror-copy version parity for all 22 entries); the
 *          exemptSkills build uses variant_scoped_skills VALUES (skill names)
 *          instead of keys (variant names), aligning with C-CM-05 semantics.
 *          Pure helpers exported for unit test: collectSchemaExemptSkills,
 *          unlistedPlatformSkillDirs, stalePlatformSkillExclusions.
 * v1.41.0 → v1.42.0 (2026-09-25, variant hygiene batch — spec
 *          docs/designs/2026-09-25-variant-hygiene-batch-design.md, R4):
 *          new `variant-agent-references` check (T-20260924-007c) — every
 *          agent reference in templates/co-<v>/AGENTS.md and the variant
 *          scripts tree (agents/<name>.md path refs +
 *          backtick `<name>` agent mentions) must resolve at
 *          templates/<v>/agents/, templates/common/agents/, or the workspace
 *          root agents/. Catches the stack setup phantom class (10 variant
 *          AGENTS.md copies + co-abap setup.ts shipped guidance naming an
 *          agent the variant never had). Pure cores exported for unit test
 *          (T-004 convention): classifyAgentReference (resolution decision,
 *          explicit AGENT_REFERENCE_EXEMPT escape hatch) +
 *          extractAgentReferenceCandidates (path/backtick extraction with
 *          line numbers). Wired next to WS-05a in the per-variant loop.
 *          Severity: WARN per ADR-0055 soak — dated WARN->FAIL promotion
 *          ticket filed at implementation (see the PR).
 * v1.41.0 (2026-09-25, platform verifier expansion — spec
 *          docs/designs/2026-09-25-verifier-platform-expansion-design.md,
 *          sites 3a-3e/3g + R6): command checks gain the .codex/prompts mapping
 *          leg (C-CM-04 codex coverage derived from `source` per Ruling K;
 *          .agents/commands excluded per Finding D); C-CM-04 platform-skills
 *          sweep iterates all four mirror trees; VA-03 becomes 4-mirror parity
 *          with the skip marker generalized (mirror-parity: skip, gemini-parity:
 *          skip accepted as legacy alias); P-01b gains an existsSync-guarded
 *          CODEX.md leg; new mirror-hygiene check (mirrors carry only skill
 *          directories). Net-new coverage soaks in WARN per ADR-0055.
 * v1.39.0 (2026-09-24, scaffold identity overview — spec
 *          docs/designs/2026-09-24-scaffold-identity-overview-design.md):
 *          new `project-identity-placeholder` — fleet-level, WARN-only sweep of
 *          every delivered Projects/<name>/docs/ pair, reusing audit.ts's
 *          live-placeholder regex family (no new marker vocabulary): a project
 *          docs/project.md still carrying the TODO(project-overview) identity
 *          fallback, or a docs/context.md still carrying literal template
 *          placeholders (pre-2.13 residue), warns until the project team fills
 *          the identity seed. The regrowth-prevention sibling of
 *          T-20260924-004/007 for the identity class; per-project counterpart
 *          lives in audit.ts v2.41.0.
 *
 * v1.38.1 (2026-09-23, 2026-09-23-upgrade-engine-l0-only-completion-design):
 *          C-SK-02 allowedWithExtends gains `description` — the persona-integrity
 *          field (validate-agents 1.3.2) required on extends-stubs whose extends
 *          cannot resolve in project layout; the 2026-09-23 fleet repair inlined
 *          the base persona's description into all 13 variant pm.md stubs.
 *
 * v1.38.0 (ADR-0077 twin parity): new VA-06 cross-twin common section parity — the
 *           three instruction twins (CLAUDE/GEMINI/CODEX at root and templates/common)
 *           must each carry the shared policy anchors (Language Policy, Execution Plan
 *           Boilerplate, 3-Tier Cost Optimization, Error Recovery, Windows, Git & PR).
 *           Catches a policy section landed on two twins but never ported to the third
 *           (the 2026-09 CODEX.md Language Policy gap VA-05 cannot see).
 *
 * v1.36.0 (ADR-0081 fleet sweep / T-20260919-001): new `common-agents-parity`
 *           (PM-04b) — every variant templates/co-<v>/AGENTS.md must carry the
 *           COMMON-AGENTS:START/END marker-inject zone with normalized content
 *           identical to templates/common/AGENTS.md's. Closes the PM-04 gap:
 *           the keyed WORKSPACE-MANAGED extraction never covered the key-less
 *           COMMON-AGENTS zone, so all 13 variant blocks went stale (missing
 *           the ADR-0080 authority section) while the validator stayed green —
 *           discovered during the 2026-09-19 fleet sweep. Primitives:
 *           lib/managed-block-parity.ts 1.2.0 (extractCommonAgentsBlock,
 *           compareCommonAgentsBlock). Severity: Error.
 *
 * v1.35.0 (2026-09-17-governance-backlog-batch-design.md): T-20260917-009.
 *          WS-07 now derives its forbidden-file list from the upgrade-policy
 *          SCAFFOLD_COMMON_OWNED_FILES classification instead of hard-coding
 *          docs/context.md — the same SSOT new-project's variant overlay
 *          skips, so a new common-owned file is enforced and skipped
 *          atomically (design T-005 acceptance).
 *
 * v1.34.0 (2026-09-17-governance-backlog-batch-design.md): T-20260917-001.
 *          `managed-block-parity` (PM-04) now enforces common→variant parity
 *          over every MERGE_MANAGED file (lib/upgrade-policy.ts SSOT export)
 *          whose common copy carries keyed WORKSPACE-MANAGED blocks — was
 *          AGENTS.md only while upgrade MERGE unions CLAUDE.md, GEMINI.md,
 *          .gitignore, and agents/pm.md too (project-review finding #3: same
 *          silent-drift class everywhere else). Per-file absence policy: a
 *          variant AGENTS.md must exist (unchanged); any other MERGE_MANAGED
 *          file may be absent — the scaffold lays down the common copy and
 *          the variant overlay never fires (co-hr/co-safety ship no
 *          .gitignore by design). A variant agents/pm.md extends-stub
 *          delivers the common body through stub resolution (new-project
 *          §2.3b), so stubs are exempt from marker-wrapped parity
 *          (isExtendsStub, lib/managed-block-parity.ts v1.1.0).
 *
 * Validates template variants for structural integrity.
 * Follows the same pattern as agent-lifecycle-audit.ts
 *
 * Usage:
 *   bun scripts/validate-templates.ts
 *   bun scripts/validate-templates.ts --variant co-develop
 *   bun scripts/validate-templates.ts --json
 *
 * v1.33.0 (2026-09-16-template-tree-infra-consistency-design.md):
 *          T-20260916-001 + T-20260916-008. (1) Every templates/ enumeration
 *          site now skips transient E2E fixture dirs via the shared
 *          isTransientTestFixture predicate (helpers/scaffold-markers.ts) —
 *          defense in depth so a validator running while
 *          test-l3-to-variant-promotion stages fixtures under templates/
 *          can neither pollute docs/templates/VERSION_REGISTRY.json via
 *          B-07 nor fail on fixture-shaped variants. (2) New standing
 *          check `platform-mirror-freshness` — every skill present in BOTH
 *          a templates/common/.{claude,gemini,agents,codex}/skills mirror
 *          and the skills/ SSOT must carry the same version (pure logic in
 *          lib/platform-mirror-freshness.ts); T-008 found upgrade-project
 *          stale at 1.4.1 in three mirrors because the propagator's
 *          claude/gemini/agents scope-skip did not apply to codex.
 *
 * v1.32.0 (2026-09-16-scaffold-fresh-audit-remediation-design.md): T-20260916-009
 *          + T-20260916-010. New `managed-block-parity` — every
 *          `<!-- WORKSPACE-MANAGED: <key> -->…<!-- /WORKSPACE-MANAGED -->`
 *          block present in templates/common/AGENTS.md must exist, wrapped,
 *          in EVERY templates/co-* variant AGENTS.md with content parity
 *          (set-of-normalized-contents per key; duplicates are legitimate —
 *          common itself carries two tier-model-mapping blocks). Missing key,
 *          missing wrapped copy, or divergent content = Error with fix hint.
 *          This closes the T-009 delivery-channel gap: §3.6 sits outside the
 *          COMMON-AGENTS marker-inject zone, so a stale unwrapped variant
 *          block silently scaffolded a 2-model §3.6 into every fresh project
 *          (40 audit FAILs in the 2026-09-16 co-develop scaffold test). New
 *          `variant-version-manifest` — variant templates must NOT ship
 *          docs/VERSION_MANIFEST.md; the stub class is retired and the full
 *          manifest is scaffold/upgrade-owned (new-project §7.8 generation,
 *          upgrade-project post-upgrade regeneration, upgrade-policy
 *          REGENERATED_FILES). T-010 root cause: the stub tripped both the
 *          skills↔manifest parity check (37 FAILs) and the --check drift gate
 *          in the fresh scaffold's own audit, while co-abap/co-price shipped
 *          no stub at all — inconsistent either way.
 *
 * v1.31.0 (2026-09-16-propagation-target-derivation-design.md): T-20260915-005
 *          (M8). New `propagation-targets` (PM-03) — the hand-maintained
 *          propagation target lists can no longer silently miss the next new
 *          variant. For every marker-inject domain in propagation-map.json the
 *          domain is classified structurally by its target-file shape:
 *          variant-scoped (target_file absent → basename-of-source default, or
 *          carries {variant}) must satisfy target_variants ⊎ exclude_variants
 *          ≡ the actual templates/co-* directory set, disjoint (new optional
 *          per-domain exclude_variants field declares deliberate non-targets;
 *          distinct from PM-02's excluded_variants = adjudicated divergent
 *          copies); fixed-target domains (fixed relative target_file, e.g.
 *          constitution-context → docs/context.md) are validated against their
 *          own declared shape — every listed target must be an existing
 *          template directory carrying the resolved target file.
 *          docs/templates/common.lifecycle.json propagatedTo must also equal
 *          the derived co-* set in both directions. All violations are
 *          Errors with fix hints naming the exact JSON pointer.
 *
 * v1.30.0 (2026-09-16-scaffold-delivery-validation-design.md): Wave 2
 *          scaffolder-validation batch T-20260915-002 (C3) + T-20260915-010
 *          (H12). New `scaffold-marker-source` — every (marker, source
 *          template) pair declared in helpers/scaffold-markers.ts
 *          SCAFFOLD_MARKER_SOURCES must exist in its source file; a marker
 *          referenced by the scaffolders but absent from its source template
 *          is the C3 silent-no-op class (the graft-block injection once
 *          searched a renamed marker and silently appended nothing). New
 *          `pm-extends-stub-body` — every variant templates/co-<slug>
 *          agents/pm.md declaring `extends:` must carry the canonical stub
 *          body (empty or the canonicalPmStubBody sentence); a non-canonical
 *          body is real variant content that scaffold-time resolution
 *          silently discards (H12; the matching scaffold-time WARN lives in
 *          new-project.ts §2.3b).
 *
 * v1.29.0 (2026-09-16-registry-version-parity-hardening-design.md): validator-
 *          hardening batch T-20260915-013 (H10) + T-20260915-001 (H8). New
 *          C-CM-03b — contract common_platform_skills version parity: each
 *          entry's contract version must equal the SKILL.md frontmatter version
 *          of the propagated copy under templates/common/<platform>/skills/ for
 *          every declared platform tree (Check H in verify-platform-lifecycle.ts
 *          is exists-only), and a skill double-registered in common_skills AND
 *          common_platform_skills must carry the same version in both sections
 *          (9 skills are double-registered). The C-CM-04 reverse coverage sweep
 *          now also covers the templates/common/.gemini/skills/ tree (previously
 *          .claude-only). checkL0L1ScriptParity gains l0-l1-scripts-registry-
 *          version — for every script name registered in BOTH SCRIPTS.md
 *          registries the Version cells must be identical (the L1 registry is
 *          hand-maintained and excluded from content parity, so its Version
 *          cells went stale across three bump rounds; reconciled in PR #929).
 *
 * v1.27.0 (2026-09-15-agent-metadata-drift-check-design.md): new C-CM-03a —
 *          contract common_agents versions must match templates/common/agents/
 *          frontmatter (agent counterpart of the C-CM-03 skills version check),
 *          so an agent version bump can no longer leave common-contract.json
 *          silently stale.
 *
 * v1.25.0 (T-20260912-014 / T-20260912-019): manifest reverse reconciliation —
 *          exists→declared direction added for script_manifest.local (files under
 *          the variant's scripts/<variant>/ top level not declared → WARN, grace
 *          window before a later FAIL decision) and for agents[] (top-level
 *          agents/*.md not declared → WARN; agents/domains/ and agents/_shared/
 *          trees are out of scope — they are indexed via the variant's AGENTS.md,
 *          matching resolve-variants.ts's top-level scan semantics). L0/L1 script
 *          parity now also covers .json files (propagation-map.json's L1 copy was
 *          skipped by the old .ts/.md-only filter while the scrub bug of
 *          T-20260912-005 silently corrupted it). scrubConstitutionRefs now
 *          imported from the shared scripts/lib/constitution-scrub.ts (also fixes
 *          the L1 mirror's dangling import of the L0-only propagate-to-templates).
 *          main() returns the exit code; process.exit only at the import.meta.main
 *          call site, so the module is import-safe.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const _TRACKED_CO_VARIANTS: Set<string> | null = (() => {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--', 'templates/'], { encoding: 'utf-8' }).trim();
    const dirs = new Set<string>();
    if (!out) return dirs;
    for (const line of out.split('\n')) {
      const m = line.match(/^templates\/(co-[^/]+)\//);
      if (m) dirs.add(m[1]);
    }
    return dirs;
  } catch { return null; }
})();

function isCoVariantTracked(name: string): boolean {
  if (!_TRACKED_CO_VARIANTS) return true;
  return _TRACKED_CO_VARIANTS.has(name);
}
import { join, dirname, resolve, basename, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { parseSkillRegistryRows, collectWorkspaceRegistryFindings } from './helpers/skills-registry.ts';
import { getScriptLayer, getSkillLayer, includeScriptInL1, parseScriptLayers, parseSkillLayers } from './helpers/layer-filter.ts';
import { isTransientTestFixture } from './helpers/scaffold-markers.ts';
import { scanMirrorHygiene } from './helpers/mirror-hygiene.ts';
import { collectMirrorFreshnessDrift, PLATFORM_MIRROR_DIRS } from './lib/platform-mirror-freshness.ts';
import {
  validatePropagationMap,
  deriveCoVariantDirs,
  markerInjectTargetScope,
  auditVariantScopedTargets,
  auditFixedTargets,
} from './lib/propagation-map-schema.ts';
import { scrubConstitutionRefs } from './lib/constitution-scrub.ts';
import { extractKeyedBlocks, compareKeyedBlocks, isExtendsStub, extractCommonAgentsBlock, compareCommonAgentsBlock } from './lib/managed-block-parity.ts';
import { MERGE_MANAGED_FILES, SCAFFOLD_COMMON_OWNED_FILES } from './lib/upgrade-policy.ts';
import {
  SCAFFOLD_MARKER_SOURCES,
  isCanonicalPmStubBody,
} from './helpers/scaffold-markers.ts';

interface VariantManifest {
  name: string;
  description: string;
  status: 'stable' | 'planned' | 'deprecated' | 'draft' | 'beta';
  version?: string;
}

interface VariantContract {
  version: string;
  required: string[];
  optional: string[];
  context_file_pattern: string;
}

interface ValidationIssue {
  level: 'error' | 'warning';
  variant: string;
  check: string;
  message: string;
  fix?: string;
}

interface ValidationResult {
  variantsScanned: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: string;
}

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TEMPLATES_DIR = join(ROOT, 'templates');

if (!existsSync(TEMPLATES_DIR)) {
  console.error(`\x1b[31m[ERROR] templates/ directory not found at: ${TEMPLATES_DIR}\x1b[0m`);
  if (import.meta.main) {
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const variantArg = (() => {
  const idx = args.indexOf('--variant');
  return idx !== -1 ? args[idx + 1] : 'all';
})();

const issues: ValidationIssue[] = [];

function pass(msg: string) {
  if (!JSON_MODE) console.log(`${colors.green}[PASS]${colors.reset} ${msg}`);
}

function fail(variant: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'error', variant, check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`${colors.red}[FAIL]${colors.reset} ${msg}`);
    if (fix) console.log(`       ${colors.dim}Fix: ${fix}${colors.reset}`);
  }
}

function warn(variant: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'warning', variant, check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`);
    if (fix) console.log(`       ${colors.dim}Fix: ${fix}${colors.reset}`);
  }
}

// D-04: Governance policy loaded from lifecycle-governance.json
interface GovernanceDomain {
  applicable: boolean;
  tool?: string;
  mandatory?: boolean;
  currentStatus?: string;
}
interface GovernanceLayer {
  orchestrator: string | null;
  domains: Record<string, GovernanceDomain>;
}
interface GovernancePolicy {
  version: string;
  layers: Record<string, GovernanceLayer>;
  variantValidationPolicy: {
    mandatoryBeforeProjectCreation: string[];
    warningOnly: string[];
  };
}

let governance: GovernancePolicy | null = null;
function loadGovernance(): void {
  const govPath = join(ROOT, 'docs', 'templates', 'lifecycle-governance.json');
  if (!existsSync(govPath)) return;
  try {
    governance = JSON.parse(readFileSync(govPath, 'utf-8')) as GovernancePolicy;
  } catch {
    // governance stays null — checks will proceed without policy enforcement
  }
}

function isMandatory(domain: string): boolean {
  if (!governance) return true; // default to mandatory if governance file missing
  const variantLayer = governance.layers['templates-variants'];
  if (!variantLayer) return true;
  const d = variantLayer.domains[domain];
  if (!d || !d.applicable) return false;
  return d.mandatory ?? true;
}

// Check D-04: Governance policy + common.lifecycle.json
function checkGovernance(): void {
  if (!JSON_MODE) console.log('\n=== Check D-04: Lifecycle governance ===');
  const govPath = join(ROOT, 'docs', 'templates', 'lifecycle-governance.json');
  if (!existsSync(govPath)) {
    warn('common', 'governance-missing', 'docs/templates/lifecycle-governance.json not found', 'Create lifecycle-governance.json per D-01 action item');
    return;
  }
  pass('docs/templates/lifecycle-governance.json: present');

  const commonLcPath = join(ROOT, 'docs', 'templates', 'common.lifecycle.json');
  if (!existsSync(commonLcPath)) {
    warn('common', 'common-lifecycle-missing', 'docs/templates/common.lifecycle.json not found', 'Create common.lifecycle.json per D-03 action item');
  } else {
    try {
      const lc = JSON.parse(readFileSync(commonLcPath, 'utf-8')) as Record<string, unknown>;
      if (!lc.version || !lc.status || !lc.propagatedTo) {
        warn('common', 'common-lifecycle-schema', 'common.lifecycle.json missing required fields: version, status, propagatedTo');
      } else {
        pass(`docs/templates/common.lifecycle.json: v${lc.version} (${lc.status}), propagated to ${(lc.propagatedTo as string[]).length} variant(s)`);
      }
    } catch {
      fail('common', 'common-lifecycle-invalid', 'docs/templates/common.lifecycle.json is not valid JSON');
    }
  }

  if (governance && !JSON_MODE) {
    const policy = governance.variantValidationPolicy;
    console.log(`       ${colors.dim}Mandatory domains: ${policy.mandatoryBeforeProjectCreation.join(', ')}${colors.reset}`);
    console.log(`       ${colors.dim}Warning-only domains: ${policy.warningOnly.join(', ')}${colors.reset}`);
  }
}

// Check 0: templates/common/
function checkCommon(): void {
  if (!JSON_MODE) console.log('\n=== Check 0: templates/common/ ===');
  const commonDir = join(TEMPLATES_DIR, 'common');
  if (!existsSync(commonDir)) {
    fail('root', 'common-dir', 'templates/common/ directory not found', 'Create templates/common/ with shared infrastructure');
    return;
  }

  // Check required subdirectories
  const requiredDirs = ['.githooks', '.github', 'scripts', 'docs', 'memory', 'skills'];
  for (const dir of requiredDirs) {
    const dirPath = join(commonDir, dir);
    if (!existsSync(dirPath)) {
      fail('common', 'common-structure', `templates/common/${dir}/ not found`, `Create templates/common/${dir}/ directory`);
    }
  }

  pass('templates/common/ exists with required subdirectories');

  // Check forbidden files — files that must NOT exist in templates/common/
  const forbiddenFiles = ['CONSTITUTION.md', 'node_modules', '.venv', '.bun', 'dist', 'build'];
  const presentForbidden = forbiddenFiles.filter(f => existsSync(join(commonDir, f)));
  if (presentForbidden.length > 0) {
    for (const f of presentForbidden) {
      fail('common', 'forbidden-file', `templates/common/${f} must not exist — workspace-level file must not be copied to L2 projects. Delete it from templates/common/.`);
    }
  } else {
    pass('templates/common/ blocklist: no forbidden files present');
  }

  // Check A-13: removed because it contradicts AGENTS.md rule that owner does not need to exist in the current project.
  const commonSkillsDir = join(commonDir, 'skills');

  // Check B-07: workspace-only skills (scope: workspace in SKILL.md) must not exist in templates/common/skills/
  const l0SkillsDir = join(dirname(import.meta.path), '..', 'skills');
  const SKILLS_FORBIDDEN_IN_COMMON: string[] = [];
  if (existsSync(l0SkillsDir)) {
    for (const skillName of readdirSync(l0SkillsDir)) {
      const skillMd = join(l0SkillsDir, skillName, 'SKILL.md');
      if (existsSync(skillMd)) {
        const content = readFileSync(skillMd, 'utf-8');
        const scopeMatch = content.match(/^scope:\s*(\S+)/m);
        if (scopeMatch?.[1] === 'workspace') {
          SKILLS_FORBIDDEN_IN_COMMON.push(skillName);
        }
      }
    }
  }
  if (existsSync(commonSkillsDir)) {
    const presentForbiddenSkills = SKILLS_FORBIDDEN_IN_COMMON.filter(s =>
      existsSync(join(commonSkillsDir, s))
    );
    if (presentForbiddenSkills.length > 0) {
      for (const s of presentForbiddenSkills) {
        fail('common', 'forbidden-skill-in-common',
          `templates/common/skills/${s} must not exist — workspace-only skill (scope: workspace) must not be copied to L2 projects`,
          `Delete templates/common/skills/${s}/`);
      }
    } else {
      pass('templates/common/ skills blocklist: no forbidden workspace-only skills present');
    }
  }
}

// Check 1: templates/VERSION
function checkVersion(): void {
  if (!JSON_MODE) console.log('\n=== Check 1: templates/VERSION ===');
  const versionFile = join(TEMPLATES_DIR, 'VERSION');
  if (!existsSync(versionFile)) {
    fail('root', 'VERSION', 'templates/VERSION file missing', 'Create templates/VERSION with semver (e.g. 0.4.0)');
    return;
  }
  const version = readFileSync(versionFile, 'utf-8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail('root', 'VERSION', `templates/VERSION has invalid semver: "${version}"`, 'Use format X.Y.Z');
    return;
  }
  pass(`templates/VERSION: ${version}`);
}

// B-05: last_verified per profile file, collected across variants for divergence checking
const countryProfileVerified = new Map<string, Array<{ variant: string; date: string }>>();

// B-05 addendum: cross-variant country-profile freshness — same <CC>.md diverging
// across variants means one template's profile drifted ahead of the others.
function checkCountryProfileDivergence(): void {
  if (!JSON_MODE) console.log('\n=== Check B-05: cross-variant country-profile freshness ===');
  for (const [code, entries] of countryProfileVerified) {
    const distinctDates = new Set(entries.map(e => e.date));
    if (entries.length > 1 && distinctDates.size > 1) {
      const detail = entries
        .slice()
        .sort((a, b) => (a.date === b.date ? a.variant.localeCompare(b.variant) : a.date < b.date ? 1 : -1))
        .map(e => `${e.variant} ${e.date}`)
        .join(', ');
      warn('common', 'country-config', `${code}.md last_verified diverges across ${entries.length} variants: ${detail}. Realign during the next freshness pass.`);
    }
  }
}

// ── B-03r / B-03a: exists→declared reverse reconciliation helpers (T-20260912-014) ──

/** File extensions treated as invokable scripts for manifest reconciliation. */
const SCRIPT_FILE_RE = /\.(ts|mjs|cjs|js|sh|ps1)$/;

/**
 * Find script files present at the TOP LEVEL of the variant's own scripts/
 * namespace (scripts/<variant>/) that are not declared in variant.json
 * script_manifest.local.
 *
 * Scope decision: top level only. Nested lib/ and tests/ support trees are
 * registered in the variant's own scripts/<variant>/SCRIPTS.md registry, not in
 * script_manifest.local — that manifest lists directly-invokable CLI scripts
 * (that is what Check V version-tracks), and co-deck's lib/tests trees predate
 * this check with exactly that split. SCRIPTS.md itself is excluded.
 */
export function findUndeclaredScripts(variantDir: string, declaredPaths: string[]): string[] {
  const variantName = basename(variantDir);
  const nsDir = join(variantDir, 'scripts', variantName);
  if (!existsSync(nsDir)) return [];
  const declared = new Set(declaredPaths.map(p => p.replace(/\\/g, '/')));
  const undeclared: string[] = [];
  for (const f of readdirSync(nsDir)) {
    const full = join(nsDir, f);
    if (!statSync(full).isFile()) continue;
    if (f === 'SCRIPTS.md' || !SCRIPT_FILE_RE.test(f)) continue;
    const rel = `scripts/${variantName}/${f}`;
    if (!declared.has(rel)) undeclared.push(rel);
  }
  return undeclared.sort();
}

/**
 * Find top-level agents/*.md files that are not declared in variant.json
 * agents[]. README files are excluded; nested agents/domains/ and
 * agents/_shared/ trees are out of scope (indexed via the variant's AGENTS.md —
 * the schema's agents[] entries use flat "agents/<name>.md" paths and
 * resolve-variants.ts scans the same top level).
 */
export function findUndeclaredAgents(variantDir: string, declared: Array<{ name?: string; file?: string }>): string[] {
  const agentsDir = join(variantDir, 'agents');
  if (!existsSync(agentsDir)) return [];
  const declaredNames = new Set(declared.map(a => (a.name ?? '').replace(/\\/g, '/').toLowerCase()));
  const declaredFiles = new Set(declared.map(a => (a.file ?? '').replace(/\\/g, '/').toLowerCase()));
  const undeclared: string[] = [];
  for (const f of readdirSync(agentsDir)) {
    const full = join(agentsDir, f);
    if (!statSync(full).isFile() || !f.endsWith('.md')) continue;
    if (f.startsWith('README')) continue;
    const name = f.replace(/\.md$/, '');
    if (declaredNames.has(name.toLowerCase()) || declaredFiles.has(`agents/${f}`.toLowerCase())) continue;
    undeclared.push(`agents/${f}`);
  }
  return undeclared.sort();
}

// Check 2: variant.json in each variant dir
function checkVariantManifests(): Map<string, VariantManifest> {
  if (!JSON_MODE) console.log('\n=== Check 2: variant.json manifests ===');
  const manifests = new Map<string, VariantManifest>();

  if (!existsSync(TEMPLATES_DIR)) {
    fail('root', 'variant-dirs', 'templates/ directory not found');
    return manifests;
  }

  const entries = readdirSync(TEMPLATES_DIR);
  const variantDirs = entries.filter(e => {
    if (isTransientTestFixture(e)) return false; // E2E staging dirs under templates/ (T-20260916-001)
    const fullPath = join(TEMPLATES_DIR, e);
    return statSync(fullPath).isDirectory() && !e.startsWith('.') && e !== 'common'
      && (e.startsWith('co-') ? isCoVariantTracked(e) : true);
  });

  if (variantDirs.length === 0) {
    fail('root', 'variant-dirs', 'No variant directories found in templates/');
    return manifests;
  }

  for (const dir of variantDirs) {
    if (variantArg !== 'all' && dir !== variantArg) continue;

    const manifestPath = join(TEMPLATES_DIR, dir, 'variant.json');
    if (!existsSync(manifestPath)) {
      fail(dir, 'variant-json', `templates/${dir}/variant.json missing`, `Create variant.json with name, description, status fields`);
      continue;
    }

    try {
      const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
      const requiredFields = ['name', 'description', 'status'];
      const missing = requiredFields.filter(f => !(f in raw));

      if (missing.length > 0) {
        fail(dir, 'variant-json', `templates/${dir}/variant.json missing fields: ${missing.join(', ')}`);
        continue;
      }

      const validStatuses = ['stable', 'planned', 'deprecated', 'draft', 'beta'];
      if (!validStatuses.includes(raw.status as string)) {
        fail(dir, 'variant-json', `templates/${dir}/variant.json has invalid status: "${raw.status}"`, `Use: stable | planned | deprecated | draft | beta`);
        continue;
      }

      // B-02: Lifecycle field validation
      const lifecycle = raw.lifecycle as Record<string, unknown> | undefined;
      if (!lifecycle) {
        fail(dir, 'variant-lifecycle', `templates/${dir}/variant.json missing 'lifecycle' object`);
      } else {
        if (!lifecycle.statusSince) {
          fail(dir, 'variant-lifecycle', `templates/${dir}/variant.json lifecycle.statusSince is missing`, `Add "statusSince": "YYYY-MM-DD" to lifecycle object`);
        }
        if (!lifecycle.lastTransition) {
          fail(dir, 'variant-lifecycle', `templates/${dir}/variant.json lifecycle.lastTransition is missing`, `Add "lastTransition": "... → ... on YYYY-MM-DD" to lifecycle object`);
        }
        if (lifecycle.statusSince && lifecycle.lastTransition) {
          pass(`templates/${dir}/variant.json lifecycle fields OK (statusSince, lastTransition)`);
        }
      }

      // B-03: script_manifest path existence check
      const scriptManifest = raw.script_manifest as { local?: Array<{ name: string; path: string }> } | undefined;
      if (scriptManifest?.local && Array.isArray(scriptManifest.local)) {
        for (const entry of scriptManifest.local) {
          const scriptPath = join(TEMPLATES_DIR, dir, entry.path);
          if (!existsSync(scriptPath)) {
            fail(dir, 'script-manifest', `script_manifest.local "${entry.name}": path not found: ${entry.path}`, `Create the script at templates/${dir}/${entry.path} or remove the entry from variant.json`);
          } else {
            pass(`templates/${dir}/variant.json script_manifest.local["${entry.name}"] → ${entry.path} ✓`);
          }
        }
      }

      // B-03r: exists→declared reverse reconciliation (T-20260912-014).
      // A script dropped into the variant's own scripts/<variant>/ namespace must
      // be declared in script_manifest.local, or downstream consumers (Check V
      // version tracking, scaffolding injection) silently miss it.
      const undeclaredScripts = findUndeclaredScripts(join(TEMPLATES_DIR, dir), (scriptManifest?.local ?? []).map(e => e.path));
      for (const rel of undeclaredScripts) {
        warn(dir, 'script-manifest-reverse', `templates/${dir}/${rel} exists but is not declared in variant.json script_manifest.local`, `Add {"name": "${basename(rel).replace(/\.[^.]+$/, '')}", "path": "${rel}"} to script_manifest.local — grace window: WARN now, promotion to FAIL is a pending follow-up decision`);
      }

      // B-03a: agents exists→declared reverse reconciliation (T-20260912-014).
      // Top-level agents/*.md files must appear in variant.json agents[] — that
      // array is the machine-readable roster (schema docs/templates/variant.schema.json;
      // resolve-variants.ts scans the same top level). Nested agents/domains/ and
      // agents/_shared/ trees are intentionally out of scope: they are indexed via
      // the variant's AGENTS.md, not the flat agents[] roster.
      const declaredAgents = (raw.agents as Array<{ name?: string; file?: string }> | undefined) ?? [];
      const undeclaredAgents = findUndeclaredAgents(join(TEMPLATES_DIR, dir), declaredAgents);
      for (const rel of undeclaredAgents) {
        warn(dir, 'agent-manifest-reverse', `templates/${dir}/${rel} exists but is not declared in variant.json agents[]`, `Add {"name": "${basename(rel).replace(/\.md$/, '')}", "file": "${rel}"} to agents — top-level roster only (domains/_shared trees are indexed via AGENTS.md); grace window: WARN now, promotion to FAIL is a pending follow-up decision`);
      }

      // B-04: theme_manifest CSS file existence check
      const themeManifest = raw.theme_manifest as {
        base_css?: string;
        overrides_dir?: string;
        available?: string[];
      } | undefined;
      if (themeManifest) {
        if (themeManifest.base_css) {
          const baseCssPath = join(TEMPLATES_DIR, dir, themeManifest.base_css);
          if (!existsSync(baseCssPath)) {
            fail(dir, 'theme-manifest', `theme_manifest.base_css not found: ${themeManifest.base_css}`, `Create the file at templates/${dir}/${themeManifest.base_css}`);
          } else {
            pass(`templates/${dir}/variant.json theme_manifest.base_css → ${themeManifest.base_css} ✓`);
          }
        }
        if (themeManifest.overrides_dir && Array.isArray(themeManifest.available)) {
          for (const theme of themeManifest.available) {
            // Two supported on-disk layouts for theme override CSS:
            //   flat:   <overrides_dir>/<theme>.css
            //   nested: <overrides_dir>/<theme>/style.css  (e.g. co-deck's shared styles/ pool)
            const flatRelPath = `${themeManifest.overrides_dir}/${theme}.css`;
            const nestedRelPath = `${themeManifest.overrides_dir}/${theme}/style.css`;
            const flatCssPath = join(TEMPLATES_DIR, dir, themeManifest.overrides_dir, `${theme}.css`);
            const nestedCssPath = join(TEMPLATES_DIR, dir, themeManifest.overrides_dir, theme, 'style.css');
            if (existsSync(flatCssPath)) {
              pass(`templates/${dir}/variant.json theme_manifest["${theme}"] → ${flatRelPath} ✓`);
            } else if (existsSync(nestedCssPath)) {
              pass(`templates/${dir}/variant.json theme_manifest["${theme}"] → ${nestedRelPath} ✓`);
            } else {
              fail(dir, 'theme-manifest', `theme_manifest theme "${theme}": CSS not found: ${flatRelPath} or ${nestedRelPath}`, `Create the file at templates/${dir}/${flatRelPath} (flat layout) or templates/${dir}/${nestedRelPath} (nested layout)`);
            }
          }
        }
      }

      // B-05: country_config validation
      const countryConfig = raw.country_config as {
        profiles_dir?: string;
        supported?: string[];
        default?: string | null;
      } | undefined;

      if (countryConfig) {
        // Check required fields
        if (!countryConfig.profiles_dir || countryConfig.profiles_dir.trim() === '') {
          fail(dir, 'country-config', `templates/${dir}/variant.json country_config.profiles_dir is missing or empty`);
        }
        if (!countryConfig.supported || !Array.isArray(countryConfig.supported) || countryConfig.supported.length === 0) {
          fail(dir, 'country-config', `templates/${dir}/variant.json country_config.supported is missing or empty`);
        } else {
          // Check each supported code has a profile file
          for (const code of countryConfig.supported) {
            if (!/^[A-Z]{2,4}$/.test(code)) {
              fail(dir, 'country-config', `templates/${dir}/variant.json country_config.supported contains invalid code: '${code}'. Pattern: ^[A-Z]{2,4}$`);
              continue;
            }
            // fail() above is not a `never` guard, so profiles_dir may still be undefined
            // here at runtime (join then throws) — cast documents the intent without
            // changing that behavior.
            const profilePath = join(TEMPLATES_DIR, dir, countryConfig.profiles_dir as string, `${code}.md`);
            if (!existsSync(profilePath)) {
              fail(dir, 'country-config', `templates/${dir}/variant.json country_config.supported includes '${code}' but profile file missing: ${countryConfig.profiles_dir}/${code}.md`);
            } else {
              // Validate profile frontmatter
              try {
                const profileContent = readFileSync(profilePath, 'utf-8');
                const frontmatter = parseFrontmatter(profileContent);
                const requiredFields = ['code', 'name', 'status', 'last_verified'];
                const missing = requiredFields.filter(f => !frontmatter[f]);
                if (missing.length > 0) {
                  fail(dir, 'country-config', `templates/${dir}/${countryConfig.profiles_dir}/${code}.md missing frontmatter fields: ${missing.join(', ')}`);
                } else {
                  // Check code matches filename
                  const codeMatch = profileContent.match(/^code:\s*([A-Z]{2,4})/m);
                  if (!codeMatch || codeMatch[1] !== code) {
                    fail(dir, 'country-config', `templates/${dir}/${countryConfig.profiles_dir}/${code}.md frontmatter code doesn't match filename`);
                  }
                  // Check status value (must be one of: active, draft, stale)
                  const statusMatch = profileContent.match(/^status:\s*(\S+)/m);
                  if (!statusMatch || !['active', 'draft', 'stale'].includes(statusMatch[1])) {
                    fail(dir, 'country-config', `templates/${dir}/${countryConfig.profiles_dir}/${code}.md status must be one of: active, draft, stale (found: '${statusMatch ? statusMatch[1] : 'missing'}')`);
                  }
                  // Check last_verified age (WARN if > 12 months)
                  const lastVerifiedMatch = profileContent.match(/^last_verified:\s*(\d{4}-\d{2}-\d{2})/m);
                  if (lastVerifiedMatch) {
                    const lastVerified = new Date(lastVerifiedMatch[1]);
                    const monthsSince = (Date.now() - lastVerified.getTime()) / (30 * 24 * 60 * 60 * 1000);
                    if (monthsSince > 12) {
                      warn(dir, 'country-config', `templates/${dir}/${countryConfig.profiles_dir}/${code}.md last_verified is older than 12 months (${lastVerifiedMatch[1]}). Consider reviewing.`);
                      // Auto-stale: an 'active' profile past the 12-month line should move to 'stale'
                      if (statusMatch?.[1] === 'active') {
                        warn(dir, 'country-config', `templates/${dir}/${countryConfig.profiles_dir}/${code}.md status is 'active' but last_verified (${lastVerifiedMatch[1]}) is older than 12 months. Set status: stale until re-verified (stale profiles stay loadable and are flagged at Phase 0 intake).`);
                      }
                    }
                    // Collect for the cross-variant divergence check
                    const seen = countryProfileVerified.get(code) ?? [];
                    seen.push({ variant: dir, date: lastVerifiedMatch[1] });
                    countryProfileVerified.set(code, seen);
                  }
                }
              } catch (e) {
                fail(dir, 'country-config', `templates/${dir}/${countryConfig.profiles_dir}/${code}.md has unparseable frontmatter`);
              }
            }
          }
        }
        // Check default is null (region-neutral is required)
        if (countryConfig.default !== null && countryConfig.default !== undefined) {
          warn(dir, 'country-config', `templates/${dir}/variant.json country_config.default is '${countryConfig.default}'. Policy requires region-neutral (null).`);
        }
      }

      // Check if docs/countries/*.md exists but no country_config declared
      const countriesDir = join(TEMPLATES_DIR, dir, 'docs', 'countries');
      if (!countryConfig && existsSync(countriesDir)) {
        const profiles = readdirSync(countriesDir).filter(f => f.endsWith('.md') && f !== 'ACTIVE.md');
        if (profiles.length > 0) {
          warn(dir, 'country-config', `templates/${dir}/docs/countries/ contains ${profiles.length} profile(s) but variant.json has no country_config declared.`);
        }
      }

      // Advisory: check if description appears jurisdiction-anchored
      if (countryConfig && raw.description) {
        const jurisdictionTerms = /korea|korean|한국|대한민국/i;
        if (jurisdictionTerms.test(String(raw.description))) {
          warn(dir, 'country-config', `templates/${dir}/variant.json description appears jurisdiction-anchored (contains Korea/Korean/한국/대한민국). Consider region-neutral description with country-specific details in profiles.`);
        }
      }

      // Registry integrity: check country_scoped_assets skills exist in common
      const schemaPath = join(ROOT, 'docs', 'workspace-schema.json');
      if (existsSync(schemaPath)) {
        try {
          const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
          const countryScoped = schema.country_scoped_assets as {
            skills?: Record<string, string>;
            scripts?: Record<string, string>;
          } | undefined;

          if (countryScoped?.skills) {
            for (const [skillName, scopedCountry] of Object.entries(countryScoped.skills)) {
              const commonSkillPath = join(TEMPLATES_DIR, 'common', 'skills', skillName);
              if (!existsSync(commonSkillPath)) {
                fail('root', 'country-scoped-assets', `Registry lists skill '${skillName}' as ${scopedCountry}-scoped but it's missing from templates/common/skills/`);
              }
            }
          }

          // For variants without KR in country_config.supported, warn if agents reference scoped skills
          if (countryConfig?.supported && !countryConfig.supported.includes('KR')) {
            const agentsDir = join(TEMPLATES_DIR, dir, 'agents');
            if (existsSync(agentsDir)) {
              for (const agentFile of readdirSync(agentsDir)) {
                if (agentFile.endsWith('.md')) {
                  const agentPath = join(agentsDir, agentFile);
                  const agentContent = readFileSync(agentPath, 'utf-8');
                  const agentFrontmatter = parseFrontmatter(agentContent);
                  if (agentFrontmatter.required_skills) {
                    const requiredSkillsMatch = agentContent.match(/^required_skills:\s*\[(.*?)\]/m);
                    if (requiredSkillsMatch) {
                      const requiredSkills = requiredSkillsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
                      for (const skill of requiredSkills) {
                        if (Object.keys(countryScoped?.skills || {}).includes(skill)) {
                          const scopedCountry = countryScoped?.skills?.[skill] || 'unknown';
                          warn(dir, 'country-config', `templates/${dir}/agents/${agentFile} required_skills includes scoped skill '${skill}' but variant does not support ` + scopedCountry + `. Reference will be dangling after prune.`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Schema read error - silently skip registry check
        }
      }

      // B-06: env registry integrity checks against templates/common/.env.sample
      const envSamplePath = join(TEMPLATES_DIR, 'common', '.env.sample');
      if (existsSync(schemaPath) && existsSync(envSamplePath)) {
        try {
          const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
          const countryScoped = schema.country_scoped_assets as {
            env?: Record<string, string>;
          } | undefined;

          if (countryScoped?.env) {
            const envContent = readFileSync(envSamplePath, 'utf-8');
            const lines = envContent.split('\n');

            // Track state for parsing marker blocks
            const openMarkers = new Map<number, string>(); // line number -> CODE
            const closeMarkers = new Map<number, string>(); // line number -> CODE
            const blocks: Array<{ startLine: number; endLine: number; code: string }> = [];
            let currentBlock: { startLine: number; code: string } | null = null;

            // First pass: identify all markers and blocks
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const openMatch = line.match(/^# >>>\s*country-scoped:([A-Z]{2,4})/);
              const closeMatch = line.match(/^# <<<\s*country-scoped:([A-Z]{2,4})/);

              if (openMatch) {
                const code = openMatch[1];
                openMarkers.set(i, code);
                if (currentBlock !== null) {
                  fail('root', 'env-integrity', `templates/common/.env.sample has nested opening marker at line ${i + 1} without closing previous block at line ${currentBlock.startLine + 1}.`);
                }
                currentBlock = { startLine: i, code };
              } else if (closeMatch) {
                const code = closeMatch[1];
                closeMarkers.set(i, code);
                if (currentBlock === null) {
                  fail('root', 'env-integrity', `templates/common/.env.sample has closing marker at line ${i + 1} without matching opening marker.`);
                } else if (currentBlock.code !== code) {
                  fail('root', 'env-integrity', `templates/common/.env.sample marker mismatch: block opened with '${currentBlock.code}' at line ${currentBlock.startLine + 1} but closed with '${code}' at line ${i + 1}.`);
                } else {
                  blocks.push({ startLine: currentBlock.startLine, endLine: i, code: currentBlock.code });
                  currentBlock = null;
                }
              }
            }

            // Check for unclosed block
            if (currentBlock !== null) {
              fail('root', 'env-integrity', `templates/common/.env.sample has unclosed block starting at line ${currentBlock.startLine + 1} with code '${currentBlock.code}'. Missing closing marker.`);
            }

            // E2: validate balanced markers
            if (openMarkers.size !== closeMarkers.size) {
              fail('root', 'env-integrity', `templates/common/.env.sample has ${openMarkers.size} opening markers but ${closeMarkers.size} closing markers. Each opening must have a matching closing marker.`);
            }

            // E1: check every registered env key appears in a matching block
            const registeredKeys = new Set(Object.keys(countryScoped.env));
            const foundKeys = new Set<string>();

            for (const block of blocks) {
              const blockCode = block.code;
              const blockLines = lines.slice(block.startLine, block.endLine + 1);
              const blockText = blockLines.join('\n');

              // Find KEY= patterns in this block
              const keyMatches = blockText.match(/^([A-Z_]+)=/gm);
              if (keyMatches) {
                for (const match of keyMatches) {
                  const key = match.replace('=', '');
                  foundKeys.add(key);

                  // E3: check key is registered
                  if (!registeredKeys.has(key)) {
                    fail('root', 'env-integrity', `templates/common/.env.sample contains unregistered env key '${key}' in ${blockCode}-scoped block (lines ${block.startLine + 1}-${block.endLine + 1}). Register it in workspace-schema.json country_scoped_assets.env.`);
                  } else {
                    // E3: check block code matches registered country
                    const registeredCountry = countryScoped.env![key];
                    if (registeredCountry !== blockCode) {
                      fail('root', 'env-integrity', `templates/common/.env.sample key '${key}' is in ${blockCode}-scoped block but registered as ${registeredCountry}-scoped in workspace-schema.json. Mismatch at lines ${block.startLine + 1}-${block.endLine + 1}.`);
                    }
                  }
                }
              }
            }

            // E1: check every registered key was found
            for (const key of registeredKeys) {
              if (!foundKeys.has(key)) {
                fail('root', 'env-integrity', `Registry env key '${key}' (registered as ${countryScoped.env![key]}) does not appear in templates/common/.env.sample. Add ${key}= inside a # >>> country-scoped:${countryScoped.env![key]} marker block.`);
              }
            }
          }
        } catch (e) {
          // Schema/env read error - silently skip
        }
      }

      manifests.set(dir, raw as unknown as VariantManifest);
      pass(`templates/${dir}/variant.json: status=${raw.status}`);
    } catch (e) {
      fail(dir, 'variant-json', `templates/${dir}/variant.json is not valid JSON`);
    }
  }

  return manifests;
}

// Normalize content: strip BOM and normalize line endings
function normalizeContent(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Parse frontmatter fields from markdown (handles BOM, CRLF, multi-line values, YAML blocks, @resolved-from: header)
function parseFrontmatter(rawContent: string): Record<string, true> {
  // Strip @resolved-from: comment line (L1-B Phase marker) before parsing
  const strippedContent = rawContent.replace(/^# @resolved-from:.*\n/, '');
  const content = normalizeContent(strippedContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fields: Record<string, true> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    // Only top-level keys (no leading spaces, no list items)
    if (key && !key.startsWith(' ') && !key.startsWith('-')) fields[key] = true;
  }
  return fields;
}

/**
 * Resolve extends pattern in frontmatter
 * If file has "extends: path/to/skeleton.md", read skeleton and merge frontmatters
 * @param filePath - Absolute path to the variant file
 * @param frontmatter - Parsed frontmatter fields from the variant file
 * @returns Merged frontmatter fields (skeleton + variant overrides)
 */

function getResolvedContent(filePath: string): string {
  const rawContent = readFileSync(filePath, 'utf-8');
  let fullContent = rawContent;
  // Strip @resolved-from: comment line before matching frontmatter
  const stripped = rawContent.replace(/^# @resolved-from:.*\n/, '');
  const match = stripped.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    try {
      const yamlObj = load(match[1]) as Record<string, unknown>;
      if (yamlObj.extends) {
        const skeletonPath = resolve(dirname(filePath), String(yamlObj.extends));
        if (existsSync(skeletonPath)) {
          fullContent += "\n" + getResolvedContent(skeletonPath);
        }
      }
    } catch {
      // ignore
    }
  }
  return fullContent;
}

function getResolvedYaml(filePath: string): Record<string, unknown> {
  const rawContent = readFileSync(filePath, 'utf-8');
  // Strip @resolved-from: comment line before matching frontmatter
  const stripped = rawContent.replace(/^# @resolved-from:.*\n/, '');
  const match = stripped.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    const yamlObj = load(match[1]) as Record<string, unknown>;
    if (yamlObj.extends) {
      const skeletonPath = resolve(dirname(filePath), String(yamlObj.extends));
      if (existsSync(skeletonPath)) {
        const skeletonYaml = getResolvedYaml(skeletonPath);
        return { ...skeletonYaml, ...yamlObj };
      }
    }
    return yamlObj;
  } catch {
    return {};
  }
}

function resolveExtends(filePath: string, frontmatter: Record<string, true>): Record<string, true> {
  if (!frontmatter.extends) {
    return frontmatter; // No extends, return as-is
  }

  // Extract the extends path from the raw content (we need the actual path string, not just 'true')
  const rawContent = readFileSync(filePath, 'utf-8');
  const content = normalizeContent(rawContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return frontmatter;

  // Parse the extends value from YAML
  let extendsPath: string | undefined;
  try {
    const yamlObj = load(match[1]) as Record<string, unknown>;
    extendsPath = yamlObj.extends as string | undefined;
  } catch {
    return frontmatter; // Invalid YAML, return original
  }

  if (!extendsPath) return frontmatter;

  // Resolve skeleton path relative to current file
  const skeletonPath = resolve(dirname(filePath), extendsPath);

  try {
    if (!existsSync(skeletonPath)) {
      console.warn(`[WARN] Skeleton file not found: ${skeletonPath}`);
      return frontmatter;
    }

    const skeletonContent = readFileSync(skeletonPath, 'utf-8');
    const skeletonMatch = skeletonContent.match(/^---\n([\s\S]*?)\n---/);

    if (!skeletonMatch) {
      // No frontmatter in skeleton, return variant frontmatter
      return frontmatter;
    }

    const skeletonFrontmatter = parseFrontmatter(skeletonContent);

    // Recursively resolve the skeleton's extends chain
    const resolvedSkeleton = resolveExtends(skeletonPath, skeletonFrontmatter);

    // Merge: skeleton base + variant overrides (variant takes precedence)
    const merged = { ...resolvedSkeleton };
    for (const key of Object.keys(frontmatter)) {
      if (key !== 'extends') {
        merged[key] = frontmatter[key];
      }
    }

    return merged;
  } catch (error) {
    console.warn(`[WARN] Failed to resolve extends: ${skeletonPath}`, error);
    return frontmatter; // Fallback to original
  }
}

// Check 3 & 4: Agent frontmatter and required sections
function checkAgents(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 3-4: Agent files in ${variant} ===`);
  const agentsDir = join(TEMPLATES_DIR, variant, 'agents');
  if (!existsSync(agentsDir)) {
    warn(variant, 'agents-dir', `templates/${variant}/agents/ directory not found`);
    return;
  }

  const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith('.md'));
  if (agentFiles.length === 0) {
    warn(variant, 'agents-empty', `No agent .md files found in templates/${variant}/agents/`);
    return;
  }

  // Check for required agents/README.md and agents/README_ko.md (per VARIANT_CONTRACT.md)
  for (const readmeFile of ['README.md', 'README_ko.md']) {
    const readmePath = join(agentsDir, readmeFile);
    if (!existsSync(readmePath)) {
      fail(variant, `agents-readme-missing`, `templates/${variant}/agents/${readmeFile} not found`,
        `Create agents/${readmeFile} with agent roster table`);
    } else {
      pass(`${variant}/agents/${readmeFile}: present`);
    }
  }

  const requiredFrontmatter = ['name', 'status', 'tier', 'description', 'examples'];
  const validAgentStatuses = ['active', 'deprecated', 'experimental'];
  // PM uses "Meeting Facilitation" (facilitator role); all others use "Meeting Participation"
  const MEETING_SECTIONS = ['## Meeting Participation', '## Meeting Facilitation'];
  const DISPATCH_SECTION = '## Dispatch Protocol';

  // Only check actual agent definition files (skip README, handoff-spec, and similar docs)
  const agentDefinitionFiles = agentFiles.filter(f =>
    !f.startsWith('README') && !f.startsWith('handoff-spec')
  );

  for (const file of agentDefinitionFiles) {
    const filePath = join(agentsDir, file);
    const rawContent = readFileSync(filePath, 'utf-8');
    const content = normalizeContent(rawContent);
    const fields = parseFrontmatter(rawContent);

    // Resolve extends pattern - merge skeleton frontmatter with variant frontmatter
    const resolvedFields = resolveExtends(filePath, fields);

    // Check frontmatter (field must exist as a key, value can be empty/block)
    const missingFields = requiredFrontmatter.filter(f => !(f in resolvedFields));
    if (missingFields.length > 0) {
      fail(variant, 'agent-frontmatter', `agents/${file}: missing frontmatter: ${missingFields.join(', ')}`,
        `Add missing fields to YAML frontmatter. Required: ${requiredFrontmatter.join(', ')}`);
    } else {
      // Validate status enum value (extract actual value from resolved content)
      let statusVal = '';
      const resolvedYaml = getResolvedYaml(filePath);
      statusVal = (resolvedYaml.status as string) ?? '';

      if (!validAgentStatuses.includes(statusVal)) {
        fail(variant, 'agent-status-invalid',
          `agents/${file}: invalid status value '${statusVal}' (allowed: ${validAgentStatuses.join(' | ')})`,
          `Set status to one of: ${validAgentStatuses.join(', ')}`);
      } else {
        pass(`agents/${file}: frontmatter OK`);
      }
    }

    // Check required sections
    // For additive overrides, invariant sections may be missing from variant file (provided by skeleton)
    const agentName = file.replace('.md', '');
    const variantJsonForAgent = join(TEMPLATES_DIR, variant, 'variant.json');
    let agentOverrideType = 'replacement';
    if (existsSync(variantJsonForAgent)) {
      try {
        const vj = JSON.parse(readFileSync(variantJsonForAgent, 'utf-8'));
        agentOverrideType = vj.agent_overrides?.[agentName]?.type ?? 'replacement';
      } catch { /* keep default */ }
    }
    const commonAgentPath = join(TEMPLATES_DIR, 'common', 'agents', file);
    const commonAgentContent = existsSync(commonAgentPath)
      ? normalizeContent(readFileSync(commonAgentPath, 'utf-8'))
      : '';

    const fullResolvedContent = getResolvedContent(filePath);

    // Detect pure YAML-skeleton pm.md (extends: pattern, no body content — ADR-0033)
    // In this pattern, Dispatch Protocol lives in AGENTS.md §3, so section checks are exempt.
    const isYamlSkeletonPm = file === 'pm.md' && rawContent.trim().match(/^---[\s\S]*?---\s*$/) !== null;
    // Detect resolved pm.md (pre-resolved by resolve-variants.ts L1-B Phase)
    // Resolved files also have Dispatch Protocol in AGENTS.md §3, so section checks are exempt.
    const isResolvedPm = file === 'pm.md' && rawContent.startsWith('# @resolved-from:');

    // Section is "present" if in variant file OR (additive override AND in skeleton) OR recursively inherited via extends
    const hasMeetingSection = isYamlSkeletonPm || isResolvedPm || MEETING_SECTIONS.some(s =>
      content.includes(s) || (agentOverrideType === 'additive' && commonAgentContent.includes(s)) || fullResolvedContent.includes(s)
    );
    const hasDispatchSection = isYamlSkeletonPm || isResolvedPm || content.includes(DISPATCH_SECTION) ||
      (agentOverrideType === 'additive' && commonAgentContent.includes(DISPATCH_SECTION)) || fullResolvedContent.includes(DISPATCH_SECTION);
    const missingSections: string[] = [];
    if (!hasMeetingSection) missingSections.push('## Meeting Participation (or ## Meeting Facilitation)');
    if (!hasDispatchSection) missingSections.push(DISPATCH_SECTION);

    if (missingSections.length > 0) {
      fail(variant, 'agent-sections', `agents/${file}: missing sections: ${missingSections.join(', ')}`);
    } else {
      pass(`agents/${file}: required sections OK`);
    }
  }
}

// Check 5: AGENTS.md roster vs actual files
function checkAgentsRoster(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 5: AGENTS.md roster in ${variant} ===`);
  const agentsMdPath = join(TEMPLATES_DIR, variant, 'AGENTS.md');
  const agentsDir = join(TEMPLATES_DIR, variant, 'agents');

  if (!existsSync(agentsMdPath)) {
    fail(variant, 'agents-roster', `templates/${variant}/AGENTS.md not found`);
    return;
  }
  if (!existsSync(agentsDir)) return;

  const agentsMd = readFileSync(agentsMdPath, 'utf-8');
  const registeredFiles = new Set<string>();
  for (const match of agentsMd.matchAll(/\[([^\]]+)\]\(agents\/([^)]+)\.md\)/g)) {
    registeredFiles.add(`${match[2]}.md`);
  }

  // Exclude documentation files (README, handoff-spec) from roster check
  const actualFiles = new Set(readdirSync(agentsDir).filter(f =>
    f.endsWith('.md') && !f.startsWith('README') && !f.startsWith('handoff-spec')
  ));

  // Also consider agents inherited from templates/common/agents/ as "present"
  const commonAgentsDir = join(TEMPLATES_DIR, 'common', 'agents');
  const commonAgentFiles = existsSync(commonAgentsDir)
    ? new Set(readdirSync(commonAgentsDir).filter(f => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('README')))
    : new Set<string>();
  const allAvailableFiles = new Set([...actualFiles, ...commonAgentFiles]);

  const orphaned = [...actualFiles].filter(f => !registeredFiles.has(f));
  const missing = [...registeredFiles].filter(f => !allAvailableFiles.has(f));

  if (orphaned.length > 0) {
    warn(variant, 'agents-roster', `Orphaned agent files (not in AGENTS.md): ${orphaned.join(', ')}`, 'Add to AGENTS.md roster table');
  }
  if (missing.length > 0) {
    warn(variant, 'agents-roster', `AGENTS.md references missing files: ${missing.join(', ')}`, 'Create the agent file or remove from AGENTS.md');
  }
  if (orphaned.length === 0 && missing.length === 0) {
    pass(`${variant}/AGENTS.md roster matches filesystem (${actualFiles.size} agents)`);
  }
}

// Check 6: commands structure — shared in common/, variant-specific only in variants
// Command surfaces (spec 2026-09-25-verifier-platform-expansion-design site 3a):
// .claude/commands and .gemini/commands are 1:1 mirrors (modulo gemini-parity:
// skip); .codex/prompts is the codex mapping of the same SSOT (ADR-0077 D4).
// .agents/commands is EXCLUDED — L0-resident by design, consumed by the
// Antigravity CLI at the workspace root (spec
// docs/designs/2026-09-25-propagation-engine-batch-design.md §6-D8, ticket
// T-20260925-003); recorded exclusion, not a silent skip.
const COMMAND_SURFACES: ReadonlyArray<readonly [string, string]> = [
  ['.claude', 'commands'],
  ['.gemini', 'commands'],
  ['.codex', 'prompts'],
];
/** Net-new surfaces soaking in WARN (ADR-0055); promotion ticket flips to fail. */
const SOAK_COMMAND_SURFACES = new Set(['.codex/prompts']);

function checkCommands(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 6: commands in ${variant} ===`);

  const allSharedCommands = ['changelog.md', 'commit-push-pr.md', 'gateguard.md', 'meeting.md', 'memlog.md', 'new-task.md', 'project-review.md', 'sync.md'];

  if (variant === 'common') {
    // common/ must have all shared commands in every command surface
    for (const [platform, leaf] of COMMAND_SURFACES) {
      const commandsDir = join(TEMPLATES_DIR, 'common', platform, leaf);
      if (!existsSync(commandsDir)) {
        fail('common', 'commands-dir', `templates/common/${platform}/${leaf}/ not found`);
        continue;
      }
      const soak = SOAK_COMMAND_SURFACES.has(`${platform}/${leaf}`);
      const emit = soak ? warn : fail;
      for (const cmd of allSharedCommands) {
        if (!existsSync(join(commandsDir, cmd))) {
          emit('common', 'command-missing', `${platform}/${leaf}/${cmd} not found in common/`);
        }
      }
      pass(`common/${platform}/${leaf}: ${allSharedCommands.length} shared commands OK${soak ? ' (soak: WARN until promotion)' : ''}`);
    }
    return;
  }

  // Variants must NOT have shared commands (inherited from common/ via new-project.sh overlay)
  // Only security-check.md is allowed as a variant-specific command
  const allowedVariantCommands = new Set(['security-check.md']);
  for (const [platform, leaf] of COMMAND_SURFACES) {
    const commandsDir = join(TEMPLATES_DIR, variant, platform, leaf);
    if (!existsSync(commandsDir)) continue;
    const soak = SOAK_COMMAND_SURFACES.has(`${platform}/${leaf}`);
    const emit = soak ? warn : fail;
    const files = readdirSync(commandsDir);
    const unexpected = files.filter(f => !allowedVariantCommands.has(f));
    if (unexpected.length > 0) {
      emit(variant, 'command-duplicate', `${platform}/${leaf}/ contains shared commands that belong in common/ only: ${unexpected.join(', ')}`);
    } else {
      pass(`${variant}/${platform}/${leaf}: OK (${files.length} variant-specific file(s))`);
    }
  }
}

// Check 7: scripts and .githooks parity — removed (dead code after ADR-0036 TypeScript migration)

// Check 8: Shared file sync warning
function checkSharedFileSync(): void {
  if (!JSON_MODE) console.log('\n=== Check 8: Shared file sync ===');
  const workspaceMeeting = join(ROOT, '.claude', 'commands', 'meeting.md');
  const templateMeeting = join(TEMPLATES_DIR, 'common', '.claude', 'commands', 'meeting.md');

  if (!existsSync(workspaceMeeting) || !existsSync(templateMeeting)) {
    // One or both missing — skip silently
    return;
  }

  const wsContent = normalizeContent(readFileSync(workspaceMeeting, 'utf-8'));
  const tplContent = normalizeContent(readFileSync(templateMeeting, 'utf-8'));

  if (wsContent !== tplContent) {
    warn('root', 'shared-sync', 'meeting.md differs between workspace and templates/common', 'Run: cp .claude/commands/meeting.md templates/common/.claude/commands/meeting.md');
  } else {
    pass('meeting.md: workspace and common are in sync');
  }
}

// Check 11: README presence in stable variants
function checkReadmePresence(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 11: README presence in ${variant} ===`);

  const readmePath = join(TEMPLATES_DIR, variant, 'README.md');
  const readmeKoPath = join(TEMPLATES_DIR, variant, 'README_ko.md');

  const readmeExists = existsSync(readmePath);
  const readmeKoExists = existsSync(readmeKoPath);

  if (!readmeExists) {
    fail(variant, 'readme-presence', `templates/${variant}/README.md is missing`, `Create README.md with a content_hash: frontmatter field`);
  }
  if (!readmeKoExists) {
    fail(variant, 'readme-presence', `templates/${variant}/README_ko.md is missing`, `Create README_ko.md with a translated_from_hash: frontmatter field`);
  }

  if (readmeExists && readmeKoExists) {
    pass(`${variant}/README.md and README_ko.md both present`);
  }

  // Warn if frontmatter hash fields are missing
  if (readmeExists) {
    const readmeFields = parseFrontmatter(readFileSync(readmePath, 'utf-8'));
    if (!('content_hash' in readmeFields)) {
      warn(variant, 'readme-frontmatter', `templates/${variant}/README.md is missing 'content_hash:' frontmatter field`, `Add 'content_hash: <hash>' to the README.md frontmatter`);
    }
  }
  if (readmeKoExists) {
    const readmeKoFields = parseFrontmatter(readFileSync(readmeKoPath, 'utf-8'));
    if (!('translated_from_hash' in readmeKoFields)) {
      warn(variant, 'readme-frontmatter', `templates/${variant}/README_ko.md is missing 'translated_from_hash:' frontmatter field`, `Add 'translated_from_hash: <hash>' to the README_ko.md frontmatter`);
    }
  }
}

// Check 9: docs/context.md sync and broken paths
function checkContextSync(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 9: docs/context.md sync and paths in ${variant} ===`);
  const agentsMdPath = join(TEMPLATES_DIR, variant, 'AGENTS.md');
  const contextMdPath = join(TEMPLATES_DIR, variant, 'docs', `${variant}.context.md`);

  if (!existsSync(agentsMdPath) || !existsSync(contextMdPath)) {
    if (existsSync(agentsMdPath) && !existsSync(contextMdPath)) {
      warn(variant, 'context-missing', `templates/${variant}/docs/${variant}.context.md not found — variant contract declares this as Required`, `Create docs/${variant}.context.md`);
    }
    return;
  }

  const agentsMd = readFileSync(agentsMdPath, 'utf-8');
  const contextMd = readFileSync(contextMdPath, 'utf-8');

  // Check for broken paths in AGENTS.md
  if (agentsMd.includes('../common/skills/')) {
    fail(variant, 'broken-paths', `AGENTS.md contains broken '../common/skills/' paths`, `Change to 'skills/'`);
  }

  // Check for Agent Lifecycle Manager existence
  if (!agentsMd.includes('agent-lifecycle-manager/SKILL.md')) {
    fail(variant, 'missing-lifecycle-manager', `AGENTS.md is missing 'agent-lifecycle-manager' skill`);
  }

  // Find all skills in AGENTS.md
  const skillRegex = /`([a-zA-Z0-9-./_]+\/SKILL\.md)`/g;
  const expectedSkills = new Set<string>();
  for (const match of agentsMd.matchAll(skillRegex)) {
    expectedSkills.add(match[1]);
  }

  // If DYNAMIC_SKILLS markers are present, inject-skills.ts handles sync at scaffold time — skip static check
  if (contextMd.includes('<!-- DYNAMIC_SKILLS_START -->')) {
    pass(`${variant}/docs/context.md uses DYNAMIC_SKILLS injection (runtime sync via inject-skills.ts)`);
    return;
  }

  // Check if they are all in contextMd
  const missingSkills: string[] = [];
  for (const skill of expectedSkills) {
    if (!contextMd.includes(skill)) {
      missingSkills.push(skill);
    }
  }

  if (missingSkills.length > 0) {
    fail(variant, 'context-sync', `docs/context.md is missing skills defined in AGENTS.md: ${missingSkills.join(', ')}`, 'Sync the ## Skills table in docs/context.md with AGENTS.md');
  } else {
    pass(`${variant}/docs/context.md has all ${expectedSkills.size} skills from AGENTS.md`);
  }
}

// Check 10: Root vs Template Alignment (L0 vs L1 Sync)
function checkL0L1ScriptParity() {
  const L0_SCRIPTS = join(ROOT, 'scripts');
  const L1_SCRIPTS = join(ROOT, 'templates', 'common', 'scripts');

  if (!existsSync(L1_SCRIPTS) || !existsSync(L0_SCRIPTS)) return;

  // Build the parity list dynamically from scripts/SCRIPTS.md.
  // Any script whose `layer` column is exactly "common" must exist in both
  // scripts/ (workspace root) and templates/common/scripts/.
  // To add a new script to the check, register it in SCRIPTS.md with layer=common.
  const scriptsRegistryPath = join(ROOT, 'scripts', 'SCRIPTS.md');
  const commonScripts = new Set<string>();

  if (existsSync(scriptsRegistryPath)) {
    const registryContent = readFileSync(scriptsRegistryPath, 'utf-8');
    // Parse the markdown table rows between ## Registry and the next ## header.
    // Column order: script | source | version | status | removal-date | security-advisory | layer | pair
    const registrySection = registryContent.split(/^## /m).find(s => s.startsWith('Registry'));
    if (registrySection) {
      for (const line of registrySection.split('\n')) {
        // Match table data rows (start with |, not separator rows with dashes)
        const match = line.match(/^\|\s*`([^`]+)`\s*\|(?:[^|]*\|){4}[^|]*\|\s*common\s*\|/);
        if (match) {
          commonScripts.add(match[1].trim());
        }
      }
    }
  }

  // Glob-based fallback: files present in BOTH directories that are not
  // explicitly marked L0-only in SCRIPTS.md. This catches unregistered common
  // files without pulling in intentionally diverged L0-only scripts.
  const l0OnlyScripts = new Set<string>();
  if (existsSync(scriptsRegistryPath)) {
    const registryContent = readFileSync(scriptsRegistryPath, 'utf-8');
    const registrySection = registryContent.split(/^## /m).find(s => s.startsWith('Registry'));
    if (registrySection) {
      for (const line of registrySection.split('\n')) {
        const match = line.match(/^\|\s*`([^`]+)`\s*\|(?:[^|]*\|){4}[^|]*\|\s*L0-only\s*\|/);
        if (match) l0OnlyScripts.add(match[1].trim());
      }
    }
  }
  const l0Files = new Set(readdirSync(L0_SCRIPTS).filter(f => !statSync(join(L0_SCRIPTS, f)).isDirectory()));
  const l1Files = new Set(readdirSync(L1_SCRIPTS).filter(f => !statSync(join(L1_SCRIPTS, f)).isDirectory()));
  // Exclude registry/documentation files — SCRIPTS.md is intentionally a per-layer subset
  const registryFiles = new Set(['SCRIPTS.md']);
  const filesInBoth = [...l1Files].filter(f => l0Files.has(f) && !l0OnlyScripts.has(f) && !registryFiles.has(f));
  for (const f of filesInBoth) {
    commonScripts.add(f);
  }

  const normalize = (str: string) => str.replace(/\r\n/g, '\n');

  for (const script of commonScripts) {
    // Skip helper sub-paths and non-file entries that may appear in the registry
    if (script.includes('/')) continue;
    // Scripts, docs, and data files are parity-checked; other extensions are not propagated
    if (!script.endsWith('.ts') && !script.endsWith('.md') && !script.endsWith('.json')) continue;

    const l1Path = join(L1_SCRIPTS, script);
    const l0Path = join(L0_SCRIPTS, script);

    if (existsSync(l1Path) && existsSync(l0Path)) {
      let l1Content: string, l0Content: string;
      try {
        l1Content = readFileSync(l1Path, 'utf-8');
        l0Content = readFileSync(l0Path, 'utf-8');
      } catch (err) {
        warn('common', 'l0-l1-script-parity', `Failed to read ${script} in L0 or L1: ${err}`, `Check file permissions or OS file locks.`);
        continue;
      }

      // L1 files have CONSTITUTION.md refs scrubbed to context.md (comment-only for code files —
      // see propagate-to-templates.ts's scrubConstitutionRefs); normalize L0 the same way before comparison.
      const l0Normalized = scrubConstitutionRefs(normalize(l0Content), l0Path, l1Path);
      if (normalize(l1Content) !== l0Normalized) {
        fail('common', 'l0-l1-script-parity', `Script ${script} differs between L0 (root) and L1 (templates/common).`, `Backport L0 changes to L1 or update L0 to match L1.`);
      } else {
        pass(`Script ${script} is in sync between L0 and L1`);
      }
    }
  }

  // T-20260915-001 (finding H8): SCRIPTS.md registry version parity. The L1
  // registry is hand-maintained and intentionally excluded from the content
  // parity above (registryFiles), so its Version cells could go stale vs L0
  // across bump rounds — five feature scripts drifted over three consecutive
  // rounds before the manual PR #929 reconciliation, invisible to every gate.
  // For every script name registered in BOTH registries the Version cells must
  // be identical; a mismatch is an Error. Row presence differences (a name in
  // only one registry) are verify-scripts.ts's ghost/unregistered scope, not
  // parity's.
  const l1RegistryPath = join(L1_SCRIPTS, 'SCRIPTS.md');
  if (existsSync(scriptsRegistryPath) && existsSync(l1RegistryPath)) {
    let l0Rows: Map<string, ScriptsRegistryRow> | null = null;
    let l1Rows: Map<string, ScriptsRegistryRow> | null = null;
    try {
      l0Rows = parseScriptsMdRegistry(readFileSync(scriptsRegistryPath, 'utf-8'));
      l1Rows = parseScriptsMdRegistry(readFileSync(l1RegistryPath, 'utf-8'));
    } catch (err) {
      warn('common', 'l0-l1-scripts-registry-version', `Failed to read a SCRIPTS.md registry: ${err}`, `Check file permissions or OS file locks.`);
    }
    if (l0Rows && l1Rows) {
      for (const [name, l0Row] of l0Rows) {
        const l1Row = l1Rows.get(name);
        if (!l1Row) continue; // name present in only one registry — out of parity scope
        if (!l0Row.version || !l1Row.version) {
          fail('common', 'l0-l1-scripts-registry-version', `SCRIPTS.md registry row '${name}' has an empty Version cell (L0=${l0Row.version || '<empty>'}, L1=${l1Row.version || '<empty>'})`, `Set the Version cell in both SCRIPTS.md registries (the frontmatter/@version of the script is the source)`);
        } else if (l0Row.version !== l1Row.version) {
          fail('common', 'l0-l1-scripts-registry-version', `SCRIPTS.md registry version mismatch for '${name}': L0=${l0Row.version}, L1=${l1Row.version}`, `Update the templates/common/scripts/SCRIPTS.md row to ${l0Row.version} (the L1 registry is hand-maintained)`);
        } else {
          pass(`SCRIPTS.md registry version parity OK for '${name}' (${l0Row.version})`);
        }
      }
    }
  }

  // Recursively check subdirectories: helpers/, hooks/ (WARN on diff/missing), lib/ (ERROR on diff/missing)
  const subdirs = [
    { name: 'helpers', level: 'warn' as const },
    { name: 'hooks',   level: 'warn' as const },
    { name: 'lib',     level: 'error' as const },
  ];

  for (const { name: subdir, level } of subdirs) {
    const l0SubDir = join(L0_SCRIPTS, subdir);
    const l1SubDir = join(L1_SCRIPTS, subdir);

    if (!existsSync(l0SubDir)) continue; // subdir doesn't exist in L0 — skip

    const l0SubFiles = readdirSync(l0SubDir)
      .filter(f => f.endsWith('.ts') && !statSync(join(l0SubDir, f)).isDirectory());

    for (const file of l0SubFiles) {
      const l0FilePath = join(l0SubDir, file);
      const l1FilePath = join(l1SubDir, file);

      if (!existsSync(l1SubDir) || !existsSync(l1FilePath)) {
        // File exists in L0 subdir but not in L1 subdir
        // If the script is classified L0-only, absence from L1 is correct — skip
        if (!includeScriptInL1(file)) continue;
        const msg = `scripts/${subdir}/${file} exists in L0 but is missing from templates/common/scripts/${subdir}/`;
        const fix = `Copy scripts/${subdir}/${file} to templates/common/scripts/${subdir}/${file}`;
        if (level === 'error') {
          fail('common', 'l0-l1-subdir-parity', msg, fix);
        } else {
          warn('common', 'l0-l1-subdir-parity', msg, fix);
        }
        continue;
      }

      let l0Content: string, l1Content: string;
      try {
        l0Content = readFileSync(l0FilePath, 'utf-8');
        l1Content = readFileSync(l1FilePath, 'utf-8');
      } catch (err) {
        warn('common', 'l0-l1-subdir-parity', `Failed to read scripts/${subdir}/${file} in L0 or L1: ${err}`, `Check file permissions or OS file locks.`);
        continue;
      }

      // L1 files have CONSTITUTION.md refs scrubbed to context.md (comment-only for code files —
      // see propagate-to-templates.ts's scrubConstitutionRefs); normalize L0 the same way before comparison.
      const l0Normalized = scrubConstitutionRefs(normalize(l0Content), l0FilePath, l1FilePath);
      if (l0Normalized !== normalize(l1Content)) {
        const msg = `scripts/${subdir}/${file} content differs between L0 (root) and L1 (templates/common/scripts/${subdir}/).`;
        const fix = `Backport L0 changes to templates/common/scripts/${subdir}/${file} or update L0 to match L1.`;
        if (level === 'error') {
          fail('common', 'l0-l1-subdir-parity', msg, fix);
        } else {
          warn('common', 'l0-l1-subdir-parity', msg, fix);
        }
      } else {
        pass(`Script ${subdir}/${file} is in sync between L0 and L1`);
      }
    }
  }
}

// Check P-01: Platform Documentation Parity and Template Sync
function checkPlatformDocumentationParity(): void {
  if (!JSON_MODE) console.log('\n=== Check P-01: Platform Documentation Parity ===');
  
  const claudePath = join(ROOT, 'CLAUDE.md');
  const geminiPath = join(ROOT, 'GEMINI.md');
  
  if (!existsSync(claudePath) || !existsSync(geminiPath)) return;
  
  const extractSections = (content: string) => {
    const matches = content.matchAll(/^#{2,4} (.+)$/gm);
    return new Set(Array.from(matches).map(m => m[1].trim().replace(/^\d+\.\s*/, '')));
  };
  
  const claudeSections = extractSections(readFileSync(claudePath, 'utf-8'));
  const geminiSections = extractSections(readFileSync(geminiPath, 'utf-8'));
  
  // Parity between root CLAUDE.md and root GEMINI.md
  const ignoreParity = [
    'Claude Code-Specific Behaviors', 
    'Project-Specific Gemini Settings', 
    'Tool Name Mapping & Safeguards', 
    'Native Antigravity 2.0 Features', 
    'Git & PR Additions (Claude Code)',
    'Git & PR Additions (Gemini)',
    'Gemini-Specific & Antigravity Workflows',
    'Active Antigravity Tool Suite Mapping & Safeguards',
    'Planning Mode & Artifact Specifications',
    'Subagent Instantiation & Async Orchestration',
    'Automated Hooks',
    'Native Slash Commands',
    'MCP Configurations & Absolute Resolving',
    'Native Sub-agents',
    'Native Plan Mode',
    'Task Tracking',
    'Custom Command Error Recovery',
    'Windows Platform Requirement',
    'Language Policy for Documentation',
    'Agent Dispatch Rules',
    'Lifecycle Management Rules',
    'Security & Hook Configuration',
    'Git Commit Policy',
    'Executing Project Commands',
    'Pre-PR Security Gate',
    'Model Selection Override',
    'Security Engagement Rules',
    'Surgical Multi-Replace Offset Safeguard',
    'Windows Terminal & Code Page Safeguard',
    'Grep Search 50-Match Cap Safeguard',
    'implementation_plan.md',
    'task.md',
    'walkthrough.md',
    'Define Subagent',
    'Invoke Subagent',
    'Communication',
    'Phase 4 Execution Loop',
    'Mandatory Execution Plan Display',
    'Specialist Agent List',
    'Superpowers Plugin & Cost Optimization',
    'Agent Teams (Experimental)',
    'Agent Teams vs. Antigravity Agent Manager',
    'Antigravity Agent Manager',
    'Antigravity Parallel Agent Workflow',
    'GEMINI.md Equivalent Settings',
    'Antigravity-Specific Dispatch',
    'Skill Resolution Priority',
    'Claude Code-Specific Dispatch',
    'Workspace & Template Boundary Policy'
  ];
  
  const isIgnored = (s: string) => ignoreParity.some(ignore => s.includes(ignore));
  
  const missingInClaude = [...geminiSections].filter(s => !claudeSections.has(s) && !isIgnored(s));
  const missingInGemini = [...claudeSections].filter(s => !geminiSections.has(s) && !isIgnored(s));
  
  if (missingInClaude.length > 0) {
    fail('root', 'platform-parity', `CLAUDE.md is missing sections present in GEMINI.md: ${missingInClaude.join(', ')}`);
  }
  if (missingInGemini.length > 0) {
    fail('root', 'platform-parity', `GEMINI.md is missing sections present in CLAUDE.md: ${missingInGemini.join(', ')}`);
  }
  if (missingInClaude.length === 0 && missingInGemini.length === 0) {
    pass('Platform parity: CLAUDE.md and GEMINI.md section parity OK');
  }
  
  // Sync check: Root vs Templates
  const templatesDir = readdirSync(TEMPLATES_DIR);
  for (const tpl of templatesDir) {
    if (tpl === 'common' || tpl.startsWith('.')) continue;
    if (isTransientTestFixture(tpl)) continue; // E2E staging dirs (T-20260916-001)
    if (tpl.startsWith('co-') && !isCoVariantTracked(tpl)) continue;
    const tplPath = join(TEMPLATES_DIR, tpl);
    if (!statSync(tplPath).isDirectory()) continue;
    
    for (const doc of ['CLAUDE.md', 'GEMINI.md']) {
      const rootDoc = join(ROOT, doc);
      const variantDoc = join(tplPath, doc);
      if (!existsSync(rootDoc) || !existsSync(variantDoc)) continue;
      
      const rootSecs = extractSections(readFileSync(rootDoc, 'utf-8'));
      const variantSecs = extractSections(readFileSync(variantDoc, 'utf-8'));
      
      const missingInVariant = [...rootSecs].filter(s => !variantSecs.has(s) && !isIgnored(s));
      
      if (missingInVariant.length > 0) {
        fail(tpl, 'template-sync', `templates/${tpl}/${doc} is missing sections from root ${doc}: ${missingInVariant.join(', ')}`);
      }
    }
  }

  // P-01b: Variant CLAUDE.md <-> GEMINI.md Specialist Agent List content parity
  if (!JSON_MODE) console.log('\n=== Check P-01b: Variant Specialist Agent List Parity ===');
  const extractAgentList = (content: string): string => {
    const match = content.match(/####\s*Specialist Agent List[\s\S]*?(?=\n###|\n##|\n---|\Z)/);
    return match ? match[0].trim() : '';
  };
  for (const tpl of templatesDir) {
    if (tpl === 'common' || tpl.startsWith('.')) continue;
    const tplPath = join(TEMPLATES_DIR, tpl);
    if (!statSync(tplPath).isDirectory()) continue;
    const claudeVariant = join(tplPath, 'CLAUDE.md');
    const geminiVariant = join(tplPath, 'GEMINI.md');
    if (!existsSync(claudeVariant) || !existsSync(geminiVariant)) continue;
    const claudeList = extractAgentList(readFileSync(claudeVariant, 'utf-8'));
    const geminiList = extractAgentList(readFileSync(geminiVariant, 'utf-8'));
    if (claudeList && geminiList && claudeList !== geminiList) {
      fail(tpl, 'agent-list-parity', `templates/${tpl}/CLAUDE.md and GEMINI.md have different Specialist Agent List content`, 'Apply identical §5 changes to both files');
    } else if (claudeList || geminiList) {
      pass(`${tpl}: Specialist Agent List parity OK`);
    }

    // P-01b codex leg (spec site 3g): when a variant carries CODEX.md, its
    // Specialist Agent List must match too. existsSync-guarded — no variant
    // carries CODEX.md today (no-op), future-proof when one does.
    // Net-new coverage soaking in WARN — TODO(promotion): flip to fail.
    const codexVariant = join(tplPath, 'CODEX.md');
    if (claudeList && existsSync(codexVariant)) {
      const codexList = extractAgentList(readFileSync(codexVariant, 'utf-8'));
      if (codexList && codexList !== claudeList) {
        warn(tpl, 'agent-list-parity', `templates/${tpl}/CODEX.md has different Specialist Agent List content from CLAUDE.md (soak: WARN until promotion)`, 'Apply identical §5 changes to CLAUDE.md and CODEX.md');
      } else if (codexList) {
        pass(`${tpl}: Specialist Agent List parity OK (CODEX.md)`);
      }
    }
  }
}

// Check P-02: Root .claude/commands/ and .gemini/commands/ must be mirrored in templates/common/
// Exception: new-project.md has gemini-parity: skip, so it only needs to be in .claude/commands/
function checkRootCommonCommandsParity(): void {
  if (!JSON_MODE) console.log('\n=== Check P-02: Root ↔ Common Commands Parity ===');

  const pairs = [
    {
      rootDir: join(ROOT, '.claude', 'commands'),
      commonDir: join(TEMPLATES_DIR, 'common', '.claude', 'commands'),
      label: '.claude/commands',
    },
    {
      rootDir: join(ROOT, '.gemini', 'commands'),
      commonDir: join(TEMPLATES_DIR, 'common', '.gemini', 'commands'),
      label: '.gemini/commands',
    },
  ];

  for (const { rootDir, commonDir, label } of pairs) {
    if (!existsSync(rootDir)) continue;
    const rootFiles = readdirSync(rootDir).filter(f => f.endsWith('.md'));
    const commonFiles = existsSync(commonDir)
      ? new Set(readdirSync(commonDir).filter(f => f.endsWith('.md')))
      : new Set<string>();

    // Special case: new-project.md has gemini-parity: skip
    // It should exist in .claude/commands/ but NOT in .gemini/commands/
    const workspaceOnlyCmd = 'new-project.md';
    const isGemini = label.includes('.gemini');

    // Filter out the workspace-only command when checking parity
    // new-project.md is workspace-only and should NOT be in common/
    const filesToCheck = rootFiles.filter(f => f !== workspaceOnlyCmd);

    const missing = filesToCheck.filter(f => !commonFiles.has(f));
    if (missing.length > 0) {
      fail('root', 'command-parity',
        `Root ${label}/ has files not mirrored in templates/common/${label}/: ${missing.join(', ')}`,
        `Copy missing files to templates/common/${label}/`
      );
    } else {
      // Verify that new-project.md is NOT in .gemini/commands/
      if (isGemini && rootFiles.includes(workspaceOnlyCmd)) {
        fail('root', 'command-parity',
          `Root ${label}/ contains ${workspaceOnlyCmd} but it has gemini-parity: skip — remove from ${label}`,
          `Remove ${workspaceOnlyCmd} from ${label} (it should only exist in .claude/commands/)`
        );
      } else {
        pass(`Root ↔ common ${label} parity OK (${rootFiles.length} file(s))`);
      }
    }
  }
}

// Recursively collect skill directories under a skills/ root, returning paths
// relative to skillsDir (e.g. "change-control" for a flat layout, or
// "domains/industry/gmp/change-control" for a nested layout like co-safety's).
// A directory is a "skill" the moment it contains a direct SKILL.md; category
// directories (daily/, domains/, investigation/, emergency/, _meta/, etc.)
// have no SKILL.md of their own and are walked into instead of flagged.
function collectSkillDirs(dir: string, skillsDir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '_archive' || entry === 'local' || entry === 'external' || entry.startsWith('_')) continue;
    const fullPath = join(dir, entry);
    if (!statSync(fullPath).isDirectory()) continue;
    if (existsSync(join(fullPath, 'SKILL.md'))) {
      results.push(fullPath.slice(skillsDir.length + 1).replace(/\\/g, '/'));
    } else {
      results.push(...collectSkillDirs(fullPath, skillsDir));
    }
  }
  return results;
}

// Check B-09: Per-variant skill lifecycle (presence-driven)
function checkVariantSkills(variant: string): void {
  const skillsDir = join(TEMPLATES_DIR, variant, 'skills');
  if (!existsSync(skillsDir)) {
    pass(`${variant}/skills/: not present (OK — skill lifecycle check not applicable)`);
    return;
  }

  if (!JSON_MODE) console.log(`\n=== Check B-09: Skill lifecycle in ${variant} ===`);

  const dirs = collectSkillDirs(skillsDir, skillsDir);

  if (dirs.length === 0) {
    warn(variant, 'skill-lifecycle', `${variant}/skills/ exists but contains no skill directories`);
    return;
  }

  let missingSkillMd = 0;
  let deprecatedCount = 0;
  for (const skillName of dirs) {
    const skillMd = join(skillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillMd)) {
      fail(variant, 'skill-lifecycle', `${variant}/skills/${skillName}/SKILL.md missing`, `Create SKILL.md with required frontmatter`);
      missingSkillMd++;
      continue;
    }
    const content = readFileSync(skillMd, 'utf-8');
    const fields = parseFrontmatter(content);
    if (!('name' in fields) || !('description' in fields)) {
      fail(variant, 'skill-lifecycle', `${variant}/skills/${skillName}/SKILL.md missing required frontmatter (name, description)`);
    }
    // Scope field required (CONSTITUTION §6.2)
    if (!('scope' in fields)) {
      fail(variant, 'skill-lifecycle', `${variant}/skills/${skillName}/SKILL.md missing required frontmatter (scope)`, `Add 'scope: ${variant}' (variant-exclusive) or 'scope: common'`);
    }
    // Version must be full semver X.Y.Z (2-part versions break tooling that compares versions)
    const verLine = content.split('\n').find(l => l.startsWith('version:'));
    const verVal = verLine ? verLine.slice(verLine.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '') : '';
    if (verVal && !/^\d+\.\d+\.\d+$/.test(verVal)) {
      fail(variant, 'skill-lifecycle', `${variant}/skills/${skillName}/SKILL.md version is not semver: '${verVal}'`, `Use X.Y.Z (e.g. 'version: 1.0.0')`);
    }
    // Per-skill README.md/README_ko.md requirement retired 2026-08-29 (DEC-20260829-01):
    // SKILL.md is the authoritative, machine-consumed definition; per-skill READMEs
    // were seeded boilerplate and are no longer gated.
    if ('status' in fields) {
      const statusLine = content.split('\n').find(l => l.startsWith('status:'));
      const statusVal = statusLine ? statusLine.slice(statusLine.indexOf(':') + 1).trim() : '';
      if (statusVal === 'deprecated') deprecatedCount++;
    }
  }

  if (missingSkillMd === 0) {
    if (deprecatedCount > 0) {
      warn(variant, 'skill-lifecycle', `${variant}/skills/: ${deprecatedCount} deprecated skill(s) — remove before stable promotion`);
    } else {
      pass(`${variant}/skills/: ${dirs.length} skill(s) OK, no deprecated`);
    }
  }
}

// Check B-10: scripts/<variant>/ layout convention (optional-to-have, mandatory-to-be-correct).
// A variant template MAY carry variant-specific scripts under scripts/<variant>/; when present:
//   - the subfolder must be named after the template's own variant (no foreign-variant or
//     generic nested script folders),
//   - no nested scripts/ recursion (scripts/<variant>/scripts/…),
//   - every .ts inside carries an @version header and is registered in the variant's
//     scripts/SCRIPTS.md registry when that registry exists.
// Adopted 2026-08-28 (docs/designs/2026-08-28-skill-hygiene-and-conventions-design.md).
function checkVariantScriptsLayout(variant: string): void {
  const variantScriptsDir = join(TEMPLATES_DIR, variant, 'scripts', variant);
  if (!existsSync(variantScriptsDir)) {
    pass(`${variant}/scripts/${variant}/: not present (OK — layout convention optional)`);
    return;
  }
  if (!JSON_MODE) console.log(`\n=== Check B-10: scripts/${variant}/ layout in ${variant} ===`);
  let layoutErrors = 0;
  // 1. No foreign-variant or generic nested script folders next to scripts/<variant>/
  const scriptsRoot = join(TEMPLATES_DIR, variant, 'scripts');
  for (const e of readdirSync(scriptsRoot, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === variant || e.name === 'helpers' || e.name === 'hooks' || e.name === 'lib' || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    if (existsSync(join(scriptsRoot, e.name, 'scripts'))) {
      fail(variant, 'scripts-layout', `${variant}/scripts/${e.name}/ contains a nested scripts/ directory — recursion forbidden`);
      layoutErrors++;
    } else if (/^co-/.test(e.name)) {
      fail(variant, 'scripts-layout', `${variant}/scripts/${e.name}/ is a foreign-variant script folder`, `Move to templates/${e.name}/scripts/${e.name}/ or delete`);
      layoutErrors++;
    }
  }
  // 2. No recursion inside scripts/<variant>/
  if (existsSync(join(variantScriptsDir, 'scripts'))) {
    fail(variant, 'scripts-layout', `${variant}/scripts/${variant}/scripts/ nested recursion forbidden`);
    layoutErrors++;
  }
  // 3. Registry coverage (when the variant ships its own SCRIPTS.md next to the folder)
  const regPath = join(variantScriptsDir, 'SCRIPTS.md');
  if (existsSync(regPath)) {
    const regContent = readFileSync(regPath, 'utf-8');
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.ts')) continue;
        const rel = p.slice(variantScriptsDir.length + 1).replace(/\\/g, '/');
        if (!regContent.includes(`\`${rel}\``) && !regContent.includes(`\`${e.name}\``)) {
          fail(variant, 'scripts-layout', `${variant}/scripts/${variant}/${rel} not registered in scripts/${variant}/SCRIPTS.md`);
          layoutErrors++;
        }
      }
    };
    walk(variantScriptsDir);
  }
  if (layoutErrors === 0) {
    pass(`${variant}/scripts/${variant}/: layout convention OK`);
  }
}

// Check B-11: variant_scoped_skills must not leak into templates/common/skills/
// (registry: docs/workspace-schema.json variant_scoped_skills — see the sound-synth
// leak of 2026-08-06 that reached 10 of 11 projects via common-promotion + upgrade).
function checkVariantScopedSkillLeak(): void {
  if (!JSON_MODE) console.log(`\n=== Check B-11: variant-scoped skills must not live in templates/common ===`);
  const schemaPath = join(ROOT, 'docs', 'workspace-schema.json');
  if (!existsSync(schemaPath)) {
    warn('root', 'B-11', 'docs/workspace-schema.json not found — variant_scoped_skills check skipped');
    return;
  }
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const map = schema?.variant_scoped_skills || {};
  let leaks = 0;
  for (const [ownerVariant, skills] of Object.entries(map as Record<string, string[]>)) {
    if (ownerVariant === 'description' || !Array.isArray(skills)) continue;
    for (const skill of skills as string[]) {
      const leaked = join(TEMPLATES_DIR, 'common', 'skills', skill, 'SKILL.md');
      if (existsSync(leaked)) {
        fail('root', 'B-11', `variant-exclusive skill '${skill}' (owner: ${ownerVariant}) exists in templates/common/skills/`, `Delete templates/common/skills/${skill}/ — it would be copied into every project by upgrade-project`);
        leaks++;
      }
    }
  }
  if (leaks === 0) pass('templates/common/skills/: no variant-scoped skill leaks');
}

// Check: platform-mirror-freshness — L1 platform skill mirrors must carry the
// SSOT version (T-20260916-008). upgrade-project sat at 1.4.1 in the
// claude/gemini/agents mirrors while skills/ moved to 1.5.0 because the
// propagator skipped workspace-scoped skills for exactly three of the four
// platform domains. With all four domains propagating uniformly (the T-008
// fix) this arm fails if any mirror copy of an SSOT skill ever diverges again.
function checkPlatformMirrorFreshness(): void {
  if (!JSON_MODE) console.log('\n=== Check platform-mirror-freshness: L1 platform skill mirrors carry SSOT versions ===');
  const ssotSkillsDir = join(ROOT, 'skills');
  const commonDir = join(TEMPLATES_DIR, 'common');
  if (!existsSync(ssotSkillsDir) || !existsSync(commonDir)) {
    if (!JSON_MODE) pass('platform-mirror-freshness: skills/ or templates/common/ missing — nothing to compare');
    return;
  }
  const drift = collectMirrorFreshnessDrift({ ssotSkillsDir, commonDir, mirrorDirs: PLATFORM_MIRROR_DIRS });
  if (drift.length === 0) {
    pass('platform-mirror-freshness: all four platform skill mirrors carry SSOT versions');
    return;
  }
  for (const d of drift) {
    fail(
      'common',
      'platform-mirror-freshness',
      `templates/common/${d.mirror}/${d.skill}/SKILL.md version ${d.mirrorVersion} != skills/${d.skill} SSOT version ${d.ssotVersion}`,
      `Re-run propagate-to-templates.ts --apply (domain mirror for ${d.mirror}); if it stays stale, check the propagator's platform-skills domain handling`
    );
  }
}

// Check: variant-mirror-parity — a variant template's four platform skill mirrors
// should carry exactly (variant skills/ minus mirror:false|security-gate skills) ∪
// (common skills/ minus flagged skills). T-20260921-009, review H-3. Two failure
// classes, both WARN (heal = delete the stray directory; sync-skills never prunes):
//   1. stale mirror entry — a mirrored skill that is absent from both trees, or
//      whose owning tree flags it mirror:false / security-gate:true (it must never
//      be mirrored; the pre-flag .claude/.gemini copies of co-safety's 52
//      agent-dispatched skills are the live example)
//   2. unmirrored variant skill — a variant skill WITHOUT the flags missing from a
//      mirror (four-mirror parity, ADR-0077 W1)
function checkVariantMirrorParity(): void {
  if (!JSON_MODE) console.log('\n=== Check variant-mirror-parity: variant platform skill mirrors carry exactly the mirrorable set ===');
  const variantsDir = TEMPLATES_DIR;
  const neverMirror = (skillMd: string): boolean => {
    try {
      const content = readFileSync(skillMd, 'utf-8');
      return /^mirror:\s*false\b/m.test(content) || /^security-gate:\s*true\b/m.test(content);
    } catch {
      return false; // unreadable — treat as mirrorable rather than guess
    }
  };
  const listSkillDirs = (dir: string): Set<string> =>
    new Set(
      existsSync(dir)
        ? readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md'))).map(e => e.name)
        : [],
    );
  let checked = 0;
  let warnings = 0;
  let errors = 0;
  if (!existsSync(variantsDir)) return;

  // T-20260924-004 pre-pass: fleet-wide mirror census for peer counting —
  // which variants' platform mirrors carry each skill.
  const mirrorCarriers = new Map<string, Set<string>>();
  const readFmVersion = (skillMd: string): string | null => {
    try {
      const fm = readFileSync(skillMd, 'utf-8').match(/^---\n([\s\S]*?)\n---/);
      if (!fm) return null;
      const v = fm[1].match(/^version:\s*["']?(\d+\.\d+\.\d+)/m);
      return v ? v[1] : null;
    } catch {
      return null;
    }
  };
  const commonSkillVersions = new Map<string, string>();
  for (const name of listSkillDirs(join(TEMPLATES_DIR, 'common', 'skills'))) {
    const v = readFmVersion(join(TEMPLATES_DIR, 'common', 'skills', name, 'SKILL.md'));
    if (v !== null) commonSkillVersions.set(name, v);
  }
  for (const entry of readdirSync(variantsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('co-')) continue;
    for (const mirror of PLATFORM_MIRROR_DIRS) {
      for (const name of listSkillDirs(join(variantsDir, entry.name, mirror))) {
        if (!mirrorCarriers.has(name)) mirrorCarriers.set(name, new Set());
        mirrorCarriers.get(name)!.add(entry.name);
      }
    }
  }
  const semverOlder = (a: string, b: string): boolean => {
    const pa = a.split('.').map(Number); const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d !== 0) return d < 0; }
    return false;
  };

  for (const entry of readdirSync(variantsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('co-')) continue;
    const vdir = join(variantsDir, entry.name);
    const vSkills = join(vdir, 'skills');
    if (!existsSync(vSkills)) continue;
    checked++;
    const variantSkills = listSkillDirs(vSkills);
    const commonSkills = listSkillDirs(join(TEMPLATES_DIR, 'common', 'skills'));
    for (const mirror of PLATFORM_MIRROR_DIRS) {
      const mirrorDir = join(vdir, mirror);
      for (const name of listSkillDirs(mirrorDir)) {
        const inVariant = variantSkills.has(name);
        const inCommon = commonSkills.has(name);
        const flagged = (inVariant && neverMirror(join(vSkills, name, 'SKILL.md')))
          || (!inVariant && inCommon && neverMirror(join(TEMPLATES_DIR, 'common', 'skills', name, 'SKILL.md')));
        if ((inVariant || inCommon) && !flagged) {
          // T-20260924-004: stale variant platform-mirror copy of a COMMON
          // skill without variant declaration/SSOT and with no peer carrying
          // it — the D1/D2 drift class must not regrow silently.
          if (!inVariant && inCommon) {
            const mirrorVersion = readFmVersion(join(mirrorDir, name, 'SKILL.md'));
            const commonVersion = commonSkillVersions.get(name) ?? null;
            const peerCount = (mirrorCarriers.get(name)?.size ?? 1) - 1;
            console.log(`TRACE mirror-check: ${entry.name}/${mirror}/${name} inV=${inVariant} inC=${inCommon} flag=${flagged} mv=${mirrorVersion} cv=${commonVersion} peers=${peerCount}`);
            const verdict = classifyVariantMirrorCopy({
              inVariant, inCommon, flagged,
              mirrorVersion, commonVersion, peerCount,
            });
            console.log(`TRACE verdict: ${verdict}`);
            if (verdict === 'fail-stale-orphan') {
              fail(entry.name, 'variant-mirror-parity',
                `${mirror}/${name}/ is a stale platform-mirror copy of common skill "${name}" (mirror v${mirrorVersion} vs common v${commonVersion}) with no variant declaration, no skills/ SSOT copy, and no peer carrying it — regrown D1/D2-class drift`,
                `Delete templates/${entry.name}/${mirror}/${name}/ (stale copy of common v${commonVersion}) or declare the variant-specific copy in variant.json`);
              errors++;
              continue;
            }
          }
          continue;
        }
        warn(entry.name, 'variant-mirror-parity',
          `${mirror}/${name}/ must not be mirrored — ${flagged ? 'the owning skill is flagged mirror:false/security-gate:true' : 'absent from both the variant and the common skills/ tree'}`,
          `Delete templates/${entry.name}/${mirror}/${name}/ (sync-skills never prunes; it will not be resurrected while the flag stands)`);
        warnings++;
      }
      for (const name of variantSkills) {
        if (variantSkills.has(name) && neverMirror(join(vSkills, name, 'SKILL.md'))) continue;
        if (!existsSync(join(vdir, mirror, name, 'SKILL.md'))) {
          warn(entry.name, 'variant-mirror-parity', `${mirror}/${name}/ missing — mirrorable variant skill not mirrored to ${mirror}`,
            `Run bun scripts/sync-skills.ts --all-variants (or --dir templates/${entry.name}) to heal`);
          warnings++;
        }
      }
    }
  }
  if (!JSON_MODE) {
    if (checked === 0) console.log('  (no variant templates with a skills/ tree found)');
    else if (warnings === 0) console.log(`  ✓ ${checked} variant template(s): platform mirrors carry exactly the mirrorable set`);
  }
}

// T-20260924-004: classify a variant platform-mirror copy of a skill against
// its owning trees — pure decision core for checkVariantMirrorParity so the
// stale-orphan arm is unit-testable (positive fixture must FAIL, clean
// fixture must PASS; the convention from the 09-22 detector review).
export type VariantMirrorCopyVerdict = 'ok' | 'warn-undeclared' | 'fail-stale-orphan';
export function classifyVariantMirrorCopy(opts: {
  inVariant: boolean;
  inCommon: boolean;
  flagged: boolean;
  mirrorVersion: string | null;
  commonVersion: string | null;
  peerCount: number; // other variants whose mirrors carry the same skill
}): VariantMirrorCopyVerdict {
  const { inVariant, inCommon, flagged } = opts;
  // Owning-tree flagged skills must not be mirrored.
  if (flagged) return 'warn-undeclared';
  // T-20260924-004: stale variant platform-mirror copy of a COMMON skill —
  // older than the common SSOT, absent from the variant skills/ tree, not
  // declared in variant.json, and carried by no peer variant → regrown
  // D1/D2-class drift. Fail so it cannot regrow silently.
  if (!inVariant && inCommon
      && opts.mirrorVersion !== null && opts.commonVersion !== null
      && opts.mirrorVersion !== opts.commonVersion
      && opts.peerCount === 0) {
    return 'fail-stale-orphan';
  }
  // Same-version undecorated copies (uniform baseline set) or peer-shared
  // mirrors stay at the pre-existing WARN level; variant skills mirrored to
  // their own platform dirs are correct.
  return 'ok';
}

// Check: roster-tier-consistency (T-20260921-020, validator-hardening) — an
// AGENTS.md roster row's Tier cell must match the referenced agent's effective
// frontmatter tier (resolving the extends chain: variant stub → common → root;
// scalar `tier:` or per-platform map, `claude` value), and must not ELEVATE
// above the L0 baseline tier for agents that exist at the root (AGENTS.md §3.5
// Tier Ceiling Rule) unless the variant agent frontmatter declares
// `tier_ceiling_exempt: <reason>`. Live instance: PM was downgraded to Medium
// at the root on 2026-09-15 but all 13 variant rosters kept High until
// 2026-09-21 — hand-maintained rosters drift silently, so the machine owns it now.
const TIER_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

function readFrontmatterTier(fmPath: string): string | null {
  if (!existsSync(fmPath)) return null;
  let fm: string;
  try {
    const m = readFileSync(fmPath, 'utf-8').match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    fm = m[1];
  } catch {
    return null;
  }
  const scalar = fm.match(/^tier:\s*(\S+)\s*$/m);
  if (scalar) return scalar[1].toLowerCase();
  const map = fm.match(/^tier:\s*$[\s\S]*?^\s{2}claude:\s*(\S+)/m);
  return map ? map[1].toLowerCase() : null;
}

function resolveTierViaExtends(fmPath: string, depth = 0): string | null {
  if (depth > 3 || !existsSync(fmPath)) return null;
  const direct = readFrontmatterTier(fmPath);
  if (direct) return direct;
  let content: string;
  try {
    content = readFileSync(fmPath, 'utf-8');
  } catch {
    return null;
  }
  const ext = content.match(/^extends:\s*(\S+)\s*$/m);
  if (!ext) return null;
  return resolveTierViaExtends(join(dirname(fmPath), ext[1]), depth + 1);
}

function rosterTierRows(agentsMd: string): Array<{ name: string; tier: string; line: number }> {
  const out: Array<{ name: string; tier: string; line: number }> = [];
  let lines: string[] = [];
  try {
    lines = readFileSync(agentsMd, 'utf-8').split('\n');
  } catch {
    return out;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|') || !line.includes('agents/')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    for (let j = 0; j < cells.length; j++) {
      const m = cells[j].match(/agents\/([A-Za-z0-9_-]+)\.md/);
      if (!m) continue;
      const next = (cells[j + 1] ?? '').replace(/\*\*/g, '').trim().toLowerCase();
      if (/^(high|medium|low)$/.test(next)) out.push({ name: m[1], tier: next, line: i + 1 });
      break; // the first agent-file cell in the row owns the tier cell
    }
  }
  return out;
}

function checkRosterTierConsistency(): void {
  if (!JSON_MODE) console.log('\n=== Check roster-tier-consistency: AGENTS.md roster tiers match resolved agent frontmatter tiers ===');
  let checked = 0;

  // 1. Workspace root self-check (AGENTS.md vs agents/*.md frontmatter)
  for (const row of rosterTierRows(join(ROOT, 'AGENTS.md'))) {
    const resolved = resolveTierViaExtends(join(ROOT, 'agents', `${row.name}.md`));
    if (resolved && resolved !== row.tier) {
      fail('common', 'roster-tier-consistency',
        `AGENTS.md roster row for agents/${row.name}.md says ${row.tier} but agents/${row.name}.md frontmatter resolves to ${resolved}`,
        'Update the roster row or the agent frontmatter — hand-maintained rosters drift silently (PM 2026-09-15 instance)');
    }
    checked++;
  }

  // 2. Variant templates: roster tier vs extends-chain resolution + L0 tier ceiling
  if (!existsSync(TEMPLATES_DIR)) return;
  for (const entry of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('co-')) continue;
    const vdir = join(TEMPLATES_DIR, entry.name);
    const agentsMd = join(vdir, 'AGENTS.md');
    if (!existsSync(agentsMd)) continue;
    for (const row of rosterTierRows(agentsMd)) {
      checked++;
      let resolved = resolveTierViaExtends(join(vdir, 'agents', `${row.name}.md`))
        ?? resolveTierViaExtends(join(TEMPLATES_DIR, 'common', 'agents', `${row.name}.md`))
        ?? resolveTierViaExtends(join(ROOT, 'agents', `${row.name}.md`));
      if (resolved && resolved !== row.tier) {
        fail(entry.name, 'roster-tier-consistency',
          `AGENTS.md:${row.line} roster row for agents/${row.name}.md says ${row.tier} but the agent resolves to ${resolved} via the extends chain`,
          `Update the roster row (or the agent frontmatter) — every scaffold inherits this table`);
      }
      const baseline = resolveTierViaExtends(join(ROOT, 'agents', `${row.name}.md`));
      if (baseline && resolved && TIER_RANK[resolved] > TIER_RANK[baseline]) {
        const vAgent = join(vdir, 'agents', `${row.name}.md`);
        const exempt = existsSync(vAgent) && /^tier_ceiling_exempt:\s*\S/m.test(readFileSync(vAgent, 'utf-8'));
        if (!exempt) {
          fail(entry.name, 'roster-tier-consistency',
            `agents/${row.name}.md resolves to ${resolved}, above the L0 baseline ${baseline} (AGENTS.md §3.5 Tier Ceiling Rule)`,
            `Lower the tier to the L0 baseline, or declare \`tier_ceiling_exempt: <reason>\` in the variant agent frontmatter`);
        }
      }
    }
  }
  if (!JSON_MODE && checked > 0) console.log(`  ✓ ${checked} roster row(s) checked`);
}

// Check B-12: L0/L1 style neutrality — variant-owned design identity literals
// (palette hex/rgb()/hsl() colors, typeface names harvested from variant
// tokens.json files) must not appear in L0 governance text or L1 normative
// docs. Encodes the ADR-0064 "Foundation ≠ Design System" doctrine and the
// ADR-0066 prohibition on hard-coding project styles into L0/L1 as a
// machine check. Inline escape hatch: `<!-- neutrality-exempt: <reason> -->`
// on the offending line (e.g. quoting a variant value inside a NON-normative
// reference note).
function checkStyleNeutrality() {
  if (!JSON_MODE) console.log(`\n=== Check B-12: L0/L1 style neutrality (variant identity literals) ===`);
  const TEMPLATES_DIR = join(ROOT, 'templates');
  const GENERIC_FONT_TOKENS = new Set([
    'system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
    'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
  ]);

  // 1. Harvest variant-owned identity literals from every variant tokens.json.
  const identity = new Map<string, string>(); // literal -> owning variant
  const variantsDir = join(TEMPLATES_DIR);
  if (existsSync(variantsDir)) {
    for (const entry of readdirSync(variantsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('co-')) continue;
      const tokensPath = join(variantsDir, entry.name, 'tokens.json');
      if (!existsSync(tokensPath)) continue;
      let tokens: unknown;
      try {
        tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'));
      } catch {
        continue; // invalid JSON is another check's problem
      }
      const addLiteral = (raw: string) => {
        const literal = raw.trim();
        if (literal.length < 3) return;
        if (!identity.has(literal)) identity.set(literal, entry.name);
      };
      const walk = (node: unknown) => {
        if (typeof node === 'string') {
          for (const m of node.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) addLiteral(m[0].toLowerCase());
          for (const m of node.matchAll(/\b(?:rgba?|hsla?)\([^)]*\)/g)) addLiteral(m[0].replace(/\s+/g, ' '));
          // typeface identity: first family of a comma-separated font stack
          // (single-word values like "monospace" are generic; require a stack or
          // a Capitalized name to avoid harvesting arbitrary strings)
          const first = node.split(',')[0].trim().replace(/^["']|["']$/g, '');
          const isStack = node.includes(',');
          const isCapitalizedName = /^[A-Z]/.test(first) && first.split(' ').length <= 3;
          if (isStack || isCapitalizedName) {
            if (!GENERIC_FONT_TOKENS.has(first.toLowerCase())) addLiteral(first);
          }
        } else if (Array.isArray(node)) {
          node.forEach(walk);
        } else if (typeof node === 'object' && node !== null) {
          for (const val of Object.values(node as Record<string, unknown>)) walk(val);
        }
      };
      walk(tokens);
    }
  }

  if (identity.size === 0) {
    pass('L0/L1 style neutrality: no variant tokens.json found — nothing to cross-check');
    return;
  }

  // 2. Normative L0 governance text + L1 normative docs.
  const normativeFiles: string[] = [
    'CONSTITUTION.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md',
  ];
  for (const dir of [join(ROOT, 'docs', 'constitution'), join(ROOT, 'docs', 'governance')]) {
    if (existsSync(dir)) {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        if (f.isFile() && f.name.endsWith('.md')) normativeFiles.push(join(dir, f.name));
      }
    }
  }
  const commonDocs = join(TEMPLATES_DIR, 'common', 'docs');
  if (existsSync(commonDocs)) {
    const walkDocs = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        if (f.isDirectory()) walkDocs(join(dir, f.name));
        else if (f.name.endsWith('.md') || f.name.endsWith('.css')) normativeFiles.push(join(dir, f.name));
      }
    };
    walkDocs(commonDocs);
  }
  for (const base of ['skills', join(TEMPLATES_DIR, 'common', 'skills')]) {
    const dir = join(ROOT, base);
    if (existsSync(dir)) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const skillMd = join(dir, entry.name, 'SKILL.md');
          if (existsSync(skillMd)) normativeFiles.push(skillMd);
        }
      }
    }
  }

  // 3. Scan (line-scoped; hex compared case-insensitively).
  let violations = 0;
  for (const file of normativeFiles) {
    let content = '';
    try { content = readFileSync(file, 'utf-8'); } catch { continue; }
    const rel = relative(ROOT, file) || file;
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.includes('neutrality-exempt:')) return;
      for (const [literal, owner] of identity) {
        const matched = literal.startsWith('#')
          ? line.toLowerCase().includes(literal.toLowerCase())
          : new RegExp(`(?<![\\w-])${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(line);
        if (matched) {
          violations++;
          fail('root', 'B-12', `variant identity literal "${literal}" (${owner}) in normative L0/L1 file ${rel}:${idx + 1}`,
            `Remove the variant-specific value or annotate the line with <!-- neutrality-exempt: <reason> --> (L0/L1 must stay style/pattern-neutral per ADR-0064/0066)`);
        }
      }
    });
  }
  if (violations === 0) {
    pass(`L0/L1 style neutrality: no variant identity literals in ${normativeFiles.length} normative file(s) (${identity.size} harvested literals)`);
  }
}

// Check 11: Variant Contract compliance
function checkVariantContract(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 11: Variant Contract compliance in ${variant} ===`);

  try {
    const contractPath = join(ROOT, 'docs', 'templates', 'variant-contract.json');
    if (!existsSync(contractPath)) {
      fail('root', 'variant-contract-missing', 'docs/templates/variant-contract.json not found', 'Create variant-contract.json with version, required, optional fields');
      return;
    }

    const contractRaw = readFileSync(contractPath, 'utf-8');
    let contract: VariantContract;

    try {
      contract = JSON.parse(contractRaw) as VariantContract;
    } catch (parseError) {
      fail('root', 'variant-contract-invalid', 'docs/templates/variant-contract.json is not valid JSON', 'Fix JSON syntax');
      return;
    }

    const variantDir = join(TEMPLATES_DIR, variant);
    const missingFiles: string[] = [];

    const commonDir = join(TEMPLATES_DIR, 'common');
    for (const requiredPattern of contract.required) {
      const requiredFile = requiredPattern.replaceAll('{variant}', variant);
      const filePath = join(variantDir, requiredFile);
      const commonFilePath = join(commonDir, requiredFile);
      // A required file is satisfied if it exists in the variant OR in templates/common/
      // (common-inherited files are copied to the project by new-project.sh)
      if (!existsSync(filePath) && !existsSync(commonFilePath)) {
        missingFiles.push(requiredFile);
      }
    }

    if (missingFiles.length > 0) {
      fail(variant, 'variant-contract', `Variant Contract FAILED — missing ${missingFiles.length} required files:\n     - ${missingFiles.join('\n     - ')}`);
    } else {
      pass(`${variant}: Variant Contract satisfied (${contract.required.length}/${contract.required.length} required files present)`);
    }
  } catch (error) {
    fail('root', 'variant-contract-error', `Failed to check Variant Contract: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Check B-03: security-gate: true skills must NOT be in .claude/skills/
function checkSecurityGateSkills(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check B-03: security-gate skill placement in ${variant} ===`);

  const claudeSkillsDir = join(TEMPLATES_DIR, variant, '.claude', 'skills');
  if (!existsSync(claudeSkillsDir)) {
    pass(`${variant}/.claude/skills/: not present (OK — security-gate check not applicable)`);
    return;
  }

  const skillDirs = readdirSync(claudeSkillsDir).filter(d =>
    statSync(join(claudeSkillsDir, d)).isDirectory()
  );

  let violations = 0;
  for (const skillName of skillDirs) {
    const skillMdPath = join(claudeSkillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;

    const rawContent = readFileSync(skillMdPath, 'utf-8');
    const fields = parseFrontmatter(rawContent);

    if ('security-gate' in fields) {
      // Check if value is true
      const content = normalizeContent(rawContent);
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (match) {
        const fmText = match[1];
        const sgLine = fmText.split('\n').find(l => l.startsWith('security-gate:'));
        const sgValue = sgLine ? sgLine.slice(sgLine.indexOf(':') + 1).trim() : '';
        if (sgValue === 'true') {
          fail(
            variant,
            'security-gate-placement',
            `${variant}/.claude/skills/${skillName}/SKILL.md has security-gate: true but is in .claude/skills/ (Claude Code-only). Move to skills/ (platform-neutral).`,
            `Move skills/${skillName}/ out of .claude/skills/ into the top-level skills/ directory`
          );
          violations++;
        }
      }
    }
  }

  if (violations === 0) {
    pass(`${variant}/.claude/skills/: no security-gate: true skills found (OK)`);
  }
}

// B-07: Sync scan results back to VERSION_REGISTRY.json
function updateVersionRegistry(manifests: Map<string, VariantManifest>): void {
  const registryPath = join(ROOT, 'docs', 'templates', 'VERSION_REGISTRY.json');
  if (!existsSync(registryPath)) return;

  let registry: Record<string, unknown>;
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return;
  }

  const variants = (registry.variants ?? {}) as Record<string, Record<string, unknown>>;
  let changed = false;
  const today = new Date().toISOString().slice(0, 10);

  for (const [name, manifest] of manifests) {
    const existing = variants[name] ?? {};
    const newStatus = manifest.status;
    const newVersion = manifest.version ?? existing.latest ?? '0.0.0';

    if (existing.status !== newStatus || existing.latest !== newVersion) {
      variants[name] = {
        ...existing,
        latest: newVersion,
        status: newStatus,
        released: existing.released ?? today,
        security_advisories: existing.security_advisories ?? [],
        migration_guides: existing.migration_guides ?? [],
      };
      changed = true;
      if (!JSON_MODE) pass(`VERSION_REGISTRY.json: ${name} synced (status=${newStatus}, version=${newVersion})`);
    }
  }

  if (changed) {
    registry.variants = variants;
    registry.last_updated = today;
    writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
    if (!JSON_MODE) pass(`VERSION_REGISTRY.json updated (last_updated=${today})`);
  } else {
    if (!JSON_MODE) pass('VERSION_REGISTRY.json already up-to-date');
  }
}

// B-08: Check for deprecated agents/skills in variant and warn about version bump
function checkDeprecatedVersionBump(variant: string, manifest: VariantManifest): void {
  const agentsDir = join(TEMPLATES_DIR, variant, 'agents');
  const skillsDir = join(TEMPLATES_DIR, variant, 'skills');

  let deprecatedAgents = 0;
  let deprecatedSkills = 0;

  if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir).filter(f => f.endsWith('.md') && !f.startsWith('README'))) {
      const content = readFileSync(join(agentsDir, file), 'utf-8');
      const statusLine = content.split('\n').find(l => l.startsWith('status:'));
      if (statusLine && statusLine.includes('deprecated')) deprecatedAgents++;
    }
  }

  if (existsSync(skillsDir)) {
    for (const d of readdirSync(skillsDir).filter(d => d !== '_archive' && statSync(join(skillsDir, d)).isDirectory())) {
      const skillMd = join(skillsDir, d, 'SKILL.md');
      if (!existsSync(skillMd)) continue;
      const content = readFileSync(skillMd, 'utf-8');
      const statusLine = content.split('\n').find(l => l.startsWith('status:'));
      if (statusLine && statusLine.includes('deprecated')) deprecatedSkills++;
    }
  }

  if (deprecatedAgents > 0 || deprecatedSkills > 0) {
    const currentVersion = manifest.version ?? '0.0.0';
    const parts = currentVersion.split('.').map(Number);
    const bumpedVersion = `${parts[0]}.${parts[1]}.${(parts[2] ?? 0) + 1}`;
    warn(
      variant,
      'deprecated-version-bump',
      `${variant} has ${deprecatedAgents} deprecated agent(s) and ${deprecatedSkills} deprecated skill(s) — consider bumping patch version ${currentVersion} → ${bumpedVersion}`,
      `Update version in templates/${variant}/variant.json and VERSION_REGISTRY.json to ${bumpedVersion}`
    );
  }
}

// Check WS-01: workspace-schema.json consistency
function checkWorkspaceSchema(): void {
  if (!JSON_MODE) console.log('\n=== Check WS-01: workspace-schema.json consistency ===');

  const schemaPath = join(ROOT, 'docs', 'workspace-schema.json');
  if (!existsSync(schemaPath)) {
    warn('root', 'ws-schema-missing', 'workspace-schema.json not found at docs/', 'Create docs/workspace-schema.json with workflow.phases and agent_tiers');
    return;
  }

  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    fail('root', 'ws-schema-invalid', 'workspace-schema.json is not valid JSON');
    return;
  }

  pass('workspace-schema.json: present and valid JSON');

  // --- WS-01 Check 0: L0↔L1 parity (root vs templates/common/docs copy) ---
  // The docs propagation domain is disabled (ADR-0069), so nothing else keeps the L1
  // copy in sync. Scaffold reads the L1 copy at project creation; a stale copy ships
  // wrong country/variant registries into new projects (found by the 2026-09-08
  // project review — validator-hardening pilot).
  const l1SchemaPath = join(ROOT, 'templates', 'common', 'docs', 'workspace-schema.json');
  if (!existsSync(l1SchemaPath)) {
    fail('root', 'ws-schema-l1-missing', 'templates/common/docs/workspace-schema.json not found — scaffold reads the L1 copy; re-sync: cp docs/workspace-schema.json templates/common/docs/workspace-schema.json');
  } else {
    // Canonical stringify (sorted keys, recursively) so comparison is semantic, not
    // key-order sensitive (review 2026-09-08, Slot C F2).
    const canon = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(canon);
      if (v && typeof v === 'object') {
        return Object.keys(v as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = canon((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
      }
      return v;
    };
    try {
      const l1Schema = JSON.parse(readFileSync(l1SchemaPath, 'utf-8')) as Record<string, unknown>;
      const rootKeys = new Set(Object.keys(schema));
      const l1Keys = new Set(Object.keys(l1Schema));
      const diverged: string[] = [];
      for (const k of new Set([...rootKeys, ...l1Keys])) {
        if (JSON.stringify(canon(schema[k])) !== JSON.stringify(canon(l1Schema[k]))) diverged.push(k);
      }
      if (diverged.length > 0) {
        fail('root', 'ws-schema-l1-parity', `templates/common/docs/workspace-schema.json diverged from root on key(s): ${diverged.join(', ')} — re-sync: cp docs/workspace-schema.json templates/common/docs/workspace-schema.json`);
      } else {
        pass('workspace-schema.json L1 parity: templates/common copy matches root');
      }
    } catch {
      fail('root', 'ws-schema-l1-invalid', 'templates/common/docs/workspace-schema.json is not valid JSON — re-sync from docs/workspace-schema.json');
    }
  }

  const workflow = schema.workflow as Record<string, unknown> | undefined;
  const phases = workflow?.phases as Record<string, unknown> | undefined;
  const agentTiers = schema.agent_tiers as Record<string, string> | undefined;

  if (!phases) {
    fail('root', 'ws-schema-structure', 'workspace-schema.json missing workflow.phases');
    return;
  }

  const schemaPmOwned = (phases.pm_owned as string[] | undefined) ?? [];
  const schemaCanonical = (phases.canonical as string[] | undefined) ?? [];
  const schemaCount = phases.count as number | undefined;

  // --- WS-01 Check 1: agents/pm.md Can Lead Phases vs schema pm_owned ---
  const pmMdPath = join(ROOT, 'agents', 'pm.md');
  if (!existsSync(pmMdPath)) {
    warn('root', 'ws-01-pm-missing', 'agents/pm.md not found — skipping PM phase check');
  } else {
    const pmContent = readFileSync(pmMdPath, 'utf-8');
    const phaseLineMatch = pmContent.match(/\*{0,2}Can Lead Phases\*{0,2}\s*:\s*\[([^\]]+)\]/);
    if (!phaseLineMatch) {
      warn('root', 'ws-01-pm-phases', 'agents/pm.md: Can Lead Phases line not found');
    } else {
      const pmPhases = phaseLineMatch[1].split(',').map(s => s.trim().replace(/"/g, '').replace(/'/g, ''));
      const pmSorted = [...pmPhases].sort();
      const schemaSorted = [...schemaPmOwned].sort();
      if (JSON.stringify(pmSorted) === JSON.stringify(schemaSorted)) {
        pass(`agents/pm.md: Can Lead Phases [${pmPhases.join(', ')}] matches schema pm_owned`);
      } else {
        fail('root', 'ws-01-pm-phases',
          `[FAIL] agents/pm.md: Can Lead Phases [${pmPhases.join(', ')}] does not match workspace-schema.json pm_owned [${schemaPmOwned.join(', ')}]`,
          'Update Can Lead Phases in agents/pm.md or pm_owned in workspace-schema.json'
        );
      }
    }
  }

  // --- WS-01 Check 2: templates/common/docs/phase-definitions.md canonical phases ---
  const phaseDefPath = join(ROOT, 'templates', 'common', 'docs', 'phase-definitions.md');
  if (!existsSync(phaseDefPath)) {
    warn('root', 'ws-01-phase-defs-missing', 'templates/common/docs/phase-definitions.md not found — skipping canonical phase check');
  } else {
    const phaseDefContent = readFileSync(phaseDefPath, 'utf-8');
    // Extract phase identifiers from Phase Overview table rows (first column)
    const tableRowRegex = /^\|\s*([0-9][0-9-]*)\s*\|/gm;
    const foundPhases = new Set<string>();
    for (const m of phaseDefContent.matchAll(tableRowRegex)) {
      foundPhases.add(m[1].trim());
    }
    const missingFromDoc = schemaCanonical.filter(p => !foundPhases.has(p));
    if (missingFromDoc.length === 0) {
      pass(`templates/common/docs/phase-definitions.md: all ${schemaCanonical.length} canonical phases present`);
    } else {
      for (const missing of missingFromDoc) {
        fail('root', 'ws-01-phase-defs',
          `[FAIL] phase-definitions.md: missing phase "${missing}" from canonical list`,
          `Add phase "${missing}" to the Phase Overview table in templates/common/docs/phase-definitions.md`
        );
      }
    }
  }

  // --- WS-01 Check 3: docs/constitution/05-multi-agent-architecture.md phase count ---
  const constitutionPath = join(ROOT, 'docs', 'constitution', '05-multi-agent-architecture.md');
  if (!existsSync(constitutionPath)) {
    warn('root', 'ws-01-constitution-missing', 'docs/constitution/05-multi-agent-architecture.md not found — skipping phase count check');
  } else {
    const constitutionContent = readFileSync(constitutionPath, 'utf-8');
    // Find §5.4 section (including heading line) and look for "N phases" or "N-phase" pattern
    const section54Match = constitutionContent.match(/(#{1,4}\s*5\.4[^\n]*\n[\s\S]*?)(?=\n#{1,4}\s*5\.\d|$)/);
    const searchContent = section54Match ? section54Match[1] : constitutionContent;
    const phaseCountMatch = searchContent.match(/(\d+)[- ]phase/i) ?? searchContent.match(/(\d+)\s+phases/i);
    if (!phaseCountMatch) {
      warn('root', 'ws-01-constitution-count', 'constitution §5.4: phase count pattern not found (may be stated differently) — manual review recommended');
    } else {
      const declaredCount = parseInt(phaseCountMatch[1], 10);
      if (declaredCount === schemaCount) {
        pass(`docs/constitution/05-multi-agent-architecture.md §5.4: declares ${declaredCount} phases — matches schema`);
      } else {
        fail('root', 'ws-01-constitution-count',
          `[FAIL] constitution §5.4: declares ${declaredCount} phases, schema requires ${schemaCount}`,
          `Update phase count in docs/constitution/05-multi-agent-architecture.md §5.4 or workspace-schema.json workflow.phases.count`
        );
      }
    }
  }

  // --- WS-01 Check 4: agents/*.md tier frontmatter vs schema agent_tiers ---
  if (!agentTiers) {
    warn('root', 'ws-01-agent-tiers-missing', 'workspace-schema.json missing agent_tiers — skipping tier check');
  } else {
    const agentsDir = join(ROOT, 'agents');
    if (!existsSync(agentsDir)) {
      warn('root', 'ws-01-agents-dir', 'agents/ directory not found at workspace root — skipping tier check');
    } else {
      const agentFiles = readdirSync(agentsDir).filter(f =>
        f.endsWith('.md') && !f.startsWith('README') && !f.startsWith('handoff-spec')
      );

      const tierToModelKeyword: Record<string, string> = {
        high: 'opus',
        medium: 'sonnet',
        low: 'haiku',
      };

      for (const file of agentFiles) {
        const agentName = file.replace(/\.md$/, '');
        const filePath = join(agentsDir, file);
        const rawContent = readFileSync(filePath, 'utf-8');
        const content = normalizeContent(rawContent);

        // Extract frontmatter block
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const fm = fmMatch[1];

        // Check if this agent is in schema
        if (!(agentName in agentTiers)) {
          // Not in schema — skip without warning (variant-specific agents are not in schema)
          continue;
        }

        const expectedTier = agentTiers[agentName];

        // Try simple tier: high/medium/low
        const simpleTierMatch = fm.match(/^tier:\s*(high|medium|low)\s*$/m);
        if (simpleTierMatch) {
          const actualTier = simpleTierMatch[1];
          if (actualTier === expectedTier) {
            pass(`agents/${file}: tier "${actualTier}" matches schema`);
          } else {
            fail('root', 'ws-01-agent-tier',
              `[FAIL] agents/${file}: tier "${actualTier}" does not match schema "${expectedTier}" for agent "${agentName}"`,
              `Update tier in agents/${file} or agent_tiers in workspace-schema.json`
            );
          }
          continue;
        }

        // Complex tier object — check claude: and gemini: sub-fields
        const claudeTierMatch = fm.match(/^\s+claude:\s*(high|medium|low)/m);
        const geminiTierMatch = fm.match(/^\s+gemini:\s*(high|medium|low)/m);
        
        if (claudeTierMatch || geminiTierMatch) {
          if (claudeTierMatch) {
            const claudeTier = claudeTierMatch[1];
            if (claudeTier === expectedTier) {
              pass(`agents/${file}: claude tier "${claudeTier}" matches schema`);
            } else {
              warn('root', 'ws-01-agent-tier-complex', `agents/${file}: claude tier "${claudeTier}" != schema "${expectedTier}"`);
            }
          }
          if (geminiTierMatch) {
            const geminiTier = geminiTierMatch[1];
            if (geminiTier === expectedTier) {
              pass(`agents/${file}: gemini tier "${geminiTier}" matches schema`);
            } else {
              warn('root', 'ws-01-agent-tier-complex', `agents/${file}: gemini tier "${geminiTier}" != schema "${expectedTier}"`);
            }
          }
        } else {
          // Can't reliably parse tier
          warn('root', 'ws-01-agent-tier-unreadable',
            `agents/${file}: tier block too complex to parse reliably — manual review recommended`
          );
        }
      }
    }
  }
}

// Check WS-02: common-contract.json compliance (C-CM-01, C-CM-02, C-SK-01, C-AG-01, C-AG-02, WS-02)
// ── Pure helpers exported for unit tests (C-CM-03b / l0-l1-scripts-registry-version) ──
// Kept side-effect-free so tests/unit can import them without triggering the
// variant-scan battery (validate-templates.ts only runs checks under import.meta.main).

// Platform-tree source keys declared on common_platform_skills entries → the
// platform directory the propagated copy lives under under templates/common/.
// codex_source (T-20260924-002, spec 2026-09-25-inventory-decisions-batch-design
// R1.4): the .codex mirror was previously invisible to C-CM-03b — a version bump
// on a .codex copy drifted silently. All 22 listed skills carry .codex copies.
const PLATFORM_SOURCE_KEYS: Readonly<Record<string, string>> = {
  claude_source: '.claude',
  gemini_source: '.gemini',
  agents_source: '.agents',
  codex_source: '.codex',
};

/** Map a common_platform_skills entry's declared *_source keys to platform tree dirs. */
export function declaredPlatformTrees(entry: Record<string, unknown>): string[] {
  return Object.keys(PLATFORM_SOURCE_KEYS)
    .filter(k => typeof entry[k] === 'string' && (entry[k] as string).length > 0)
    .map(k => PLATFORM_SOURCE_KEYS[k]);
}

/** SKILL.md frontmatter `version:` extraction — same pattern as C-CM-03/03a. */
export function extractFrontmatterVersion(content: string): string | undefined {
  return content.match(/^version:\s*"?([0-9][0-9.]*)"?/m)?.[1];
}

export type VersionParityIssueKind = 'missing-contract-version' | 'missing-artifact-version' | 'mismatch';

/**
 * Three-branch parity comparison shared by C-CM-03/03a/03b semantics: a
 * missing version on either side is a failure (never a silent skip — the M5
 * direction), and unequal versions are a mismatch.
 */
export function versionParityIssue(contractVersion: string | undefined, artifactVersion: string | undefined): VersionParityIssueKind | null {
  if (!contractVersion) return 'missing-contract-version';
  if (!artifactVersion) return 'missing-artifact-version';
  return contractVersion !== artifactVersion ? 'mismatch' : null;
}

/**
 * Exempt-skill set for the C-CM-04 exists→listed sweeps, built from
 * docs/workspace-schema.json. country_scoped_assets.skills is keyed by skill
 * name; variant_scoped_skills is keyed by VARIANT NAME with skill names as
 * VALUES — the values are the exempt set. This matches C-CM-05 semantics
 * (T-20260924-002 R1.5: the pre-1.43 build exempted the variant-scoped KEYS —
 * variant names, not skill names — a latent inconsistency).
 */
export function collectSchemaExemptSkills(schema: {
  country_scoped_assets?: { skills?: Record<string, unknown> };
  variant_scoped_skills?: Record<string, string[]>;
}): Set<string> {
  return new Set([
    ...Object.keys(schema.country_scoped_assets?.skills ?? {}),
    ...Object.values(schema.variant_scoped_skills ?? {}).flat(),
  ]);
}

/**
 * C-CM-04 platform-skills sweep core (pure): from a mirror tree's skill-dir
 * names (directories carrying a SKILL.md), return those covered by neither the
 * contract listings (common_skills + common_platform_skills) nor the
 * schema-exempt / contract-excluded sets.
 */
export function unlistedPlatformSkillDirs(
  dirNames: readonly string[],
  listed: ReadonlySet<string>,
  exempt: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): string[] {
  return dirNames.filter(e => !listed.has(e) && !exempt.has(e) && !excluded.has(e));
}

/**
 * C-CM-04 contract-exclusion anti-drift (pure): an exclusion naming a skill
 * dir that exists in NO mirror tree is stale — the directory was deleted, so
 * the exclusion record must go too (same direction as the C-CM-05
 * SINGLE_PLATFORM_EXCEPTIONS stale rule).
 */
export function stalePlatformSkillExclusions(
  exclusions: Iterable<string>,
  existingNames: Iterable<string>,
): string[] {
  const live = new Set(existingNames);
  return [...exclusions].filter(name => !live.has(name));
}

export interface ScriptsRegistryRow {
  name: string;
  version: string;
}

/**
 * Parse a SCRIPTS.md `## Registry` table into name → row (name + Version cell).
 * Column order: script | source | version | status | removal-date |
 * security-advisory | layer | pair. Only the section whose heading is exactly
 * "Registry" is parsed — L0 SCRIPTS.md also carries a "Registry Scope" prose
 * section that must not match (its content has no table rows, but an
 * startsWith-based finder would stop there and silently return an empty set).
 */
export function parseScriptsMdRegistry(content: string): Map<string, ScriptsRegistryRow> {
  const rows = new Map<string, ScriptsRegistryRow>();
  const registrySection = content
    .split(/^## /m)
    .find(s => s.split('\n')[0].trim() === 'Registry');
  if (!registrySection) return rows;
  for (const line of registrySection.split('\n')) {
    // Data rows start with a backticked name cell; header/separator rows never do.
    const match = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (!match) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const name = match[1].trim();
    const version = cells.length >= 3 ? cells[2].replace(/`/g, '').trim() : '';
    rows.set(name, { name, version });
  }
  return rows;
}

function checkCommonContract(): void {
  if (!JSON_MODE) console.log('\n=== Check WS-02: common-contract.json compliance ===');

  const contractPath = join(ROOT, 'docs', 'templates', 'common-contract.json');
  if (!existsSync(contractPath)) {
    warn('common', 'common-contract-missing', 'docs/templates/common-contract.json not found', 'Create common-contract.json with common_agents and common_skills');
    return;
  }

  let contract: Record<string, unknown>;
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    fail('common', 'common-contract-invalid', 'docs/templates/common-contract.json is not valid JSON');
    return;
  }

  const commonSkills = Object.keys((contract.common_skills as Record<string, unknown>) ?? {});
  const commonAgents = Object.keys((contract.common_agents as Record<string, unknown>) ?? {});

  const variantDirs = readdirSync(TEMPLATES_DIR).filter(e => {
    if (isTransientTestFixture(e)) return false; // E2E staging dirs (T-20260916-001)
    const fullPath = join(TEMPLATES_DIR, e);
    try { return statSync(fullPath).isDirectory() && !e.startsWith('.') && e !== 'common'; } catch { return false; }
  });

  // C-CM-01 (ERROR): common/skills/ matches common-contract.json
  for (const skillName of commonSkills) {
    const skillPath = join(TEMPLATES_DIR, 'common', 'skills', skillName, 'SKILL.md');
    if (!existsSync(skillPath)) {
      fail('common', 'C-CM-01', `common-contract.json lists common skill '${skillName}' but templates/common/skills/${skillName}/SKILL.md is missing`, `Create templates/common/skills/${skillName}/SKILL.md`);
    } else {
      pass(`C-CM-01: common skill '${skillName}' → SKILL.md present`);
    }
  }

  // C-CM-03 (ERROR): contract common_skills versions must match templates/common/skills/ frontmatter
  // (added 2026-08-29 after the sync 1.0.0-vs-1.2.2 stale-entry find; DEC-20260829-02 follow-up)
  for (const [skillName, entry] of Object.entries(contract.common_skills as Record<string, { version?: string; source?: string }>)) {
    const skillPath = join(TEMPLATES_DIR, 'common', 'skills', skillName, 'SKILL.md');
    if (!existsSync(skillPath)) continue; // C-CM-01 already flagged this
    const fmVersion = extractFrontmatterVersion(readFileSync(skillPath, 'utf-8'));
    const contractVersion = entry.version;
    if (!contractVersion) {
      fail('common', 'C-CM-03', `common-contract.json entry '${skillName}' has no version`, `Set "version" to the SKILL.md frontmatter version (${fmVersion ?? 'X.Y.Z'})`);
    } else if (!fmVersion) {
      // M5 (2026-09-15 project review): a contract version with no comparable
      // frontmatter version skipped the check silently — one deleted frontmatter
      // line would reintroduce the exact drift this check exists to catch.
      fail('common', 'C-CM-03', `common-contract.json declares version ${contractVersion} for '${skillName}' but SKILL.md frontmatter has no version field`, `Restore "version: ${contractVersion}" to the SKILL.md frontmatter`);
    } else if (contractVersion !== fmVersion) {
      fail('common', 'C-CM-03', `common-contract.json version mismatch for '${skillName}': contract=${contractVersion}, SKILL.md=${fmVersion}`, `Update common-contract.json "version" to ${fmVersion}`);
    }
  }

  // C-CM-02 (ERROR): common/agents/ matches common-contract.json
  for (const agentName of commonAgents) {
    const agentPath = join(TEMPLATES_DIR, 'common', 'agents', `${agentName}.md`);
    if (!existsSync(agentPath)) {
      fail('common', 'C-CM-02', `common-contract.json lists common agent '${agentName}' but templates/common/agents/${agentName}.md is missing`, `Create templates/common/agents/${agentName}.md`);
    } else {
      pass(`C-CM-02: common agent '${agentName}' → agent file present`);
    }
  }

  // C-CM-03a (ERROR): contract common_agents versions must match templates/common/agents/
  // frontmatter — the agent counterpart of C-CM-03 (skills). Without this, a tier/metadata
  // change that bumps an agent's version leaves the contract entry silently stale
  // (2026-09-15-agent-metadata-drift-check-design.md).
  for (const [agentName, entry] of Object.entries(contract.common_agents as Record<string, { version?: string; source?: string }>)) {
    const agentPath = join(TEMPLATES_DIR, 'common', 'agents', `${agentName}.md`);
    if (!existsSync(agentPath)) continue; // C-CM-02 already flagged this
    const fmVersion = extractFrontmatterVersion(readFileSync(agentPath, 'utf-8'));
    const contractVersion = entry.version;
    if (!contractVersion) {
      fail('common', 'C-CM-03a', `common-contract.json entry '${agentName}' has no version`, `Set "version" to the agent frontmatter version (${fmVersion ?? 'X.Y.Z'})`);
    } else if (!fmVersion) {
      fail('common', 'C-CM-03a', `common-contract.json declares version ${contractVersion} for '${agentName}' but the agent frontmatter has no version field`, `Restore "version: ${contractVersion}" to the agent frontmatter`);
    } else if (contractVersion !== fmVersion) {
      fail('common', 'C-CM-03a', `common-contract.json version mismatch for '${agentName}': contract=${contractVersion}, agent frontmatter=${fmVersion}`, `Update common-contract.json "version" to ${fmVersion}`);
    }
  }

  // C-CM-03b (ERROR): contract common_platform_skills version parity
  // (T-20260915-013, finding H10). Check H (verify-platform-lifecycle.ts) only
  // proves the propagated platform-tree copies EXIST; a version bump on either
  // side of the propagation edge was invisible. Two arms:
  //   (a) each entry's contract version must equal the SKILL.md frontmatter
  //       version of the propagated copy under templates/common/<platform>/skills/
  //       for every declared platform tree (claude_source → .claude,
  //       gemini_source → .gemini, agents_source → .agents). A missing copy or a
  //       missing version on either side is a failure, not a silent skip (same
  //       direction as the 1.28.0 M5 fix: unverifiable parity must fail loud).
  //   (b) a skill listed in BOTH common_skills and common_platform_skills must
  //       carry the SAME version in both sections (9 skills are double-registered).
  const platformSkillEntries = Object.entries((contract.common_platform_skills ?? {}) as Record<string, { version?: string }>);
  const commonSkillEntries = (contract.common_skills ?? {}) as Record<string, { version?: string }>;
  for (const [skillName, entry] of platformSkillEntries) {
    const platforms = declaredPlatformTrees(entry as Record<string, unknown>);
    if (platforms.length === 0) {
      fail('common', 'C-CM-03b', `common-contract.json platform skill '${skillName}' declares no platform source key (claude_source/gemini_source/agents_source/codex_source)`, `Add the *_source key(s) for the platform tree(s) that carry '${skillName}'`);
    }
    for (const platform of platforms) {
      const copyPath = join(TEMPLATES_DIR, 'common', platform, 'skills', skillName, 'SKILL.md');
      if (!existsSync(copyPath)) {
        fail('common', 'C-CM-03b', `common-contract.json platform skill '${skillName}' has no propagated copy at templates/common/${platform}/skills/ — version parity unverifiable`, `Propagate the skill to templates/common/${platform}/skills/ (platform-skill-lifecycle-manager skill)`);
        continue;
      }
      const fmVersion = extractFrontmatterVersion(readFileSync(copyPath, 'utf-8'));
      const issue = versionParityIssue(entry.version, fmVersion);
      if (issue === 'missing-contract-version') {
        fail('common', 'C-CM-03b', `common-contract.json platform skill '${skillName}' has no version`, `Set "version" to the templates/common/${platform}/skills/ SKILL.md frontmatter version (${fmVersion ?? 'X.Y.Z'})`);
      } else if (issue === 'missing-artifact-version') {
        fail('common', 'C-CM-03b', `common-contract.json declares version ${entry.version} for platform skill '${skillName}' but templates/common/${platform}/skills/ SKILL.md has no version field`, `Restore "version: ${entry.version}" to the SKILL.md frontmatter`);
      } else if (issue === 'mismatch') {
        fail('common', 'C-CM-03b', `common-contract.json version mismatch for platform skill '${skillName}' (${platform}): contract=${entry.version}, SKILL.md=${fmVersion}`, `Update common-contract.json "version" to ${fmVersion}`);
      } else {
        pass(`C-CM-03b: platform skill '${skillName}' (${platform}) version ${entry.version} matches the propagated copy`);
      }
    }
    const commonEntry = commonSkillEntries[skillName];
    if (commonEntry?.version && entry.version && commonEntry.version !== entry.version) {
      fail('common', 'C-CM-03b', `platform skill '${skillName}' is double-registered with divergent versions: common_skills=${commonEntry.version}, common_platform_skills=${entry.version}`, `Align the two common-contract.json entries for '${skillName}' to the SKILL.md frontmatter version`);
    }
  }

  // C-CM-04 (ERROR): reverse exists-to-listed coverage for common_commands
  // (T-20260910-019). The forward direction (listed → file exists) is covered by
  // verify-platform-lifecycle Check G; this catches the drift direction the
  // 2026-09-10 review found (M12): a command added to templates/common that the
  // contract never declares — scaffolding propagates it, governance is blind to it.
  const contractCommands = contract.common_commands as Record<string, { source?: string; gemini_source?: string }> | undefined;
  if (contractCommands) {
    // Codex leg is DERIVED from `source` (Ruling K, spec
    // 2026-09-25-verifier-platform-expansion-design): sync-skills Phase 1b maps
    // .claude/commands/<x>.md → .codex/prompts/<x>.md unconditionally, so no
    // codex_source key exists for COMMANDS. This couples the check to the
    // sync-skills mapping; if ADR-0077 D4 changes, this leg moves with it.
    // Platform SKILLS are different: their .codex copies are declared
    // explicitly (codex_source on common_platform_skills entries, R1.4 of
    // 2026-09-25-inventory-decisions-batch-design) and C-CM-03b verifies their
    // version parity like any other platform tree.
    // .agents has no command surface (Finding D exclusion).
    const reverseSurfaces: ReadonlyArray<readonly [string, string, 'source' | 'gemini_source']> = [
      ['.claude', 'commands', 'source'],
      ['.gemini', 'commands', 'gemini_source'],
      ['.codex', 'prompts', 'source'],
    ];
    for (const [platform, leaf, sourceKey] of reverseSurfaces) {
      const cmdDir = join(TEMPLATES_DIR, 'common', platform, leaf);
      if (!existsSync(cmdDir)) continue;
      const soak = platform === '.codex'; // TODO(promotion): flip to fail after soak
      const emit = soak ? warn : fail;
      let listedCount = 0;
      for (const file of readdirSync(cmdDir).filter(f => f.endsWith('.md'))) {
        const name = file.replace(/\.md$/, '');
        listedCount++;
        if (!contractCommands[name]) {
          emit('common', 'C-CM-04', `templates/common/${platform}/${leaf}/${file} exists but is not declared in common-contract.json common_commands`, `Add a "${name}" entry to common_commands (source + gemini_source + description)`);
        } else if (!contractCommands[name][sourceKey]) {
          emit('common', 'C-CM-04', `common-contract.json command "${name}" is missing "${sourceKey}" for ${platform}/${leaf}/`, `Set "${sourceKey}" on the "${name}" entry`);
        }
      }
      if (listedCount > 0) {
        pass(`C-CM-04: all ${listedCount} ${platform}/${leaf}/ file(s) declared in common_commands${soak ? ' (soak: WARN until promotion)' : ''}`);
      }
    }
  }

  // C-CM-05 (ERROR): reverse exists-to-listed coverage for common_platform_skills
  // (T-20260910-019). Universe: templates/common/.claude/skills/*/SKILL.md. A skill
  // there is exempt from contract listing only when it falls into a class the
  // contract description already declares out of scope:
  //   mirrored  — a bulk-propagated copy of a workspace skills/<name>/ skill
  //   country   — country-scoped (workspace-schema.json country_scoped_assets.skills)
  //   variant   — variant-scoped (workspace-schema.json variant_scoped_skills)
  //   claude-only tool skills with no Gemini distribution (graft — the graft/
  //     index is a Claude Code CLI integration; verified against the exclusion
  //     allowlist so a silent second exception cannot appear unnoticed)
  const platformSkills = contract.common_platform_skills as Record<string, unknown> | undefined;
  if (platformSkills) {
    const schemaPath = join(ROOT, 'docs', 'workspace-schema.json');
    let countryScoped = new Set<string>();
    let variantScoped = new Set<string>();
    if (existsSync(schemaPath)) {
      try {
        const wsSchema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as {
          country_scoped_assets?: { skills?: Record<string, string> };
          variant_scoped_skills?: Record<string, string[]>;
        };
        countryScoped = new Set(Object.keys(wsSchema.country_scoped_assets?.skills ?? {}));
        variantScoped = new Set(Object.values(wsSchema.variant_scoped_skills ?? {}).flat());
      } catch { /* workspace-schema checks report their own drift */ }
    }
    // Explicit allowlist: platform skills that are intentionally unlisted. Every
    // entry must carry its reason — the check fails if an allowlisted name
    // disappears, so the list cannot rot.
    const SINGLE_PLATFORM_EXCEPTIONS: Record<string, string> = {
      graft: 'claude-only tool skill — the graft/ repo index is a Claude Code CLI integration with no Gemini distribution',
    };

    const skillDir = join(TEMPLATES_DIR, 'common', '.claude', 'skills');
    if (existsSync(skillDir)) {
      let unlistedErrors = 0;
      for (const entry of readdirSync(skillDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        if (!existsSync(join(skillDir, name, 'SKILL.md'))) continue;
        if (platformSkills[name]) continue; // listed — Check H owns forward coverage
        if (existsSync(join(ROOT, 'skills', name, 'SKILL.md'))) continue; // mirrored workspace skill
        if (countryScoped.has(name)) continue; // country-scoped — contract description excludes
        if (variantScoped.has(name)) continue; // variant-scoped — contract description excludes
        if (SINGLE_PLATFORM_EXCEPTIONS[name]) {
          // Anti-drift (ADR-0076 D6): the skill is hand-maintained as exactly two
          // byte-identical copies (root + template) — divergence means an edit
          // landed on one side only, and the next upgrade would ship the stale one.
          const rootCopy = join(ROOT, '.claude', 'skills', name, 'SKILL.md');
          const templateCopy = join(skillDir, name, 'SKILL.md');
          if (existsSync(rootCopy) && readFileSync(rootCopy, 'utf-8') !== readFileSync(templateCopy, 'utf-8')) {
            fail('common', 'C-CM-05', `hand-maintained skill '${name}' copies diverge — root .claude/skills/${name}/SKILL.md and templates/common/.claude/skills/${name}/SKILL.md must stay byte-identical`, `Overwrite the stale copy with the fresher one (root and template must match)`);
            unlistedErrors++;
          } else {
            pass(`C-CM-05: platform skill '${name}' unlisted by exception — ${SINGLE_PLATFORM_EXCEPTIONS[name]}`);
          }
          continue;
        }
        fail('common', 'C-CM-05', `templates/common/.claude/skills/${name}/ exists but is not declared in common-contract.json common_platform_skills and matches no documented exclusion class`, `Add "${name}" to common_platform_skills, or register it in workspace-schema.json country_scoped_assets/variant_scoped_skills, or document an exclusion in the C-CM-05 exception list`);
        unlistedErrors++;
      }
      for (const name of Object.keys(SINGLE_PLATFORM_EXCEPTIONS)) {
        if (!existsSync(join(skillDir, name, 'SKILL.md'))) {
          fail('common', 'C-CM-05', `C-CM-05 exception list names '${name}' but templates/common/.claude/skills/${name}/ no longer exists — remove the stale exception`, `Delete the '${name}' entry from the C-CM-05 SINGLE_PLATFORM_EXCEPTIONS allowlist`);
        }
      }
      if (unlistedErrors === 0) {
        pass('C-CM-05: all templates/common platform skills declared or explicitly excluded');
      }
    }
  }

  // C-SK-01 (WARNING): No duplicate common skills in variant dirs
  for (const skillName of commonSkills) {
    const commonSkillPath = join(TEMPLATES_DIR, 'common', 'skills', skillName, 'SKILL.md');
    if (!existsSync(commonSkillPath)) continue; // C-CM-01 already flagged this
    const commonContent = normalizeContent(readFileSync(commonSkillPath, 'utf-8'));
    for (const variant of variantDirs) {
      const variantSkillPath = join(TEMPLATES_DIR, variant, 'skills', skillName, 'SKILL.md');
      if (existsSync(variantSkillPath)) {
        const variantContent = normalizeContent(readFileSync(variantSkillPath, 'utf-8'));
        if (variantContent === commonContent) {
          warn(variant, 'C-SK-01', `Duplicate common skill '${skillName}' in ${variant}/skills/ — remove variant copy to inherit from common`);
        }
      }
    }
  }

  // C-AG-01 (WARNING): No duplicate common agents in variant dirs
  // Exception: agents with expected_override_all_variants: true (e.g. pm) are intentionally
  // overridden in every variant — skip the duplicate warning for those agents.
  const commonAgentsMap2 = (contract.common_agents as Record<string, Record<string, unknown>>) ?? {};
  for (const agentName of commonAgents) {
    const agentMeta2 = commonAgentsMap2[agentName];
    if (agentMeta2?.expected_override_all_variants) continue; // intentional override — skip

    const commonAgentPath = join(TEMPLATES_DIR, 'common', 'agents', `${agentName}.md`);
    if (!existsSync(commonAgentPath)) continue; // C-CM-02 already flagged this
    const commonContent = normalizeContent(readFileSync(commonAgentPath, 'utf-8'));
    for (const variant of variantDirs) {
      const variantAgentPath = join(TEMPLATES_DIR, variant, 'agents', `${agentName}.md`);
      if (existsSync(variantAgentPath)) {
        const variantContent = normalizeContent(readFileSync(variantAgentPath, 'utf-8'));
        if (variantContent === commonContent) {
          warn(variant, 'C-AG-01', `Duplicate common agent '${agentName}' in ${variant}/agents/ — remove variant copy to inherit from common`);
        }
      }
    }
  }

  // C-AG-02 (INFO/WARNING): Replacement overrides flagged
  for (const variant of variantDirs) {
    const variantJsonPath = join(TEMPLATES_DIR, variant, 'variant.json');
    if (!existsSync(variantJsonPath)) continue;
    let variantJson: Record<string, unknown>;
    try {
      variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8')) as Record<string, unknown>;
    } catch { continue; }
    const agentOverrides = variantJson.agent_overrides as Record<string, Record<string, unknown>> | undefined;
    if (!agentOverrides) continue;
    for (const [agentName, override] of Object.entries(agentOverrides)) {
      if (override.type === 'replacement') {
        const reason = (override.reason as string | undefined) ?? 'no reason given';
        warn(variant, 'C-AG-02', `${variant}: ${agentName} has replacement override (reason: ${reason}) — lifecycle-manager review confirmed`);
      }
    }
  }

  // C-SK-02: Invariant sections identical across all variant pm.md files
  // Also: skeleton must not contain variant-specific agent names
  const commonAgentsMap = (contract.common_agents as Record<string, Record<string, unknown>>) ?? {};
  for (const [agentName, agentMeta] of Object.entries(commonAgentsMap)) {
    const skeletonSections = (agentMeta.skeleton_sections as string[] | undefined) ?? [];
    if (skeletonSections.length === 0) continue;

    const skeletonPath = join(TEMPLATES_DIR, 'common', 'agents', `${agentName}.md`);
    if (!existsSync(skeletonPath)) continue; // C-CM-02 already flagged this

    const skeletonRaw = normalizeContent(readFileSync(skeletonPath, 'utf-8'));

    // Helper: extract section content (heading line + body until next ## heading)
    function extractSection(content: string, heading: string): string | null {
      // Match the heading line (## heading, possibly with bold/emoji prefix)
      // We search for lines that contain the heading text after ##
      const lines = content.split('\n');
      let startIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## ') && line.includes(heading)) {
          startIdx = i;
          break;
        }
      }
      if (startIdx === -1) return null;

      // Collect until next ## heading
      const sectionLines: string[] = [lines[startIdx]];
      for (let i = startIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) break;
        sectionLines.push(lines[i]);
      }
      return sectionLines.join('\n').trimEnd();
    }

    // Build map of invariant section content from skeleton
    const invariantSections = new Map<string, string>();
    for (const sectionTitle of skeletonSections) {
      const content = extractSection(skeletonRaw, sectionTitle);
      if (content !== null) {
        invariantSections.set(sectionTitle, content);
      }
    }

    // Check each variant
    for (const variant of variantDirs) {
      const variantAgentPath = join(TEMPLATES_DIR, variant, 'agents', `${agentName}.md`);
      if (!existsSync(variantAgentPath)) continue; // variant inherits from common — no override to check

      const variantRaw = normalizeContent(readFileSync(variantAgentPath, 'utf-8'));

      // Check if variant uses extends pattern
      // Parse with a real YAML parser, not the line-based parseFrontmatter(): that helper trims
      // each candidate key before testing for indentation, so indented lines inside block scalars
      // (e.g. prose under `variant_overrides:`) whose text contains a colon were reported as
      // top-level frontmatter keys — producing nonsense C-SK-02 warnings like
      // "unexpected fields: <!-- VARIANT-SECTION, 1. HS classification memorandum, ...".
      const fmMatchV = normalizeContent(variantRaw.replace(/^# @resolved-from:.*\n/, '')).match(/^---\n([\s\S]*?)\n---/);
      let variantFields: Record<string, unknown> = {};
      if (fmMatchV) {
        try { variantFields = (load(fmMatchV[1]) as Record<string, unknown>) ?? {}; } catch { variantFields = {}; }
      }
      const hasExtends = 'extends' in variantFields;

      if (hasExtends) {
        // Per ADR-0048 / docs/architecture/extends-pattern.md, the variant pm.md
        // "Minimal pattern" REQUIRES `name`, `variant`, `version`, and `last_updated`
        // alongside `extends` — it is not extends-only. validate-pm-extends.ts (the
        // dedicated ADR-0033/0048 validator) already treats this schema as valid;
        // only flag fields outside that documented schema. `remove_sections` and
        // `variant_overrides` are the ADR-0039/ADR-0034 override mechanism consumed
        // at scaffold time by merge-frontmatter.ts; `status` is documented optional
        // at all levels; `owner` and `capabilities` are pass-through agent metadata
        // read by other validators (capability-validator.ts reads pm's capabilities);
        // `lifecycle` is required L2 metadata for variants shipping their own
        // recursive validate-agents.ts (e.g. co-safety) that enforces
        // lifecycle.phase/lifecycle.governance per-file, independent of `extends`.
        // `description` is the persona-integrity field (validate-agents 1.3.2):
        // a stub whose extends cannot resolve in project layout would otherwise
        // fail the gate with no description to inherit — stubs inline the base
        // persona's description (2026-09-23 fleet repair,
        // 2026-09-22-agent-persona-integrity-gate).
        const allowedWithExtends = new Set([
          'extends', 'name', 'variant', 'version', 'last_updated', 'status',
          'remove_sections', 'variant_overrides', 'owner', 'capabilities', 'lifecycle',
          'description',
        ]);
        const fieldKeys = Object.keys(variantFields);
        const unexpectedKeys = fieldKeys.filter(k => !allowedWithExtends.has(k));

        if (unexpectedKeys.length > 0) {
          warn(variant, 'C-SK-02',
            `C-SK-02: ${variant}/agents/${agentName}.md uses 'extends' but also has unexpected frontmatter fields: ${unexpectedKeys.join(', ')} — see docs/architecture/extends-pattern.md for the allowed schema`,
            `Remove the unexpected frontmatter fields, or add them to the schema in docs/architecture/extends-pattern.md if intentional`
          );
        }

        // Skip the rest of the checks for extends-based variants
        // The skeleton file is already validated above
        continue;
      }

      // Sub-check A: no <!-- VARIANT-SECTION: markers should remain in scaffolded file
      if (variantRaw.includes('<!-- VARIANT-SECTION:')) {
        fail(variant, 'C-SK-02',
          `C-SK-02: ${variant}/agents/${agentName}.md contains unresolved <!-- VARIANT-SECTION: --> markers — skeleton not fully scaffolded`,
          `Replace all <!-- VARIANT-SECTION: --> blocks with actual variant-specific content`
        );
      }

      // Sub-check B: invariant sections — behavior depends on override type
      // additive: skeleton provides invariant sections → missing in variant is EXPECTED (skip warn)
      // replacement: variant provides everything → missing invariant = may have been stripped (warn)
      // both: if invariant section IS present but DIFFERENT → always warn
      const variantJsonPath = join(TEMPLATES_DIR, variant, 'variant.json');
      let overrideType = 'replacement'; // conservative default
      if (existsSync(variantJsonPath)) {
        try {
          const vj = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));
          overrideType = vj.agent_overrides?.[agentName]?.type ?? 'replacement';
        } catch { /* keep default */ }
      }

      for (const [sectionTitle, skeletonContent] of invariantSections) {
        const variantContent = extractSection(variantRaw, sectionTitle);
        if (variantContent === null) {
          if (overrideType !== 'additive') {
            warn(variant, 'C-SK-02',
              `C-SK-02: ${variant}/agents/${agentName}.md is missing invariant section '## ${sectionTitle}' — may have been stripped during override`,
              `Restore the '## ${sectionTitle}' section from templates/common/agents/${agentName}.md`
            );
          }
          // additive: missing invariant section is EXPECTED — skeleton provides it at scaffolding time
        } else if (variantContent !== skeletonContent) {
          warn(variant, 'C-SK-02',
            `C-SK-02: ${variant}/agents/${agentName}.md has modified invariant section '## ${sectionTitle}' — invariant sections should not be changed in variant overrides`,
            `Restore '## ${sectionTitle}' to match templates/common/agents/${agentName}.md, or promote the change to the skeleton`
          );
        }
      }
    }

    // Sub-check C: skeleton must not contain variant-specific agent names
    const variantSpecificNames = ['designer', 'code-writer', 'test-runner', 'red-team-lead'];
    for (const agentSpecificName of variantSpecificNames) {
      // Search in non-frontmatter body only (strip frontmatter)
      const bodyStart = skeletonRaw.indexOf('\n---\n', skeletonRaw.indexOf('---\n'));
      const body = bodyStart !== -1 ? skeletonRaw.slice(bodyStart + 5) : skeletonRaw;
      // Use word-boundary-style check: the name must appear as a standalone reference
      const nameRegex = new RegExp(`(?<![a-z])${agentSpecificName.replace('-', '[- ]')}(?![a-z])`, 'i');
      if (nameRegex.test(body)) {
        warn('common', 'C-SK-02',
          `C-SK-02: Skeleton templates/common/agents/${agentName}.md contains variant-specific agent name: '${agentSpecificName}' — skeleton should be agent-agnostic`,
          `Remove or generalize the reference to '${agentSpecificName}' in the skeleton`
        );
      }
    }
  }
  if (!JSON_MODE) pass('C-SK-02: invariant section check complete');

  // WS-02 (WARNING): Anti-swelling 50% rule
  const totalVariants = variantDirs.length;
  for (const agentName of commonAgents) {
    let overrideCount = 0;
    for (const variant of variantDirs) {
      const variantJsonPath = join(TEMPLATES_DIR, variant, 'variant.json');
      if (!existsSync(variantJsonPath)) continue;
      let variantJson: Record<string, unknown>;
      try {
        variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8')) as Record<string, unknown>;
      } catch { continue; }
      const agentOverrides = variantJson.agent_overrides as Record<string, unknown> | undefined;
      if (agentOverrides && agentName in agentOverrides) overrideCount++;
    }
    const agentContract = (contract.common_agents as Record<string, Record<string, unknown>>)?.[agentName];
    if (agentContract?.expected_override_all_variants) {
      // skip anti-swelling check for this agent — all variants are expected to override
    } else if (totalVariants > 0 && overrideCount / totalVariants >= 0.5) {
      warn('common', 'WS-02', `Anti-swelling alert: '${agentName}' overridden by ${overrideCount}/${totalVariants} variants — consider updating common definition`);
    }
  }

  pass('WS-02: common-contract.json compliance check complete');
}

// Check C-CM-04 (T-20260910-019): reverse exists→listed coverage for common-contract.json.
// C-CM-01/C-CM-02 only prove that LISTED entries exist on disk; nothing proved that on-disk
// common content is LISTED, so the contract inventories could silently rot in both directions.
// Universe per section: templates/common/agents/*.md → common_agents,
// templates/common/skills/*/ → common_skills, templates/common/.claude|.gemini/commands/*.md →
// common_commands. Documented exemptions (contract description): country-scoped skills
// (workspace-schema.json country_scoped_assets.skills) and variant-scoped skills
// (variant_scoped_skills VALUES — skill names; R1.5 of 2026-09-25-inventory-decisions-
// batch-design), plus the contract's own common_platform_skill_exclusions records for the
// platform-skill trees. The platform skill trees (.claude + .gemini, T-20260915-013 —
// the .gemini tree previously had no reverse arm, so a skill dir could appear there without
// any contract listing while .claude stayed covered) are checked at WARN only;
// since the 2026-09-25 full-inventory ruling (T-20260924-002) every dir must be
// listed, schema-exempt, or contract-excluded — the aggregated WARN signals drift.
function checkCommonContractReverseCoverage(): void {
  if (!JSON_MODE) console.log('\n=== Check C-CM-04: common-contract.json reverse coverage (exists→listed) ===');

  const contractPath = join(ROOT, 'docs', 'templates', 'common-contract.json');
  if (!existsSync(contractPath)) return; // prerequisite missing — already reported by WS-02
  let contract: Record<string, unknown>;
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return; // already reported by WS-02
  }

  // Exemptions declared by docs/workspace-schema.json (country-scoped keys +
  // variant-scoped VALUES — skill names; R1.5 of 2026-09-25-inventory-decisions-
  // batch-design fixed the keys-based build that exempted variant NAMES).
  let exemptSkills = new Set<string>();
  const schemaPath = join(ROOT, 'docs', 'workspace-schema.json');
  if (existsSync(schemaPath)) {
    try {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, any>;
      exemptSkills = collectSchemaExemptSkills(schema);
    } catch { /* fall through with no exemptions */ }
  }
  // Contract-declared exclusions (T-20260924-002 R1.2/R1.3): platform skills
  // deliberately outside the common inventory (L0-only operator skills, the
  // claude-only graft tool skill, the variant-scoped sound-synth). A stale
  // exclusion — the dir is gone from every mirror tree — is a failure below.
  const platformSkillExclusions = new Set(
    Object.keys((contract.common_platform_skill_exclusions as Record<string, Record<string, string>>) ?? {}),
  );

  const commonAgents = new Set(Object.keys((contract.common_agents as Record<string, unknown>) ?? {}));
  const commonSkills = new Set(Object.keys((contract.common_skills as Record<string, unknown>) ?? {}));
  const commonCommands = new Set(Object.keys((contract.common_commands as Record<string, unknown>) ?? {}));
  const commonPlatformSkills = new Set(Object.keys((contract.common_platform_skills as Record<string, unknown>) ?? {}));

  // ── agents: templates/common/agents/*.md must be listed in common_agents ──
  // _COMMON.md is a shared frontmatter fragment injected into agent files, not a roster agent.
  const agentsDir = join(TEMPLATES_DIR, 'common', 'agents');
  if (existsSync(agentsDir)) {
    const unlistedAgents = readdirSync(agentsDir)
      .filter(f => f.endsWith('.md') && f !== '_COMMON.md')
      .map(f => f.replace(/\.md$/, ''))
      .filter(name => !commonAgents.has(name));
    if (unlistedAgents.length > 0) {
      fail('common', 'C-CM-04', `templates/common/agents/ has agent(s) not listed in common-contract.json common_agents: ${unlistedAgents.join(', ')}`, `Add the agent(s) to common-contract.json common_agents or remove them from templates/common/agents/`);
    } else {
      pass('C-CM-04: all templates/common/agents/*.md files are listed in common_agents');
    }
  }

  // ── skills: templates/common/skills/*/ must be listed in common_skills (or platform/country/variant exemptions) ──
  const skillsDir = join(TEMPLATES_DIR, 'common', 'skills');
  if (existsSync(skillsDir)) {
    const unlistedSkills = readdirSync(skillsDir).filter(e => {
      if (!existsSync(join(skillsDir, e, 'SKILL.md'))) return false; // non-skill entries (README etc.)
      return !commonSkills.has(e) && !commonPlatformSkills.has(e) && !exemptSkills.has(e);
    });
    if (unlistedSkills.length > 0) {
      fail('common', 'C-CM-04', `templates/common/skills/ has skill(s) not listed in common-contract.json common_skills: ${unlistedSkills.join(', ')}`, `Add the skill(s) to common_skills (or document them as country-scoped/variant-scoped in workspace-schema.json)`);
    } else {
      pass('C-CM-04: all templates/common/skills/ directories are listed in common_skills');
    }
  }

  // ── commands: templates/common/.claude|.gemini/commands/*.md + .codex/prompts/*.md
  // must be listed in common_commands (codex leg: spec site 3c, WARN soak) ──
  const unlistedCommands = new Set<string>();
  const unlistedCodexCommands = new Set<string>();
  for (const platformDir of ['.claude', '.gemini']) {
    const cmdDir = join(TEMPLATES_DIR, 'common', platformDir, 'commands');
    if (!existsSync(cmdDir)) continue;
    for (const f of readdirSync(cmdDir)) {
      if (!f.endsWith('.md')) continue;
      const name = f.replace(/\.md$/, '');
      if (!commonCommands.has(name)) unlistedCommands.add(name);
    }
  }
  const codexPromptsDir = join(TEMPLATES_DIR, 'common', '.codex', 'prompts');
  if (existsSync(codexPromptsDir)) {
    for (const f of readdirSync(codexPromptsDir)) {
      if (!f.endsWith('.md')) continue;
      const name = f.replace(/\.md$/, '');
      if (!commonCommands.has(name)) unlistedCodexCommands.add(name);
    }
  }
  if (unlistedCommands.size > 0) {
    fail('common', 'C-CM-04', `templates/common/.claude|.gemini/commands/ has command(s) not listed in common-contract.json common_commands: ${[...unlistedCommands].join(', ')}`, `Add the command(s) to common_commands with their source/gemini_source paths`);
  } else {
    pass('C-CM-04: all common command files are listed in common_commands');
  }
  if (unlistedCodexCommands.size > 0) {
    // TODO(promotion): flip to fail after soak (T-20261009 ticket)
    warn('common', 'C-CM-04', `templates/common/.codex/prompts/ has prompt(s) not listed in common-contract.json common_commands: ${[...unlistedCodexCommands].join(', ')} (soak: WARN until promotion)`, `Add the command(s) to common_commands with their source paths`);
  }

  // ── platform skills: templates/common/.{claude,gemini,agents,codex}/skills/*/
  // — WARN (aggregated), see doc comment. Sweep iterates all four mirror trees
  // (spec site 3d); filesystem-driven and name-keyed, so no contract keys needed.
  // Contract exclusions (common_platform_skill_exclusions) cover the rest —
  // full-inventory ruling T-20260924-002: every dir is listed, exempt, or
  // explicitly excluded; silent omission is gone.
  let platformTreesCovered = 0;
  let platformTreeCount = 0;
  const listedPlatformNames = new Set([...commonSkills, ...commonPlatformSkills]);
  for (const platform of PLATFORM_MIRROR_DIRS) {
    const platformDir = join(TEMPLATES_DIR, 'common', platform);
    if (!existsSync(platformDir)) continue;
    platformTreeCount++;
    const unlistedPlatform = unlistedPlatformSkillDirs(
      readdirSync(platformDir).filter(e => existsSync(join(platformDir, e, 'SKILL.md'))),
      listedPlatformNames,
      exemptSkills,
      platformSkillExclusions,
    );
    if (unlistedPlatform.length > 0) {
      warn('common', 'C-CM-04', `${unlistedPlatform.length} platform skill dir(s) under templates/common/${platform}/ are not in common_platform_skills or common_skills: ${unlistedPlatform.slice(0, 12).join(', ')}${unlistedPlatform.length > 12 ? `, +${unlistedPlatform.length - 12} more` : ''}`, `Decide the common_platform_skills inventory scope (full platform inventory vs override record) and list or exempt accordingly`);
    } else {
      platformTreesCovered++;
    }
  }
  // Exclusion anti-drift: an exclusion whose skill dir has vanished from every
  // mirror tree is stale — the record must be deleted with the directory.
  if (platformSkillExclusions.size > 0) {
    const existingPlatformSkillNames = new Set<string>();
    for (const platform of PLATFORM_MIRROR_DIRS) {
      const dir = join(TEMPLATES_DIR, 'common', platform);
      if (!existsSync(dir)) continue;
      for (const e of readdirSync(dir)) {
        if (existsSync(join(dir, e, 'SKILL.md'))) existingPlatformSkillNames.add(e);
      }
    }
    for (const name of stalePlatformSkillExclusions(platformSkillExclusions, existingPlatformSkillNames)) {
      fail('common', 'C-CM-04', `common-contract.json common_platform_skill_exclusions names '${name}' but no templates/common/.{claude,gemini,agents,codex}/skills/${name}/ directory exists — remove the stale exclusion`, `Delete the '${name}' entry from common-contract.json common_platform_skill_exclusions`);
    }
  }
  if (platformTreeCount > 0 && platformTreesCovered === platformTreeCount) {
    pass(`C-CM-04: all platform skill dirs are covered by common_platform_skills/common_skills (${platformTreesCovered}/${platformTreeCount} tree(s))`);
  }
}

// Check: mirror-hygiene (R6, spec 2026-09-25-verifier-platform-expansion-design)
// — a platform skill mirror contains ONLY skill directories. Stray files
// (SKILLS.md, README*.md — the 2026-09-25 Finding-B class: 11 files in 9
// variants) and non-skill directories are drift; the producer cannot re-emit
// them (generateSkillDirectories empty-rel guard), so the only correct state
// is absence. WARN during the ADR-0055 soak — TODO(promotion): flip to fail.
function checkMirrorHygiene(): void {
  if (!JSON_MODE) console.log('\n=== Check mirror-hygiene: platform skill mirrors carry only skill directories ===');
  let checked = 0;
  let findings = 0;
  const scanRoots: ReadonlyArray<readonly [string, string]> = [
    [join(TEMPLATES_DIR, 'common'), 'common'],
    ...readdirSync(TEMPLATES_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('co-'))
      .map(e => [join(TEMPLATES_DIR, e.name), e.name] as const),
  ];
  for (const [rootPath, label] of scanRoots) {
    for (const mirror of PLATFORM_MIRROR_DIRS) {
      const mirrorDir = join(rootPath, mirror);
      if (!existsSync(mirrorDir)) continue;
      checked++;
      for (const f of scanMirrorHygiene(mirrorDir)) {
        warn(label, 'mirror-hygiene', `templates/${label}/${mirror}/${f.entry} — mirrors contain only skill directories (${f.kind})`, `Delete templates/${label}/${mirror}/${f.entry} (sync-skills never re-emits non-skill entries)`);
        findings++;
      }
    }
  }
  if (!JSON_MODE) {
    if (checked === 0) console.log('  (no platform skill mirrors found)');
    else if (findings === 0) console.log(`  ✓ ${checked} mirror dir(s) clean: only skill directories present`);
  }
}

// Check VA-01: Phase Summary x Actual Agents Cross-Validation
function checkPhaseSummaryAgents(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check VA-01: Phase Summary agents cross-validation (${variant}) ===`);

  const agentsMdPath = join(TEMPLATES_DIR, variant, 'AGENTS.md');
  if (!existsSync(agentsMdPath)) {
    warn(variant, 'VA-01', `${variant}/AGENTS.md not found -- cannot validate Phase Summary agents`);
    return;
  }

  const content = readFileSync(agentsMdPath, 'utf-8');

  const SKIP_CELLS = new Set([
    '—', 'Specialist Agents', 'Orchestrator', 'Observer', 'Gate Keeper', 'Coordinator', 'Owner',
  ]);
  // Match data rows: | <digit(s)> | <Name> | <PM Facilitation> | <Specialist Agents> |
  const rowRegex = /^\|\s*\d+\s*\|[^|]*\|[^|]*\|([^|]+)\|/gm;
  let match: RegExpExecArray | null;
  const agentNames: string[] = [];

  while ((match = rowRegex.exec(content)) !== null) {
    const specialistCell = match[1].trim();
    // Skip header, PM-only, and role-name cells
    if (SKIP_CELLS.has(specialistCell) || specialistCell.includes('PM only') || specialistCell === '') continue;
    // Split on comma or literal <br> tag, not on individual characters
    const names = specialistCell.split(/,|<br\s*\/?>/).map((n: string) => n.trim()).filter(Boolean);
    for (const name of names) {
      const clean = name.replace(/[*_`—]/g, '').trim();
      // Only accept lowercase hyphen-separated identifiers (e.g. analyst, content-writer)
      if (clean && /^[a-z][a-z0-9-]*$/.test(clean)) {
        agentNames.push(clean);
      }
    }
  }

  if (agentNames.length === 0) {
    if (!JSON_MODE) console.log(`  (no specialist agents found in Phase Summary for ${variant})`);
    return;
  }

  for (const agentName of agentNames) {
    const agentFilePath = join(TEMPLATES_DIR, variant, 'agents', `${agentName}.md`);
    if (!existsSync(agentFilePath)) {
      fail(variant, 'VA-01', `Phase Summary references agent '${agentName}' but templates/${variant}/agents/${agentName}.md is missing`, `Create templates/${variant}/agents/${agentName}.md or remove the reference from the Phase Summary`);
    } else {
      pass(`VA-01: ${variant} Phase Summary agent '${agentName}' -- agents/${agentName}.md present`);
    }
  }
}

// Check VA-02: Workspace-Root Agent Intrusion Detection
function checkWorkspaceRootAgentIntrusion(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check VA-02: Workspace-root agent intrusion detection (${variant}) ===`);

  const agentsMdPath = join(TEMPLATES_DIR, variant, 'AGENTS.md');
  if (!existsSync(agentsMdPath)) {
    return; // VA-01 already warned about missing AGENTS.md
  }

  const WORKSPACE_ROOT_AGENTS = [
    'scaffolding-expert',
    'automation-engineer',
    'docs-writer',
    'security-expert',
    'architect',
    'auditor',
    'lifecycle-manager',
  ];

  const content = readFileSync(agentsMdPath, 'utf-8');

  const rowRegex = /^\|\s*\d+\s*\|[^|]*\|([^|]+)\|/gm;
  let match2: RegExpExecArray | null;

  while ((match2 = rowRegex.exec(content)) !== null) {
    const specialistCell = match2[1].trim();
    for (const wsAgent of WORKSPACE_ROOT_AGENTS) {
      if (specialistCell.includes(wsAgent)) {
        fail(variant, 'VA-02', `Workspace-root agent '${wsAgent}' referenced in ${variant}/AGENTS.md Phase Summary -- variants must use only their own agents`, `Remove '${wsAgent}' from the Phase Summary table in templates/${variant}/AGENTS.md`);
      }
    }
  }

  pass(`VA-02: ${variant} AGENTS.md Phase Summary workspace-root agent intrusion check complete`);
}

// Check VA-03: .claude/skills/ vs the other platform mirrors — 4-mirror parity
// (spec 2026-09-25-verifier-platform-expansion-design site 3e). The frontmatter
// skip marker is generalized: `mirror-parity: skip` means "claude-only parity"
// for ALL three non-claude mirrors; `gemini-parity: skip` is accepted as a
// legacy alias (same pattern as validate-md-language's i18n-format → lang:).
function checkSkillPlatformParity(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check VA-03: .claude/skills vs platform mirrors parity (${variant}) ===`);

  const claudeSkillsDir = join(TEMPLATES_DIR, variant, '.claude', 'skills');
  if (!existsSync(claudeSkillsDir)) {
    if (!JSON_MODE) console.log(`  (no .claude/skills/ directory for ${variant} -- skipping VA-03)`);
    return;
  }

  // [.gemini leg is pre-existing fail semantics; .agents/.codex legs are
  // net-new coverage soaking in WARN (ADR-0055) — TODO(promotion): flip to fail.]
  const counterpartMirrors: ReadonlyArray<readonly [string, boolean]> = [
    ['.gemini', false],
    ['.agents', true],
    ['.codex', true],
  ];

  let skillDirs: string[];
  try {
    skillDirs = readdirSync(claudeSkillsDir).filter(e => {
      try { return statSync(join(claudeSkillsDir, e)).isDirectory(); } catch { return false; }
    });
  } catch {
    warn(variant, 'VA-03', `Could not read ${variant}/.claude/skills/ directory`);
    return;
  }

  for (const skillName of skillDirs) {
    const skillMdPath = join(claudeSkillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;

    const raw = readFileSync(skillMdPath, 'utf-8');

    let frontmatter: Record<string, unknown> = {};
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      try {
        frontmatter = (load(fmMatch[1]) as Record<string, unknown>) ?? {};
      } catch { /* ignore parse errors */ }
    }

    const skipMarker =
      frontmatter['mirror-parity'] === 'skip' || frontmatter['gemini-parity'] === 'skip';
    if (skipMarker) {
      if (!JSON_MODE) console.log(`  VA-03: ${variant}/.claude/skills/${skillName} -- mirror-parity: skip (claude-only)`);
      continue;
    }

    for (const [mirror, soak] of counterpartMirrors) {
      const emit = soak ? warn : fail;
      const counterpartPath = join(TEMPLATES_DIR, variant, mirror, 'skills', skillName, 'SKILL.md');
      if (!existsSync(counterpartPath)) {
        emit(variant, 'VA-03', `${variant}/.claude/skills/${skillName}/SKILL.md exists but ${variant}/${mirror}/skills/${skillName}/SKILL.md is missing -- platform parity required${soak ? ' (soak: WARN until promotion)' : ''}`, `Create templates/${variant}/${mirror}/skills/${skillName}/SKILL.md or add 'mirror-parity: skip' to the SKILL.md frontmatter`);
      } else {
        pass(`VA-03: ${variant} skill '${skillName}' -- ${mirror}/skills counterpart present`);
      }
    }
  }
}

// Check VA-07: SKILL.md frontmatter version sync across a variant's platform
// mirrors (spec 2026-09-25-registry-policy-completeness-design.md R3, the
// verifier-expansion design §17.1 accepted advisory A1 follow-up). Primary
// rule: mirror-to-mirror equality per skill (present in >= 2 mirrors, version
// via extractFrontmatterVersion; a missing version is a finding — fail-closed).
// Secondary rule: when the variant's curated skills/SKILLS.md registry yields a
// row for the skill, each present mirror's version must equal the row version
// (mirror-only adapted copies have no row and are out of scope by
// construction — e.g. the WS-05a adapted set). Exemption: the VA-03 vocabulary
// (`mirror-parity: skip`, legacy `gemini-parity: skip`) excludes the skill.
// Severity: WARN per ADR-0055 soak.
// TODO(promotion): flip VA-07 findings to fail when
// tickets/governance/T-20260925-006.yaml promotes (not_before 2026-10-09).
export interface MirrorVersionMismatch {
  skill: string;
  message: string;
}

const VA07_MIRROR_DIRS = ['.claude', '.gemini', '.agents', '.codex'] as const;

/**
 * Pure core of VA-07 (T-004 convention): enumerate the union of skill dirs
 * across the variant's existing platform-mirror `skills/` trees and collect
 * version-sync findings. Reads only; emits nothing.
 */
export function collectMirrorVersionMismatches(variantDir: string, variant: string): MirrorVersionMismatch[] {
  const findings: MirrorVersionMismatch[] = [];

  // Authored registry rows (curated SKILLS.md) — the secondary cross-check's
  // expected versions. An unparseable/absent registry simply contributes no rows.
  const registryRows = new Map<string, string>();
  const registryPath = join(variantDir, 'skills', 'SKILLS.md');
  if (existsSync(registryPath)) {
    try {
      const { rows } = parseSkillRegistryRows(readFileSync(registryPath, 'utf-8'));
      for (const [name, row] of rows) registryRows.set(name, row.version);
    } catch { /* unreadable registry — no cross-check rows */ }
  }

  // skill name -> mirror -> frontmatter version (undefined = present but unparseable)
  const versionsBySkill = new Map<string, Map<string, string | undefined>>();
  for (const mirror of VA07_MIRROR_DIRS) {
    const skillsDir = join(variantDir, mirror, 'skills');
    if (!existsSync(skillsDir)) continue;
    let skillDirs: string[];
    try {
      skillDirs = readdirSync(skillsDir).filter(e => {
        try { return statSync(join(skillsDir, e)).isDirectory(); } catch { return false; }
      });
    } catch { continue; }
    for (const skill of skillDirs) {
      const skillMdPath = join(skillsDir, skill, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;
      let version: string | undefined;
      try {
        const raw = readFileSync(skillMdPath, 'utf-8');
        version = extractFrontmatterVersion(raw);
        // VA-03 exemption vocabulary — one exemption language for the file class.
        const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          let fm: Record<string, unknown> = {};
          try { fm = (load(fmMatch[1]) as Record<string, unknown>) ?? {}; } catch { /* ignore */ }
          if (fm['mirror-parity'] === 'skip' || fm['gemini-parity'] === 'skip') continue;
        }
      } catch { /* unreadable SKILL.md — treated as missing version */ }
      if (!versionsBySkill.has(skill)) versionsBySkill.set(skill, new Map());
      versionsBySkill.get(skill)!.set(mirror, version);
    }
  }

  for (const [skill, byMirror] of versionsBySkill) {
    if (byMirror.size < 2) continue; // VA-03 owns presence; VA-07 compares versions
    const present = [...byMirror.entries()];
    const versionList = present.map(([m, v]) => `${m}=${v ?? '(missing)'}`).join(', ');

    if (present.some(([, v]) => v === undefined)) {
      findings.push({
        skill,
        message: `${variant}/skills/${skill}: a platform-mirror SKILL.md has no parseable frontmatter version (${versionList})`,
      });
      continue; // mirror-to-mirror comparison is meaningless until versions parse
    }

    const [[baseMirror, baseVersion], ...rest] = present as Array<[string, string]>;
    const divergent = rest.find(([, v]) => v !== baseVersion);
    if (divergent) {
      findings.push({
        skill,
        message: `${variant}/skills/${skill}: SKILL.md frontmatter version differs across platform mirrors (${baseMirror}=${baseVersion}, ${divergent[0]}=${divergent[1]}; all: ${versionList})`,
      });
    }

    // Secondary rule: registry cross-check (only when a curated row exists —
    // mirror-only adapted copies are skipped by construction).
    const rowVersion = registryRows.get(skill);
    if (rowVersion !== undefined) {
      for (const [mirror, version] of present as Array<[string, string]>) {
        if (version !== rowVersion) {
          findings.push({
            skill,
            message: `${variant}/${mirror}/skills/${skill}/SKILL.md version ${version} != ${variant}/skills/SKILLS.md registry row version ${rowVersion}`,
          });
        }
      }
    }
  }

  return findings;
}

/** VA-07 wrapper — wired immediately after checkSkillPlatformParity (VA-03 family). */
function checkSkillMirrorVersionSync(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check VA-07: skill version sync across platform mirrors (${variant}) ===`);
  const findings = collectMirrorVersionMismatches(join(TEMPLATES_DIR, variant), variant);
  // WARN soak per ADR-0055 — severity flip is ticket-gated (T-20260925-006).
  for (const f of findings) {
    warn(variant, 'VA-07', `${f.message} (soak: WARN until promotion)`, `Align the SKILL.md frontmatter version across all platform mirrors of ${variant} (and the curated registry row)`);
  }
  if (findings.length === 0) {
    pass(`VA-07: ${variant} -- mirror skill versions in sync (mirrors and registry rows)`);
  }
}

// Check VA-08: skill registry tables vs the SKILL.md frontmatter they
// document (spec 2026-09-25-registry-policy-completeness-design.md W5/R5.6).
// One cross-surface pass via collectWorkspaceRegistryFindings (skills-registry
// helper v1.2.0): root Workspace Skills rows, the root Variant-Exclusive
// catalog, the common scaffold seed, and each curated variant registry.
// Remediation path: `bun scripts/sync-skill-registries.ts` (dev-sync Step
// 4.63 re-converges on every /sync). Severity: WARN per ADR-0055 soak.
// TODO(promotion): flip VA-08 findings to fail when
// tickets/governance/T-20260925-007.yaml promotes (not_before 2026-10-09).
function checkSkillRegistrySync(): void {
  if (!JSON_MODE) console.log(`\n=== Check VA-08: skill registry tables match SKILL.md frontmatter ===`);
  const findings = collectWorkspaceRegistryFindings(ROOT);
  // WARN soak per ADR-0055 — severity flip is ticket-gated (T-20260925-007).
  for (const f of findings) {
    warn('registries', 'VA-08', `${f.message} (soak: WARN until promotion)`, 'Run: bun scripts/sync-skill-registries.ts (dev-sync Step 4.63 re-converges on every /sync)');
  }
  if (findings.length === 0) {
    pass('VA-08: all skill registry tables match SKILL.md frontmatter');
  }
}

// Check WS-03: Common-Contract common_skills must be present in templates/common/skills/
// common_skills are project skills (L0+L1+L2), provided by templates/common/skills/ at scaffold time.
// They are NOT expected in templates/co-*/skills/ (empty delta after fork) nor in .claude/skills/.
// Per-variant variant_specific skills are still verified against the variant's .claude/skills/.
function checkCommonContractVariantSkills(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check WS-03: Common-contract x variant .claude/skills cross-validation (${variant}) ===`);

  const contractPath = join(ROOT, 'docs', 'templates', 'common-contract.json');
  if (!existsSync(contractPath)) {
    return; // WS-02 already warned about missing contract
  }

  let contract: Record<string, unknown>;
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return; // WS-02 already reported invalid JSON
  }

  const commonSkills = Object.keys((contract.common_skills as Record<string, unknown>) ?? {});

  // common_skills are delivered via templates/common/skills/ — check there, NOT in each variant
  // This check runs once per variant call but only needs to validate the common layer once.
  // We gate it on variant === first stable variant to avoid repeating; simpler: always check, pass is idempotent.
  const commonSkillsBase = join(TEMPLATES_DIR, 'common', 'skills');
  for (const skillName of commonSkills) {
    const skillPath = join(commonSkillsBase, skillName, 'SKILL.md');
    if (!existsSync(skillPath)) {
      warn('common', 'WS-03', `Common skill '${skillName}' (from common-contract.json) is missing from templates/common/skills/${skillName}/SKILL.md`, `Create templates/common/skills/${skillName}/SKILL.md`);
    } else {
      pass(`WS-03: common skill '${skillName}' → templates/common/skills/${skillName}/SKILL.md present`);
    }
  }

  // Check variant_specific skills from variant.json (still against .claude/skills/ — platform skills)
  const claudeSkillsDir = join(TEMPLATES_DIR, variant, '.claude', 'skills');
  const variantJsonPath = join(TEMPLATES_DIR, variant, 'variant.json');
  if (!existsSync(variantJsonPath)) return;

  let variantJson: Record<string, unknown>;
  try {
    variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8')) as Record<string, unknown>;
  } catch { return; }

  const skillManifest = variantJson.skill_manifest as Record<string, unknown> | undefined;
  const variantSpecificSkills = (skillManifest?.variant_specific as Array<{ name: string }> | undefined) ?? [];

  for (const entry of variantSpecificSkills) {
    const skillName = entry.name;
    const skillMdPath = join(claudeSkillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillMdPath)) {
      fail(variant, 'WS-03', `variant.json skill_manifest.variant_specific lists '${skillName}' but templates/${variant}/.claude/skills/${skillName}/SKILL.md is missing`, `Create templates/${variant}/.claude/skills/${skillName}/SKILL.md or remove from variant_specific in variant.json`);
    } else {
      pass(`WS-03: ${variant} -- variant_specific skill '${skillName}' SKILL.md present`);
    }
  }
}

// Check VA-04: Platform settings parity
function getNestedKey(obj: Record<string, unknown>, dotKey: string): unknown {
  const parts = dotKey.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function checkPlatformSettingsParity(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check VA-04: Platform settings parity (${variant}) ===`);

  const contractPath = join(ROOT, 'docs', 'templates', 'common-contract.json');
  if (!existsSync(contractPath)) {
    return; // WS-02 already warned about missing contract
  }

  let contract: Record<string, unknown>;
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return; // WS-02 already reported invalid JSON
  }

  const platformSettings = contract.platform_settings as Record<string, unknown> | undefined;
  if (!platformSettings) {
    if (!JSON_MODE) console.log(`  (no platform_settings in common-contract.json -- skipping VA-04)`);
    return;
  }

  const sharedKeys = Object.keys((platformSettings.shared as Record<string, unknown> | undefined)?.keys as Record<string, unknown> ?? {});
  const claudeOnlyKeys = Object.keys((platformSettings.claude_only as Record<string, unknown> | undefined)?.keys as Record<string, unknown> ?? {});

  const claudeSettingsPath = join(TEMPLATES_DIR, variant, '.claude', 'settings.json');
  const geminiSettingsPath = join(TEMPLATES_DIR, variant, '.gemini', 'settings.json');

  let claudeSettings: Record<string, unknown> | null = null;
  let geminiSettings: Record<string, unknown> | null = null;

  if (!existsSync(claudeSettingsPath)) {
    warn(variant, 'VA-04', `templates/${variant}/.claude/settings.json is missing -- cannot verify shared settings parity`);
  } else {
    try {
      claudeSettings = JSON.parse(readFileSync(claudeSettingsPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      warn(variant, 'VA-04', `templates/${variant}/.claude/settings.json is invalid JSON`);
    }
  }

  if (!existsSync(geminiSettingsPath)) {
    warn(variant, 'VA-04', `templates/${variant}/.gemini/settings.json is missing -- cannot verify shared settings parity`);
  } else {
    try {
      geminiSettings = JSON.parse(readFileSync(geminiSettingsPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      warn(variant, 'VA-04', `templates/${variant}/.gemini/settings.json is invalid JSON`);
    }
  }

  for (const key of sharedKeys) {
    if (claudeSettings !== null) {
      if (getNestedKey(claudeSettings, key) === undefined) {
        warn(variant, 'VA-04', `Shared key '${key}' is missing from templates/${variant}/.claude/settings.json`);
      } else {
        pass(`VA-04: ${variant} -- shared key '${key}' present in .claude/settings.json`);
      }
    }
    if (geminiSettings !== null) {
      if (getNestedKey(geminiSettings, key) === undefined) {
        warn(variant, 'VA-04', `Shared key '${key}' is missing from templates/${variant}/.gemini/settings.json`);
      } else {
        pass(`VA-04: ${variant} -- shared key '${key}' present in .gemini/settings.json`);
      }
    }
  }

  // claude_only keys should NOT appear in .gemini/settings.json
  if (geminiSettings !== null) {
    for (const key of claudeOnlyKeys) {
      if (getNestedKey(geminiSettings, key) !== undefined) {
        warn(variant, 'VA-04', `Claude-only key '${key}' was found in templates/${variant}/.gemini/settings.json -- incorrect parity attempt`);
      }
    }
  }
}

// Helper: extract sections marked with <!-- MARKERNAME:START --> ... <!-- MARKERNAME:END -->
function extractMarkedSections(content: string, markerName: string): Array<{heading: string, content: string}> {
  const startTag = `<!-- ${markerName}:START -->`;
  const endTag = `<!-- ${markerName}:END -->`;
  const sections: Array<{heading: string, content: string}> = [];
  let pos = 0;
  while (true) {
    const startIdx = content.indexOf(startTag, pos);
    if (startIdx === -1) break;
    const endIdx = content.indexOf(endTag, startIdx);
    if (endIdx === -1) break;
    const block = content.slice(startIdx + startTag.length, endIdx).trim();
    const headingMatch = block.match(/^#{1,4}\s+.+$/m);
    const heading = headingMatch ? headingMatch[0].trim() : `section-${sections.length}`;
    sections.push({ heading, content: block });
    pos = endIdx + endTag.length;
  }
  return sections;
}

// Check MM-01: Model-ID literal placement (ADR-0077 D11). Model IDs may appear ONLY inside
// managed marker sections (COMMON-*:START/END, WORKSPACE-MANAGED) of the four instruction
// twins at L0/L1 — those are the only regions MERGE/marker-inject passes deliver downstream.
// A literal outside a managed section silently stalls at its layer on the next model refresh.
function checkModelLiteralPlacement(): void {
  if (!JSON_MODE) console.log(`\n=== Check MM-01: Model literal placement (instruction twins) ===`);
  const LITERAL = /\b(?:gpt-5\.6-(?:sol|terra|luna)|claude-opus-5-0|claude-sonnet-5-0|claude-haiku-4-5|gemini-3\.\d+(?:\.\d+)?-(?:pro|flash))\b/i;
  const STARTS = /<!--\s*(?:COMMON-(?:CLAUDE|GEMINI|CODEX|AGENTS):START|WORKSPACE-MANAGED:[^>]*?)\s*-->/;
  const ENDS = /<!--\s*(?:\/WORKSPACE-MANAGED|COMMON-(?:CLAUDE|GEMINI|CODEX|AGENTS):END)\s*-->/;
  const files = [
    'CLAUDE.md', 'GEMINI.md', 'CODEX.md', 'AGENTS.md',
    'templates/common/CLAUDE.md', 'templates/common/GEMINI.md',
    'templates/common/CODEX.md', 'templates/common/AGENTS.md',
  ];
  let hits = 0;
  for (const rel of files) {
    const p = join(ROOT, rel);
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, 'utf-8').split('\n');
    let inside = false;
    for (let i = 0; i < lines.length; i++) {
      if (STARTS.test(lines[i])) inside = true;
      if (ENDS.test(lines[i])) inside = false;
      if (!inside && LITERAL.test(lines[i])) {
        fail('common', 'model-literal-outside-managed-section', `${rel}:${i + 1} — model ID outside a managed marker section will not propagate (wrap it in COMMON-*/WORKSPACE-MANAGED markers or drop the literal)`);
        hits++;
      }
    }
  }
  if (hits === 0) pass('Model literal placement: all instruction-twin literals inside managed sections');
}

// Check VA-05: CLAUDE.md and GEMINI.md common section sync between workspace root and variant files
function checkDocumentCommonSections(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check VA-05: Document common section sync (${variant}) ===`);

  const docFiles: Array<{ file: string; markerName: string }> = [
    { file: 'CLAUDE.md', markerName: 'COMMON-CLAUDE' },
    { file: 'GEMINI.md', markerName: 'COMMON-GEMINI' },
    { file: 'CODEX.md', markerName: 'COMMON-CODEX' },
  ];

  for (const { file: docFile, markerName } of docFiles) {
    const rootPath = join(ROOT, docFile);
    const variantPath = join(TEMPLATES_DIR, variant, docFile);

    if (!existsSync(rootPath) || !existsSync(variantPath)) continue;

    const rootContent = normalizeContent(readFileSync(rootPath, 'utf-8'));
    const variantContent = normalizeContent(readFileSync(variantPath, 'utf-8'));

    const rootSections = extractMarkedSections(rootContent, markerName);
    if (rootSections.length === 0) continue; // root has no markers — pass silently

    for (const { heading, content: rootBlock } of rootSections) {
      // Find the same marker block in the variant file
      const variantSections = extractMarkedSections(variantContent, markerName);
      const variantSection = variantSections.find(s => s.heading === heading);

      if (!variantSection) {
        warn(variant, 'VA-05', `${docFile}: common section "${heading}" is not marked for sync in variant — run 'bun run propagate:docs' to sync`, `bun run propagate:docs`);
      } else if (variantSection.content !== rootBlock) {
        warn(variant, 'VA-05', `${docFile}: common section "${heading}" differs from root — run 'bun run propagate:docs' to sync`, `bun run propagate:docs`);
      } else {
        pass(`VA-05: ${variant} ${docFile} common section "${heading}" in sync`);
      }
    }
  }
}

// Check VA-06: cross-twin common section parity (ADR-0077 twin doctrine).
// VA-05 compares each twin root↔variant-template per file, so a policy section
// added to two twins but never ported to the third was invisible (the 2026-09
// CODEX.md Language Policy gap). The three instruction twins must each carry
// the shared policy set — checked by anchor substring, not full content
// equality, because platform-specific sections legitimately differ.
const TWIN_FILES = ['CLAUDE.md', 'GEMINI.md', 'CODEX.md'];
const TWIN_COMMON_ANCHORS = [
  'Language Policy for Documentation',
  'Execution Plan Boilerplate',
  'Cost Optimization (3-Tier Model Strategy)',
  'Custom Command Error Recovery',
  'Windows Platform Requirement',
  'Git & PR Additions',
];

function checkTwinCommonSectionParity(): void {
  if (!JSON_MODE) console.log(`\n=== Check VA-06: Cross-twin common section parity ===`);
  const layers = [
    { label: 'root', dir: ROOT, variant: 'root' },
    { label: 'templates/common', dir: join(TEMPLATES_DIR, 'common'), variant: 'common' },
  ];
  for (const layer of layers) {
    for (const file of TWIN_FILES) {
      const twinPath = join(layer.dir, file);
      if (!existsSync(twinPath)) {
        fail(layer.variant, 'VA-06', `${layer.label}/${file}: platform twin not found — ADR-0077 requires all three instruction twins`, 'Restore the twin from its sibling platforms or templates/common');
        continue;
      }
      const content = readFileSync(twinPath, 'utf-8');
      for (const anchor of TWIN_COMMON_ANCHORS) {
        if (!content.includes(anchor)) {
          fail(layer.variant, 'VA-06', `${layer.label}/${file}: common policy section "${anchor}" missing — the instruction twins must all carry the shared policy set`, `Port the section from a sibling twin (see ${layer.dir === ROOT ? 'CLAUDE.md' : 'templates/common/CLAUDE.md'}) — governance-l1 then deploys it (bun run propagate:governance)`);
        } else {
          pass(`VA-06: ${layer.label}/${file} carries "${anchor}"`);
        }
      }
    }
  }
}

// Check WS-04: L0 scripts must NOT exist in templates/co-*/scripts/
function checkL0ScriptsNotInVariants(variant: string, scriptLayerMap: Map<string, import('./helpers/layer-filter.js').LayerValue>): void {
  if (!JSON_MODE) console.log(`\n=== Check WS-04: L0 scripts must not exist in ${variant}/scripts/ ===`);

  const variantScriptsDir = join(TEMPLATES_DIR, variant, 'scripts');
  if (!existsSync(variantScriptsDir)) return;

  function scanRecursive(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        scanRecursive(fullPath);
      } else if (entry.endsWith('.ts') || entry.endsWith('.sh') || entry.endsWith('.ps1')) {
        const layer = getScriptLayer(entry, scriptLayerMap);
        if (layer === 'L0') {
          const relFile = fullPath.slice(join(TEMPLATES_DIR, variant, 'scripts').length + 1).replace(/\\/g, '/');
          fail(variant, 'WS-04', `templates/${variant}/scripts/${relFile} is classified L0 — must not exist in variant template`, `Remove templates/${variant}/scripts/${relFile}`);
        }
      }
    }
  }

  scanRecursive(variantScriptsDir);
}

// Check WS-05: L0+L1 scripts must NOT exist in templates/co-*/scripts/ (flat root only)
function checkL0L1ScriptsNotInVariants(variant: string, scriptLayerMap: Map<string, import('./helpers/layer-filter.js').LayerValue>): void {
  if (!JSON_MODE) console.log(`\n=== Check WS-05: L0+L1 scripts must not exist in ${variant}/scripts/ (flat) ===`);

  const variantScriptsDir = join(TEMPLATES_DIR, variant, 'scripts');
  if (!existsSync(variantScriptsDir)) return;

  for (const entry of readdirSync(variantScriptsDir)) {
    const fullPath = join(variantScriptsDir, entry);
    if (statSync(fullPath).isDirectory()) continue;
    if (!entry.endsWith('.ts') && !entry.endsWith('.sh') && !entry.endsWith('.ps1')) continue;
    const layer = getScriptLayer(entry, scriptLayerMap);
    if (layer === 'L0+L1') {
      warn(variant, 'WS-05', `templates/${variant}/scripts/${entry} is L0+L1 — redundant copy (managed in templates/common/scripts/)`, `Remove templates/${variant}/scripts/${entry} — it is inherited from templates/common/scripts/`);
    }
  }
}

// Check WS-05a: variant command/skill markdown must not give actionable L0-only tool commands.
function checkL0OnlyToolRefsInVariantCommandSkills(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check WS-05a: L0-only tool refs in ${variant} command/skill files ===`);

  const scanRoots = [
    join(TEMPLATES_DIR, variant, '.claude', 'commands'),
    join(TEMPLATES_DIR, variant, '.gemini', 'commands'),
    join(TEMPLATES_DIR, variant, '.agents', 'commands'),
    join(TEMPLATES_DIR, variant, '.claude', 'skills'),
    join(TEMPLATES_DIR, variant, '.gemini', 'skills'),
    join(TEMPLATES_DIR, variant, '.agents', 'skills'),
    join(TEMPLATES_DIR, variant, 'skills'),
  ];
  const forbidden = /\b(?:bun\s+scripts\/)?(?:validate-templates|propagate-to-templates|ticket)\.ts\b|\bbun\s+scripts\/(?:validate-templates|propagate-to-templates|ticket)\b/g;
  let checked = 0;

  function scanRecursive(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        scanRecursive(fullPath);
        continue;
      }
      if (!entry.endsWith('.md')) continue;

      checked++;
      const relFile = relative(ROOT, fullPath).replace(/\\/g, '/');
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        forbidden.lastIndex = 0;
        const matches = [...lines[i].matchAll(forbidden)].map(m => m[0]);
        if (matches.length === 0) continue;
        fail(
          variant,
          'WS-05a',
          `${relFile}:${i + 1} references L0-only workspace tooling (${Array.from(new Set(matches)).join(', ')})`,
          'Replace actionable references with project-local audit/verify commands, or describe the workspace-only gate without naming the L0-only script.'
        );
      }
    }
  }

  for (const root of scanRoots) {
    if (existsSync(root)) scanRecursive(root);
  }

  if (checked > 0) pass(`WS-05a: ${variant} command/skill markdown has no L0-only tool references (${checked} file(s) checked)`);
}

// ============================================================================
// T-20260924-007c: unresolvable agent-reference detector
// (spec: docs/designs/2026-09-25-variant-hygiene-batch-design.md, R4)
//
// Sibling of T-20260924-004's checkVariantMirrorParity/classifyVariantMirrorCopy
// — that check covers skill platform-mirror DIRECTORIES and version comparison;
// this one covers agent-name REFERENCES in variant AGENTS.md prose and variant
// scripts. The live instance: 10 variant AGENTS.md copies + co-abap setup.ts
// routed work to a phantom stack setup agent the variant never shipped (user-facing
// broken guidance, invisible to every standing detector). Distinct inputs, no
// shared logic beyond the variant iteration loop.
//
// Pure cores are exported for tests/unit/variant-agent-reference.test.ts
// (T-004 convention: decision table + injected-phantom fixture).
// ============================================================================

/** Explicit exemption list (R4 escape hatch): agent names allowed to appear in
 *  variant deliverables without a resolvable agent file. Keep minimal — every
 *  entry needs a written justification here. Names that resolve at any of the
 *  three trees never need an entry. */
const AGENT_REFERENCE_EXEMPT = new Set<string>([
  // (empty at v1.42.0 — the healed fleet resolves cleanly)
]);

export type AgentReferenceVerdict = 'resolved' | 'unresolved';

/** Pure resolution decision: a reference resolves when the name is exempt or
 *  an agent file exists at the variant, common, or workspace-root agents/ tree
 *  (resolution order per design R4). */
export function classifyAgentReference(opts: {
  name: string;
  inVariantAgents: boolean;  // templates/<v>/agents/<name>.md exists
  inCommonAgents: boolean;   // templates/common/agents/<name>.md exists
  inRootAgents: boolean;     // agents/<name>.md exists (L0)
  exempt: boolean;           // name on AGENT_REFERENCE_EXEMPT
}): AgentReferenceVerdict {
  if (opts.exempt) return 'resolved';
  if (opts.inVariantAgents || opts.inCommonAgents || opts.inRootAgents) return 'resolved';
  return 'unresolved';
}

export interface AgentReferenceCandidate {
  /** Extracted agent name. */
  name: string;
  /** 1-based line number of the reference (for WARN file:line naming). */
  line: number;
}

// Reference shape 1: `agents/<name>.md` path references (prose links, code
// strings, roster rows). Underscore-leading internal fragments (agents/_COMMON)
// are not agent references and don't match.
const AGENT_PATH_REF_RE = /\bagents\/([A-Za-z0-9][A-Za-z0-9_-]*)\.md\b/g;
// Reference shape 2: backtick-adjacent `<name>` agent mentions ("the
// stack setup agent").
const AGENT_BACKTICK_MENTION_RE = /`([A-Za-z0-9][A-Za-z0-9_-]*)`\s+agents?\b/g;

/** Pure extraction: every agent-reference candidate in one file's content,
 *  deduplicated per (name, line). */
export function extractAgentReferenceCandidates(content: string): AgentReferenceCandidate[] {
  const candidates: AgentReferenceCandidate[] = [];
  const seen = new Set<string>();
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(AGENT_PATH_REF_RE)) {
      const key = `${m[1]}:${i + 1}`;
      if (!seen.has(key)) { seen.add(key); candidates.push({ name: m[1], line: i + 1 }); }
    }
    for (const m of lines[i].matchAll(AGENT_BACKTICK_MENTION_RE)) {
      const key = `${m[1]}:${i + 1}`;
      if (!seen.has(key)) { seen.add(key); candidates.push({ name: m[1], line: i + 1 }); }
    }
  }
  return candidates;
}

/** Check: variant-agent-references — agent references in templates/<v>/AGENTS.md
 *  and the variant scripts tree (.ts files, recursive) must resolve at
 *  templates/<v>/agents/, templates/common/agents/, or the workspace-root
 *  agents/. WARN-mode per ADR-0055 soak (dated promotion ticket filed at
 *  implementation). */
function checkVariantAgentReferences(variant: string, opts?: {
  /** Directory-root override for fixture tests (defaults to the real templates/). */
  templatesDir?: string;
  /** Finding sink override for fixture tests (defaults to the module warn()). */
  report?: (finding: string) => void;
}): void {
  const templatesDir = opts?.templatesDir ?? TEMPLATES_DIR;
  const quiet = opts !== undefined;
  const FIX =
    'Fix the reference so it names an agent that exists at templates/<variant>/agents/, templates/common/agents/, or the workspace-root agents/ — or remove it. A legitimately agent-shaped name that must stay unresolvable goes on AGENT_REFERENCE_EXEMPT with a justification.';
  const report = opts?.report ?? ((finding: string) => warn(variant, 'variant-agent-references', finding, FIX));

  if (!quiet && !JSON_MODE) {
    console.log(`\n=== Check T-007c: agent references resolve in ${variant} AGENTS.md and scripts ===`);
  }

  const variantAgentsDir = join(templatesDir, variant, 'agents');
  const commonAgentsDir = join(TEMPLATES_DIR, 'common', 'agents');
  const rootAgentsDir = join(ROOT, 'agents');
  const resolves = (name: string): boolean =>
    existsSync(join(variantAgentsDir, `${name}.md`)) ||
    existsSync(join(commonAgentsDir, `${name}.md`)) ||
    existsSync(join(rootAgentsDir, `${name}.md`));

  // Scan set: the variant's AGENTS.md + every .ts under its scripts/ tree.
  const scanFiles: Array<{ abs: string; rel: string }> = [];
  const agentsMd = join(templatesDir, variant, 'AGENTS.md');
  if (existsSync(agentsMd)) scanFiles.push({ abs: agentsMd, rel: `templates/${variant}/AGENTS.md` });
  const scriptsDir = join(templatesDir, variant, 'scripts');
  const walkTs = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walkTs(full); continue; }
      if (entry.name.endsWith('.ts')) scanFiles.push({ abs: full, rel: relative(ROOT, full).replace(/\\/g, '/') });
    }
  };
  walkTs(scriptsDir);

  let unresolvedCount = 0;
  let candidatesChecked = 0;
  for (const file of scanFiles) {
    let content: string;
    try { content = readFileSync(file.abs, 'utf-8'); } catch { continue; }
    for (const candidate of extractAgentReferenceCandidates(content)) {
      candidatesChecked++;
      const verdict = classifyAgentReference({
        name: candidate.name,
        inVariantAgents: existsSync(join(variantAgentsDir, `${candidate.name}.md`)),
        inCommonAgents: existsSync(join(commonAgentsDir, `${candidate.name}.md`)),
        inRootAgents: existsSync(join(rootAgentsDir, `${candidate.name}.md`)),
        exempt: AGENT_REFERENCE_EXEMPT.has(candidate.name),
      });
      if (verdict === 'resolved') continue;
      unresolvedCount++;
      report(`${file.rel}:${candidate.line} references agent "${candidate.name}" — no templates/${variant}/agents/${candidate.name}.md, no templates/common/agents/${candidate.name}.md, no agents/${candidate.name}.md`);
    }
  }

  if (!quiet && unresolvedCount === 0 && scanFiles.length > 0) {
    pass(`variant-agent-references: ${variant} agent references all resolve (${candidatesChecked} candidate(s) in ${scanFiles.length} file(s))`);
  }
}

// Check WS-06: Skills in templates/co-*/skills/ must be variant-scoped (L0+L2)
function checkVariantSkillsLayer(variant: string, _skillLayerMap: Map<string, import('./helpers/layer-filter.js').LayerValue>): void {
  if (!JSON_MODE) console.log(`\n=== Check WS-06: Variant skills must be L0+L2 in ${variant}/skills/ ===`);

  const variantSkillsDir = join(TEMPLATES_DIR, variant, 'skills');
  if (!existsSync(variantSkillsDir)) return;

  // Domain-only skills live exclusively under templates/co-*/skills/ with no
  // templates/common/skills/ base — their layer is declared in their own SKILL.md
  // `scope:` frontmatter (see ADR-0032 §7, skills/SKILLS.md), not in the root
  // skills/ registry. Read frontmatter directly from this variant's own directory
  // rather than the workspace-root skill map, which never contains these files.
  const variantSkillLayerMap = parseSkillLayers(variantSkillsDir);

  for (const entry of collectSkillDirs(variantSkillsDir, variantSkillsDir)) {
    const layer = getSkillLayer(entry, variantSkillLayerMap);
    if (layer !== 'L0+L2') {
      warn(variant, 'WS-06', `templates/${variant}/skills/${entry} is not declared L0+L2`, `Add 'scope: ${variant}' to templates/${variant}/skills/${entry}/SKILL.md if it's a genuine domain-specific skill, or move it to templates/common/skills/${basename(entry)}/ if it should be shared across all variants`);
    }
  }
}

// Check WS-07: Variants MUST NOT carry common-owned scaffold files — the
// SCAFFOLD_COMMON_OWNED_FILES classification in lib/upgrade-policy.ts (the
// same SSOT new-project's variant overlay skips, T-20260917-009). Owned
// solely by templates/common/ and copied into every project at scaffold time.
function checkNoVariantLocalContextMd(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check WS-07: ${variant} must not carry common-owned scaffold files (SCAFFOLD_COMMON_OWNED_FILES) ===`);

  for (const relFile of [...SCAFFOLD_COMMON_OWNED_FILES].sort()) {
    const variantFile = join(TEMPLATES_DIR, variant, ...relFile.split('/'));
    if (existsSync(variantFile)) {
      const hint = relFile === 'docs/context.md'
        ? `Delete templates/${variant}/${relFile}; move any variant-specific content into docs/${variant}.context.md`
        : `Delete templates/${variant}/${relFile} — the common copy is the single source of record`;
      fail(variant, 'WS-07', `templates/${variant}/${relFile} must not exist — it is classified SCAFFOLD_COMMON_OWNED_FILES in lib/upgrade-policy.ts (owned solely by templates/common, copied into every project at scaffold time, and skipped by the variant overlay)`, hint);
    } else {
      pass(`WS-07: ${variant} has no local ${relFile} (inherits common's)`);
    }
  }
}

// T-20260916-010: variant templates must NOT ship docs/VERSION_MANIFEST.md.
// The stub class is retired: a stub tripped both the project audit's
// skills↔manifest parity check and the VERSION_MANIFEST --check drift gate in
// the fresh-scaffold test (2026-09-16), while co-abap/co-price shipped no stub
// at all — inconsistent either way. The project's steady-state manifest is the
// FULL generated one, produced post-delivery (new-project.ts §7.8) and
// regenerated post-upgrade (upgrade-project.ts); the path is classified
// REGENERATED in lib/upgrade-policy.ts so it is never template-delivered.
// Also arms the check against a future FULL manifest leaking into a template
// (it would go stale in template CI — the reason generation is
// scaffold/upgrade-owned), making the 11/13 divergence class impossible.
function checkNoVariantVersionManifest(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check T-010: ${variant} must not ship docs/VERSION_MANIFEST.md ===`);

  const manifestPath = join(TEMPLATES_DIR, variant, 'docs', 'VERSION_MANIFEST.md');
  if (existsSync(manifestPath)) {
    fail(variant, 'variant-version-manifest', `templates/${variant}/docs/VERSION_MANIFEST.md must not exist — the manifest is generated state, not template content: new-project.ts §7.8 runs the project's own scripts/generate-version-manifest.ts after delivery and upgrade-project.ts regenerates it on upgrade (lib/upgrade-policy.ts classifies it REGENERATED)`, `Delete templates/${variant}/docs/VERSION_MANIFEST.md (stub or otherwise) — scaffolds and upgrades generate the full manifest in-project`);
  } else {
    pass(`variant-version-manifest: ${variant} ships no docs/VERSION_MANIFEST.md (generated in-project)`);
  }
}

// Check PM-04: managed-block parity (T-20260916-009; extended to all
// MERGE_MANAGED files by T-20260917-001).
// Every `<!-- WORKSPACE-MANAGED: <key> -->…<!-- /WORKSPACE-MANAGED -->` block
// present in a templates/common/ MERGE_MANAGED file (lib/upgrade-policy.ts —
// the same set upgrade MERGE unions into projects) must exist, marker-wrapped,
// in EVERY templates/co-* copy of that file with content parity. Comparison is
// per-key set-of-normalized-contents (duplicates are legitimate — common
// AGENTS.md itself carries two tier-model-mapping blocks: the §3.6 tier list
// and the §5.3 Model-column note). This is the standing guard for the T-009
// defect class: §3.6 sits OUTSIDE the COMMON-AGENTS marker-inject zone, so a
// stale, unwrapped variant copy has no other delivery channel — the
// 2026-09-16 fresh-scaffold test showed the stale 2-model block scaffolding
// straight into a new project and failing its model-registry gate (3 ERRORs).
// Per-file absence policy: a variant copy of AGENTS.md must exist (the roster
// file is the variant's identity carrier); any other MERGE_MANAGED file may
// be absent from a variant template — the scaffold lays down the common copy
// first and the variant overlay never fires for it (co-hr / co-safety ship no
// .gitignore by design). A variant agents/pm.md that is an extends-stub
// (frontmatter `extends:`) delivers the common body — keyed blocks included —
// through stub resolution (new-project §2.3b), so marker-wrapped parity does
// not apply to stubs. Files whose common copy carries no managed blocks are
// skipped (nothing to enforce). Severity: Error. Extraction/comparison
// primitives live in scripts/lib/managed-block-parity.ts (unit-tested).
function checkManagedBlockParity(): void {
  if (!JSON_MODE) console.log('\n=== Check PM-04: managed-block parity (common → every variant, MERGE_MANAGED files) ===');

  const variants = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('co-') && !isTransientTestFixture(e.name))
    .map(e => e.name)
    .sort();

  let enforcedFiles = 0;
  let checkedCopies = 0;
  for (const relFile of [...MERGE_MANAGED_FILES].sort()) {
    const commonPath = join(TEMPLATES_DIR, 'common', relFile);
    if (!existsSync(commonPath)) continue;
    const commonIssues: string[] = [];
    const commonBlocks = extractKeyedBlocks(readFileSync(commonPath, 'utf-8'), commonIssues);
    for (const issue of commonIssues) {
      fail('common', 'managed-block-parity', `templates/common/${relFile}: ${issue}`, 'Close the WORKSPACE-MANAGED block with <!-- /WORKSPACE-MANAGED -->');
    }
    if (commonBlocks.size === 0) continue; // common defines no managed blocks here — nothing to enforce

    enforcedFiles++;
    for (const variant of variants) {
      const variantRel = `templates/${variant}/${relFile}`;
      const variantPath = join(TEMPLATES_DIR, variant, relFile);
      if (!existsSync(variantPath)) {
        if (relFile === 'AGENTS.md') {
          fail(variant, 'managed-block-parity', `${variantRel} not found — the common managed blocks have no delivery channel into this variant`, `Create ${variantRel} carrying every common WORKSPACE-MANAGED block (see templates/common/AGENTS.md)`);
        }
        // Other MERGE_MANAGED files: absence is compliant — the scaffold copies
        // the common file into the project and the variant overlay never fires.
        continue;
      }
      const variantContent = readFileSync(variantPath, 'utf-8');
      if (relFile === 'agents/pm.md' && isExtendsStub(variantContent)) {
        // Stub resolution delivers the common body (keyed blocks included) at scaffold.
        continue;
      }
      const variantIssues: string[] = [];
      const variantBlocks = extractKeyedBlocks(variantContent, variantIssues);
      for (const issue of variantIssues) {
        fail(variant, 'managed-block-parity', `${variantRel}: ${issue}`, 'Close the WORKSPACE-MANAGED block with <!-- /WORKSPACE-MANAGED -->');
      }

      const violations = compareKeyedBlocks(commonBlocks, variantBlocks);
      for (const v of violations) {
        if (v.kind === 'missing-key') {
          fail(variant, 'managed-block-parity', `${variantRel} carries no "WORKSPACE-MANAGED: ${v.key}" block — the common ${relFile} keyed block has no L1→L2 delivery channel (fresh scaffolds overlay the variant copy over the common one; the COMMON-AGENTS marker-inject zone does not cover it)`, `Copy the "<!-- WORKSPACE-MANAGED: ${v.key} -->" block(s) from templates/common/${relFile} into ${variantRel} at the matching section, markers included — or delete ${variantRel} so the common copy delivers`);
        } else if (v.kind === 'missing-content') {
          fail(variant, 'managed-block-parity', `${variantRel} "WORKSPACE-MANAGED: ${v.key}" content diverges from templates/common/${relFile} (missing the common block content)`, `Replace the variant's "<!-- WORKSPACE-MANAGED: ${v.key} -->" block content with the common copy (markers included), byte-identical after line normalization`);
        } else {
          fail(variant, 'managed-block-parity', `${variantRel} "WORKSPACE-MANAGED: ${v.key}" carries content templates/common/${relFile} does not — a variant-only managed block would be unioned into projects by upgrade MERGE with no common source`, `Adjudicate: move the content out of WORKSPACE-MANAGED markers, or add the block to templates/common/${relFile} so parity holds`);
        }
      }
      if (violations.length === 0 && variantIssues.length === 0) {
        checkedCopies++;
      }
    }
  }
  if (enforcedFiles === 0) {
    pass('managed-block-parity: no common MERGE_MANAGED file carries managed blocks (nothing to enforce)');
    return;
  }
  if (checkedCopies > 0) {
    pass(`managed-block-parity: ${checkedCopies} variant file copies across ${enforcedFiles} MERGE_MANAGED file(s) carry every common WORKSPACE-MANAGED block with content parity`);
  }
}

// Check PM-04b: COMMON-AGENTS block parity (ADR-0081 fleet sweep / T-20260919-001).
// The COMMON-AGENTS:START/END marker-inject zone in AGENTS.md is delivered to
// projects by upgrade MERGE from the VARIANT template copy (variant-first
// overlay), so a stale variant block silently starves every project of policy
// updates added to the common block — observed 2026-09-19: all 13 variant
// COMMON-AGENTS blocks were stale (missing the ADR-0080
// "PM Team-Management Authority" section) while this validator stayed green,
// because PM-04's keyed WORKSPACE-MANAGED extraction does not cover the
// key-less COMMON-AGENTS zone. Contract: every variant AGENTS.md carries the
// block with normalized content identical to templates/common/AGENTS.md's.
// Severity: Error. Primitives: lib/managed-block-parity.ts (unit-tested).
function checkCommonAgentsBlockParity(): void {
  if (!JSON_MODE) console.log('\n=== Check PM-04b: COMMON-AGENTS block parity (common → every variant AGENTS.md) ===');

  const commonPath = join(TEMPLATES_DIR, 'common', 'AGENTS.md');
  const commonIssues: string[] = [];
  const commonBlock = extractCommonAgentsBlock(readFileSync(commonPath, 'utf-8'), commonIssues);
  for (const issue of commonIssues) {
    fail('common', 'common-agents-parity', `templates/common/AGENTS.md: ${issue}`, 'Close the block with <!-- /COMMON-AGENTS -->');
  }
  if (commonBlock === null) {
    fail('common', 'common-agents-parity', 'templates/common/AGENTS.md carries no COMMON-AGENTS block', 'Add the <!-- COMMON-AGENTS:START/END --> marker-inject zone (it is the delivery channel for common policy sections into variant/project AGENTS.md)');
    return;
  }

  const variants = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('co-') && !isTransientTestFixture(e.name))
    .map(e => e.name)
    .sort();

  let checked = 0;
  for (const variant of variants) {
    const variantPath = join(TEMPLATES_DIR, variant, 'AGENTS.md');
    if (!existsSync(variantPath)) {
      fail(variant, 'common-agents-parity', `${variant}/AGENTS.md not found — the COMMON-AGENTS zone has no delivery channel into this variant`, `Create ${variant}/AGENTS.md with the COMMON-AGENTS block copied from templates/common/AGENTS.md`);
      continue;
    }
    const variantIssues: string[] = [];
    const variantBlock = extractCommonAgentsBlock(readFileSync(variantPath, 'utf-8'), variantIssues);
    for (const issue of variantIssues) {
      fail(variant, 'common-agents-parity', `templates/${variant}/AGENTS.md: ${issue}`, 'Close the block with <!-- /COMMON-AGENTS -->');
    }
    const violation = compareCommonAgentsBlock(commonBlock, variantBlock);
    if (violation === 'missing') {
      fail(variant, 'common-agents-parity', `templates/${variant}/AGENTS.md carries no COMMON-AGENTS block — common policy sections (LLM routing, instruction standard, PM team-management authority) have no delivery channel into this variant`, `Copy the "<!-- COMMON-AGENTS:START/END -->" block from templates/common/AGENTS.md into ${variant}/AGENTS.md`);
    } else if (violation === 'mismatch') {
      fail(variant, 'common-agents-parity', `templates/${variant}/AGENTS.md COMMON-AGENTS block content diverges from templates/common/AGENTS.md`, `Replace the variant's COMMON-AGENTS block content with the common copy (markers included), byte-identical after line normalization`);
    } else {
      checked++;
    }
  }
  if (checked > 0) {
    pass(`common-agents-parity: ${checked}/${variants.length} variant AGENTS.md files carry the COMMON-AGENTS block with content parity`);
  }
}

// Check WS-11: bilingual user-guide pair (docs/user-guide.md + docs/user-guide_ko.md)
// Standard defined in docs/governance/variant-contract.md "User-Guide Standard".
// Unlike Variant Contract required files, templates/common/ does NOT satisfy this
// check — the guide's content is variant-specific by design, so each variant carries
// its own pair. Root cause guard: 2026-08-23 audit found 4 of 11 variants shipped
// without any user guide because the standard existed only as convention.
function checkUserGuidePair(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check WS-11: bilingual user-guide pair in ${variant} ===`);

  const guidePath = join(TEMPLATES_DIR, variant, 'docs', 'user-guide.md');
  const guideKoPath = join(TEMPLATES_DIR, variant, 'docs', 'user-guide_ko.md');

  const guideExists = existsSync(guidePath);
  const guideKoExists = existsSync(guideKoPath);

  if (!guideExists) {
    fail(variant, 'WS-11', `templates/${variant}/docs/user-guide.md is missing`, `Author docs/user-guide.md per the User-Guide Standard (docs/governance/variant-contract.md "User-Guide Standard"); reference implementation: templates/co-work/docs/user-guide.md`);
  }
  if (!guideKoExists) {
    fail(variant, 'WS-11', `templates/${variant}/docs/user-guide_ko.md is missing`, `Author docs/user-guide_ko.md as a 1:1 Korean mirror of docs/user-guide.md`);
  }
  if (guideExists && guideKoExists) {
    pass(`WS-11: ${variant} has the bilingual user-guide pair`);
  }
}

// Check WS-12: variant index coverage — every non-draft co-* variant must appear in
// the root and templates/ README index files. Root cause guard: 2026-08-23 audit
// found co-export/co-news/co-abap/co-hr missing from README_es.md, README_ja.md and
// templates/README_ko.md (discovered manually — nothing gated it).
// EN/KO primary indexes FAIL; translation indexes (es/ja) WARN so a primary-language
// addition can land while translations catch up, without letting drift persist silently.
function checkVariantIndexCoverage(manifests: Map<string, VariantManifest>): void {
  if (!JSON_MODE) console.log(`\n=== Check WS-12: variant index coverage in README files ===`);

  const indexedVariants = [...manifests.entries()]
    .filter(([name, manifest]) => name.startsWith('co-') && manifest.status !== 'draft')
    .map(([name]) => name);

  if (indexedVariants.length === 0) return;

  const indexFiles: Array<{ rel: string; level: 'error' | 'warning' }> = [
    { rel: 'README.md', level: 'error' },
    { rel: 'README_ko.md', level: 'error' },
    { rel: 'templates/README.md', level: 'error' },
    { rel: 'templates/README_ko.md', level: 'error' },
    { rel: 'README_es.md', level: 'warning' },
    { rel: 'README_ja.md', level: 'warning' },
  ];

  for (const { rel, level } of indexFiles) {
    const filePath = join(ROOT, rel);
    if (!existsSync(filePath)) continue; // presence of the index files themselves is governed elsewhere

    const content = readFileSync(filePath, 'utf-8');
    const missing = indexedVariants.filter(name => !content.includes(name));

    if (missing.length === 0) {
      pass(`WS-12: all ${indexedVariants.length} variants indexed in ${rel}`);
    } else if (level === 'error') {
      fail('root', 'WS-12', `${rel} does not mention variant(s): ${missing.join(', ')}`, `Add the missing variant(s) to ${rel}'s template tree + "Available Variants" table (all 6 index READMEs must list every non-draft variant)`);
    } else {
      warn('root', 'WS-12', `${rel} does not mention variant(s): ${missing.join(', ')}`, `Backfill the missing variant(s) in ${rel} (translation index — update in the same change that adds the variant to the primary READMEs)`);
    }
  }
}

// Check WS-08: README standard conformance (README.md + README_ko.md)
// Enforces the unified README skeleton defined in docs/governance/variant-contract.md
// "README Standard" and rendered by templates/common/docs/README.template.md (+KO).
// The FIRST check to consult governance.variantValidationPolicy: when WS-08 is listed
// in `warningOnly` it emits WARN (non-blocking, used during rollout); otherwise FAIL.
// H2 parity between EN/KO is transitively enforced — both files are checked against a
// required set of equal size (7), so individual missing/extra conformance implies parity.
// Frontmatter hash presence is delegated to Check 11 (checkReadmePresence).
function checkReadmeStandard(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check WS-08: README standard conformance in ${variant} ===`);

  const isWarningOnly = governance?.variantValidationPolicy?.warningOnly?.includes('WS-08') ?? false;
  const report = (msg: string, fix: string): void => {
    if (isWarningOnly) warn(variant, 'WS-08', msg, fix);
    else fail(variant, 'WS-08', msg, fix);
  };

  const EN_H2 = ['Overview', 'Quick Start', 'Team Mission', 'Meet the AI Team', 'Skills', 'How to Collaborate', 'Variant Type'];
  const KO_H2 = ['개요', '빠른 시작', '팀 미션', 'AI 팀 소개', '스킬', '협업 방법', '변형 유형'];
  const STATUS_RE_EN = /^> \*\*Status\*\*: (✅ Stable|⚠️ Beta) — v\d+\.\d+\.\d+$/m;
  const STATUS_RE_KO = /^> \*\*상태\*\*: (✅ Stable|⚠️ Beta) — v\d+\.\d+\.\d+$/m;

  const readmePath = join(TEMPLATES_DIR, variant, 'README.md');
  const readmeKoPath = join(TEMPLATES_DIR, variant, 'README_ko.md');
  if (!existsSync(readmePath) && !existsSync(readmeKoPath)) return; // presence is Check 11's concern

  let issuesFound = 0;
  const checkFile = (
    path: string, label: string, h2Required: string[], statusRe: RegExp,
    statusLabel: string, langSelector: string, agentHeader: string,
  ): void => {
    const c = readFileSync(path, 'utf-8');
    const h2 = [...c.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
    const h2Set = new Set(h2);
    const missing = h2Required.filter(h => !h2Set.has(h));
    const extra = h2.filter(h => !h2Required.includes(h));
    if (missing.length) {
      report(`templates/${variant}/${label} is missing required section(s): ${missing.join(', ')}`,
        `Add the missing ## section(s) per the README standard (docs/governance/variant-contract.md "README Standard"). Required: ${h2Required.join(' · ')}`);
      issuesFound++;
    }
    if (extra.length) {
      report(`templates/${variant}/${label} has non-standard top-level section(s): ${extra.join(', ')}`,
        `Remove or demote (to ###) the non-standard ## section(s); only the 7 standard top-level sections are allowed`);
      issuesFound++;
    }
    if (!statusRe.test(c)) {
      report(`templates/${variant}/${label} status line must match '> **${statusLabel}**: (✅ Stable|⚠️ Beta) — vX.Y.Z'`,
        `Normalize the status line, e.g. '> **${statusLabel}**: ✅ Stable — v1.0.0'`);
      issuesFound++;
    }
    if (!c.includes(langSelector)) {
      report(`templates/${variant}/${label} is missing the standard language-selector line`,
        `Add the language-selector blockquote linking to the other-language README`);
      issuesFound++;
    }
    if (!c.includes(agentHeader)) {
      report(`templates/${variant}/${label} agent table must use the 4-column header '${agentHeader}'`,
        `Convert the agent roster table to the 4-column schema (Agent | Role | Tier | Model)`);
      issuesFound++;
    }
  };

  if (existsSync(readmePath)) {
    checkFile(readmePath, 'README.md', EN_H2, STATUS_RE_EN, 'Status',
      '**English** · [한국어](README_ko.md)', '| Agent | Role | Tier | Model |');
  }
  if (existsSync(readmeKoPath)) {
    checkFile(readmeKoPath, 'README_ko.md', KO_H2, STATUS_RE_KO, '상태',
      '[English](README.md) · **한국어**', '| 에이전트 | 역할 | 티어 | 모델 |');
  }

  if (issuesFound === 0) {
    pass(`WS-08: ${variant} README conforms to the standard${isWarningOnly ? ' (warning-only policy active)' : ''}`);
  }
}

// Check WS-09: docs/<variant>.context.md structure conformance
// Established 2026-08-21 after reviewing all "collaboration-family" variants' context.md heading
// structure (ADR-0050 Part 3 follow-up): 7 of 8 variants (all but co-abap, a structurally distinct
// SAP/ABAP domain) already share the same skeleton — Stack → Agents → Skills → [Environment Setup]
// → Development Workflow → <Domain> Guidelines → File Organization Policy → Domain Rules — with the
// heading TEXT varying per domain ("Tool Stack" vs "Design Stack", "Consulting Guidelines" vs
// "Coding Guidelines") even though the SECTION'S ROLE is identical. Content itself is deliberately
// NOT standardized (Skills/Agents tables genuinely differ per domain — forcing identical wording
// there destroys the domain-specific value, as the co-security commit-type-convention and
// co-abap/co-architect/co-consult/co-game leftover-duplicate cases both showed this session).
// This check enforces only PRESENCE and RELATIVE ORDER of the required slots via an alias/regex
// match per slot — never a whitelist of allowed headings — so domain-specific extra headings
// (e.g. co-export's "Overview"/"Regulatory Scope" before Stack) are always permitted.
const WS09_STRUCTURE_SCHEMA: { slot: string; match: RegExp; required: boolean }[] = [
  { slot: 'Stack', match: /^(Tool|Tech|Design) Stack$/, required: true },
  { slot: 'Agents', match: /^Agents?\b/, required: true },
  { slot: 'Skills', match: /^Skills$/, required: true },
  { slot: 'Environment Setup', match: /^Environment Setup$/, required: false },
  { slot: 'Development Workflow', match: /^(Development|Engagement) Workflow\b/, required: true },
  { slot: 'Guidelines', match: /\bGuidelines$/, required: true },
  { slot: 'File Organization Policy', match: /^File Organization Policy$/, required: true },
  { slot: 'Domain Rules', match: /^Domain Rules$/, required: true },
];
// co-abap is a structurally distinct SAP/ABAP domain (30+ headings, no Stack/Guidelines/File
// Organization Policy slots at all) — forcing it into this skeleton would misrepresent its actual
// structure rather than standardize it. Exempt rather than fail.
const WS09_EXEMPT_VARIANTS = new Set(['co-abap']);

function checkContextMdStructure(variant: string): void {
  if (WS09_EXEMPT_VARIANTS.has(variant)) return;

  const contextPath = join(TEMPLATES_DIR, variant, 'docs', `${variant}.context.md`);
  if (!existsSync(contextPath)) return; // presence is Check WS-checkContextSync's concern

  if (!JSON_MODE) console.log(`\n=== Check WS-09: docs/${variant}.context.md structure conformance ===`);

  const isWarningOnly = governance?.variantValidationPolicy?.warningOnly?.includes('WS-09') ?? false;
  const report = (msg: string, fix: string): void => {
    if (isWarningOnly) warn(variant, 'WS-09', msg, fix);
    else fail(variant, 'WS-09', msg, fix);
  };

  const content = readFileSync(contextPath, 'utf-8');
  const headings = [...content.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());

  let lastMatchedIndex = -1;
  let issuesFound = 0;
  for (const { slot, match, required } of WS09_STRUCTURE_SCHEMA) {
    const idx = headings.findIndex((h, i) => i > lastMatchedIndex && match.test(h));
    if (idx === -1) {
      if (required) {
        report(`templates/${variant}/docs/${variant}.context.md is missing the required "${slot}" slot (or it appears before an earlier required slot)`,
          `Add a "## ${slot}" section (or matching domain-flavored heading) in the standard slot order: ${WS09_STRUCTURE_SCHEMA.map(s => s.slot).join(' → ')}`);
        issuesFound++;
      }
      continue;
    }
    lastMatchedIndex = idx;
  }

  if (issuesFound === 0) {
    pass(`WS-09: ${variant} context.md structure conforms to the standard slot order${isWarningOnly ? ' (warning-only policy active)' : ''}`);
  }
}

// Check WS-10: variant agents/*.md must carry lifecycle frontmatter
// Established 2026-08-21. scripts/validate-agents.ts requires lifecycle.phase + lifecycle.governance
// in every agents/*.md, and runs as part of audit.ts — but nothing validated the TEMPLATE copies, so
// the requirement silently drifted: only co-export and co-security ever had the block, meaning
// `new-project.ts <name> --variant <v>` produced a project that failed its own post-scaffold audit
// for 8 of 10 variants (reported live for co-deck: 13 errors on a fresh scaffold). The governance
// records existed and passed validate-agents.ts Part 2 the whole time — several even claimed
// "Verified governance record and lifecycle frontmatter" in their Phase History — so only the
// runtime pointer was missing. This check closes the loop: what validate-agents.ts demands of an
// L2 project, validate-templates.ts now demands of the L1 template it is scaffolded from.
//
// Skipped deliberately:
//   - README.md / README_ko.md — roster docs, not agent definitions.
//   - Any file with `extends:` in its frontmatter (i.e. pm.md) — an L1-B stub whose lifecycle block
//     is inherited from the L0 root agent at resolve time, so requiring a literal block here would
//     duplicate the SSOT. pm.md's own scaffold-time lifecycle handling lives in new-project.ts §2.5.
const WS10_SKIP_FILES = new Set(['README.md', 'README_ko.md']);
// No exemptions remain. co-abap was exempted at introduction (it had no docs/lifecycle/agents/
// directory at all, so its 19 agents had nowhere to point); its governance records were authored
// 2026-08-21 and the exemption lifted in the same session. Keep the set rather than deleting it —
// a newly promoted variant may legitimately need a grace period before its records exist.
const WS10_EXEMPT_VARIANTS = new Set<string>();

function checkAgentLifecycleFrontmatter(variant: string): void {
  if (WS10_EXEMPT_VARIANTS.has(variant)) return;

  const agentsDir = join(TEMPLATES_DIR, variant, 'agents');
  if (!existsSync(agentsDir)) return; // variant carries no agent roster of its own

  if (!JSON_MODE) console.log(`\n=== Check WS-10: agents/*.md lifecycle frontmatter in ${variant} ===`);

  const isWarningOnly = governance?.variantValidationPolicy?.warningOnly?.includes('WS-10') ?? false;
  const report = (msg: string, fix: string): void => {
    if (isWarningOnly) warn(variant, 'WS-10', msg, fix);
    else fail(variant, 'WS-10', msg, fix);
  };

  let checked = 0;
  let issuesFound = 0;

  for (const file of readdirSync(agentsDir).filter(f => f.endsWith('.md') && !WS10_SKIP_FILES.has(f))) {
    const agentPath = join(agentsDir, file);
    const content = readFileSync(agentPath, 'utf-8');

    const match = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      report(`templates/${variant}/agents/${file} has no YAML frontmatter`,
        `Add a frontmatter block with at minimum: name, and a lifecycle: block with phase + governance`);
      issuesFound++;
      continue;
    }

    let fm: Record<string, unknown>;
    try {
      fm = (load(match[1]) as Record<string, unknown>) ?? {};
    } catch {
      report(`templates/${variant}/agents/${file} frontmatter is not valid YAML`,
        `Fix the YAML syntax in the frontmatter block`);
      issuesFound++;
      continue;
    }

    if (fm.extends) continue; // L1-B stub — lifecycle is inherited from the L0 root agent

    checked++;
    const agentName = typeof fm.name === 'string' && fm.name.trim() ? fm.name.trim() : file.replace(/\.md$/, '');
    const lifecycle = fm.lifecycle as Record<string, unknown> | undefined;

    if (!lifecycle || typeof lifecycle !== 'object') {
      report(`templates/${variant}/agents/${file} is missing the required lifecycle: frontmatter block`,
        `Add:\n  lifecycle:\n    phase: production\n    created: "YYYY-MM-DD"\n    last_updated: "YYYY-MM-DD"\n    governance: docs/lifecycle/agents/${agentName}.md`);
      issuesFound++;
      continue;
    }

    const missing = (['phase', 'governance'] as const).filter(k => !lifecycle[k]);
    if (missing.length > 0) {
      report(`templates/${variant}/agents/${file} lifecycle block is missing: ${missing.map(m => `lifecycle.${m}`).join(', ')}`,
        `validate-agents.ts requires both lifecycle.phase and lifecycle.governance — add the missing key(s)`);
      issuesFound++;
      continue;
    }

    // The pointer must resolve. This is a STRICTER assertion than validate-agents.ts makes (which
    // only checks the key is non-empty) — deliberately so: it caught co-security's 5 agents all
    // carrying `governance: lifecycle-manager`, an agent NAME rather than a
    // docs/lifecycle/agents/*.md path, which passed every project-layer check while resolving to
    // nothing. Introduced as WARN-only pending that fix; promoted to a policy-aware failure once
    // co-security was corrected (2026-08-21), so an unresolvable pointer can never land again.
    const govRel = String(lifecycle.governance);
    if (!existsSync(join(TEMPLATES_DIR, variant, govRel))) {
      report(`templates/${variant}/agents/${file} points at a governance record that does not exist: ${govRel}`,
        `Set lifecycle.governance to a path, e.g. docs/lifecycle/agents/${agentName}.md, and create that record ("## Phase History" + "## Acceptance Criteria")`);
      issuesFound++;
    }
  }

  if (issuesFound === 0) {
    pass(`WS-10: ${variant} agent lifecycle frontmatter OK (${checked} agent(s) checked)${isWarningOnly ? ' (warning-only policy active)' : ''}`);
  }
}

// Main
// A-10: propagation-map.json schema validation
/**
 * VRG-01: Variant Readiness Gate (continuous enforcement)
 *
 * Runs `validate-variant-readiness.ts` for every variant under templates/ so that a
 * non-READY variant (flat/unresolved agent or skill paths, missing PROMOTION_CHECKLIST.md,
 * missing README/AGENTS.md, inconsistent country_config) is surfaced here — not only at
 * variant-ization / new-project / upgrade-project time. Complements the structural checks
 * above by asserting each variant is internally consistent and usable.
 */
function checkVariantReadinessGate(): void {
  if (!JSON_MODE) console.log('\n=== VRG-01: Variant Readiness Gate (all variants) ===');
  const gateTs = join(__dirname, 'validate-variant-readiness.ts');
  if (!existsSync(gateTs)) {
    warn('root', 'vrg-missing', 'validate-variant-readiness.ts not found — skipping VRG check');
    return;
  }
  let dirs: string[] = [];
  try {
    dirs = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => !isTransientTestFixture(name)) // E2E staging dirs (T-20260916-001)
      .filter((name) => name.startsWith('co-') ? isCoVariantTracked(name) : true)
      .filter((name) => existsSync(join(TEMPLATES_DIR, name, 'variant.json')));
  } catch {
    return;
  }
  let checked = 0;
  for (const name of dirs) {
    if (variantArg !== 'all' && name !== variantArg) continue;
    const dir = join(TEMPLATES_DIR, name);
    const res = spawnSync(process.execPath, [gateTs, '--dir', dir, '--json'], { encoding: 'utf8' });
    let parsed: { findings?: Array<{ severity: string; code: string; message: string }> } = {};
    try {
      parsed = JSON.parse(res.stdout || '{}');
    } catch {
      continue;
    }
    const findings = parsed.findings || [];
    for (const f of findings) {
      if (f.severity === 'error') {
        fail(name, `vrg:${f.code}`, `VRG: ${f.message}`, `Run: bun scripts/validate-variant-readiness.ts --variant ${name}`);
      }
    }
    checked++;
  }
  if (checked > 0 && !JSON_MODE) pass(`VRG checked ${checked} variant(s)`);
}

function checkPropagationMapSchema(): void {
  if (!JSON_MODE) console.log('\n=== Check PM-01: propagation-map.json schema ===');
  const mapPath = join(ROOT, 'scripts', 'propagation-map.json');
  if (!existsSync(mapPath)) {
    warn('root', 'propagation-map-missing', 'scripts/propagation-map.json not found');
    return;
  }
  let map: unknown;
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  } catch {
    fail('root', 'propagation-map-invalid-json', 'scripts/propagation-map.json is not valid JSON');
    return;
  }
  const errors = validatePropagationMap(map);
  if (errors.length > 0) {
    for (const e of errors) {
      fail('root', `propagation-map-schema:${e.domain}.${e.field}`, `propagation-map.json domain [${e.domain}].${e.field}: ${e.message}`);
    }
  } else {
    pass('propagation-map.json schema valid');
  }
}

// Check PM-02: marker-inject zone parity (T-20260910-018)
// For every marker-inject domain in propagation-map.json, the variants that
// actually carry a `<MARKER>:START/END` zone must be exactly the domain's
// target_variants:
//   zone present, variant unlisted, content identical to the source zone → ERROR
//     (unmanaged coverage: the manifest is stale — publishDocs() does not manage
//     this zone, so the next source change silently stops propagating to it;
//     fix: add the variant to target_variants)
//   zone present, variant unlisted, content diverges from source → WARNING
//     (potential intentional divergence — needs human adjudication, e.g.
//     co-safety's governance section, tracked as T-20260910-022)
//   variant listed, zone missing → ERROR (stale target: publishDocs() expects to
//     inject here and will recreate/overwrite the file's zone)
// A variant with no zone and no listing is an intentional exclusion — not reported.
function checkMarkerZoneParity(): void {
  if (!JSON_MODE) console.log('\n=== Check PM-02: marker-inject zone parity ===');
  const mapPath = join(ROOT, 'scripts', 'propagation-map.json');
  if (!existsSync(mapPath)) return; // PM-01 already reported the missing map

  let map: { domains?: Record<string, { mode?: string; source_file?: string; target_file?: string; marker?: string; target_variants?: string[]; excluded_variants?: Array<string | { variant: string; reason?: string }> }> };
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  } catch {
    return; // PM-01 already reported invalid JSON
  }

  const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim();
  const extractZone = (content: string, marker: string): string | null => {
    const m = content.match(new RegExp(`<!--\\s*${marker}:START\\s*-->[\\s\\S]*?<!--\\s*${marker}:END\\s*-->`));
    return m ? normalize(m[0]) : null;
  };

  let checkedZones = 0;
  for (const [domainName, domain] of Object.entries(map.domains ?? {})) {
    if (domain.mode !== 'marker-inject' || !domain.source_file || !domain.marker) continue;
    const sourcePath = join(ROOT, domain.source_file);
    if (!existsSync(sourcePath)) continue; // publishDocs() owns source-file validation
    const sourceZone = extractZone(readFileSync(sourcePath, 'utf-8'), domain.marker);
    if (!sourceZone) {
      warn('root', 'marker-zone-parity', `marker-inject domain [${domainName}]: source ${domain.source_file} has no ${domain.marker} zone`, 'Re-publish the source file or update the propagation-map marker');
      continue;
    }
    const listed = new Set(domain.target_variants ?? []);
    // T-20260912-031: explicitly excluded variants carry a documented,
    // adjudicated fork of the zone (e.g. co-safety COMMON-AGENTS). They are
    // skipped by parity checks instead of emitting FAIL/WARN.
    const excluded = new Map<string, string>();
    for (const e of domain.excluded_variants ?? []) {
      if (typeof e === 'string') excluded.set(e, '');
      else if (e && typeof e.variant === 'string') excluded.set(e.variant, e.reason ?? '');
    }

    for (const entry of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('co-')) continue;
      if (isTransientTestFixture(entry.name)) continue; // E2E staging dirs (T-20260916-001)
      const variant = entry.name;
      const targetFile = (domain.target_file ?? 'AGENTS.md').replace('{variant}', variant);
      const variantPath = join(TEMPLATES_DIR, variant, targetFile);
      const variantZone = existsSync(variantPath)
        ? extractZone(readFileSync(variantPath, 'utf-8'), domain.marker)
        : null;
      if (!variantZone) continue; // absent + (listed handled below / unlisted intentional)

      checkedZones++;
      if (listed.has(variant)) continue; // managed — publishDocs() drift checks own content sync
      if (excluded.has(variant)) {
        if (!JSON_MODE) console.log(`  ℹ️  marker-zone-parity: ${variant}/${targetFile} is an adjudicated variant-owned fork (documented exclusion)`);
        continue;
      }

      if (variantZone === sourceZone) {
        fail('root', 'marker-zone-parity', `marker-inject domain [${domainName}]: ${variant}/${targetFile} carries a ${domain.marker} zone identical to the source but is not in target_variants — unmanaged coverage, the zone silently stops propagating on the next source change`, `Add "${variant}" to propagation-map.json domain [${domainName}].target_variants`);
      } else {
        warn('root', 'marker-zone-parity', `marker-inject domain [${domainName}]: ${variant}/${targetFile} carries a ${domain.marker} zone that diverges from the source and is not in target_variants — if this divergence is intentional, document it in the domain note (adjudication: T-20260910-022)`, 'Adjudicate the divergence: list the variant in target_variants and re-publish, or document the intentional divergence');
      }
    }

    for (const variant of listed) {
      if (!variant.startsWith('co-')) continue; // 'common' and other non-variant targets
      const targetFile = (domain.target_file ?? 'AGENTS.md').replace('{variant}', variant);
      const variantPath = join(TEMPLATES_DIR, variant, targetFile);
      const variantZone = existsSync(variantPath)
        ? extractZone(readFileSync(variantPath, 'utf-8'), domain.marker)
        : null;
      if (!variantZone) {
        fail('root', 'marker-zone-parity', `marker-inject domain [${domainName}]: target_variants lists "${variant}" but ${variant}/${targetFile} has no ${domain.marker} zone — stale target`, 'Re-run publishDocs for the domain or remove the variant from target_variants');
      }
      checkedZones++;
    }
  }

  if (checkedZones > 0) {
    pass(`marker-inject zone parity: ${checkedZones} zone listing(s) consistent with propagation-map.json`);
  }
}

// Check PM-03: propagation target derivation (T-20260915-005 / M8)
// The hand-maintained target lists must equal the actual templates/co-*
// directory set, so registering a new variant can no longer silently miss
// them. Marker-inject domains are classified structurally by target-file
// shape (never by name):
//   variant-scoped (target_file absent → publishDocs basename-of-source
//     default, or carries {variant}):
//     target_variants ⊎ exclude_variants ≡ co-* dir set, disjoint.
//     target_variants entry that is no real co-* dir  → ERROR (stale listing)
//     co-* dir in neither array                       → ERROR (missed
//       registration — publishDocs() would never inject this variant; the
//       exact M8 silent-propagation-break class)
//     exclude_variants entry that is no real co-* dir → ERROR (typo)
//     dir in both arrays / duplicate entries          → ERROR
//   fixed-target (fixed relative target_file, e.g. constitution-context →
//     docs/context.md): validated against its own declared shape — every
//     listed target must be an existing template directory carrying the
//     resolved target file. No co-* equality is imposed.
// docs/templates/common.lifecycle.json propagatedTo must also equal the
// derived co-* set in both directions (the file is L0-only: no propagation
// domain manages it and no L1 mirror exists).
// Every Error's fix hint names the exact JSON pointer to edit. Pure helpers
// live in lib/propagation-map-schema.ts (unit-tested against synthetic trees).
function checkPropagationTargets(): void {
  if (!JSON_MODE) console.log('\n=== Check PM-03: propagation targets ≡ templates/co-* dir set ===');
  const coDirs = deriveCoVariantDirs(TEMPLATES_DIR);
  if (coDirs.length === 0) {
    warn('root', 'propagation-targets', 'no templates/co-* directories found — target derivation skipped');
    return;
  }

  let auditedDomains = 0;
  let violations = 0;
  const mapPath = join(ROOT, 'scripts', 'propagation-map.json');
  if (existsSync(mapPath)) {
    let map: { domains?: Record<string, { mode?: string; target_file?: string; target_variants?: string[]; exclude_variants?: string[] }> };
    try {
      map = JSON.parse(readFileSync(mapPath, 'utf-8'));
    } catch {
      map = {}; // PM-01 already reported the invalid JSON
    }

    for (const [domainName, domain] of Object.entries(map.domains ?? {})) {
      if (domain.mode !== 'marker-inject') continue;
      auditedDomains++;
      const listed = domain.target_variants ?? [];

      if (markerInjectTargetScope(domain) === 'variant-scoped') {
        const excluded = domain.exclude_variants ?? [];
        const audit = auditVariantScopedTargets(listed, coDirs, excluded);
        const targetDesc = (domain.target_file ?? 'AGENTS.md (basename-of-source default)').replace('{variant}', '<variant>');
        for (const v of audit.staleEntries) {
          violations++;
          fail('root', `propagation-targets:${domainName}`,
            `marker-inject domain [${domainName}] target_variants lists "${v}" but templates/${v}/ does not exist — stale listing`,
            `Remove "${v}" from scripts/propagation-map.json domains.${domainName}.target_variants (or create the variant directory it references)`);
        }
        for (const v of audit.missingVariants) {
          violations++;
          fail('root', `propagation-targets:${domainName}`,
            `variant "${v}" exists (templates/${v}/) but marker-inject domain [${domainName}] neither targets nor excludes it — its ${targetDesc} would silently stop propagating (M8 registration drift)`,
            `Add "${v}" to scripts/propagation-map.json domains.${domainName}.target_variants, or declare the deliberate non-target in domains.${domainName}.exclude_variants`);
        }
        for (const v of audit.invalidExclusions) {
          violations++;
          fail('root', `propagation-targets:${domainName}`,
            `marker-inject domain [${domainName}] exclude_variants lists "${v}" but templates/${v}/ does not exist — typo?`,
            `Remove or correct "${v}" in scripts/propagation-map.json domains.${domainName}.exclude_variants`);
        }
        for (const v of audit.overlaps) {
          violations++;
          fail('root', `propagation-targets:${domainName}`,
            `marker-inject domain [${domainName}] lists "${v}" in both target_variants and exclude_variants — contradictory declaration`,
            `Remove "${v}" from scripts/propagation-map.json domains.${domainName}.exclude_variants (target_variants wins)`);
        }
        for (const v of audit.duplicates) {
          violations++;
          fail('root', `propagation-targets:${domainName}`,
            `marker-inject domain [${domainName}] lists "${v}" more than once across target_variants/exclude_variants — duplicate entry`,
            `Keep exactly one entry for "${v}" in scripts/propagation-map.json domains.${domainName}.target_variants or .exclude_variants`);
        }
      } else {
        // fixed-target: validated against the domain's own declared shape
        const seen = new Set<string>();
        for (const t of listed) {
          if (seen.has(t)) {
            violations++;
            fail('root', `propagation-targets:${domainName}`,
              `marker-inject domain [${domainName}] target_variants lists "${t}" more than once — duplicate entry`,
              `Keep exactly one entry for "${t}" in scripts/propagation-map.json domains.${domainName}.target_variants`);
          }
          seen.add(t);
        }
        const audit = auditFixedTargets(listed, domain.target_file!, TEMPLATES_DIR);
        for (const t of audit.unknownDirs) {
          violations++;
          fail('root', `propagation-targets:${domainName}`,
            `marker-inject domain [${domainName}] target_variants lists "${t}" but templates/${t}/ does not exist — stale listing`,
            `Remove "${t}" from scripts/propagation-map.json domains.${domainName}.target_variants (or create the template directory it references)`);
        }
        for (const m of audit.missingTargetFiles) {
          violations++;
          fail('root', `propagation-targets:${domainName}`,
            `marker-inject domain [${domainName}] targets ${m.file} (declared target_file: ${domain.target_file}) but the file does not exist — dead target`,
            `Create ${m.file} with the ${domainName} marker zone, or remove "${m.target}" from scripts/propagation-map.json domains.${domainName}.target_variants`);
        }
        if ((domain.exclude_variants ?? []).length > 0) {
          warn('root', `propagation-targets:${domainName}`,
            `marker-inject domain [${domainName}] is fixed-target (no {variant} in target_file) — exclude_variants is never consulted for this shape`,
            `Remove the dead exclude_variants from scripts/propagation-map.json domains.${domainName}, or drop the entries`);
        }
      }
    }
  }

  // (c) common.lifecycle.json propagatedTo ≡ co-* dir set (both directions)
  const lcPath = join(ROOT, 'docs', 'templates', 'common.lifecycle.json');
  let lifecycleChecked = false;
  if (existsSync(lcPath)) {
    let lc: { propagatedTo?: unknown };
    try {
      lc = JSON.parse(readFileSync(lcPath, 'utf-8'));
    } catch {
      fail('common', 'common-lifecycle-propagatedto', 'docs/templates/common.lifecycle.json is not valid JSON — propagatedTo cannot be derived-checked');
      return; // nothing else in this check can run meaningfully
    }
    if (!Array.isArray(lc.propagatedTo) || lc.propagatedTo.some((v) => typeof v !== 'string')) {
      fail('common', 'common-lifecycle-propagatedto', 'docs/templates/common.lifecycle.json propagatedTo must be an array of variant names');
    } else {
      lifecycleChecked = true;
      const listed = lc.propagatedTo as string[];
      for (const v of listed.filter((v) => !coDirs.includes(v))) {
        violations++;
        fail('common', 'common-lifecycle-propagatedto',
          `docs/templates/common.lifecycle.json propagatedTo lists "${v}" but templates/${v}/ does not exist — stale entry`,
          `Remove "${v}" from docs/templates/common.lifecycle.json propagatedTo (or create the variant directory it references)`);
      }
      for (const v of coDirs.filter((v) => !listed.includes(v))) {
        violations++;
        fail('common', 'common-lifecycle-propagatedto',
          `variant "${v}" exists (templates/${v}/) but docs/templates/common.lifecycle.json propagatedTo does not list it — the lifecycle record under-reports common-layer propagation`,
          `Add "${v}" to docs/templates/common.lifecycle.json propagatedTo`);
      }
    }
  }

  if ((auditedDomains > 0 || lifecycleChecked) && violations === 0) {
    pass(`propagation-targets: ${auditedDomains} marker-inject domain(s) + common.lifecycle.json propagatedTo consistent with the templates/co-* dir set (${coDirs.length} variants)`);
  }
}

// ── scaffold-marker-source (T-20260915-002 / C3) ─────────────────────────────
// Every (marker, source template) pair the scaffolders depend on — declared in
// helpers/scaffold-markers.ts SCAFFOLD_MARKER_SOURCES — must hold: the source
// file exists and carries the marker. A marker referenced by scaffold code but
// absent from its source template is the C3 silent-no-op class (indexOf miss →
// block never appended, no warning). The scaffolders also warn at extraction
// time; this standing check fails the battery BEFORE anything scaffolds.
function checkScaffoldMarkerSources(): void {
  if (!JSON_MODE) console.log('\n=== Check scaffold-marker-source: scaffolder markers vs source templates ===');
  let verified = 0;
  for (const entry of SCAFFOLD_MARKER_SOURCES) {
    for (const relSource of entry.sources) {
      const absSource = join(ROOT, relSource);
      if (!existsSync(absSource)) {
        fail('common', 'scaffold-marker-source',
          `${relSource} not found — cannot verify scaffolder marker reference: ${entry.marker} (${entry.purpose})`,
          `Restore the source template file, or update SCAFFOLD_MARKER_SOURCES in scripts/helpers/scaffold-markers.ts`);
        continue;
      }
      if (!readFileSync(absSource, 'utf-8').includes(entry.marker)) {
        fail('common', 'scaffold-marker-source',
          `marker missing from ${relSource}: "${entry.marker}" (${entry.purpose}) — scaffolders referencing it silently no-op (C3 class)`,
          `Re-wrap the block in the declared marker in ${relSource}, or update SCAFFOLD_MARKER_SOURCES in scripts/helpers/scaffold-markers.ts`);
        continue;
      }
      verified++;
    }
  }
  pass(`scaffold-marker-source: ${verified}/${SCAFFOLD_MARKER_SOURCES.length} declared marker reference(s) verified in their source templates`);
}

// ── pm-extends-stub-body (T-20260915-010 / H12) ──────────────────────────────
// Every variant pm.md that declares `extends:` must carry the canonical stub
// body (empty, or exactly the canonicalPmStubBody sentence for the variant).
// new-project.ts §2.3b discards any prose stub body when it attaches the L1
// body — a non-canonical body means real variant content is lost silently at
// scaffold time (the matching scaffold-time WARN lives in new-project.ts).
function checkPmExtendsStubBodies(): void {
  if (!JSON_MODE) console.log('\n=== Check pm-extends-stub-body: variant pm.md extends-stub bodies are canonical ===');
  let checked = 0;
  for (const entry of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('co-')) continue;
    if (isTransientTestFixture(entry.name)) continue; // E2E staging dirs (T-20260916-001)
    if (variantArg !== 'all' && variantArg !== entry.name) continue;
    const pmPath = join(TEMPLATES_DIR, entry.name, 'agents', 'pm.md');
    if (!existsSync(pmPath)) continue; // presence is checkAgents/checkReadmePresence's domain
    const content = readFileSync(pmPath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!fmMatch || !/(^|\n)\s*extends:/.test(fmMatch[1])) continue;
    checked++;
    const body = content.slice(fmMatch[0].length);
    if (isCanonicalPmStubBody(body, entry.name)) continue;
    fail(entry.name, 'pm-extends-stub-body',
      `agents/pm.md declares extends: but its body is not the canonical stub — scaffold-time resolution would silently discard ${body.trim().length} char(s) of variant content`,
      `Inline the real content in agents/pm.md and drop extends:, or restore the canonical stub prose (canonicalPmStubBody in scripts/helpers/scaffold-markers.ts)`);
  }
  if (checked > 0) {
    pass(`pm-extends-stub-body: ${checked} extends-stub variant pm.md file(s) carry canonical stub bodies`);
  }
}

// Check: project-identity-placeholder (spec
// docs/designs/2026-09-24-scaffold-identity-overview-design.md, R9/D4) — the
// fleet-level, WARN-only sibling of audit.ts's per-project live-placeholder
// scan (audit.ts v2.41.0 added docs/project.md to its scope). Scans every
// delivered Projects/<name>/docs/ for residual identity placeholders using the
// SAME regex family as audit.ts (no new marker vocabulary): a docs/project.md
// still carrying the TODO(project-overview) fallback, or a docs/context.md
// still carrying the literal template placeholders (pre-2.13 residue), stays
// visible until the project team fills the identity seed. Regrowth-prevention
// sibling of T-20260924-004/007 for the identity class.
function checkProjectIdentityPlaceholders(): void {
  const projectsDir = join(ROOT, 'Projects');
  if (!existsSync(projectsDir)) return;
  const placeholderRe = /\[(Project Name|One-sentence description[^\]]*|TODO|TBD)\]|<variant-name>|<project-name>/i;
  for (const entry of readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (isTransientTestFixture(entry.name)) continue; // E2E staging dirs (T-20260916-001)
    const project = entry.name;
    const projectMdPath = join(projectsDir, project, 'docs', 'project.md');
    const contextMdPath = join(projectsDir, project, 'docs', 'context.md');
    if (existsSync(projectMdPath) && placeholderRe.test(readFileSync(projectMdPath, 'utf-8'))) {
      warn(project, 'project-identity-placeholder',
        `Projects/${project}/docs/project.md still carries the TODO(project-overview) identity fallback`,
        'Fill Description/Type in docs/project.md (scaffold flags --description/--type, or edit the file by hand — upgrades never overwrite it)');
    }
    if (existsSync(contextMdPath) && placeholderRe.test(readFileSync(contextMdPath, 'utf-8'))) {
      warn(project, 'project-identity-placeholder',
        `Projects/${project}/docs/context.md still carries literal template placeholders (pre-2.13 residue)`,
        'Run upgrade-project (the 2.13 footer delivers the docs/project.md pointer section), then fill docs/project.md');
    }
  }
}

function main(): number {
  if (!JSON_MODE) {
    console.log(`${colors.cyan}Template Lifecycle Validator${colors.reset}`);
    console.log(`${colors.dim}Root: ${ROOT}${colors.reset}`);
    console.log(`${colors.dim}Variant filter: ${variantArg}${colors.reset}`);
  }

  loadGovernance();
  checkGovernance();
  checkVersion();
  checkCommon();
  const manifests = checkVariantManifests();

  // Pre-load layer maps once for WS-04, WS-05, WS-06
  const scriptLayerMap = parseScriptLayers();
  const skillLayerMap = parseSkillLayers();

  // Check common/ commands and parity
  checkCommands('common');
  checkModelLiteralPlacement();
  checkTwinCommonSectionParity(); // VA-06: CLAUDE/GEMINI/CODEX twins carry the shared policy set
  // Script parity check removed (dead code after ADR-0036 TypeScript migration)
  checkVariantScopedSkillLeak();  // B-11: variant_scoped_skills must not live in common
  checkPlatformMirrorFreshness(); // T-20260916-008: platform skill mirrors carry SSOT versions
  checkVariantMirrorParity();     // T-20260921-009: variant mirrors carry the variant skill set
  checkSkillRegistrySync();       // VA-08: registry rows match SKILL.md frontmatter (WARN soak, T-20260925-007)
  checkRosterTierConsistency();   // T-20260921-020: roster tiers match resolved agent frontmatter tiers
  checkStyleNeutrality();         // B-12: L0/L1 style neutrality (ADR-0064/0066)

  let variantsChecked = 0;
  for (const [variant, manifest] of manifests) {
    if (variantArg !== 'all' && variant !== variantArg) continue;

    // Check Variant Contract for all variants (including draft)
    checkVariantContract(variant);
    checkSecurityGateSkills(variant);          // B-03
    checkVariantSkills(variant);               // B-09: presence-driven skill lifecycle
    checkVariantScriptsLayout(variant);        // B-10: scripts/<variant>/ layout convention
    checkDeprecatedVersionBump(variant, manifest); // B-08: deprecated → version bump warning
    checkPlatformSettingsParity(variant);      // VA-04: run for stable and beta/draft so bad platform keys cannot hide

    if (manifest.status === 'stable') {
      checkAgents(variant);
      checkAgentsRoster(variant);
      checkPhaseSummaryAgents(variant);
      checkWorkspaceRootAgentIntrusion(variant);
      checkSkillPlatformParity(variant);
      checkSkillMirrorVersionSync(variant);     // VA-07: mirror version sync (WARN soak, T-20260925-006)
      checkDocumentCommonSections(variant);
      checkCommands(variant);
      // Script parity check removed (dead code after ADR-0036 TypeScript migration)
      checkContextSync(variant);
      checkReadmePresence(variant);
      variantsChecked++;
    }
  }

  checkWorkspaceSchema();
  checkCommonContract();
  checkCommonContractReverseCoverage(); // C-CM-04: exists→listed contract coverage (T-20260910-019)
  for (const [variant, manifest] of manifests) {
    if (manifest.status === 'stable') checkCommonContractVariantSkills(variant);
  }

  // WS-04, WS-05, WS-06, WS-07, WS-08: Reverse-direction layer checks for co-* variants
  for (const [variant] of manifests) {
    if (!variant.startsWith('co-')) continue;
      checkL0ScriptsNotInVariants(variant, scriptLayerMap);       // WS-04
      checkL0L1ScriptsNotInVariants(variant, scriptLayerMap);     // WS-05
      checkL0OnlyToolRefsInVariantCommandSkills(variant);         // WS-05a
      checkVariantAgentReferences(variant);                        // T-007c: agent references resolve (WARN soak)
      checkVariantSkillsLayer(variant, skillLayerMap);             // WS-06
    checkNoVariantLocalContextMd(variant);                       // WS-07
    checkNoVariantVersionManifest(variant);                      // T-20260916-010: no stub/full manifest in variant templates
    checkReadmeStandard(variant);                                // WS-08
    checkContextMdStructure(variant);                            // WS-09
    checkAgentLifecycleFrontmatter(variant);                     // WS-10
    checkUserGuidePair(variant);                                 // WS-11
  }


// ── ADR-0090 W0: AGENTS.md thin-dispatcher precursor arms (WARN until W4 promotion) ──

const AGENTS_MD_SIZE_BUDGET = 15_000;

/** Size budget: every AGENTS.md at L0/L1/L2 must fit the thin-dispatcher budget. */
function checkAgentsMdSizeBudget(): void {
  if (!JSON_MODE) console.log('\n=== Check agents-md-size-budget: AGENTS.md ≤15,000 chars at every layer (ADR-0090) ===');
  const targets: Array<{ variant: string; path: string }> = [
    { variant: 'common', path: join(ROOT, 'AGENTS.md') },
    { variant: 'common', path: join(TEMPLATES_DIR, 'common', 'AGENTS.md') },
  ];
  if (existsSync(TEMPLATES_DIR)) {
    for (const entry of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('co-')) {
        targets.push({ variant: entry.name, path: join(TEMPLATES_DIR, entry.name, 'AGENTS.md') });
      }
    }
  }
  for (const t of targets) {
    if (!existsSync(t.path)) continue;
    const size = readFileSync(t.path, 'utf-8').length;
    if (size > AGENTS_MD_SIZE_BUDGET) {
      warn(t.variant, 'agents-md-size-budget',
        `${t.path}: ${size.toLocaleString()} chars exceeds the 15,000-char thin-dispatcher budget (ADR-0090) — user decision 2026-09-26 (design Addendum 3): WARN-only visibility metric, no FAIL promotion and no further reduction; Hermes consumers use the documented context_file_max_chars config`,
        `If truncation matters for a harness, see the config backstop in AGENTS.md §6`);
    } else {
      pass(`${t.path}: ${size.toLocaleString()} chars (within budget)`);
    }
  }
}

/** Pointer integrity: docs/governance|docs/constitution markdown references in any AGENTS.md must resolve on disk. */
function checkAgentsMdPointerIntegrity(): void {
  if (!JSON_MODE) console.log('\n=== Check agents-md-pointer-integrity: AGENTS.md reference pointers resolve (ADR-0090) ===');
  const targets: Array<{ variant: string; path: string; base: string }> = [
    { variant: 'common', path: join(ROOT, 'AGENTS.md'), base: ROOT },
    { variant: 'common', path: join(TEMPLATES_DIR, 'common', 'AGENTS.md'), base: join(TEMPLATES_DIR, 'common') },
  ];
  if (existsSync(TEMPLATES_DIR)) {
    for (const entry of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('co-')) {
        targets.push({ variant: entry.name, path: join(TEMPLATES_DIR, entry.name, 'AGENTS.md'), base: join(TEMPLATES_DIR, entry.name) });
      }
    }
  }
  let checked = 0;
  const candidateBases = (base: string): string[] => [ROOT, TEMPLATES_DIR ? join(TEMPLATES_DIR, 'common') : '', base].filter(Boolean);
  for (const t of targets) {
    if (!existsSync(t.path)) continue;
    const refs = [...readFileSync(t.path, 'utf-8').matchAll(/\]\((docs\/(?:governance|constitution)\/[^)`]+)\)/g)].map(m => m[1]);
    for (const ref of refs) {
      checked++;
      const resolvedSomewhere = candidateBases(t.base).some(b => existsSync(join(b, ref)));
      if (!resolvedSomewhere) {
        if (ref.startsWith('docs/constitution/')) {
          warn(t.variant, 'agents-md-pointer-integrity',
            `${t.path} references '${ref}' — resolves only post-scaffold (constitution docs are delivered at project creation)`,
            `Verify the file exists in templates delivery; if permanently absent, fix the pointer`);
        } else {
          fail(t.variant, 'agents-md-pointer-integrity',
            `${t.path} references '${ref}' but it does not exist at the workspace root, templates/common, or ${t.base}`,
            `Create the referenced governance file or fix the pointer`);
        }
      }
    }
  }
  if (checked === 0) {
    pass('agents-md-pointer-integrity: no pointer tables yet (populated at W1) — vacuous pass');
  } else {
    pass(`agents-md-pointer-integrity: ${checked} pointer reference(s) resolve`);
  }
}

  checkVariantIndexCoverage(manifests);                          // WS-12
  checkMirrorHygiene();                                          // R6: mirrors carry only skill dirs (spec 2026-09-25-verifier-platform-expansion-design)

  checkCountryProfileDivergence();                               // B-05: cross-variant last_verified divergence

  checkSharedFileSync();
  checkL0L1ScriptParity();
  checkPlatformDocumentationParity();
  checkRootCommonCommandsParity();
  checkPropagationMapSchema();
  checkMarkerZoneParity();                                       // PM-02: marker-inject zones vs target_variants
  checkManagedBlockParity();                                     // PM-04: WORKSPACE-MANAGED blocks, common → every variant MERGE_MANAGED copy (T-20260916-009, T-20260917-001)
  checkCommonAgentsBlockParity();                                // PM-04b: COMMON-AGENTS marker-inject zone, common → every variant AGENTS.md (ADR-0081, T-20260919-001)
  checkPropagationTargets();                                     // PM-03: target lists vs actual templates/co-* dir set (T-20260915-005)
  checkScaffoldMarkerSources();                                  // T-20260915-002: scaffolder markers vs source templates
  checkPmExtendsStubBodies();                                    // T-20260915-010: variant pm.md extends-stub bodies
  checkVariantReadinessGate();   // VRG-01: continuous Variant Readiness Gate enforcement
  checkProjectIdentityPlaceholders(); // fleet WARN: Projects/*/docs identity placeholders (spec 2026-09-24-scaffold-identity-overview-design)
  checkAgentsMdSizeBudget();          // ADR-0090 W0: thin-dispatcher ≤15k budget (WARN; FAIL promotion at W4)
  checkAgentsMdPointerIntegrity();    // ADR-0090 W0: pointer-table references resolve on disk

  // B-07: Sync validated variant info back to VERSION_REGISTRY.json
  if (!JSON_MODE) console.log('\n=== B-07: VERSION_REGISTRY.json sync ===');
  updateVersionRegistry(manifests);

  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  if (JSON_MODE) {
    console.log(JSON.stringify({
      variantsScanned: variantsChecked,
      errors,
      warnings,
      summary: `${errors.length} error(s), ${warnings.length} warning(s)`,
    }, null, 2));
  } else {
    console.log(`\n${colors.dim}${'─'.repeat(50)}${colors.reset}`);
    if (errors.length === 0) {
      console.log(`${colors.green}✓ ${errors.length} error(s), ${warnings.length} warning(s) across ${variantsChecked} stable variant(s)${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ ${errors.length} error(s), ${warnings.length} warning(s) across ${variantsChecked} stable variant(s)${colors.reset}`);
    }
  }

  // T-20260912-019: main() returns the exit code instead of exiting directly,
  // so importing this module never terminates the importer's process.
  return errors.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main());
}
