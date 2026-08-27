/**
 * Domain Configuration — config-driven audit validation
 *
 * Instead of hard-coding per-domain validation blocks in safety-audit.ts,
 * define all domains in this config array. The audit script iterates and
 * applies the same validation logic to each domain.
 *
 * @version 1.5.0
 * v1.5.0 (2026-08-23): (a) Renamed ehsconst required_evidence_fields
 *   sapa_article_12_compliance -> sapa_article_5_compliance per the PR #105
 *   article correction (SAPA Art 12 = notification of finalized criminal facts;
 *   the contract/subcontractor safety obligation is Art 5). (b) Populated the
 *   training domain's empty required_evidence_fields with the verified
 *   intersection of all 5 training evidence models ('record_id',
 *   'legal_basis') — only 2 of the 5 models currently carry the common.schema
 *   e_signature/nomenclature/audit_trail $refs, so that triple is NOT the
 *   intersection yet. (c) Expanded KNOWN_INDUSTRIES to the full
 *   applicable_industries vocabulary actually declared across workflows/**
 *   schema.yaml (21 values); both alias forms (medical_device/meddevice,
 *   pharma/pharmaceutical) are retained because live schemas use each form.
 * v1.4.0 (2026-07-11): Removed PSM's skip_workflow_validation blanket exemption —
 *   all 15 PSM workflow schemas now carry compliant multi-source (≥3-entry)
 *   legal_basis arrays (the last outlier, loto-lockout-tagout, was fixed rather
 *   than exempting the entire domain from array-format validation).
 * v1.3.0 (2026-07-05): Replaced per-domain min_legal_basis/min_workflow_legal_basis
 *   hardcoding with DEFAULT_MIN_LEGAL_BASIS/DEFAULT_MIN_WORKFLOW_LEGAL_BASIS constants.
 *   Domains that need a lower threshold must set it explicitly (only PSM has
 *   skip_workflow_validation; no domain currently overrides below the default).
 *   This ensures policy changes propagate automatically without editing 15 entries.
 * v1.2.0 (2026-07-05): Established min_legal_basis >= 3 as universal standard.
 * v1.1.0 (2026-07-03): Registered contractor-safety and occupational-health functional
 *   domains (TAR/Major Turnaround surge-scenario schemas) so safety-audit.ts validates
 *   their evidence-model legal_basis and required fields.
 */

// ── Universal defaults ─────────────────────────────────────────────────
// Policy (2026-07-05): All Safety OS evidence records and core workflows MUST cite
// >= 3 legal sources. Rationale: multi-source legal basis ensures regulatory
// traceability across overlapping Korean EHS statutes (OSHA-KR, SAPA, domain-specific
// acts) and reduces single-point compliance risk.
// Reference workflows (workflow_type: reference) retain >= 2 exception,
// enforced by safety-audit.ts isReference guard — not configurable here.

/** Minimum legal_basis entries required for evidence model records */
export const DEFAULT_MIN_LEGAL_BASIS = 3;

/** Minimum legal_basis entries required for core workflow schemas */
export const DEFAULT_MIN_WORKFLOW_LEGAL_BASIS = 3;

// ── Types ─────────────────────────────────────────────────────────────

export interface DomainConfig {
    name: string;
    tier: 'functional' | 'industry';
    required_evidence_fields: string[];
    /** Override DEFAULT_MIN_LEGAL_BASIS for this domain (must be >= DEFAULT) */
    min_legal_basis?: number;
    /** Override DEFAULT_MIN_WORKFLOW_LEGAL_BASIS for this domain (must be >= DEFAULT) */
    min_workflow_legal_basis?: number;
    description: string;
    /** Set true to skip array-format legal_basis check on workflow schemas (no registered domain sets it today) */
    skip_workflow_validation?: boolean;
}

// ── Helper: resolve defaults ───────────────────────────────────────────

function resolveDefaults(domain: DomainConfig): Required<Pick<DomainConfig, 'min_legal_basis' | 'min_workflow_legal_basis'>> {
    return {
        min_legal_basis: domain.min_legal_basis ?? DEFAULT_MIN_LEGAL_BASIS,
        min_workflow_legal_basis: domain.min_workflow_legal_basis ?? DEFAULT_MIN_WORKFLOW_LEGAL_BASIS,
    };
}

