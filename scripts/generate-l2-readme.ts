#!/usr/bin/env bun
// @version 1.0.2
/**
 * generate-l2-readme.ts
 *
 * Regenerates README.md/README_ko.md for a Phase A L3 project (Projects/<name>/)
 * using the workspace's README Standard template (templates/common/docs/README.template.md),
 * reading the live agent roster and skills from the project via scanL3Project()
 * (this script's own "l2" naming predates CONSTITUTION.md's L3 layer — see
 * §Terminology Definition; the project it scans is L3, not L2).
 * Complement to l2-to-variant-pipeline.ts's Phase B README generation — shares the
 * same rendering engine (helpers/generate-variant.ts) so Phase A and Phase B never drift.
 *
 * Usage:
 *   bun scripts/generate-l2-readme.ts [--l2-path <path>] [--dry-run] [--locale en|ko|both]
 *   bun scripts/generate-l2-readme.ts --l2-path Projects/co-journalist
 *   cd Projects/co-journalist && bun scripts/generate-l2-readme.ts   # bare form, defaults to cwd
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  generateReadme,
  generateReadmeKo,
  extractAgentRoster,
  extractSkills,
  type VariantMetadata,
} from './helpers/generate-variant.ts';
import { scanL3Project } from './helpers/scan-l3-project.ts';
import { isVariantType } from './helpers/registries/variant-type-registry.ts';
import { fatalError, ErrorPhase, logError } from './lib/error-handling.ts';

// ============================================================================
// Argument parsing
// ============================================================================

interface Args {
  l2Path: string;
  dryRun: boolean;
  locale: 'en' | 'ko' | 'both';
}

function printUsage(): void {
  console.log(
    'Usage: bun scripts/generate-l2-readme.ts [--l2-path <path>] [--dry-run] [--locale en|ko|both]\n' +
      '\n' +
      'Options:\n' +
      '  --l2-path <path>   Path to the L3 project (default: current working directory)\n' +
      '  --dry-run          Print the planned output without writing any files\n' +
      '  --locale <locale>  One of: en, ko, both (default: both)\n' +
      '  -h, --help         Show this help message\n'
  );
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  let l2Path: string | null = null;
  let dryRun = false;
  let locale: 'en' | 'ko' | 'both' = 'both';

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      printUsage();
      process.exit(0);
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--l2-path') {
      l2Path = argv[++i] ?? null;
    } else if (a.startsWith('--l2-path=')) {
      l2Path = a.split('=')[1] ?? null;
    } else if (a === '--locale') {
      const val = argv[++i] ?? '';
      if (val !== 'en' && val !== 'ko' && val !== 'both') {
        fail(`Invalid --locale "${val}". Must be one of: en, ko, both.`);
      }
      locale = val;
    } else if (a.startsWith('--locale=')) {
      const val = a.split('=')[1] ?? '';
      if (val !== 'en' && val !== 'ko' && val !== 'both') {
        fail(`Invalid --locale "${val}". Must be one of: en, ko, both.`);
      }
      locale = val;
    }
  }

  return {
    l2Path: resolve(l2Path ?? process.cwd()),
    dryRun,
    locale,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { l2Path, dryRun, locale } = args;

  const variantJsonPath = join(l2Path, 'variant.json');
  if (!existsSync(variantJsonPath)) {
    const err = fatalError(
      ErrorPhase.VALIDATION,
      'VARIANT_JSON_NOT_FOUND',
      `variant.json not found at: ${variantJsonPath}`,
      undefined,
      'Ensure --l2-path points to a valid Phase A L3 project (Projects/<name>/) with a variant.json'
    );
    logError(err);
    process.exit(1);
  }

  let rawVariantJson: Record<string, unknown>;
  try {
    rawVariantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));
  } catch (error) {
    const err = fatalError(
      ErrorPhase.VALIDATION,
      'VARIANT_JSON_PARSE_FAILED',
      `Failed to parse variant.json at: ${variantJsonPath}`,
      error instanceof Error ? error.message : String(error),
      'Ensure variant.json is valid JSON'
    );
    logError(err);
    process.exit(1);
  }

  const name = (rawVariantJson.name as string) ?? undefined;
  const description = (rawVariantJson.description as string) ?? undefined;
  const rawVariantType =
    (rawVariantJson.variant_type as string) ?? (rawVariantJson.variantType as string) ?? undefined;
  const status = (rawVariantJson.status as string) ?? undefined;
  const version = (rawVariantJson.version as string) ?? undefined;
  const inheritsCommon = (rawVariantJson.inherits_common as string) ?? undefined;

  if (!name) fail(`variant.json is missing required "name" field: ${variantJsonPath}`);

  let variantType: string = rawVariantType ?? 'collaboration';
  if (!rawVariantType || !isVariantType(rawVariantType)) {
    console.warn(
      `⚠️  variant_type "${rawVariantType ?? '(missing)'}" is not a valid registry type — ` +
        `falling back to "collaboration" for rendering purposes only (variant.json is not modified).`
    );
    variantType = 'collaboration';
  }

  const scanResult = await scanL3Project(l2Path);
  const agentRoster = extractAgentRoster(scanResult);
  const skills = extractSkills(scanResult);

  const metadata: VariantMetadata = {
    name,
    description: description ?? '',
    variantType: variantType as VariantMetadata['variantType'],
    status: status || 'beta',
    version: version || '0.1.0',
    inherits_common: inheritsCommon || 'templates/common',
    agentRoster,
    skills,
  };

  const willWriteEn = locale === 'en' || locale === 'both';
  const willWriteKo = locale === 'ko' || locale === 'both';

  if (dryRun) {
    console.log(`📄 [DRY RUN] README generation for ${l2Path}`);
    console.log(`  Agents found:  ${agentRoster.length}`);
    console.log(`  Skills found:  ${skills.length}`);
    console.log(`  Would write:`);
    if (willWriteEn) console.log(`    - ${join(l2Path, 'README.md')}`);
    if (willWriteKo) console.log(`    - ${join(l2Path, 'README_ko.md')}`);
    process.exit(0);
  }

  const filesWritten: string[] = [];
  if (willWriteEn) {
    filesWritten.push(generateReadme(l2Path, metadata));
  }
  if (willWriteKo) {
    filesWritten.push(generateReadmeKo(l2Path, metadata));
  }

  console.log(`📄 README generation for ${l2Path}`);
  console.log(`  Agents found:  ${agentRoster.length}`);
  console.log(`  Skills found:  ${skills.length}`);
  console.log(`  Files written:`);
  for (const f of filesWritten) {
    console.log(`    - ${f}`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('\n❌ generate-l2-readme failed:');
    console.error(error);
    process.exit(1);
  });
}
