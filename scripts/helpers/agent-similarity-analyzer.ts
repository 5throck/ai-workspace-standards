#!/usr/bin/env tsx
/**
 * Wave 2a — Agent Similarity Analyzer
 *
 * Two operating modes:
 *   Mode 1 (default): Cross-variant comparison of L2 standalone agents
 *                     (files without "# @extends:"). Computes per-section
 *                     Jaccard similarity and identifies consolidation
 *                     candidates for L1 promotion.
 *   Mode 2 (--drift): Scans L2 agents that already have "# @extends:"
 *                     and checks whether the declared version matches
 *                     the current L1 registry version.
 *
 * @version 1.0.0
 * @phase Wave 2a: Agent Similarity Analysis
 *
 * See: docs/adr/0043-l1-agent-layer-hybrid-override.md
 * See: docs/designs/l1-agent-format-spec.md
 *
 * Dependencies:
 * - lib/encoding-utils.ts (UTF-8 handling)
 */

import { join, basename } from 'path';
import { existsSync, readdirSync } from 'fs';
import { readUTF8File, writeUTF8File } from '../lib/encoding-utils.js';

// ============================================================================
// TYPES (subset also declared in l1-agent-format-spec.md)
// ============================================================================

export type SimilarityBand = 'high' | 'medium' | 'low';

/** Jaccard similarity scores for each agent section */
export interface SectionSimilarityScores {
  role: number;
  responsibilities: number;
  output_format: number;
  constraints: number;
  meeting_participation: number;
  dispatch_protocol: number;
}

/** Similarity result between two variant agents */
export interface AgentPairSimilarity {
  variantA: string;
  variantB: string;
  agentName: string;
  fileA: string;
  fileB: string;
  scores: SectionSimilarityScores;
  /** Composite score: avg of role + responsibilities (primary signal) */
  primaryScore: number;
  /** Composite score: avg of all 6 sections */
  overallScore: number;
  band: SimilarityBand;
}

/** An agent name found in 3+ variants above threshold */
export interface ConsolidationCandidate {
  agentName: string;
  variantCount: number;
  variants: string[];
  minPrimaryScore: number;
  maxPrimaryScore: number;
  avgPrimaryScore: number;
  avgOverallScore: number;
  band: SimilarityBand;
  /** All pair-wise comparisons for this agent */
  pairs: AgentPairSimilarity[];
}

/** Full Mode 1 analysis result */
export interface SimilarityAnalysisResult {
  scannedVariants: string[];
  scannedAgentCount: number;
  pairComparisons: AgentPairSimilarity[];
  candidates: ConsolidationCandidate[];
  reviewNeeded: ConsolidationCandidate[];
  timestamp: string;
}

/** Drift check result for a single L2 agent */
export interface VersionDriftResult {
  filePath: string;
  agentName: string;
  l1Name: string;
  declaredVersion: string;
  registryVersion: string;
  isDrift: boolean;
}

/** Full Mode 2 drift report */
export interface DriftReport {
  scannedFiles: number;
  drifted: VersionDriftResult[];
  current: VersionDriftResult[];
  timestamp: string;
}

// ============================================================================
// THRESHOLDS
// ============================================================================

const THRESHOLD_HIGH = 0.85;
const THRESHOLD_MEDIUM = 0.70;
const PROMOTION_MIN_VARIANTS = 3;

// ============================================================================
// SECTION EXTRACTION
// ============================================================================

const SECTION_KEYS: Array<keyof SectionSimilarityScores> = [
  'role',
  'responsibilities',
  'output_format',
  'constraints',
  'meeting_participation',
  'dispatch_protocol',
];

/** Maps section key to the Markdown heading pattern to match */
const SECTION_HEADERS: Record<keyof SectionSimilarityScores, RegExp> = {
  role: /^##\s+Role\s*$/i,
  responsibilities: /^##\s+Responsibilities\s*$/i,
  output_format: /^##\s+Output\s+Format\s*$/i,
  constraints: /^##\s+Constraints\s*$/i,
  meeting_participation: /^##\s+Meeting\s+Participation\s*$/i,
  dispatch_protocol: /^##\s+Dispatch\s+Protocol\s*$/i,
};

