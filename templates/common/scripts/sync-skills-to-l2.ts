#!/usr/bin/env bun
/**
 * sync-skills-to-l2.ts
 * Synchronizes explicitly requested skills or scripts from L1 (templates/common) to L2 variants.
 * @version 1.0.0
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isCheckDrift = args.includes('--check-drift');
const isApply = args.includes('--apply') && !isDryRun && !isCheckDrift;

const variantArg = args.find(a => a.startsWith('--variant='));
const skillArg = args.find(a => a.startsWith('--skill='));
const scriptArg = args.find(a => a.startsWith('--script='));

if (!variantArg && !isCheckDrift) {
  console.error("Usage: bun scripts/sync-skills-to-l2.ts [--variant=<co-*>] [--skill=<name>] [--script=<name>] [--dry-run|--check-drift|--apply]");
  process.exit(1);
}

const variants = variantArg ? [variantArg.split('=')[1]] : readdirSync('templates').filter(d => d.startsWith('co-'));

const l1SkillsDir = join('templates', 'common', 'skills');
const l1ScriptsDir = join('templates', 'common', 'scripts');

function sha256(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

interface Diff {
  type: 'skill' | 'script';
  name: string;
  variant: string;
  source: string;
  target: string;
  status: 'missing' | 'differs' | 'in-sync';
}

const diffs: Diff[] = [];

for (const variant of variants) {
  if (skillArg) {
    const skill = skillArg.split('=')[1];
    const srcDir = join(l1SkillsDir, skill);
    const tgtDir = join('templates', variant, 'skills', skill);
    
    if (existsSync(srcDir)) {
      const srcMd = join(srcDir, 'SKILL.md');
      const tgtMd = join(tgtDir, 'SKILL.md');
      
      let status: Diff['status'] = 'missing';
      if (existsSync(tgtMd)) {
        if (sha256(readFileSync(srcMd, 'utf-8')) === sha256(readFileSync(tgtMd, 'utf-8'))) {
          status = 'in-sync';
        } else {
          status = 'differs';
        }
      }
      diffs.push({ type: 'skill', name: skill, variant, source: srcMd, target: tgtMd, status });
    }
  }

  if (scriptArg) {
    const script = scriptArg.split('=')[1];
    const srcPath = join(l1ScriptsDir, script);
    const tgtPath = join('templates', variant, 'scripts', script);
    
    if (existsSync(srcPath)) {
      let status: Diff['status'] = 'missing';
      if (existsSync(tgtPath)) {
        if (sha256(readFileSync(srcPath, 'utf-8')) === sha256(readFileSync(tgtPath, 'utf-8'))) {
          status = 'in-sync';
        } else {
          status = 'differs';
        }
      }
      diffs.push({ type: 'script', name: script, variant, source: srcPath, target: tgtPath, status });
    }
  }
}

if (isCheckDrift || isDryRun || !isApply) {
  console.log(`\n=== L1 -> L2 Drift Report ===`);
  for (const d of diffs) {
    console.log(`[${d.variant}] ${d.type} ${d.name}: ${d.status}`);
  }
  
  if (isCheckDrift) {
    const outOfSync = diffs.filter(d => d.status !== 'in-sync');
    if (outOfSync.length > 0) {
      console.log(`\nFound ${outOfSync.length} out of sync files.`);
      process.exitCode = 1;
    }
  }
}

if (isApply) {
  console.log(`\n=== Applying Sync to L2 ===`);
  let synced = 0;
  for (const d of diffs) {
    if (d.status !== 'in-sync') {
      mkdirSync(dirname(d.target), { recursive: true });
      writeFileSync(d.target, readFileSync(d.source, 'utf-8'), 'utf-8');
      console.log(`✅ Synced ${d.type} ${d.name} to ${d.variant}`);
      synced++;
    }
  }
  console.log(`Synced ${synced} files.`);
}
