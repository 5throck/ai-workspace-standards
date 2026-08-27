#!/usr/bin/env tsx
/**
 * Scaffold Industry Generator (Action Item A-01, Phase 0)
 *
 * Turns an industry code (+ optional unique-workflow list) into a complete
 * Tier-2-ready scaffold, auto-filling `legal_basis` from the regulatory
 * anchor table (regulations/KR/industry-regulatory-anchors.yaml) and emitting
 * a `_shared/tbm` reference declaration per workflows/_shared/REFERENCE-SPEC.md.
 *
 * Inputs:
 *   --industry <code>            One of the 12 Tier-1 industries (required).
 *   --unique-wfs <comma-list>    Industry-unique workflow slugs (optional, default none).
 *   --dry-run                    Print planned file tree + sample output without writing.
 *   --language ko|en|both        README Ko/EN pair (default both).
 *   --validate                   Run V-01..V-07 checks on existing generated outputs and exit.
 *
 * Examples:
 *   bun scripts/scaffold-industry.ts --industry datacenter --dry-run
 *   bun scripts/scaffold-industry.ts --industry datacenter
 *   bun scripts/scaffold-industry.ts --industry battery --unique-wfs silane-gas-leak-response,battery-room-fire-suppression --dry-run
 *   bun scripts/scaffold-industry.ts --validate
 *
 * @version 0.1.1
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { DEFAULT_MIN_LEGAL_BASIS } from './domain-config.ts';

// ─── Constants ──────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dir, '..');

const ANCHOR_FILE = path.join(ROOT, 'regulations', 'KR', 'industry-regulatory-anchors.yaml');
const SHARED_TBM_DIR = path.join(ROOT, 'workflows', '_shared', 'tbm');
const MATURITY_MATRIX = path.join(ROOT, 'docs', '_meta', 'domain-maturity-matrix.md');

const VERSION = '0.1.0';

const INDUSTRIES = [
    'battery', 'biotech', 'cosmetics', 'datacenter', 'defense', 'food',
    'logistics', 'railway', 'semicon', 'shipbuilding', 'steelmaking', 'waste',
] as const;
type Industry = (typeof INDUSTRIES)[number];

// Relative path from any industry workflow schema.yaml to the shared TBM dir.
// Verified per REFERENCE-SPEC §3.4 (4 levels up: wf-dir → industry → industry → domains → workflows).
const SHARED_TBM_REL = '../../../../_shared/tbm';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// ─── Types ──────────────────────────────────────────────────────────────

interface KeyArticle {
    article: string;
    topic_ko?: string;
    topic_en?: string;
}

interface StatuteBlock {
    name_ko: string;
    abbreviation?: string;
    statute_file?: string | null;
    key_articles: KeyArticle[];
}

interface UniversalAnchor extends StatuteBlock {
    verification?: unknown;
}

interface IndustryAnchor {
    display_name: string;
    has_dedicated_statute_file?: boolean;
    primary_statute: StatuteBlock;
    adjacent_laws?: StatuteBlock[];
    sapa?: { ref?: string; note?: string } & Partial<StatuteBlock>;
    osha_kr_anchor?: { ref?: string } & Partial<StatuteBlock>;
    notes?: string;
    verification?: { verified_via?: string[]; unverified?: string[] };
}

interface AnchorTable {
    universal_anchors?: {
        osha_kr?: UniversalAnchor;
        sapa?: UniversalAnchor;
    };
    industries?: Record<string, IndustryAnchor>;
}

interface LegalBasisEntry {
    citation: string;       // e.g. "산업안전보건법 Article 15"
    statute_name: string;   // cleaned name_ko
    article: string;
    topic_en?: string;
    unverified: boolean;    // carries [UNVERIFIED] marker from anchor table
}

interface PlannedFile {
    absPath: string;
    description: string;
    content: string;
}

interface GenerationPlan {
    industry: Industry;
    displayName: string;
    uniqueWfs: string[];
    language: 'ko' | 'en' | 'both';
    legalBasis: LegalBasisEntry[];
    unverifiedItems: string[];
    files: PlannedFile[];
    tbmAction: 'add-ref-to-existing' | 'create-thin-ref-dir' | 'already-referenced';
    tbmTargetPath?: string;
}

interface ValidationIssue {
    rule: string;       // V-01..V-07
    severity: 'error' | 'warn';
    path: string;
    message: string;
}

// ─── Anchor table loading + legal_basis assembly ────────────────────────

function loadAnchorTable(): AnchorTable {
    if (!fs.existsSync(ANCHOR_FILE)) {
        fail(`Anchor table not found: ${ANCHOR_FILE}`);
    }
    const text = fs.readFileSync(ANCHOR_FILE, 'utf8');
    const doc = yaml.load(text) as AnchorTable;
    if (!doc || !doc.universal_anchors || !doc.industries) {
        fail(`Anchor table missing universal_anchors or industries block: ${ANCHOR_FILE}`);
    }
    return doc;
}

/**
 * Strip trailing parenthetical disambiguations from a Korean statute name.
 * Examples:
 *   "산업안전보건법 (적하하역 작업 관련)"                     → "산업안전보건법"
 *   "화학물질의 등록 및 평가 등에 관한 법률 (화학물질관리법)"  → "화학물질의 등록 및 평가 등에 관한 법률"
 *   "산업안전보건법"                                          → "산업안전보건법"
 *
 * Rationale: REFERENCE-SPEC §7 V-07 requires canonical Korean proper-noun
 * form. The parentheticals in the anchor table are editor notes
 * (work-context or abbreviation hints), not part of the statute's formal
 * name. Specialists refine during review.
 */
