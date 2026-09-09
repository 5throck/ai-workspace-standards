// @version 1.1.0
// Variant-specific audit hook for Safety OS (co-safety).
// Invoked by core scripts/audit.ts (pluggable variant audit hook, ADR-0038) so the
// CSO legal_basis gate and domain test suite run on every /sync, not only at the
// next workspace audit. Replaces the variant-specific logic formerly embedded in
// scripts/audit.ts v2.6.5 and scripts/dev-sync.ts v1.5.0 (removed 2026-08-26 when
// both core scripts were refreshed to immutable L1 copies).
import * as fs from 'node:fs';
import { $ } from 'bun';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function fail(message: string): never {
    console.error(`${RED}✗ ${message}${RESET}`);
    process.exit(1);
}

// 0. variant.json skill manifest file-resolution gate.
//    Category folders such as skills/daily/ are valid containers, but every
//    declared skill entry must point to a concrete SKILL.md file.
if (fs.existsSync('variant.json')) {
    const raw = JSON.parse(fs.readFileSync('variant.json', 'utf-8')) as {
        skills?: Array<{ name?: string; file?: string }>;
    };
    const skills = Array.isArray(raw.skills) ? raw.skills : [];
    for (const skill of skills) {
        if (!skill?.name || !skill?.file) {
            fail(`variant.json skills[] entry must include name and file: ${JSON.stringify(skill)}`);
        }
        const normalized = skill.file.replace(/\\/g, '/');
        if (!normalized.endsWith('/SKILL.md') && normalized !== 'SKILL.md') {
            fail(`variant.json skill "${skill.name}" must point to a SKILL.md file (got ${skill.file})`);
        }
        if (!fs.existsSync(skill.file)) {
            fail(`variant.json skill "${skill.name}" file does not exist: ${skill.file}`);
        }
    }
    console.log(`${GREEN}✓ variant.json skill file references resolved (${skills.length} skill(s))${RESET}`);
}

// 1. Safety OS CSO gate: legal_basis >= 3 on workflows/evidence-models
if (fs.existsSync('variant.json') && fs.existsSync('scripts/co-safety/safety-audit.ts')) {
    const res = await $`bun scripts/co-safety/safety-audit.ts`.nothrow();
    if (res.exitCode !== 0) {
        fail(`Safety OS audit detected issues (run 'bun scripts/co-safety/safety-audit.ts' to see details)`);
    }
    console.log(`${GREEN}✓ Safety OS audit: legal_basis and domain checks passed${RESET}`);
}

// 2. Domain-specific test suites (variant only, run when present)
const testScripts = [
    'scripts/co-safety/test-pharma-general-profile.ts',
    'scripts/co-safety/test-chemical-handling-profile.ts',
    'scripts/co-safety/test-cross-domain-integration.ts',
    'scripts/co-safety/test-domain-scenarios.ts',
    'scripts/co-safety/test-runtime-tools.ts',
];
for (const testScript of testScripts) {
    if (fs.existsSync(testScript)) {
        const testRes = await $`bun ${testScript}`.nothrow();
        if (testRes.exitCode !== 0) {
            fail(`${testScript} failed`);
        }
    }
}
console.log(`${GREEN}✓ All variant-specific audit checks passed${RESET}`);
