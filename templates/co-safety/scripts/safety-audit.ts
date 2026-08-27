#!/usr/bin/env bun
/**
 * Safety OS Audit Script
 * Validates schema.yaml files in workflows,
 * regulations mcp configurations, and evidence-models refs.
 *
 * v2.1.0 (2026-06-17): Added GMP module validation — multi-source legal_basis,
 *   e_signature, qrm_assessment, nomenclature, and role separation checks.
 * v2.2.0 (2026-06-17): Updated paths for domain-based folder structure
 *   (workflows/domains/gmp/, agents/_shared/, skills/domains/gmp/qrm/).
 * v2.3.0 (2026-06-17): Added MSDS module validation — multi-source legal_basis
 *   (≥3 stricter than GMP), ghs_version field, reference workflow exception.
 * v2.4.0 (2026-06-17): Added GDP module validation — gdp_certification_status,
 *   temperature_condition, batch_disposition_approved_ref fields.
 * v2.5.0 (2026-06-17): Added GLP module validation — glp_certification_authority,
 *   oecd_mad_applicable, study_director_id, msds_record_ref fields.
 * v2.6.0 (2026-06-17): Added GCP module validation — irb_approval_ref,
 *   ich_e6_compliance, protocol_ref, site_id fields.
 * v2.7.0 (2026-06-17): Added GVP module validation — ich_e2_compliance,
 *   pbrer_cycle_ref, product_id, rmp_version_ref fields.
 * v2.8.0 (2026-06-18): Added ehsconst (Construction Safety) module validation —
 *   sapa_article_5_compliance, project_id, contractor_tier, safety_officer_in_charge.
 * v2.9.0 (2026-06-18): Added gasterm (Gas Terminal) + powergen (Power Generation)
 *   module validation. gasterm: facility_type, kgs_inspection_status, psm_applicable,
 *   gas_type. powergen: plant_type, kesa_inspection_status, voltage_class.
 * v3.0.0 (2026-06-18): Added ehschem + meddevice validation, generic domain helpers.
 * v3.1.0 (2026-06-19): Added cross-domain reference integrity validation —
 *   validates cross-domain reference fields, uses_functional_services, applicable_industries.
 * v4.0.0 (2026-06-20): Full generalization — removed all hardcoded per-domain blocks,
 *   replaced with config-driven loop over DOMAINS from domain-config.ts.
 *   CROSS_DOMAIN_REFS and KNOWN_INDUSTRIES imported from domain-config.ts.
 *   validateDomainWorkflow now accepts tier parameter.
 * v4.1.0 (2026-06-20): Added docs/_shared bilingual pair-consistency check —
 *   enforces the <name>.md (EN canonical) + <name>_ko.md (KO mirror) convention.
 *   Every markdown file in docs/_shared/ must have its language partner.
 * v4.3.0 (2026-07-11): Closed audit coverage gap — workflows/daily/**,
 *   workflows/emergency/**, workflows/compliance/**, and any other tree outside
 *   workflows/domains/** now get the same array+minItems(≥3) legal_basis
 *   validation that registered domains get (previously only a truthy check
 *   applied). Added risk-assessment-agent ↔ psm-agent role-separation check,
 *   mirroring the existing risk-assessment-agent ↔ gmp-qrm check.
 * v4.3.1 (2026-08-07): Effective legal_basis resolution for the
 *   `references:` pattern (REFERENCE-SPEC.md §4). When an industry schema
 *   declares a `references:` block instead of a top-level legal_basis
 *   (e.g. cosmetics/tbm thin reference to workflows/_shared/tbm/), the audit
 *   now loads the shared base schema, applies overrides.legal_basis.add
 *   (append, de-duped) and overrides.legal_basis.replace (substitute), and
 *   validates the resulting effective list against the ≥3 floor. Both the
 *   top-level workflow scan and validateDomainWorkflow use the resolver.
 *   Missing/unreadable shared schemas produce a named error (no crash).
 * v4.4.0 (2026-08-23): Added memory record validation — actual instance records
 *   under memory/findings/ and memory/corrective-actions/ are now validated
 *   against their base schemas (evidence-models/_shared/base/finding.schema.json,
 *   corrective-action.schema.json) with $ref chain resolution into
 *   common.schema.json definitions. Previously only the schema FILES were
 *   checked; record instances were never validated. Per-file errors follow the
 *   existing `<rel>: <message>` style and count toward the exit code.
 * v4.5.0 (2026-08-23): Added regulation staleness detection (WARN-only) —
 *   regulation YAML files with a last_updated older than 90 days from the run
 *   date, or with no parsable last_updated at all, are reported in a warnings
 *   summary section. Warnings NEVER affect the error count or exit code; they
 *   surface review-debt only (e.g. industry-regulatory-anchors.yaml has no
 *   last_updated field).
 * v4.6.0 (2026-08-24): Extracted the hand-rolled draft-07 record validator
 *   into scripts/lib/evidence-validator.ts (behavior-neutral refactor —
 *   shared errors closure replaced by an explicit error-sink parameter;
 *   external-$ref memo cache moved to module state). Memory-record bucket
 *   config generalized to full schema paths relative to ROOT. Added three
 *   new memory buckets: memory/training (training-record.json),
 *   memory/assessments (risk-assessment-record.json), memory/registers
 *   (risk-register-record.json).
 * v4.7.0 (2026-08-24): Widened applicable_industries vocabulary validation
 *   from PSM-only to ALL workflow schemas — the KNOWN_INDUSTRIES check now
 *   runs in the main scan loop over workflows/** schema.yaml instead of a
 *   dedicated PSM directory pass (removed; it had been triple-counting PSM
 *   schemas in totalChecked, so the reported file count drops 1035 -> 1020
 *   with identical unique coverage). Survey of all 213 validated schemas
 *   found every distinct applicable_industries value already present in
 *   KNOWN_INDUSTRIES (21/21), so domain-config.ts needed no additions.
 * v4.8.0 (2026-08-26): Extended the legal-basis gate to two previously
 *   unchecked surfaces, both emitted as WARN-only initially (phased rollout
 *   per the v4.5.0 staleness precedent — visible in CI without breaking it):
 *   (a) SKILL.md frontmatter — every skill under skills/ (SSOT) and
 *   .agents/skills/, de-duplicated by frontmatter `name:` (SSOT wins), must
 *   declare a legal_basis array with >= 3 entries; (b) variant.json
 *   skill_manifest.variant_specific[*].legal_basis must be an array of >= 3
 *   strings, each citing a specific article (제N조 / Article N); vague
 *   citations containing '전반' are flagged.
 * v4.9.0 (2026-08-26): Skill legal-basis gate noise reduction — skills whose
 *   frontmatter declares metadata.type: 'process' (platform tooling: meeting,
 *   sync, project-review, translate, team-builder, agent/script/skill lifecycle
 *   managers) are now exempt from the statutory gate. These skills orchestrate
 *   AI-team workflows, not EHS regulatory obligations, so a >= 3 Korean-statute
 *   floor does not apply. The gate stays fully active for all EHS/domain skills.
 * v4.9.1 (2026-08-26): Gate parser resolves legal_basis tolerantly — accepts
 *   the array at top-level OR nested inside the frontmatter metadata: block
 *   (the convention used by daily/risk-assessment and
 *   shipbuilding/painting-coating-fire-toxic-planner), eliminating ~52 false
 *   missing-field warnings. SPECIFIC_ARTICLE_RE extended to accept named
 *   ministerial instruments: 「...」 bracketed titles and entries citing
 *   고시 / 지침 / 별표 (e.g. '고용노동부 고시 「사업장 위험성평가에 관한 지침」').
 * v4.10.0 (2026-08-26): Live-primary coordinate registry migration support
 *   (all WARN-only, zero-error by construction): (a) skill-gate exemption
 *   extended to frontmatter metadata.type: 'legal-research' (k-law research
 *   instrument — alongside the existing 'process' exemption); (b) coordinate
 *   registry migration tracking over regulations/KR/*.yaml — files declaring
 *   top-level `mode: coordinates` are counted against the KR total and, while
 *   unconverted files remain, ONE aggregate warning is emitted
 *   ('X/Y converted to coordinate mode'); tolerant of the concurrent pilot
 *   conversion (OSHA-KR/SAPA), never per-file, never an error; (c) aggregate
 *   coordinate-freshness warning — coordinate-mode files whose
 *   source_verification.checked_at predates their own next_review date, or
 *   is older than 180 days when no review date exists, are counted with up
 *   to 3 example filenames — a coordinate file is overdue when its
 *   source_verification.checked_at predates its own next_review date once
 *   that review window has passed, or is older than 180 days when no review
 *   date exists. Legacy-mode files bypass the freshness check
 *   entirely (their v4.5.0 last_updated staleness logic is untouched).
 * v4.10.1 (2026-08-26): source_mcp provenance check retired — the
 *   mcp_kr_legislation MCP server was removed 2026-08-26 (superseded by
 *   the k-law skill, 법제처 Open API). v2 coordinate registries are now
 *   validated via source_verification (non-empty method + parseable
 *   checked_at). Legacy `source_mcp`/`last_updated` fields are tolerated
 *   in legacy-mode files without error.
 *
 * @version 4.10.1
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { DOMAINS, CROSS_DOMAIN_REFS, KNOWN_INDUSTRIES, DEFAULT_MIN_WORKFLOW_LEGAL_BASIS } from './domain-config.ts';
import { validateRecordValue } from './lib/evidence-validator.ts';

// Color helpers
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const ROOT = path.resolve(process.cwd());

let totalChecked = 0;
const errors: string[] = [];

// ── Regulation staleness detection (v4.5.0, WARN-only) ───────────────────────
const STALENESS_DAYS = 90;
const warnings: string[] = [];

function checkRegulationStaleness(rel: string, lastUpdated: unknown): void {
    // js-yaml resolves plain (unquoted) ISO dates to JS Date objects; quoted
    // dates stay strings. Accept both before declaring the field unparsable.
    let ts: number | null = null;
    let display: string;
    if (lastUpdated instanceof Date) {
        ts = lastUpdated.getTime();
        display = lastUpdated.toISOString().slice(0, 10);
    } else if (typeof lastUpdated === 'string') {
        const parsed = Date.parse(lastUpdated);
        if (!Number.isNaN(parsed)) {
            ts = parsed;
            display = lastUpdated;
        }
    } else {
        display = String(lastUpdated);
    }
    if (ts === null) {
        warnings.push(`${rel}: no parsable last_updated field (staleness unknown)`);
        return;
    }
    const ageDays = Math.floor((Date.now() - ts) / 86400000);
    if (ageDays > STALENESS_DAYS) {
        warnings.push(`${rel}: last_updated ${display} is ${ageDays} days old (> ${STALENESS_DAYS})`);
    }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function walkDirExact(dir: string, filename: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '_template') continue;
            results.push(...walkDirExact(full, filename));
        } else if (entry.isFile() && entry.name === filename) {
            results.push(full);
        }
    }
    return results;
}

function walkDirExt(dir: string, ext: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '_template') continue;
            results.push(...walkDirExt(full, ext));
        } else if (entry.isFile() && entry.name.endsWith(ext)) {
            results.push(full);
        }
    }
    return results;
}

function relPath(full: string): string {
    return path.relative(ROOT, full).replace(/\\/g, '/');
}

// ── Effective legal_basis resolution (REFERENCE-SPEC.md §4) ──────────────────
// Industry schemas may declare a `references:` block (thin pointer to a shared
// workflow base under workflows/_shared/) instead of a top-level `legal_basis`.
// This resolver returns the effective legal_basis array for audit:
//   1. If the schema has a top-level `legal_basis` array → return it (legacy).
//   2. Else if the schema has a `references:` block → load each referenced
//      shared `schema.yaml`, start from its `legal_basis`, then apply
//      `overrides.legal_basis.replace` (substitute) and/or `.add` (append,
//      de-duplicated). Multiple references accumulate.
//   3. Else → return { basis: null } (caller reports "missing legal_basis").
// Missing/unreadable shared schemas produce a named error in `refErrors`
// (callers merge it into their error list) — never throws.
function resolveEffectiveLegalBasis(
    doc: any,
    schemaFile: string,
    rel: string,
): { basis: string[] | null; refErrors: string[] } {
    const refErrors: string[] = [];

    // Fast path: top-level legal_basis wins — identical to pre-4.3.1 behavior.
    if (Array.isArray(doc.legal_basis)) {
        return { basis: doc.legal_basis, refErrors };
    }

    const references = Array.isArray(doc.references) ? doc.references : [];
    if (references.length === 0) {
        return { basis: null, refErrors };
    }

    const accumulated: string[] = [];
    let resolvedAny = false;

    for (const ref of references) {
        if (!ref || typeof ref.shared !== 'string') continue;

        // spec §3.3: `shared` is a directory path (no extension) relative to
        // the industry schema.yaml; the shared schema lives at <shared>/schema.yaml.
        const sharedDir = path.resolve(path.dirname(schemaFile), ref.shared);
        const sharedSchemaPath = path.join(sharedDir, 'schema.yaml');
        if (!fs.existsSync(sharedSchemaPath)) {
            refErrors.push(`${rel}: references.shared does not resolve to a schema.yaml -> ${ref.shared}`);
            continue;
        }

        let sharedDoc: any;
        try {
            sharedDoc = yaml.load(fs.readFileSync(sharedSchemaPath, 'utf-8')) as any;
        } catch (e: any) {
            refErrors.push(`${rel}: references.shared schema.yaml parse error (${ref.shared}) - ${e.message}`);
            continue;
        }

        if (!sharedDoc || !Array.isArray(sharedDoc.legal_basis)) {
            // Shared schema contributes no legal_basis; nothing to merge.
            continue;
        }

        resolvedAny = true;

        const lbOverride =
            ref.overrides && typeof ref.overrides === 'object' ? ref.overrides.legal_basis : null;

        // spec §4: replace substitutes the shared base entirely; otherwise the
        // base is inherited additively (default — never accidentally removed).
        if (lbOverride && Array.isArray(lbOverride.replace)) {
            for (const item of lbOverride.replace) {
                if (!accumulated.includes(item)) accumulated.push(item);
            }
        } else {
            for (const item of sharedDoc.legal_basis) {
                if (!accumulated.includes(item)) accumulated.push(item);
            }
        }

        // spec §4.1: `add` appends industry-specific statutes (de-duplicated).
        if (lbOverride && Array.isArray(lbOverride.add)) {
            for (const item of lbOverride.add) {
                if (!accumulated.includes(item)) accumulated.push(item);
            }
        }
    }

    return { basis: resolvedAny ? accumulated : null, refErrors };
}

// ── scan workflows ────────────────────────────────────────────────────────────

console.log(`${CYAN}=== safety-audit.ts - Safety OS Audit check ===${RESET}\n`);

const workflowDir = path.join(ROOT, 'workflows');
const schemaFiles = walkDirExact(workflowDir, 'schema.yaml');

const VALID_STATUSES = ['active', 'template', 'deprecated'];
const VALID_APPLICABILITIES = ['mandatory', 'optional'];

for (const file of schemaFiles) {
    totalChecked++;
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);
    try {
        const doc = yaml.load(content) as any;
        if (!doc) {
            errors.push(`${rel}: empty or invalid yaml`);
            continue;
        }

        // v4.7.0: applicable_industries vocabulary check — previously enforced
        // only on PSM schemas via a dedicated directory pass; now applies to
        // every workflow schema tree (daily/emergency/compliance/domains).
        if (doc?.applicable_industries) {
            const industries = Array.isArray(doc.applicable_industries) ? doc.applicable_industries : [];
            for (const ind of industries) {
                if (!KNOWN_INDUSTRIES.includes(ind)) {
                    errors.push(`${rel}: applicable_industries references unknown industry '${ind}'`);
                }
            }
        }

        // v4.3.1: resolve effective legal_basis via REFERENCE-SPEC.md §4 —
        // supports the thin-reference pattern (references: block pointing to a
        // shared workflow under workflows/_shared/) used by cosmetics/tbm etc.
        const { basis: effectiveLegalBasis, refErrors } = resolveEffectiveLegalBasis(doc, file, rel);
        errors.push(...refErrors);

        if (!effectiveLegalBasis) {
            errors.push(`${rel}: missing legal_basis`);
        } else if (!rel.includes('workflows/domains/')) {
            // workflows/domains/** gets array+minItems validation from
            // validateDomainWorkflow below (per-domain thresholds). Everything else
            // (workflows/daily/**, workflows/emergency/**, workflows/compliance/**,
            // and any future non-domain-registered tree) previously only got the
            // truthy check above and silently bypassed the CSO's ≥3-source gate —
            // enforce the same array+minItems policy here directly.
            const isReference = doc.workflow_type === 'reference';
            const reqMin = isReference ? 2 : DEFAULT_MIN_WORKFLOW_LEGAL_BASIS;
            if (!Array.isArray(effectiveLegalBasis) || effectiveLegalBasis.length < reqMin) {
                errors.push(`${rel}: workflow requires multi-source legal_basis (≥${reqMin})`);
            }
        }

        if (!doc.status || !VALID_STATUSES.includes(doc.status)) {
            errors.push(`${rel}: invalid or missing status ('${doc.status}')`);
        }

        if (!doc.applicability || !VALID_APPLICABILITIES.includes(doc.applicability)) {
            errors.push(`${rel}: invalid or missing applicability ('${doc.applicability}')`);
        }

    } catch (e: any) {
        errors.push(`${rel}: YAML parsing error - ${e.message}`);
    }
}

// ── scan regulations ──────────────────────────────────────────────────────────
const regDir = path.join(ROOT, 'regulations');
const regFiles = walkDirExt(regDir, '.yaml');

// ── Coordinate registry mode tracking (v4.10.0, WARN-only aggregate) ────────
// During the live-primary registry migration, regulations/KR/*.yaml files may
// be legacy or `mode: coordinates`. Both modes are tolerated (the pilot
// conversion of OSHA-KR/SAPA runs concurrently): counts feed a single
// aggregate migration warning plus an aggregate coordinate-freshness warning.
// This check can never produce an error.
const COORDINATE_STALE_DAYS = 180;
const coordinateTracker = { total: 0, converted: 0, stale: [] as string[] };

function toDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

for (const file of regFiles) {
    totalChecked++;
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);
    try {
        const doc = yaml.load(content) as any;
        if (!doc) {
            errors.push(`${rel}: empty or invalid yaml`);
            continue;
        }
        // v4.10.1: provenance validation via source_verification. The
        // mcp_kr_legislation MCP server was removed 2026-08-26 (superseded by
        // the k-law skill — 법제처 Open API), so the legacy `source_mcp`
        // field is no longer validated and remains tolerated in legacy-mode
        // files without error. v2 coordinate registries must carry
        // source_verification with a non-empty method and a parseable
        // checked_at.
        if (doc.mode === 'coordinates') {
            const method = doc.source_verification?.method;
            if (typeof method !== 'string' || method.trim() === '') {
                errors.push(`${rel}: v2 coordinate registry requires non-empty source_verification.method`);
            }
            if (toDate(doc.source_verification?.checked_at) === null) {
                errors.push(`${rel}: v2 coordinate registry requires parseable source_verification.checked_at`);
            }
        }
        // v4.5.0: staleness reporting — warnings only, never counted as errors.
        checkRegulationStaleness(rel, doc.last_updated);
        // v4.10.0: coordinate-mode tracking + freshness — legacy files skip
        // this block entirely; their staleness logic above is untouched.
        if (rel.startsWith('regulations/KR/')) {
            const basename = rel.split('/').pop() ?? '';
            if (['legal-glossary.yaml', 'industry-regulatory-anchors.yaml', 'Environmental-Discharge.yaml', 'Chemical-Plant-Safety.yaml'].includes(basename)) {
                continue;
            }
            coordinateTracker.total++;
            if (doc.mode === 'coordinates') {
                coordinateTracker.converted++;
                const checkedAt = toDate(doc.source_verification?.checked_at);
                const nextReview = toDate(doc.source_verification?.next_review ?? doc.next_review);
                if (checkedAt !== null) {
                    // Overdue when the declared review window has been crossed
                    // without a fresher re-check (checked_at predates a
                    // next_review that has since passed), or when no review
                    // date exists and the last check is >180 days old.
                    const crossed = nextReview !== null
                        && nextReview.getTime() < Date.now()
                        && checkedAt.getTime() < nextReview.getTime();
                    const aged = nextReview === null
                        && (Date.now() - checkedAt.getTime()) / 86400000 > COORDINATE_STALE_DAYS;
                    if (crossed || aged) coordinateTracker.stale.push(rel);
                }
            }
        }
    } catch (e: any) {
        errors.push(`${rel}: YAML parsing error - ${e.message}`);
    }
}

// v4.10.0: ONE aggregate migration warning (only while X < Y — silent once the
// conversion completes) and ONE aggregate coordinate-freshness warning with up
// to 3 example filenames — never per-file spam.
if (coordinateTracker.total > 0 && coordinateTracker.converted < coordinateTracker.total) {
    warnings.push(`regulation registries: ${coordinateTracker.converted}/${coordinateTracker.total} converted to coordinate mode (migration pending — see docs/_meta/registry-schema-v2.md)`);
}
if (coordinateTracker.stale.length > 0) {
    const examples = coordinateTracker.stale.slice(0, 3).map(r => r.split('/').pop()).join(', ');
    warnings.push(`coordinate-mode registries: ${coordinateTracker.stale.length} overdue for source re-verification (e.g. ${examples})`);
}

// ── scan evidence-models ──────────────────────────────────────────────────────
const evidenceDir = path.join(ROOT, 'evidence-models');
const evidenceFiles = walkDirExt(evidenceDir, '.json');

function findRefs(obj: any, refs: string[]) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.$ref && typeof obj.$ref === 'string') {
        refs.push(obj.$ref);
    }
    for (const key of Object.keys(obj)) {
        findRefs(obj[key], refs);
    }
}

for (const file of evidenceFiles) {
    totalChecked++;
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);
    try {
        const doc = JSON.parse(content);
        const refs: string[] = [];
        findRefs(doc, refs);
        for (const ref of refs) {
            // Strip # pointer if any
            const filePathPart = ref.split('#')[0];
            if (!filePathPart) continue; // internal ref

            const resolvedPath = path.resolve(path.dirname(file), filePathPart);
            if (!fs.existsSync(resolvedPath)) {
                errors.push(`${rel}: missing linked schema file -> ${filePathPart}`);
            }
        }
    } catch (e: any) {
        errors.push(`${rel}: JSON parsing error - ${e.message}`);
    }
}

// ── Memory record validation (v4.4.0, generalized v4.6.0) ────────────────────
// Validates instance RECORDS under memory/<bucket>/ against their schemas.
// Bucket entries carry full schema paths relative to ROOT (v4.6.0 — previously
// hardcoded to evidence-models/_shared/base/). The draft-07 subset validator
// lives in scripts/lib/evidence-validator.ts (no ajv dependency); its error
// sink is passed explicitly so messages land in this script's errors[] array.

const memoryRecordChecks = [
    { dir: 'memory/findings', schemaPath: 'evidence-models/_shared/base/finding.schema.json', label: 'findings', unit: 'finding(s)' },
    { dir: 'memory/corrective-actions', schemaPath: 'evidence-models/_shared/base/corrective-action.schema.json', label: 'corrective-actions', unit: 'corrective action(s)' },
    { dir: 'memory/training', schemaPath: 'evidence-models/domains/functional/training/training-record.json', label: 'training', unit: 'training record(s)' },
    { dir: 'memory/assessments', schemaPath: 'evidence-models/domains/functional/risk-assessment/risk-assessment-record.json', label: 'assessments', unit: 'assessment(s)' },
    { dir: 'memory/registers', schemaPath: 'evidence-models/domains/functional/risk-assessment/risk-register-record.json', label: 'registers', unit: 'register(s)' },
];
const memoryRecordCounts: Record<string, number> = {};

for (const check of memoryRecordChecks) {
    memoryRecordCounts[check.label] = 0;
    const schemaPath = path.join(ROOT, check.schemaPath);
    const bucketDir = path.join(ROOT, check.dir);
    let schema: any = null;
    try {
        schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    } catch (e: any) {
        errors.push(`${check.schemaPath}: cannot load schema for memory-record validation - ${e.message}`);
    }
    if (!schema || !fs.existsSync(bucketDir)) continue;

    for (const entry of fs.readdirSync(bucketDir)) {
        if (!entry.endsWith('.json')) continue; // skip session notes (*.md)
        const file = path.join(bucketDir, entry);
        totalChecked++;
        memoryRecordCounts[check.label]++;
        const rel = relPath(file);
        try {
            const doc = JSON.parse(fs.readFileSync(file, 'utf-8'));
            validateRecordValue(doc, schema, { rel, path: '$', rootDoc: schema, baseDir: path.dirname(schemaPath) }, errors);
        } catch (e: any) {
            errors.push(`${rel}: JSON parsing error - ${e.message}`);
        }
    }
}

// ── Role separation check (risk-assessment-agent vs gmp-qrm) ─────────────────
// Per meeting 2026-06-17 Q3 resolution: explicit role separation between EHS
// (risk-assessment-agent) and quality (gmp-qrm skill) risk domains.
// v2.2.0: Paths updated for domain-based folder structure.
const riskAgentPath = path.join(ROOT, 'agents', '_shared', 'risk-assessment-agent.md');
if (fs.existsSync(riskAgentPath)) {
    totalChecked++;
    const content = fs.readFileSync(riskAgentPath, 'utf-8');
    // Accept either legacy `gmp-qrm` or new `gmp/qrm` path reference
    const hasQrmRef = content.includes('gmp-qrm') || content.includes('gmp/qrm');
    if (!hasQrmRef || !content.toLowerCase().includes('product quality')) {
        errors.push('agents/_shared/risk-assessment-agent.md: missing gmp-qrm/gmp/qrm scope separation reference (required per meeting 2026-06-17)');
    }
}

const qrmSkillPath = path.join(ROOT, 'skills', 'domains', 'industry', 'gmp', 'qrm', 'SKILL.md');
if (fs.existsSync(qrmSkillPath)) {
    totalChecked++;
    const content = fs.readFileSync(qrmSkillPath, 'utf-8');
    if (!content.includes('risk-assessment-agent')) {
        errors.push('skills/domains/gmp/qrm/SKILL.md: missing risk-assessment-agent scope separation reference');
    }
}

// ── Role separation check (risk-assessment-agent vs psm-agent) ───────────────
// General EHS workplace risk (risk-assessment-agent) vs. process-safety hazard
// analysis (psm-agent PHA/HAZOP/MOC) must remain scoped separately to avoid
// hazard misclassification. psm-agent.md previously claimed this separation was
// "enforced the same way by safety-audit.ts" as the gmp-qrm check above — this
// makes that claim true.
const psmAgentPath = path.join(ROOT, 'agents', 'domains', 'functional', 'psm', 'psm-agent.md');
if (fs.existsSync(psmAgentPath)) {
    totalChecked++;
    const content = fs.readFileSync(psmAgentPath, 'utf-8');
    if (!content.includes('risk-assessment-agent')) {
        errors.push('agents/domains/functional/psm/psm-agent.md: missing risk-assessment-agent scope separation reference');
    }
}
if (fs.existsSync(riskAgentPath)) {
    totalChecked++;
    const content = fs.readFileSync(riskAgentPath, 'utf-8');
    if (!content.includes('psm-agent')) {
        errors.push('agents/_shared/risk-assessment-agent.md: missing psm-agent scope separation reference (general EHS risk vs. process safety)');
    }
}

// ── Domain-specific helper functions ─────────────────────────────────────────

function validateDomainWorkflow(domainName: string, requiredMin: number = 3, tier: string = 'industry'): string[] {
    const domainDir = path.join(workflowDir, 'domains', tier, domainName);
    const schemaFiles = walkDirExact(domainDir, 'schema.yaml');
    const errs: string[] = [];
    for (const file of schemaFiles) {
        totalChecked++;
        const content = fs.readFileSync(file, 'utf-8');
        const rel = relPath(file);
        try {
            const doc = yaml.load(content) as any;
            if (!doc) continue;
            // v4.3.1: resolve effective legal_basis (REFERENCE-SPEC.md §4) so
            // registered domains that adopt the thin-reference pattern (e.g.
            // ehsconst per spec §5) also pass the floor without duplicating
            // the resolver logic here.
            const { basis: effectiveLegalBasis, refErrors } = resolveEffectiveLegalBasis(doc, file, rel);
            errs.push(...refErrors);
            const isReference = doc.workflow_type === 'reference';
            const reqMin = isReference ? 2 : requiredMin;
            if (!Array.isArray(effectiveLegalBasis) || effectiveLegalBasis.length < reqMin) {
                errs.push(`${rel}: ${domainName} workflow requires multi-source legal_basis (≥${reqMin})`);
            }
            if (isReference && !doc.target_agent) {
                errs.push(`${rel}: ${domainName} reference workflow requires target_agent`);
            }
        } catch (e: any) {
            errs.push(`${rel}: YAML parsing error - ${e.message}`);
        }
    }
    return errs;
}

function validateDomainEvidence(domainName: string, requiredFields: string[], minLegalBasis: number = 3): { files: string[], errs: string[] } {
    const domainEvidence = evidenceFiles.filter(f => {
        const rp = relPath(f);
        return rp.includes(`domains/functional/${domainName}`) || rp.includes(`domains/industry/${domainName}`);
    });
    const errs: string[] = [];
    for (const file of domainEvidence) {
        totalChecked++;
        const content = fs.readFileSync(file, 'utf-8');
        const rel = relPath(file);
        try {
            const doc = JSON.parse(content);
            const props = doc.properties || {};
            for (const field of requiredFields) {
                if (!props[field]) {
                    errs.push(`${rel}: missing ${domainName} required field '${field}'`);
                }
            }
            const legalBasis = props.legal_basis;
            if (legalBasis && (!legalBasis.minItems || legalBasis.minItems < minLegalBasis)) {
                errs.push(`${rel}: ${domainName} legal_basis must have minItems ≥${minLegalBasis}`);
            }
        } catch (e: any) {
            errs.push(`${rel}: JSON parsing error - ${e.message}`);
        }
    }
    return { files: domainEvidence, errs };
}

// ── Generalized per-domain validation (v4.0.0) ─────────────────────────────
// All domains validated uniformly from domain-config.ts DOMAINS array.

const domainCounts: Record<string, { workflows: number; evidence: number }> = {};

for (const domain of DOMAINS) {
    // Workflow validation (skip if domain uses non-array legal_basis format)
    const wfErrs = domain.skip_workflow_validation
        ? []
        : validateDomainWorkflow(domain.name, domain.min_workflow_legal_basis, domain.tier);
    errors.push(...wfErrs);

    // Evidence model validation
    const evResult = validateDomainEvidence(domain.name, domain.required_evidence_fields, domain.min_legal_basis);
    errors.push(...evResult.errs);

    // Count for report
    const wfDir = path.join(workflowDir, 'domains', domain.tier, domain.name);
    domainCounts[domain.name] = {
        workflows: walkDirExact(wfDir, 'schema.yaml').length,
        evidence: evResult.files.length,
    };
}

// ── Cross-domain reference integrity (v3.1.0) ──────────────────────────────
// Validates that cross-domain reference fields in evidence models point to
// domains that actually exist in the 2-Tier folder structure.
console.log(`${CYAN}--- Cross-domain reference integrity ---${RESET}`);

for (const ref of CROSS_DOMAIN_REFS) {
    totalChecked++;
    // Verify source domain exists
    const sourceDir = path.join(ROOT, 'evidence-models', 'domains', ref.fromTier, ref.fromDomain);
    if (!fs.existsSync(sourceDir)) {
        errors.push(`cross-ref: source domain ${ref.fromTier}/${ref.fromDomain} missing for field '${ref.field}'`);
        continue;
    }
    // Verify target domain exists
    const targetDir = path.join(ROOT, 'evidence-models', 'domains', ref.toTier, ref.toDomain);
    if (!fs.existsSync(targetDir)) {
        errors.push(`cross-ref: target domain ${ref.toTier}/${ref.toDomain} missing for field '${ref.field}' (from ${ref.fromTier}/${ref.fromDomain})`);
    }
}

// Validate uses_functional_services in industry workflow schemas
const industryWorkflowDir = path.join(workflowDir, 'domains', 'industry');
if (fs.existsSync(industryWorkflowDir)) {
    for (const indDomain of fs.readdirSync(industryWorkflowDir, { withFileTypes: true })) {
        if (!indDomain.isDirectory()) continue;
        const indDir = path.join(industryWorkflowDir, indDomain.name);
        for (const wfDir of fs.readdirSync(indDir, { withFileTypes: true })) {
            if (!wfDir.isDirectory()) continue;
            const schemaPath = path.join(indDir, wfDir.name, 'schema.yaml');
            if (!fs.existsSync(schemaPath)) continue;
            totalChecked++;
            try {
                const doc = yaml.load(fs.readFileSync(schemaPath, 'utf-8')) as any;
                if (doc?.uses_functional_services) {
                    const services = Array.isArray(doc.uses_functional_services) ? doc.uses_functional_services : [];
                    for (const svc of services) {
                        // Check format: "functional/psm" or "emergency"
                        if (svc.includes('/')) {
                            const [tier, domain] = svc.split('/');
                            const svcDir = path.join(workflowDir, 'domains', tier, domain);
                            if (!fs.existsSync(svcDir)) {
                                errors.push(`${indDomain.name}/${wfDir.name}/schema.yaml: uses_functional_services references non-existent '${svc}'`);
                            }
                        }
                    }
                }
            } catch (e: any) {
                const rel = path.relative(ROOT, schemaPath).replace(/\\/g, '/');
                errors.push(`${rel}: YAML parsing error in uses_functional_services - ${e.message}`);
            }
        }
    }
}

// ── docs/_shared bilingual pair consistency (v4.1.0) ──────────────────────────
// Validates the <name>.md (EN canonical) + <name>_ko.md (KO mirror) convention
// for user-facing docs. Every markdown file must have its language partner.
console.log(`${CYAN}--- docs/_shared bilingual pair consistency ---${RESET}`);

const sharedDocsDir = path.join(ROOT, 'docs', '_shared');
if (fs.existsSync(sharedDocsDir)) {
    const mdFiles = fs.readdirSync(sharedDocsDir).filter(f => f.endsWith('.md'));
    for (const file of mdFiles) {
        totalChecked++;
        const isKo = file.endsWith('_ko.md');
        const partner = isKo
            ? file.replace(/_ko\.md$/, '.md')
            : file.replace(/\.md$/, '_ko.md');
        const partnerPath = path.join(sharedDocsDir, partner);
        if (!fs.existsSync(partnerPath)) {
            errors.push(`docs/_shared/${file}: missing bilingual partner '${partner}' (EN canonical + _ko mirror required)`);
        }
    }
}

// ── Skill legal_basis gate (v4.8.0, WARN-phase rollout) ──────────────────────
// Extends the CSO legal-basis floor to SKILL.md frontmatter — previously only
// workflow schemas, evidence models, and regulations were scanned. Scans the
// SSOT (skills/) plus the .agents/skills/ shortcut layer, de-duplicating by
// frontmatter `name:` (SSOT wins). Emitted as WARNINGS initially: 43 of 62
// skills currently lack the field, so ERROR severity would break CI on day
// one; this mirrors the v4.5.0 staleness precedent (WARN now, promote later).
console.log(`${CYAN}--- Skill legal_basis gate ---${RESET}`);

const MIN_SKILL_LEGAL_BASIS = 3;

function parseSkillFrontmatter(filePath: string): { name: string | null; fm: any } {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!match) return { name: null, fm: null };
        const fm = yaml.load(match[1]) as any;
        const name = fm && typeof fm.name === 'string' ? fm.name : null;
        return { name, fm };
    } catch {
        return { name: null, fm: null };
    }
}

const skillGateEntries = new Map<string, { rel: string; fm: any }>();
for (const file of [
    ...walkDirExact(path.join(ROOT, 'skills'), 'SKILL.md'),
    ...walkDirExact(path.join(ROOT, '.agents', 'skills'), 'SKILL.md'),
]) {
    const { name, fm } = parseSkillFrontmatter(file);
    // Dedupe key: frontmatter name; fall back to repo-relative path when the
    // frontmatter is unparseable so the file still gets audited exactly once.
    const key = name ?? relPath(file);
    if (!skillGateEntries.has(key)) {
        skillGateEntries.set(key, { rel: relPath(file), fm });
    }
}

let skillGateChecked = 0;
let skillGateSkipped = 0;
for (const entry of skillGateEntries.values()) {
    const { rel, fm } = entry;
    // v4.9.0/v4.10.0: platform-tooling exemptions — process-type skills
    // orchestrate AI-team workflows; legal-research-type skills are k-law
    // research instruments. Neither is a regulated EHS activity, so the
    // statute floor does not apply to them.
    const fmType = fm?.metadata?.type ?? fm?.type;
    if (fmType === 'process' || fmType === 'legal-research') {
        skillGateSkipped++;
        continue;
    }
    skillGateChecked++;
    if (!fm || typeof fm !== 'object') {
        warnings.push(`${rel}: SKILL.md has no parsable YAML frontmatter (legal_basis unverifiable)`);
        continue;
    }
    const lb = (Array.isArray(fm?.legal_basis)) ? fm.legal_basis : (Array.isArray(fm?.metadata?.legal_basis) ? fm.metadata.legal_basis : null);
    if (!Array.isArray(lb)) {
        warnings.push(`${rel}: SKILL.md frontmatter missing legal_basis array (≥${MIN_SKILL_LEGAL_BASIS} entries required)`);
    } else if (lb.length < MIN_SKILL_LEGAL_BASIS) {
        warnings.push(`${rel}: SKILL.md legal_basis has ${lb.length} ${lb.length === 1 ? 'entry' : 'entries'} (< ${MIN_SKILL_LEGAL_BASIS})`);
    }
}
totalChecked += skillGateChecked;
if (skillGateSkipped > 0) {
    console.log(`  (${skillGateSkipped} process/legal-research-type platform skills exempt from the statutory gate)`);
}

// ── variant.json skill_manifest validation (v4.8.0, WARN-phase rollout) ──────
// C-1 validator half: skill_manifest.variant_specific[*].legal_basis must be
// an array of >= 3 strings, each citing a specific article (제N조 / Article N);
// vague values containing '전반' are flagged. Scalar legacy strings are coerced
// to a 1-item list so entry-level checks still produce actionable findings.
console.log(`${CYAN}--- variant.json skill_manifest gate ---${RESET}`);

const MIN_VARIANT_LEGAL_BASIS = 3;
const SPECIFIC_ARTICLE_RE = /제\s*\d+\s*조(의\s*\d+)?|\bArticle\s+\d+|「[^」]*」|(?:고시|지침|별표)/i;

const variantJsonPath = path.join(ROOT, 'variant.json');
if (fs.existsSync(variantJsonPath)) {
    totalChecked++;
    try {
        const doc = JSON.parse(fs.readFileSync(variantJsonPath, 'utf-8'));
        const variants = doc?.skill_manifest?.variant_specific;
        if (variants !== undefined && variants !== null && !Array.isArray(variants)) {
            warnings.push(`variant.json: skill_manifest.variant_specific is not an array`);
        } else if (Array.isArray(variants)) {
            for (const v of variants) {
                const name = v && typeof v.name === 'string' ? v.name : '<unnamed>';
                const label = `variant.json: skill_manifest.variant_specific[${name}].legal_basis`;
                const lb = v?.legal_basis;
                const items = Array.isArray(lb) ? lb : (lb === undefined || lb === null ? [] : [lb]);
                if (!Array.isArray(lb)) {
                    warnings.push(`${label}: must be an array of strings (found ${items.length === 0 ? 'nothing' : typeof items[0] === 'string' ? 'a bare string' : typeof lb})`);
                }
                if (items.length < MIN_VARIANT_LEGAL_BASIS) {
                    warnings.push(`${label}: has ${items.length} ${items.length === 1 ? 'entry' : 'entries'} (< ${MIN_VARIANT_LEGAL_BASIS})`);
                }
                for (const item of items) {
                    const s = String(item);
                    if (!SPECIFIC_ARTICLE_RE.test(s)) {
                        warnings.push(`${label}: entry does not cite a specific article (제N조 / Article N) - '${s}'`);
                    }
                    if (typeof item === 'string' && item.includes('전반')) {
                        warnings.push(`${label}: vague citation ('전반') - '${item}'`);
                    }
                }
            }
        }
    } catch (e: any) {
        errors.push(`variant.json: JSON parsing error - ${e.message}`);
    }
}

// ── Final report ──────────────────────────────────────────────────────────────

const wfReport = Object.entries(domainCounts).map(([k, v]) => `${v.workflows} ${k}`).join(', ');
const evReport = Object.entries(domainCounts).map(([k, v]) => `${v.evidence} ${k}`).join(', ');
console.log(`Files checked : ${totalChecked}`);
console.log(`  workflows/        : ${schemaFiles.length} schema.yaml file(s) (${wfReport})`);
console.log(`  regulations/      : ${regFiles.length} .yaml file(s)`);
console.log(`  evidence-models/  : ${evidenceFiles.length} .json file(s) (${evReport})`);
const memReport = memoryRecordChecks.map(c => `${memoryRecordCounts[c.label]} ${c.unit}`).join(', ');
console.log(`  memory records    : ${memReport}\n`);

// ── Warnings summary (v4.5.0 staleness, v4.8.0 skill/variant gates) ──────────
// Informational review-debt — never affects the error count or exit code.
if (warnings.length > 0) {
    console.log(`${YELLOW}⚠ ${warnings.length} warning(s) (WARN-only — not counted as errors):${RESET}`);
    for (const w of warnings) {
        console.log(`${YELLOW}  - ${w}${RESET}`);
    }
    console.log('');
}

if (errors.length === 0) {
    console.log(`${GREEN}✅ ${totalChecked} files checked, 0 errors${RESET}`);
    process.exit(0);
} else {
    console.error(`${RED}❌ ${errors.length} error(s) found${RESET}`);
    for (const e of errors) {
        console.error(`${RED}  - ${e}${RESET}`);
    }
    process.exit(1);
}
