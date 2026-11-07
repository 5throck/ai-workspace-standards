#!/usr/bin/env bun
/**
 * L3-to-Variant Pipeline
 *
 * Complete pipeline for converting L3 projects to beta variants.
 * Orchestrates all wave components:
 * - Wave 1: L3 scanning (scan-l3-project.ts)
 * - Wave 2: L0/L1 reconciliation (reconcile-with-l0-l1.ts)
 * - Wave 3: Variant generation (generate-variant.ts)
 * - Wave 3: Beta lifecycle management (beta-lifecycle.ts)
 * - Wave 3: Platform parity validation (validate-platform-parity.ts)
 * - Wave 3: Workspace integration (integration-helpers.ts)
 *
 * @version 1.23.0
 * @phase: Complete pipeline orchestration
 *
 * v1.23.0 (2026-11-07, design docs/designs/2026-11-07-external-deps-machinery-design.md
 *          D4 — implements the upstream external-dependency machinery): PHASE 2.6 (new,
 *          after the country-scoped skill exclusion) — external-dependency
 *          install_dir exclusion. The L3 project's external-deps.json
 *          install_dirs are read from the PROJECT side and parsed loosely
 *          (scripts/lib/external-deps.ts v1.0.0 extractInstallDirsLoose), and
 *          every reconciled-manifest path under one is dropped from
 *          keepInVariant: no path under an external clone directory (e.g.
 *          external/ppt-master/) ever flows project → template. The
 *          vendoring guard (validate-templates.ts v1.72.0 external-dep-vendoring)
 *          remains the template-side backstop; promotion inherits it in Phase 6.
 *
 * v1.22.0 (2026-11-02, spec docs/designs/2026-11-01-hub-consolidation-design.md
 *          §6.1/§6.2 — Phase 1.5 pipeline conformance): hub-topology asset
 *          CLASSIFICATION replaces blind copying. PHASE 3.9 (new) classifies
 *          every L3-carried skill/agent the pipeline would copy against the
 *          hub_topology registry (helpers/hub-topology.ts — one derivation,
 *          no restatement): a hub-doctrine asset canonical to ANOTHER variant
 *          is NOT copied and the report names the required consume declaration
 *          (declare-first: the pipeline FLAGS "consumes declaration required:
 *          {domain, minimum_version}" — it never edits registry rows; the
 *          operator/PM applies it via variant.json before landing); a
 *          variant-identity asset owned by another variant REFUSES the run
 *          (identity is never absorbed); an unregistered asset copies as
 *          today PLUS a classification-report line (design: "unregistered
 *          assets → classification report to PM agenda, never silent").
 *          DEFAULT is enforce — the design text is normative ("hub-doctrine
 *          asset | NOT copied into other variants or the template") and the
 *          Phase 1 preflight/FAIL legs already primed the ecosystem; the
 *          explicit --hub-classify-report-only escape hatch downgrades the
 *          classification AND the Phase 4.8 preflight to warn-only for
 *          operator observation runs. PHASE 4.8 (new, design §6.2): promote
 *          preflight on the GENERATED template — hub.consumes minimum_version
 *          resolves against the registry (leg 3) and an unregistered
 *          hub-doctrine duplication in the template FAILs. Programmatic
 *          callers may inject hubTopologyOverride (E2E harness fixture runs).
 * v1.21.0 (2026-09-25, ADR-0088 W2): matchCountryScopedSkill recognizes
 *          .hermes/skills/ mirror paths — country-scoped skills can no longer
 *          leak into a promoted variant via the fifth platform mirror.
 * v1.19.0 (2026-09-16): Overlay guard + module-level rollback (design
 *          docs/designs/2026-09-16-variant-ization-overlay-guard-design.md,
 *          tickets T-20260916-003/-004). PHASE 0.6 (new) — fail-closed
 *          exists-guard on the promotion target BEFORE Phase 1 (must precede
 *          the Phase 3.5 auto-fix, which can write into a live
 *          templates/<variant> when the L3 source lives under templates/):
 *          absent → proceed; corrupt/foreign target → hard refuse;
 *          stable/deprecated → hard refuse (no bypass); beta/pre-release →
 *          refuse unless --overlay-variant (config.overlayVariant); explicit
 *          --output outside templates/ → exempt (E2E harness pattern).
 *          Rollback (§4.3) is wired through the MODULE failure paths — NOT a
 *          process-level hook, because the E2E harness imports the execute
 *          function: fresh-create failures rm the partial tree via
 *          rollbackPartialProject; authorized-overlay failures restore the
 *          pre-run snapshot (rename trio in rollback-partial-project.ts);
 *          green overlay runs discard the snapshot. Every rollback is
 *          best-effort and never masks the original phase error.
 * v1.18.0 (2026-09-15): H4 — Phase 3.5/4.5 failures now return buildFailureResult()
 *          instead of warn-and-continue (both are BLOCKING structural gates; an
 *          exception slipped past them into generation). M3 — main() refuses to
 *          run outside the workspace root (Phases 1.6/2.5/4/3.5-fix resolve
 *          cwd-relative paths and silently degrade elsewhere).
 *          (spec: docs/reports/2026-09-15-project-review-template-fleet.md)
 * v1.17.1 (2026-09-12): T-20260912-019 — the import.meta.main entry point now
 *          logs unhandled rejections and exits 1 instead of `.catch(console.error)`
 *          letting the process exit 0 (a failed pipeline could read as success).
 * v1.17.0 (2026-09-10): PHASE 4 post-generation cleanup now resolves the ACTIVE.md
 *          path from generatedVariant.variantPath (the root generateVariant actually
 *          wrote to) instead of config.outputPath, which is optional — omitting
 *          --output previously threw in cleanup and reported PHASE 4 FAILED after a
 *          successful generation.
 *
 * v1.16.0 (2026-09-10): PHASE 4.7 (new) — W1 context purification gate. After Phase
 *          4.6, fail-closed verification that every project-only section extracted
 *          during generation (generate-variant v1.14.0 ledger, summary.contextPurification)
 *          is present by normalized heading in the final docs/<variant>.context.md;
 *          outcome recorded into _pipeline_report.json
 *          (docs/designs/2026-09-10-context-purification-design.md D1).
 *
 * v1.14.0 (2026-08-29): Phase 0.5 pre-flight PROMOTION HOLD — reads the SOURCE project's
 *          variant.json promotionHold before any write and aborts; no --force bypass (the owner
 *          removes the hold after explicit user approval). Phase 8's gate alone ran too late —
 *          on the generated copy, after the workspace tree was already modified.
 *
 * v1.12.1: PHASE 2.5 (new) — country-scoped skill exclusion. reconcileWithL0L1()
 *          only discards files IDENTICAL to L1, so a --country KR draft whose
 *          k-dart/k-law/k-kosis diverged from templates/common stock (newer version,
 *          local edits) was classified 'modified' → keepInVariant → forked into
 *          templates/<variant>/skills/ by generateSkillDirectories() — duplicating
 *          common stock instead of staying registry-governed. Phase 2.5 now drops
 *          country_scoped_assets.skills entries (docs/workspace-schema.json SSOT,
 *          same registry pattern as project-to-variant.ts) from keepInVariant AND
 *          from the Phase 4 variant.json skill manifest.
 *
 * Pipeline Phases:
 *   PHASE 1   — L3 project scan (scan-l3-project.ts)
 *   PHASE 1.5 — Agent/skill normalization — NEW in v1.7.0 (normalize-agent-skills.ts)
 *               · Detects skill content in agent bodies (HIGH/MEDIUM/LOW confidence)
 *               · Extracts HIGH-confidence skill content → skills/<slug>/SKILL.md
 *               · Normalizes skill frontmatter (adds status, owner, last_reviewed)
 *               · Renames non-standard section headers (## Role → ## Context, etc.)
 *   PHASE 2   — L0/L1 reconciliation (reconcile-with-l0-l1.ts)
 *   PHASE 3   — Dependency validation
 *   PHASE 4   — Variant generation + agent frontmatter normalization (generate-variant.ts)
 *   PHASE 1.6 — pm.md structure pre-flight diagnosis — NEW in v1.8.2
 *               · Checks extends: pattern, 200-line limit, duplicate sections vs L1 common pm.md
 *               · Read-only (report-only) by default; set autoFixPmMd:true for guidance
 *               · Non-blocking: warns on issues, does not halt pipeline
 *   PHASE 3.5 — AGENTS.md §-structure pre-flight check — NEW in v1.8.2
 *               · Verifies §-numbered structure (§1/§3) and all 6 VARIANT-*-START/END markers
 *               · BLOCKING if markers missing (Phase 4 injection silently fails without them)
 *               · Set autoFixAgentsMd:true to auto-call regenerate-agents-md.ts and continue
 *   PHASE 3.7 — Plugin-based type validation — NEW in v1.9.0
 *               · Registry integrity check (fatal on error)
 *               · Required agents check (WARNING level)
 *               · Required capabilities check (ERROR level)
 *               · Plugin validation hooks (delegated to variant-type plugin)
 *               · Runs after Phase 3.5 and before Phase 4
 *   PHASE 4.5 — Golden reference structural gap check — NEW in v1.7.0 (golden-reference-loader.ts)
 *               · Layer 1: verifies 7 required agent sections + 5 required skill sections
 *               · Layer 2: checks variantType-specific optional sections
 *               · Writes _pipeline_report.md + _pipeline_report.json in variant root
 *               · Additional BLOCKING check: AGENTS.md VARIANT-* marker presence (double defense)
 *   PHASE 4.6 — Generated variant pm.md completion + context.md generation
 *               · Operates on GENERATED variant output (not L3 source)
 *               · Distinct from Phase 1.6 (source diagnosis)
 *   PHASE 4.7 — Context purification gate — NEW in v1.16.0
 *               · Fail-closed: every project-only section merged from the L3 source's
 *                 docs/context.md (generate-variant v1.14.0 seam ledger) must be
 *                 present by normalized heading in the final docs/<variant>.context.md
 *               · BLOCKING on mismatch; reports section names
 *               · Records merged/dropped outcome into _pipeline_report.json
 *   PHASE 5   — Beta lifecycle initialization
 *   PHASE 6   — Platform parity validation
 *   PHASE 7   — Workspace integration (DEPRECATED in v1.9.0 — defaults OFF)
 *               · Skipped by default; use --skip-integration=false to run
 *               · Migrate to: bun scripts/helpers/workspace-integration.ts --name=<name> --type=<type>
 *
 * See: docs/adr/0042-l2-variant-pipeline-wave15-golden-reference.md
 * See: docs/designs/variant-specialist-agent-structure.md
 * See: docs/designs/variant-specialist-skill-structure.md
 *
 * Dependencies:
 * - helpers/scan-l3-project.ts (L3 scanning)
 * - helpers/reconcile-with-l0-l1.ts (Reconciliation)
 * - helpers/generate-variant.ts (Variant generation + agent normalization)
 * - helpers/beta-lifecycle.ts (Lifecycle management)
 * - helpers/validate-platform-parity.ts (Parity validation)
 * - helpers/integration-helpers.ts (Workspace integration)
 * - helpers/variant-governance-rules.ts (Governance rules)
 * - lib/error-handling.ts (Error management)
 */

