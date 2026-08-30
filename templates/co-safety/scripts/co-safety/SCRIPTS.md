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

## Internal Libraries (`lib/`)

> Helper modules imported by the scripts above; never run standalone
> (except `plan-parser.ts`, which has a CLI entry point).

| Module | Version | Purpose |
|--------|---------|---------|
| `lib/auto-executor.ts` | 1.0.0 | Auto-mode workflow orchestrator (phase groups, checkpoints, rollback) |
| `lib/checkpoint-manager.ts` | 1.0.0 | Session-only in-memory checkpoint manager |
| `lib/evidence-validator.ts` | 1.0.0 | Evidence record validation (used by safety-audit, risk-register-rollup, training-ingest) |
| `lib/mcp-cache.ts` | 1.0.0 | Caching layer for MCP OpenAPI calls |
| `lib/plan-parser.ts` | 1.0.0 | Markdown plan-file parser (CLI: `bun run plan-parser.ts <plan-file>`) |
| `lib/platform-dispatcher.ts` | 1.0.0 | Cross-platform agent dispatch abstraction |
