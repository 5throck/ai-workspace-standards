# sync-agent-mirrors.ts Script Lifecycle

## Metadata

- **Current Phase**: production
- **Version**: 1.3.1
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-22
- **Last Reviewer**: pm
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort.

## Created

2026-10-29 (record seeded at v1.3.0; the script itself predates the record — per-script records are opt-in and this is its first record, backfilled alongside the U-20261029-001 check-mode degrade)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-10-29 | - | production | Record seeded at v1.3.0 (U-20261029-001, T-20261029-008 follow-up): per-agent CHECK-mode degrade for unresolvable stub bodies in detached (single-repo CI) checkouts — existing stub mirrors become unverifiable (WARN + repair line echoed on stdout), missing stub mirrors stay real drift (exit 1), non-stub agents compare normally, write mode keeps the hard error. Supersedes the v1.2.0 blanket skip, which concealed real non-stub drift and still hard-failed mirror-less detached checkouts | automation-engineer |
| 2026-11-22 | 1.3.0 | 1.3.1 | U-20261121-002: EOL-insensitive mirror parity. The SSOT body was embedded raw while frontmatter is "\n"-joined, so a CRLF working copy (Windows + core.autocrlf) produced a mixed-EOL projection that could never equal the CRLF mirror on disk — every agent read as differing. Body is now LF-normalized at read time and the mirror comparison normalizes the on-disk file; the projection is identical for LF and CRLF checkouts | automation-engineer |