import { join, basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { cwd } from 'process';
import { execFileSync, spawnSync } from 'child_process';
import { readUTF8File } from './lib/encoding-utils.ts';
import { evaluateVariantOverlayTarget } from './lib/variant-overlay-guard.ts';
import {
  discardOverlaySnapshot,
  restoreOverlaySnapshot,
  rollbackPartialProject,
  snapshotDirForOverlay,
} from './helpers/rollback-partial-project.ts';
import { scanL3Project, L3ScanResult } from './helpers/scan-l3-project.ts';
import {
  normalizeAgentSkills,
  formatNormalizationReport,
  NormalizationResult,
} from './helpers/normalize-agent-skills.ts';
import {
  getAgentGoldenStructure,
  getSkillGoldenStructure,
  checkStructuralGaps,
  formatGapReport,
  StructuralGapReport,
  SKIP_AGENT_FILES,
} from './helpers/golden-reference-loader.ts';
import { reconcileWithL0L1, ReconciledManifest } from './helpers/reconcile-with-l0-l1.ts';
import { generateVariant, GeneratedVariant, VariantMetadata, parseAgentFile, extractAgentRoster, extractSkills } from './helpers/generate-variant.ts';
import {
  initializeBetaLifecycle,
  checkPromotionEligibilityDetails,
  BetaLifecycleState,
} from './helpers/beta-lifecycle.ts';
import { validatePlatformParity, ParityValidationResult } from './helpers/validate-platform-parity.ts';
import { integrateVariantToWorkspace, IntegrationResult } from './helpers/integration-helpers.ts';
import { validateDependencies } from './helpers/variant-governance-rules.ts';
import { ErrorPhase, fatalError, logError, logErrors } from './lib/error-handling.ts';
import { parsePmMd, extractVariantOverrides, resolveExtendsChain, writeContextMd } from './helpers/pm-md-parser.ts';
import { splitIntoTopLevelSections, normalizeHeading } from './helpers/context-sections.ts';
import type { VariantType } from './helpers/registries/variant-type-registry.ts';
import { listVariantTypes, isVariantType, getVariantTypeDefinition } from './helpers/registries/variant-type-registry.ts';
import {
  loadHubTopology,
  loadCommonContractNames,
  checkConsumerMinimumVersions,
  checkHubDoctrineDuplication,
  type HubTopology,
} from './helpers/hub-topology.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PipelineConfig {
  /** Path to L3 project */
  l3ProjectPath: string;
  /** Variant name */
  variantName: string;
  /** Variant type */
  variantType: VariantType;
  /** Variant description */
  variantDescription: string;
  /** Skip platform parity validation */
  skipParityValidation?: boolean;
  /** Skip workspace integration */
  skipIntegration?: boolean;
  /** Skip Wave 1.5 agent/skill normalization (default: false) */
  skipNormalization?: boolean;
  /** Treat MEDIUM-confidence skill patterns as HIGH (auto-extract without approval gate) */
  autoExtract?: boolean;
  /** Auto-fix pm.md structural issues found in Phase 1.6 (default: false = report only) */
  autoFixPmMd?: boolean;
  /** Auto-regenerate AGENTS.md when §-structure/VARIANT-* markers are missing in Phase 3.5 (default: false) */
  autoFixAgentsMd?: boolean;
  /** Output path for variant (optional) */
  outputPath?: string;
  /**
   * Authorize overwriting an EXISTING pre-release (beta) variant template
   * (v1.19.0). The overlay destroys the previous tree as a unit — per-file
   * history lives in git, not on disk. stable/deprecated targets refuse even
   * with this flag (design 2026-09-16-variant-ization-overlay-guard §3.3).
   */
  overlayVariant?: boolean;
  /** Variant version (default: '0.1.0') */
  version?: string;
  /** Variant lifecycle status (default: 'beta') */
  status?: string;
  /**
   * Hub-topology classification mode (v1.22.0, design §6.1/§6.2 Phase 1.5).
   * 'enforce' (default) — a hub-doctrine asset canonical to ANOTHER variant is
   * NOT copied (the report names the required consume declaration) and a
   * foreign variant-identity asset refuses the run; 'report-only' downgrades
   * both to warnings and the Phase 4.8 preflight to warn-only (operator
   * observation runs; the design default is enforcement).
   */
  hubClassificationMode?: 'enforce' | 'report-only';
  /**
   * Registry injection for programmatic callers (E2E harness fixture runs).
   * Default: loadHubTopology(cwd()) — the workspace-root docs/workspace-schema.json
   * hub_topology section. An absent/malformed registry skips classification
   * (legacy-checkout posture, same as the validate-templates legs).
   */
  hubTopologyOverride?: HubTopology;
}

export interface PipelineResult {
  /** Whether pipeline succeeded */
  success: boolean;
  /** Pipeline execution phases */
  phases: {
    scan: { success: boolean; result?: L3ScanResult; error?: string };
    reconcile: { success: boolean; result?: ReconciledManifest; error?: string };
    generate: { success: boolean; result?: GeneratedVariant; error?: string };
    lifecycle: { success: boolean; result?: BetaLifecycleState; error?: string };
    parity: { success: boolean; result?: ParityValidationResult; error?: string };
    skillGraph: { success: boolean; error?: string };
    integrate: { success: boolean; result?: IntegrationResult; error?: string };
  };
  /** Final output path */
  variantPath?: string;
  /** Total execution time (ms) */
  executionTime: number;
  /** Pipeline errors */
  errors: Array<{ phase: string; error: string }>;
}

/**
 * Phase 4.7 gate core (v1.16.0, W1 context purification): which merged sections from
 * the purification ledger are MISSING (by normalized heading) from the final
 * docs/<variant>.context.md? Exported pure function so the fail-closed gate logic is
 * unit-testable independently of the pipeline's heavier phases. Any non-empty result
 * is a Phase 4.7 BLOCKING error.
 */
export function findMissingPurifiedSections(finalContent: string, mergedHeadings: string[]): string[] {
  const presentHeadings = new Set(splitIntoTopLevelSections(finalContent).map(s => s.heading));
  return mergedHeadings
    .map(heading => normalizeHeading(heading))
    .filter(heading => !presentHeadings.has(heading));
}

// ============================================================================
// HUB-TOPOLOGY ASSET CLASSIFICATION (v1.22.0 — design §6.1, Phase 1.5)
// ============================================================================

export type HubAssetKind = 'skill' | 'agent';

/**
 * One classification verdict for one L3-carried asset the pipeline would copy
 * into the promoted template (design §6.1):
 * - copy: sanctioned (own-hub promotion, common-contract stock, registered
 *   escalation-category content) — copied as today;
 * - copy-unregistered: no hub_topology row — copied as today PLUS a
 *   classification-report line to the PM agenda (never silent);
 * - skip: hub-doctrine canonical to ANOTHER variant — NOT copied; the report
 *   flags the consume declaration the operator/PM must apply via variant.json
 *   (declare-first: the pipeline never edits registry rows);
 * - refuse: variant-identity owned by another variant — identity assets are
 *   never absorbed; the run fails.
 */
export type HubClassification =
  | { action: 'copy'; asset: string; kind: HubAssetKind }
  | { action: 'copy-unregistered'; asset: string; kind: HubAssetKind }
  | {
      action: 'skip';
      asset: string;
      kind: HubAssetKind;
      domain: string;
      hubVariant: string;
      /** Registry entry version = the minimum_version the consume declaration must declare. */
      minimumVersion: string;
      /** True when the target variant is ALREADY a declared consumer (entry.consumers[]). */
      declaredConsumer: boolean;
    }
  | { action: 'refuse'; asset: string; kind: HubAssetKind; hubVariant: string };

export interface ClassifyAssetsArgs {
  /** Assets the pipeline would copy: L3-carried skills + agent-roster names. */
  assets: Array<{ name: string; kind: HubAssetKind }>;
  /** hub_topology.entries rows (unknown[] straight from the registry). */
  entries: unknown[];
  /** Target variant name of this promotion run (e.g. 'co-e2etest'). */
  targetVariant: string;
  /** Common-contract asset names — L1-delivered stock is inheritance, not
   * duplication (same exclusion as the duplicate legs; classification skips them). */
  commonNames?: Set<string>;
}

/**
 * Pure per-asset classification against the hub_topology registry. Exported so
 * the unit suite pins the §6.1 semantics without running the pipeline. Reuses
 * helpers/hub-topology.ts vocabulary — one derivation, no restatement.
 */
export function classifyAssetsForPromotion(args: ClassifyAssetsArgs): HubClassification[] {
  const entries = (Array.isArray(args.entries) ? args.entries : []).filter(
    (row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row),
  );
  const byAsset = new Map<string, Array<Record<string, unknown>>>();
  for (const e of entries) {
    const asset = typeof e['asset'] === 'string' ? e['asset'] : '';
    if (!asset) continue;
    const list = byAsset.get(asset);
    if (list) list.push(e);
    else byAsset.set(asset, [e]);
  }

  return args.assets.map(({ name, kind }): HubClassification => {
    // Common-contract delivery is inheritance — never classified against the registry.
    if (args.commonNames?.has(name)) return { action: 'copy', asset: name, kind };
    const rows = byAsset.get(name) ?? [];
    if (rows.length === 0) return { action: 'copy-unregistered', asset: name, kind };

    // (b) variant-identity owned by another variant → refuse (identity is never absorbed).
    // The owning variant itself matches one identity row and is sanctioned.
    const identityRows = rows.filter(e => e['category'] === 'variant-identity');
    if (identityRows.length > 0) {
      const own = identityRows.find(e => e['hub_variant'] === args.targetVariant);
      if (!own) {
        return { action: 'refuse', asset: name, kind, hubVariant: String(identityRows[0]['hub_variant'] ?? '<unknown>') };
      }
      return { action: 'copy', asset: name, kind };
    }

    // (a) hub-doctrine canonical to another variant → skip + flag the consume declaration.
    const doctrineRow = rows.find(e => e['category'] === 'hub-doctrine' && e['hub_variant'] !== args.targetVariant);
    if (doctrineRow) {
      const consumers = Array.isArray(doctrineRow['consumers']) ? doctrineRow['consumers'] : [];
      const declaredConsumer = (consumers as unknown[]).some(
        c => c && typeof c === 'object' && String((c as Record<string, unknown>)['variant'] ?? '') === args.targetVariant,
      );
      return {
        action: 'skip',
        asset: name,
        kind,
        domain: String(doctrineRow['domain'] ?? '<unknown>'),
        hubVariant: String(doctrineRow['hub_variant'] ?? '<unknown>'),
        minimumVersion: String(doctrineRow['version'] ?? '<unknown>'),
        declaredConsumer,
      };
    }

    // Registered non-doctrine/non-identity content (hub-escalation, incident-escalation)
    // or doctrine owned by the target itself → copy.
    return { action: 'copy', asset: name, kind };
  });
}

export interface HubClassificationReport {
  mode: 'enforce' | 'report-only';
  /** Human-readable report lines (console + _pipeline_report.md). */
  lines: string[];
  /** Consume declarations the operator/PM must apply via variant.json before landing. */
  requiredDeclarations: Array<{ asset: string; domain: string; minimum_version: string; hub_variant: string; declared_consumer: boolean }>;
  unregistered: Array<{ asset: string; kind: HubAssetKind }>;
  refused: Array<{ asset: string; kind: HubAssetKind; hub_variant: string }>;
  skipped: Array<{ asset: string; kind: HubAssetKind; hub_variant: string }>;
  verdicts: HubClassification[];
}

/**
 * Format the classification verdicts into report lines + machine-usable
 * groupings. Design §6.1: "unregistered assets → classification report to PM
 * agenda (never silent)"; declare-first means the pipeline FLAGS "consumes
 * declaration required: {domain, minimum_version}" rather than editing
 * registry rows.
 */
export function formatHubClassificationReport(verdicts: HubClassification[], mode: 'enforce' | 'report-only'): HubClassificationReport {
  const report: HubClassificationReport = {
    mode,
    lines: [],
    requiredDeclarations: [],
    unregistered: [],
    refused: [],
    skipped: [],
    verdicts,
  };
  for (const v of verdicts) {
    switch (v.action) {
      case 'skip':
        report.skipped.push({ asset: v.asset, kind: v.kind, hub_variant: v.hubVariant });
        report.requiredDeclarations.push({
          asset: v.asset,
          domain: v.domain,
          minimum_version: v.minimumVersion,
          hub_variant: v.hubVariant,
          declared_consumer: v.declaredConsumer,
        });
        report.lines.push(
          `hub-doctrine skip: ${v.kind} '${v.asset}' is canonical to hub ${v.hubVariant} (domain ${v.domain}) — NOT copied. ` +
            `consumes declaration required: {domain: ${v.domain}, minimum_version: ${v.minimumVersion}} ` +
            `(apply via variant.json hub.consumes before landing; declaredConsumer: ${v.declaredConsumer ? 'yes' : 'no'})`,
        );
        break;
      case 'copy-unregistered':
        report.unregistered.push({ asset: v.asset, kind: v.kind });
        report.lines.push(
          `unregistered asset: ${v.kind} '${v.asset}' has no hub_topology entry — copied as today; ` +
            `classification report to PM agenda for disposition (design §6.1: never silent)`,
        );
        break;
      case 'refuse':
        report.refused.push({ asset: v.asset, kind: v.kind, hub_variant: v.hubVariant });
        report.lines.push(
          `variant-identity refusal: ${v.kind} '${v.asset}' is variant-identity owned by ${v.hubVariant} — ` +
            `identity assets are never absorbed (design §6.1)`,
        );
        break;
      case 'copy':
        break; // sanctioned copies are unremarkable
    }
  }
  return report;
}

// ============================================================================
// COUNTRY-SCOPED SKILL REGISTRY (ADR-0057/0058)
// ============================================================================

/**
 * Load the country-scoped skill names from docs/workspace-schema.json (SSOT).
 * Same registry pattern as scripts/project-to-variant.ts. Returns an empty set
 * when the schema is missing or unreadable (pipeline stays runnable; the
 * exclusion simply becomes a no-op).
 */
