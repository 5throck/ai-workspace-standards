# skill-session-review.ts Script Lifecycle

## Metadata

- **Script**: skill-session-review
- **Status**: active
- **Version**: 1.3.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-31
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-31 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-10-31

## Description

Session-evidence skill review loop: parses the `## Skills Used` structured evidence in memory/YYYY-MM-DD.md plus git skill-file changes, generates Observed Symptom + Evidence records to memory/skill-review/YYYY-MM-DD.md, and runs structural checks (SKILL.md version vs VERSION_MANIFEST, governance record, description-vs-triggers consistency, dependency re-analysis) on skills modified this session. L0+L1 delivered (ADR-0067). SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-31 | production | production | v1.2.0 → v1.3.0 (spec docs/designs/2026-10-31-template-security-hardening-design.md R2.1, U-20261031-001): input hardening — strict skill-name allowlist SKILL_NAME_RE (^[A-Za-z0-9][A-Za-z0-9._-]*$); a touched name failing it is WARN-skipped before any downstream use (the name previously interpolated into a bun -e JS payload where a `'` broke out of the string literal, and into manifestVersion's new RegExp raw); the metadata.triggers bun -e payload is now the constant TRIGGERS_READ_PAYLOAD with the SKILL.md path passed as a positional argv element; manifestVersion regex-escapes the name as defense in depth; main flow wrapped in import.meta.main so the helpers are importable for tests. Behavior-preserving for conforming names (all 47 existing workspace skills conform). tests/unit/skill-session-review-sanitize.test.ts. | automation-engineer |
