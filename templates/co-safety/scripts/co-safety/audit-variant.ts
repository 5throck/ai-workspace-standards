// @version 1.3.0
// v1.3.0 (2026-10-29, U-20261028-016): gate 3 — workflow run-record validation.
//           memory/workflows/ records (the completion records the
//           safety-workflow-manager agent spec mandates at .md paths
//           YYYY-MM-DD-<workflow-id>.md) are validated against
//           docs/workflow-run-record.schema.md when present; an absent dir or
//           zero records is an explicit "0 workflow runs recorded" INFO (an
//           unused Safety OS is a valid state, not noise), a malformed record
//           FAILs naming file + field. Dependency-free frontmatter parser.
// v1.2.0 (2026-10-29, U-20261028-017): gate 0 parses variant.json →
//           skill_manifest.variant_specific (the previous top-level raw.skills
//           key does not exist in this variant, so the gate was a silent
//           no-op), guards JSON.parse, and checks the derived normalized path
//           skills/<name>/SKILL.md.
// Variant-specific audit hook for Safety OS (co-safety).
// Invoked by core scripts/audit.ts (pluggable variant audit hook, ADR-0044) so the
// CSO legal_basis gate and domain test suite run on every /sync, not only at the
// next workspace audit. Replaces the variant-specific logic formerly embedded in
// scripts/audit.ts v2.6.5 and scripts/dev-sync.ts v1.5.0 (removed 2026-08-26 when
// both core scripts were refreshed to immutable L1 copies).
import * as fs from 'node:fs';
import { $ } from 'bun';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function fail(message: string): never {
    console.error(`${RED}✗ ${message}${RESET}`);
    process.exit(1);
}

// 0. variant.json skill manifest file-resolution gate (U-20261028-017).
//    The manifest surface is variant.json → skill_manifest.variant_specific —
//    the previous parse read a top-level raw.skills key that does not exist in
//    this variant, making the gate a silent no-op ("0 skill(s)"). Each
//    variant_specific entry carries name (no file field), so the resolved
//    path is derived as skills/<name>/SKILL.md and checked normalized.
if (fs.existsSync('variant.json')) {
    let raw: { skill_manifest?: { variant_specific?: Array<{ name?: string }> } };
    try {
        raw = JSON.parse(fs.readFileSync('variant.json', 'utf-8'));
    } catch (e) {
        fail(`variant.json is not valid JSON: ${e instanceof Error ? e.message : e}`);
    }
    const skills = Array.isArray(raw?.skill_manifest?.variant_specific)
        ? raw.skill_manifest.variant_specific
        : [];
    for (const skill of skills) {
        if (!skill?.name) {
            fail(`variant.json skill_manifest.variant_specific entry must include name: ${JSON.stringify(skill)}`);
        }
        const normalized = `skills/${skill.name}/SKILL.md`.replace(/\\/g, '/');
        if (!fs.existsSync(normalized)) {
            fail(`variant.json skill "${skill.name}" file does not exist: ${normalized}`);
        }
    }
    console.log(`${GREEN}✓ variant.json skill_manifest.variant_specific references resolved (${skills.length} skill(s))${RESET}`);
}

// 1. Safety OS CSO gate: legal_basis >= 3 on workflows/evidence-models
if (fs.existsSync('variant.json') && fs.existsSync('scripts/co-safety/safety-audit.ts')) {
    const res = await $`bun scripts/co-safety/safety-audit.ts`.nothrow();
    if (res.exitCode !== 0) {
        fail(`Safety OS audit detected issues (run 'bun scripts/co-safety/safety-audit.ts' to see details)`);
    }
    console.log(`${GREEN}✓ Safety OS audit: legal_basis and domain checks passed${RESET}`);
}

// 2. Domain-specific test suites (variant only, run when present)
const testScripts = [
    'scripts/co-safety/test-pharma-general-profile.ts',
    'scripts/co-safety/test-chemical-handling-profile.ts',
    'scripts/co-safety/test-cross-domain-integration.ts',
    'scripts/co-safety/test-domain-scenarios.ts',
    'scripts/co-safety/test-runtime-tools.ts',
];
for (const testScript of testScripts) {
    if (fs.existsSync(testScript)) {
        const testRes = await $`bun ${testScript}`.nothrow();
        if (testRes.exitCode !== 0) {
            fail(`${testScript} failed`);
        }
    }
}

