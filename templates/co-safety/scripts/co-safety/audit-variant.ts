// @version 1.0.0
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

// 1. Safety OS CSO gate: legal_basis >= 3 on workflows/evidence-models
if (fs.existsSync('variant.json') && fs.existsSync('scripts/co-safety/safety-audit.ts')) {
    const res = await $`bun scripts/co-safety/safety-audit.ts`.nothrow();
    if (res.exitCode !== 0) {
        console.error(`${RED}✗ Safety OS audit detected issues (run 'bun scripts/co-safety/safety-audit.ts' to see details)${RESET}`);
        process.exit(1);
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
            console.error(`${RED}✗ ${testScript} failed${RESET}`);
            process.exit(1);
        }
    }
}
console.log(`${GREEN}✓ All variant-specific audit checks passed${RESET}`);
