#!/usr/bin/env bun
/**
 * Runtime Tools Integration Test
 *
 * End-to-end validation of the memory-record runtime toolchain in an isolated
 * sandbox built fresh under the OS temp dir on every run:
 *   - scripts/training-ingest.ts      CSV -> TRAIN-* JSON ingestion
 *   - scripts/risk-register-rollup.ts RA-* -> RR-* register rollup
 *   - scripts/safety-audit.ts         memory-bucket record validation
 *
 * Sandbox layout (copied from this repo):
 *   evidence-models/_shared/base/*.json
 *   evidence-models/domains/functional/training/*.json
 *   evidence-models/domains/functional/risk-assessment/*.json
 *   empty cross-domain sibling dirs required by safety-audit.ts:
 *     domains/industry/{gdp,gmp,glp,gasterm,ehschem,ehsconst}
 *     domains/functional/{msds,psm,contractor-safety}
 *   memory/{findings,corrective-actions,training,assessments,registers}/
 *
 * Test coverage:
 *   T-01: training-ingest happy path exits 0
 *   T-02: happy path writes exactly 2 TRAIN-*.json records
 *   T-03: record IDs carry expected type prefixes (REG / SUP)
 *   T-04: strict signature policy rejects a row missing signed_at (exit 1,
 *         no new files, error names the column)
 *   T-05: dedupe rerun skips both rows without writing new files
 *   T-06: rollup without manager sign-off args exits 1 and writes nothing
 *   T-07: rollup creates a valid register (high/critical bands,
 *         high_critical_count, next_review_date ~ +364 days)
 *   T-08: safety-audit validates the sandbox records (counts + 0 errors)
 *   T-09: merge preserves human-set control_status and appends new entries
 *
 * The sandbox is removed on success and preserved on failure for debugging.
 *
 * @version 1.0.0
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const REPO = path.resolve(import.meta.dir, '..');
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-tools-test-'));

const results: Array<{ test: string; pass: boolean; detail?: string }> = [];

function record(testId: string, description: string, pass: boolean, detail?: string) {
    results.push({ test: `${testId}: ${description}`, pass, detail });
    const mark = pass ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${mark} ${testId}: ${description}${detail && !pass ? ` — ${RED}${detail}${RESET}` : ''}`);
}

// ── sandbox helpers ───────────────────────────────────────────────────────────

function sb(...parts: string[]): string {
    return path.join(SANDBOX, ...parts);
}

function copyJsonFiles(srcAbs: string, destAbs: string): void {
    fs.mkdirSync(destAbs, { recursive: true });
    for (const entry of fs.readdirSync(srcAbs)) {
        if (entry.endsWith('.json')) {
            fs.copyFileSync(path.join(srcAbs, entry), path.join(destAbs, entry));
        }
    }
}

function setupSandbox(): void {
    copyJsonFiles(
        path.join(REPO, 'evidence-models', '_shared', 'base'),
        sb('evidence-models', '_shared', 'base'),
    );
    copyJsonFiles(
        path.join(REPO, 'evidence-models', 'domains', 'functional', 'training'),
        sb('evidence-models', 'domains', 'functional', 'training'),
    );
    copyJsonFiles(
        path.join(REPO, 'evidence-models', 'domains', 'functional', 'risk-assessment'),
        sb('evidence-models', 'domains', 'functional', 'risk-assessment'),
    );
    for (const d of [
        'industry/gdp', 'industry/gmp', 'industry/glp',
        'industry/gasterm', 'industry/ehschem', 'industry/ehsconst',
        'functional/msds', 'functional/psm', 'functional/contractor-safety',
    ]) {
        fs.mkdirSync(sb('evidence-models', 'domains', ...d.split('/')), { recursive: true });
    }
    for (const b of ['findings', 'corrective-actions', 'training', 'assessments', 'registers']) {
        fs.mkdirSync(sb('memory', b), { recursive: true });
    }
}

interface RunResult { exitCode: number; stdout: string; stderr: string; }

function runTool(repoScriptRel: string, args: string[]): RunResult {
    const proc = Bun.spawnSync([process.execPath, path.join(REPO, repoScriptRel), ...args], {
        cwd: SANDBOX,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
    });
    return {
        exitCode: proc.exitCode ?? -1,
        stdout: proc.stdout.toString(),
        stderr: proc.stderr.toString(),
    };
}

// ── date helpers (mirror risk-register-rollup.ts semantics) ───────────────────

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

function localToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

// ── fixture builders ──────────────────────────────────────────────────────────

function writeCsv(file: string, rows: string[][]): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rows.map(r => r.join(',')).join('\r\n') + '\r\n', 'utf-8');
}

const CSV_HEADER = [
    'trainee_id', 'training_type', 'trainee_name', 'completion_date', 'hours_completed',
    'result', 'signer_id', 'signed_at', 'next_training_due',
];
const CSV_ROW_REGULAR = [
    'TRN-0001', 'regular', 'Kim Minjun', '2026-08-03', '4',
    'passed', 'SIGN-001', '2026-08-03T09:00:00+09:00', '2027-08-03',
];
const CSV_ROW_SUPERVISOR = [
    'TRN-0002', 'supervisor', 'Park Sohee', '2026-08-05', '2',
    'passed', 'SIGN-002', '2026-08-05T15:30:00+09:00', '2027-08-05',
];
const CSV_ROW_MISSING_SIGNED_AT = [
    'TRN-BAD-9000', 'regular', 'Choi Invalid', '2026-08-07', '2',
    'passed', 'SIGN-003', '', '2027-08-07',
];

function raFixture(recordId: string, hazardDescription: string, hazardCategory: string, scoreAfter: number): Record<string, unknown> {
    const level = scoreAfter >= 20 ? 'critical' : scoreAfter >= 13 ? 'high' : scoreAfter >= 6 ? 'medium' : 'low';
    return {
        record_id: recordId,
        assessment_scope: `Routine site operation (${hazardCategory})`,
        facility_id: 'SITE-A',
        assessment_date: '2026-08-10',
        assessment_type: 'periodic',
        assessor_id: 'ASR-001',
        industry_profile: 'manufacturing',
        hazards: [{
            hazard_id: `${recordId}-H1`,
            hazard_description: hazardDescription,
            hazard_category: hazardCategory,
            likelihood_before: 'likely',
            severity_before: 'major',
            risk_level_before: 'critical',
            risk_score_before: 20,
            control_measures: [{
                control_type: 'engineering',
                control_description: 'Engineering control applied at source',
                status: 'implemented',
            }],
            risk_level_after: level,
            risk_score_after: scoreAfter,
        }],
        overall_risk_level: level,
        legal_basis: ['OSHA-KR Art.36 §1', 'SAPA Art.4', 'MOEL 위험성평가 고시'],
        e_signature: {
            required: true,
            signer_id: 'ASR-001',
            signer_role: 'production_manager',
            signature_timestamp: '2026-08-10T09:00:00+09:00',
            signature_meaning: 'execution',
            cryptographic_hash: null,
        },
        nomenclature: {
            key_en: 'workplace_risk_assessment_record',
            display_name_ko: '위험성평가 기록',
            display_name_en: 'Workplace Risk Assessment Record',
            regulatory_term_ko: '산업안전보건법 제36조 위험성평가',
            synonyms: ['위험성평가 실시 기록'],
        },
        audit_trail: {
            created_at: new Date().toISOString(),
            created_by: 'test-fixture',
            record_status: 'active',
        },
    };
}

function writeRa(recordId: string, hazardDescription: string, hazardCategory: string, scoreAfter: number): void {
    fs.writeFileSync(
        sb('memory', 'assessments', `${recordId}.json`),
        JSON.stringify(raFixture(recordId, hazardDescription, hazardCategory, scoreAfter), null, 2) + '\n',
        'utf-8',
    );
}

// ── state readers ─────────────────────────────────────────────────────────────

function listBucket(dirParts: string[], pattern: RegExp): string[] {
    const dir = sb(...dirParts);
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => pattern.test(f)).sort() : [];
}

const trainRecords = (): string[] =>
    listBucket(['memory', 'training'], /^TRAIN-[A-Z]+-[0-9]{4}-[0-9]{4}\.json$/);
const registers = (): string[] =>
    listBucket(['memory', 'registers'], /^RR-[0-9]{4}-[0-9]{4}\.json$/);

function readRegister(file: string): any {
    return JSON.parse(fs.readFileSync(sb('memory', 'registers', file), 'utf-8'));
}

function clip(text: string, max = 600): string {
    const t = text.replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max)}…` : t || '(empty)';
}

// ── main ──────────────────────────────────────────────────────────────────────

setupSandbox();

const signedAt = localToday();
const ROLLUP_SIGNOFF_ARGS = [
    '--facility', 'SITE-A',
    '--manager-id', 'MGR-100',
    '--signer-id', 'MGR-100',
    '--signed-at', signedAt,
];

console.log(`${CYAN}=== Runtime Tools Integration Test ===${RESET}\n`);
console.log(`       repo:    ${REPO}`);
console.log(`       sandbox: ${SANDBOX}\n`);

// T-01 ~ T-03: training-ingest happy path
console.log(`${CYAN}[T-01 ~ T-03] training-ingest happy path${RESET}`);
const happyCsv = sb('fixtures', 'training-happy.csv');
writeCsv(happyCsv, [CSV_HEADER, CSV_ROW_REGULAR, CSV_ROW_SUPERVISOR]);

const runHappy = runTool('scripts/training-ingest.ts', ['--input', happyCsv]);
record('T-01', 'happy-path ingestion exits 0', runHappy.exitCode === 0,
    `exit=${runHappy.exitCode}; out=${clip(runHappy.stdout)}; err=${clip(runHappy.stderr)}`);

const filesAfterHappy = trainRecords();
record('T-02', 'exactly 2 TRAIN-*.json records created', filesAfterHappy.length === 2,
    `found ${filesAfterHappy.length}: ${filesAfterHappy.join(', ') || '(none)'}`);

const hasReg = filesAfterHappy.some(f => /^TRAIN-REG-[0-9]{4}-[0-9]{4}\.json$/.test(f));
const hasSup = filesAfterHappy.some(f => /^TRAIN-SUP-[0-9]{4}-[0-9]{4}\.json$/.test(f));
record('T-03', 'IDs carry expected type prefixes (REG + SUP)', hasReg && hasSup,
    `REG=${hasReg}, SUP=${hasSup}; files: ${filesAfterHappy.join(', ')}`);

// T-04: strict signature policy
console.log(`\n${CYAN}[T-04] Strict signature rejection (missing signed_at)${RESET}`);
const badCsv = sb('fixtures', 'training-missing-signed-at.csv');
writeCsv(badCsv, [CSV_HEADER, CSV_ROW_REGULAR, CSV_ROW_MISSING_SIGNED_AT]);

const runBad = runTool('scripts/training-ingest.ts', ['--input', badCsv]);
const badOutput = runBad.stdout + runBad.stderr;
record('T-04', 'row without signed_at rejected (exit 1, still 2 records, error names signed_at)',
    runBad.exitCode === 1 && trainRecords().length === 2 && badOutput.includes('signed_at'),
    `exit=${runBad.exitCode}; records=${trainRecords().length}; mentions_signed_at=${badOutput.includes('signed_at')}; out=${clip(badOutput)}`);

// T-05: dedupe
console.log(`\n${CYAN}[T-05] Dedupe rerun${RESET}`);
const runDup = runTool('scripts/training-ingest.ts', ['--input', happyCsv]);
const dupSummaryOk = runDup.stdout.includes('0 written, 2 skipped, 0 failed');
record('T-05', 'duplicate rerun skips both rows and writes nothing (exit 0)',
    runDup.exitCode === 0 && dupSummaryOk && trainRecords().length === 2,
    `exit=${runDup.exitCode}; summary_ok=${dupSummaryOk}; records=${trainRecords().length}; out=${clip(runDup.stdout)}`);

// T-06 ~ T-08: risk-register-rollup + safety-audit
console.log(`\n${CYAN}[T-06 ~ T-08] Risk register rollup + audit${RESET}`);
writeRa('RA-2026-0001', 'Unguarded rotating pump coupling', 'mechanical', 16);
writeRa('RA-2026-0002', 'Solvent vapor accumulation in mixing room', 'chemical', 22);

const runNoSignoff = runTool('scripts/risk-register-rollup.ts', ['--facility', 'SITE-A']);
record('T-06', 'rollup without manager sign-off args exits 1 and writes nothing',
    runNoSignoff.exitCode === 1 && registers().length === 0,
    `exit=${runNoSignoff.exitCode}; registers=${registers().length}; err=${clip(runNoSignoff.stderr)}`);

const runRollup = runTool('scripts/risk-register-rollup.ts', ROLLUP_SIGNOFF_ARGS);
record('T-07a', 'rollup with manager sign-off exits 0', runRollup.exitCode === 0,
    `exit=${runRollup.exitCode}; out=${clip(runRollup.stdout)}; err=${clip(runRollup.stderr)}`);

const regFiles = registers();
record('T-07b', 'exactly one RR-*.json register created', regFiles.length === 1,
    `found ${regFiles.length}: ${regFiles.join(', ') || '(none)'}`);

if (regFiles.length === 1) {
    const reg = readRegister(regFiles[0]);
    record('T-07c', 'high_critical_count == 2', reg.high_critical_count === 2,
        `got ${reg.high_critical_count}`);

    const levels = new Set<string>((reg.risk_entries ?? []).map((e: any) => e.current_risk_level));
    record('T-07d', 'entry bands are exactly {high, critical}',
        levels.size === 2 && levels.has('high') && levels.has('critical'),
        `levels=${[...levels].join(', ') || '(none)'}`);

    const expectedReview = addDays(localToday(), 364);
    const reviewDelta = reg.next_review_date ? dayDiff(expectedReview, reg.next_review_date) : NaN;
    record('T-07e', `next_review_date ~ +364 days (expected ≈ ${expectedReview})`,
        Number.isFinite(reviewDelta) && Math.abs(reviewDelta) <= 1,
        `got ${reg.next_review_date ?? '(missing)'}, delta=${Number.isFinite(reviewDelta) ? reviewDelta : 'NaN'}d`);
} else {
    record('T-07c', 'high_critical_count == 2', false, 'register file missing');
    record('T-07d', 'entry bands are exactly {high, critical}', false, 'register file missing');
    record('T-07e', 'next_review_date ~ +364 days', false, 'register file missing');
}

const runAudit = runTool('scripts/safety-audit.ts', []);
const auditOut = runAudit.stdout + runAudit.stderr;
record('T-08a', 'safety-audit passes the sandbox (exit 0)', runAudit.exitCode === 0,
    `exit=${runAudit.exitCode}; out=${clip(auditOut, 900)}`);
record('T-08b', 'audit counts "2 training record(s)"', auditOut.includes('2 training record(s)'),
    clip(auditOut, 300));
record('T-08c', 'audit counts "1 register(s)"', auditOut.includes('1 register(s)'),
    clip(auditOut, 300));
record('T-08d', 'audit reports "0 errors"', auditOut.includes('0 errors'), clip(auditOut, 300));

// T-09: merge preservation
console.log(`\n${CYAN}[T-09] Merge preserves human-set fields${RESET}`);
const targetRegFile = regFiles[0];
const mutated = readRegister(targetRegFile);
const preservedEntry = (mutated.risk_entries ?? []).find((e: any) => e.source_assessment_ref === 'RA-2026-0001');
preservedEntry.control_status = 'implemented';
fs.writeFileSync(
    sb('memory', 'registers', targetRegFile),
    JSON.stringify(mutated, null, 2) + '\n',
    'utf-8',
);
writeRa('RA-2026-0003', 'Noise exposure near compressor room', 'noise', 8);

const runMerge = runTool('scripts/risk-register-rollup.ts', ROLLUP_SIGNOFF_ARGS);
record('T-09a', 'merge rerun exits 0', runMerge.exitCode === 0,
    `exit=${runMerge.exitCode}; out=${clip(runMerge.stdout)}; err=${clip(runMerge.stderr)}`);

const regFilesAfterMerge = registers();
record('T-09b', 'merge targets the existing register (no new file)',
    regFilesAfterMerge.length === 1 && regFilesAfterMerge[0] === targetRegFile,
    `before=${targetRegFile}; after=${regFilesAfterMerge.join(', ') || '(none)'}`);

if (regFilesAfterMerge.length === 1) {
    const merged = readRegister(regFilesAfterMerge[0]);
    const kept = (merged.risk_entries ?? []).find((e: any) => e.source_assessment_ref === 'RA-2026-0001');
    const added = (merged.risk_entries ?? []).find((e: any) => e.source_assessment_ref === 'RA-2026-0003');
    record('T-09c', "human-set control_status 'implemented' survives merge",
        kept?.control_status === 'implemented', `got ${kept?.control_status ?? '(entry missing)'}`);
    record('T-09d', 'entry count grows to 3 after adding RA-2026-0003',
        (merged.risk_entries ?? []).length === 3,
        `got ${(merged.risk_entries ?? []).length}`);
    record('T-09e', 'new entry appended with default control_status',
        added?.current_risk_level === 'medium' && added?.control_status === 'planned',
        `level=${added?.current_risk_level ?? '(missing)'}, status=${added?.control_status ?? '(missing)'}`);
} else {
    record('T-09c', 'human-set control_status preserved', false, 'register file missing');
    record('T-09d', 'entry count grows to 3', false, 'register file missing');
    record('T-09e', 'new entry appended with default control_status', false, 'register file missing');
}

// ── Report ────────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;

if (failed === 0) {
    fs.rmSync(SANDBOX, { recursive: true, force: true });
    console.log(`\n${GREEN}sandbox cleaned up${RESET}`);
} else {
    console.log(`\n${YELLOW}⚠ sandbox KEPT for debugging: ${SANDBOX}${RESET}`);
}

console.log(`\n${CYAN}=== Test Report ===${RESET}`);
console.log(`  Passed: ${GREEN}${passed}${RESET}`);
console.log(`  Failed: ${RED}${failed}${RESET}`);
console.log(`  Total:  ${results.length}\n`);

if (failed === 0) {
    console.log(`${GREEN}✅ runtime-tools integration test PASSED${RESET}`);
    process.exit(0);
} else {
    console.log(`${RED}❌ runtime-tools integration test FAILED${RESET}`);
    process.exit(1);
}
