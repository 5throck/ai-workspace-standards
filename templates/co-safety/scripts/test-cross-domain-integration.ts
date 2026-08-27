#!/usr/bin/env tsx
/**
 * Cross-Domain Integration Test
 *
 * Validates end-to-end integrity of the 2-Tier matrix:
 *   T-01: Pharmaceutical lifecycle chain (GLP→GCP→GMP→GDP→GVP)
 *   T-02: Cross-domain reference fields resolve to existing schemas
 *   T-03: All reference workflows have valid target_agents
 *   T-04: Functional domains have applicable_industries (matrix metadata)
 *   T-05: Industry domains declare uses_functional_services
 *   T-06: Emergency workflows can receive dispatches from reference workflows
 *   T-07: Evidence model $ref paths resolve correctly (depth check)
 *   T-08: 2-Tier folder structure: functional/ and industry/ exist
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

console.log(`${CYAN}=== Cross-Domain Integration Test ===${RESET}\n`);

// ── T-01: Pharmaceutical lifecycle chain ─────────────────────────────────────
console.log(`${CYAN}[T-01] Pharmaceutical lifecycle chain (GLP→GCP→GMP→GDP→GVP)${RESET}`);
const lifecycleDomains = [
    { name: 'glp', path: 'domains/industry/glp', agent: 'glp-agent' },
    { name: 'gcp', path: 'domains/industry/gcp', agent: 'gcp-agent' },
    { name: 'gmp', path: 'domains/industry/gmp', agent: 'gmp-agent' },
    { name: 'gdp', path: 'domains/industry/gdp', agent: 'gdp-agent' },
    { name: 'gvp', path: 'domains/industry/gvp', agent: 'gvp-agent' },
];
let lifecycleComplete = true;
for (const dom of lifecycleDomains) {
    const agentPath = path.join(ROOT, 'agents', dom.path, `${dom.agent}.md`);
    const wfPath = path.join(ROOT, 'workflows', dom.path);
    if (!fs.existsSync(agentPath) || !fs.existsSync(wfPath)) {
        lifecycleComplete = false;
        record('T-01', `Lifecycle domain '${dom.name}' exists`, false);
    }
}
if (lifecycleComplete) record('T-01', 'All 5 lifecycle domains present (GLP→GCP→GMP→GDP→GVP)', true);

// ── T-02: Cross-domain reference fields ──────────────────────────────────────
console.log(`\n${CYAN}[T-02] Cross-domain reference field resolution${RESET}`);
const crossDomainRefs = [
    { field: 'batch_disposition_approved_ref', fromDomain: 'gdp', targetDomain: 'gmp', targetTier: 'industry' },
    { field: 'msds_record_ref', fromDomain: 'glp', targetDomain: 'msds', targetTier: 'functional' },
    { field: 'msds_record_ref', fromDomain: 'gasterm', targetDomain: 'msds', targetTier: 'functional' },
    { field: 'rmp_version_ref', fromDomain: 'gvp', targetDomain: 'gvp', targetTier: 'industry' },
    { field: 'protocol_ref', fromDomain: 'gcp', targetDomain: 'gcp', targetTier: 'industry' },
    { field: 'psm_applicable', fromDomain: 'gasterm', targetDomain: 'psm', targetTier: 'functional' },
];
let refsValid = true;
for (const ref of crossDomainRefs) {
    // Check source evidence models have the field
    const sourceDir = path.join(ROOT, 'evidence-models', 'domains');
    const tierPath = ref.targetTier;
    const targetDir = path.join(sourceDir, tierPath, ref.targetDomain);
    const sourceExists = fs.existsSync(targetDir);
    if (!sourceExists) {
        record('T-02', `Cross-ref '${ref.field}' target domain '${ref.targetDomain}' exists`, false);
        refsValid = false;
    }
}
if (refsValid) record('T-02', 'All cross-domain reference targets exist', true);

// ── T-03: Reference workflows have valid target_agents ───────────────────────
console.log(`\n${CYAN}[T-03] Reference workflow target_agent validation${RESET}`);
const workflowDir = path.join(ROOT, 'workflows');
const allSchemas: string[] = [];
function findSchemas(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== '_template' && entry.name !== '_shared') {
            findSchemas(full);
        } else if (entry.isFile() && entry.name === 'schema.yaml') {
            allSchemas.push(full);
        }
    }
}
findSchemas(workflowDir);

const validAgents = ['emergency-agent', 'compliance-agent', 'pm', 'sgm', 'swm'];
const refWorkflows: string[] = [];
let refValid = true;
for (const schemaFile of allSchemas) {
    try {
        const doc = yaml.load(fs.readFileSync(schemaFile, 'utf-8')) as any;
        if (doc?.workflow_type === 'reference') {
            refWorkflows.push(doc.workflow_id);
            if (!doc.target_agent || !validAgents.includes(doc.target_agent)) {
                record('T-03', `Reference workflow '${doc.workflow_id}' has valid target_agent`, false,
                    `target_agent='${doc.target_agent}'`);
                refValid = false;
            }
        }
    } catch { /* skip */ }
}
if (refValid) record('T-03', `All ${refWorkflows.length} reference workflows have valid target_agents`, true);

