#!/usr/bin/env bun
/**
 * Platform Parity Validator
 *
 * Validates cross-platform parity between a variant's platform mirrors, using
 * .claude/ as the SSOT-side reference (spec
 * 2026-09-25-verifier-platform-expansion-design site 12, ruling D12):
 * structural equivalence, settings schema parity, and command/skill alignment
 * across .gemini/, .agents/ and .codex/ (mapping-aware for codex).
 *
 * Mapping semantics (ADR-0077 D4): .claude/commands/<x>.md is the commands
 * SSOT; codex consumes it as .codex/prompts/<x>.md (1:1 name mirror). Codex
 * files that are neither skills nor prompts (e.g. config.toml) are OUT OF
 * SCOPE: settings.json is a Claude/Gemini concept and .codex/config.toml
 * schema parity is a content-policy decision, not a verifier expansion.
 * .agents/commands is excluded — no producer, no documented consumer (design
 * Finding D; recorded exclusion, not a silent skip).
 *
 * Skip markers (D3.4 generalized): `mirror-parity: skip` in a .claude file's
 * frontmatter means "claude-only parity" for all three non-claude mirrors;
 * `gemini-parity: skip` is accepted as a legacy alias.
 *
 * Severity: FATAL findings gate the pipeline (Phase 6). Findings involving the
 * .agents/.codex trees are net-new coverage soaking as WARNING-severity
 * violations (ADR-0055) — the dated promotion ticket flips them to fatal.
 *
 * @version 1.2.0
 * @phase 3: Platform Parity Validation
 *
 * Dependencies:
 * - lib/encoding-utils.ts (UTF-8 handling)
 * - lib/error-handling.ts (Error management)
 */

import { join, relative } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { readUTF8File } from '../lib/encoding-utils.ts';
import { ErrorPhase, fatalError } from '../lib/error-handling.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ParityValidationResult {
  /** Whether parity violations were found */
  hasParityViolations: boolean;
  /** List of parity violations */
  violations: ParityViolation[];
  /** Summary statistics */
  summary: {
    claudeOnlyFiles: number;
    geminiOnlyFiles: number;
    bothPlatformsFiles: number;
    totalViolations: number;
  };
}

export interface ParityViolation {
  /** Violation type */
  type:
    | 'claude_only'
    | 'gemini_only'
    | 'agents_only'
    | 'codex_only'
    | 'schema_mismatch'
    | 'content_divergence'
    | 'missing_gemini_parity_skip';
  /** File path relative to variant root */
  filePath: string;
  /** Which platform has the file (single mirror) or 'both' for schema issues */
  platform: 'claude' | 'gemini' | 'agents' | 'codex' | 'both';
  /** Severity */
  severity: 'fatal' | 'warning' | 'info';
  /** Description of the violation */
  description: string;
  /** Suggested remediation */
  remediation: string;
}

/** Per-mirror comparison outcome against the .claude/ reference tree. */
interface MirrorManifest {
  platform: 'gemini' | 'agents' | 'codex';
  /** Claude-side relative paths missing from this mirror */
  missingFromMirror: string[];
  /** Mirror-side relative paths with no .claude/ counterpart */
  mirrorOnly: string[];
  /** Claude-side relative paths present in both */
  matched: string[];
  /** Claude-side paths carrying a skip marker (claude-only parity) */
  skipped: string[];
}