function loadCountryScopedSkillNames(): Set<string> {
  const scoped = new Set<string>();
  try {
    const schemaPath = join(process.cwd(), 'docs', 'workspace-schema.json');
    if (!existsSync(schemaPath)) return scoped;
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const countryScoped = schema.country_scoped_assets as { skills?: Record<string, string> } | undefined;
    if (countryScoped?.skills) {
      for (const name of Object.keys(countryScoped.skills)) scoped.add(name);
    }
  } catch {
    // Schema unreadable — proceed without exclusion (registry-governed common stock
    // still prevents identical-file forks via reconcile's 'identical' discard).
  }
  return scoped;
}

/** Match a manifest targetPath against a country-scoped skill's mirror locations. */
function matchCountryScopedSkill(targetPath: string, scopedSkills: Set<string>): string | null {
  const normalized = targetPath.replace(/\\/g, '/');
  for (const name of scopedSkills) {
    if (
      normalized.startsWith(`skills/${name}/`) ||
      normalized.startsWith(`.claude/skills/${name}/`) ||
      normalized.startsWith(`.gemini/skills/${name}/`) ||
      normalized.startsWith(`.agents/skills/${name}/`) ||
      normalized.startsWith(`.codex/skills/${name}/`) ||
      normalized.startsWith(`.hermes/skills/${name}/`)
    ) {
      return name;
    }
  }
  return null;
}

// ============================================================================
// MAIN PIPELINE FUNCTION
// ============================================================================

/**
 * Execute complete L3-to-variant pipeline
 * @version 1.5.0 — v1.19.0 adds the Phase 0.6 overlay guard (before Phase 1)
 *                  and module-level rollback on every failure path
 *                  (failWithRollback); green overlay runs discard the snapshot.
 *                  v1.3.0 — Phase 3.5/4.5 failures returned buildFailureResult()
 *                  instead of calling process.exit(1) directly, so programmatic
 *                  callers can handle failure without their host process dying
 *                  (Issue A.3).
 */
