#!/usr/bin/env tsx
/**
 * Pharma-General Profile Field Test
 *
 * Validates end-to-end integrity of the pharma-general industry profile:
 * profile → workflows → evidence models → agent → skills
 *
 * Test coverage:
 *   T-01: Profile YAML loads and has required fields
 *   T-02: Every workflow referenced in profile exists at workflows/domains/gmp/
 *   T-03: Every workflow has schema.yaml with required fields
 *   T-04: Every workflow has README.md
 *   T-05: Every workflow evidence_model reference resolves to actual file
 *   T-06: GMP agent exists at agents/domains/gmp/gmp-agent.md
 *   T-07: GMP agent has multi-source legal_basis in Section A
 *   T-08: All 3 GMP skills exist with SKILL.md
 *   T-09: GMP common schema defines required definitions
 *   T-10: Sample evidence record validates against schema (change-control)
 *
 * @version 1.0.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const ROOT = path.resolve(process.cwd());
const results: Array<{ test: string; pass: boolean; detail?: string }> = [];

function record(testId: string, description: string, pass: boolean, detail?: string) {
    results.push({ test: `${testId}: ${description}`, pass, detail });
    const mark = pass ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${mark} ${testId}: ${description}${detail && !pass ? ` — ${RED}${detail}${RESET}` : ''}`);
}

console.log(`${CYAN}=== Pharma-General Profile Field Test ===${RESET}\n`);

// ── T-01: Profile YAML loads and has required fields ─────────────────────────
console.log(`${CYAN}[T-01] Profile YAML validation${RESET}`);
const profilePath = path.join(ROOT, 'industry-profiles', 'pharma-general.yaml');
try {
    const profileContent = fs.readFileSync(profilePath, 'utf-8');
    const profile = yaml.load(profileContent) as any;

    if (!profile) {
        record('T-01', 'Profile YAML loads', false, 'empty or invalid YAML');
    } else {
        const requiredFields = ['profile_id', 'name', 'display_name', 'description', 'legal_basis', 'key_hazards', 'workflows', 'agent', 'status', 'last_updated', 'industry_tier'];
        const missing = requiredFields.filter(f => !profile[f]);
        if (missing.length === 0) {
            record('T-01', 'Profile YAML loads with all required fields', true);
            console.log(`       profile_id: ${profile.profile_id}`);
            console.log(`       agent: ${profile.agent}`);
            console.log(`       legal_basis: ${profile.legal_basis.length} entries`);
        } else {
            record('T-01', 'Profile YAML loads with all required fields', false, `missing: ${missing.join(', ')}`);
        }
    }
} catch (e: any) {
    record('T-01', 'Profile YAML loads', false, e.message);
}

// ── T-02 ~ T-05: Workflow chain validation ─────────────────────────────────
console.log(`\n${CYAN}[T-02 ~ T-05] Workflow chain validation${RESET}`);
try {
    const profileContent = fs.readFileSync(profilePath, 'utf-8');
    const profile = yaml.load(profileContent) as any;
    const workflows = profile.workflows?.gmp || [];
    console.log(`       Profile references ${workflows.length} GMP workflows`);

    let allWorkflowsExist = true;
    let allSchemasValid = true;
    let allReadmesExist = true;
    let allEvidenceModelsExist = true;

    for (const wf of workflows) {
        const wfDir = path.join(ROOT, 'workflows', 'domains', 'industry', 'gmp', wf);
        const schemaPath = path.join(wfDir, 'schema.yaml');
        const readmePath = path.join(wfDir, 'README.md');

        // T-02: Workflow directory exists
        if (!fs.existsSync(wfDir)) {
            record('T-02', `Workflow '${wf}' exists`, false, `missing directory ${wfDir}`);
            allWorkflowsExist = false;
            continue;
        }

        // T-03: schema.yaml with required fields
        if (!fs.existsSync(schemaPath)) {
            record('T-03', `Workflow '${wf}' has schema.yaml`, false);
            allSchemasValid = false;
            continue;
        }
        const schema = yaml.load(fs.readFileSync(schemaPath, 'utf-8')) as any;
        const requiredSchemaFields = ['schema_version', 'workflow_id', 'title', 'status', 'applicability', 'legal_basis', 'agent'];
        const missingSchema = requiredSchemaFields.filter(f => !schema[f]);
        if (missingSchema.length > 0) {
            record('T-03', `Workflow '${wf}' schema has all required fields`, false, `missing: ${missingSchema.join(', ')}`);
            allSchemasValid = false;
        }

        // T-04: README.md
        if (!fs.existsSync(readmePath)) {
            record('T-04', `Workflow '${wf}' has README.md`, false);
            allReadmesExist = false;
        }

        // T-05: Evidence model resolves
        const evidenceModelName = schema.evidence_model;
        if (evidenceModelName) {
            // Could be a single name or comma-separated list
            const models = evidenceModelName.split(',').map((s: string) => s.trim());
            for (const modelName of models) {
                const modelPath = path.join(ROOT, 'evidence-models', 'domains', 'industry', 'gmp', modelName);
                if (!fs.existsSync(modelPath)) {
                    record('T-05', `Evidence model '${modelName}' for workflow '${wf}' exists`, false);
                    allEvidenceModelsExist = false;
                }
            }
        }
    }

    if (allWorkflowsExist) record('T-02', `All ${workflows.length} profile-referenced workflows exist`, true);
    if (allSchemasValid) record('T-03', `All workflow schemas have required fields`, true);
    if (allReadmesExist) record('T-04', `All workflows have README.md`, true);
    if (allEvidenceModelsExist) record('T-05', `All evidence model references resolve`, true);
} catch (e: any) {
    record('T-02~05', 'Workflow chain', false, e.message);
}

// ── T-06: GMP agent exists ───────────────────────────────────────────────────
console.log(`\n${CYAN}[T-06] GMP agent existence${RESET}`);
const agentPath = path.join(ROOT, 'agents', 'domains', 'industry', 'gmp', 'gmp-agent.md');
if (fs.existsSync(agentPath)) {
    record('T-06', 'GMP agent exists at agents/domains/gmp/gmp-agent.md', true);
} else {
    record('T-06', 'GMP agent exists', false, `not found at ${agentPath}`);
}

// ── T-07: Agent has multi-source legal basis ─────────────────────────────────
console.log(`\n${CYAN}[T-07] Agent legal basis${RESET}`);
try {
    const agentContent = fs.readFileSync(agentPath, 'utf-8');
    const hasLegalBasis = agentContent.includes('## Section A — Legal Basis');
    const referencesPharmaLaw = agentContent.includes('약사법') && agentContent.includes('Article 37');
    const referencesICH = agentContent.includes('ICH Q7') || agentContent.includes('ICH Q9') || agentContent.includes('ICH Q10');
    const referencesPICS = agentContent.includes('PIC/S');

    if (hasLegalBasis && referencesPharmaLaw && referencesICH && referencesPICS) {
        record('T-07', 'Agent has multi-source legal basis (약사법 + ICH + PIC/S)', true);
    } else {
        record('T-07', 'Agent has multi-source legal basis', false,
            `legalBasis=${hasLegalBasis}, pharmaLaw=${referencesPharmaLaw}, ICH=${referencesICH}, PICS=${referencesPICS}`);
    }
} catch (e: any) {
    record('T-07', 'Agent legal basis', false, e.message);
}

// ── T-08: GMP skills exist ───────────────────────────────────────────────────
console.log(`\n${CYAN}[T-08] GMP skills existence${RESET}`);
const expectedSkills = ['change-control', 'deviation-capa', 'qrm'];
let allSkillsExist = true;
for (const skill of expectedSkills) {
    const skillPath = path.join(ROOT, 'skills', 'domains', 'industry', 'gmp', skill, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
        console.log(`  ${GREEN}✓${RESET} skill '${skill}' exists`);
    } else {
        console.log(`  ${RED}✗${RESET} skill '${skill}' missing at ${skillPath}`);
        allSkillsExist = false;
    }
}
record('T-08', `All ${expectedSkills.length} GMP skills exist`, allSkillsExist);

// ── T-09: GMP common schema definitions ──────────────────────────────────────
console.log(`\n${CYAN}[T-09] Common schema (multi-domain)${RESET}`);
const commonSchemaPath = path.join(ROOT, 'evidence-models', '_shared', 'base', 'common.schema.json');
try {
    const commonSchema = JSON.parse(fs.readFileSync(commonSchemaPath, 'utf-8'));
    const requiredDefs = ['e_signature', 'qrm_assessment', 'nomenclature', 'audit_trail'];
    const defs = commonSchema.definitions || {};
    const missing = requiredDefs.filter(d => !defs[d]);
    if (missing.length === 0) {
        record('T-09', `Common schema has all 4 required definitions`, true);
    } else {
        record('T-09', `Common schema definitions`, false, `missing: ${missing.join(', ')}`);
    }
} catch (e: any) {
    record('T-09', 'Common schema', false, e.message);
}

// ── T-10: Sample evidence record validation ──────────────────────────────────
console.log(`\n${CYAN}[T-10] Sample evidence record schema validation${RESET}`);
try {
    // Pick change-control evidence model and validate its schema structure
    const sampleModelPath = path.join(ROOT, 'evidence-models', 'domains', 'industry', 'gmp', 'gmp-change-control-record.json');
    const sampleModel = JSON.parse(fs.readFileSync(sampleModelPath, 'utf-8'));

    const requiredProps = ['record_id', 'change_id', 'title', 'status', 'legal_basis',
                           'e_signature', 'qrm_assessment', 'nomenclature', 'audit_trail'];
    const props = Object.keys(sampleModel.properties || {});
    const missing = requiredProps.filter(p => !props.includes(p));
    if (missing.length === 0) {
        record('T-10', `Sample (change-control) has all required properties`, true);
        console.log(`       properties count: ${props.length}`);
        console.log(`       required count: ${sampleModel.required?.length || 0}`);

        // Verify required array includes all key fields
        const requiredArray = sampleModel.required || [];
        const allInRequired = requiredProps.every(p => requiredArray.includes(p));
        if (allInRequired) {
            console.log(`       ${GREEN}✓${RESET} all key fields in 'required' array`);
        } else {
            console.log(`       ${YELLOW}!${RESET} some key fields not in 'required' array`);
        }
    } else {
        record('T-10', `Sample schema properties`, false, `missing: ${missing.join(', ')}`);
    }
} catch (e: any) {
    record('T-10', 'Sample schema validation', false, e.message);
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`\n${CYAN}=== Test Report ===${RESET}`);
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`  Passed: ${GREEN}${passed}${RESET}`);
console.log(`  Failed: ${RED}${failed}${RESET}`);
console.log(`  Total:  ${results.length}\n`);

if (failed === 0) {
    console.log(`${GREEN}✅ pharma-general profile field test PASSED${RESET}`);
    process.exit(0);
} else {
    console.log(`${RED}❌ pharma-general profile field test FAILED${RESET}`);
    process.exit(1);
}
