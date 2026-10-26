# validate-templates.ts Script Lifecycle

## Metadata

- **Script**: validate-templates
- **Status**: active
- **Version**: 1.61.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-27
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-05-26

## Description

Template lifecycle validation gate: scaffold-identity, package contract, command/platform-skill parity across the five mirrors, mirror hygiene, registry sync (VA-08), variant contract (B-series), managed-block and cross-twin parity, size budgets, and (since v1.59.0) L1 import closure. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-27 | production | production | v1.60.0 → v1.61.0 (T-20261027-001): new Error arm `agent-quality-recursive` — recursive scan of every templates/<common\|co-*>/agents/ tree covering co-safety's nested agents/domains/** + agents/_shared/** layout: exactly one scalar `tier: high\|medium\|low` per non-README/non-underscore/non-extends agent file (ADR-0102; map form, invalid scalar, or missing declaration FAILs; extends stubs skip — chain-resolved by roster-tier-consistency) plus body completeness via validate-agents.ts agentBodyCompletenessFinding (≥40 non-empty body lines, ≥4 `## ` sections). Closes the flat-scan gap where 37 map-form tier files + 23 stub-quality bodies under co-safety's nested trees survived every shipped gate until the nightly scaffold E2E caught them. | automation-engineer |
| 2026-10-26 | production | production | v1.59.1 → v1.60.0 (ADR-0102 / T-20261026-018, user ruling 2): WS-01 Check 4 (agents/*.md tier frontmatter vs schema agent_tiers) retired — agent_tiers removed from docs/workspace-schema.json; the agent file's scalar `tier:` declaration is the single source (validity: validate-model-registry v2; cross-surface parity: Check F). ws-schema-missing hint drops agent_tiers. | automation-engineer |
| 2026-10-26 | production | production | v1.58.0 → v1.59.0 (T-20261026-011, spec docs/designs/2026-10-26-project-review-remediation-design.md D4): new Error arm `l1-import-closure` (IC-01) — every static relative import in every .ts under templates/common/scripts/ must resolve Bun-style (exact path, +.ts, /index.ts) to an existing file WITHIN the delivered tree; workspace-root-only (existsSync self-skip, check-upgrade-coverage convention). Closes remediation finding A1: L1-delivered scripts imported the L0-only lib/platform-skeleton-merge.ts through every L0-evaluating gate. Fix policy per ADR-0073 Amendment 4 (deliver the module = leaf pure-module class, or drop the import = engine class). | automation-engineer |
| 2026-10-26 | production | production | v1.59.1 (T-20261026-017): schema-hash-parity check — the L1 copy of docs/workspace-schema.json must sha256-match the L0 root copy; divergence fails with a propagation re-run hint. | governance-runner |
| 2026-10-25 | production | production | v1.57.0 → v1.58.0 (spec docs/designs/2026-10-25-managed-platform-skeleton-design.md, ADR-0101): new Error arm `skeleton-registry` (SK-01) — every MANAGED_SKELETON_SECTIONS heading (lib/platform-skeleton-merge.ts) must exist in templates/common/{CLAUDE,GEMINI}.md exactly once, out-of-zone, in registry order, with unique section numbers. | automation-engineer |
