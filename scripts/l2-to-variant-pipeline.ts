#!/usr/bin/env bun
/**
 * L2-to-Variant Pipeline
 *
 * Complete pipeline for converting L2 projects to beta variants.
 * Orchestrates all wave components:
 * - Wave 1: L2 scanning (scan-l2-project.ts)
 * - Wave 2: L0/L1 reconciliation (reconcile-with-l0-l1.ts)
 * - Wave 3: Variant generation (generate-variant.ts)
 * - Wave 3: Beta lifecycle management (beta-lifecycle.ts)
 * - Wave 3: Platform parity validation (validate-platform-parity.ts)
 * - Wave 3: Workspace integration (integration-helpers.ts)
 *
 * @version 1.9.0
 * @phase: Complete pipeline orchestration
 *
 * Pipeline Phases:
 *   PHASE 1   — L2 project scan (scan-l2-project.ts)
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
 *               · Operates on GENERATED variant output (not L2 source)
 *               · Distinct from Phase 1.6 (source diagnosis)
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
 * - helpers/scan-l2-project.ts (L2 scanning)
 * - helpers/reconcile-with-l0-l1.ts (Reconciliation)
 * - helpers/generate-variant.ts (Variant generation + agent normalization)
 * - helpers/beta-lifecycle.ts (Lifecycle management)
 * - helpers/validate-platform-parity.ts (Parity validation)
 * - helpers/integration-helpers.ts (Workspace integration)
 * - helpers/variant-governance-rules.ts (Governance rules)
 * - lib/error-handling.ts (Error management)
 */

import { join, basename, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { scanL2Project, L2ScanResult } from './helpers/scan-l2-project.ts';
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
} from './helpers/golden-reference-loader.ts';
import { reconcileWithL0L1, ReconciledManifest } from './helpers/reconcile-with-l0-l1.ts';
import { generateVariant, GeneratedVariant, VariantMetadata } from './helpers/generate-variant.ts';
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
import type { VariantType } from './helpers/registries/variant-type-registry.ts';
import { listVariantTypes, isVariantType } from './helpers/registries/variant-type-registry.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PipelineConfig {
  /** Path to L2 project */
  l2ProjectPath: string;
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
}

export interface PipelineResult {
  /** Whether pipeline succeeded */
  success: boolean;
  /** Pipeline execution phases */
  phases: {
    scan: { success: boolean; result?: L2ScanResult; error?: string };
    reconcile: { success: boolean; result?: ReconciledManifest; error?: string };
    generate: { success: boolean; result?: GeneratedVariant; error?: string };
    lifecycle: { success: boolean; result?: BetaLifecycleState; error?: string };
    parity: { success: boolean; result?: ParityValidationResult; error?: string };
    integrate: { success: boolean; result?: IntegrationResult; error?: string };
  };
  /** Final output path */
  variantPath?: string;
  /** Total execution time (ms) */
  executionTime: number;
  /** Pipeline errors */
  errors: Array<{ phase: string; error: string }>;
}

// ============================================================================
// MAIN PIPELINE FUNCTION
// ============================================================================

/**
 * Execute complete L2-to-variant pipeline
 * @version 1.2.0
 */
