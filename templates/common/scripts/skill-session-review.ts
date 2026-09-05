// @version 1.0.0
// feat(skills): session-evidence skill review loop (SkillHone-inspired).
// Design doc: docs/designs/2026-09-06-skill-session-review-design.md
//
// Parses the `## Skills Used` structured evidence in memory/YYYY-MM-DD.md plus
// git skill-file changes, then generates Observed Symptom + Evidence records
// to memory/skill-review/YYYY-MM-DD.md. Diagnosis / candidate blocks are left
// EMPTY — they are filled at human triage time (PM / lifecycle-manager).
// This script never modifies skills; it accumulates evidence only.
//
// Also performs structural checks on skills modified this session:
//   - SKILL.md version vs docs/VERSION_MANIFEST.md
//   - governance record (docs/lifecycle/skills/<name>.md) Changelog touched
//   - description-vs-triggers keyword consistency
//   - re-runs skill-dependency-analysis.ts --skill <name> per touched skill
//
// Usage:
//   bun scripts/skill-session-review.ts                    # today
//   bun scripts/skill-session-review.ts --date 2026-09-06
//   bun scripts/skill-session-review.ts --json             # machine-readable
//   bun scripts/skill-session-review.ts --dry-run          # no file writes
//
// Exit codes: 0 always for evidence-accumulation issues (WARN-only by design,
// ADR-0055 WARN-first playbook); 1 on internal errors only.
import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';