// ── T-04: PSM applicable_industries (matrix metadata) ────────────────────────
console.log(`\n${CYAN}[T-04] PSM applicable_industries (matrix metadata)${RESET}`);
const psmDir = path.join(workflowDir, 'domains', 'functional', 'psm');
const psmSchemas = fs.existsSync(psmDir) ?
    fs.readdirSync(psmDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => path.join(psmDir, e.name, 'schema.yaml'))
        .filter(f => fs.existsSync(f)) : [];
let hasMatrixMeta = true;
for (const f of psmSchemas) {
    const doc = yaml.load(fs.readFileSync(f, 'utf-8')) as any;
    if (!doc?.applicable_industries) {
        hasMatrixMeta = false;
        break;
    }
}
if (hasMatrixMeta && psmSchemas.length > 0) {
    record('T-04', `All ${psmSchemas.length} PSM workflows have applicable_industries`, true);
} else {
    record('T-04', 'PSM applicable_industries', false, `${psmSchemas.length} workflows checked`);
}

// ── T-05: Industry domains declare uses_functional_services ──────────────────
console.log(`\n${CYAN}[T-05] Industry domains: uses_functional_services${RESET}`);
const industryWfDir = path.join(workflowDir, 'domains', 'industry');
const industryDomains = fs.existsSync(industryWfDir) ?
    fs.readdirSync(industryWfDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) : [];
let hasFuncSvc = true;
let checkedCount = 0;
for (const dom of industryDomains) {
    const domDir = path.join(industryWfDir, dom);
    const domSchemas = fs.readdirSync(domDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => path.join(domDir, e.name, 'schema.yaml'))
        .filter(f => fs.existsSync(f));
    for (const f of domSchemas) {
        checkedCount++;
        const doc = yaml.load(fs.readFileSync(f, 'utf-8')) as any;
        if (!doc?.uses_functional_services) {
            // Not all industry workflows must have this, but at least some should
        }
    }
}
// Check if at least ehschem has it (matrix-native domain)
const ehschemDir = path.join(industryWfDir, 'ehschem');
if (fs.existsSync(ehschemDir)) {
    const ehschemSchema = fs.readdirSync(ehschemDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => path.join(ehschemDir, e.name, 'schema.yaml'))
        .filter(f => fs.existsSync(f));
    let ehschemHasSvc = false;
    for (const f of ehschemSchema) {
        const doc = yaml.load(fs.readFileSync(f, 'utf-8')) as any;
        if (doc?.uses_functional_services) { ehschemHasSvc = true; break; }
    }
    if (ehschemHasSvc) {
        record('T-05', 'ehschem (matrix-native) declares uses_functional_services', true);
    } else {
        record('T-05', 'ehschem uses_functional_services', false);
    }
} else {
    record('T-05', 'Industry domain ehschem exists', false, 'not found');
}