// ── Domain registry ────────────────────────────────────────────────────

const RAW_DOMAINS: DomainConfig[] = [
    // ── Functional domains ────────────────────────────────────────────
    {
        name: 'gmp',
        tier: 'industry',
        required_evidence_fields: ['e_signature', 'qrm_assessment', 'nomenclature', 'audit_trail'],
        description: 'Good Manufacturing Practice (pharma)',
    },
    {
        name: 'msds',
        tier: 'functional',
        required_evidence_fields: ['ghs_version'],
        description: 'Material Safety Data Sheet (chemical safety)',
    },
    {
        name: 'gdp',
        tier: 'industry',
        required_evidence_fields: ['gdp_certification_status', 'temperature_condition', 'batch_disposition_approved_ref'],
        description: 'Good Distribution Practice (pharma logistics)',
    },
    {
        name: 'glp',
        tier: 'industry',
        required_evidence_fields: ['glp_certification_authority', 'oecd_mad_applicable', 'study_director_id'],
        description: 'Good Laboratory Practice (non-clinical)',
    },
    {
        name: 'gcp',
        tier: 'industry',
        required_evidence_fields: ['irb_approval_ref', 'ich_e6_compliance', 'protocol_ref'],
        description: 'Good Clinical Practice (clinical trials)',
    },
    {
        name: 'gvp',
        tier: 'industry',
        required_evidence_fields: ['ich_e2_compliance', 'pbrer_cycle_ref', 'product_id'],
        description: 'Good Pharmacovigilance Practice (post-market)',
    },
    {
        name: 'psm',
        tier: 'functional',
        required_evidence_fields: [],
        description: 'Process Safety Management',
    },
    {
        name: 'training',
        tier: 'functional',
        required_evidence_fields: ['record_id', 'legal_basis'],
        description: 'Safety Training Management (OSHA-KR Art 13, 29, 31, 32, 36, 114 + SAPA Art 4 employer safety-health assurance duty, Art 5 subcontractor assurance duty, Art 8 safety-health education completion)',
    },
    {
        name: 'contractor-safety',
        tier: 'functional',
        required_evidence_fields: ['contractor_tier', 'surge_headcount', 'prequalification_completed'],
        description: 'Contractor Safety Management (TAR/Major Turnaround surge scenarios)',
    },
    {
        name: 'occupational-health',
        tier: 'functional',
        required_evidence_fields: ['tar_id', 'special_health_exam_completion_rate', 'heat_exposure_monitoring'],
        description: 'Occupational Health Surveillance (TAR/Major Turnaround health screening)',
    },
    {
        name: 'asset-integrity',
        tier: 'functional',
        required_evidence_fields: ['e_signature', 'nomenclature', 'audit_trail'],
        description: 'Asset Integrity Management (preventative maintenance, aging equipment)',
    },
    {
        name: 'incident-investigation',
        tier: 'functional',
        required_evidence_fields: ['e_signature', 'nomenclature', 'audit_trail'],
        description: 'Incident Investigation & Root Cause Analysis',
    },
    {
        name: 'risk-assessment',
        tier: 'functional',
        required_evidence_fields: ['e_signature', 'nomenclature', 'audit_trail'],
        description: 'Risk Assessment (hazard identification and scoring)',
    },

    // ── Industry domains ──────────────────────────────────────────────
    {
        name: 'ehsconst',
        tier: 'industry',
        required_evidence_fields: ['sapa_article_5_compliance', 'project_id', 'contractor_tier'],
        description: 'Construction Safety',
    },
    {
        name: 'gasterm',
        tier: 'industry',
        required_evidence_fields: ['facility_type', 'kgs_inspection_status', 'psm_applicable', 'gas_type'],
        description: 'Gas Terminal Safety (LNG/LPG/hydrogen)',
    },
    {
        name: 'powergen',
        tier: 'industry',
        required_evidence_fields: ['plant_type', 'kesa_inspection_status', 'voltage_class'],
        description: 'Power Generation Safety (nuclear excluded)',
    },
    {
        name: 'ehschem',
        tier: 'industry',
        required_evidence_fields: ['plant_category', 'psm_applicable', 'chemical_category'],
        description: 'Chemical Plant Safety (refining/petrochemical/specialty)',
    },
    {
        name: 'meddevice',
        tier: 'industry',
        required_evidence_fields: ['device_class', 'kgmp_certification_status', 'iso_13485_compliance'],
        description: 'Medical Device Safety (KGMP-MD + ISO 13485 + ISO 14971)',
    },
    {
        name: 'battery',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Secondary Battery Safety (cell manufacturing, thermal runaway, recycling)',
    },
    {
        name: 'biotech',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Biopharmaceutical CDMO & Bio-Lab Safety (bioreactor SIP, LMO containment)',
    },
    {
        name: 'cosmetics',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Cosmetics Safety (CGMP batch release, solvent exposure)',
    },
    {
        name: 'datacenter',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Data Center Safety (UPS fire, high voltage)',
    },
    {
        name: 'defense',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Defense & Explosives Safety (propellant, munitions storage)',
    },
    {
        name: 'food',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Food Safety (HACCP CCP monitoring, mixer LOTO)',
    },
    {
        name: 'logistics',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Port Logistics & Automated Warehouse Safety',
    },
    {
        name: 'railway',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Railway & Transit Infrastructure Safety',
    },
    {
        name: 'semicon',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Semiconductor & Display Safety (cleanroom, special gas)',
    },
    {
        name: 'shipbuilding',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Shipbuilding & Offshore Safety (confined space, heavy crane)',
    },
    {
        name: 'steelmaking',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Steelmaking & Heavy Metals Safety (molten metal, byproduct gas)',
    },
    {
        name: 'waste',
        tier: 'industry',
        required_evidence_fields: ['record_id', 'audit_trail'],
        description: 'Environmental Waste & Water Treatment Safety',
    },
];