/** Extracts the body text of a section from Markdown content */
function extractSection(content: string, headerPattern: RegExp): string {
  const lines = content.split('\n');
  let inSection = false;
  const body: string[] = [];

  for (const line of lines) {
    if (headerPattern.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^##\s/.test(line)) break;
      body.push(line);
    }
  }

  return body.join('\n').trim();
}

/** Tokenises text into a Set of lowercase words (for Jaccard) */
function tokenise(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
  return new Set(tokens);
}

/** Jaccard similarity: |A ∩ B| / |A ∪ B|; returns 1.0 if both empty */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  if (a.size === 0 || b.size === 0) return 0.0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return intersection / union;
}

/** Computes all section similarity scores between two agent file contents */
function computeSectionScores(
  contentA: string,
  contentB: string
): SectionSimilarityScores {
  const scores: Partial<SectionSimilarityScores> = {};

  for (const key of SECTION_KEYS) {
    const sectionA = extractSection(contentA, SECTION_HEADERS[key]);
    const sectionB = extractSection(contentB, SECTION_HEADERS[key]);
    scores[key] = jaccard(tokenise(sectionA), tokenise(sectionB));
  }

  return scores as SectionSimilarityScores;
}

function classifyBand(primaryScore: number): SimilarityBand {
  if (primaryScore >= THRESHOLD_HIGH) return 'high';
  if (primaryScore >= THRESHOLD_MEDIUM) return 'medium';
  return 'low';
}

// ============================================================================
// FILE DISCOVERY
// ============================================================================

const VARIANTS_ROOT = 'templates';
const VARIANT_PATTERN = /^co-/;

/** Returns all co-* variant directory names */
function discoverVariants(workspaceRoot: string): string[] {
  const templatesDir = join(workspaceRoot, VARIANTS_ROOT);
  if (!existsSync(templatesDir)) return [];

  return readdirSync(templatesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && VARIANT_PATTERN.test(d.name))
    .map(d => d.name);
}

/** Returns all agent .md files in a variant's agents/ directory */
function discoverAgentFiles(
  workspaceRoot: string,
  variantName: string
): string[] {
  const agentsDir = join(workspaceRoot, VARIANTS_ROOT, variantName, 'agents');
  if (!existsSync(agentsDir)) return [];

  return readdirSync(agentsDir)
    .filter(
      f =>
        f.endsWith('.md') &&
        !f.startsWith('README') &&
        !f.startsWith('_')
    )
    .map(f => join(agentsDir, f));
}

/** Returns true if the file has "# @extends:" on the first line */
function hasExtendsDeclaration(content: string): boolean {
  const firstLine = content.split('\n')[0] ?? '';
  return /^#\s*@extends:\s*l1\//i.test(firstLine);
}

/** Parses "# @extends: l1/<name>@<version>" from first line */
function parseExtendsRef(
  content: string
): { l1Name: string; version: string } | null {
  const firstLine = content.split('\n')[0] ?? '';
  const match = /^#\s*@extends:\s*l1\/([^@\s]+)@([^\s]+)/i.exec(firstLine);
  if (!match) return null;
  return { l1Name: match[1], version: match[2] };
}

// ============================================================================
// L1 REGISTRY LOOKUP
// ============================================================================

/** Reads the current version of an L1 agent from templates/common/agents/ frontmatter */
function getL1RegistryVersion(
  workspaceRoot: string,
  l1Name: string
): string | null {
  const l1Path = join(
    workspaceRoot,
    'templates',
    'common',
    'agents',
    `${l1Name}.md`
  );
  if (!existsSync(l1Path)) return null;

  const content = readUTF8File(l1Path);
  const match = /^version:\s*["']?([^"'\s]+)["']?/m.exec(content);
  return match ? match[1] : null;
}