export async function executeL3ToVariantPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`L3-to-Variant Pipeline`);
  console.log(`Variant: ${config.variantName}`);
  console.log(`Type: ${config.variantType}`);
  console.log(`${'='.repeat(60)}\n`);

  const errors: Array<{ phase: string; error: string }> = [];

  // T-012-BUG: the Phase 0.5 promotion-hold early return below referenced `phases`
  // before its declaration — at runtime that path threw
  // "ReferenceError: Cannot access 'phases' before initialization". The (pure)
  // declaration is hoisted above the early return; no other behavior changed.
  const phases: PipelineResult['phases'] = {
    scan: { success: false },
    reconcile: { success: false },
    generate: { success: false },
    lifecycle: { success: false },
    parity: { success: false },
    skillGraph: { success: false },
    integrate: { success: false },
  };

  // ============================================================================
  // PHASE 0.5: PROMOTION HOLD — pre-flight governance block (v1.14.0)
  // ============================================================================
  // A source project may declare `promotionHold: { hold: true, ... }` in its
  // variant.json (standing directive 2026-08-29: co-newbiz / co-architect must
  // not become variant templates without explicit user permission). Checked
  // HERE, before any write, because the Phase 8 readiness gate runs on the
  // generated template copy *after* the workspace tree has already been
  // modified — too late to count as consent. There is no --force bypass for
  // the hold: the owner must remove the promotionHold block from variant.json.
  const srcVariantJsonPath = join(config.l3ProjectPath, 'variant.json');
  if (existsSync(srcVariantJsonPath)) {
    try {
      const src = JSON.parse(readFileSync(srcVariantJsonPath, 'utf-8')) as {
        promotionHold?: { hold?: boolean; reason?: string };
      };
      if (src.promotionHold?.hold === true) {
        const msg =
          `PROMOTION HOLD on ${config.l3ProjectPath}: variant promotion requires explicit user ` +
          `permission before running this pipeline. Remove the promotionHold block from the ` +
          `project's variant.json only after the user approves the promotion in plain language.` +
          (src.promotionHold.reason ? ` Reason: ${src.promotionHold.reason}` : '');
        console.error(`\n❌ ${msg}`);
        return {
          success: false,
          variantPath: undefined,
          phases,
          executionTime: Date.now() - startTime,
          errors: [{ phase: 'promotion-hold', error: msg }],
        };
      }
    } catch {
      // Unparseable source variant.json — let Phase 1's own validation report it.
    }
  }

  // ============================================================================
  // PHASE 0.6: OVERLAY GUARD — fail-closed exists-guard on the promotion target
  // (v1.19.0, design docs/designs/2026-09-16-variant-ization-overlay-guard-design.md §3.2 point 1)
  // ============================================================================
  // Runs BEFORE Phase 1 — and therefore before the Phase 3.5 auto-fix, which
  // can already write into a live templates/<variant> when the L3 source lives
  // under templates/. An explicit --output outside templates/ is exempt (the
  // E2E harness pattern). The guard lives in the exported execute function, not
  // main(), so programmatic callers (the E2E harness imports this function)
  // get the same protection.
  // ============================================================================
  const resolvedOutputRoot = config.outputPath
    ? resolve(config.outputPath)
    : join(cwd(), 'templates', config.variantName);
  const overlayVerdict = evaluateVariantOverlayTarget({
    targetDir: resolvedOutputRoot,
    workspaceRoot: cwd(),
    overlayAuthorized: config.overlayVariant === true,
    explicitOutput: Boolean(config.outputPath),
  });

  // ============================================================================
  // ROLLBACK STATE (design §4.3) — module failure paths, NOT process-level
  // hooks: this module is imported by scripts/test-l3-to-variant-promotion.ts,
  // and a module-scope exit hook would roll back inside the harness process.
  //   fresh   — this run created the target; failure rm's the partial tree.
  //   overlay — the target pre-existed and overlay was authorized; the tree is
  //             snapshotted right before Phase 4 and RESTORED on failure.
  //   null    — exempt-output; the destination was named by the caller, so this
  //             run owns no rollback for it.
  // Every rollback is best-effort with loud reporting and never masks the
  // original phase error (it runs BEFORE the failure result is returned, so
  // the phase error is already on stderr; rollback failures add their own
  // lines and keep any snapshot on disk for manual recovery).
  // ============================================================================
  let rollbackMode: 'fresh' | 'overlay' | null = null;
  let overlayBackupPath: string | undefined;
  let rollbackSettled = false;

  const settleFailureRollback = (): void => {
    if (rollbackSettled || rollbackMode === null) return;
    rollbackSettled = true;
    try {
      if (rollbackMode === 'overlay') {
        if (!overlayBackupPath) return; // failed before the snapshot — nothing pre-run to restore
        const restored = restoreOverlaySnapshot(overlayBackupPath, resolvedOutputRoot, cwd());
        if (restored.restored) {
          console.error(`🛡️  Rollback: previous variant tree restored from ${overlayBackupPath}`);
        } else {
          console.error(`🛡️  Rollback FAILED — the original phase error above stands. Snapshot kept at ${overlayBackupPath} (${restored.reason ?? 'unknown reason'})`);
        }
      } else {
        const rolledBack = rollbackPartialProject(resolvedOutputRoot, cwd());
        if (rolledBack.rolledBack) {
          console.error(`🛡️  Rollback: removed the partially generated tree at ${resolvedOutputRoot}`);
        } else if (rolledBack.reason && rolledBack.reason !== 'nothing to roll back') {
          console.error(`🛡️  Rollback could not remove ${resolvedOutputRoot} — ${rolledBack.reason}. The original phase error above stands.`);
        }
      }
    } catch (rollbackError) {
      console.error(`🛡️  Rollback error (original phase error above stands): ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
  };

  const settleSuccessDiscard = (): void => {
    if (rollbackSettled || rollbackMode !== 'overlay' || !overlayBackupPath) return;
    rollbackSettled = true;
    try {
      const discarded = discardOverlaySnapshot(overlayBackupPath, cwd());
      if (!discarded.discarded) {
        console.error(`⚠️  Overlay snapshot could not be discarded (${discarded.reason ?? 'unknown reason'}) — remove ${overlayBackupPath} manually.`);
      }
    } catch (discardError) {
      console.error(`⚠️  Overlay snapshot discard error: ${discardError instanceof Error ? discardError.message : String(discardError)}`);
    }
  };

  /** Failure-result seam: settles rollback ownership, then builds the result. */
  const failWithRollback = (): PipelineResult => {
    settleFailureRollback();
    return buildFailureResult(phases, errors, startTime);
  };

  if (overlayVerdict.action === 'refuse') {
    console.error(`\n❌ ${overlayVerdict.message}`);
    errors.push({ phase: 'overlay-guard', error: overlayVerdict.message });
    // Refusal happens before any write and before any snapshot — the target is
    // untouched, so there is deliberately nothing to roll back.
    return failWithRollback();
  }
  rollbackMode = overlayVerdict.classification === 'absent'
    ? 'fresh'
    : overlayVerdict.classification === 'overlay-authorized'
      ? 'overlay'
      : null; // exempt-output

  let scanResult: L3ScanResult | undefined;
  let reconciledManifest: ReconciledManifest | undefined;
  let generatedVariant: GeneratedVariant | undefined;
  let lifecycleState: BetaLifecycleState | undefined;
  let parityResult: ParityValidationResult | undefined;
  let integrationResult: IntegrationResult | undefined;

  // ============================================================================
  // PHASE 1: SCAN L3 PROJECT
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 1: Scanning L3 Project`);
    console.log(`${'─'.repeat(60)}`);

    scanResult = await scanL3Project(config.l3ProjectPath);
    phases.scan = { success: true, result: scanResult };
    console.log(`✅ PHASE 1 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    phases.scan = { success: false, error: errorMsg };
    errors.push({ phase: 'scan', error: errorMsg });
    console.error(`❌ PHASE 1 FAILED: ${errorMsg}`);
  }

  if (!phases.scan.success) {
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 1.5: AGENT/SKILL NORMALIZATION (Wave 1.5)
  // ============================================================================

  if (!config.skipNormalization) {
    try {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`PHASE 1.5: Agent/Skill Normalization`);
      console.log(`${'─'.repeat(60)}`);

      const normResult: NormalizationResult = normalizeAgentSkills(
        scanResult!,
        config.l3ProjectPath,
        { auto: config.autoExtract ?? false, dryRun: false },
      );

      const report = formatNormalizationReport(normResult);
      console.log(report);

      if (normResult.pendingApprovals.length > 0) {
        console.warn(`⚠️  ${normResult.pendingApprovals.length} MEDIUM-confidence pattern(s) require review.`);
        console.warn(`   Re-run with autoExtract: true to extract automatically.`);
      }

      console.log(`✅ PHASE 1.5 COMPLETE`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Non-fatal: log and continue
      console.warn(`⚠️  PHASE 1.5 WARNING: ${errorMsg}`);
    }
  } else {
    console.log(`\nPHASE 1.5: Skipped (skipNormalization=true)`);
  }

  // ============================================================================
  // PHASE 1.6: PM.MD STRUCTURE PRE-FLIGHT DIAGNOSIS
  // ============================================================================
  // Read-only by default. Checks: extends: pattern, 200-line limit, duplicate
  // sections vs L1 common pm.md. Set autoFixPmMd:true to enable auto-slimming.
  // Non-blocking: issues are reported as warnings to allow human decision.
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 1.6: pm.md Structure Pre-flight Diagnosis`);
    console.log(`${'─'.repeat(60)}`);

    const { readFileSync: rfs, existsSync: ex16 } = await import('node:fs');
    const { join: j16 } = await import('node:path');

    const l3PmPath = j16(config.l3ProjectPath, 'agents', 'pm.md');
    const l1CommonPmPath = j16('templates', 'common', 'agents', 'pm.md');

    if (!ex16(l3PmPath)) {
      console.log(`ℹ️  No agents/pm.md found in L3 source — skipping Phase 1.6`);
    } else {
      const pmContent = rfs(l3PmPath, 'utf-8');
      const pmLines = pmContent.split('\n').length;
      const pmIssues: string[] = [];

      // Check 1: extends: pattern
      if (!pmContent.includes('extends:')) {
        pmIssues.push(`Missing 'extends:' pattern — L3 pm.md should delegate to common via extends: ../../common/agents/pm.md`);
      }

      // Check 2: 200-line limit
      if (pmLines > 200) {
        pmIssues.push(`Line count ${pmLines} exceeds 200-line L3 limit (L0 duplication bug risk)`);
      }

      // Check 3: Duplicate sections vs L1 common pm.md
      // Only flag headers that appear OUTSIDE frontmatter and VARIANT-SECTION blocks.
      // Headers inside frontmatter scalars (variant_overrides) and VARIANT-SECTION blocks
      // are intentional overrides, not duplicates.
      if (ex16(l1CommonPmPath)) {
        const l1Content = rfs(l1CommonPmPath, 'utf-8');
        const l1Headers = [...l1Content.matchAll(/^#{1,3} .+/gm)].map(m => m[0].trim());
        // Extract body only (after the second --- frontmatter delimiter)
        const fmEndIdx = pmContent.indexOf('---', pmContent.indexOf('---') + 3);
        const bodyOnly = fmEndIdx >= 0 ? pmContent.slice(fmEndIdx + 3) : pmContent;
        // Strip VARIANT-SECTION blocks (intentional overrides, not duplicates)
        const stripped = bodyOnly.replace(
          /<!--\s*VARIANT-SECTION:.*?-->[\s\S]*?<!--\s*END VARIANT-SECTION\s*-->/g, ''
        );
        const l2Headers = [...stripped.matchAll(/^#{1,3} .+/gm)].map(m => m[0].trim());
        const duplicates = l2Headers.filter(h => l1Headers.includes(h));
        if (duplicates.length > 0) {
          pmIssues.push(`${duplicates.length} section header(s) duplicated from L1 common pm.md: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`);
        }
      }

      if (pmIssues.length === 0) {
        console.log(`✅ pm.md structure OK (${pmLines} lines, extends pattern present)`);
      } else {
        console.warn(`⚠️  PHASE 1.6: pm.md has ${pmIssues.length} structural issue(s):`);
        for (const issue of pmIssues) {
          console.warn(`   - ${issue}`);
        }
        if (config.autoFixPmMd) {
          console.warn(`   autoFixPmMd=true: Manual review recommended — automatic pm.md slimming not yet implemented.`);
          console.warn(`   Action required: manually slim agents/pm.md to < 200 lines using extends: pattern.`);
        } else {
          console.warn(`   Run with autoFixPmMd:true to enable auto-fix guidance, or fix manually before proceeding.`);
        }
      }
    }

    console.log(`✅ PHASE 1.6 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  PHASE 1.6 WARNING: ${errorMsg}`);
  }

  // ============================================================================
  // PHASE 2: RECONCILE WITH L0/L1
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 2: Reconciling with L0/L1`);
    console.log(`${'─'.repeat(60)}`);

    reconciledManifest = await reconcileWithL0L1(scanResult!, config.variantName);
    phases.reconcile = { success: true, result: reconciledManifest };
    console.log(`✅ PHASE 2 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    phases.reconcile = { success: false, error: errorMsg };
    errors.push({ phase: 'reconcile', error: errorMsg });
    console.error(`❌ PHASE 2 FAILED: ${errorMsg}`);
  }

  if (!phases.reconcile.success) {
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 2.5: COUNTRY-SCOPED SKILL EXCLUSION (registry-governed)
  // ============================================================================
  // A --country KR L3 draft legitimately carries k-dart/k-law/k-kosis (scaffold-time
  // pruning keeps them when the country matches). reconcileWithL0L1() only discards
  // files IDENTICAL to L1 — a draft whose scoped skill diverged (newer version, local
  // edits) is classified 'modified' → keepInVariant → forked into
  // templates/<variant>/skills/<name>/ by generateSkillDirectories(). Scoped skills
  // are registry-governed common stock (country_scoped_assets.skills in
  // docs/workspace-schema.json — same SSOT read as project-to-variant.ts) and must
  // never be forked into a variant; per-project distribution happens exclusively via
  // scaffold-time pruning (prune-country-scoped-assets.ts).
  // ============================================================================
  const scopedSkillNames = loadCountryScopedSkillNames();
  if (scopedSkillNames.size > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 2.5: Country-Scoped Skill Exclusion (${scopedSkillNames.size} registered)`);
    console.log(`${'─'.repeat(60)}`);

    const excludedSkills = new Set<string>();
    const keptCountBefore = reconciledManifest!.keepInVariant.length;
    reconciledManifest!.keepInVariant = reconciledManifest!.keepInVariant.filter((file) => {
      const scoped = matchCountryScopedSkill(file.targetPath, scopedSkillNames);
      if (scoped) {
        excludedSkills.add(scoped);
        return false;
      }
      return true;
    });

    for (const name of excludedSkills) {
      console.log(`  country-scoped skill ${name} stays in templates/common (registry-governed) — not forked`);
    }
    if (excludedSkills.size === 0) {
      console.log(`  (no country-scoped skills in the reconciled manifest — nothing to exclude)`);
    } else {
      console.log(`  keepInVariant: ${keptCountBefore} → ${reconciledManifest!.keepInVariant.length} file(s)`);
    }
    console.log(`✅ PHASE 2.5 COMPLETE`);
  }

  // ============================================================================
  // PHASE 2.6: EXTERNAL-DEPENDENCY INSTALL_DIR EXCLUSION (v1.23.0, design
  // docs/designs/2026-11-07-external-deps-machinery-design.md D4)
  //
  // Propagation never crosses the template boundary (D4): no path under any
  // external-deps.json manifest install_dir may flow project → template. The
  // gitignored external clone (e.g. external/ppt-master/) is upstream
  // code consumed at a pin — promoting it would vendor a fork into the
  // template tree (the vendoring guard in validate-templates.ts then FAILs).
  // The manifest is read from the PROJECT side and parsed loosely
  // (extractInstallDirsLoose) so the exclusion works even on legacy/interim
  // manifest shapes; strict validation is the upgrade pass's job.
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 2.6: External-Dependency install_dir Exclusion`);
    console.log(`${'─'.repeat(60)}`);

    const { existsSync: ex26, readFileSync: rfs26 } = await import('node:fs');
    const { join: j26 } = await import('node:path');
    const { extractInstallDirsLoose } = await import('./lib/external-deps.ts');

    const projManifestPath = j26(config.l3ProjectPath, 'external-deps.json');
    const installDirs = ex26(projManifestPath) ? extractInstallDirsLoose(rfs26(projManifestPath, 'utf-8')) : [];
    if (installDirs.length === 0) {
      console.log(`ℹ️  No external-deps.json install_dirs at the L3 source — nothing to exclude`);
    } else {
      const before26 = reconciledManifest!.keepInVariant.length;
      const excluded26: string[] = [];
      reconciledManifest!.keepInVariant = reconciledManifest!.keepInVariant.filter((file) => {
        const target26 = file.targetPath.replace(/\\/g, '/').replace(/^\.\//, '');
        const under = installDirs.some((dir) => target26 === dir || target26.startsWith(`${dir}/`));
        if (under) excluded26.push(target26);
        return !under;
      });
      for (const rel of excluded26) {
        console.log(`  ⏭️  excluded ${rel} — path under an external-deps.json install_dir (never flows project → template, design D4)`);
      }
      if (excluded26.length === 0) {
        console.log(`  ✅ ${installDirs.length} install_dir(s) declared — no reconciled manifest paths under them`);
      } else {
        console.log(`  keepInVariant: ${before26} → ${reconciledManifest!.keepInVariant.length} file(s)`);
      }
    }
    console.log(`✅ PHASE 2.6 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Fail-closed on exclusion machinery errors would strand every promotion on
    // a helper hiccup; the vendoring guard (validate-templates) still runs in
    // Phase 6 and FAILs if anything vendored anyway. Warn-and-continue here.
    console.warn(`⚠️  PHASE 2.6 errored (non-fatal — the vendoring guard remains the backstop): ${errorMsg}`);
  }

  // ============================================================================
  // PHASE 3: VALIDATE DEPENDENCIES
  // ============================================================================

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`PHASE 3: Validating Dependencies`);
  console.log(`${'─'.repeat(60)}`);

  const depValidation = validateDependencies(config.variantName);
  if (!depValidation.valid) {
    console.warn(`⚠️  Dependency validation warnings:`);
    if (depValidation.circularDependencies.length > 0) {
      console.warn(`  Circular dependencies detected:`);
      for (const cycle of depValidation.circularDependencies) {
        console.warn(`    - ${cycle.join(' → ')}`);
      }
    }
    if (depValidation.missingDependencies.length > 0) {
      console.warn(`  New variant not in dependency graph (this is expected for new variants):`);
      for (const missing of depValidation.missingDependencies) {
        console.warn(`    - ${missing}`);
      }
    }
    console.warn(`  ⚠️  Proceeding with variant generation. Update VARIANT_DEPENDENCY_GRAPH after validation.`);
    // Don't fail - allow new variants to be created
  } else {
    console.log(`✅ Dependency validation passed`);
  }
  console.log(`✅ PHASE 3 COMPLETE`);

  // ============================================================================
  // PHASE 3.5: AGENTS.MD §-STRUCTURE AND VARIANT-* MARKER PRE-FLIGHT CHECK
  // ============================================================================
  // Verifies the L3 source AGENTS.md has the §-numbered structure and all 6
  // VARIANT-*-START/END anchor markers required for Phase 4 injection.
  // Without markers, injectVariantPlaceholders() silently produces an uninjected
  // file — this gate catches that BEFORE generation runs.
  //
  // Default: report-only (non-blocking warn). Set autoFixAgentsMd:true to
  // auto-regenerate from templates/common/AGENTS.md via regenerate-agents-md.ts.
  // BLOCKING if auto-fix is not available and markers are missing.
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 3.5: AGENTS.md §-Structure Pre-flight Check`);
    console.log(`${'─'.repeat(60)}`);

    const { readFileSync: rfs35, existsSync: ex35 } = await import('node:fs');
    const { join: j35 } = await import('node:path');

    const l3AgentsMdPath = j35(config.l3ProjectPath, 'AGENTS.md');

    if (!ex35(l3AgentsMdPath)) {
      console.log(`ℹ️  No AGENTS.md found in L3 source — will be generated from scratch in Phase 4.`);
    } else {
      const agentsMdContent = rfs35(l3AgentsMdPath, 'utf-8');

      const requiredMarkers = [
        'VARIANT-AGENTS-START',
        'VARIANT-AGENT-DETAILS-START',
        'VARIANT-DISPATCH-TRIGGERS-START',
        'VARIANT-PHASE-GATE-START',
        'VARIANT-SUBAGENT-ROSTER-START',
        'VARIANT-ROLE-BOUNDARY-START',
      ];
      const missingMarkers = requiredMarkers.filter(m => !agentsMdContent.includes(`<!-- ${m} -->`));
      const hasSectionedStructure = agentsMdContent.includes('## §1:') && agentsMdContent.includes('## §3:');
      const hasValidTitle = /^#\s+AGENTS\.md\s*$/m.test(agentsMdContent);
      const hasCommonAgentsBlock = agentsMdContent.includes('<!-- COMMON-AGENTS:START -->')
        && agentsMdContent.includes('<!-- COMMON-AGENTS:END -->');

      // Roster link validity: every referenced agents/*.md must exist relative
      // to the L3 source root (drifted flat paths were the co-safety failure mode).
      // The lookbehind keeps the match anchored to a true roster link — an
      // unanchored pattern also bites the `agents/…` tail of governance links
      // like docs/governance/agents/pm-gateway-workflow.md, which resolve
      // against docs/, not the L3 root (broke the promotion E2E after the
      // ADR-0090 thin-dispatcher wave added those links to L1 common).
      const unresolvedAgentRefs = new Set<string>();
      for (const refMatch of agentsMdContent.matchAll(/(?<![A-Za-z0-9_./-])agents\/[A-Za-z0-9_/-]+\.md/g)) {
        const rel = refMatch[0];
        if (!ex35(j35(config.l3ProjectPath, ...rel.split('/')))) {
          unresolvedAgentRefs.add(rel);
        }
      }

      if (missingMarkers.length === 0 && hasSectionedStructure && hasValidTitle && hasCommonAgentsBlock && unresolvedAgentRefs.size === 0) {
        console.log(`✅ AGENTS.md structure OK — all VARIANT-* markers present, §-numbered sections found, title valid, roster links resolve`);
      } else {
        const issues: string[] = [];
        if (!hasSectionedStructure) issues.push('missing §-numbered section structure (§1/§3)');
        if (missingMarkers.length > 0) issues.push(`missing VARIANT-* markers: ${missingMarkers.join(', ')}`);
        if (!hasValidTitle) issues.push('H1 title must be exactly `# AGENTS.md` (found a copied workspace-root title)');
        if (!hasCommonAgentsBlock) issues.push('missing COMMON-AGENTS:START/END Language Policy block');
        if (unresolvedAgentRefs.size > 0) issues.push(`unresolvable agent links: ${[...unresolvedAgentRefs].join(', ')}`);

        console.warn(`⚠️  PHASE 3.5: AGENTS.md structure misaligned with L1 template:`);
        for (const issue of issues) console.warn(`   - ${issue}`);

        if (config.autoFixAgentsMd) {
          console.log(`   autoFixAgentsMd=true: regenerating AGENTS.md from L1 common template...`);
          try {
            // Inline regeneration: read L1 template, inject agent blocks, write to L3 source
            const commonTemplate = j35('templates', 'common', 'AGENTS.md');
            if (!ex35(commonTemplate)) {
              throw new Error(`L1 template not found: ${commonTemplate}`);
            }
            // Delegate to regenerate-agents-md.ts via subprocess
            const { execFileSync: efs } = await import('node:child_process');
            const variantDirName = config.l3ProjectPath.split(/[\\/]/).pop() ?? config.variantName;
            // Map L3 path to templates/<variant> if it lives under templates/
            const isInTemplates = config.l3ProjectPath.replace(/\\/g, '/').includes('templates/');
            if (isInTemplates) {
              efs('bun', ['scripts/regenerate-agents-md.ts', '--variant', variantDirName], { stdio: 'inherit' });
              console.log(`   ✅ AGENTS.md regenerated for ${variantDirName}`);
            } else {
              // L3 source outside templates/ (e.g. Projects/<name>/) — regenerate
              // in place via --source mode (roster scanned from agents/*.md).
              // Previously this branch skipped auto-fix with a manual-run hint,
              // making --auto-fix-agents-md a no-op for every Projects/ source.
              efs('bun', ['scripts/regenerate-agents-md.ts', '--source', config.l3ProjectPath], { stdio: 'inherit' });
              console.log(`   ✅ AGENTS.md regenerated in place at ${config.l3ProjectPath}`);
            }
          } catch (fixErr) {
            const fixMsg = fixErr instanceof Error ? fixErr.message : String(fixErr);
            console.error(`   ❌ Auto-regeneration failed: ${fixMsg}`);
            console.error(`   Fix manually: bun scripts/regenerate-agents-md.ts --variant ${config.variantName}`);
            console.error(`   Then re-run the pipeline.`);
            errors.push({ phase: '3.5', error: `AGENTS.md auto-regeneration failed: ${fixMsg}` });
            return failWithRollback();
          }
        } else {
          // BLOCKING: Phase 4 injection will silently produce wrong output without markers
          console.error(`\n❌ PHASE 3.5 BLOCKING: AGENTS.md is missing injection anchors.`);
          console.error(`   Phase 4 injectVariantPlaceholders() will find no markers → uninjected output.`);
          console.error(`   Fix: bun scripts/regenerate-agents-md.ts --variant ${config.variantName}`);
          console.error(`   Or re-run pipeline with autoFixAgentsMd:true\n`);
          errors.push({ phase: '3.5', error: `AGENTS.md structure check failed: ${issues.join('; ')}` });
          return failWithRollback();
        }
      }
    }

    console.log(`✅ PHASE 3.5 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // H4 (2026-09-15 project review): this phase BLOCKS on missing injection
    // anchors — an exception here (unreadable file, encoding error) must fail
    // the pipeline instead of slipping through as a warning into generation,
    // which is exactly the silent-wrong-output class the gate exists for.
    errors.push({ phase: '3.5-agents-md-preflight', error: errorMsg });
    console.error(`❌ PHASE 3.5 FAILED: ${errorMsg}`);
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 3.7: PLUGIN-BASED TYPE VALIDATION
  // ============================================================================
  // Runs after Phase 3.5 and before Phase 4. Validates the L3 source against
  // the variant-type registry (integrity, required agents, required capabilities)
  // and delegates to plugin-specific validation hooks when available.
  //
  // Fatal only on registry integrity failure; plugin issues are non-blocking.
  // ============================================================================

  let phaseLabel: string;
  try {
    phaseLabel = 'Phase 3.7: Plugin-Based Type Validation';
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 3.7: Plugin-Based Type Validation`);
    console.log(`${'─'.repeat(60)}`);

    // Eager imports used across 3.7b–3.7d
    const { globSync } = await import('node:fs') as typeof import('node:fs');

    // Lightweight YAML frontmatter parser — avoids js-yaml which fails in Bun
    // (SyntaxError: Missing 'default' export in js-yaml.mjs).
    // Mirrors the parser in generate-variant.ts parseAgentFrontmatter().
    function parseFrontmatter(content: string): Record<string, unknown> {
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) return {};
      const lines = match[1].split(/\r?\n/);
      const result: Record<string, unknown> = {};
      let currentKey = '';
      let blockScalar = false;
      let blockLines: string[] = [];
      function flushBlock() {
        if (blockScalar && currentKey) {
          result[currentKey] = blockLines.join(' ').trim();
          blockLines = [];
          blockScalar = false;
        }
      }
      for (const line of lines) {
        const topMatch = line.match(/^([\w][\w-]*):\s*(.*)/);
        if (topMatch) {
          flushBlock();
          currentKey = topMatch[1];
          const val = topMatch[2].trim();
          if (val === '>' || val === '|') { blockScalar = true; blockLines = []; }
          else if (val === '') { result[currentKey] = {}; }
          else if (val.startsWith('[')) {
            result[currentKey] = val.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
          } else { result[currentKey] = val.replace(/^['"]|['"]$/g, ''); }
          continue;
        }
        if (blockScalar && line.startsWith('  ')) { blockLines.push(line.trim()); continue; }
        const nestedKV = line.match(/^  ([\w][\w-]*):\s*(.*)/);
        if (nestedKV && !blockScalar) {
          flushBlock();
          const parentVal = result[currentKey];
          if (typeof parentVal === 'object' && parentVal !== null && !Array.isArray(parentVal)) {
            (parentVal as Record<string, unknown>)[nestedKV[1]] = nestedKV[2].trim().replace(/^['"]|['"]$/g, '');
          }
          continue;
        }
        const listItem = line.match(/^  - (.*)/);
        if (listItem && !blockScalar) {
          const item = listItem[1].trim().replace(/^['"]|['"]$/g, '');
          if (!Array.isArray(result[currentKey])) result[currentKey] = [];
          (result[currentKey] as unknown[]).push(item);
          continue;
        }
        if (blockScalar && line.trim() === '') { flushBlock(); }
      }
      flushBlock();
      return result;
    }

    // 3.7a: Registry integrity check
    const { validateRegistryIntegrity } = await import('./helpers/registries/index.ts');
    const integrity = validateRegistryIntegrity();
    if (!integrity.passed) {
      for (const err of integrity.errors) {
        if (err.severity === 'error') {
          console.error(`[3.7] Registry integrity error: ${err.message}`);
        }
      }
      if (integrity.errors.some(e => e.severity === 'error')) {
        throw fatalError(ErrorPhase.VALIDATION, 'REGISTRY_INTEGRITY_FAILED', 'Registry integrity check failed');
      }
    }

    // 3.7b: Required agents check (WARNING level)
    const { getValidationPolicy } = await import('./helpers/registries/index.ts');
    const policy = getValidationPolicy(config.variantType);
    if (policy.requiredAgents && policy.requiredAgents.length > 0) {
      const agentsDir = join(config.l3ProjectPath, 'agents');
      const agentFiles = globSync('*.md', { cwd: agentsDir }).map(f => basename(f, '.md'));
      for (const required of policy.requiredAgents) {
        if (!agentFiles.includes(required)) {
          console.warn(`[3.7] WARNING: Required agent "${required}" not found for type "${config.variantType}"`);
        }
      }
    }

    // 3.7c: Required capabilities check (ERROR level — blocking)
    let hasCapabilityErrors = false;
    if (policy.requiredCapabilities && policy.requiredCapabilities.length > 0) {
      const { isCapability } = await import('./helpers/registries/index.ts');
      const agentsDir37c = join(config.l3ProjectPath, 'agents');
      const coveredCapabilities = new Set<string>();

              for (const agentFile of globSync('*.md', { cwd: agentsDir37c })) {
        const content = readFileSync(join(agentsDir37c, agentFile), 'utf-8');
        try {
          const fm = parseFrontmatter(content);
          const caps = fm?.capabilities;
          if (Array.isArray(caps)) {
            for (const cap of caps) {
              if (typeof cap === 'string') {
                coveredCapabilities.add(cap);
                if (!isCapability(cap)) {
                  console.warn(`[3.7] WARNING: Unknown capability "${cap}" in ${agentFile}`);
                }
              }
            }
          }
        } catch { /* skip malformed frontmatter */ }
      }

      for (const required of policy.requiredCapabilities) {
        if (!coveredCapabilities.has(required)) {
          console.error(`[3.7] ERROR: Required capability "${required}" not covered by any agent`);
          errors.push({ phase: 'capabilities', error: `Required capability "${required}" not covered by any agent` });
          hasCapabilityErrors = true;
        }
      }
    }

    // 3.7d: Plugin validation hooks (ERROR level — blocking)
    let hasPluginErrors = false;
    const { getPlugin } = await import('./helpers/plugins/index.ts');
    const plugin = getPlugin(config.variantType);
    if (plugin?.validate) {
      // Collect agent frontmatters for plugin context
      const agentsDir37d = join(config.l3ProjectPath, 'agents');
      const agentFrontmatters = globSync('*.md', { cwd: agentsDir37d }).map(f => {
        const content = readFileSync(join(agentsDir37d, f), 'utf-8');
        const fm = parseFrontmatter(content);
        return {
          name: basename(f, '.md'),
          capabilities: Array.isArray(fm?.capabilities) ? fm.capabilities as string[] : [],
        };
      });

      const variantJsonPath = join(config.l3ProjectPath, 'variant.json');
      const variantJson = existsSync(variantJsonPath) ? JSON.parse(readFileSync(variantJsonPath, 'utf-8')) : {};

      const issues = await plugin.validate({
        variantDir: config.l3ProjectPath,
        variantType: config.variantType,
        agentFrontmatters,
        variantJson,
      });

      for (const issue of issues) {
        if (issue.severity === 'error') {
          console.error(`[3.7] Plugin validation error: ${issue.category}: ${issue.message}`);
          errors.push({ phase: 'plugin-validation', error: `${issue.category}: ${issue.message}` });
          hasPluginErrors = true;
        } else if (issue.severity === 'warning') {
          console.warn(`[3.7] Plugin validation warning: ${issue.category}: ${issue.message}`);
        } else {
          console.log(`[3.7] Plugin validation info: ${issue.category}: ${issue.message}`);
        }
      }
    }

    if (hasCapabilityErrors || hasPluginErrors) {
      console.error(`\n❌ PHASE 3.7 BLOCKING: Capability or plugin validation errors found.`);
      return failWithRollback();
    }

    console.log(`✅ PHASE 3.7 COMPLETE`);
  } catch (err) {
    // Handle errors from registry integrity (fatal) or plugin validation (warn)
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'REGISTRY_INTEGRITY_FAILED') {
      throw err;
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  PHASE 3.7 WARNING: Plugin validation produced warnings (non-blocking): ${errorMsg}`);
  }

  // ============================================================================
  // PHASE 3.9: HUB-TOPOLOGY ASSET CLASSIFICATION (v1.22.0 — design §6.1)
  // ============================================================================
  // Classifies every L3-carried skill/agent the pipeline would copy against the
  // hub_topology registry BEFORE any generation write. Semantics (default
  // 'enforce', the design-text default): hub-doctrine canonical to ANOTHER
  // variant → NOT copied + "consumes declaration required" flagged (declare-
  // first: the pipeline never edits registry rows — the operator/PM applies
  // the declaration via variant.json); foreign variant-identity → REFUSAL;
  // unregistered → copied + classification-report line to the PM agenda
  // (never silent). Common-contract stock is excluded (L1 delivery is
  // inheritance, not duplication). An absent/malformed registry skips the
  // phase (legacy-checkout posture, same as the validate-templates legs).
  // The skip itself is APPLIED in Phase 4 (filtering happens where the copy
  // lists are built); this phase computes the verdicts and enforces refusals.
  // ============================================================================
  const hubClassifyMode: 'enforce' | 'report-only' = config.hubClassificationMode ?? 'enforce';
  let hubTopology: HubTopology | undefined;
  let hubClassification: HubClassificationReport | undefined;
  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 3.9: Hub-Topology Asset Classification (${hubClassifyMode})`);
    console.log(`${'─'.repeat(60)}`);

    const topoResult = config.hubTopologyOverride
      ? { ok: true as const, topology: config.hubTopologyOverride }
      : loadHubTopology(cwd());
    if (!topoResult.ok) {
      console.log(`ℹ️  hub_topology registry ${topoResult.error === 'absent-file' ? 'absent' : `not usable (${topoResult.error})`} — skipping hub classification (legacy checkout)`);
    } else if (topoResult.topology) {
      hubTopology = topoResult.topology;
      const commonNames = loadCommonContractNames(cwd());
      const assets: Array<{ name: string; kind: HubAssetKind }> = [
        ...extractSkills(scanResult!).map(s => ({ name: s.name, kind: 'skill' as const })),
        ...extractAgentRoster(scanResult!).map(a => ({ name: a.name, kind: 'agent' as const })),
      ];
      const verdicts = classifyAssetsForPromotion({
        assets,
        entries: Array.isArray(hubTopology.entries) ? hubTopology.entries : [],
        targetVariant: config.variantName,
        commonNames,
      });
      hubClassification = formatHubClassificationReport(verdicts, hubClassifyMode);
      if (hubClassification.lines.length === 0) {
        console.log(`  ✅ ${assets.length} asset(s) classified — no hub-doctrine skips, refusals, or unregistered assets`);
      } else {
        for (const line of hubClassification.lines) console.log(`  ${hubClassifyMode === 'enforce' ? '⚠️ ' : 'ℹ️ '} ${line}`);
      }
      if (hubClassification.refused.length > 0) {
        const refused = hubClassification.refused.map(r => `${r.kind} '${r.asset}' (owned by ${r.hub_variant})`).join(', ');
        const msg =
          `HUB-TOPOLOGY CLASSIFICATION REFUSAL: variant-identity asset(s) ${refused} must not be absorbed into ` +
          `templates/${config.variantName} — identity assets are never promoted with a thinner copy (design §6.1). ` +
          `Remove the asset from the L3 source or re-register its canonical ownership.`;
        console.error(`\n❌ ${msg}`);
        errors.push({ phase: '3.9-hub-classification', error: msg });
        return failWithRollback();
      }
      if (hubClassification.skipped.length > 0 && hubClassifyMode === 'report-only') {
        console.warn(`⚠️  report-only mode: hub-doctrine skip(s) DOWNGRADED to warnings — the asset(s) WILL be copied (operator observation run; design default is enforcement)`);
      }
      console.log(`✅ PHASE 3.9 COMPLETE`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ PHASE 3.9 FAILED: ${errorMsg}`);
    errors.push({ phase: '3.9-hub-classification', error: errorMsg });
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 4: GENERATE VARIANT
  // ============================================================================

  // v1.19.0: authorized-overlay runs snapshot the pre-existing tree NOW —
  // immediately before the first write into the target slot (generateVariant).
  // Success path discards the snapshot (settleSuccessDiscard, before the final
  // return); any failure path after this point restores it (failWithRollback).
  // A failed snapshot aborts BEFORE any write — fail-closed (design §4.2).
  if (rollbackMode === 'overlay') {
    const snap = snapshotDirForOverlay(resolvedOutputRoot, cwd());
    if (!snap.snapshotted || !snap.backupPath) {
      const msg = `overlay snapshot failed before generation — ${snap.reason ?? 'unknown reason'}`;
      console.error(`\n❌ ${msg}`);
      errors.push({ phase: 'overlay-guard', error: msg });
      return failWithRollback();
    }
    overlayBackupPath = snap.backupPath;
    console.log(`  🛡️  Overlay authorized — previous tree snapshotted to ${snap.backupPath}`);
  }

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 4: Generating Variant`);
    console.log(`${'─'.repeat(60)}`);

    // Extract agent roster and skills from L3 scan result
    const agentRoster = extractAgentRoster(scanResult!);
    // Scoped skills stay out of the variant.json skill manifest as well — Phase 2.5
    // keeps their files out of the copy manifest; this keeps the DECLARED manifest
    // consistent with the generated variant's skills/ tree.
    const skills = extractSkills(scanResult!).filter(s => !scopedSkillNames.has(s.name));

    // Phase 3.9 verdict application (v1.22.0, design §6.1): in enforce mode the
    // hub-doctrine skip verdicts REMOVE the asset from the copy lists AND from
    // the reconciled manifest (skills/<name>/** and agents/<name>.md), so the
    // generated template never carries the copy. report-only mode keeps the
    // copies (the warn was already emitted in Phase 3.9).
    const skippedAssetKeys = new Set(
      hubClassifyMode === 'enforce'
        ? (hubClassification?.skipped ?? []).map(s => `${s.kind}/${s.asset}`)
        : [],
    );
    if (skippedAssetKeys.size > 0) {
      const filteredRoster = agentRoster.filter(a => !skippedAssetKeys.has(`agent/${a.name}`));
      const filteredSkills = skills.filter(s => !skippedAssetKeys.has(`skill/${s.name}`));
      const rosterRemoved = agentRoster.length - filteredRoster.length;
      const skillsRemoved = skills.length - filteredSkills.length;
      agentRoster.length = 0;
      agentRoster.push(...filteredRoster);
      skills.length = 0;
      skills.push(...filteredSkills);
      const manifestBefore = reconciledManifest!.keepInVariant.length;
      reconciledManifest!.keepInVariant = reconciledManifest!.keepInVariant.filter(file => {
        const target = file.targetPath.replace(/\\/g, '/');
        for (const key of skippedAssetKeys) {
          const slash = key.indexOf('/');
          const kind = key.slice(0, slash);
          const name = key.slice(slash + 1);
          if (kind === 'skill' && target.startsWith(`skills/${name}/`)) return false;
          if (kind === 'agent' && (target === `agents/${name}.md` || target.startsWith(`agents/${name}.md`))) return false;
        }
        return true;
      });
      console.log(
        `  ⛔ Hub-doctrine skips applied: ${rosterRemoved} agent(s), ${skillsRemoved} skill(s), ` +
          `${manifestBefore - reconciledManifest!.keepInVariant.length} manifest file(s) removed from the promotion copy set`,
      );
    }

    const metadata: VariantMetadata = {
      name: config.variantName,
      description: config.variantDescription,
      variantType: config.variantType,
      status: (config.status as VariantMetadata['status']) ?? 'beta',
      version: (config.version as VariantMetadata['version']) ?? '0.1.0',
      inherits_common: 'templates/common',
      agentRoster,
      skills,
    };

    // Registry-driven: read extension fields from the canonical variant.json declared
    // for this variantType in VARIANT_TYPE_REGISTRY (currently only 'lecture' → co-deck).
    // See: docs/designs/l2-pipeline-governance-fixes-2026-08-09-design.md Issue A.4
    const canonicalExtensionSource = getVariantTypeDefinition(config.variantType).canonicalExtensionSource;
    if (canonicalExtensionSource) {
      const { readFileSync } = await import('node:fs');
      const canonicalPath = join(process.cwd(), ...canonicalExtensionSource.split('/'));
      try {
        const canonical = JSON.parse(readFileSync(canonicalPath, 'utf-8'));
        if (canonical.agent_manifest) metadata.agent_manifest = canonical.agent_manifest;
        if (canonical.theme_manifest) metadata.theme_manifest = canonical.theme_manifest;
        if (canonical.lecture_profile) metadata.lecture_profile = canonical.lecture_profile;
        console.log(`  ✅ Injected canonical extension fields from ${canonicalExtensionSource} (agent_manifest, theme_manifest, lecture_profile)`);
      } catch {
        console.warn(`  ⚠️  Could not read ${canonicalExtensionSource} — extension fields skipped`);
      }
    }

    // Merge custom fields from L3 source variant.json (engagement_methodology, deliverable_template, etc.)
    {
      const { readFileSync: rfs, existsSync: efs } = await import('node:fs');
      const l3VariantPath = join(config.l3ProjectPath, 'variant.json');
      if (efs(l3VariantPath)) {
        try {
          const l2Variant = JSON.parse(rfs(l3VariantPath, 'utf-8'));
          // Canonical schema keys — anything NOT in this set is a custom field to preserve
          const CANONICAL_KEYS = new Set([
            'name', 'description', 'variant_type', 'variantType', 'type',
            'status', 'version', 'inherits_common',
            'agents', 'skills', 'agentRoster', 'skillDefinitions',
            'agent_manifest', 'theme_manifest', 'lecture_profile',
          ]);
          const customFields: string[] = [];
          for (const field of Object.keys(l2Variant)) {
            if (!CANONICAL_KEYS.has(field) && l2Variant[field] !== undefined) {
              (metadata as Record<string, unknown>)[field] = l2Variant[field];
              customFields.push(field);
            }
          }
          if (customFields.length > 0) {
            console.log(`  ✅ Merged custom fields from L3 variant.json: ${customFields.join(', ')}`);
          } else {
            console.log(`  ✅ No custom fields to merge from L3 variant.json`);
          }
        } catch {
          console.warn(`  ⚠️  Could not parse L3 variant.json — custom fields skipped`);
        }
      }
    }

    generatedVariant = await generateVariant(metadata, reconciledManifest!, config.outputPath);
    phases.generate = { success: true, result: generatedVariant };

    // Post-generation cleanup: remove ACTIVE.md if copied (project-specific artifact)
    // Clean up against the actual generation output root (generateVariant() resolves
    // outputPath ?? templates/<name> and returns it as variantPath) — reading
    // config.outputPath directly threw when --output was omitted and failed Phase 4
    // after a successful generation.
    const activeMdPath = join(generatedVariant!.variantPath, 'docs', 'countries', 'ACTIVE.md');
    const { existsSync: esync, rmSync: rmsync } = await import('node:fs');
    if (esync(activeMdPath)) {
      rmsync(activeMdPath);
      console.log(`  ✅ Removed project-specific artifact: docs/countries/ACTIVE.md`);
    }

    console.log(`✅ PHASE 4 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    phases.generate = { success: false, error: errorMsg };
    errors.push({ phase: 'generate', error: errorMsg });
    console.error(`❌ PHASE 4 FAILED: ${errorMsg}`);
  }

  if (!phases.generate.success) {
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 4.5: GOLDEN REFERENCE STRUCTURAL GAP CHECK
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 4.5: Golden Reference Structural Gap Check`);
    console.log(`${'─'.repeat(60)}`);

    const gapReports: StructuralGapReport[] = [];
    const variantPath = generatedVariant!.variantPath;
    const agentGolden = getAgentGoldenStructure(config.variantType);
    const skillGolden = getSkillGoldenStructure(config.variantType);

    // Check agent files
    const { readdirSync: rd, existsSync: ex } = await import('node:fs');
    const { readUTF8File: ru } = await import('./lib/encoding-utils.js');
    const { join: j } = await import('node:path');

    const agentsDir = j(variantPath, 'agents');
    if (ex(agentsDir)) {
      for (const file of rd(agentsDir)) {
        if (!file.endsWith('.md') || SKIP_AGENT_FILES.has(file)) continue;
        const filePath = j(agentsDir, file);
        const content = ru(filePath);
        gapReports.push(checkStructuralGaps(filePath, content, agentGolden, 'agent'));
      }
    }

    // Check skill files
    const skillsDir = j(variantPath, 'skills');
    if (ex(skillsDir)) {
      for (const skillDir of rd(skillsDir, { withFileTypes: true })) {
        if (!skillDir.isDirectory()) continue;
        const skillPath = j(skillsDir, skillDir.name, 'SKILL.md');
        if (!ex(skillPath)) continue;
        const content = ru(skillPath);
        gapReports.push(checkStructuralGaps(skillPath, content, skillGolden, 'skill'));
      }
    }

    const gapReport = formatGapReport(gapReports);
    console.log(gapReport);

    // Write pipeline report to variant root
    const reportPath = j(variantPath, '_pipeline_report.md');
    const { writeUTF8File: wu } = await import('./lib/encoding-utils.js');
    wu(reportPath, `# Pipeline Report\n\nGenerated: ${new Date().toISOString()}\n\n\`\`\`\n${gapReport}\n\`\`\`\n${hubReportMdSection(hubClassification)}`);

    // Write CI-friendly JSON report alongside the markdown report
    const reportOutputPath = j(variantPath, '_pipeline_report.json');
    const jsonReport = {
      variantName: config.variantName,
      variantType: config.variantType,
      timestamp: new Date().toISOString(),
      phase: '4.5',
      summary: {
        totalFiles: gapReports.length,
        passedFiles: gapReports.filter(r => r.passed).length,
        failedFiles: gapReports.filter(r => !r.passed).length,
      },
      gaps: gapReports.map(r => ({
        filePath: r.filePath,
        fileType: r.fileType,
        passed: r.passed,
        missingSections: r.missingSections ?? [],
        missingOptionalSections: r.missingOptionalSections ?? [],
      })),
    };
    wu(reportOutputPath, JSON.stringify(jsonReport, null, 2));
    console.log(`  📄 CI-friendly JSON report: ${reportOutputPath}`);

    const failedCount = gapReports.filter(r => !r.passed).length;
    if (failedCount > 0) {
      console.warn(`⚠️  ${failedCount} file(s) have missing required sections. See _pipeline_report.md`);
    }

    // BLOCKING CHECK: AGENTS.md must have §-numbered structure and VARIANT-* markers.
    // Without these, l3-to-variant-pipeline.ts injection has no anchors → silent drift.
    const agentsMdPath = j(variantPath, 'AGENTS.md');
    if (ex(agentsMdPath)) {
      const { readUTF8File: ru2 } = await import('./lib/encoding-utils.js');
      const agentsMdContent = ru2(agentsMdPath);
      const requiredMarkers = [
        'VARIANT-AGENTS-START',
        'VARIANT-AGENT-DETAILS-START',
        'VARIANT-DISPATCH-TRIGGERS-START',
        'VARIANT-PHASE-GATE-START',
        'VARIANT-SUBAGENT-ROSTER-START',
        'VARIANT-ROLE-BOUNDARY-START',
      ];
      const missingMarkers = requiredMarkers.filter(m => !agentsMdContent.includes(`<!-- ${m} -->`));
      const hasSectionedStructure = agentsMdContent.includes('## §1:') && agentsMdContent.includes('## §3:');
      if (missingMarkers.length > 0 || !hasSectionedStructure) {
        const issues: string[] = [];
        if (!hasSectionedStructure) issues.push('missing §-numbered section structure (§1/§3/§5)');
        if (missingMarkers.length > 0) issues.push(`missing VARIANT-* markers: ${missingMarkers.join(', ')}`);
        console.error(`\n❌ PHASE 4.5 BLOCKING: AGENTS.md structure is misaligned with L1 template.`);
        console.error(`   ${issues.join('; ')}`);
        console.error(`   Fix: bun scripts/regenerate-agents-md.ts --variant ${variantPath.split(/[\\/]/).pop()}`);
        console.error(`   Then re-run the pipeline.\n`);
        errors.push({ phase: '4.5', error: `AGENTS.md structure misaligned with L1 template: ${issues.join('; ')}` });
        return failWithRollback();
      }
    }

    console.log(`✅ PHASE 4.5 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // H4 (2026-09-15 project review): same fail-closed rule as Phase 3.5 —
    // this is a blocking structural gate, not an advisory check.
    errors.push({ phase: '4.5-golden-gap-check', error: errorMsg });
    console.error(`❌ PHASE 4.5 FAILED: ${errorMsg}`);
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 4.6: GENERATED VARIANT PM.MD COMPLETION + CONTEXT.MD GENERATION
  // ============================================================================
  // Role: "generation completion" — operates on the GENERATED variant pm.md,
  // NOT the L3 source pm.md. Interprets extends: pattern and fills
  // <!-- VARIANT-SECTION: ... --> markers with variant-specific data, then
  // generates docs/<variant>.context.md from variant_overrides.
  //
  // Distinct from Phase 1.6 (source diagnosis): Phase 1.6 diagnoses the L3
  // source file; Phase 4.6 completes the already-generated variant output.
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 4.6: Processing pm.md and Generating context.md`);
    console.log(`${'─'.repeat(60)}`);

    // Find pm.md in the generated variant
    const variantPmMdPath = join(generatedVariant!.variantPath, 'agents', 'pm.md');

    if (existsSync(variantPmMdPath)) {
      // Parse pm.md and extract variant_overrides
      const pmMdData = parsePmMd(variantPmMdPath);

      if (pmMdData.isValid && Object.keys(pmMdData.variantOverrides).length > 0) {
        // Generate context.md from variant_overrides
        const variantPath = generatedVariant!.variantPath;
        writeContextMd(variantPath, config.variantName, pmMdData.variantOverrides);

        console.log(`✅ Generated context.md from variant_overrides`);
        console.log(`   Path: ${join(variantPath, 'docs', `${config.variantName}.context.md`)}`);
      } else {
        console.log(`ℹ️  No variant_overrides found in pm.md, skipping context.md generation`);
      }
    } else {
      console.log(`ℹ️  No pm.md found in variant, skipping context.md generation`);
    }

    console.log(`✅ PHASE 4.6 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Don't fail the pipeline for context.md generation errors
    console.warn(`⚠️  PHASE 4.6 WARNING: ${errorMsg}`);
  }

  // ============================================================================
  // PHASE 4.7: CONTEXT PURIFICATION GATE (W1 fail-closed verification) — v1.16.0
  // ============================================================================
  // docs/designs/2026-09-10-context-purification-design.md D1. Phase 4's copy seam
  // rescued project-only sections from the convention-excluded L3 docs/context.md
  // into docs/<variant>.context.md (generate-variant.ts purifyPromotedContextMd).
  // This gate re-verifies the ledger against the FINAL file — after Phase 4.6's
  // writeContextMd() append — so any ordering interaction or lost section surfaces
  // here instead of silently. BLOCKING: a merged section missing from the output is
  // exactly the silent-loss failure class W1 exists to prevent.
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 4.7: Context Purification Gate`);
    console.log(`${'─'.repeat(60)}`);

    const purification = generatedVariant!.summary.contextPurification;
    const { merged, dropped } = purification;

    if (merged.length === 0 && dropped.length === 0) {
      console.log(`ℹ️  No project-only sections extracted from L3 docs/context.md — nothing to verify`);
    } else {
      if (merged.length > 0) {
        const variantContextPath = join(generatedVariant!.variantPath, 'docs', `${config.variantName}.context.md`);
        if (!existsSync(variantContextPath)) {
          throw new Error(
            `docs/${config.variantName}.context.md not found at ${variantContextPath} but the ` +
            `purification ledger records ${merged.length} merged section(s): ${merged.join(', ')}`
          );
        }
        const { readUTF8File: ru47 } = await import('./lib/encoding-utils.js');
        const finalContent = ru47(variantContextPath);
        const missing = findMissingPurifiedSections(finalContent, merged);
        if (missing.length > 0) {
          throw new Error(
            `project-only section(s) missing from final docs/${config.variantName}.context.md: ` +
            `[${missing.join(', ')}] — W1 purification ledger expected them merged`
          );
        }
        console.log(`✅ ${merged.length} merged section(s) verified in docs/${config.variantName}.context.md: ${merged.join(', ')}`);
      }
      if (dropped.length > 0) {
        console.log(`ℹ️  ${dropped.length} superseded section(s) dropped (covered by templates/common/docs/context.md): ${dropped.join(', ')}`);
      }
    }

    // Record the purification outcome in the Phase 4.5 report (read-modify-write).
    try {
      const reportJsonPath = join(generatedVariant!.variantPath, '_pipeline_report.json');
      if (existsSync(reportJsonPath)) {
        const { readUTF8File: ru47r, writeUTF8File: wu47 } = await import('./lib/encoding-utils.js');
        const reportJson = JSON.parse(ru47r(reportJsonPath)) as Record<string, unknown>;
        reportJson.contextPurification = {
          merged,
          dropped,
          verified: true,
        };
        // v1.22.0 (design §6.1): the Phase 3.9 classification is a first-class
        // report artifact — required consume declarations (PM agenda),
        // unregistered assets, skips, and refusals ride the CI-friendly JSON.
        if (hubClassification) {
          reportJson.hubTopologyClassification = {
            mode: hubClassification.mode,
            lines: hubClassification.lines,
            requiredDeclarations: hubClassification.requiredDeclarations,
            unregistered: hubClassification.unregistered,
            refused: hubClassification.refused,
            skipped: hubClassification.skipped,
          };
        }
        wu47(reportJsonPath, JSON.stringify(reportJson, null, 2));
        console.log(`  📄 Purification outcome recorded in _pipeline_report.json`);
      }
    } catch (reportError) {
      // Report augmentation is best-effort; the gate verdict above is unaffected.
      console.warn(`⚠️  PHASE 4.7: could not update _pipeline_report.json: ${reportError instanceof Error ? reportError.message : String(reportError)}`);
    }

    console.log(`✅ PHASE 4.7 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ PHASE 4.7 BLOCKING: Context purification verification failed.`);
    console.error(`   ${errorMsg}`);
    console.error(`   Inspect docs/${config.variantName}.context.md and the generate-phase purification log, then re-run the pipeline.\n`);
    errors.push({ phase: '4.7', error: errorMsg });
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 4.8: HUB CONSUMPTION PREFLIGHT (v1.22.0 — design §6.2)
  // ============================================================================
  // Promote-side preflight on the GENERATED template (before lifecycle init):
  // (1) the generated variant.json's hub.consumes rows resolve against the
  // registry with the shared leg-3 logic (minimum_version semantics); (2) an
  // unregistered hub-doctrine duplication in the template FAILs (a copy that
  // is neither the hub's own, nor common-contract stock, nor a declared
  // consumer's stale-read copy). Enforce mode BLOCKS the run; report-only
  // downgrades to warnings (coherent observation mode with Phase 3.9).
  // ============================================================================
  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 4.8: Hub Consumption Preflight (${hubClassifyMode})`);
    console.log(`${'─'.repeat(60)}`);

    if (!hubTopology) {
      console.log(`ℹ️  hub_topology registry not available — preflight vacuous (legacy checkout)`);
    } else {
      const preflightFails: string[] = [];

      // Leg 3 reuse: the generated template's own hub.consumes declarations.
      const generatedVjPath = join(generatedVariant!.variantPath, 'variant.json');
      let hubBlock: Record<string, unknown> | undefined;
      if (existsSync(generatedVjPath)) {
        try {
          const vj = JSON.parse(readFileSync(generatedVjPath, 'utf-8')) as Record<string, unknown>;
          const hub = vj['hub'];
          if (hub && typeof hub === 'object' && !Array.isArray(hub)) hubBlock = hub as Record<string, unknown>;
        } catch {
          // malformed variant.json — the readiness gate owns that failure
        }
      }
      if (hubBlock) {
        const leg3 = checkConsumerMinimumVersions(hubTopology, [{ variant: config.variantName, hubBlock }]);
        preflightFails.push(...leg3.fails);
        console.log(`  ℹ️  hub.consumes declarations resolved: ${leg3.fails.length} fail(s), ${leg3.warns.length} warn(s)`);
      } else {
        console.log(`  ℹ️  generated template declares no hub consumption — leg-3 vacuous`);
      }

      // Unregistered hub-doctrine duplication in the generated template.
      const dup = checkHubDoctrineDuplication(hubTopology, {
        variantName: config.variantName,
        templateDir: generatedVariant!.variantPath,
        commonNames: loadCommonContractNames(cwd()),
      });
      preflightFails.push(...dup.fails);

      if (preflightFails.length > 0) {
        for (const f of preflightFails) console.error(`  ❌ ${f}`);
        if (hubClassifyMode === 'report-only') {
          console.warn(`⚠️  PHASE 4.8 report-only: ${preflightFails.length} preflight fail(s) DOWNGRADED to warnings (design default is FAIL)`);
        } else {
          const msg = `hub consumption preflight FAILED with ${preflightFails.length} violation(s) (design §6.2) — see the lines above`;
          errors.push({ phase: '4.8-hub-preflight', error: msg });
          console.error(`\n❌ PHASE 4.8 BLOCKING: ${msg}`);
          return failWithRollback();
        }
      } else {
        console.log(`  ✅ preflight clean — no unregistered hub-doctrine duplication, consumes declarations (if any) resolve`);
      }
    }
    console.log(`✅ PHASE 4.8 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ PHASE 4.8 FAILED: ${errorMsg}`);
    errors.push({ phase: '4.8-hub-preflight', error: errorMsg });
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 5: INITIALIZE BETA LIFECYCLE
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 5: Initializing Beta Lifecycle`);
    console.log(`${'─'.repeat(60)}`);

    lifecycleState = initializeBetaLifecycle(config.variantName, config.variantType);
    phases.lifecycle = { success: true, result: lifecycleState };
    console.log(`✅ PHASE 5 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    phases.lifecycle = { success: false, error: errorMsg };
    errors.push({ phase: 'lifecycle', error: errorMsg });
    console.error(`❌ PHASE 5 FAILED: ${errorMsg}`);
  }

  if (!phases.lifecycle.success) {
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 6: VALIDATE PLATFORM PARITY
  // ============================================================================

  if (!config.skipParityValidation) {
    try {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`PHASE 6: Validating Platform Parity`);
      console.log(`${'─'.repeat(60)}`);

      parityResult = await validatePlatformParity(generatedVariant!.variantPath);
      phases.parity = { success: !parityResult.hasParityViolations, result: parityResult };

      if (parityResult.hasParityViolations) {
        console.error(`❌ PHASE 6 FAILED: Platform parity violations found`);
        errors.push({
          phase: 'parity',
          error: `Platform parity violations found: ${parityResult.violations.length}`,
        });
      } else {
        console.log(`✅ PHASE 6 COMPLETE`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      phases.parity = { success: false, error: errorMsg };
      errors.push({ phase: 'parity', error: errorMsg });
      console.error(`❌ PHASE 6 FAILED: ${errorMsg}`);
    }
  } else {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 6: Skipped (skipParityValidation=true)`);
    console.log(`${'─'.repeat(60)}`);
    phases.parity = { success: true };
  }

  if (!phases.parity.success) {
    return failWithRollback();
  }

  // ============================================================================
  // PHASE 6.5: SCOPE SKILL-GRAPH REGENERATION
  // ============================================================================
  // The promoted variant's docs/skill-graph.json is derived from the freshly
  // generated variant output (skills/agents/procedures), so it must be rebuilt
  // now — not left to the workspace's next /sync (reledgev addendum, pipeline
  // coverage review 2026-08-29). Non-fatal: a missing generator or bun warns
  // and continues, mirroring new-project.ts scaffold-time generation.
  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 6.5: Regenerating Scope Skill Graph`);
    console.log(`${'─'.repeat(60)}`);

    const variantScope = config.variantName;
    const ROOT = cwd(); // pipeline runs from workspace root (CWD guard usage)
    const gen = spawnSync('bun', ['scripts/generate-skill-graph.ts', '--scope', variantScope], {
      cwd: ROOT, encoding: 'utf8', timeout: 60000,
    });
    const verify = spawnSync('bun', ['scripts/verify-skill-graph.ts', '--scope', variantScope], {
      cwd: ROOT, encoding: 'utf8', timeout: 60000,
    });

    if (gen.status === 0 && verify.status === 0) {
      console.log(`  ✅ Scope skill graph regenerated and verified: ${variantScope}`);
      phases.skillGraph = { success: true };
    } else {
      console.warn(`  ⚠️  Scope skill graph generation/verification returned non-zero (gen=${gen.status}, verify=${verify.status})`);
      console.warn(`     Remedy: bun scripts/generate-skill-graph.ts --scope ${variantScope} && bun scripts/verify-skill-graph.ts --scope ${variantScope}`);
      phases.skillGraph = { success: true }; // non-fatal: next /sync (step 4.65) heals
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`  ⚠️  Scope skill graph regeneration skipped: ${errorMsg}`);
    phases.skillGraph = { success: true, error: errorMsg };
  }

  // ============================================================================
  // PHASE 7: WORKSPACE INTEGRATION (DEPRECATED — OPT-IN ONLY)
  // ============================================================================
  // DEPRECATED: Phase 7 is being phased out in favor of separate
  // workspace-integration.ts. Defaults to OFF (skipIntegration=true).
  // To run it, explicitly pass --skip-integration=false.
  // ============================================================================

  if (!config.skipIntegration) {
    console.log('\n[Phase 7] ⚠️  Workspace integration via pipeline is DEPRECATED.');
    console.log('[Phase 7] Use: bun scripts/helpers/workspace-integration.ts --name=<name> --type=<type>');

    try {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`PHASE 7: Integrating to Workspace (legacy)`);
      console.log(`${'─'.repeat(60)}`);

      const metadata: VariantMetadata = {
        name: config.variantName,
        description: config.variantDescription,
        variantType: config.variantType,
        status: (config.status as VariantMetadata['status']) ?? 'beta',
        version: (config.version as VariantMetadata['version']) ?? '0.1.0',
        inherits_common: 'templates/common',
        agentRoster: [],
        skills: [],
      };

      integrationResult = await integrateVariantToWorkspace(metadata);
      phases.integrate = { success: true, result: integrationResult };
      console.log(`✅ PHASE 7 COMPLETE`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      phases.integrate = { success: false, error: errorMsg };
      errors.push({ phase: 'integrate', error: errorMsg });
      console.error(`❌ PHASE 7 FAILED: ${errorMsg}`);
    }
  } else {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 7: Skipped (default — use --skip-integration=false to run deprecated path)`);
    console.log(`${'─'.repeat(60)}`);
    phases.integrate = { success: true };
  }

  // ============================================================================
  // PIPELINE COMPLETE
  // ============================================================================

  const executionTime = Date.now() - startTime;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PIPELINE EXECUTION COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total time: ${executionTime}ms`);
  console.log(`Phases succeeded: ${Object.values(phases).filter(p => p.success).length}/${Object.values(phases).length}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${errors.length}`);
    for (const { phase, error } of errors) {
      console.log(`  [${phase}] ${error}`);
    }
  }

  console.log(`\n🎉 Variant generated successfully!`);
  console.log(`Path: ${generatedVariant!.variantPath}`);

  // v1.19.0: green run on an authorized overlay — discard the snapshot now
  // that the new tree is fully in place (design §4.2 success path).
  settleSuccessDiscard();

  // Country profile verification checklist
  console.log(`\n=== Manual Verification Checklist ===`);
  console.log(`  [ ] templates/${config.variantName}/docs/countries/ profiles contain jurisdiction knowledge (not project-specific data); ACTIVE.md excluded`);
  console.log(`  [ ] variant.json country_config.supported matches shipped profiles (validate-templates country-config check)`);

  return {
    success: true,
    phases,
    variantPath: generatedVariant!.variantPath,
    executionTime,
    errors,
  };
}

/**
 * Markdown section for the Phase 4.5 _pipeline_report.md carrying the Phase 3.9
 * hub-topology classification lines (design §6.1: the classification report is a
 * first-class pipeline artifact — "never silent"). Empty when the phase did not
 * run (registry absent) or produced no findings.
 */
function hubReportMdSection(report: HubClassificationReport | undefined): string {
  if (!report || report.lines.length === 0) return '';
  const lines = [
    `\n## Hub-Topology Asset Classification (design §6.1, mode: ${report.mode})\n`,
    ...report.lines.map(l => `- ${l}`),
    '',
  ];
  if (report.requiredDeclarations.length > 0) {
    lines.push(`PM agenda: apply the consume declaration(s) via variant.json hub.consumes BEFORE landing:`);
    for (const d of report.requiredDeclarations) {
      lines.push(`  - ${d.asset}: {domain: ${d.domain}, minimum_version: ${d.minimum_version}} (hub: ${d.hub_variant})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Build failure result
 * @version 1.2.0
 */
function buildFailureResult(
  phases: PipelineResult['phases'],
  errors: Array<{ phase: string; error: string }>,
  startTime: number
): PipelineResult {
  return {
    success: false,
    phases,
    executionTime: Date.now() - startTime,
    errors,
  };
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // M3 (2026-09-15 project review): Phases 1.6, 2.5, 4 and the 3.5 auto-fix
  // spawn resolve paths against process.cwd() — from any other directory they
  // silently degrade or fail. Fail loudly until all paths are import.meta-anchored
  // like upgrade-project/project-to-variant.
  {
    let scriptRoot = fileURLToPath(new URL('..', import.meta.url));
    scriptRoot = scriptRoot.replace(/^\/([A-Z]:)/, '$1').replace(/\/$/, '');
    if (process.cwd().replace(/[\\/]+$/, '') !== scriptRoot) {
      console.error(`ERROR: l3-to-variant-pipeline.ts must run from the workspace root (expected cwd ${scriptRoot}, got ${process.cwd()}).`);
      process.exit(1);
    }
  }

  // Parse arguments
  const l3PathArg = args.find(arg => arg.startsWith('--l3-path='));
  const nameArg = args.find(arg => arg.startsWith('--name='));
  const typeArg = args.find(arg => arg.startsWith('--type='));
  const descArg = args.find(arg => arg.startsWith('--description='));
  const skipParityArg = args.includes('--skip-parity');
  const skipIntegrationFlag = args.find(arg => arg.startsWith('--skip-integration'));
  // Phase 7 defaults to OFF (skipped). Only runs if explicitly --skip-integration=false
  const skipIntegrationArg = skipIntegrationFlag ? skipIntegrationFlag !== '--skip-integration=false' : true;
  const outputArg = args.find(arg => arg.startsWith('--output='));
  const versionArg = args.find(arg => arg.startsWith('--version='));
  const statusArg = args.find(arg => arg.startsWith('--status='));
  // Auto-fix toggles — previously PipelineConfig-only fields with no CLI
  // surface, making phase 3.0/3.5 auto-fix unreachable from a shell run
  const autoFixAgentsMdArg = args.includes('--auto-fix-agents-md');
  const autoFixPmMdArg = args.includes('--auto-fix-pm-md');
  const forceArg = args.includes('--force');
  // Overlay authorization (v1.19.0): permits overwriting an EXISTING pre-release
  // (beta) variant template — destroys the previous tree as a unit; per-file
  // history lives in git. stable/deprecated targets refuse even with the flag.
  const overlayVariantArg = args.includes('--overlay-variant');
  // Hub-topology classification escape hatch (v1.22.0, design §6.1 Phase 1.5):
  // downgrades the hub-doctrine skip / identity refusal / §6.2 preflight to
  // warnings for operator observation runs. DEFAULT is enforce — the design
  // text is normative ("hub-doctrine asset | NOT copied into other variants").
  const hubClassifyReportOnlyArg = args.includes('--hub-classify-report-only');

  if (!l3PathArg || !nameArg || !typeArg || !descArg) {
    console.error('Usage: bun scripts/l3-to-variant-pipeline.ts \\');
    console.error('  --l3-path=<path-to-l3-project> \\');
    console.error('  --name=<variant-name> \\');
    console.error(`  --type=<${listVariantTypes().join('|')}> \\`);
    console.error('  --description=<variant-description> \\');
    console.error('  [--skip-parity] \\');
    console.error('  [--skip-integration=false] (default: ON — Phase 7 is deprecated and skipped) \\');
    console.error('  [--output=<output-path>] \\');
    console.error('  [--version=<semver>] (default: 0.1.0) \\');
    console.error('  [--status=<beta|stable|deprecated>] (default: beta) \\');
    console.error('  [--auto-fix-agents-md] (phase 3.5: regenerate AGENTS.md on marker misalignment) \\');
    console.error('  [--auto-fix-pm-md] (phase 3.0: emit pm.md slimming guidance)');
    console.error('  [--overlay-variant] (authorize overwriting an existing BETA variant template; stable/deprecated always refuse) \\');
    console.error('  [--hub-classify-report-only] (downgrade hub-topology classification + preflight to warnings; default is enforce per design §6.1/§6.2) \\');
    console.error('  [--force] (skip the Variant Readiness Gate — see PHASE 8)');
    process.exit(1);
  }

  // C-09: Validate --name= CLI arg before use in path construction
  const variantNameRaw = nameArg.split('=')[1];
  if (!/^co-[a-z][a-z0-9-]{1,30}$/.test(variantNameRaw)) {
    console.error(`Invalid variant name: '${variantNameRaw}'. Must match co-[a-z][a-z0-9-]{1,30}`);
    process.exit(1);
  }

  // Validate --type= CLI arg against centralized registry
  const variantTypeRaw = typeArg.split('=')[1];
  if (!isVariantType(variantTypeRaw)) {
    console.error(`Invalid variant type: '${variantTypeRaw}'. Must be one of: ${listVariantTypes().join(', ')}`);
    process.exit(1);
  }

  const config: PipelineConfig = {
    l3ProjectPath: l3PathArg.split('=')[1],
    variantName: variantNameRaw,
    variantType: variantTypeRaw,
    variantDescription: descArg.split('=')[1],
    skipParityValidation: skipParityArg,
    skipIntegration: skipIntegrationArg,
    outputPath: outputArg?.split('=')[1],
    version: versionArg?.split('=')[1],
    status: statusArg?.split('=')[1],
    autoFixAgentsMd: autoFixAgentsMdArg,
    autoFixPmMd: autoFixPmMdArg,
    overlayVariant: overlayVariantArg,
    hubClassificationMode: hubClassifyReportOnlyArg ? 'report-only' : 'enforce',
  };

  try {
    const result = await executeL3ToVariantPipeline(config);

    if (result.success) {
      // Variant Readiness Gate (VRG): a freshly generated variant must be READY
      // before it is accepted. Block unless --force. Mirrors project-to-variant.ts.
      const gateTs = join(import.meta.dir, 'validate-variant-readiness.ts');
      if (!forceArg && existsSync(gateTs) && result.variantPath) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`PHASE 8: Variant Readiness Gate`);
        console.log(`${'─'.repeat(60)}`);
        try {
          execFileSync(process.execPath, [gateTs, '--dir', result.variantPath], {
            cwd: join(import.meta.dir, '..'),
            stdio: 'inherit',
          });
          console.log(`✅ Variant Readiness Gate passed.`);
        } catch {
          console.error(`\n❌ Variant Readiness Gate FAILED — the generated variant is not ready.`);
          console.error(`   Fix the issues above or re-run with --force.`);
          process.exit(1);
        }
      } else if (forceArg) {
        console.log(`\n⚠️  Variant Readiness Gate skipped (--force).`);
      }
      console.log('\n✅ Pipeline execution successful');
      process.exit(0);
    } else {
      console.log('\n❌ Pipeline execution failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Pipeline execution failed with exception:');
    console.error(error);
    process.exit(1);
  }
}

// Run main only when executed directly (not when imported as a module)
if (import.meta.main) {
  // T-20260912-019: a rejection escaping main()'s internal try/catch must not
  // exit 0 — log it and fail loudly (the previous `.catch(console.error)` let
  // the process exit 0 on an unhandled rejection, signalling success to CI).
  main().catch((error) => {
    console.error('\n❌ Unhandled pipeline rejection:');
    console.error(error);
    process.exit(1);
  });
}