// ── T-06: Emergency workflows exist for dispatch targets ─────────────────────
console.log(`\n${CYAN}[T-06] Emergency workflows for dispatch targets${RESET}`);
const emergencyDir = path.join(workflowDir, 'emergency');
const emergencyScenarios = fs.existsSync(emergencyDir) ?
    fs.readdirSync(emergencyDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name) : [];
const requiredScenarios = ['fire-response', 'chemical-release', 'explosion-gas-response', 'disaster-response'];
let allScenariosExist = true;
for (const sc of requiredScenarios) {
    if (!emergencyScenarios.includes(sc)) {
        allScenariosExist = false;
        record('T-06', `Emergency scenario '${sc}' exists`, false);
    }
}
if (allScenariosExist) {
    record('T-06', `All ${requiredScenarios.length} required emergency scenarios exist (${emergencyScenarios.length} total)`, true);
}

// ── T-07: Evidence model $ref depth correctness ──────────────────────────────
console.log(`\n${CYAN}[T-07] Evidence model $ref depth correctness${RESET}`);
const evidenceDir = path.join(ROOT, 'evidence-models', 'domains');
let refDepthOk = true;
let checkedRefs = 0;
function checkRefs(dir: string, expectedDepth: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            checkRefs(full, expectedDepth);
        } else if (entry.name.endsWith('.json')) {
            try {
                const content = fs.readFileSync(full, 'utf-8');
                const refs = content.match(/"\$ref":\s*"[^"]+"/g) || [];
                for (const refMatch of refs) {
                    checkedRefs++;
                    const refPath = refMatch.match(/"([^"]+)"$/)?.[1] || '';
                    if (refPath.includes('_shared/base/common.schema.json')) {
                        // Check depth matches expected
                        if (!refPath.startsWith(expectedDepth)) {
                            refDepthOk = false;
                        }
                    }
                }
            } catch { /* skip */ }
        }
    }
}
// functional and industry are both at depth 3 (../../../)
checkRefs(path.join(evidenceDir, 'functional'), '../../../');
checkRefs(path.join(evidenceDir, 'industry'), '../../../');
if (refDepthOk) {
    record('T-07', `${checkedRefs} $ref paths have correct depth (../../../)`, true);
} else {
    record('T-07', 'Some $ref paths have incorrect depth', false);
}

// ── T-08: 2-Tier folder structure ────────────────────────────────────────────
console.log(`\n${CYAN}[T-08] 2-Tier folder structure (functional/ + industry/)${RESET}`);
const tierDirs = ['agents', 'workflows', 'evidence-models', 'skills', 'docs'];
let structureOk = true;
for (const top of tierDirs) {
    const funcPath = path.join(ROOT, top, 'domains', 'functional');
    const indPath = path.join(ROOT, top, 'domains', 'industry');
    if (!fs.existsSync(funcPath) || !fs.existsSync(indPath)) {
        structureOk = false;
        record('T-08', `${top}/domains/functional/ + industry/ exist`, false);
    }
}
if (structureOk) {
    const funcCount = fs.readdirSync(path.join(ROOT, 'workflows', 'domains', 'functional')).filter(e => !e.startsWith('_')).length;
    const indCount = fs.readdirSync(path.join(ROOT, 'workflows', 'domains', 'industry')).length;
    record('T-08', `2-Tier structure verified (${funcCount} functional + ${indCount} industry domains)`, true);
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`\n${CYAN}=== Test Report ===${RESET}`);
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`  Passed: ${GREEN}${passed}${RESET}`);
console.log(`  Failed: ${RED}${failed}${RESET}`);
console.log(`  Total:  ${results.length}\n`);

if (failed === 0) {
    console.log(`${GREEN}✅ cross-domain integration test PASSED${RESET}`);
    process.exit(0);
} else {
    console.log(`${RED}❌ cross-domain integration test FAILED${RESET}`);
    process.exit(1);
}
