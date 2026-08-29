#!/usr/bin/env bun
/**
 * Decision Record Chain Validator (ADR-0061)
 * @version 1.0.0
 */
// Fail-closed validation of docs/decisions/DEC-*.md against the decision chain:
// Decision -> Evidence (ledger) -> Knowledge (files) -> Rules (variant registries)
// -> Skills (known skills) -> Agent.
//
// Complements (does not replace) the warn-only soft-check in audit.ts.
//
// Usage:
//   bun scripts/validate-decisions.ts
//   bun scripts/validate-decisions.ts --json

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { load as yamlLoad } from 'js-yaml';

interface ValidationIssue {
  level: 'error' | 'warning';
  file: string;
  check: string;
  message: string;
  fix?: string;
}

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const ROOT = cwd();
const DECISIONS_DIR = join(ROOT, 'docs', 'decisions');
const LEDGER_PATH = join(ROOT, 'docs', 'evidence', 'ledger.md');

const REQUIRED_FIELDS = ['id', 'date', 'agent', 'decision', 'alternatives', 'status'];
const STATUS_VOCABULARY = ['proposed', 'accepted', 'superseded'];
const RULE_ID_PATTERN = /^[A-Z0-9]+-R\d+$/;

const JSON_MODE = process.argv.slice(2).includes('--json');
const issues: ValidationIssue[] = [];

