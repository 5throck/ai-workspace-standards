#!/usr/bin/env bun
/**
 * Risk Register Rollup Tool
 *
 * Rolls up facility-scoped risk assessments (memory/assessments/RA-*.json)
 * into a living risk register (memory/registers/RR-*.json) per OSHA-KR
 * Article 36 periodic-review obligation (매 1년 이내).
 *
 * Manager sign-off arguments (--manager-id, --signer-id, --signed-at) are
 * REQUIRED: executing this command constitutes a review act, so every write
 * carries an accountable e_signature. Use --dry-run to preview the plan
 * without writing anything.
 *
 * Merge semantics:
 *   - Flat storage bucket memory/registers/; among existing registers for the
 *     same facility, the one with the latest register_date is the merge target.
 *   - Existing entries are matched by source_assessment_ref + entry_id and
 *     refreshed on current_risk_level + last_updated ONLY. Human-set fields
 *     (control_status, incident_ref) are never recomputed or overwritten.
 *   - Genuinely new assessment hazards are appended. Entries in the register
 *     with no matching live hazard are reported as stale but preserved.
 *
 * Risk bands follow the normative table defined on risk_score_before in
 * evidence-models/domains/functional/risk-assessment/risk-assessment-record.json
 * (single source of truth): 1-5 low / 6-12 medium / 13-19 high / 20-25 critical.
 *
 * Usage:
 *   bun scripts/co-safety/risk-register-rollup.ts --facility <id> --manager-id <id> \
 *       --signer-id <id> --signed-at <YYYY-MM-DD> \
 *       [--year YYYY] [--control-status planned|in_progress|implemented|overdue|not_required|na] \
 *       [--dry-run]
 *
 * @version 1.0.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateRecordValue } from './lib/evidence-validator.ts';

const ASSESS_DIR = 'memory/assessments';
const REG_DIR = 'memory/registers';
const RR_SCHEMA_PATH = 'evidence-models/domains/functional/risk-assessment/risk-register-record.json';
const CREATED_BY = 'risk-register-rollup';
const LEGAL_BASIS = ['산업안전보건법 Article 36', '중대재해처벌법 Article 4', 'MOEL 위험성평가 고시'];
const CONTROL_STATUSES = ['planned', 'in_progress', 'implemented', 'overdue', 'not_required', 'na'];

interface Options {
    facility: string;
    managerId: string;
    signerId: string;
    signedAt: string;
    year: string | null;
    controlStatus: string;
    dryRun: boolean;
}

function usage(): string {
    return `
Usage: bun scripts/co-safety/risk-register-rollup.ts <options>

Required:
  --facility <id>         Facility or work area identifier to roll up
  --manager-id <id>       Responsible EHS manager (review act attribution)
  --signer-id <id>        e_signature.signer_id for the register sign-off
  --signed-at <date>      Sign-off date, YYYY-MM-DD

Optional:
  --year YYYY             Only include assessments with this assessment_date year
  --control-status <s>    control_status for NEW entries only (default: planned; conservative — never overstates progress)
  --dry-run               Print the full plan; write nothing
`.trim();
}

function parseArgs(argv: string[]): Options {
    const opts: any = {
        facility: null,
        managerId: null,
        signerId: null,
        signedAt: null,
        year: null,
        controlStatus: 'planned',
        dryRun: false,
    };
    const need = (flag: string, i: number): string => {
        if (i >= argv.length) {
            console.error(`ERROR: ${flag} requires a value.\n\n${usage()}`);
            process.exit(1);
        }
        return argv[i];
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case '--facility': opts.facility = need(a, ++i); break;
            case '--manager-id': opts.managerId = need(a, ++i); break;
            case '--signer-id': opts.signerId = need(a, ++i); break;
            case '--signed-at': opts.signedAt = need(a, ++i); break;
            case '--year': opts.year = need(a, ++i); break;
            case '--control-status': opts.controlStatus = need(a, ++i); break;
            case '--dry-run': opts.dryRun = true; break;
            default:
                console.error(`ERROR: unknown option '${a}'.\n\n${usage()}`);
                process.exit(1);
        }
    }
    const missing = [
        ['--facility', opts.facility],
        ['--manager-id', opts.managerId],
        ['--signer-id', opts.signerId],
        ['--signed-at', opts.signedAt],
    ].filter(([, v]) => !v).map(([f]) => f);
    if (missing.length > 0) {
        console.error(`ERROR: missing required argument(s): ${missing.join(', ')}`);
        console.error('Manager sign-off is mandatory: executing this command is a review act.');
        console.error(`\n${usage()}`);
        process.exit(1);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.signedAt)) {
        console.error(`ERROR: --signed-at must be an ISO date (YYYY-MM-DD), got '${opts.signedAt}'.`);
        process.exit(1);
    }
    if (opts.year && !/^\d{4}$/.test(opts.year)) {
        console.error(`ERROR: --year must be a 4-digit year, got '${opts.year}'.`);
        process.exit(1);
    }
    if (!CONTROL_STATUSES.includes(opts.controlStatus)) {
        console.error(`ERROR: --control-status must be one of ${CONTROL_STATUSES.join(', ')}, got '${opts.controlStatus}'.`);
        process.exit(1);
    }
    return opts as Options;
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

function isoLocalDate(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return isoLocalDate(d);
}

/** Current instant rendered in KST (+09:00) — Korea-only platform. */
function kstTimestamp(d: Date): string {
    const t = new Date(d.getTime() + 9 * 3600 * 1000);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}+09:00`;
}

/**
 * Band derivation per the normative band table on risk_score_before in
 * risk-assessment-record.json (SSOT). Returns null when the score is absent
 * or out of range.
 */
function bandFromScore(score: unknown): string | null {
    if (typeof score !== 'number' || !Number.isInteger(score)) return null;
    if (score >= 1 && score <= 5) return 'low';
    if (score >= 6 && score <= 12) return 'medium';
    if (score >= 13 && score <= 19) return 'high';
    if (score >= 20 && score <= 25) return 'critical';
    return null;
}

/**
 * current_risk_level derivation: numeric band from risk_score_after first,
 * falling back to the qualitative risk_level_after field lowercased when no
 * usable score exists.
 */
function deriveRiskLevel(hazard: any): string | null {
    const banded = bandFromScore(hazard?.risk_score_after);
    if (banded) return banded;
    const q = typeof hazard?.risk_level_after === 'string'
        ? hazard.risk_level_after.toLowerCase()
        : null;
    return q !== null && ['low', 'medium', 'high', 'critical'].includes(q) ? q : null;
}

function entryKey(e: { source_assessment_ref: string; entry_id: string }): string {
    return `${e.source_assessment_ref}|${e.entry_id}`;
}

function countHighCritical(entries: any[]): number {
    return entries.filter(e => e.current_risk_level === 'high' || e.current_risk_level === 'critical').length;
}

// ── scan assessments ──────────────────────────────────────────────────────────

function scanAssessments(opts: Options) {
    if (!fs.existsSync(ASSESS_DIR)) {
        console.error(`ERROR: ${ASSESS_DIR}/ does not exist — nothing to roll up.`);
        process.exit(1);
    }
    const files = fs.readdirSync(ASSESS_DIR)
        .filter(f => /^RA-[0-9]{4}-[0-9]{4}\.json$/.test(f))
        .sort();
    const qualifying: any[] = [];
    const skipped: { file: string; reason: string }[] = [];
    let otherFacility = 0;

    for (const file of files) {
        const rel = `${ASSESS_DIR}/${file}`;
        let doc: any;
        try {
            // Strip a UTF-8 BOM if present (Windows editors commonly emit one).
            const raw = fs.readFileSync(path.join(ASSESS_DIR, file), 'utf-8').replace(/^\uFEFF/, '');
            doc = JSON.parse(raw);
        } catch (e: any) {
            skipped.push({ file: rel, reason: `JSON parse error - ${e.message}` });
            continue;
        }
        if (typeof doc.facility_id !== 'string' || doc.facility_id.length === 0) {
            skipped.push({ file: rel, reason: 'missing facility_id (cannot attribute to a facility register)' });
            continue;
        }
        if (doc.facility_id !== opts.facility) {
            otherFacility++;
            continue;
        }
        if (opts.year && typeof doc.assessment_date === 'string' && !doc.assessment_date.startsWith(opts.year)) {
            skipped.push({ file: rel, reason: `assessment_date ${doc.assessment_date} outside --year ${opts.year}` });
            continue;
        }
        qualifying.push(doc);
    }

    if (qualifying.length === 0) {
        console.error(`ERROR: no risk assessments matched facility '${opts.facility}'` +
            (opts.year ? ` for year ${opts.year}` : '') + '.');
        console.error(`Hint: check the facility spelling against the facility_id field in`);
        console.error(`${ASSESS_DIR}/RA-*.json records. Records lacking facility_id cannot be`);
        console.error(`rolled up — populate facility_id at assessment creation time.`);
        process.exit(1);
    }
    return { scanned: files.length, qualifying, skipped, otherFacility };
}

/** Build desired register entries from qualifying assessments. */
function buildDesiredEntries(assessments: any[]): { entries: any[]; hazardSkips: string[] } {
    const entries: any[] = [];
    const hazardSkips: string[] = [];
    const today = isoLocalDate(new Date());
    for (const doc of assessments) {
        const hazards = Array.isArray(doc.hazards) ? doc.hazards : [];
        hazards.forEach((h: any, i: number) => {
            const level = deriveRiskLevel(h);
            if (!level || typeof h.hazard_description !== 'string') {
                hazardSkips.push(`${doc.record_id}.hazards[${i}] (${h?.hazard_id ?? 'no id'}): no derivable risk level or missing hazard_description — skipped`);
                return;
            }
            entries.push({
                entry_id: `${doc.record_id}-H${i + 1}`,
                hazard_description: h.hazard_description,
                ...(typeof h.hazard_category === 'string' ? { hazard_category: h.hazard_category } : {}),
                current_risk_level: level,
                source_assessment_ref: doc.record_id,
                last_updated: today,
            });
        });
    }
    return { entries, hazardSkips };
}

// ── merge ─────────────────────────────────────────────────────────────────────

function findLatestRegister(facility: string): { file: string; doc: any } | null {
    if (!fs.existsSync(REG_DIR)) return null;
    let latest: { file: string; doc: any } | null = null;
    for (const file of fs.readdirSync(REG_DIR)) {
        if (!/^RR-[0-9]{4}-[0-9]{4}\.json$/.test(file)) continue;
        const full = path.join(REG_DIR, file);
        let doc: any;
        try {
            doc = JSON.parse(fs.readFileSync(full, 'utf-8'));
        } catch {
            console.error(`WARNING: skipping unreadable register ${REG_DIR}/${file}`);
            continue;
        }
        if (doc.facility_id !== facility) continue;
        if (
            latest === null ||
            String(doc.register_date ?? '').localeCompare(String(latest.doc.register_date ?? '')) > 0 ||
            (doc.register_date === latest.doc.register_date &&
                String(doc.record_id ?? '').localeCompare(String(latest.doc.record_id ?? '')) > 0)
        ) {
            latest = { file: full, doc };
        }
    }
    return latest;
}

function nextRegisterId(): string {
    const year = new Date().getFullYear();
    let max = 0;
    if (fs.existsSync(REG_DIR)) {
        for (const file of fs.readdirSync(REG_DIR)) {
            const m = file.match(/^RR-\d{4}-(\d{4})\.json$/);
            const idYear = file.match(/^RR-(\d{4})-/);
            if (m && idYear && Number(idYear[1]) === year) {
                max = Math.max(max, Number(m[1]));
            }
        }
    }
    return `RR-${year}-${String(max + 1).padStart(4, '0')}`;
}

function composeSignature(opts: Options) {
    return {
        required: true,
        signer_id: opts.signerId,
        signer_role: 'other',
        signature_timestamp: `${opts.signedAt}T00:00:00+09:00`,
        signature_meaning: 'approval',
        cryptographic_hash: null,
    };
}

function createRegister(opts: Options, desired: any[]): any {
    const today = isoLocalDate(new Date());
    return {
        record_id: nextRegisterId(),
        facility_id: opts.facility,
        register_date: today,
        next_review_date: addDays(today, 364),
        responsible_manager_id: opts.managerId,
        risk_entries: desired.map(e => ({ ...e, control_status: opts.controlStatus })),
        high_critical_count: countHighCritical(desired),
        legal_basis: [...LEGAL_BASIS],
        e_signature: composeSignature(opts),
        nomenclature: {
            key_en: 'risk_register',
            display_name_ko: '위험성평가 실시대장',
            display_name_en: 'Risk Assessment Register',
            regulatory_term_ko: '산업안전보건법 제36조 위험성평가',
            synonyms: ['risk register', '위험등록부'],
        },
        audit_trail: {
            created_at: kstTimestamp(new Date()),
            created_by: CREATED_BY,
            record_status: 'active',
        },
    };
}

function mergeIntoRegister(
    target: any,
    opts: Options,
    desired: any[],
): { merged: any; added: string[]; updated: string[]; drift: string[]; stale: string[] } {
    const merged = JSON.parse(JSON.stringify(target));
    const today = isoLocalDate(new Date());
    const added: string[] = [];
    const updated: string[] = [];
    const drift: string[] = [];
    const stale: string[] = [];

    const byKey = new Map<string, any>();
    for (const e of merged.risk_entries) byKey.set(entryKey(e), e);
    const desiredKeys = new Set(desired.map(entryKey));

    for (const fresh of desired) {
        const key = entryKey(fresh);
        const existing = byKey.get(key);
        if (!existing) {
            merged.risk_entries.push({ ...fresh, control_status: opts.controlStatus });
            byKey.set(key, fresh);
            added.push(key);
            continue;
        }
        if (existing.current_risk_level !== fresh.current_risk_level) {
            drift.push(`${key}: current_risk_level ${existing.current_risk_level} -> ${fresh.current_risk_level}`);
        }
        if (existing.hazard_description !== fresh.hazard_description) {
            drift.push(`${key}: hazard_description changed upstream (register copy preserved)`);
        }
        if ('hazard_category' in fresh && existing.hazard_category !== fresh.hazard_category) {
            drift.push(`${key}: hazard_category changed upstream (register copy preserved)`);
        }
        // Refresh ONLY current_risk_level + last_updated; preserve human-set
        // control_status and incident_ref (locked decision).
        existing.current_risk_level = fresh.current_risk_level;
        existing.last_updated = today;
        updated.push(key);
    }

    for (const e of merged.risk_entries) {
        if (!desiredKeys.has(entryKey(e))) {
            stale.push(`${entryKey(e)}: no matching hazard in qualifying assessments (preserved)`);
        }
    }

    merged.register_date = today;
    merged.next_review_date = addDays(today, 364);
    merged.responsible_manager_id = opts.managerId;
    merged.high_critical_count = countHighCritical(merged.risk_entries);
    merged.e_signature = composeSignature(opts);
    merged.audit_trail.last_modified_at = kstTimestamp(new Date());
    merged.audit_trail.last_modified_by = CREATED_BY;
    if (!merged.audit_trail.created_at) {
        merged.audit_trail.created_at = kstTimestamp(new Date());
        merged.audit_trail.created_by = CREATED_BY;
    }
    if (!merged.audit_trail.record_status) merged.audit_trail.record_status = 'active';

    return { merged, added, updated, drift, stale };
}

// ── validate + write ──────────────────────────────────────────────────────────

function validateAgainstSchema(register: any, targetRel: string): void {
    const schemaAbs = path.resolve(RR_SCHEMA_PATH);
    let schema: any;
    try {
        schema = JSON.parse(fs.readFileSync(schemaAbs, 'utf-8'));
    } catch (e: any) {
        console.error(`ERROR: cannot load schema ${RR_SCHEMA_PATH} - ${e.message}`);
        process.exit(1);
    }
    const errors: string[] = [];
    validateRecordValue(register, schema, {
        rel: targetRel,
        path: '$',
        rootDoc: schema,
        baseDir: path.dirname(schemaAbs),
    }, errors);
    if (errors.length > 0) {
        console.error(`ERROR: composed register failed validation against ${RR_SCHEMA_PATH} — nothing written:`);
        for (const err of errors) console.error(`  - ${err}`);
        process.exit(1);
    }
}

function atomicWrite(targetAbs: string, register: any): string {
    fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
    const keepFile = path.join(path.dirname(targetAbs), '.gitkeep');
    if (!fs.existsSync(keepFile)) fs.writeFileSync(keepFile, '');
    const tmp = `${targetAbs}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(register, null, 2) + '\n');
    fs.renameSync(tmp, targetAbs);
    return targetAbs;
}

