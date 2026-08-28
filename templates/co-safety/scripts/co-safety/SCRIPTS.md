# co-safety Variant Scripts Registry

> Variant-specific scripts for the Safety OS (co-safety) domain, kept under
> `scripts/co-safety/` per the workspace scripts/<variant> layout convention
> (docs/designs/2026-08-28-skill-hygiene-and-conventions-design.md). Core/common
> scripts (audit.ts, dev-sync.ts, …) live in `scripts/` and mirror
> `templates/common/scripts/`; they are not listed here.

## Registry

| Script | Version | Purpose |
|--------|---------|---------|
| `audit-variant.ts` | 1.0.0 | co-safety variant-specific audit hook (pluggable per workspace policy) |
| `check-pm-approval.ts` | 1.0.0 | PM approval gate check |
| `domain-config.ts` | 1.0.0 | Domain registry + DEFAULT_MIN_LEGAL_BASIS config |
| `migrate-registry-to-coordinates.ts` | 1.0.0 | Coordinate-registry migration utility |
| `new-domain.ts` | 1.0.0 | Scaffold a new industry/functional domain |
| `risk-register-rollup.ts` | 1.0.0 | Roll up RA instances into facility risk registers |
| `safety-audit.ts` | 1.0.0 | co-safety full compliance audit (legal_basis, schemas, evidence) |
| `scaffold-industry.ts` | 1.0.0 | Scaffold an industry workflow/skill/evidence set |
| `start-mcp.ts` | 1.0.0 | Start the co-safety MCP servers |
| `test-chemical-handling-profile.ts` | 1.0.0 | Chemical handling profile test suite |
| `test-cross-domain-integration.ts` | 1.0.0 | Cross-domain integration test suite |
| `test-domain-scenarios.ts` | 1.0.0 | Domain scenario test suite |
| `test-pharma-general-profile.ts` | 1.0.0 | Pharma general profile test suite |
| `test-runtime-tools.ts` | 1.0.0 | Runtime tools test suite |
| `training-ingest.ts` | 1.0.0 | Training record CSV ingestion → TRAIN-* JSON |
