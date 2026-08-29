#!/usr/bin/env bun
/**
 * One-shot migration: derive typed `relates_to` for variant template skills
 * from Procedure Schema YAML (reledgev design, mass-adoption wave).
 *
 * Rules (conservative, deterministic):
 *  - Consecutive distinct steps (i -> i+1) in a procedure: earlier skill `follows` later skill.
 *  - Two skills co-used in the same procedure (non-consecutive): `composes_with`,
 *    declared once from the alphabetically-first skill (symmetric type).
 *  - Skip any skill that already has `relates_to` (e.g. co-consult pilot).
 *  - Same-variant targets only; each edge declared exactly once; self-reference impossible by construction.
 *
 * Run from workspace root: bun tests/add-variant-relations.ts [--dry]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { load as yamlLoad } from 'js-yaml';

const ROOT = cwd();
const DRY = process.argv.includes('--dry');
const templatesDir = join(ROOT, 'templates');

type Edge = { from: string; to: string; type: 'follows' | 'composes_with' };

function skillHasRelatesTo(path: string): boolean {
  return /^relates_to:/m.test(readFileSync(path, 'utf-8'));
}

function parseExistingRelations(raw: string): Array<{ skill: string; type: string }> {
  const lines = raw.match(/^---\n([\s\S]*?)\n---/)?.[1]?.split('\n') ?? [];
  const rels: Array<{ skill: string; type: string }> = [];
  let inField = false, pending: { skill: string } | null = null;
  for (const line of lines) {
    if (/^relates_to:\s*$/.test(line)) { inField = true; continue; }
    if (!inField) continue;
    if (/^\S/.test(line)) break;
    const sm = line.match(/^\s*-\s+skill:\s*(\S+)\s*$/);
    if (sm) { pending = { skill: sm[1] }; continue; }
    const tm = line.match(/^\s+type:\s*(\S+)\s*$/);
    if (tm && pending) { rels.push({ skill: pending.skill, type: tm[1] }); pending = null; }
  }
  return rels;
}

function upsertRelatesTo(path: string, rels: Array<{ skill: string; type: string }>): 'inserted' | 'appended' {
  let raw = readFileSync(path, 'utf-8').replace(/\r\n/g, '\n');
  const block = 'relates_to:\n' + rels.map(r => `  - skill: ${r.skill}\n    type: ${r.type}`).join('\n') + '\n';
  if (/^relates_to:/m.test(raw)) {
    // Append missing entries to the existing typed block (keep declared edges intact)
    const existing = parseExistingRelations(raw);
    const missing = rels.filter(r => !existing.some(e => e.skill === r.skill && e.type === r.type));
    if (missing.length === 0) return 'appended'; // nothing new; caller treats as skip
    const add = missing.map(r => `  - skill: ${r.skill}\n    type: ${r.type}`).join('\n') + '\n';
    let last = -1;
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/^relates_to:/.test(lines[i])) {
        last = i;
        let j = i + 1;
        while (j < lines.length && /^\s+(\S|$)/.test(lines[j]) && !/^\S/.test(lines[j])) { if (/^\s*-\s+skill:/.test(lines[j])) last = j; if (/^\s+type:/.test(lines[j])) last = j; j++; }
        break;
      }
    }
    lines.splice(last + 1, 0, ...add.trimEnd().split('\n'));
    writeFileSync(path, lines.join('\n'));
    return 'appended';
  }
  if (/^prerequisites:.*$/m.test(raw)) {
    raw = raw.replace(/^(prerequisites:.*\n)/m, `$1${block}`);
  } else if (/^metadata:/m.test(raw)) {
    raw = raw.replace(/^(metadata:)/m, `${block}$1`);
  } else {
    raw = raw.replace(/^---\n/, `---\n${block}`);
  }
  writeFileSync(path, raw);
  return 'inserted';
}

let totalSkills = 0, totalEdges = 0, skipped = 0;

for (const dirent of readdirSync(templatesDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  const variant = dirent.name;
  if (!dirent.isDirectory() || variant === 'common') continue;
  const procDir = join(templatesDir, variant, 'procedures');
  const skillsDir = join(templatesDir, variant, 'skills');
  if (!existsSync(procDir) || !existsSync(skillsDir)) continue;

  const edgeMap = new Map<string, Edge>();
  for (const proc of readdirSync(procDir, { withFileTypes: true })) {
    const schemaPath = join(procDir, proc.name, 'schema.yaml');
    if (!proc.isDirectory() || !existsSync(schemaPath)) continue;
    const y = yamlLoad(readFileSync(schemaPath, 'utf-8')) as any;
    const steps: Array<{ skill_key?: string }> = y?.steps ?? [];
    const seq = steps.map(s => s.skill_key).filter((s): s is string => !!s);
    for (let i = 0; i < seq.length; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        if (seq[i] === seq[j]) continue;
        const key = `${seq[i]}->${seq[j]}`;
        if (edgeMap.has(key)) continue;
        edgeMap.set(key, { from: seq[i], to: seq[j], type: j === i + 1 ? 'follows' : 'composes_with' });
      }
    }
  }

  // Group edges by source skill; skip skills that already declare relations
  const bySource = new Map<string, Array<{ skill: string; type: string }>>();
  for (const e of edgeMap.values()) {
    if (e.type === 'follows') {
      if (!bySource.has(e.from)) bySource.set(e.from, []);
      bySource.get(e.from)!.push({ skill: e.to, type: 'follows' });
      // composes_with is symmetric: only declare once, from the alphabetically-first
    } else {
      const [a, b] = [e.from, e.to].sort();
      const src = a === e.from ? e.from : e.to;
      const dst = src === a ? b : a;
      if (!bySource.has(src)) bySource.set(src, []);
      bySource.get(src)!.push({ skill: dst, type: 'composes_with' });
    }
  }

  let variantSkills = 0, variantEdges = 0;
  for (const [skill, relsIn] of [...bySource.entries()].sort()) {
    let rels = relsIn;
    // Sources are variant-local skills ONLY — never write variant-specific edges
    // into L1 common skills (relations flow variant skill -> L1/variant targets).
    const path = join(skillsDir, skill, 'SKILL.md');
    if (!existsSync(path)) { skipped++; continue; }
    if (skillHasRelatesTo(path)) {
      const existing = parseExistingRelations(readFileSync(path, 'utf-8'));
      const missing = rels.filter(r => !existing.some(e => e.skill === r.skill && e.type === r.type));
      if (missing.length === 0) { skipped++; continue; }
      rels = missing; // append only the new edges, keep declared ones
    }
    variantSkills++; variantEdges += rels.length;
    if (!DRY) upsertRelatesTo(path, rels);
    if (!DRY) console.log(`  ${variant}/${skill}: ${rels.map(r => `${r.type} ${r.skill}`).join(', ')}`);
  }
  totalSkills += variantSkills; totalEdges += variantEdges;
  console.log(`${variant}: ${variantSkills} skills updated, ${variantEdges} edges`);
}

console.log(`\nTOTAL: ${totalSkills} skills, ${totalEdges} edges, ${skipped} skipped (already had relates_to)${DRY ? ' [DRY RUN]' : ''}`);