export interface PlatformFileManifest {
  gemini: MirrorManifest;
  agents: MirrorManifest;
  codex: MirrorManifest;
  /** Files present in both .claude/ and .gemini/ (legacy summary field) */
  both: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================()

const WORKSPACE_ROOT = process.cwd();
const SETTINGS_JSON_SCHEMA = {
  // Common tier (shared) - must be present in both .claude/settings.json and .gemini/settings.json
  shared: ['mcpServers', 'hooks.SessionStart'],
  // Claude-only tier (no .gemini parity required)
  // PostToolUse moved from shared: Gemini CLI uses AfterTool instead
  // PreToolUse, PreCompact, WorktreeCreate are Claude Code-only events
  claude_only: [
    'permissions', 'env', 'teammateMode',
    'hooks.PreToolUse', 'hooks.PostToolUse', 'hooks.PreCompact',
    'hooks.TeammateIdle', 'hooks.TaskCreated', 'hooks.TaskCompleted',
    'hooks.WorktreeCreate',
  ],
  // Gemini-only tier (no .claude parity required)
  // Gemini CLI hook events: BeforeTool=PreToolUse, AfterTool=PostToolUse, PreCompress=PreCompact
  // Note: Antigravity (VS Code extension) does NOT fire hooks despite sharing .gemini/settings.json
  gemini_only: ['hooks.BeforeTool', 'hooks.AfterTool', 'hooks.PreCompress'],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Recursively scan directory for files
 * @version 1.1.0
 */
function scanDirectoryRecursively(dirPath: string, extensions: string[] = []): string[] {
  const files: string[] = [];

  if (!existsSync(dirPath)) {
    return files;
  }

  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__MACOSX') {
        continue;
      }
      // Recurse into subdirectory
      files.push(...scanDirectoryRecursively(fullPath, extensions));
    } else if (entry.isFile()) {
      // Filter by extension if specified
      if (extensions.length === 0 || extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Check if file carries a claude-only parity skip marker. `mirror-parity:
 * skip` is the canonical marker; `gemini-parity: skip` is accepted as a
 * legacy alias (D3.4 generalized semantics).
 * @version 1.2.0
 */
function hasMirrorParitySkip(filePath: string): boolean {
  try {
    const content = readUTF8File(filePath);
    return /(^|\n)(mirror-parity|gemini-parity):\s*skip\s*(\n|$)/.test(content);
  } catch {
    return false;
  }
}

/**
 * Translate a mirror-side relative path into its .claude/-side counterpart.
 * Codex is mapping-aware: prompts/<x>.md ↔ commands/<x>.md (ADR-0077 D4);
 * codex files that are neither skills/ nor prompts/ are out of scope (null).
 * gemini/agents map 1:1 (agents/commands excluded — Finding D).
 * @version 1.2.0
 */
function mirrorToClaudeRelative(
  platform: 'gemini' | 'agents' | 'codex',
  relativePath: string,
): string | null {
  if (platform === 'codex') {
    if (relativePath.startsWith('skills/') || relativePath.startsWith('agents/')) {
      return relativePath;
    }
    if (relativePath.startsWith('prompts/')) {
      return `commands/${relativePath.slice('prompts/'.length)}`;
    }
    return null; // config.toml and other codex-native files: out of scope
  }
  if (platform === 'agents' && relativePath.startsWith('commands/')) {
    return null; // .agents/commands ungoverned surface (Finding D exclusion)
  }
  return relativePath;
}

// ============================================================================
// PARITY VALIDATION
// ============================================================================

/**
 * Build the per-mirror platform file manifest (.claude/ as reference)
 * @version 1.2.0
 */
function buildPlatformManifest(variantPath: string): PlatformFileManifest {
  const claudePath = join(variantPath, '.claude');

  const makeMirror = (platform: 'gemini' | 'agents' | 'codex'): MirrorManifest => ({
    platform,
    missingFromMirror: [],
    mirrorOnly: [],
    matched: [],
    skipped: [],
  });

  const manifest: PlatformFileManifest = {
    gemini: makeMirror('gemini'),
    agents: makeMirror('agents'),
    codex: makeMirror('codex'),
    both: [],
  };

  if (!existsSync(claudePath)) return manifest;

  const mirrors: ReadonlyArray<readonly ['gemini' | 'agents' | 'codex', MirrorManifest]> = [
    ['gemini', manifest.gemini],
    ['agents', manifest.agents],
    ['codex', manifest.codex],
  ];
  const mirrorRoots = new Map(mirrors.map(([p]) => [p, join(variantPath, `.${p}`)]));

  // Reference side: every .claude file maps into each mirror's namespace
  const claudeFiles = scanDirectoryRecursively(claudePath, ['.md', '.json']);
  for (const claudeFile of claudeFiles) {
    const relativePath = relative(claudePath, claudeFile);
    if (hasMirrorParitySkip(claudeFile)) {
      for (const [, m] of mirrors) m.skipped.push(relativePath);
      continue;
    }
    let inAllMirrors = true;
    for (const [platform, m] of mirrors) {
      const mirrorFile = join(mirrorRoots.get(platform)!, relativePath);
      if (!existsSync(mirrorFile)) {
        m.missingFromMirror.push(relativePath);
        inAllMirrors = false;
      }
    }
    if (inAllMirrors) manifest.both.push(relativePath);
  }

  // Mirror side: files with no .claude/ counterpart (mapping-aware)
  for (const [platform, m] of mirrors) {
    const mirrorRoot = mirrorRoots.get(platform)!;
    if (!existsSync(mirrorRoot)) continue;
    const mirrorFiles = scanDirectoryRecursively(mirrorRoot, ['.md', '.json']);
    for (const mirrorFile of mirrorFiles) {
      const mirrorRelative = relative(mirrorRoot, mirrorFile);
      const claudeRelative = mirrorToClaudeRelative(platform, mirrorRelative);
      if (claudeRelative === null) continue; // out-of-scope mirror file
      if (!existsSync(join(claudePath, claudeRelative))) {
        m.mirrorOnly.push(mirrorRelative);
      }
    }
  }

  return manifest;
}

/**
 * Validate settings.json schema parity (stays claude↔gemini: settings.json is
 * a Claude/Gemini concept; .codex/config.toml schema parity is out of scope —
 * documented in the module header)
 * @version 1.1.0
 */
function validateSettingsParity(variantPath: string): ParityViolation[] {
  const violations: ParityViolation[] = [];

  const claudeSettingsPath = join(variantPath, '.claude', 'settings.json');
  const geminiSettingsPath = join(variantPath, '.gemini', 'settings.json');

  // Both settings.json must exist
  if (!existsSync(claudeSettingsPath) && !existsSync(geminiSettingsPath)) {
    // Neither exists - not a violation for new variants
    return violations;
  }

  if (existsSync(claudeSettingsPath) && !existsSync(geminiSettingsPath)) {
    violations.push({
      type: 'claude_only',
      filePath: '.claude/settings.json',
      platform: 'claude',
      severity: 'fatal',
      description: '.claude/settings.json exists but .gemini/settings.json is missing',
      remediation: 'Create .gemini/settings.json with shared tier settings from .claude/settings.json',
    });
    return violations;
  }

  if (!existsSync(claudeSettingsPath) && existsSync(geminiSettingsPath)) {
    violations.push({
      type: 'gemini_only',
      filePath: '.gemini/settings.json',
      platform: 'gemini',
      severity: 'fatal',
      description: '.gemini/settings.json exists but .claude/settings.json is missing',
      remediation: 'Create .claude/settings.json with shared tier settings from .gemini/settings.json',
    });
    return violations;
  }

  // Both exist - validate schema parity
  try {
    const claudeSettings = JSON.parse(readUTF8File(claudeSettingsPath));
    const geminiSettings = JSON.parse(readUTF8File(geminiSettingsPath));

    // Check shared tier parity
    const schemaMismatches = compareSharedSettingsSchema(claudeSettings, geminiSettings);

    for (const mismatch of schemaMismatches) {
      violations.push({
        type: 'schema_mismatch',
        filePath: '.claude/settings.json <-> .gemini/settings.json',
        platform: 'both',
        severity: 'fatal',
        description: mismatch,
        remediation: 'Ensure shared tier settings (mcpServers, hooks.SessionStart) are identical in both files',
      });
    }
  } catch (error) {
    violations.push({
      type: 'schema_mismatch',
      filePath: '.claude/settings.json <-> .gemini/settings.json',
      platform: 'both',
      severity: 'fatal',
      description: `Failed to parse settings.json: ${error instanceof Error ? error.message : String(error)}`,
      remediation: 'Ensure both settings.json files are valid JSON',
    });
  }

  return violations;
}

function compareSharedSettingsSchema(
  claudeSettings: Record<string, any>,
  geminiSettings: Record<string, any>
): string[] {
  const mismatches: string[] = [];

  // Check shared tier keys
  for (const key of SETTINGS_JSON_SCHEMA.shared) {
    const claudeValue = JSON.stringify(claudeSettings[key]);
    const geminiValue = JSON.stringify(geminiSettings[key]);

    if (claudeValue !== geminiValue) {
      mismatches.push(
        `Shared tier setting '${key}' differs: ` +
        `claude=${claudeValue}, gemini=${geminiValue}`
      );
    }
  }

  return mismatches;
}

/**
 * Validate command parity across the three mirrors. The codex manifest is
 * mapping-aware (prompts ↔ commands), so a codex gap surfaces here too.
 * .gemini findings keep pre-existing fatal severity; .agents/.codex findings
 * are net-new coverage soaking at warning severity (ADR-0055) —
 * TODO(promotion): flip to fatal.
 * @version 1.2.0
 */
function validateCommandParity(manifest: PlatformFileManifest): ParityViolation[] {
  const violations: ParityViolation[] = [];

  for (const m of [manifest.gemini, manifest.agents, manifest.codex]) {
    const soak = m.platform !== 'gemini'; // TODO(promotion): flip to fatal after soak
    const severity = soak ? 'warning' : 'fatal';
    const soakNote = soak ? ' (soak: WARN until promotion)' : '';

    for (const rel of m.missingFromMirror) {
      if (!rel.startsWith('commands/') || !rel.endsWith('.md')) continue;
      if (m.skipped.includes(rel)) continue;
      violations.push({
        type: 'claude_only',
        filePath: `.claude/${rel}`,
        platform: 'claude',
        severity,
        description: `Command file exists only in .claude/ — no .${m.platform}/ counterpart: ${rel}${soakNote}`,
        remediation: m.platform === 'codex'
          ? `Run sync-skills (Phase 1b mirrors .claude/commands to .codex/prompts unconditionally)`
          : `Create corresponding file in .${m.platform}/commands/ or add 'mirror-parity: skip' to frontmatter`,
      });
    }

    for (const rel of m.mirrorOnly) {
      if (!rel.endsWith('.md')) continue;
      const isCommand = rel.startsWith('commands/') || rel.startsWith('prompts/');
      if (!isCommand) continue;
      violations.push({
        type: `${m.platform}_only` as ParityViolation['type'],
        filePath: `.${m.platform}/${rel}`,
        platform: m.platform,
        severity,
        description: `Command file exists only in .${m.platform}/: ${rel}${soakNote}`,
        remediation: `Create corresponding file in .claude/commands/ (the commands SSOT)`,
      });
    }
  }

  return violations;
}

/**
 * Validate skill parity across the three mirrors.
 * .gemini findings keep pre-existing fatal severity; .agents/.codex findings
 * are net-new coverage soaking at warning severity (ADR-0055) —
 * TODO(promotion): flip to fatal.
 * @version 1.2.0
 */
function validateSkillParity(manifest: PlatformFileManifest): ParityViolation[] {
  const violations: ParityViolation[] = [];

  for (const m of [manifest.gemini, manifest.agents, manifest.codex]) {
    const soak = m.platform !== 'gemini'; // TODO(promotion): flip to fatal after soak
    const severity = soak ? 'warning' : 'fatal';
    const soakNote = soak ? ' (soak: WARN until promotion)' : '';

    for (const rel of m.missingFromMirror) {
      if (!rel.startsWith('skills/') || !rel.endsWith('SKILL.md')) continue;
      if (m.skipped.includes(rel)) continue;
      violations.push({
        type: 'claude_only',
        filePath: `.claude/${rel}`,
        platform: 'claude',
        severity,
        description: `Skill exists only in .claude/ — no .${m.platform}/ counterpart: ${rel}${soakNote}`,
        remediation: `Create corresponding skill in .${m.platform}/skills/ or add 'mirror-parity: skip' to frontmatter`,
      });
    }

    for (const rel of m.mirrorOnly) {
      if (!rel.startsWith('skills/') || !rel.endsWith('SKILL.md')) continue;
      violations.push({
        type: `${m.platform}_only` as ParityViolation['type'],
        filePath: `.${m.platform}/${rel}`,
        platform: m.platform,
        severity,
        description: `Skill exists only in .${m.platform}/: ${rel}${soakNote}`,
        remediation: `Create corresponding skill in .claude/skills/ (the SSOT-side reference)`,
      });
    }
  }

  return violations;
}

/**
 * Validate agent parity across the three mirrors (warning severity — agents/
 * mirrors are advisory on every platform).
 * @version 1.2.0
 */
function validateAgentParity(manifest: PlatformFileManifest): ParityViolation[] {
  const violations: ParityViolation[] = [];

  for (const m of [manifest.gemini, manifest.agents, manifest.codex]) {
    for (const rel of m.missingFromMirror) {
      if (!rel.startsWith('agents/') || !rel.endsWith('.md')) continue;
      violations.push({
        type: 'claude_only',
        filePath: `.claude/${rel}`,
        platform: 'claude',
        severity: 'warning',
        description: `Agent file exists only in .claude/ — no .${m.platform}/ counterpart: ${rel}`,
        remediation: `Create corresponding agent in .${m.platform}/agents/ if applicable to the platform`,
      });
    }

    for (const rel of m.mirrorOnly) {
      if (!rel.startsWith('agents/') || !rel.endsWith('.md')) continue;
      violations.push({
        type: `${m.platform}_only` as ParityViolation['type'],
        filePath: `.${m.platform}/${rel}`,
        platform: m.platform,
        severity: 'warning',
        description: `Agent file exists only in .${m.platform}/: ${rel}`,
        remediation: `Create corresponding agent in .claude/agents/ if applicable to Claude platform`,
      });
    }
  }

  return violations;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate platform parity for a variant
 * @version 1.2.0
 */
export async function validatePlatformParity(variantPath: string): Promise<ParityValidationResult> {
  console.log(`\n=== Validating Platform Parity ===`);
  console.log(`Variant path: ${variantPath}\n`);

  if (!existsSync(variantPath)) {
    throw fatalError(
      ErrorPhase.VALIDATION,
      'VARIANT_NOT_FOUND',
      `Variant path does not exist: ${variantPath}`,
      undefined,
      'Verify the variant path is correct'
    );
  }

  const violations: ParityViolation[] = [];

  // Build platform file manifest
  console.log(`=== Building Platform Manifest (.claude/ reference ↔ .gemini/.agents/.codex mirrors) ===`);
  const manifest = buildPlatformManifest(variantPath);
  console.log(`Gemini — missing: ${manifest.gemini.missingFromMirror.length}, mirror-only: ${manifest.gemini.mirrorOnly.length}, skipped: ${manifest.gemini.skipped.length}`);
  console.log(`Agents — missing: ${manifest.agents.missingFromMirror.length}, mirror-only: ${manifest.agents.mirrorOnly.length}, skipped: ${manifest.agents.skipped.length}`);
  console.log(`Codex (mapping-aware) — missing: ${manifest.codex.missingFromMirror.length}, mirror-only: ${manifest.codex.mirrorOnly.length}, skipped: ${manifest.codex.skipped.length}`);
  console.log(`Files in both .claude/ and .gemini/: ${manifest.both.length}`);

  // Validate settings.json parity (claude↔gemini — see module header)
  console.log(`\n=== Validating settings.json Parity ===`);
  const settingsViolations = validateSettingsParity(variantPath);
  violations.push(...settingsViolations);
  console.log(`Found ${settingsViolations.length} violations`);

  // Validate command parity
  console.log(`\n=== Validating Command Parity ===`);
  const commandViolations = validateCommandParity(manifest);
  violations.push(...commandViolations);
  console.log(`Found ${commandViolations.length} violations`);

  // Validate skill parity
  console.log(`\n=== Validating Skill Parity ===`);
  const skillViolations = validateSkillParity(manifest);
  violations.push(...skillViolations);
  console.log(`Found ${skillViolations.length} violations`);

  // Validate agent parity
  console.log(`\n=== Validating Agent Parity ===`);
  const agentViolations = validateAgentParity(manifest);
  violations.push(...agentViolations);
  console.log(`Found ${agentViolations.length} violations`);

  // Compute summary (legacy fields preserved for callers; gemini-based)
  const summary = {
    claudeOnlyFiles: manifest.gemini.missingFromMirror.length,
    geminiOnlyFiles: manifest.gemini.mirrorOnly.length,
    bothPlatformsFiles: manifest.both.length,
    totalViolations: violations.length,
  };

  const hasParityViolations = violations.some(v => v.severity === 'fatal');

  console.log(`\n=== Platform Parity Validation Complete ===`);
  console.log(`Total violations: ${summary.totalViolations}`);
  console.log(`Fatal violations: ${violations.filter(v => v.severity === 'fatal').length}`);
  console.log(`Warnings: ${violations.filter(v => v.severity === 'warning').length}`);

  if (violations.length > 0) {
    console.log(`\n⚠️  Violations:`);
    for (const violation of violations) {
      const icon = violation.severity === 'fatal' ? '❌' : '⚠️ ';
      console.log(`${icon} [${violation.type}] ${violation.filePath}`);
      console.log(`   ${violation.description}`);
      console.log(`   Remediation: ${violation.remediation}`);
    }
  } else {
    console.log(`\n✅ No parity violations found`);
  }

  return {
    hasParityViolations,
    violations,
    summary,
  };
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const variantPathArg = args.find(arg => arg.startsWith('--variant-path='));

  if (!variantPathArg) {
    console.error('Usage: bun scripts/helpers/validate-platform-parity.ts --variant-path=<path-to-variant>');
    process.exit(1);
  }

  const variantPath = variantPathArg.split('=')[1];

  try {
    const result = await validatePlatformParity(variantPath);

    if (result.hasParityViolations) {
      console.log('\n❌ Platform parity validation failed');
      process.exit(1);
    } else {
      console.log('\n✅ Platform parity validation passed');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Platform parity validation failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run main if executed directly
if (import.meta.url === process.argv[1]) {
  main().catch(console.error);
}