function fail(file: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'error', file, check, message: msg, fix });
  if (!JSON_MODE) console.log(`${colors.red}❌${colors.reset} ${msg}`);
}
function warn(file: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'warning', file, check, message: msg, fix });
  if (!JSON_MODE) console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`);
}
function pass(msg: string) {
  if (!JSON_MODE) console.log(`${colors.green}✅${colors.reset} ${msg}`);
}

function normalizeContent(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// js-yaml first; the two 08-25-era records contain plain scalars with unescaped
// ": " prose that strict YAML rejects — fall back to a line-based key extractor
// (same tolerance pattern as the graph generator's parseFrontmatter()).
function parseDecisionFrontmatter(raw: string): Record<string, any> | null {
  const content = normalizeContent(raw);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yamlText = match[1];
  try {
    return yamlLoad(yamlText) as Record<string, any>;
  } catch {
    const fields: Record<string, any> = {};
    for (const line of yamlText.split('\n')) {
      const m = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
      if (!m) continue;
      const [, key, value] = m;
      if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        fields[key] = inner === '' ? [] : inner.split(',').map(s => s.trim());
      } else {
        fields[key] = value;
      }
    }
    return fields;
  }
}

function parseInlineArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    const v = value.trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      const inner = v.slice(1, -1).trim();
      return inner === '' ? [] : inner.split(',').map(s => s.trim());
    }
    return v === '' ? [] : [v];
  }
  return [];
}

function collectLedgerIds(): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(LEDGER_PATH)) return ids;
  for (const line of normalizeContent(readFileSync(LEDGER_PATH, 'utf-8')).split('\n')) {
    const m = line.match(/^\|\s*(EV-\d{8}-\d{2,3})\s*\|/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

function collectKnownSkills(): Set<string> {
  const names = new Set<string>();
  const addFrom = (base: string) => {
    if (!existsSync(base)) return;
    for (const dirent of readdirSync(base, { withFileTypes: true })) {
      if (dirent.isDirectory() && existsSync(join(base, dirent.name, 'SKILL.md'))) {
        names.add(dirent.name);
      }
    }
  };
  addFrom(join(ROOT, 'skills'));
  const templatesDir = join(ROOT, 'templates');
  if (existsSync(templatesDir)) {
    for (const dirent of readdirSync(templatesDir, { withFileTypes: true })) {
      if (dirent.isDirectory()) addFrom(join(templatesDir, dirent.name, 'skills'));
    }
  }
  return names;
}

function validateDecisions(): void {
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Decision Record Validation (docs/decisions/DEC-*.md)${colors.reset}`);

  if (!existsSync(DECISIONS_DIR)) {
    warn('docs/decisions', 'directory-not-found', 'docs/decisions/ not found — nothing to validate (ADR-0061 chain not yet adopted)');
    return;
  }

  const ledgerIds = collectLedgerIds();
  if (ledgerIds.size === 0) {
    warn('docs/evidence/ledger.md', 'ledger-empty', 'Evidence ledger missing or has no EV-* rows — every evidence_refs entry will fail', 'Add rows to docs/evidence/ledger.md');
  }
  const knownSkills = collectKnownSkills();

  const files = readdirSync(DECISIONS_DIR).filter(f => /^DEC-\d{8}-\d{2}\.md$/.test(f)).sort();
  if (files.length === 0) {
    warn('docs/decisions', 'no-records', 'No DEC-YYYYMMDD-NN.md records found');
    return;
  }

  for (const file of files) {
    const raw = readFileSync(join(DECISIONS_DIR, file), 'utf-8');
    const fm = parseDecisionFrontmatter(raw);
    if (!fm) {
      fail(file, 'frontmatter-missing', `${file}: no ---/--- frontmatter block`, 'Add ADR-0061 frontmatter');
      continue;
    }
    const stem = file.replace(/\.md$/, '');
    let fileErrors = 0;

    for (const field of REQUIRED_FIELDS) {
      if (fm[field] === undefined || fm[field] === null || fm[field] === '') {
        fail(file, 'field-missing', `${file}: missing required frontmatter field "${field}"`, `Add ${field} per ADR-0061`);
        fileErrors++;
      }
    }

    if (fm.id && fm.id !== stem) {
      fail(file, 'id-mismatch', `${file}: frontmatter id "${fm.id}" does not match filename stem "${stem}"`, 'Align the id with the filename');
      fileErrors++;
    }
    if (fm.status && !STATUS_VOCABULARY.includes(fm.status)) {
      fail(file, 'status-invalid', `${file}: status "${fm.status}" not in ${STATUS_VOCABULARY.join(', ')}`, undefined);
      fileErrors++;
    }

    const evidenceRefs = parseInlineArray(fm.evidence_refs);
    for (const ref of evidenceRefs) {
      if (!ledgerIds.has(ref)) {
        fail(file, 'evidence-unknown', `${file}: evidence_refs entry "${ref}" not found in docs/evidence/ledger.md`, 'Add the evidence row to the ledger or fix the ID');
        fileErrors++;
      }
    }

    const knowledgeRefs = parseInlineArray(fm.knowledge_refs);
    for (const ref of knowledgeRefs) {
      if (!existsSync(join(ROOT, ref))) {
        fail(file, 'knowledge-missing', `${file}: knowledge_refs path "${ref}" does not exist`, 'Fix the path or restore the referenced file');
        fileErrors++;
      }
    }

    const rulesApplied = parseInlineArray(fm.rules_applied);
    for (const rule of rulesApplied) {
      if (!RULE_ID_PATTERN.test(rule)) {
        fail(file, 'rule-id-format', `${file}: rules_applied entry "${rule}" does not match <PREFIX>-R<N>`, 'Use the variant rule-ID registry convention (e.g. NEWS-R1)');
        fileErrors++;
      }
    }

    const skillsUsed = parseInlineArray(fm.skills_used);
    for (const skill of skillsUsed) {
      if (!knownSkills.has(skill)) {
        warn(file, 'skill-unknown', `${file}: skills_used entry "${skill}" does not resolve to a known skill (variant-scoped skills are tolerated)`);
      }
    }

    if (evidenceRefs.length === 0 && rulesApplied.length === 0 && skillsUsed.length === 0) {
      warn(file, 'chain-empty', `${file}: no evidence_refs, rules_applied, or skills_used — decision chain is empty (allowed but discouraged)`);
    }

    if (fileErrors === 0) pass(`${file}: valid`);
  }
}

function main() {
  if (!JSON_MODE) {
    console.log(`${colors.cyan}🔍 Validating decision records (ADR-0061)...${colors.reset}`);
    console.log(`${colors.dim}Root: ${ROOT}${colors.reset}`);
  }
  validateDecisions();

  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  if (JSON_MODE) {
    console.log(JSON.stringify({ errors, warnings, summary: `${errors.length} error(s), ${warnings.length} warning(s)` }, null, 2));
  } else {
    console.log(`\n${colors.dim}${'─'.repeat(50)}${colors.reset}`);
    console.log(`${colors.cyan}📊 Validation Summary:${colors.reset}`);
    console.log(`   ${colors.red}Errors: ${errors.length}${colors.reset}`);
    console.log(`   ${colors.yellow}Warnings: ${warnings.length}${colors.reset}`);
    if (errors.length > 0) {
      console.log(`\n${colors.red}❌ Validation failed with ${errors.length} error(s)${colors.reset}`);
    } else {
      console.log(`\n${colors.green}✅ All decision records valid${colors.reset}`);
    }
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
