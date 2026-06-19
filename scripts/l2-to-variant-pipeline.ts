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
 * @version 1.8.0
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
 *   PHASE 4.5 — Golden reference structural gap check — NEW in v1.7.0 (golden-reference-loader.ts)
 *               · Layer 1: verifies 7 required agent sections + 5 required skill sections
 *               · Layer 2: checks variantType-specific optional sections
 *               · Writes _pipeline_report.md in variant root; does NOT fail pipeline
 *   PHASE 4.6 — pm.md processing and context.md generation
 *   PHASE 5   — Beta lifecycle initialization
 *   PHASE 6   — Platform parity validation
 *   PHASE 7   — Workspace integration
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
import { scanL2Project, L2ScanResult } from './helpers/scan-l2-project.js';
import {
  normalizeAgentSkills,
  formatNormalizationReport,
  NormalizationResult,
} from './helpers/normalize-agent-skills.js';
import {
  getAgentGoldenStructure,
  getSkillGoldenStructure,
  checkStructuralGaps,
  formatGapReport,
  StructuralGapReport,
} from './helpers/golden-reference-loader.js';
import { reconcileWithL0L1, ReconciledManifest } from './helpers/reconcile-with-l0-l1.js';
import { generateVariant, GeneratedVariant, VariantMetadata } from './helpers/generate-variant.js';
import {
  initializeBetaLifecycle,
  checkPromotionEligibilityDetails,
  BetaLifecycleState,
} from './helpers/beta-lifecycle.js';
import { validatePlatformParity, ParityValidationResult } from './helpers/validate-platform-parity.js';
import { integrateVariantToWorkspace, IntegrationResult } from './helpers/integration-helpers.js';
import { validateDependencies } from './helpers/variant-governance-rules.js';
import { ErrorPhase, fatalError, logError, logErrors } from './lib/error-handling.js';
import { parsePmMd, extractVariantOverrides, resolveExtendsChain, writeContextMd } from './helpers/pm-md-parser.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PipelineConfig {
  /** Path to L2 project */
  l2ProjectPath: string;
  /** Variant name */
  variantName: string;
  /** Variant type */
  variantType: 'security' | 'development' | 'design' | 'consulting' | 'collaboration' | 'lecture';
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

    const failedCount = gapReports.filter(r => !r.passed).length;
    if (failedCount > 0) {
      console.warn(`⚠️  ${failedCount} file(s) have missing required sections. See _pipeline_report.md`);
    }

    console.log(`✅ PHASE 4.5 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Non-fatal: log and continue
    console.warn(`⚠️  PHASE 4.5 WARNING: ${errorMsg}`);
  }

  // ============================================================================
  // PHASE 4.6: PROCESS PM.MD AND GENERATE CONTEXT.MD
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
  // PHASE 7: WORKSPACE INTEGRATION
  // ============================================================================

  if (!config.skipIntegration) {
    try {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`PHASE 7: Integrating to Workspace`);
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
    console.log(`PHASE 7: Skipped (skipIntegration=true)`);
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
  const skipIntegrationArg = args.includes('--skip-integration');
  const outputArg = args.find(arg => arg.startsWith('--output='));

  if (!l2PathArg || !nameArg || !typeArg || !descArg) {
    console.error('Usage: bun scripts/pipeline/l2-to-variant-pipeline.ts \\');
    console.error('  --l2-path=<path-to-l2-project> \\');
    console.error('  --name=<variant-name> \\');
    console.error('  --type=<security|development|design|consulting|collaboration|lecture> \\');
    console.error('  --description=<variant-description> \\');
    console.error('  [--skip-parity] \\');
    console.error('  [--skip-integration] \\');
    console.error('  [--output=<output-path>]');
    process.exit(1);
  }

  // C-09: Validate --name= CLI arg before use in path construction
  const variantNameRaw = nameArg.split('=')[1];
  if (!/^co-[a-z][a-z0-9-]{1,30}$/.test(variantNameRaw)) {
    throw new Error(`Invalid variant name: '${variantNameRaw}'. Must match co-[a-z][a-z0-9-]{1,30}`);
  }

  const config: PipelineConfig = {
    l2ProjectPath: l2PathArg.split('=')[1],
    variantName: variantNameRaw,
    variantType: typeArg.split('=')[1] as any,
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