// ============================================================================
// MODE 1 — CROSS-VARIANT SIMILARITY ANALYSIS
// ============================================================================

/** Main Mode 1 entry point */
export function analyzeAgentSimilarity(
  workspaceRoot: string
): SimilarityAnalysisResult {
  const variants = discoverVariants(workspaceRoot);

  // Build map: agentName → { variant, filePath, content }[]
  const agentMap = new Map<
    string,
    Array<{ variant: string; filePath: string; content: string }>
  >();

  let scannedAgentCount = 0;

  for (const variant of variants) {
    const files = discoverAgentFiles(workspaceRoot, variant);
    for (const filePath of files) {
      const content = readUTF8File(filePath);
      // Mode 1 only processes standalone (non-extends) agents
      if (hasExtendsDeclaration(content)) continue;

      const agentName = basename(filePath, '.md');
      if (!agentMap.has(agentName)) agentMap.set(agentName, []);
      agentMap.get(agentName)!.push({ variant, filePath, content });
      scannedAgentCount++;
    }
  }

  // Compute all pairwise comparisons for agents present in 2+ variants
  const pairComparisons: AgentPairSimilarity[] = [];

  for (const [agentName, instances] of agentMap.entries()) {
    if (instances.length < 2) continue;

    for (let i = 0; i < instances.length; i++) {
      for (let j = i + 1; j < instances.length; j++) {
        const a = instances[i];
        const b = instances[j];

        const scores = computeSectionScores(a.content, b.content);
        const primaryScore = (scores.role + scores.responsibilities) / 2;
        const overallScore =
          SECTION_KEYS.reduce((sum, k) => sum + scores[k], 0) /
          SECTION_KEYS.length;

        pairComparisons.push({
          variantA: a.variant,
          variantB: b.variant,
          agentName,
          fileA: a.filePath,
          fileB: b.filePath,
          scores,
          primaryScore,
          overallScore,
          band: classifyBand(primaryScore),
        });
      }
    }
  }

  // Identify consolidation candidates: agentName present in >= PROMOTION_MIN_VARIANTS
  // variants where the min primary score across all pairs is >= THRESHOLD_MEDIUM
  const candidates: ConsolidationCandidate[] = [];
  const reviewNeeded: ConsolidationCandidate[] = [];

  for (const [agentName, instances] of agentMap.entries()) {
    if (instances.length < PROMOTION_MIN_VARIANTS) continue;

    const pairs = pairComparisons.filter(p => p.agentName === agentName);
    if (pairs.length === 0) continue;

    const primaryScores = pairs.map(p => p.primaryScore);
    const minPrimary = Math.min(...primaryScores);

    if (minPrimary < THRESHOLD_MEDIUM) continue;

    const avgPrimary =
      primaryScores.reduce((a, b) => a + b, 0) / primaryScores.length;
    const overallScores = pairs.map(p => p.overallScore);
    const avgOverall =
      overallScores.reduce((a, b) => a + b, 0) / overallScores.length;

    const entry: ConsolidationCandidate = {
      agentName,
      variantCount: instances.length,
      variants: instances.map(i => i.variant),
      minPrimaryScore: minPrimary,
      maxPrimaryScore: Math.max(...primaryScores),
      avgPrimaryScore: avgPrimary,
      avgOverallScore: avgOverall,
      band: classifyBand(minPrimary),
      pairs,
    };

    if (minPrimary >= THRESHOLD_HIGH) {
      candidates.push(entry);
    } else {
      reviewNeeded.push(entry);
    }
  }

  // Sort by avg primary score descending
  candidates.sort((a, b) => b.avgPrimaryScore - a.avgPrimaryScore);
  reviewNeeded.sort((a, b) => b.avgPrimaryScore - a.avgPrimaryScore);

  return {
    scannedVariants: variants,
    scannedAgentCount,
    pairComparisons,
    candidates,
    reviewNeeded,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// MODE 1 — REPORT FORMATTER
// ============================================================================

function pct(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

function bandLabel(band: SimilarityBand): string {
  switch (band) {
    case 'high':
      return 'HIGH (auto-candidate >=85%)';
    case 'medium':
      return 'MEDIUM (review-needed 70-84%)';
    case 'low':
      return 'LOW (<70%)';
  }
}

/** Formats Mode 1 analysis as a Markdown report string */
export function formatConsolidationReport(
  result: SimilarityAnalysisResult
): string {
  const lines: string[] = [
    '# Agent Consolidation Report',
    '',
    `> Generated: ${result.timestamp}`,
    `> Variants scanned: ${result.scannedVariants.join(', ')}`,
    `> Standalone agents scanned: ${result.scannedAgentCount}`,
    `> Pair comparisons: ${result.pairComparisons.length}`,
    '',
    '---',
    '',
  ];

  // --- HIGH-CONFIDENCE CANDIDATES ---
  if (result.candidates.length === 0) {
    lines.push('## L1 Promotion Candidates (>=85% primary, 3+ variants)', '');
    lines.push('_No high-confidence candidates found._', '');
  } else {
    lines.push(
      `## L1 Promotion Candidates (>=85% primary, 3+ variants) — ${result.candidates.length} found`,
      ''
    );
    for (const c of result.candidates) {
      lines.push(
        `### \`${c.agentName}\` — ${bandLabel(c.band)}`,
        '',
        `- **Variants**: ${c.variants.join(', ')} (${c.variantCount} total)`,
        `- **Primary score range**: ${pct(c.minPrimaryScore)} – ${pct(c.maxPrimaryScore)} (avg ${pct(c.avgPrimaryScore)})`,
        `- **Overall score (all sections)**: avg ${pct(c.avgOverallScore)}`,
        ''
      );
      lines.push('#### Section-by-section scores', '');
      lines.push(
        '| Pair | Role | Responsibilities | Output Format | Constraints | Meeting | Dispatch |',
        '|------|------|-----------------|---------------|-------------|---------|----------|'
      );
      for (const p of c.pairs) {
        lines.push(
          `| ${p.variantA} <-> ${p.variantB} | ${pct(p.scores.role)} | ${pct(p.scores.responsibilities)} | ${pct(p.scores.output_format)} | ${pct(p.scores.constraints)} | ${pct(p.scores.meeting_participation)} | ${pct(p.scores.dispatch_protocol)} |`
        );
      }
      lines.push('');
    }
  }

  // --- MEDIUM-CONFIDENCE ---
  if (result.reviewNeeded.length === 0) {
    lines.push('## Review-Needed (70-84% primary, 3+ variants)', '');
    lines.push('_No medium-confidence candidates found._', '');
  } else {
    lines.push(
      `## Review-Needed (70-84% primary, 3+ variants) — ${result.reviewNeeded.length} found`,
      ''
    );
    for (const c of result.reviewNeeded) {
      lines.push(
        `### \`${c.agentName}\` — ${bandLabel(c.band)}`,
        '',
        `- **Variants**: ${c.variants.join(', ')} (${c.variantCount} total)`,
        `- **Primary score range**: ${pct(c.minPrimaryScore)} – ${pct(c.maxPrimaryScore)} (avg ${pct(c.avgPrimaryScore)})`,
        `- **Overall score**: avg ${pct(c.avgOverallScore)}`,
        ''
      );
    }
  }

  lines.push(
    '---',
    '',
    '_Next step: human review -> run `agent-promote.ts` for approved candidates_',
    ''
  );

  return lines.join('\n');
}

// ============================================================================
// MODE 2 — VERSION DRIFT DETECTION
// ============================================================================

/** Scans all L2 agents with "# @extends:" and checks version drift against L1 registry */
export function detectVersionDrift(workspaceRoot: string): DriftReport {
  const variants = discoverVariants(workspaceRoot);
  const drifted: VersionDriftResult[] = [];
  const current: VersionDriftResult[] = [];
  let scannedFiles = 0;

  for (const variant of variants) {
    const files = discoverAgentFiles(workspaceRoot, variant);

    for (const filePath of files) {
      const content = readUTF8File(filePath);
      if (!hasExtendsDeclaration(content)) continue;

      const ref = parseExtendsRef(content);
      if (!ref) continue;

      scannedFiles++;

      const registryVersion = getL1RegistryVersion(workspaceRoot, ref.l1Name);
      const entry: VersionDriftResult = {
        filePath,
        agentName: basename(filePath, '.md'),
        l1Name: ref.l1Name,
        declaredVersion: ref.version,
        registryVersion: registryVersion ?? '(not found)',
        isDrift:
          registryVersion !== null && registryVersion !== ref.version,
      };

      if (entry.isDrift) {
        drifted.push(entry);
      } else {
        current.push(entry);
      }
    }
  }

  return {
    scannedFiles,
    drifted,
    current,
    timestamp: new Date().toISOString(),
  };
}

/** Formats Mode 2 drift report as Markdown */
export function formatDriftReport(report: DriftReport): string {
  const lines: string[] = [
    '# L1 Agent Version Drift Report',
    '',
    `> Generated: ${report.timestamp}`,
    `> L2 agents with \`# @extends:\`: ${report.scannedFiles}`,
    `> Drifted: ${report.drifted.length} | Current: ${report.current.length}`,
    '',
    '---',
    '',
  ];

  if (report.drifted.length === 0) {
    lines.push(
      '## Version Drift',
      '',
      '_No drift detected — all L2 agents match L1 registry._',
      ''
    );
  } else {
    lines.push(`## Version Drift (${report.drifted.length} files)`, '');
    lines.push(
      '| File | Agent | L1 | Declared | Registry |',
      '|------|-------|----|---------|----------|'
    );
    for (const d of report.drifted) {
      lines.push(
        `| \`${d.filePath}\` | ${d.agentName} | ${d.l1Name} | ${d.declaredVersion} | ${d.registryVersion} |`
      );
    }
    lines.push('');
    lines.push(
      '> **Action required**: Update `# @extends:` comment and `agent_overrides.version` to match registry.',
      ''
    );
  }

  if (report.current.length > 0) {
    lines.push(`## Up-to-date (${report.current.length} files)`, '');
    for (const d of report.current) {
      lines.push(
        `- \`${d.filePath}\` -> l1/${d.l1Name}@${d.registryVersion}`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const driftMode = args.includes('--drift');
  const outputArg = args.find(a => a.startsWith('--output='));
  const outputPath = outputArg ? outputArg.split('=')[1] : null;
  const workspaceRoot = process.cwd();

  if (driftMode) {
    const report = detectVersionDrift(workspaceRoot);
    const text = formatDriftReport(report);

    if (outputPath) {
      writeUTF8File(outputPath, text);
      console.log(`Drift report written to: ${outputPath}`);
    } else {
      console.log(text);
    }

    process.exit(report.drifted.length > 0 ? 1 : 0);
  } else {
    const result = analyzeAgentSimilarity(workspaceRoot);
    const text = formatConsolidationReport(result);

    if (outputPath) {
      writeUTF8File(outputPath, text);
      console.log(`Consolidation report written to: ${outputPath}`);
    } else {
      console.log(text);
    }

    const total = result.candidates.length + result.reviewNeeded.length;
    console.error(
      `\nSummary: ${result.candidates.length} high-confidence + ` +
      `${result.reviewNeeded.length} review-needed = ${total} candidate(s) across ` +
      `${result.scannedVariants.length} variants`
    );

    process.exit(0);
  }
}

main().catch(err => {
  console.error('agent-similarity-analyzer error:', err);
  process.exit(1);
});
