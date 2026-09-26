#!/usr/bin/env bun
// @version 1.1.0
// agent-promote.ts — ADR-0043 L1 promotion-candidate ANALYSIS (read-only).
// v1.1.0 (2026-09-26, T-20260926-020c): hasExtendsDeclaration recognizes the
//           live L2 stub format — frontmatter `extends: ../../common/agents/…`
//           — alongside the legacy `# @extends: l1/` line-0 comment. The old
//           test never matched the live format, so all 13 stubs were analyzed
//           as standalone bodies, inflating scanned/considered counts.
// v1.0.0 (2026-09-22): replaces the Wave 2b exit-1 stub with a working ANALYSIS
//           mode implementing the DETECTION half of ADR-0043's promotion gate
//           rule: for every agent name present in 3 or more templates/co-*/
//           agents/ files, compute pairwise Jaccard similarity on the combined
//           `## Role` + `## Responsibilities` section text and report the groups
//           where >= 80% similarity holds across >= 3 variants. Read-only
//           reporting only — the promotion ACTION stays human-initiated (ADR-0043
//           §4 gate; §5 Wave 2b); a future promotion flow would build on this.
//           The constitution's drift-reporting principle: an ADR rule deserves
//           real detection tooling, not a stub.
//
// Usage:
//   bun scripts/helpers/agent-promote.ts            # human-readable report
//   bun scripts/helpers/agent-promote.ts --json     # machine-readable JSON
//   bun scripts/helpers/agent-promote.ts --help
//
// See: docs/adr/0043-l1-agent-layer-hybrid-override.md (:30, :74)
// Sibling tooling: agent-similarity-analyzer.ts (Wave 2a full 6-section report).

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATES_DIR = join(WORKSPACE_ROOT, 'templates');

/** ADR-0043 §4: Jaccard similarity >= 80% across Role + Responsibilities. */
const SIMILARITY_THRESHOLD = 0.8;
/** ADR-0043 §4: 3 or more variants (= 50% of the original 6-variant roster). */
const MIN_VARIANTS = 3;

interface AgentInstance {
  variant: string;
  filePath: string;
  /** Combined `## Role` + `## Responsibilities` body text (may be empty). */
  roleText: string;
}

interface AgentPair {
  a: string;
  b: string;
  similarity: number;
}

interface PromotionCandidate {
  agent: string;
  variants: string[];
  minSimilarity: number;
  avgSimilarity: number;
  pairs: AgentPair[];
}

interface AnalysisResult {
  scannedVariants: string[];
  scannedAgentCount: number;
  /** Agent names present in >= MIN_VARIANTS variants (the analysis universe). */
  considered: Array<{ agent: string; variants: string[] }>;
  candidates: PromotionCandidate[];
}

// ── Section extraction ────────────────────────────────────────────────────────
// Real agent files come in two shapes (verified across templates/co-*/agents/):
// (a) canonical 7-section structure with `## Role` AND a separate `## Responsibilities`
//     (e.g. co-develop/agents/architect.md), and (b) legacy files where the
//     responsibilities bullets live INSIDE `## Role` as a "**Core Responsibilities:**"
//     list and no `## Responsibilities` heading exists (e.g. co-consult
//     change-management-partner). Extraction therefore concatenates both section
//     bodies when present and falls back to the first `## ` after the frontmatter
//     when `## Role` itself is absent. `###` subsections stay inside their parent
//     (bodies end at the next `## ` heading).

function stripFrontmatter(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.startsWith('---')) return normalized;
  const end = normalized.indexOf('\n---', 3);
  return end === -1 ? normalized : normalized.slice(normalized.indexOf('\n', end + 1) + 1);
}