const VERSION = '1.0.0';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const DRY_RUN = args.includes('--dry-run');
const dateArgIdx = args.indexOf('--date');
const date = dateArgIdx !== -1 && args[dateArgIdx + 1]
    ? args[dateArgIdx + 1]
    : (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

const USAGES = new Set(['primary', 'supporting']);
const OUTCOMES = new Set(['completed', 'partial', 'failed', 'abandoned']);
const SYMPTOM_TYPES = new Set([
    'description_trigger_mismatch',
    'missing_procedure',
    'repeated_manual_intervention',
    'outcome_failure',
]);

interface SkillEvidence {
    skill: string;
    usage: string | null;
    outcome: string | null;
    observations: string[];
    schemaWarnings: string[];
}

interface ReviewRecord {
    skill: string;
    observed_symptom: { type: string; description: string };
    evidence: { sessions: number; occurrences: number; sessions_list: string[] };
    diagnosis: { likely_cause: string };
    candidate: {
        priority: string; confidence: string;
        suggested_action: string; status: string;
    };
}

function localSkillNames(): Set<string> {
    const names = new Set<string>();
    for (const dir of ['skills', path.join('.agents', 'skills')]) {
        const p = path.join(import.meta.dir, '..', dir);
        if (!fs.existsSync(p)) continue;
        for (const e of fs.readdirSync(p, { withFileTypes: true })) {
            if (e.isDirectory() && fs.existsSync(path.join(p, e.name, 'SKILL.md'))) {
                names.add(e.name);
            }
        }
    }
    return names;
}

// ── 1. Parse `## Skills Used` from today's memory log ────────────────────────
function parseSkillsUsed(memContent: string): SkillEvidence[] {
    // A memory log can hold MULTIPLE `## Skills Used` sections (dev-sync
    // appends one per session summary, and several syncs can happen per day),
    // so iterate all of them. No `$` alternative in the lookahead — with /m,
    // `$` matches at every line end, truncating the lazy capture to a line.
    const sectionRe = /^## Skills Used\s*\n([\s\S]*?)(?=\n## |\n---\n)/gm;
    const tailMatch = /^## Skills Used\s*\n([\s\S]*)$/m.exec(memContent);
    const bodies: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = sectionRe.exec(memContent)) !== null) bodies.push(m[1]);
    if (tailMatch && !bodies.includes(tailMatch[1])) bodies.push(tailMatch[1]);
    if (bodies.length === 0) return [];

    // Strip HTML comment blocks — the dev-sync skeleton keeps its fill-in
    // instructions (including a sample `- skill:` entry) inside a comment, and
    // those examples must never be counted as real evidence.
    const out: SkillEvidence[] = [];
    let current: SkillEvidence | null = null;
    for (const sectionBody of bodies) {
        const body = sectionBody.replace(/<!--[\s\S]*?-->/g, '');
        for (const rawLine of body.split('\n')) {
            const line = rawLine.trim();
            const entry = /^-\s+skill:\s*(\S+)/.exec(line);
            if (entry) {
                current = { skill: entry[1], usage: null, outcome: null, observations: [], schemaWarnings: [] };
                out.push(current);
                continue;
            }
            if (!current) continue;
            let m = /^\*?\*?usage\*?\*?:\s*(\S+)/.exec(line);
            if (m) { current.usage = m[1]; continue; }
            m = /^\*?\*?outcome\*?\*?:\s*(\S+)/.exec(line);
            if (m) { current.outcome = m[1]; continue; }
            m = /^-\s+(.+)/.exec(line);
            if (m && !line.startsWith('usage') && !line.startsWith('outcome')) {
                current.observations.push(m[1].trim().replace(/^["']|["']$/g, ''));
            }
        }
    }
    // Schema validation (WARN only)
    for (const e of out) {
        if (!e.usage || !USAGES.has(e.usage)) {
            e.schemaWarnings.push(`usage missing/invalid: "${e.usage ?? ''}" (expected primary|supporting)`);
        }
        if (!e.outcome || !OUTCOMES.has(e.outcome)) {
            e.schemaWarnings.push(`outcome missing/invalid: "${e.outcome ?? ''}" (expected completed|partial|failed|abandoned)`);
        }
    }
    return out;
}

// ── 2. Derive Observed Symptoms from evidence ────────────────────────────────
function deriveSymptoms(evidence: SkillEvidence[]): Map<string, ReviewRecord> {
    const records = new Map<string, ReviewRecord>();
    const add = (skill: string, type: string, description: string) => {
        const key = `${skill}::${type}`;
        const existing = records.get(key);
        if (existing) {
            existing.evidence.occurrences += 1;
            if (!existing.evidence.sessions_list.includes(date)) {
                existing.evidence.sessions_list.push(date);
            }
            existing.evidence.sessions = existing.evidence.sessions_list.length;
        } else {
            records.set(key, {
                skill,
                observed_symptom: { type, description },
                evidence: { sessions: 1, occurrences: 1, sessions_list: [date] },
                diagnosis: { likely_cause: '' },
                candidate: { priority: '', confidence: '', suggested_action: '', status: 'proposed' },
            });
        }
    };

    for (const e of evidence) {
        if (e.outcome === 'failed' || e.outcome === 'abandoned') {
            add(e.skill, 'outcome_failure', `Session ${date}: skill used with outcome=${e.outcome}`);
        }
        for (const obs of e.observations) {
            // Classification heuristic (structural keyword match, WARN-class —
            // misclassification is corrected at triage, not automated away).
            const lower = obs.toLowerCase();
            const type = /manual(ly)?|by hand|separate(ly)? search|workaround/.test(lower)
                ? 'repeated_manual_intervention'
                : /no procedure|lacks?a (step|procedure)|missing step/.test(lower)
                    ? 'missing_procedure'
                    : /trigger|should have (used|matched)|wrong skill|didn'?t fire/.test(lower)
                        ? 'description_trigger_mismatch'
                        : null;
            if (type) add(e.skill, type, obs);
        }
    }
    return records;
}

// ── 3. Structural checks on skills modified this session ────────────────────
async function touchedSkills(): Promise<string[]> {
    const res = await $`git status --porcelain`.quiet().nothrow();
    const names = new Set<string>();
    for (const line of res.stdout.toString().split('\n').filter(Boolean)) {
        const f = line.replace(/^.{3}/, '').trim();
        const m = /^(?:skills|\.agents\/skills)\/([^/]+)\/SKILL\.md$/.exec(f);
        if (m) names.add(m[1]);
    }
    return [...names];
}

function readFrontmatterField(skill: string, field: string): string | null {
    const p = path.join(import.meta.dir, '..', 'skills', skill, 'SKILL.md');
    if (!fs.existsSync(p)) return null;
    const m = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(fs.readFileSync(p, 'utf-8'));
    return m ? m[1].trim() : null;
}

function manifestVersion(skill: string): string | null {
    const p = path.join(import.meta.dir, '..', 'docs', 'VERSION_MANIFEST.md');
    if (!fs.existsSync(p)) return null;
    const m = new RegExp(`^\\|\\s*${skill}\\s*\\|\\s*([0-9.]+)\\s*\\|`, 'm').exec(fs.readFileSync(p, 'utf-8'));
    return m ? m[1] : null;
}

async function runStructuralChecks(skills: string[]): Promise<string[]> {
    const findings: string[] = [];
    for (const skill of skills) {
        const fmVersion = readFrontmatterField(skill, 'version');
        const manifestV = manifestVersion(skill);
        if (fmVersion && manifestV && fmVersion !== manifestV) {
            findings.push(`WARN ${skill}: SKILL.md version ${fmVersion} != VERSION_MANIFEST ${manifestV} (regenerate manifest)`);
        }
        const gov = path.join(import.meta.dir, '..', 'docs', 'lifecycle', 'skills', `${skill}.md`);
        if (fs.existsSync(gov)) {
            const govContent = fs.readFileSync(gov, 'utf-8');
            if (fmVersion && !govContent.includes(fmVersion)) {
                findings.push(`WARN ${skill}: governance record Changelog does not mention version ${fmVersion}`);
            }
        } else {
            findings.push(`WARN ${skill}: no governance record at docs/lifecycle/skills/${skill}.md`);
        }
        const description = (readFrontmatterField(skill, 'description') ?? '').toLowerCase();
        const triggers = await $`bun -e "const m=require('js-yaml');const f=require('fs');const t=f.readFileSync('skills/${skill}/SKILL.md','utf8');const fm=t.split('---')[1];const y=m.load(fm);console.log(JSON.stringify((y.metadata&&y.metadata.triggers)||[]))"`
            .quiet().nothrow();
        try {
            const triggersArr: string[] = JSON.parse(triggers.stdout.toString().trim() || '[]');
            if (description && triggersArr.length === 0) {
                findings.push(`WARN ${skill}: description present but metadata.triggers is empty`);
            }
        } catch { /* trigger parse issues are validate-skills' domain */ }
        // Dependency re-check per touched skill. skill-dependency-analysis.ts is
        // L0-only — in L1/L3 projects (this script is L0+L1) it is absent, so the
        // check degrades to a skip rather than a false failure (ADR-0067 §Decision 5).
        if (fs.existsSync(path.join(import.meta.dir, 'skill-dependency-analysis.ts'))) {
            const depRes = await $`bun scripts/skill-dependency-analysis.ts --skill ${skill}`.quiet().nothrow();
            if (depRes.exitCode !== 0) {
                findings.push(`WARN ${skill}: skill-dependency-analysis reported issues (exit ${depRes.exitCode})`);
            }
        }
    }
    return findings;
}

// ── 4. Report rendering ──────────────────────────────────────────────────────
function renderMarkdown(records: ReviewRecord[], evidence: SkillEvidence[], findings: string[]): string {
    const typeCounts = new Map<string, number>();
    for (const r of records.values()) {
        typeCounts.set(r.observed_symptom.type, (typeCounts.get(r.observed_symptom.type) ?? 0) + 1);
    }
    const sessionsSet = new Set<string>();
    for (const r of records.values()) for (const s of r.evidence.sessions_list) sessionsSet.add(s);

    const lines: string[] = [];
    lines.push(`# Skill Session Review — ${date}`, '');
    lines.push(`> Auto-generated by scripts/skill-session-review.ts v${VERSION}.`);
    lines.push(`> \`observed_symptom\` + \`evidence\` are automatic. \`diagnosis\` and \`candidate\``);
    lines.push(`> are filled at human triage (PM / lifecycle-manager). Never auto-applied.`, '');
    lines.push('## Summary', '');
    lines.push(`- observation_count: ${records.size}`);
    lines.push(`- evidence_sessions: ${sessionsSet.size}`);
    lines.push(`- symptom_types: ${[...typeCounts.entries()].map(([t, c]) => `${t}=${c}`).join(', ') || 'none'}`, '');

    if (records.size === 0) {
        lines.push(`No skill usage evidence found in memory/${date}.md (\`## Skills Used\` absent or empty).`, '');
    }
    for (const r of records.values()) {
        lines.push(`## Skill Review Entry — ${r.skill}`, '', '```yaml');
        lines.push(`skill: ${r.skill}`);
        lines.push(`date: ${date}`);
        lines.push(`observed_symptom:`);
        lines.push(`  type: ${r.observed_symptom.type}`);
        lines.push(`  description: "${r.observed_symptom.description.replace(/"/g, '\\"')}"`);
        lines.push(`evidence:`);
        lines.push(`  sessions: ${r.evidence.sessions}`);
        lines.push(`  occurrences: ${r.evidence.occurrences}`);
        lines.push(`  sessions_list: [${r.evidence.sessions_list.join(', ')}]`);
        lines.push(`diagnosis:`);
        lines.push(`  likely_cause: ""   # triage-time`);
        lines.push(`candidate:`);
        lines.push(`  priority: ""`);
        lines.push(`  confidence: ""`);
        lines.push(`  suggested_action: ""  # revise | add_procedure | update_triggers | deprecate | monitor`);
        lines.push(`  status: proposed`);
        lines.push('```', '');
    }
    if (findings.length > 0) {
        lines.push('## Structural Findings (session-modified skills)', '');
        for (const f of findings) lines.push(`- ${f}`);
        lines.push('');
    }
    return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────
const memoryFile = path.join(import.meta.dir, '..', 'memory', `${date}.md`);
let evidence: SkillEvidence[] = [];
if (fs.existsSync(memoryFile)) {
    evidence = parseSkillsUsed(fs.readFileSync(memoryFile, 'utf-8'));
}

const records = deriveSymptoms(evidence);
const touched = await touchedSkills();
const findings = touched.length > 0 ? await runStructuralChecks(touched) : [];

if (!JSON_MODE) {
    console.log(`${CYAN}📋 Skill Session Review (${date})${RESET}`);
    console.log(`   Evidence entries: ${evidence.length}, review records: ${records.size}, touched skills: ${touched.length}`);
    for (const e of evidence) {
        for (const w of e.schemaWarnings) {
            console.log(`${YELLOW}   ⚠️  ${e.skill}: ${w}${RESET}`);
        }
    }
    for (const f of findings) console.log(`${YELLOW}   ⚠️  ${f}${RESET}`);
    if (records.size === 0) {
        console.log(`${GREEN}   ✓ No symptoms to record (no Skills Used evidence or no classifiable observations)${RESET}`);
    }
}

const markdown = renderMarkdown(records, evidence, findings);
if (!DRY_RUN) {
    const reviewDir = path.join(import.meta.dir, '..', 'memory', 'skill-review');
    if (!fs.existsSync(reviewDir)) fs.mkdirSync(reviewDir, { recursive: true });
    const reviewFile = path.join(reviewDir, `${date}.md`);
    // Merge: if the file exists, replace only the auto-generated sections —
    // manually triaged diagnosis/candidate content in existing entries persists
    // via append-with-separator (entries are keyed by heading, dedup at triage).
    const separator = fs.existsSync(reviewFile) ? '\n---\n\n' : '';
    fs.appendFileSync(reviewFile, separator + markdown, 'utf8');
    if (!JSON_MODE) console.log(`${GREEN}✓ Review report appended: memory/skill-review/${date}.md${RESET}`);
}

if (JSON_MODE) {
    console.log(JSON.stringify({
        date,
        evidence_entries: evidence.length,
        schema_warnings: evidence.flatMap(e => e.schemaWarnings.map(w => ({ skill: e.skill, warning: w }))),
        records: [...records.values()],
        touched_skills: touched,
        structural_findings: findings,
        dry_run: DRY_RUN,
    }, null, 2));
}
