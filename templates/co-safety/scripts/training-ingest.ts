/**
 * Training Ingest — CSV -> TRAIN-* JSON ingestion for worker safety-training
 * completion records into memory/training/.
 *
 * Policy:
 *  - CSV-only input (hand-rolled RFC-4180-ish parser; no new dependencies).
 *  - STRICT signature policy: rows missing signer_id/signed_at are rejected.
 *  - Dedupe ON by default (key: trainee_id + training_type + completion_date);
 *    duplicates are skipped unless --no-dedupe.
 *  - cwd-relative paths throughout (run from the project root).
 *  - Every composed record is validated against
 *    evidence-models/domains/functional/training/training-record.json via
 *    scripts/lib/evidence-validator.ts before an atomic (tmp+rename) write.
 *
 * @version 1.0.0
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateRecordValue } from './lib/evidence-validator.ts';

const OUT_DIR = path.join('memory', 'training');
const SCHEMA_PATH = path.join('evidence-models', 'domains', 'functional', 'training', 'training-record.json');

const TYPES = ['regular', 'special', 'supervisor', 'new_hire', 'job_transfer', 'first_aid', 'msds'];
const RESULTS = ['passed', 'failed', 'incomplete', 'in_progress'];
const METHODS = ['classroom', 'online', 'on_the_job', 'field', 'vr_ar'];
const SIGNER_ROLES = ['QA_manager', 'production_manager', 'QC_analyst', 'reviewer', 'RP', 'other'];
const SIGNATURE_MEANINGS = ['approval', 'review', 'verification', 'execution'];

const TYPE_ABBR: Record<string, string> = {
    regular: 'REG',
    special: 'SPE',
    supervisor: 'SUP',
    new_hire: 'NEW',
    job_transfer: 'JOB',
    first_aid: 'FST',
    msds: 'MSD',
};

// Per-type statutory basis; PIPA Art.15 §1 (collection/use grounds) and
// Art.21 §1 (destruction duty) are appended to every record (worker PII).
const TYPE_LEGAL_BASIS: Record<string, string[]> = {
    regular: ['OSHA-KR Art.29 §1', 'OSHA-KR Art.36 §1', 'SAPA Art.4'],
    new_hire: ['OSHA-KR Art.29 §1', 'OSHA-KR Art.36 §1', 'SAPA Art.4'],
    job_transfer: ['OSHA-KR Art.29 §1', 'OSHA-KR Art.36 §1', 'SAPA Art.4'],
    first_aid: ['OSHA-KR Art.29 §1', 'OSHA-KR Art.36 §1', 'SAPA Art.4'],
    special: ['OSHA-KR Art.31 §1', 'OSHA-KR Art.13 §1', 'SAPA Art.4'],
    msds: ['OSHA-KR Art.114 §1', 'OSHA-KR Art.29 §1', 'SAPA Art.5'],
    supervisor: ['OSHA-KR Art.32 §1', 'OSHA-KR Art.29 §1', 'SAPA Art.4'],
};

const REQUIRED_COLUMNS = [
    'trainee_id', 'completion_date', 'hours_completed', 'result',
    'signer_id', 'signed_at', 'next_training_due',
];
const OPTIONAL_COLUMNS = [
    'training_type', 'trainee_name', 'trainee_role', 'required_hours', 'score',
    'instructor_id', 'instructor_qualification_ref', 'curriculum_ref',
    'industry_specific', 'retraining_required', 'training_location',
    'training_method', 'signer_role', 'signature_meaning',
];

function printHelp(): void {
    console.log(`training-ingest v1.0.0 - CSV -> TRAIN-* JSON ingestion for worker safety-training completion records.

Usage:
  bun scripts/training-ingest.ts --input <file.csv> [--type <enum>] [--dry-run] [--no-dedupe] [--report <path.md>]

Options:
  --input <file.csv>    (required) UTF-8 CSV with a header row; embedded commas/quotes/CRLF supported
  --type <enum>         training_type fallback for rows whose training_type cell is empty
                        enum: regular | special | supervisor | new_hire | job_transfer | first_aid | msds
  --dry-run             validate and plan only; nothing is written (report file is also suppressed)
  --no-dedupe           disable duplicate skipping; fresh sequential IDs are always allocated
  --report <path.md>    write a markdown summary (counts + failures) to the given path

Exit codes: 0 = every row written/skipped cleanly; 1 = any row failed or input error.

Record ID: TRAIN-<ABBR>-<YYYY>-<NNNN>, sequential per type+year (scans existing memory/training/):
  regular=REG  special=SPE  supervisor=SUP  new_hire=NEW  job_transfer=JOB  first_aid=FST  msds=MSD

Required columns:
  trainee_id             worker identifier (non-empty)
  completion_date        YYYY-MM-DD
  hours_completed        number > 0
  result                 passed | failed | incomplete | in_progress
  signer_id              signer employee ID (STRICT policy: rows without full signer data are REJECTED)
  signed_at              YYYY-MM-DD or ISO datetime (naive values normalized to KST +09:00)
  next_training_due      YYYY-MM-DD; REQUIRED - statutory cycles are never fabricated; WARN if already past

Optional columns:
  training_type          enum above (falls back to --type flag; row fails if neither is present)
  trainee_name           free text
  trainee_role           free text (job title/role)
  required_hours         number (legally required minimum hours)
  score                  number (soft warning outside 0-100)
  instructor_id          free text
  instructor_qualification_ref  free text reference
  curriculum_ref         free text reference (training-curriculum-record.json)
  industry_specific      free text (e.g. construction TBM)
  retraining_required    true | false
  training_location      free text
  training_method        classroom | online | on_the_job | field | vr_ar
  signer_role            QA_manager | production_manager | QC_analyst | reviewer | RP | other (default: other)
  signature_meaning      approval | review | verification | execution (default: execution)

Legal basis is derived from training_type (OSHA-KR / SAPA articles) and every record additionally cites
"PIPA Art.15 §1" (collection/use grounds) and "PIPA Art.21 §1" (destruction duty) for worker PII.

Output: memory/training/TRAIN-*.json, each validated against
evidence-models/domains/functional/training/training-record.json before an atomic tmp+rename write.`);
}

// ── CSV parsing (RFC-4180-ish: quoted fields, "" escapes, CRLF/LF) ────────────

function parseCsv(text: string): string[][] {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                } else {
                    inQuotes = false;
                    i++;
                }
            } else {
                field += ch;
                i++;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\r') {
            if (text[i + 1] === '\n') i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (ch === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += ch;
        }
        i++;
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

// ── Cell-level parsing/validation helpers ─────────────────────────────────────

function isValidDate(s: string): boolean {
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function toIsoTimestamp(raw: string): string | null {
    const s = raw.trim().replace(' ', 'T');
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return `${s}T00:00:00+09:00`;
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?/.test(s)) return null;
    let out = s;
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(out)) out += ':00';
    if (!/(?:[Zz]|[+-][0-9]{2}:?[0-9]{2})$/.test(out)) out += '+09:00';
    return out;
}

function parseNum(raw: string): number | null {
    const s = raw.trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function parseBool(raw: string): boolean | null {
    const s = raw.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    return null;
}

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function atomicWrite(file: string, data: string): void {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, data, 'utf-8');
    fs.renameSync(tmp, file);
}

function fatal(msg: string): never {
    console.error(`ERROR: ${msg}`);
    console.error("Run with --help for usage.");
    process.exit(1);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
let input: string | null = null;
let typeFlag: string | null = null;
let dryRun = false;
let dedupe = true;
let reportPath: string | null = null;

for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
        printHelp();
        process.exit(0);
    } else if (a === '--input') {
        input = argv[++i];
        if (input === undefined) fatal('missing value for --input');
    } else if (a === '--type') {
        typeFlag = argv[++i];
        if (typeFlag === undefined) fatal('missing value for --type');
    } else if (a === '--dry-run') {
        dryRun = true;
    } else if (a === '--no-dedupe') {
        dedupe = false;
    } else if (a === '--report') {
        reportPath = argv[++i];
        if (reportPath === undefined) fatal('missing value for --report');
    } else {
        fatal(`unknown argument '${a}'`);
    }
}

if (!input) fatal('missing required --input <file.csv>');
if (typeFlag !== null && !TYPES.includes(typeFlag)) {
    fatal(`invalid --type '${typeFlag}' (allowed: ${TYPES.join(', ')})`);
}

// ── Input + schema loading ────────────────────────────────────────────────────

let csvText: string;
try {
    csvText = fs.readFileSync(input, 'utf-8');
} catch (e: any) {
    fatal(`cannot read input file '${input}' - ${e.message}`);
}

const rows = parseCsv(csvText);
if (rows.length < 2) fatal(`input CSV '${input}' has no data rows`);

const header = rows[0].map(h => h.trim());
const colIdx: Record<string, number> = {};
header.forEach((h, i) => {
    if (!(h in colIdx)) colIdx[h] = i;
});
const unknownCols = header.filter(h => h !== '' &&
    !REQUIRED_COLUMNS.includes(h) && !OPTIONAL_COLUMNS.includes(h));
if (unknownCols.length > 0) {
    console.log(`[WARN] ignoring unrecognized column(s): ${[...new Set(unknownCols)].join(', ')}`);
}
const missingCols = REQUIRED_COLUMNS.filter(c => !(c in colIdx));
if (missingCols.length > 0) fatal(`input CSV missing required column(s): ${missingCols.join(', ')}`);

function cell(row: string[], name: string): string {
    const idx = colIdx[name];
    if (idx === undefined || idx >= row.length) return '';
    return row[idx].trim();
}

let schema: any;
try {
    schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
} catch (e: any) {
    fatal(`cannot load schema '${SCHEMA_PATH}' - ${e.message}`);
}
const schemaBaseDir = path.dirname(SCHEMA_PATH);

// ── Existing-state scan (ID sequence + dedupe keys) ───────────────────────────

const seqMap = new Map<string, number>();
const seenKeys = new Map<string, string>();
const idRe = /^TRAIN-([A-Z]+)-([0-9]{4})-([0-9]{4})\.json$/;

if (fs.existsSync(OUT_DIR)) {
    for (const entry of fs.readdirSync(OUT_DIR)) {
        const m = idRe.exec(entry);
        if (m) {
            const k = `${m[1]}-${m[2]}`;
            const n = parseInt(m[3], 10);
            if (n > (seqMap.get(k) ?? 0)) seqMap.set(k, n);
        }
        if (entry.endsWith('.json')) {
            try {
                const doc = JSON.parse(fs.readFileSync(path.join(OUT_DIR, entry), 'utf-8'));
                if (doc && typeof doc.trainee_id === 'string' && typeof doc.training_type === 'string'
                    && typeof doc.completion_date === 'string') {
                    seenKeys.set(`${doc.trainee_id}|${doc.training_type}|${doc.completion_date}`, entry);
                }
            } catch {
                // Unparsable legacy file — leave it to safety-audit to flag.
            }
        }
    }
}

function allocateId(abbr: string, yyyy: string): string {
    const key = `${abbr}-${yyyy}`;
    let n = (seqMap.get(key) ?? 0) + 1;
    let id = `TRAIN-${key}-${String(n).padStart(4, '0')}`;
    if (!dryRun) {
        while (fs.existsSync(path.join(OUT_DIR, `${id}.json`))) {
            n++;
            id = `TRAIN-${key}-${String(n).padStart(4, '0')}`;
        }
    }
    seqMap.set(key, n);
    return id;
}

function ensureOutDir(): void {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const keep = path.join(OUT_DIR, '.gitkeep');
    if (!fs.existsSync(keep)) fs.writeFileSync(keep, '', 'utf-8');
}

// ── Row processing ────────────────────────────────────────────────────────────

let written = 0;
let skipped = 0;
let failed = 0;
const failures: string[] = [];
const skips: string[] = [];
const warnings: string[] = [];

for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNo = r + 1;
    const errs: string[] = [];

    const traineeId = cell(row, 'trainee_id');
    if (!traineeId) errs.push('trainee_id is empty');

    const completionDate = cell(row, 'completion_date');
    if (!isValidDate(completionDate)) {
        errs.push(`completion_date '${completionDate}' is not a valid ISO date (YYYY-MM-DD)`);
    }

    const hours = parseNum(cell(row, 'hours_completed'));
    if (hours === null || hours <= 0) {
        errs.push(`hours_completed '${cell(row, 'hours_completed')}' must be a number > 0`);
    }

    const result = cell(row, 'result');
    if (!RESULTS.includes(result)) {
        errs.push(`result '${result}' must be one of: ${RESULTS.join(', ')}`);
    }

    // STRICT signature policy — incomplete signer data rejects the row.
    const signerId = cell(row, 'signer_id');
    if (!signerId) errs.push("signer_id is empty (strict signature policy: rows without signer data are rejected)");
    const sigTs = toIsoTimestamp(cell(row, 'signed_at'));
    if (!sigTs) {
        errs.push(`signed_at '${cell(row, 'signed_at')}' must be YYYY-MM-DD or an ISO datetime`);
    }

    const nextDue = cell(row, 'next_training_due');
    if (!nextDue) {
        errs.push('next_training_due is empty (REQUIRED — statutory cycles are never fabricated)');
    } else if (!isValidDate(nextDue)) {
        errs.push(`next_training_due '${nextDue}' is not a valid ISO date (YYYY-MM-DD)`);
    }

    const type = cell(row, 'training_type') || typeFlag;
    if (!type) {
        errs.push('training_type is empty and no --type flag was given');
    } else if (!TYPES.includes(type)) {
        errs.push(`training_type '${type}' must be one of: ${TYPES.join(', ')}`);
    }

    const traineeName = cell(row, 'trainee_name');
    const traineeRole = cell(row, 'trainee_role');
    const instructorId = cell(row, 'instructor_id');
    const instructorQualRef = cell(row, 'instructor_qualification_ref');
    const curriculumRef = cell(row, 'curriculum_ref');
    const industrySpecific = cell(row, 'industry_specific');
    const trainingLocation = cell(row, 'training_location');

    const requiredHours = parseNum(cell(row, 'required_hours'));
    if (cell(row, 'required_hours') !== '' && requiredHours === null) {
        errs.push(`required_hours '${cell(row, 'required_hours')}' is not a number`);
    }

    const scoreRaw = cell(row, 'score');
    const score = parseNum(scoreRaw);
    if (scoreRaw !== '' && score === null) errs.push(`score '${scoreRaw}' is not a number`);

    const retrainingRaw = cell(row, 'retraining_required');
    const retraining = parseBool(retrainingRaw);
    if (retrainingRaw !== '' && retraining === null) {
        errs.push(`retraining_required '${retrainingRaw}' must be true or false`);
    }

    const method = cell(row, 'training_method');
    if (method && !METHODS.includes(method)) {
        errs.push(`training_method '${method}' must be one of: ${METHODS.join(', ')}`);
    }

    const signerRole = cell(row, 'signer_role') || 'other';
    if (!SIGNER_ROLES.includes(signerRole)) {
        errs.push(`signer_role '${signerRole}' must be one of: ${SIGNER_ROLES.join(', ')}`);
    }

    const sigMeaning = cell(row, 'signature_meaning') || 'execution';
    if (!SIGNATURE_MEANINGS.includes(sigMeaning)) {
        errs.push(`signature_meaning '${sigMeaning}' must be one of: ${SIGNATURE_MEANINGS.join(', ')}`);
    }

    const desc = `trainee=${traineeId}, type=${type}, completed=${completionDate}`;

    if (errs.length > 0) {
        failed++;
        for (const e of errs) failures.push(`row ${rowNo}: ${e}`);
        console.log(`[FAIL] row ${rowNo} -> ${errs.join('; ')}`);
        continue;
    }

    const rowWarns: string[] = [];
    if (nextDue < todayIso()) rowWarns.push(`next_training_due ${nextDue} is already past`);
    if (score !== null && (score < 0 || score > 100)) rowWarns.push(`score ${score} is outside 0-100`);

    const dedupeKey = `${traineeId}|${type}|${completionDate}`;
    if (dedupe && seenKeys.has(dedupeKey)) {
        skipped++;
        const dupeOf = seenKeys.get(dedupeKey);
        skips.push(`row ${rowNo}: duplicate of ${dupeOf} (${desc})`);
        console.log(`[SKIP] row ${rowNo} -> duplicate of ${dupeOf} (${desc})`);
        continue;
    }

    const id = allocateId(TYPE_ABBR[type], completionDate.slice(0, 4));
    const destRel = path.join(OUT_DIR, `${id}.json`);
    for (const w of rowWarns) {
        warnings.push(`row ${rowNo}: ${w}`);
        console.log(`[WARN] row ${rowNo}: ${w}`);
    }

    const record: Record<string, unknown> = {
        record_id: id,
        training_type: type,
        trainee_id: traineeId,
        completion_date: completionDate,
        hours_completed: hours,
        result,
        next_training_due: nextDue,
    };
    if (traineeName) record.trainee_name = traineeName;
    if (traineeRole) record.trainee_role = traineeRole;
    if (requiredHours !== null) record.required_hours = requiredHours;
    if (score !== null) record.score = score;
    if (instructorId) record.instructor_id = instructorId;
    if (instructorQualRef) record.instructor_qualification_ref = instructorQualRef;
    if (curriculumRef) record.curriculum_ref = curriculumRef;
    if (industrySpecific) record.industry_specific = industrySpecific;
    if (retraining !== null) record.retraining_required = retraining;
    if (trainingLocation) record.training_location = trainingLocation;
    if (method) record.training_method = method;
    record.legal_basis = [...TYPE_LEGAL_BASIS[type], 'PIPA Art.15 §1', 'PIPA Art.21 §1'];
    record.e_signature = {
        required: true,
        signer_id: signerId,
        signer_role: signerRole,
        signature_timestamp: sigTs,
        signature_meaning: sigMeaning,
        cryptographic_hash: null,
    };
    record.nomenclature = {
        key_en: 'safety_training_completion_record',
        display_name_ko: '안전보건교육 이수 기록',
        display_name_en: 'Safety Training Completion Record',
        regulatory_term_ko: '안전보건교육',
        synonyms: ['정기안전보건교육', '특별안전보건교육', '교육 이수 확인'],
    };
    record.audit_trail = {
        created_at: new Date().toISOString(),
        created_by: 'training-ingest',
        record_status: 'active',
    };

    const vErrs: string[] = [];
    validateRecordValue(record, schema, { rel: `row ${rowNo}`, path: '$', rootDoc: schema, baseDir: schemaBaseDir }, vErrs);
    if (vErrs.length > 0) {
        failed++;
        for (const e of vErrs) failures.push(`row ${rowNo}: ${e}`);
        console.log(`[FAIL] row ${rowNo} -> schema validation failed:`);
        for (const e of vErrs) console.log(`       ${e}`);
        continue;
    }

    if (dryRun) {
        written++;
        console.log(`[DRY ] row ${rowNo} -> ${destRel} (${desc})`);
        continue;
    }

    try {
        ensureOutDir();
        atomicWrite(destRel, JSON.stringify(record, null, 2) + '\n');
    } catch (e: any) {
        failed++;
        failures.push(`row ${rowNo}: write failed for ${destRel} - ${e.message}`);
        console.log(`[FAIL] row ${rowNo} -> write failed for ${destRel} - ${e.message}`);
        continue;
    }
    written++;
    seenKeys.set(dedupeKey, path.basename(destRel));
    console.log(`[OK  ] row ${rowNo} -> ${destRel} (${desc})`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const mode = `${dryRun ? 'dry-run' : 'write'} (dedupe ${dedupe ? 'on' : 'off'})`;
console.log('');
console.log(`Summary: ${written} written, ${skipped} skipped, ${failed} failed | input: ${input} | mode: ${mode}${dryRun ? ' — nothing written' : ''}`);
if (failed === 0) {
    console.log('PIPA reminder: retain training records 3 years per OSHA-KR Art.57; destroy personal data per PIPA Art.21 when retention ends.');
}

if (reportPath) {
    if (dryRun) {
        console.log(`NOTE: --report '${reportPath}' suppressed under --dry-run.`);
    } else {
        const md = [
            '# Training Ingest Report',
            '',
            `- Generated: ${new Date().toISOString()}`,
            `- Source: ${input}`,
            `- Mode: ${mode}`,
            `- Summary: ${written} written, ${skipped} skipped, ${failed} failed`,
            '',
            ...(failures.length > 0 ? ['## Failures', '', ...failures.map(f => `- ${f}`), ''] : []),
            ...(skips.length > 0 ? ['## Skipped (duplicates)', '', ...skips.map(s => `- ${s}`), ''] : []),
            ...(warnings.length > 0 ? ['## Warnings', '', ...warnings.map(w => `- ${w}`), ''] : []),
        ].join('\n');
        try {
            const dir = path.dirname(reportPath);
            if (dir !== '.' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            atomicWrite(reportPath, md + '\n');
            console.log(`[OK  ] report -> ${reportPath}`);
        } catch (e: any) {
            console.error(`ERROR: cannot write report '${reportPath}' - ${e.message}`);
            process.exit(1);
        }
    }
}

process.exit(failed > 0 ? 1 : 0);
