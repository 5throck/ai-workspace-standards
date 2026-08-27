#!/usr/bin/env tsx
/**
 * Chemical-Handling Profile Field Test
 *
 * Validates end-to-end integrity of the MSDS / chemical-handling industry profile:
 * profile → workflows → evidence models → agent → skills
 *
 * Test coverage:
 *   T-01: Profile YAML loads and has required fields
 *   T-02: Every workflow referenced in profile exists at workflows/domains/functional/msds/
 *   T-03: Every workflow has schema.yaml with required fields
 *   T-04: Every workflow has README.md
 *   T-05: Every workflow evidence_model reference resolves
 *   T-06: MSDS agent exists at agents/domains/functional/msds/msds-agent.md
 *   T-07: MSDS agent has multi-source legal basis (≥3 sources)
 *   T-08: MSDS agent has scope limitation (occupational-health boundary)
 *   T-09: All 3 MSDS skills exist with SKILL.md
 *   T-10: Common schema defines required definitions (multi-domain shared)
 *   T-11: Sample MSDS record has GHS 16 sections + ghs_version
 *   T-12: Reference workflow (chemical-spill-reference) has correct pattern fields
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

console.log(`${CYAN}=== Chemical-Handling Profile Field Test ===${RESET}\n`);

// T-01: Profile YAML loads
console.log(`${CYAN}[T-01] Profile YAML validation${RESET}`);
const profilePath = path.join(ROOT, 'industry-profiles', 'chemical-handling.yaml');
try {
    const profile = yaml.load(fs.readFileSync(profilePath, 'utf-8')) as any;
    const requiredFields = ['profile_id', 'name', 'display_name', 'description', 'legal_basis', 'key_hazards', 'workflows', 'agent', 'status', 'last_updated', 'industry_tier', 'ghs_version_current'];
    const missing = requiredFields.filter(f => !profile[f]);
    if (missing.length === 0) {
        record('T-01', 'Profile YAML loads with all required fields', true);
        console.log(`       profile_id: ${profile.profile_id}`);
        console.log(`       agent: ${profile.agent}`);
        console.log(`       ghs_version: ${profile.ghs_version_current}`);
        console.log(`       legal_basis: ${profile.legal_basis?.length || 0} entries`);
    } else {
        record('T-01', 'Profile YAML loads with all required fields', false, `missing: ${missing.join(', ')}`);
    }
} catch (e: any) {
    record('T-01', 'Profile YAML loads', false, e.message);
}

// T-02 ~ T-05: Workflow chain validation
console.log(`\n${CYAN}[T-02 ~ T-05] Workflow chain validation${RESET}`);
const profile = yaml.load(fs.readFileSync(profilePath, 'utf-8')) as any;
const workflows = profile.workflows?.msds || [];
console.log(`       Profile references ${workflows.length} MSDS workflows`);

let allWorkflowsExist = true, allSchemasValid = true, allReadmesExist = true, allEvidenceModelsExist = true;

for (const wf of workflows) {
    const wfDir = path.join(ROOT, 'workflows', 'domains', 'functional', 'msds', wf);
    const schemaPath = path.join(wfDir, 'schema.yaml');
    const readmePath = path.join(wfDir, 'README.md');

    if (!fs.existsSync(wfDir)) {
        record('T-02', `Workflow '${wf}' exists`, false);
        allWorkflowsExist = false;
        continue;
    }
    if (!fs.existsSync(schemaPath)) {
        record('T-03', `Workflow '${wf}' has schema.yaml`, false);
        allSchemasValid = false;
        continue;
    }
    const schema = yaml.load(fs.readFileSync(schemaPath, 'utf-8')) as any;
    const requiredSchemaFields = ['schema_version', 'workflow_id', 'status', 'applicability', 'legal_basis'];
    const missingSchema = requiredSchemaFields.filter(f => !schema[f]);
    if (missingSchema.length > 0) {
        record('T-03', `Workflow '${wf}' schema has required fields`, false, `missing: ${missingSchema.join(', ')}`);
        allSchemasValid = false;
    }
    if (!fs.existsSync(readmePath)) {
        record('T-04', `Workflow '${wf}' has README.md`, false);
        allReadmesExist = false;
    }
    const evidenceModelName = schema.evidence_model;
    if (evidenceModelName) {
        const models = evidenceModelName.split(',').map((s: string) => s.trim());
        for (const modelName of models) {
            const modelPath = path.join(ROOT, 'evidence-models', 'domains', 'functional', 'msds', modelName);
            if (!fs.existsSync(modelPath)) {
                record('T-05', `Evidence model '${modelName}' resolves`, false);
                allEvidenceModelsExist = false;
            }
        }
    }
}
if (allWorkflowsExist) record('T-02', `All ${workflows.length} workflows exist`, true);
if (allSchemasValid) record('T-03', `All workflow schemas have required fields`, true);
if (allReadmesExist) record('T-04', `All workflows have README.md`, true);
if (allEvidenceModelsExist) record('T-05', `All evidence model references resolve`, true);

// T-06: MSDS agent
console.log(`\n${CYAN}[T-06] MSDS agent existence${RESET}`);
const agentPath = path.join(ROOT, 'agents', 'domains', 'functional', 'msds', 'msds-agent.md');
if (fs.existsSync(agentPath)) {
    record('T-06', 'MSDS agent exists at agents/domains/functional/msds/msds-agent.md', true);
} else {
    record('T-06', 'MSDS agent exists', false);
}

// T-07: Agent multi-source legal basis (≥3)
console.log(`\n${CYAN}[T-07] Agent legal basis (≥3 sources)${RESET}`);
try {
    const agentContent = fs.readFileSync(agentPath, 'utf-8');
    const hasLegalBasis = agentContent.includes('## Section A — Legal Basis');
    const countKeywords = ['OSHA-KR', 'K-REACH', 'GHS', 'TCCL'].filter(k => agentContent.includes(k)).length;
    if (hasLegalBasis && countKeywords >= 3) {
        record('T-07', `Agent has multi-source legal basis (${countKeywords} regulatory frameworks)`, true);
    } else {
        record('T-07', 'Agent has multi-source legal basis', false, `only ${countKeywords} frameworks referenced`);
    }
} catch (e: any) {
    record('T-07', 'Agent legal basis', false, e.message);
}

// T-08: Scope limitation (OH boundary)
console.log(`\n${CYAN}[T-08] Scope limitation (OH boundary)${RESET}`);
try {
    const agentContent = fs.readFileSync(agentPath, 'utf-8');
    const hasScopeLimitation = agentContent.toLowerCase().includes('scope limitation');
    const hasOHRef = agentContent.includes('occupational-health-agent');
    if (hasScopeLimitation && hasOHRef) {
        record('T-08', 'Agent has explicit scope limitation + OH boundary', true);
    } else {
        record('T-08', 'Scope limitation', false, `scope=${hasScopeLimitation}, OH=${hasOHRef}`);
    }
} catch (e: any) {
    record('T-08', 'Scope limitation', false, e.message);
}

// T-09: MSDS skills
console.log(`\n${CYAN}[T-09] MSDS skills existence${RESET}`);
const expectedSkills = ['msds-parser', 'ghs-classifier', 'chemical-risk-assessment'];
let allSkillsExist = true;
for (const skill of expectedSkills) {
    const skillPath = path.join(ROOT, 'skills', 'domains', 'functional', 'msds', skill, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
        console.log(`  ${GREEN}✓${RESET} skill '${skill}' exists`);
    } else {
        console.log(`  ${RED}✗${RESET} skill '${skill}' missing`);
        allSkillsExist = false;
    }
}
record('T-09', `All ${expectedSkills.length} MSDS skills exist`, allSkillsExist);

// T-10: Common schema definitions
console.log(`\n${CYAN}[T-10] Common schema (multi-domain)${RESET}`);
const commonSchemaPath = path.join(ROOT, 'evidence-models', '_shared', 'base', 'common.schema.json');
try {
    const commonSchema = JSON.parse(fs.readFileSync(commonSchemaPath, 'utf-8'));
    const requiredDefs = ['e_signature', 'qrm_assessment', 'nomenclature', 'audit_trail'];
    const missing = requiredDefs.filter(d => !commonSchema.definitions?.[d]);
    if (missing.length === 0) {
        record('T-10', `Common schema has all 4 required definitions`, true);
    } else {
        record('T-10', `Common schema definitions`, false, `missing: ${missing.join(', ')}`);
    }
} catch (e: any) {
    record('T-10', 'Common schema', false, e.message);
}

// T-11: Sample MSDS record (16 sections + ghs_version)
console.log(`\n${CYAN}[T-11] Sample MSDS record validation${RESET}`);
try {
    const sampleModelPath = path.join(ROOT, 'evidence-models', 'domains', 'functional', 'msds', 'msds-record.json');
    const sampleModel = JSON.parse(fs.readFileSync(sampleModelPath, 'utf-8'));
    const props = Object.keys(sampleModel.properties || {});

    const hasGhsVersion = props.includes('ghs_version');
    const sectionsProp = sampleModel.properties.sections;
    const has16Sections = sectionsProp?.properties &&
                          Object.keys(sectionsProp.properties).filter(k => k.startsWith('s')).length >= 16;

    if (hasGhsVersion && has16Sections) {
        record('T-11', `msds-record has ghs_version + GHS 16 sections`, true);
        console.log(`       properties: ${props.length}, sections: ${Object.keys(sectionsProp.properties).filter(k => k.startsWith('s')).length}`);
    } else {
        record('T-11', 'msds-record structure', false, `ghs_version=${hasGhsVersion}, 16_sections=${has16Sections}`);
    }
} catch (e: any) {
    record('T-11', 'Sample schema', false, e.message);
}

// T-12: Reference workflow pattern
console.log(`\n${CYAN}[T-12] Reference workflow pattern${RESET}`);
try {
    const refSchemaPath = path.join(ROOT, 'workflows', 'domains', 'functional', 'msds', 'chemical-spill-reference', 'schema.yaml');
    const refSchema = yaml.load(fs.readFileSync(refSchemaPath, 'utf-8')) as any;
    const hasType = refSchema.workflow_type === 'reference';
    const hasTarget = refSchema.target_agent === 'emergency-agent';
    const hasDataProvided = Array.isArray(refSchema.data_provided) && refSchema.data_provided.length > 0;
    const hasHandoff = refSchema.handoff_protocol && refSchema.handoff_protocol.trigger;

    if (hasType && hasTarget && hasDataProvided && hasHandoff) {
        record('T-12', 'Reference workflow has all pattern fields', true);
        console.log(`       workflow_type: ${refSchema.workflow_type}`);
        console.log(`       target_agent: ${refSchema.target_agent}`);
        console.log(`       data_provided: ${refSchema.data_provided.length} items`);
    } else {
        record('T-12', 'Reference workflow pattern', false,
            `type=${hasType}, target=${hasTarget}, data=${hasDataProvided}, handoff=${hasHandoff}`);
    }
} catch (e: any) {
    record('T-12', 'Reference workflow', false, e.message);
}

// Report
console.log(`\n${CYAN}=== Test Report ===${RESET}`);
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`  Passed: ${GREEN}${passed}${RESET}`);
console.log(`  Failed: ${RED}${failed}${RESET}`);
console.log(`  Total:  ${results.length}\n`);

if (failed === 0) {
    console.log(`${GREEN}✅ chemical-handling profile field test PASSED${RESET}`);
    process.exit(0);
} else {
    console.log(`${RED}❌ chemical-handling profile field test FAILED${RESET}`);
    process.exit(1);
}
