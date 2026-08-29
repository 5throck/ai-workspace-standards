#!/usr/bin/env bun
/**
 * procedure-coverage.ts — Coverage engine for Procedure Schema v1.0.
 *
 * Checks two conceptually separate coverage areas with one tool:
 *
 * 1. Variant Coverage — per (agent_key, phase) pairs derived from each
 *    variant agent's frontmatter `phases:`, satisfied only by actual
 *    procedure steps (a procedure's top-level `phase` attributes all of its
 *    steps). Gap = RequiredCoverage − CoveredByProcedure.
 * 2. L0 Lifecycle Coverage — the five workspace-root lifecycle procedures
 *    exist (status active) and their typed relation chain resolves.
 *
 * Normative rules (docs/designs/2026-08-29-procedure-coverage-and-l0-design.md §2):
 * - Gaps are HUMAN judgment targets (PROCEDURE_REQUIRED vs N/A_JUSTIFIED) —
 *   this script never generates procedures.
 * - `--tickets` is idempotent via deterministic
 *   `coverage_key: <variant>:<agent_key>:<phase>` (l0: `l0:<procedure_id>`);
 *   a ticket with the same coverage_key is skipped.
 *
 * @usage bun scripts/procedure-coverage.ts [--variant <name>] [--tickets] [--json]
 * @version 1.0.0
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';
import { createTicket, listTickets } from './helpers/ticket-store.ts';
import { parseFrontmatter } from './generate-skill-graph.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const L0_LIFECYCLE_PROCEDURES = [
  'create-variant',
  'promote-variant',
  'project-to-variant',
  'upgrade-project',
  'de-commonization-review',
];

interface Gap {
  coverageKey: string;
  variant: string;
  agentKey: string;
  phase: number;
}

interface CoverageRow {
  agentKey: string;
  phase: number;
  covering: string[];
  pmExempt: boolean;
}

interface VariantCoverage {
  variant: string;
  rows: CoverageRow[];
  gaps: Gap[];
}

function listProcedureFiles(dir: string): Array<{ name: string; path: string }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => ({ name: e.name, path: join(dir, e.name, 'schema.yaml') }))
    .filter((f) => existsSync(f.path))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function loadProcedure(path: string): any | null {
  try {
    const data = yamlLoad(readFileSync(path, 'utf-8'));
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** Variant Coverage for one co-* variant. */
function coverageForVariant(root: string, variant: string): VariantCoverage {
  const agentsDir = join(root, 'templates', variant, 'agents');
  const required: Array<{ agentKey: string; phase: number }> = [];
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir).sort()) {
      if (!f.endsWith('.md') || f === 'handoff-spec.md' || f.startsWith('_')) continue;
      const fm = parseFrontmatter(readFileSync(join(agentsDir, f), 'utf-8'));
      const phases = fm?.phases;
      if (!Array.isArray(phases)) continue;
      const agentKey = f.replace(/\.md$/, '');
      for (const p of phases) {
        if (Number.isInteger(p) && p >= 0 && p <= 6) {
          required.push({ agentKey, phase: p });
        }
      }
    }
  }

  // Covered pairs: (step.agent_key, procedure.phase), ≥1 step suffices.
  const covered = new Map<string, Set<string>>(); // pair key -> procedure names
  const procDir = join(root, 'templates', variant, 'procedures');
  for (const { name, path } of listProcedureFiles(procDir)) {
    const data = loadProcedure(path);
    if (!data || !Array.isArray(data.steps)) continue;
    const phase = Number(data.phase);
    if (!Number.isInteger(phase)) continue;
    for (const step of data.steps) {
      if (!step || typeof step !== 'object' || typeof step.agent_key !== 'string') continue;
      const key = `${step.agent_key}|${phase}`;
      if (!covered.has(key)) covered.set(key, new Set());
      covered.get(key)!.add(name);
    }
  }

  const rows: CoverageRow[] = [];
  const gaps: Gap[] = [];
  const seen = new Set<string>();
  for (const { agentKey, phase } of required.sort((a, b) =>
    a.agentKey.localeCompare(b.agentKey) || a.phase - b.phase,
  )) {
    const key = `${agentKey}|${phase}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const pmExempt = agentKey === 'pm';
    const covering = [...(covered.get(key) ?? new Set<string>())].sort();
    rows.push({ agentKey, phase, covering, pmExempt });
    if (covering.length === 0 && !pmExempt) {
      gaps.push({
        coverageKey: `${variant}:${agentKey}:${phase}`,
        variant,
        agentKey,
        phase,
      });
    }
  }

  return { variant, rows, gaps };
}

/** L0 Lifecycle Coverage: the five lifecycle procedures + relation chain. */
function l0Coverage(root: string): { rows: CoverageRow[]; gaps: Gap[]; relationIssues: string[] } {
  const procDir = join(root, 'procedures');
  const rows: CoverageRow[] = [];
  const gaps: Gap[] = [];
  const existing = new Set<string>();
  const statuses = new Map<string, string>();

  for (const name of L0_LIFECYCLE_PROCEDURES) {
    const path = join(procDir, name, 'schema.yaml');
    if (!existsSync(path)) {
      gaps.push({ coverageKey: `l0:l0-${name}`, variant: 'l0', agentKey: `(procedure) l0-${name}`, phase: -1 });
      rows.push({ agentKey: `l0-${name}`, phase: -1, covering: [], pmExempt: false });
      continue;
    }
    const data = loadProcedure(path);
    const status = typeof data?.status === 'string' ? data.status : 'unknown';
    statuses.set(name, status);
    existing.add(name);
    rows.push({ agentKey: `l0-${name}`, phase: -1, covering: [status === 'active' ? '✓ active' : `⚠ ${status}`], pmExempt: false });
    if (status !== 'active') {
      gaps.push({ coverageKey: `l0:l0-${name}`, variant: 'l0', agentKey: `(procedure) l0-${name}`, phase: -1 });
    }
  }

  const relationIssues: string[] = [];
  for (const { name, path } of listProcedureFiles(procDir)) {
    const data = loadProcedure(path);
    if (!data || !Array.isArray(data.relations)) continue;
    for (const rel of data.relations) {
      const m = rel && typeof rel === 'object' ? /^procedure\.l0\.([a-z0-9-]+)$/.exec(String(rel.target)) : null;
      if (!m) continue;
      const targetName = m[1];
      if (!existing.has(targetName) || statuses.get(targetName) !== 'active') {
        relationIssues.push(`l0-${name} --${rel.type}--> l0-${targetName}: target missing or not active`);
      }
    }
  }

  return { rows, gaps, relationIssues };
}

function createGapTickets(root: string, gaps: Gap[]): { created: string[]; skipped: number } {
  const governanceDir = join(root, 'tickets', 'governance');
  const existingTickets = [...listTickets(governanceDir, { kind: 'manual' }), ...listTickets(join(root, 'tickets'), { kind: 'manual' })];
  const existingKeys = new Set(
    existingTickets.map((t) => (t.inputs && typeof t.inputs === 'object' ? (t.inputs as Record<string, string>).coverage_key : undefined)).filter(Boolean),
  );

  const created: string[] = [];
  let skipped = 0;
  for (const gap of gaps) {
    if (existingKeys.has(gap.coverageKey)) {
      skipped++;
      continue;
    }
    const isL0 = gap.variant === 'l0';
    const ticket = createTicket(governanceDir, {
      kind: 'manual',
      title: isL0
        ? `Coverage gap: ${gap.agentKey} (procedure missing or inactive)`
        : `Coverage gap: ${gap.variant} / ${gap.agentKey} @ phase ${gap.phase}`,
      priority: 'normal',
      inputs: {
        source: 'procedure-coverage',
        coverage_key: gap.coverageKey,
        variant: gap.variant,
        agent_key: gap.agentKey,
        phase: String(gap.phase),
        resolution: 'PROCEDURE_REQUIRED or N/A_JUSTIFIED (human judgment — see docs/designs/2026-08-29-procedure-coverage-and-l0-design.md §2)',
      },
    });
    created.push(ticket.id);
  }
  return { created, skipped };
}

function main(): void {
  const args = process.argv.slice(2);
  let onlyVariant: string | undefined;
  let tickets = false;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--variant') onlyVariant = args[++i];
    else if (args[i] === '--tickets') tickets = true;
    else if (args[i] === '--json') json = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: bun scripts/procedure-coverage.ts [--variant <name>] [--tickets] [--json]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(2);
    }
  }

  const variants = readdirSync(join(ROOT, 'templates'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('co-'))
    .map((e) => e.name)
    .sort();
  const scoped = onlyVariant && onlyVariant !== 'l0' ? variants.filter((v) => v === onlyVariant) : variants;

  const results: VariantCoverage[] = scoped.map((v) => coverageForVariant(ROOT, v));
  const l0 = onlyVariant && onlyVariant !== 'l0' ? null : l0Coverage(ROOT);
  const allGaps: Gap[] = [...results.flatMap((r) => r.gaps), ...(l0?.gaps ?? [])];

  if (json) {
    console.log(JSON.stringify({ variants: results, l0, gaps: allGaps }, null, 2));
  } else {
    for (const r of results) {
      console.log(`\n## ${r.variant}`);
      console.log('Agent | Phase | Covering procedure(s) | Covered');
      console.log('------|-------|----------------------|--------');
      for (const row of r.rows) {
        const coveredMark = row.covering.length > 0 ? '✓' : row.pmExempt ? '– (pm exempt)' : '✗';
        console.log(`${row.agentKey} | ${row.phase} | ${row.covering.join(', ') || '—'} | ${coveredMark}`);
      }
      console.log(`  gaps: ${r.gaps.length}`);
    }
    if (l0) {
      console.log('\n## L0 Lifecycle Coverage');
      for (const row of l0.rows) {
        console.log(`  ${row.agentKey}: ${row.covering.join(', ') || 'MISSING'}`);
      }
      for (const issue of l0.relationIssues) {
        console.log(`  relation issue: ${issue}`);
      }
      console.log(`  gaps: ${l0.gaps.length}`);
    }
  }

  if (tickets) {
    const { created, skipped } = createGapTickets(ROOT, allGaps);
    if (!json) {
      console.log(`\nTickets: ${created.length} created, ${skipped} skipped (coverage_key already present)`);
      for (const id of created) console.log(`  + ${id}`);
    }
  } else if (allGaps.length > 0 && !json) {
    console.log(`\n${allGaps.length} coverage gap(s). Each is a HUMAN judgment target:`);
    console.log('  PROCEDURE_REQUIRED → author a workflow-shaped procedure, or');
    console.log('  N/A_JUSTIFIED      → record rationale in a governance ticket.');
    console.log('Run with --tickets to register them (idempotent by coverage_key).');
  }

  process.exit(0);
}

if (import.meta.main) main();