export async function executeL2ToVariantPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`L2-to-Variant Pipeline`);
  console.log(`Variant: ${config.variantName}`);
  console.log(`Type: ${config.variantType}`);
  console.log(`${'='.repeat(60)}\n`);

  const errors: Array<{ phase: string; error: string }> = [];
  const phases: PipelineResult['phases'] = {
    scan: { success: false },
    reconcile: { success: false },
    generate: { success: false },
    lifecycle: { success: false },
    parity: { success: false },
    integrate: { success: false },
  };

  let scanResult: L2ScanResult | undefined;
  let reconciledManifest: ReconciledManifest | undefined;
  let generatedVariant: GeneratedVariant | undefined;
  let lifecycleState: BetaLifecycleState | undefined;
  let parityResult: ParityValidationResult | undefined;
  let integrationResult: IntegrationResult | undefined;

  // ============================================================================
  // PHASE 1: SCAN L2 PROJECT
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 1: Scanning L2 Project`);
    console.log(`${'─'.repeat(60)}`);

    scanResult = await scanL2Project(config.l2ProjectPath);
    phases.scan = { success: true, result: scanResult };
    console.log(`✅ PHASE 1 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    phases.scan = { success: false, error: errorMsg };
    errors.push({ phase: 'scan', error: errorMsg });
    console.error(`❌ PHASE 1 FAILED: ${errorMsg}`);
  }

  if (!phases.scan.success) {
    return buildFailureResult(phases, errors, startTime);
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
        config.l2ProjectPath,
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

    const l2PmPath = j16(config.l2ProjectPath, 'agents', 'pm.md');
    const l1CommonPmPath = j16('templates', 'common', 'agents', 'pm.md');

    if (!ex16(l2PmPath)) {
      console.log(`ℹ️  No agents/pm.md found in L2 source — skipping Phase 1.6`);
    } else {
      const pmContent = rfs(l2PmPath, 'utf-8');
      const pmLines = pmContent.split('\n').length;
      const pmIssues: string[] = [];

      // Check 1: extends: pattern
      if (!pmContent.includes('extends:')) {
        pmIssues.push(`Missing 'extends:' pattern — L2 pm.md should delegate to common via extends: ../../common/agents/pm.md`);
      }

      // Check 2: 200-line limit
      if (pmLines > 200) {
        pmIssues.push(`Line count ${pmLines} exceeds 200-line L2 limit (L0 duplication bug risk)`);
      }

      // Check 3: Duplicate sections vs L1 common pm.md
      if (ex16(l1CommonPmPath)) {
        const l1Content = rfs(l1CommonPmPath, 'utf-8');
        const l1Headers = [...l1Content.matchAll(/^#{1,3} .+/gm)].map(m => m[0].trim());
        const l2Headers = [...pmContent.matchAll(/^#{1,3} .+/gm)].map(m => m[0].trim());
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
    return buildFailureResult(phases, errors, startTime);
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
  // Verifies the L2 source AGENTS.md has the §-numbered structure and all 6
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

    const l2AgentsMdPath = j35(config.l2ProjectPath, 'AGENTS.md');

    if (!ex35(l2AgentsMdPath)) {
      console.log(`ℹ️  No AGENTS.md found in L2 source — will be generated from scratch in Phase 4.`);
    } else {
      const agentsMdContent = rfs35(l2AgentsMdPath, 'utf-8');

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

      if (missingMarkers.length === 0 && hasSectionedStructure) {
        console.log(`✅ AGENTS.md structure OK — all VARIANT-* markers present, §-numbered sections found`);
      } else {
        const issues: string[] = [];
        if (!hasSectionedStructure) issues.push('missing §-numbered section structure (§1/§3)');
        if (missingMarkers.length > 0) issues.push(`missing VARIANT-* markers: ${missingMarkers.join(', ')}`);

        console.warn(`⚠️  PHASE 3.5: AGENTS.md structure misaligned with L1 template:`);
        for (const issue of issues) console.warn(`   - ${issue}`);

        if (config.autoFixAgentsMd) {
          console.log(`   autoFixAgentsMd=true: regenerating AGENTS.md from L1 common template...`);
          try {
            // Inline regeneration: read L1 template, inject agent blocks, write to L2 source
            const commonTemplate = j35('templates', 'common', 'AGENTS.md');
            if (!ex35(commonTemplate)) {
              throw new Error(`L1 template not found: ${commonTemplate}`);
            }
            // Delegate to regenerate-agents-md.ts via subprocess
            const { execFileSync: efs } = await import('node:child_process');
            const variantDirName = config.l2ProjectPath.split(/[\\/]/).pop() ?? config.variantName;
            // Map L2 path to templates/<variant> if it lives under templates/
            const isInTemplates = config.l2ProjectPath.replace(/\\/g, '/').includes('templates/');
            if (isInTemplates) {
              efs('bun', ['scripts/regenerate-agents-md.ts', '--variant', variantDirName], { stdio: 'inherit' });
              console.log(`   ✅ AGENTS.md regenerated for ${variantDirName}`);
            } else {
              console.warn(`   ⚠️  L2 source is not under templates/ — auto-regeneration skipped. Run manually:`);
              console.warn(`      bun scripts/regenerate-agents-md.ts --variant ${variantDirName}`);
            }
          } catch (fixErr) {
            const fixMsg = fixErr instanceof Error ? fixErr.message : String(fixErr);
            console.error(`   ❌ Auto-regeneration failed: ${fixMsg}`);
            console.error(`   Fix manually: bun scripts/regenerate-agents-md.ts --variant ${config.variantName}`);
            console.error(`   Then re-run the pipeline.`);
            process.exit(1);
          }
        } else {
          // BLOCKING: Phase 4 injection will silently produce wrong output without markers
          console.error(`\n❌ PHASE 3.5 BLOCKING: AGENTS.md is missing injection anchors.`);
          console.error(`   Phase 4 injectVariantPlaceholders() will find no markers → uninjected output.`);
          console.error(`   Fix: bun scripts/regenerate-agents-md.ts --variant ${config.variantName}`);
          console.error(`   Or re-run pipeline with autoFixAgentsMd:true\n`);
          process.exit(1);
        }
      }
    }

    console.log(`✅ PHASE 3.5 COMPLETE`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === undefined) throw error; // re-throw process.exit
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  PHASE 3.5 WARNING: ${errorMsg}`);
  }

  // ============================================================================
  // PHASE 3.7: PLUGIN-BASED TYPE VALIDATION
  // ============================================================================
  // Runs after Phase 3.5 and before Phase 4. Validates the L2 source against
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
    const yaml = (await import('js-yaml')).default as typeof import('js-yaml');

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
      const agentsDir = join(config.l2ProjectPath, 'agents');
      const agentFiles = globSync('*.md', { cwd: agentsDir }).map(f => basename(f, '.md'));
      for (const required of policy.requiredAgents) {
        if (!agentFiles.includes(required)) {
          console.warn(`[3.7] WARNING: Required agent "${required}" not found for type "${config.variantType}"`);
        }
      }
    }

    // 3.7c: Required capabilities check (ERROR level)
    if (policy.requiredCapabilities && policy.requiredCapabilities.length > 0) {
      const { isCapability } = await import('./helpers/registries/index.ts');
      const agentsDir37c = join(config.l2ProjectPath, 'agents');
      const coveredCapabilities = new Set<string>();

      for (const agentFile of globSync('*.md', { cwd: agentsDir37c })) {
        const content = readFileSync(join(agentsDir37c, agentFile), 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
          try {
            const fm = yaml.load(match[1]) as Record<string, unknown>;
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
      }

      for (const required of policy.requiredCapabilities) {
        if (!coveredCapabilities.has(required)) {
          console.error(`[3.7] ERROR: Required capability "${required}" not covered by any agent`);
        }
      }
    }

    // 3.7d: Plugin validation hooks
    const { getPlugin } = await import('./helpers/plugins/index.ts');
    const plugin = getPlugin(config.variantType);
    if (plugin?.validate) {
      // Collect agent frontmatters for plugin context
      const agentsDir37d = join(config.l2ProjectPath, 'agents');
      const agentFrontmatters = globSync('*.md', { cwd: agentsDir37d }).map(f => {
        const content = readFileSync(join(agentsDir37d, f), 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        const fm = match ? (yaml.load(match[1]) as Record<string, unknown>) : {};
        return {
          name: basename(f, '.md'),
          capabilities: Array.isArray(fm?.capabilities) ? fm.capabilities as string[] : [],
        };
      });

      const variantJsonPath = join(config.l2ProjectPath, 'variant.json');
      const variantJson = existsSync(variantJsonPath) ? JSON.parse(readFileSync(variantJsonPath, 'utf-8')) : {};

      const issues = await plugin.validate({
        variantDir: config.l2ProjectPath,
        variantType: config.variantType,
        agentFrontmatters,
        variantJson,
      });

      for (const issue of issues) {
        if (issue.severity === 'error') {
          console.error(`[3.7] Plugin validation error: ${issue.category}: ${issue.message}`);
        } else if (issue.severity === 'warning') {
          console.warn(`[3.7] Plugin validation warning: ${issue.category}: ${issue.message}`);
        } else {
          console.log(`[3.7] Plugin validation info: ${issue.category}: ${issue.message}`);
        }
      }
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
  // PHASE 4: GENERATE VARIANT
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 4: Generating Variant`);
    console.log(`${'─'.repeat(60)}`);

    // Extract agent roster and skills from L2 scan result
    const agentRoster = extractAgentRoster(scanResult!);
    const skills = extractSkills(scanResult!);

    const metadata: VariantMetadata = {
      name: config.variantName,
      description: config.variantDescription,
      variantType: config.variantType,
      status: 'beta',
      version: '0.1.0',
      inherits_common: 'templates/common',
      agentRoster,
      skills,
    };

    // Lecture-type: read extension fields from canonical co-deck template
    if (config.variantType === 'lecture') {
      const { readFileSync } = await import('node:fs');
      const canonicalPath = join(process.cwd(), 'templates', 'co-deck', 'variant.json');
      try {
        const canonical = JSON.parse(readFileSync(canonicalPath, 'utf-8'));
        if (canonical.agent_manifest) metadata.agent_manifest = canonical.agent_manifest;
        if (canonical.theme_manifest) metadata.theme_manifest = canonical.theme_manifest;
        if (canonical.lecture_profile) metadata.lecture_profile = canonical.lecture_profile;
        console.log(`  ✅ Injected co-deck extension fields (agent_manifest, theme_manifest, lecture_profile)`);
      } catch {
        console.warn(`  ⚠️  Could not read templates/co-deck/variant.json — extension fields skipped`);
      }
    }

    generatedVariant = await generateVariant(metadata, reconciledManifest!, config.outputPath);
    phases.generate = { success: true, result: generatedVariant };
    console.log(`✅ PHASE 4 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    phases.generate = { success: false, error: errorMsg };
    errors.push({ phase: 'generate', error: errorMsg });
    console.error(`❌ PHASE 4 FAILED: ${errorMsg}`);
  }

  if (!phases.generate.success) {
    return buildFailureResult(phases, errors, startTime);
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
        if (!file.endsWith('.md') || ['pm.md', 'README.md'].includes(file)) continue;
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
    wu(reportPath, `# Pipeline Report\n\nGenerated: ${new Date().toISOString()}\n\n\`\`\`\n${gapReport}\n\`\`\`\n`);

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
        extraSections: r.extraSections ?? [],
      })),
    };
    wu(reportOutputPath, JSON.stringify(jsonReport, null, 2));
    console.log(`  📄 CI-friendly JSON report: ${reportOutputPath}`);

    const failedCount = gapReports.filter(r => !r.passed).length;
    if (failedCount > 0) {
      console.warn(`⚠️  ${failedCount} file(s) have missing required sections. See _pipeline_report.md`);
    }

    // BLOCKING CHECK: AGENTS.md must have §-numbered structure and VARIANT-* markers.
    // Without these, l2-to-variant-pipeline.ts injection has no anchors → silent drift.
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
        process.exit(1);
      }
    }

    console.log(`✅ PHASE 4.5 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Non-fatal: log and continue
    console.warn(`⚠️  PHASE 4.5 WARNING: ${errorMsg}`);
  }

  // ============================================================================
  // PHASE 4.6: GENERATED VARIANT PM.MD COMPLETION + CONTEXT.MD GENERATION
  // ============================================================================
  // Role: "generation completion" — operates on the GENERATED variant pm.md,
  // NOT the L2 source pm.md. Interprets extends: pattern and fills
  // <!-- VARIANT-SECTION: ... --> markers with variant-specific data, then
  // generates docs/<variant>.context.md from variant_overrides.
  //
  // Distinct from Phase 1.6 (source diagnosis): Phase 1.6 diagnoses the L2
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
    return buildFailureResult(phases, errors, startTime);
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
        console.warn(`⚠️  PHASE 6 COMPLETE WITH VIOLATIONS`);
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
        status: 'beta',
        version: '0.1.0',
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

  return {
    success: true,
    phases,
    variantPath: generatedVariant!.variantPath,
    executionTime,
    errors,
  };
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

/**
 * Extract agent roster from L2 scan result.
 * Skips pm.md, README.md, README_ko.md, and handoff-spec files.
 * @version 1.3.0
 */
function extractAgentRoster(scanResult: L2ScanResult): VariantMetadata['agentRoster'] {
  const SKIP_AGENT_FILES = new Set(['pm.md', 'README.md', 'README_ko.md']);
  const l2ProjectPath = scanResult.scanMetadata.l2ProjectPath;

  const agentFiles = scanResult.files.filter(f => {
    if (!f.relativePath.startsWith('agents/') || !f.relativePath.endsWith('.md')) return false;
    const fileName = f.relativePath.split('/').pop() ?? '';
    return !SKIP_AGENT_FILES.has(fileName) && !fileName.includes('handoff-spec');
  });

  return agentFiles.map(file => {
    const name = file.relativePath.replace('agents/', '').replace('.md', '');
    const absPath = join(l2ProjectPath, file.relativePath);

    let tier: 'high' | 'medium' | 'low' = 'medium';
    let model = 'inherit';
    let description = `${name} specialist agent`;

    if (existsSync(absPath)) {
      try {
        const content = readFileSync(absPath, 'utf-8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const fm = fmMatch[1];
          // Read tier.claude (nested) or flat tier
          const tierClaudeMatch = fm.match(/^\s+claude:\s*(high|medium|low)/m);
          if (tierClaudeMatch) {
            tier = tierClaudeMatch[1] as 'high' | 'medium' | 'low';
          } else {
            const tierFlatMatch = fm.match(/^tier:\s*(high|medium|low)/m);
            if (tierFlatMatch) tier = tierFlatMatch[1] as 'high' | 'medium' | 'low';
          }
          // Read block-scalar description (>- form: next indented line)
          const descBlockMatch = fm.match(/^description:\s*>-?\n\s+(.+)/m);
          if (descBlockMatch) {
            description = descBlockMatch[1].trim().substring(0, 120);
          } else {
            const descInlineMatch = fm.match(/^description:\s*(.+)/m);
            if (descInlineMatch) description = descInlineMatch[1].trim().substring(0, 120);
          }
          // Read model (skip 'inherit' placeholder)
          const modelMatch = fm.match(/^model:\s*(.+)/m);
          if (modelMatch && modelMatch[1].trim() !== 'inherit') {
            model = modelMatch[1].trim();
          }
        }
      } catch {
        // fallback to defaults already set above
      }
    }

    return { name, tier, model, description };
  });
}

/**
 * Extract variant-specific skills from L2 scan result.
 * Only includes skills/ (not .claude/skills/ or .gemini/skills/ — those are L0 common).
 * @version 1.3.0
 */
function extractSkills(scanResult: L2ScanResult): VariantMetadata['skills'] {
  const skillFiles = scanResult.files.filter(f =>
    f.relativePath.startsWith('skills/') && f.relativePath.endsWith('SKILL.md')
  );

  const skills: VariantMetadata['skills'] = [];
  const processedSkills = new Set<string>();

  for (const file of skillFiles) {
    const match = file.relativePath.match(/skills\/([^/]+)\//);
    if (match && !processedSkills.has(match[1])) {
      skills.push({ name: match[1] });
      processedSkills.add(match[1]);
    }
  }

  return skills;
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const l2PathArg = args.find(arg => arg.startsWith('--l2-path='));
  const nameArg = args.find(arg => arg.startsWith('--name='));
  const typeArg = args.find(arg => arg.startsWith('--type='));
  const descArg = args.find(arg => arg.startsWith('--description='));
  const skipParityArg = args.includes('--skip-parity');
  const skipIntegrationFlag = args.find(arg => arg.startsWith('--skip-integration'));
  // Phase 7 defaults to OFF (skipped). Only runs if explicitly --skip-integration=false
  const skipIntegrationArg = skipIntegrationFlag ? skipIntegrationFlag !== '--skip-integration=false' : true;
  const outputArg = args.find(arg => arg.startsWith('--output='));

  if (!l2PathArg || !nameArg || !typeArg || !descArg) {
    console.error('Usage: bun scripts/l2-to-variant-pipeline.ts \\');
    console.error('  --l2-path=<path-to-l2-project> \\');
    console.error('  --name=<variant-name> \\');
    console.error(`  --type=<${listVariantTypes().join('|')}> \\`);
    console.error('  --description=<variant-description> \\');
    console.error('  [--skip-parity] \\');
    console.error('  [--skip-integration=false] (default: ON — Phase 7 is deprecated and skipped) \\');
    console.error('  [--output=<output-path>]');
    process.exit(1);
  }

  // C-09: Validate --name= CLI arg before use in path construction
  const variantNameRaw = nameArg.split('=')[1];
  if (!/^co-[a-z][a-z0-9-]{1,30}$/.test(variantNameRaw)) {
    throw new Error(`Invalid variant name: '${variantNameRaw}'. Must match co-[a-z][a-z0-9-]{1,30}`);
  }

  // Validate --type= CLI arg against centralized registry
  const variantTypeRaw = typeArg.split('=')[1];
  if (!isVariantType(variantTypeRaw)) {
    console.error(`Invalid variant type: '${variantTypeRaw}'. Must be one of: ${listVariantTypes().join(', ')}`);
    process.exit(1);
  }

  const config: PipelineConfig = {
    l2ProjectPath: l2PathArg.split('=')[1],
    variantName: variantNameRaw,
    variantType: variantTypeRaw,
    variantDescription: descArg.split('=')[1],
    skipParityValidation: skipParityArg,
    skipIntegration: skipIntegrationArg,
    outputPath: outputArg?.split('=')[1],
  };

  try {
    const result = await executeL2ToVariantPipeline(config);

    if (result.success) {
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

// Always run main when executed
main().catch(console.error);
