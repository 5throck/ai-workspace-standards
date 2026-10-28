// @version 1.2.0
// v1.2.0 (2026-10-29, U-20261028-017): gate 0 parses variant.json →
//           skill_manifest.variant_specific (the previous top-level raw.skills
//           key does not exist in this variant, so the gate was a silent
//           no-op), guards JSON.parse, and checks the derived normalized path
//           skills/<name>/SKILL.md.
// Variant-specific audit hook for Safety OS (co-safety).
// Invoked by core scripts/audit.ts (pluggable variant audit hook, ADR-0044) so the
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

// 0. variant.json skill manifest file-resolution gate (U-20261028-017).
//    The manifest surface is variant.json → skill_manifest.variant_specific —
//    the previous parse read a top-level raw.skills key that does not exist in
//    this variant, making the gate a silent no-op ("0 skill(s)"). Each
//    variant_specific entry carries name (no file field), so the resolved
//    path is derived as skills/<name>/SKILL.md and checked normalized.
if (fs.existsSync('variant.json')) {
    let raw: { skill_manifest?: { variant_specific?: Array<{ name?: string }> } };
    try {
        raw = JSON.parse(fs.readFileSync('variant.json', 'utf-8'));
    } catch (e) {
        fail(`variant.json is not valid JSON: ${e instanceof Error ? e.message : e}`);
    }
    const skills = Array.isArray(raw?.skill_manifest?.variant_specific)
        ? raw.skill_manifest.variant_specific
        : [];
    for (const skill of skills) {
        if (!skill?.name) {
            fail(`variant.json skill_manifest.variant_specific entry must include name: ${JSON.stringify(skill)}`);
        }
        const normalized = `skills/${skill.name}/SKILL.md`.replace(/\\/g, '/');
        if (!fs.existsSync(normalized)) {
            fail(`variant.json skill "${skill.name}" file does not exist: ${normalized}`);
        }
    }
    console.log(`${GREEN}✓ variant.json skill_manifest.variant_specific references resolved (${skills.length} skill(s))${RESET}`);
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
