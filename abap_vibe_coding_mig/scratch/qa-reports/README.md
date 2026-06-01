# QA Reports

Auto-generated QA reports from `scripts/qa-full.ts`.

## Report Format

Reports are named by date: `YYYY-MM-DD.md`

Each report contains:
- Timestamp
- Object URL
- Total duration
- Per-step results (Syntax Check, Unit Tests, ATC Check)
- P1 finding counts (blocking)

## Usage

Run full QA:
```bash
bun scripts/qa-full.ts "/sap/bc/adt/vit/test/object"
```

Run quick syntax check:
```bash
bun scripts/qa-quick.ts "/sap/bc/adt/vit/test/object"
```