function cleanStatuteName(raw: string): string {
    return raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Build a canonical citation string from a statute name + article number. */
function citationOf(nameKo: string, article: string): string {
    return `${cleanStatuteName(nameKo)} Article ${article}`.trim();
}

/**
 * Assemble the auto-filled legal_basis array for an industry.
 *
 * Per the anchor table header (lines 59-63): copy primary_statute +
 * adjacent_laws + sapa + osha_kr_anchor key articles. Universal anchors
 * (osha_kr, sapa) are resolved from `universal_anchors` because the per-
 * industry blocks use `ref:` (a semantic pointer, NOT a YAML merge key).
 *
 * Order (per REFERENCE-SPEC §4.1 — common statutory floor first):
 *   1. OSHA-KR universal anchor
 *   2. SAPA universal anchor
 *   3. Primary statute
 *   4. Adjacent laws
 *
 * De-duplicated by full citation string. Guarantees ≥ DEFAULT_MIN_LEGAL_BASIS
 * (3) or fails loudly with a diagnostic.
 */
function assembleLegalBasis(
    industry: Industry,
    anchor: IndustryAnchor,
    universal: NonNullable<AnchorTable['universal_anchors']>,
): { entries: LegalBasisEntry[]; unverified: string[] } {
    const unverified = anchor.verification?.unverified ?? [];
    const unverifiedStatuteNames = new Set<string>();
    for (const u of unverified) {
        // Heuristic: mark any citation whose statute name appears in an [UNVERIFIED] note.
        // We carry the marker through to the generated legal_basis for specialist attention.
        const m = u.match(/^([^\s[]+)/);
        if (m) unverifiedStatuteNames.add(cleanStatuteName(m[1]));
        // Also mark by abbreviation tokens
        const abbrMatch = u.match(/\b([A-Z]{2,})\b/);
        if (abbrMatch) {
            // map common abbreviations to their statute name below
        }
    }

    const entries: LegalBasisEntry[] = [];
    const seen = new Set<string>();

    const push = (statute: StatuteBlock, source: string) => {
        const statuteName = cleanStatuteName(statute.name_ko);
        // Determine whether this statute is flagged unverified in the anchor notes
        const isUnverified = unverified.some(u => u.includes(statuteName) || u.includes(statute.abbreviation ?? '___NO_ABBR___'));
        for (const art of statute.key_articles ?? []) {
            const citation = citationOf(statute.name_ko, art.article);
            if (seen.has(citation)) continue;
            seen.add(citation);
            entries.push({
                citation,
                statute_name: statuteName,
                article: art.article,
                topic_en: art.topic_en,
                unverified: isUnverified,
            });
        }
    };

    // 1. Universal OSHA-KR anchor
    if (universal.osha_kr) push(universal.osha_kr, 'osha_kr_anchor');
    // 2. Universal SAPA anchor
    if (universal.sapa) push(universal.sapa, 'sapa');
    // 3. Primary statute
    if (anchor.primary_statute) push(anchor.primary_statute, 'primary_statute');
    // 4. Adjacent laws
    for (const adj of anchor.adjacent_laws ?? []) push(adj, 'adjacent_laws');

    if (entries.length < DEFAULT_MIN_LEGAL_BASIS) {
        fail(
            `Industry '${industry}' resolved only ${entries.length} legal_basis entries ` +
            `(minimum is ${DEFAULT_MIN_LEGAL_BASIS}). Anchor table is incomplete for this industry.`,
        );
    }

    return { entries, unverified };
}

// ─── TBM presence detection ─────────────────────────────────────────────

interface TbmPresence {
    found: boolean;
    dirName?: string;
    schemaPath?: string;
    alreadyReferenced: boolean;
}

/**
 * Scan an industry directory for any workflow whose schema declares itself
 * as TBM (workflow_id contains 'tbm' OR title contains 'TBM'/'안전점검회의').
 */
function detectTbm(industry: Industry): TbmPresence {
    const industryDir = path.join(ROOT, 'workflows', 'domains', 'industry', industry);
    if (!fs.existsSync(industryDir)) return { found: false, alreadyReferenced: false };

    for (const entry of fs.readdirSync(industryDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const schemaPath = path.join(industryDir, entry.name, 'schema.yaml');
        if (!fs.existsSync(schemaPath)) continue;
        try {
            const doc = yaml.load(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
            const wfId = String(doc.workflow_id ?? '').toLowerCase();
            const title = String(doc.title ?? '');
            const isTbm =
                wfId.includes('tbm') ||
                /TBM|안전점검회의|tool[\s-]?box/i.test(title);
            if (!isTbm) continue;
            const refs = doc.references as Array<{ shared?: string }> | undefined;
            const alreadyReferenced = Array.isArray(refs) &&
                refs.some(r => typeof r?.shared === 'string' && r.shared.includes('_shared/tbm'));
            return { found: true, dirName: entry.name, schemaPath, alreadyReferenced };
        } catch {
            // Skip unreadable schemas
            continue;
        }
    }
    return { found: false, alreadyReferenced: false };
}

// ─── Renderers ──────────────────────────────────────────────────────────

function industryProfileOf(industry: Industry): string {
    return industry;
}

function agentOf(industry: Industry): string {
    return `${industry}-agent`;
}

/** Render a representative signature_hazard placeholder from the anchor notes. */
function signatureHazardPlaceholder(industry: Industry, anchor: IndustryAnchor): string {
    const notes = (anchor.notes ?? '').trim();
    // Best-effort: use the display_name + primary statute abbreviation as a placeholder.
    const primary = anchor.primary_statute?.abbreviation ?? anchor.primary_statute?.name_ko ?? '';
    return `[${anchor.display_name}] ${primary} — 대표 위해요인 (specialist review required)`;
}

function renderUniqueWorkflowSchema(
    industry: Industry,
    slug: string,
    legalBasis: LegalBasisEntry[],
    anchor: IndustryAnchor,
): string {
    const emRef = `${industry}-${slug}-record.json`;
    const lines: string[] = [
        'schema_version: "1.0"',
        `workflow_id: ${slug}`,
        `title: "${anchor.display_name} — ${slug} (scaffold — specialist review required)"`,
        'status: draft',
        'applicability: mandatory',
        'workflow_type: core',
        `industry_profile: ${industryProfileOf(industry)}`,
        `agent: ${agentOf(industry)}`,
        `signature_hazard: "${signatureHazardPlaceholder(industry, anchor)}"`,
        '',
        '# Auto-filled from regulations/KR/industry-regulatory-anchors.yaml (Task A-03).',
        '# Entries marked [UNVERIFIED] originate from the anchor table and require specialist re-verification.',
        'legal_basis:',
    ];
    for (const lb of legalBasis) {
        const marker = lb.unverified ? '  # [UNVERIFIED] — see anchor table' : '';
        lines.push(`  - ${lb.citation}${marker}`);
    }
    lines.push('');
    lines.push(`# Industry-unique workflow. NOT a shared-workflow reference (no \`references:\` block).`);
    lines.push(`# Evidence model skeleton — see evidence-models/domains/industry/${industry}/${emRef}.`);
    lines.push(`evidence_model: ${emRef}`);
    return lines.join('\n') + '\n';
}

function renderThinTbmReferenceSchema(
    industry: Industry,
    legalBasis: LegalBasisEntry[],
    anchor: IndustryAnchor,
): string {
    // REFERENCE-SPEC §3.2 full form — the thin dir has no other top-level fields,
    // so all industry-specific values ride on the references.overrides block.
    const lines: string[] = [
        'schema_version: "1.0"',
        `workflow_id: ${industry}-tbm`,
        `title: "${anchor.display_name} TBM (Tool Box Meeting) — shared reference"`,
        'status: active',
        'applicability: mandatory',
        'workflow_type: core',
        `industry_profile: ${industryProfileOf(industry)}`,
        `agent: ${agentOf(industry)}`,
        '',
        '# Thin reference to the shared TBM base (workflows/_shared/REFERENCE-SPEC.md §3.1).',
        '# No per-industry TBM content is duplicated here; this schema only declares the',
        '# reference and the industry-specific overrides.',
        'references:',
        `  - shared: ${SHARED_TBM_REL}`,
        '    overrides:',
        `      signature_hazard: "${signatureHazardPlaceholder(industry, anchor)}"`,
        '      legal_basis:',
        '        add:',
    ];
    for (const lb of legalBasis) {
        const marker = lb.unverified ? '  # [UNVERIFIED]' : '';
        lines.push(`          - ${lb.citation}${marker}`);
    }
    return lines.join('\n') + '\n';
}

/** Build the YAML fragment to append to an existing TBM schema (minimal form). */
function renderReferencesBlockForExisting(legalBasis: LegalBasisEntry[]): string {
    const lines: string[] = [
        '',
        '# ── Shared TBM reference (added by scaffold-industry.ts Task A-01) ──',
        '# Declares this workflow also consumes the shared TBM base',
        '# (workflows/_shared/REFERENCE-SPEC.md §3.1 minimal form). Existing',
        '# top-level fields (signature_hazard, legal_basis, agent) serve as the',
        '# effective schema; the shared base supplies the common statutory floor.',
        'references:',
        `  - shared: ${SHARED_TBM_REL}`,
    ];
    void legalBasis; // existing top-level legal_basis already carries industry specifics
    return lines.join('\n') + '\n';
}

function renderReadmeEn(industry: Industry, slug: string, anchor: IndustryAnchor, legalBasis: LegalBasisEntry[]): string {
    return `# ${anchor.display_name} — ${slug}

> **Status**: Scaffold (draft) — generated by \`scripts/scaffold-industry.ts\` (Task A-01, Phase 0).
> Specialist review required before operational use. The \`signature_hazard\`,
> workflow steps, and evidence fields are placeholders.

## 1. Purpose
Industry-unique workflow scaffold for the **${anchor.display_name}** industry
(code: \`${industry}\`).

## 2. Legal Basis (auto-filled)
Source: \`regulations/KR/industry-regulatory-anchors.yaml\` (Task A-03).

${legalBasis.map(lb => `- ${lb.citation}${lb.unverified ? ' _[UNVERIFIED — specialist re-verification required]_' : ''}`).join('\n')}

## 3. Evidence Record
See \`evidence-models/domains/industry/${industry}/${industry}-${slug}-record.json\` (skeleton, \`status: draft\`).

## 4. Regulatory Notes
${anchor.notes ? anchor.notes.trim() : '(none in anchor table)'}

${anchor.verification?.unverified?.length ? '## 5. Unverified Citations\nThe following items were flagged [UNVERIFIED] in the anchor table and require specialist re-verification:\n\n' + anchor.verification.unverified.map(u => `- ${u}`).join('\n') : ''}

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This scaffold provides workflow automation assistance only, not legal advice._
`;
}

function renderReadmeKo(industry: Industry, slug: string, anchor: IndustryAnchor, legalBasis: LegalBasisEntry[]): string {
    return `# ${anchor.display_name} — ${slug}

> **상태**: 스캐폴드(초안) — \`scripts/scaffold-industry.ts\`(Task A-01, Phase 0)가 생성.
> 실사용 전 전문가 검토 필요. \`signature_hazard\`, 워크플로우 단계, 증거 필드는 Placeholder.

## 1. 목적
**${anchor.display_name}** 산업(코드: \`${industry}\`)의 산업 고유 워크플로우 스캐폴드.

## 2. 법적 근거 (자동 채움)
출처: \`regulations/KR/industry-regulatory-anchors.yaml\` (Task A-03).

${legalBasis.map(lb => `- ${lb.citation}${lb.unverified ? ' _[UNVERIFIED — 전문가 재검증 필요]_' : ''}`).join('\n')}

## 3. 증거 기록
\`evidence-models/domains/industry/${industry}/${industry}-${slug}-record.json\` 참조 (스켈레톤, \`status: draft\`).

## 4. 규제 참고사항
${anchor.notes ? anchor.notes.trim() : '(앵커 표에 없음)'}

${anchor.verification?.unverified?.length ? '## 5. 미검증 인용\n앵커 표에서 [UNVERIFIED]로 표시된 항목이며, 전문가 재검증이 필요합니다:\n\n' + anchor.verification.unverified.map(u => `- ${u}`).join('\n') : ''}

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 스캐폴드는 워크플로우 자동화 보조만 제공하며, 법률 자문이 아닙니다._
`;
}

function renderEmSkeleton(industry: Industry, slug: string, legalBasis: LegalBasisEntry[]): string {
    const id = `${industry}-${slug}-record.json`;
    const skeleton = {
        '$schema': 'http://json-schema.org/draft-07/schema#',
        '$id': id,
        'title': `${industry} ${slug} record (scaffold — specialist review required)`,
        'description': `Skeleton evidence model auto-generated by scaffold-industry.ts (Task A-01). Status: draft. Fields and legal_basis are placeholders pending specialist review.`,
        'version': '0.1.0',
        'status': 'draft',
        'type': 'object',
        'required': ['record_id', 'legal_basis', 'audit_trail'],
        'properties': {
            record_id: {
                type: 'string',
                description: `Format: ${industry.toUpperCase()}-${slug.toUpperCase()}-YYYY-NNNN (specialist to confirm)`,
            },
            legal_basis: {
                type: 'array',
                items: { type: 'string' },
                minItems: DEFAULT_MIN_LEGAL_BASIS,
                description: 'Auto-filled from industry-regulatory-anchors.yaml; specialist confirms final set.',
                default: legalBasis.map(lb => lb.citation),
            },
            industry_specific_fields: {
                type: 'object',
                description: 'Extension point — specialist defines industry-unique evidence fields.',
                properties: {},
            },
            audit_trail: {
                $ref: '../../../_shared/base/common.schema.json#/definitions/audit_trail',
            },
        },
    };
    return JSON.stringify(skeleton, null, 2) + '\n';
}

function renderThinTbmReadme(industry: Industry, anchor: IndustryAnchor): string {
    return `# ${anchor.display_name} TBM (Tool Box Meeting) — 공통 기반 참조

> 본 디렉토리는 **참조 포인터(pointer)** 입니다. TBM 워크플로우 내용은 공통 기반
> [\`../../../../_shared/tbm/\`](../../../../_shared/tbm/) 에 있으며, 본 산업은 중복
> 없이 이를 참조합니다. 규격: \`workflows/_shared/REFERENCE-SPEC.md\` §3.1 (최소 형태).

## 산업별 Override
- \`signature_hazard\`, \`legal_basis.add\` 등은 본 디렉토리의 \`schema.yaml\`에 있는
  \`references.overrides\` 블록에서 선언합니다.
- 생성: \`scripts/scaffold-industry.ts\` (Task A-01, Phase 0).

---
_법적 고지: 규제 해석은 사용자 책임입니다._
`;
}

// ─── Planning ───────────────────────────────────────────────────────────

function planGeneration(
    industry: Industry,
    uniqueWfs: string[],
    language: 'ko' | 'en' | 'both',
    anchors: AnchorTable,
): GenerationPlan {
    const anchor = anchors.industries![industry];
    if (!anchor) fail(`Industry '${industry}' not found in anchor table.`);
    const universal = anchors.universal_anchors!;
    const { entries: legalBasis, unverified } = assembleLegalBasis(industry, anchor, universal);

    const files: PlannedFile[] = [];

    // 1. Per-unique-WF files
    for (const slug of uniqueWfs) {
        const wfDir = path.join(ROOT, 'workflows', 'domains', 'industry', industry, slug);
        files.push({
            absPath: path.join(wfDir, 'schema.yaml'),
            description: `unique workflow schema: ${slug}`,
            content: renderUniqueWorkflowSchema(industry, slug, legalBasis, anchor),
        });
        if (language !== 'ko') {
            files.push({
                absPath: path.join(wfDir, 'README.en.md'),
                description: `unique workflow README (EN): ${slug}`,
                content: renderReadmeEn(industry, slug, anchor, legalBasis),
            });
        }
        if (language !== 'en') {
            files.push({
                absPath: path.join(wfDir, 'README.md'),
                description: `unique workflow README (KO): ${slug}`,
                content: renderReadmeKo(industry, slug, anchor, legalBasis),
            });
        }
        // EM skeleton
        const emPath = path.join(ROOT, 'evidence-models', 'domains', 'industry', industry, `${industry}-${slug}-record.json`);
        files.push({
            absPath: emPath,
            description: `evidence model skeleton: ${slug}`,
            content: renderEmSkeleton(industry, slug, legalBasis),
        });
    }

    // 2. Shared TBM reference declaration
    const tbm = detectTbm(industry);
    let tbmAction: GenerationPlan['tbmAction'];
    let tbmTargetPath: string | undefined;
    if (tbm.found && tbm.alreadyReferenced) {
        tbmAction = 'already-referenced';
    } else if (tbm.found) {
        // Add a references block to the existing schema (Phase-0 §6.2 tolerated coexistence).
        tbmAction = 'add-ref-to-existing';
        tbmTargetPath = tbm.schemaPath!;
        files.push({
            absPath: tbm.schemaPath!,
            description: `append shared-tbm reference block to existing: ${tbm.dirName}`,
            content: renderReferencesBlockForExisting(legalBasis), // appended, not overwritten
            appendMode: true as never, // marker; handled in executeGeneration
        } as PlannedFile & { appendMode?: boolean });
    } else {
        // No prior TBM presence → create thin reference dir (REFERENCE-SPEC §3.1).
        tbmAction = 'create-thin-ref-dir';
        const thinDir = path.join(ROOT, 'workflows', 'domains', 'industry', industry, 'tbm');
        tbmTargetPath = path.join(thinDir, 'schema.yaml');
        files.push({
            absPath: tbmTargetPath,
            description: 'thin shared-tbm reference schema',
            content: renderThinTbmReferenceSchema(industry, legalBasis, anchor),
        });
        files.push({
            absPath: path.join(thinDir, 'README.md'),
            description: 'thin shared-tbm reference README (KO pointer)',
            content: renderThinTbmReadme(industry, anchor),
        });
    }

    return {
        industry,
        displayName: anchor.display_name,
        uniqueWfs,
        language,
        legalBasis,
        unverifiedItems: unverified,
        files,
        tbmAction,
        tbmTargetPath,
    };
}

// ─── Execution ──────────────────────────────────────────────────────────

function executeGeneration(plan: GenerationPlan): void {
    for (const f of plan.files) {
        const dir = path.dirname(f.absPath);
        fs.mkdirSync(dir, { recursive: true });
        const append = (f as PlannedFile & { appendMode?: boolean }).appendMode === true;
        if (append) {
            // Idempotency: only append if the references block is not already present.
            const existing = fs.existsSync(f.absPath) ? fs.readFileSync(f.absPath, 'utf8') : '';
            if (/^references:/m.test(existing)) {
                console.log(`${YELLOW}↷ skip (references block already present): ${rel(f.absPath)}${RESET}`);
                continue;
            }
            fs.appendFileSync(f.absPath, '\n' + f.content);
        } else {
            fs.writeFileSync(f.absPath, f.content);
        }
        console.log(`${GREEN}✓ wrote ${rel(f.absPath)}${RESET}`);
    }
}

// ─── Dry-run rendering ──────────────────────────────────────────────────

function printDryRun(plan: GenerationPlan): void {
    console.log(`${CYAN}=== DRY RUN: ${plan.industry} (${plan.displayName}) ===${RESET}`);
    console.log(`unique-wfs: [${plan.uniqueWfs.join(', ') || 'none'}]  language: ${plan.language}  tbm-action: ${plan.tbmAction}`);
    console.log(`legal_basis sources: ${plan.legalBasis.length} (min ${DEFAULT_MIN_LEGAL_BASIS})`);
    if (plan.unverifiedItems.length) {
        console.log(`${YELLOW}unverified items carried through: ${plan.unverifiedItems.length}${RESET}`);
    }
    console.log(`\nplanned file tree (${plan.files.length} files):`);
    for (const f of plan.files) {
        const tag = (f as PlannedFile & { appendMode?: boolean }).appendMode ? ' (append)' : '';
        console.log(`  ${rel(f.absPath)}${tag}  — ${f.description}`);
    }
    // Sample: show the first unique-WF schema, or the thin TBM schema, or the append block
    const sample = plan.files.find(f => !((f as PlannedFile & { appendMode?: boolean }).appendMode));
    if (sample) {
        console.log(`\n${CYAN}── sample: ${rel(sample.absPath)} ──${RESET}`);
        console.log(sample.content);
    } else if (plan.files[0]) {
        console.log(`\n${CYAN}── sample (append block): ${rel(plan.files[0].absPath)} ──${RESET}`);
        console.log(plan.files[0].content);
    }
}

function rel(absPath: string): string {
    return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

// ─── 12-industry dry-run sweep ──────────────────────────────────────────

function dryRunAllIndustries(): void {
    const anchors = loadAnchorTable();
    const rows: string[] = [];
    rows.push('industry | #legal_basis_sources | unique_wfs | shared_refs | any_errors');
    rows.push('-------- | --------------------: | ---------: | ----------: | ----------');
    let totalErrors = 0;
    for (const ind of INDUSTRIES) {
        try {
            const plan = planGeneration(ind, [], 'both', anchors);
            const sharedRefs = plan.tbmAction === 'already-referenced' || plan.tbmAction === 'add-ref-to-existing' || plan.tbmAction === 'create-thin-ref-dir' ? 1 : 0;
            rows.push(`${ind} | ${plan.legalBasis.length} | ${plan.uniqueWfs.length} | ${sharedRefs} | —`);
        } catch (e) {
            totalErrors++;
            rows.push(`${ind} | — | — | — | ERROR: ${(e as Error).message}`);
        }
    }
    console.log(`${CYAN}\n=== 12-industry dry-run sweep (zero unique WFs) ===${RESET}`);
    console.log(rows.join('\n'));
    console.log(totalErrors === 0
        ? `${GREEN}\n✓ all 12 industries resolve a valid ≥${DEFAULT_MIN_LEGAL_BASIS}-source legal_basis from the anchor table.${RESET}`
        : `${RED}\n✗ ${totalErrors} industr(y/ies) failed to resolve legal_basis.${RESET}`);
}

// ─── Validation: V-01..V-07 (REFERENCE-SPEC §7) ─────────────────────────

function validateSharedTbm(): { exists: boolean; sharedFlag: boolean; hasReadme: boolean; consumedBy: string[] } {
    const schemaPath = path.join(SHARED_TBM_DIR, 'schema.yaml');
    const readmePath = path.join(SHARED_TBM_DIR, 'README.md');
    if (!fs.existsSync(schemaPath)) return { exists: false, sharedFlag: false, hasReadme: false, consumedBy: [] };
    const doc = yaml.load(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
    const sharedFlag = doc.shared === true;
    const hasReadme = fs.existsSync(readmePath);
    const consumedBy = ((doc.consumed_by as { industries?: string[] })?.industries) ?? [];
    return { exists: true, sharedFlag, hasReadme, consumedBy };
}

function validateIndustry(industry: Industry, shared: ReturnType<typeof validateSharedTbm>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const industryDir = path.join(ROOT, 'workflows', 'domains', 'industry', industry);
    if (!fs.existsSync(industryDir)) return issues; // nothing to validate

    for (const entry of fs.readdirSync(industryDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const schemaPath = path.join(industryDir, entry.name, 'schema.yaml');
        const readmePath = path.join(industryDir, entry.name, 'README.md');
        if (!fs.existsSync(schemaPath)) continue;
        const relSchema = rel(schemaPath);
        const doc = yaml.load(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;

        // V-07: legal_basis ≥ DEFAULT_MIN_LEGAL_BASIS (canonical Korean form is a specialist concern;
        // we enforce the count invariant here and flag non-Korean scripts heuristically).
        const lb = doc.legal_basis;
        if (Array.isArray(lb) && lb.length < DEFAULT_MIN_LEGAL_BASIS) {
            issues.push({ rule: 'V-07', severity: 'error', path: relSchema,
                message: `legal_basis has ${lb.length} entries (min ${DEFAULT_MIN_LEGAL_BASIS})` });
        }

        const refs = doc.references as Array<{
            shared?: string;
            overrides?: { signature_hazard?: string; legal_basis?: { replace?: unknown[]; justification?: string } };
        }> | undefined;

        if (Array.isArray(refs)) {
            for (const r of refs) {
                const sharedPath = r.shared;
                // V-01: references.shared resolves to a dir with schema.yaml + shared: true
                if (typeof sharedPath !== 'string') {
                    issues.push({ rule: 'V-01', severity: 'error', path: relSchema, message: 'references[].shared missing' });
                    continue;
                }
                const resolved = path.resolve(path.dirname(schemaPath), sharedPath);
                const resolvedSchema = path.join(resolved, 'schema.yaml');
                if (!fs.existsSync(resolvedSchema)) {
                    issues.push({ rule: 'V-01', severity: 'error', path: relSchema, message: `shared path does not resolve: ${sharedPath}` });
                } else {
                    const sDoc = yaml.load(fs.readFileSync(resolvedSchema, 'utf8')) as Record<string, unknown>;
                    if (sDoc.shared !== true) {
                        issues.push({ rule: 'V-01', severity: 'error', path: relSchema, message: `shared target lacks \`shared: true\`: ${sharedPath}` });
                    }
                    // V-06: shared consumed_by.industries includes this industry
                    const consumedBy = ((sDoc.consumed_by as { industries?: string[] })?.industries) ?? [];
                    if (consumedBy.length && !consumedBy.includes(industry)) {
                        issues.push({ rule: 'V-06', severity: 'warn', path: relSchema,
                            message: `shared workflow consumed_by.industries does not list '${industry}'` });
                    }
                }
                // V-02: shared dir has README.md
                const resolvedReadme = path.join(path.resolve(path.dirname(schemaPath), sharedPath), 'README.md');
                if (!fs.existsSync(resolvedReadme)) {
                    issues.push({ rule: 'V-02', severity: 'error', path: relSchema, message: `shared target missing README.md: ${sharedPath}` });
                }
                // V-03: signature_hazard present (top-level OR override) for TBM references
                if (sharedPath.includes('_shared/tbm')) {
                    const hasSig = typeof doc.signature_hazard === 'string' || typeof r.overrides?.signature_hazard === 'string';
                    if (!hasSig) {
                        issues.push({ rule: 'V-03', severity: 'error', path: relSchema,
                            message: 'tbm reference requires signature_hazard (top-level or overrides)' });
                    }
                }
                // V-04: legal_basis.replace needs justification
                const replace = r.overrides?.legal_basis?.replace;
                if (Array.isArray(replace)) {
                    if (!r.overrides?.legal_basis?.justification) {
                        issues.push({ rule: 'V-04', severity: 'error', path: relSchema,
                            message: 'legal_basis.replace used without mandatory justification' });
                    }
                }
                // V-05: no duplicate counting (same shared wf ALSO present as a sibling per-industry dir)
                const sharedName = path.basename(sharedPath); // e.g. "tbm"
                const siblingDir = path.join(industryDir, sharedName);
                if (fs.existsSync(siblingDir) && path.resolve(siblingDir) !== path.resolve(path.dirname(schemaPath))) {
                    issues.push({ rule: 'V-05', severity: 'warn', path: relSchema,
                        message: `industry also has a per-industry '${sharedName}/' dir alongside the reference — Phase-1/2 migration pending` });
                }
            }
        }

        // README + schema pairing check (V-02 analog for industry workflows)
        if (!fs.existsSync(readmePath) && !fs.existsSync(path.join(industryDir, entry.name, 'README.en.md'))) {
            // Thin industry dirs commonly lack READMEs in this project; warn, don't error.
            issues.push({ rule: 'V-02', severity: 'warn', path: relSchema, message: 'workflow dir has no README.md or README.en.md' });
        }
    }
    return issues;
}

function runValidation(): number {
    const shared = validateSharedTbm();
    if (!shared.exists) {
        console.error(`${RED}✗ shared TBM not found at ${rel(SHARED_TBM_DIR)}${RESET}`);
        return 1;
    }
    console.log(`${CYAN}=== Validation: V-01..V-07 across all 12 industries ===${RESET}`);
    console.log(`shared TBM: exists=${shared.exists} shared: true=${shared.sharedFlag} README=${shared.hasReadme} consumed_by=${shared.consumedBy.length} industries`);
    let totalErrors = 0;
    let totalWarns = 0;
    for (const ind of INDUSTRIES) {
        const issues = validateIndustry(ind, shared);
        if (issues.length === 0) continue;
        const errs = issues.filter(i => i.severity === 'error');
        const warns = issues.filter(i => i.severity === 'warn');
        totalErrors += errs.length;
        totalWarns += warns.length;
        console.log(`\n${errs.length ? RED : YELLOW}${ind}${RESET}: ${errs.length} error(s), ${warns.length} warning(s)`);
        for (const i of issues) {
            const tag = i.severity === 'error' ? `${RED}ERROR` : `${YELLOW}WARN `;
            console.log(`  ${tag} ${i.rule}${RESET} ${i.path}: ${i.message}`);
        }
    }
    console.log(`\n${totalErrors === 0 ? GREEN : RED}Validation result: ${totalErrors} error(s), ${totalWarns} warning(s)${RESET}`);
    return totalErrors === 0 ? 0 : 1;
}

// ─── Maturity matrix update ─────────────────────────────────────────────

function countWorkflows(industry: Industry): number {
    const dir = path.join(ROOT, 'workflows', 'domains', 'industry', industry);
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'schema.yaml')))
        .length;
}

function countEvidenceModels(industry: Industry): number {
    const dir = path.join(ROOT, 'evidence-models', 'domains', 'industry', industry);
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).length;
}

/** Recompute the Gap-to-Next-Tier string given current counts (Tier 2 target). */
function gapString(wf: number, skills: number, em: number, agentLines: number): string {
    const deficits: string[] = [];
    if (wf < 5) deficits.push(`+${5 - wf} WF`);
    if (skills < 1) deficits.push('+1 Skill');
    if (em < 5) deficits.push(`+${5 - em} EMs`);
    if (agentLines < 50) deficits.push(`+${50 - agentLines} Agent lines`);
    return deficits.length === 0 ? '**Tier 2 — Operational**' : deficits.join(', ');
}

/** Tier determination: returns the highest tier whose thresholds are all met. */
function computeTier(wf: number, skills: number, em: number, agentLines: number): 0 | 1 | 2 | 3 {
    if (wf >= 8 && skills >= 2 && em >= 7 && agentLines >= 80) return 3;
    if (wf >= 5 && skills >= 1 && em >= 5 && agentLines >= 50) return 2;
    if (wf >= 2 && em >= 2) return 1;
    return 0;
}

function updateMaturityMatrix(industry: Industry, agentLines: number, skills: number): boolean {
    if (!fs.existsSync(MATURITY_MATRIX)) {
        console.log(`${YELLOW}maturity matrix not found at ${rel(MATURITY_MATRIX)} — skipping row update${RESET}`);
        return false;
    }
    const text = fs.readFileSync(MATURITY_MATRIX, 'utf8');
    const wf = countWorkflows(industry);
    const em = countEvidenceModels(industry);
    const tier = computeTier(wf, skills, em, agentLines);
    const gap = gapString(wf, skills, em, agentLines);

    // Match the existing row by leading `| <industry> |`. Column format:
    // | Domain | Tier | Workflows | Skills | Evidence Models | Agent Lines | Profile Status | Gap to Next Tier |
    const rowRegex = new RegExp(`^(\\| ${industry} \\| )([^\\n]+)$`, 'm');
    const match = text.match(rowRegex);
    if (!match) {
        console.log(`${YELLOW}maturity matrix: row for '${industry}' not found — skipping${RESET}`);
        return false;
    }
    const newRowCells = `${tier} | ${wf} | ${skills} | ${em} | ${agentLines} | active | ${gap} |`;
    const existingCells = match[2];
    if (existingCells.trim() === newRowCells.trim()) {
        console.log(`${CYAN}maturity matrix: '${industry}' row unchanged (wf=${wf}, em=${em}, tier=${tier})${RESET}`);
        return false;
    }
    const updated = text.replace(rowRegex, `${match[1]}${newRowCells}`);
    fs.writeFileSync(MATURITY_MATRIX, updated);
    console.log(`${GREEN}✓ maturity matrix: updated '${industry}' row → tier=${tier}, wf=${wf}, em=${em}${RESET}`);
    return true;
}

// ─── CLI ────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
    industry?: Industry;
    uniqueWfs: string[];
    dryRun: boolean;
    language: 'ko' | 'en' | 'both';
    validate: boolean;
    allDry: boolean;
} {
    const out = { uniqueWfs: [] as string[], dryRun: false, language: 'both' as 'ko' | 'en' | 'both', validate: false, allDry: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dry-run') out.dryRun = true;
        else if (a === '--validate') out.validate = true;
        else if (a === '--all-dry-run') out.allDry = true;
        else if (a === '--language') {
            const v = argv[++i] as 'ko' | 'en' | 'both';
            if (!v || !['ko', 'en', 'both'].includes(v)) fail(`--language requires one of: ko, en, both`);
            out.language = v;
        } else if (a === '--industry') {
            const v = argv[++i];
            if (!v) fail('--industry requires a value');
            if (!INDUSTRIES.includes(v as Industry)) {
                fail(`Unknown industry '${v}'. Valid: ${INDUSTRIES.join(', ')}`);
            }
            out.industry = v as Industry;
        } else if (a === '--unique-wfs') {
            const v = argv[++i];
            if (!v) fail('--unique-wfs requires a comma-separated value');
            out.uniqueWfs = v.split(',').map(s => s.trim()).filter(Boolean);
        } else if (a === '--help' || a === '-h') {
            printHelp();
            process.exit(0);
        } else {
            fail(`Unknown argument: ${a} (try --help)`);
        }
    }
    return out;
}

function printHelp(): void {
    console.log(`
scaffold-industry.ts v${VERSION} — Safety OS industry scaffold generator (Task A-01)

USAGE
  bun scripts/scaffold-industry.ts --industry <code> [options]
  bun scripts/scaffold-industry.ts --validate
  bun scripts/scaffold-industry.ts --all-dry-run

OPTIONS
  --industry <code>          Required. One of: ${INDUSTRIES.join(', ')}
  --unique-wfs <a,b,c>       Industry-unique workflow slugs (default: none)
  --language ko|en|both      README language pair (default: both)
  --dry-run                  Print planned output without writing
  --validate                 Run V-01..V-07 checks on existing generated outputs
  --all-dry-run              Dry-run all 12 industries + print summary table
  --help                     Show this help

EXAMPLES
  bun scripts/scaffold-industry.ts --industry datacenter --dry-run
  bun scripts/scaffold-industry.ts --industry datacenter
  bun scripts/scaffold-industry.ts --industry battery --unique-wfs silane-gas-leak-response,battery-room-fire-suppression --dry-run
`);
}

function fail(msg: string): never {
    console.error(`${RED}✗ ${msg}${RESET}`);
    process.exit(1);
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));

    if (args.validate) {
        process.exit(runValidation());
    }
    if (args.allDry) {
        dryRunAllIndustries();
        return;
    }
    if (!args.industry) {
        printHelp();
        fail('--industry is required (or use --validate / --all-dry-run)');
    }

    const anchors = loadAnchorTable();
    const plan = planGeneration(args.industry, args.uniqueWfs, args.language, anchors);

    if (args.dryRun) {
        printDryRun(plan);
        return;
    }

    console.log(`${CYAN}=== Generating scaffold: ${plan.industry} (${plan.displayName}) ===${RESET}`);
    executeGeneration(plan);

    // Maturity matrix update — read existing agent line count from the current row (best-effort).
    let agentLines = 0;
    let skills = 0;
    if (fs.existsSync(MATURITY_MATRIX)) {
        const m = fs.readFileSync(MATURITY_MATRIX, 'utf8').match(new RegExp(`^\\| ${plan.industry} \\| \\d+ \\| \\d+ \\| (\\d+) \\| \\d+ \\| (\\d+) \\|`, 'm'));
        if (m) { skills = parseInt(m[1], 10); agentLines = parseInt(m[2], 10); }
    }
    updateMaturityMatrix(plan.industry, agentLines, skills);

    console.log(`${GREEN}\n✓ generation complete for '${plan.industry}'. Run \`bun scripts/safety-audit.ts\` next.${RESET}`);
}

main();
