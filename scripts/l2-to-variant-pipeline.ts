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
 * @version 1.6.0
 * @phase: Complete pipeline orchestration
 *
 * Agent Frontmatter Normalization (v1.6.0):
 * During Wave 3 (generate-variant.ts), specialist agent files copied from the L2
 * source are automatically normalized via normalizeAgentFrontmatter():
 *   - Strips L2-only fields: lifecycle, formal_name, variant
 *   - Adds missing tier platforms (antigravity, gemini-cli) inheriting the claude tier
 * pm.md, README.md, README_ko.md are excluded from normalization.
 *
 * Expected agent file structure post-normalization:
 *   ## Role → ## ⚠️ PM-ONLY INVOCATION → ## Responsibilities
 *   → ## Output Format → ## Constraints → ## Meeting Participation
 *   → ## Dispatch Protocol
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
  // PHASE 4.5: PROCESS PM.MD AND GENERATE CONTEXT.MD
  // ============================================================================

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`PHASE 4.5: Processing pm.md and Generating context.md`);
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

    console.log(`✅ PHASE 4.5 COMPLETE`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Don't fail the pipeline for context.md generation errors
    console.warn(`⚠️  PHASE 4.5 WARNING: ${errorMsg}`);
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
