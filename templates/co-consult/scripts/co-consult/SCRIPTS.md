# SCRIPTS.md — co-consult Variant Scripts

> Lifecycle registry for co-consult variant-specific scripts in `scripts/co-consult/`.

## Registry

| Script | Version | Status | Description | Usage |
|--------|---------|--------|-------------|-------|
| `md-to-report.ts` | 1.1.0 | active | Markdown to DOCX/PDF consulting report generator. Converts Markdown deliverables to professionally formatted Word and PDF reports with cover page, TOC, headers/footers, and consulting-style design. | `bun scripts/co-consult/md-to-report.ts <input.md> --format docx` |
| `financial-pipeline.ts` | 1.0.0 | active | End-to-end financial statement analysis runner: Validation → Normalization → KPI → Driver Tree → Report. | `bun scripts/co-consult/financial-pipeline.ts <dart-json-path> [--company <name>] [--output-dir <dir>]` |
| `financial-validate.ts` | 1.0.0 | active | Financial validation orchestrator — spawns python/validate.py to run accounting equation checks and anomaly detection. | `bun scripts/co-consult/financial-validate.ts <dart-json-path> [--output <output-path>]` |
| `financial-normalize.ts` | 1.0.0 | active | Financial normalization orchestrator — spawns python/normalize.py to convert raw DART JSON to Canonical Financial Model. | `bun scripts/co-consult/financial-normalize.ts <dart-json-path> [--mapping <mapping-path>] [--output <output-path>]` |
| `financial-kpi.ts` | 1.0.0 | active | Financial KPI extraction orchestrator — spawns python/kpi.py to compute profitability, growth, leverage, and cash flow KPIs. | `bun scripts/co-consult/financial-kpi.ts <canonical-json-path> [--output <output-path>]` |
| `financial-report.ts` | 1.0.0 | active | Financial analysis report generator — Markdown report from canonical model, KPI report, validation report, and ROIC driver tree data. | `bun scripts/co-consult/financial-report.ts <canonical.json> <validation.json> <kpi.json> <driver-tree.json> [--output <path>]` |
| `financial-driver-tree.ts` | 1.0.0 | active | Financial ROIC value driver tree orchestrator — spawns python/driver_tree.py to build a 5+ level ROIC decomposition tree. | `bun scripts/co-consult/financial-driver-tree.ts <canonical-json-path> [--output <output-path>]` |
| `hwp-extract.ts` | 1.0.0 | active | HWP extraction orchestrator — spawns python/extract_hwp.py to parse HWP 5.0 OLE-compound-file + zlib BodyText streams and extract document text without requiring the HWP-compatible program. | `bun scripts/co-consult/hwp-extract.ts <path-to.hwp> [--output <output-path>]` |
| `hwpx-generate.ts` | 1.0.0 | active | HWPX generation orchestrator — spawns python/generate_hwpx.py to convert a Markdown deliverable into a schema-valid HWPX document using the pure-Python python-hwpx library. | `bun scripts/co-consult/hwpx-generate.ts <input.md> [--output <output.hwpx>]` |