// ── main ──────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2));

const { scanned, qualifying, skipped, otherFacility } = scanAssessments(opts);
const { entries: desired, hazardSkips } = buildDesiredEntries(qualifying);

const latest = findLatestRegister(opts.facility);
const isNew = latest === null;
const plan = isNew ? createRegister(opts, desired) : mergeIntoRegister(latest!.doc, opts, desired);
const targetDoc: any = isNew ? plan : (plan as any).merged;
const targetRel = isNew
    ? `${REG_DIR}/${targetDoc.record_id}.json`
    : path.relative('.', latest!.file).replace(/\\/g, '/');

validateAgainstSchema(targetDoc, targetRel);

if (isNew) {
    console.log(`PLAN: CREATE ${targetRel} (facility ${opts.facility})`);
    for (const e of targetDoc.risk_entries) {
        console.log(`  ADD ${entryKey(e)} [${e.current_risk_level}] status=${e.control_status}`);
    }
} else {
    const { added, updated, drift, stale } = plan as any;
    console.log(`PLAN: MERGE into ${targetRel} (facility ${opts.facility}, register_date ${latest!.doc.register_date})`);
    for (const k of added) console.log(`  ADD ${k}`);
    for (const k of updated) console.log(`  REFRESH ${k} (current_risk_level + last_updated only)`);
    for (const d of drift) console.log(`  DRIFT ${d}`);
    for (const s of stale) console.log(`  STALE ${s}`);
}
for (const s of hazardSkips) console.log(`  SKIP-HAZARD ${s}`);

if (opts.dryRun) {
    console.log('\n[DRY-RUN] No files written.');
} else {
    const written = atomicWrite(path.resolve(targetRel), targetDoc);
    console.log('');
    console.log(`Wrote ${path.relative('.', written).replace(/\\/g, '/')}`);
}

console.log('');
console.log(`Summary (facility ${opts.facility}):`);
console.log(`  Assessments scanned: ${scanned} (matched ${qualifying.length}, other-facility ${otherFacility}, skipped ${skipped.length})`);
for (const s of skipped) console.log(`    SKIPPED ${s.file}: ${s.reason}`);
console.log(`  Entries: ${isNew ? targetDoc.risk_entries.length + ' added' :
    `${(plan as any).added.length} added, ${(plan as any).updated.length} updated, ${(plan as any).drift.length} drift, ${(plan as any).stale.length} stale-preserved`}${opts.dryRun ? ' (planned)' : ''}`);
console.log(`  Target file: ${targetRel}`);
console.log(`  Next review date: ${targetDoc.next_review_date}`);