/** Body of the named `## <title>` section (until the next `## ` heading), or ''. */
function extractH2Body(body: string, title: RegExp): string {
  const lines = body.split('\n');
  // T-20260922-030 fix: the heading line starts with "## ", so test the title
  // against the text AFTER the prefix — the old two-condition form
  // (/^##\s+/.test(l) && /^Role\s*$/.test(l)) was mutually exclusive and could
  // never match, silently reducing similarity to first-section-only.
  const start = lines.findIndex(l => {
    const m = l.match(/^##\s+(.*)$/);
    return m !== null && title.test(m[1]);
  });
  if (start === -1) return '';
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

function extractRoleResponsibilities(content: string): string {
  const body = stripFrontmatter(content);
  const role = extractH2Body(body, /^Role\s*$/);
  const responsibilities = extractH2Body(body, /^Responsibilities\s*$/);
  if (role || responsibilities) return `${role}\n${responsibilities}`.trim();
  // Fallback: first `## ` heading after the frontmatter, whatever it is titled.
  const lines = body.split('\n');
  const first = lines.findIndex(l => /^##\s+/.test(l));
  if (first === -1) return '';
  const out: string[] = [];
  for (let i = first + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

// ── Jaccard (same tokenization contract as agent-similarity-analyzer.ts) ──────

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  // Two empty extractions carry no similarity evidence — a perfect score here
  // produced false promotion candidates (T-20260922-030). Either side empty
  // → 0 (the empty-vs-empty case is subsumed).
  if (a.size === 0 || b.size === 0) return 0.0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

// ── Analysis ──────────────────────────────────────────────────────────────────

/** Standalone (non-`# @extends:`) specialist agent files of one variant. */
function discoverAgentFiles(variant: string): string[] {
  const agentsDir = join(TEMPLATES_DIR, variant, 'agents');
  let entries: string[];
  try {
    entries = readdirSync(agentsDir);
  } catch {
    return [];
  }
  return entries.filter(
    f =>
      f.endsWith('.md') &&
      !f.startsWith('README') &&
      !f.startsWith('_') &&
      f !== 'pm.md',
  ).map(f => join(agentsDir, f));
}

/**
 * True when the agent file already extends a common (L1) base — either the
 * live L2 stub frontmatter (`extends: ../../common/agents/…`, first line
 * `---`) or the legacy `# @extends: l1/…` first-line comment. Files that
 * already extend are excluded from promotion analysis: they are by-design
 * stubs, not duplicated bodies (T-20260926-020c).
 */
export function hasExtendsDeclaration(content: string): boolean {
  if (/^#\s*@extends:\s*l1\//i.test(content.split('\n')[0] ?? '')) return true;
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return fm !== null && /^\s*extends\s*:/m.test(fm[1]);
}

export function analyzeL1PromotionCandidates(): AnalysisResult {
  const variants = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^co-/.test(d.name))
    .map(d => d.name)
    .sort();

  // agent name → instances across variants
  const agentMap = new Map<string, AgentInstance[]>();
  let scannedAgentCount = 0;
  for (const variant of variants) {
    for (const filePath of discoverAgentFiles(variant)) {
      const content = readFileSync(filePath, 'utf8');
      if (hasExtendsDeclaration(content)) continue; // already L2-extends-L1
      const agent = filePath.split('/').pop()!.replace(/\.md$/, '');
      if (!agentMap.has(agent)) agentMap.set(agent, []);
      agentMap.get(agent)!.push({ variant, filePath, roleText: extractRoleResponsibilities(content) });
      scannedAgentCount++;
    }
  }

  const considered: Array<{ agent: string; variants: string[] }> = [];
  const candidates: PromotionCandidate[] = [];

  for (const [agent, instances] of agentMap.entries()) {
    if (instances.length < MIN_VARIANTS) continue;
    const instanceVariants = instances.map(i => i.variant);
    considered.push({ agent, variants: instanceVariants });

    const pairs: AgentPair[] = [];
    for (let i = 0; i < instances.length; i++) {
      for (let j = i + 1; j < instances.length; j++) {
        pairs.push({
          a: instances[i].variant,
          b: instances[j].variant,
          similarity: jaccard(tokenise(instances[i].roleText), tokenise(instances[j].roleText)),
        });
      }
    }
    const min = Math.min(...pairs.map(p => p.similarity));
    if (min >= SIMILARITY_THRESHOLD) {
      candidates.push({
        agent,
        variants: instanceVariants,
        minSimilarity: min,
        avgSimilarity: pairs.reduce((s, p) => s + p.similarity, 0) / pairs.length,
        pairs,
      });
    }
  }

  candidates.sort((x, y) => y.minSimilarity - x.minSimilarity);
  return { scannedVariants: variants, scannedAgentCount, considered, candidates };
}

// ── Output ────────────────────────────────────────────────────────────────────

function pct(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

function formatReport(result: AnalysisResult): string {
  const lines: string[] = [
    'agent-promote.ts — ADR-0043 L1 promotion-candidate analysis (READ-ONLY)',
    `Rule: agent present in >= ${MIN_VARIANTS} variants with pairwise Role+Responsibilities Jaccard >= ${pct(SIMILARITY_THRESHOLD)}`,
    `Scanned: ${result.scannedVariants.length} variants, ${result.scannedAgentCount} standalone agent files, ${result.considered.length} name(s) in >= ${MIN_VARIANTS} variants`,
    '',
  ];
  if (result.candidates.length === 0) {
    lines.push('No promotion candidates found (no group meets the threshold).');
  } else {
    lines.push(`PROMOTION CANDIDATES — ${result.candidates.length} found`, '');
    for (const c of result.candidates) {
      lines.push(`  ${c.agent} — ${c.variants.length} variants: ${c.variants.join(', ')}`);
      lines.push('    pairwise Jaccard (Role+Responsibilities):');
      for (const p of c.pairs) lines.push(`      ${p.a} <-> ${p.b}: ${pct(p.similarity)}`);
      lines.push(`    min ${pct(c.minSimilarity)}, avg ${pct(c.avgSimilarity)}`, '');
    }
  }
  lines.push('Analysis only — promotion remains human-initiated (ADR-0043 §4 gate). No files were modified.');
  return lines.join('\n');
}

function toJson(result: AnalysisResult): string {
  return JSON.stringify(
    {
      rule: 'adr-0043',
      minVariants: MIN_VARIANTS,
      similarityThreshold: SIMILARITY_THRESHOLD,
      scannedVariants: result.scannedVariants,
      scannedAgentCount: result.scannedAgentCount,
      considered: result.considered,
      candidates: result.candidates,
    },
    null,
    2,
  );
}

function printHelp(): void {
  console.log(`agent-promote.ts — ADR-0043 L1 promotion-candidate analysis (read-only)

Usage:
  bun scripts/helpers/agent-promote.ts [--json] [--help]

Options:
  --json    Emit the analysis as machine-readable JSON (candidates, pairs, variants).
  --help    Show this help.

Detects agent names present in >= ${MIN_VARIANTS} templates/co-*/agents/ files whose combined
'## Role' + '## Responsibilities' text reaches pairwise Jaccard similarity >= ${pct(SIMILARITY_THRESHOLD)}
across the group (ADR-0043 §4 promotion gate, detection half). Read-only: no
promotion is performed; see docs/adr/0043-l1-agent-layer-hybrid-override.md.`);
}

// ── CLI dispatch (import-safe: analysis functions are exported for tests) ─────

export { formatReport, toJson };

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
  } else {
    const result = analyzeL1PromotionCandidates();
    if (args.includes('--json')) {
      console.log(toJson(result));
    } else {
      console.log(formatReport(result));
    }
  }
}
