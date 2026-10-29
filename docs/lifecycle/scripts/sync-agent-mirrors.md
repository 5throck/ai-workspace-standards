# sync-agent-mirrors.ts Script Lifecycle

## Metadata

- **Current Phase**: production
- **Version**: 1.3.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-29
- **Last Reviewer**: pm
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort.

## Created

2026-10-29 (record seeded at v1.3.0; the script itself predates the record — per-script records are opt-in and this is its first record, backfilled alongside the U-20261029-001 check-mode degrade)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-10-29 | - | production | Record seeded at v1.3.0 (U-20261029-001, T-20261029-008 follow-up): per-agent CHECK-mode degrade for unresolvable stub bodies in detached (single-repo CI) checkouts — existing stub mirrors become unverifiable (WARN + repair line echoed on stdout), missing stub mirrors stay real drift (exit 1), non-stub agents compare normally, write mode keeps the hard error. Supersedes the v1.2.0 blanket skip, which concealed real non-stub drift and still hard-failed mirror-less detached checkouts | automation-engineer |