// 3. Workflow run-record validation (U-20261028-016).
//    The safety-workflow-manager agent spec mandates a completion record at
//    memory/workflows/YYYY-MM-DD-<workflow-id>.md for every executed workflow;
//    docs/workflow-run-record.schema.md defines the required fields and this
//    gate enforces them when records exist. An absent dir / zero records is a
//    valid initial state — an explicit green INFO, never a bare empty-dir flag.
const RUNS_DIR = 'memory/workflows';
const SCHEMA_DOC = 'docs/workflow-run-record.schema.md';
const REQUIRED_STRING_FIELDS = ['workflow_id', 'dispatched_by', 'outcome', 'sign_off'] as const;
const REQUIRED_ARRAY_FIELDS = ['agents', 'legal_basis', 'evidence'] as const;

// Dependency-free YAML frontmatter parse: opening `---` on line 1, flat
// `key: value` lines and `key:` followed by `  - item` list entries, closing
// `---`. Anything richer (nested maps, flow collections, anchors) is rejected
// with a named line error — the schema needs no deeper YAML.
function parseFrontmatter(text: string): { data: Record<string, string | string[]> } | { error: string } {
    const lines = text.split('\n');
    if ((lines[0] ?? '').trim() !== '---') {
        return { error: 'record must start with a YAML frontmatter block (--- on line 1)' };
    }
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            end = i;
            break;
        }
    }
    if (end < 0) return { error: 'frontmatter block not closed (missing closing ---)' };
    const data: Record<string, string | string[]> = {};
    let currentKey: string | null = null;
    for (let i = 1; i < end; i++) {
        const raw = lines[i];
        if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
        const listItem = raw.match(/^\s+-\s+(.*)$/);
        if (listItem) {
            if (!currentKey || !Array.isArray(data[currentKey])) {
                return { error: `line ${i + 1}: list item outside a "key:" list` };
            }
            (data[currentKey] as string[]).push(listItem[1].trim().replace(/^["']|["']$/g, ''));
            continue;
        }
        if (/^\s/.test(raw)) {
            return { error: `line ${i + 1}: unexpected indented line (only "- item" list entries under a key are supported)` };
        }
        const kv = raw.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
        if (!kv) return { error: `line ${i + 1}: not a "key: value" line` };
        currentKey = kv[1];
        const value = kv[2].trim();
        data[currentKey] = value === '' ? [] : value.replace(/^["']|["']$/g, '');
    }
    return { data };
}

const runRecords = fs.existsSync(RUNS_DIR)
    ? fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith('.md')).sort()
    : [];
if (runRecords.length === 0) {
    console.log(`${GREEN}✓ ${RUNS_DIR}/: 0 workflow runs recorded (records land here as workflows are executed — schema: ${SCHEMA_DOC})${RESET}`);
} else {
    for (const file of runRecords) {
        const p = `${RUNS_DIR}/${file}`;
        if (!/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(file)) {
            fail(`${p}: filename must match YYYY-MM-DD-<workflow-id>.md (schema: ${SCHEMA_DOC})`);
        }
        let parsed: { data: Record<string, string | string[]> } | { error: string };
        try {
            parsed = parseFrontmatter(fs.readFileSync(p, 'utf-8'));
        } catch (e) {
            fail(`${p}: unreadable (${e instanceof Error ? e.message : e})`);
        }
        if ('error' in parsed) fail(`${p}: ${parsed.error}`);
        const fm = parsed.data;
        for (const k of REQUIRED_STRING_FIELDS) {
            const v = fm[k];
            if (typeof v !== 'string' || v.trim() === '') {
                fail(`${p}: required frontmatter field "${k}" is missing or empty (schema: ${SCHEMA_DOC})`);
            }
        }
        const date = fm.date;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            fail(`${p}: required frontmatter field "date" must be YYYY-MM-DD (schema: ${SCHEMA_DOC})`);
        }
        if (date !== file.slice(0, 10)) {
            fail(`${p}: frontmatter date "${date}" does not match the filename date prefix "${file.slice(0, 10)}"`);
        }
        for (const k of REQUIRED_ARRAY_FIELDS) {
            const v = fm[k];
            if (!Array.isArray(v) || v.length === 0 || !v.every((x) => typeof x === 'string' && x.trim() !== '')) {
                fail(`${p}: required frontmatter field "${k}" must be a non-empty list (schema: ${SCHEMA_DOC})`);
            }
        }
    }
    console.log(`${GREEN}✓ ${RUNS_DIR}/: ${runRecords.length} workflow run record(s) validated against ${SCHEMA_DOC}${RESET}`);
}

console.log(`${GREEN}✓ All variant-specific audit checks passed${RESET}`);