/** Resolved domain configs with defaults applied — use this in consumers */
export const DOMAINS: Array<DomainConfig & Required<Pick<DomainConfig, 'min_legal_basis' | 'min_workflow_legal_basis'>>> =
    RAW_DOMAINS.map(d => ({ ...d, ...resolveDefaults(d) }));

/**
 * Known cross-domain reference fields and their target domains.
 */
export const CROSS_DOMAIN_REFS: Array<{
    field: string;
    fromDomain: string;
    fromTier: string;
    toDomain: string;
    toTier: string;
}> = [
    { field: 'batch_disposition_approved_ref', fromDomain: 'gdp', fromTier: 'industry', toDomain: 'gmp', toTier: 'industry' },
    { field: 'msds_record_ref', fromDomain: 'glp', fromTier: 'industry', toDomain: 'msds', toTier: 'functional' },
    { field: 'msds_record_ref', fromDomain: 'gasterm', fromTier: 'industry', toDomain: 'msds', toTier: 'functional' },
    { field: 'msds_record_ref', fromDomain: 'ehschem', fromTier: 'industry', toDomain: 'msds', toTier: 'functional' },
    { field: 'psm_psi_ref', fromDomain: 'ehschem', fromTier: 'industry', toDomain: 'psm', toTier: 'functional' },
    { field: 'psm_applicable', fromDomain: 'gasterm', fromTier: 'industry', toDomain: 'psm', toTier: 'functional' },
    { field: 'construction_permit_ref', fromDomain: 'gasterm', fromTier: 'industry', toDomain: 'ehsconst', toTier: 'industry' },
    { field: 'contractor_safety_plan_ref', fromDomain: 'gasterm', fromTier: 'industry', toDomain: 'contractor-safety', toTier: 'functional' },
];

/**
 * Known industries for applicable_industries validation.
 */
export const KNOWN_INDUSTRIES = [
    'chemical', 'gas_terminal', 'power_generation', 'construction', 'manufacturing',
    'medical_device', 'meddevice', 'pharma', 'pharmaceutical', 'food', 'cosmetics',
    'semiconductor', 'battery', 'shipbuilding', 'steelmaking', 'logistics', 'railway',
    'waste', 'defense', 'biotech', 'datacenter',
];
