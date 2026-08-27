#!/usr/bin/env tsx
/**
 * Domain Scaffolding Script
 *
 * Automates the 11-step domain onboarding SOP from
 * docs/_shared/domain-onboarding-guide.md.
 *
 * Usage:
 *   bun scripts/new-domain.ts <name> <tier> [industry-profile]
 *
 * Example:
 *   bun scripts/new-domain.ts cosmetics industry cosmetics
 *
 * @version 1.0.1
 * v1.0.1 (2026-07-11): Fixed stale agent-template comment claiming "min 2 for
 *   functional" legal_basis sources — policy has required min 3 for all domains
 *   since 2026-07-05 (see domain-config.ts DEFAULT_MIN_LEGAL_BASIS).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const name = process.argv[2];
const tier = process.argv[3] as 'functional' | 'industry';
const profile = process.argv[4] || name;

if (!name || !tier || !['functional', 'industry'].includes(tier)) {
    console.error(`${RED}Usage: bun scripts/new-domain.ts <name> <tier:functional|industry> [profile]${RESET}`);
    console.error(`${YELLOW}Example: bun scripts/new-domain.ts cosmetics industry cosmetics${RESET}`);
    process.exit(1);
}

const ROOT = process.cwd();
const tierPath = tier;

console.log(`${CYAN}=== Domain Scaffolding: ${name} (${tier}) ===${RESET}\n`);

// ── Step 1: Reserve domain name ──────────────────────────────────────
const existingDomains = fs.readdirSync(path.join(ROOT, 'agents', 'domains', tierPath))
    .filter(d => !d.startsWith('_'));
if (existingDomains.includes(name)) {
    console.error(`${RED}❌ Domain '${name}' already exists in ${tierPath}/${RESET}`);
    process.exit(1);
}
console.log(`${GREEN}✓ Step 1: Domain name '${name}' reserved${RESET}`);

// ── Step 2: Create standard substructure ────────────────────────────
const dirs = [
    `agents/domains/${tierPath}/${name}`,
    `docs/domains/${tierPath}/${name}`,
    `evidence-models/domains/${tierPath}/${name}`,
    `skills/domains/${tierPath}/${name}`,
    `workflows/domains/${tierPath}/${name}`,
];
for (const dir of dirs) {
    fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
}
console.log(`${GREEN}✓ Step 2: Directory structure created${RESET}`);

// ── Step 3: Author the Agent ────────────────────────────────────────
const agentFile = path.join(ROOT, 'agents', 'domains', tierPath, name, `${name}-agent.md`);
fs.writeFileSync(agentFile, `---
name: ${name}-agent
role: specialist
status: active
tier: {claude: medium, gemini-cli: medium, antigravity: medium}
model: inherit
description: "${name} domain specialist"
lifecycle: {phase: production, created: "${new Date().toISOString().split('T')[0]}"}
---

## Section A — Legal Basis
<!-- Add regulatory references (min 3 sources, both functional and industry tiers — see scripts/domain-config.ts DEFAULT_MIN_LEGAL_BASIS) -->

## Section B — Role & Responsibilities

### Role
<!-- Describe the agent's role -->

### Scope Limitation
<!-- Explicit out-of-scope domains -->

### Common Fields (all ${name}-*.json)
<!-- Define required common fields -->

## Section C — Operational Protocols

### Workflow Pattern
1. Receive task via PM/SWM dispatch
2. Read applicable workflow from workflows/domains/${tierPath}/${name}/
3. Generate evidence record using evidence-models/domains/${tierPath}/${name}/ schema
4. Escalate critical issues to PM

## PM-ONLY INVOCATION
Trigger: "TODO: Add trigger phrases"
`);
console.log(`${GREEN}✓ Step 3: Agent template created${RESET}`);

// ── Step 4: Author Industry Profile ─────────────────────────────────
const profileFile = path.join(ROOT, 'industry-profiles', `${profile}.yaml`);
fs.writeFileSync(profileFile, `# ${profile} Industry Profile — ${name} Domain (v1)
name: ${profile}
display_name: "${name}"
description: TODO
applicable_laws:
  - TODO: Add applicable laws
uses_functional_services:
${tier === 'industry' ? '  - functional/msds\n  - emergency' : '  # N/A for functional domains'}
workflows:
  ${name}:
    - TODO: Add workflow names
agent: ${name}-agent
version: "1.0"
status: active
last_updated: "${new Date().toISOString().split('T')[0]}"
`);
console.log(`${GREEN}✓ Step 4: Industry profile template created${RESET}`);

// ── Step 5: Author first workflow (placeholder) ─────────────────────
const wfDir = path.join(ROOT, 'workflows', 'domains', tierPath, name, 'placeholder-workflow');
fs.mkdirSync(wfDir, { recursive: true });
fs.writeFileSync(path.join(wfDir, 'schema.yaml'), `schema_version: "1.0"
workflow_id: placeholder-workflow
title: "TODO: Replace with actual workflow"
status: active
applicability: mandatory
${tier === 'industry' ? `uses_functional_services: [functional/msds, emergency]` : ''}
legal_basis:
  - TODO: Add legal basis 1
  - TODO: Add legal basis 2
  - TODO: Add legal basis 3
industry_profile: ${profile}
agent: ${name}-agent
evidence_model: ${name}-placeholder-record.json
`);
fs.writeFileSync(path.join(wfDir, 'README.md'), `# Placeholder Workflow

TODO: Replace with actual workflow content.

## 1. Objective
TODO

## 2. Workflow Steps
TODO

## 3. Evidence Record
Generate \`${name}-placeholder-record.json\`.
`);
console.log(`${GREEN}✓ Step 5: Placeholder workflow created${RESET}`);

// ── Step 6: Author evidence model (placeholder) ─────────────────────
const evidenceFile = path.join(ROOT, 'evidence-models', 'domains', tierPath, name, `${name}-placeholder-record.json`);
fs.writeFileSync(evidenceFile, JSON.stringify({
    '$schema': 'http://json-schema.org/draft-07/schema#',
    '$id': `${name}-placeholder-record.json`,
    title: `${name} Placeholder Record`,
    description: 'TODO: Replace with actual evidence model',
    version: '1.0.0',
    type: 'object',
    required: ['record_id', 'legal_basis', 'e_signature', 'nomenclature', 'audit_trail'],
    properties: {
        record_id: { type: 'string', pattern: `^${name.toUpperCase()}-PLACEHOLDER-[0-9]{4}-[0-9]{4}$` },
        legal_basis: { type: 'array', items: { type: 'string' }, minItems: 3 },
        e_signature: { '$ref': `${tier === 'industry' ? '../../' : ''}../../_shared/base/common.schema.json#/definitions/e_signature` },
        nomenclature: { '$ref': `${tier === 'industry' ? '../../' : ''}../../_shared/base/common.schema.json#/definitions/nomenclature` },
        audit_trail: { '$ref': `${tier === 'industry' ? '../../' : ''}../../_shared/base/common.schema.json#/definitions/audit_trail` },
    },
}, null, 2) + '\n');
console.log(`${GREEN}✓ Step 6: Placeholder evidence model created${RESET}`);

// ── Step 9: Author scope document ───────────────────────────────────
const scopeFile = path.join(ROOT, 'docs', 'domains', tierPath, name, 'scope.md');
fs.writeFileSync(scopeFile, `# ${name} Domain v1 — Scope

> **Domain**: \`${name}\` | **Tier**: ${tier}

## 1. Purpose
TODO: Describe domain purpose.

## 2. Matrix Position
${tier === 'industry'
    ? 'Industry domain — coordinator. References functional services (PSM, MSDS, Emergency).'
    : 'Functional domain — cross-industry methodology/data service.'}

## 3. Workflows
TODO: List workflows.

## 4. Common Fields
TODO: Define common evidence fields.

## 5. Legal Disclaimer
> This system provides workflow automation assistance only.
`);
console.log(`${GREEN}✓ Step 9: Scope document created${RESET}`);

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${CYAN}=== Scaffolding Complete ===${RESET}`);
console.log(`Domain: ${name} (${tier})`);
console.log(`Profile: ${profile}`);
console.log(`\n${YELLOW}Next steps:${RESET}`);
console.log(`  1. Edit agent: agents/domains/${tierPath}/${name}/${name}-agent.md`);
console.log(`  2. Edit profile: industry-profiles/${profile}.yaml`);
console.log(`  3. Replace placeholder workflow with actual workflows`);
console.log(`  4. Replace placeholder evidence model`);
console.log(`  5. Edit scope: docs/domains/${tierPath}/${name}/scope.md`);
console.log(`  6. Add regulation file: regulations/KR/<Regulator>-<Framework>.yaml`);
console.log(`  7. Run audit: bun scripts/safety-audit.ts`);
console.log(`  8. Update Active Domains Registry in domain-onboarding-guide.md`);
console.log(`  9. Update CHANGELOG.md and memory log`);
