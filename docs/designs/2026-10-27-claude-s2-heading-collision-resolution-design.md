# Design: claude-s2 Heading Collision Resolution + Loud Collision Detector (T-20261027-008)

- **Ticket**: T-20261027-008 (governance, manual)
- **Date**: 2026-10-27
- **Status**: implemented
- **Related**: spec 2026-10-25-managed-platform-skeleton-design (ADR-0101), U-20261026-005 (silent-skip class), fleet drift audit 2026-10-27-u005

## 1. Problem

`mergeSkeletonSections()` (scripts/lib/platform-skeleton-merge.ts, ADR-0101) never
delivered the registered `claude-s2` section `### 2. Native Slash Commands` to
co-develop / co-consult / co-export / co-game / co-newbiz: all five carry the
old-vintage `### 2. Pre-Edit Quality Gate (All Platforms)` heading, so the
number-collision guard (same number, different title → insert skipped) fired on
every wave. The skip was logged only as a quiet `SKELETON DRIFT (manual review)`
line — no WARN, no summary surfacing — the same silent-skip genus as
U-20261026-005. The design doc's first-wave prediction explicitly deferred this
("§2 skipped — number occupied by local `### 2. Pre-Edit Quality Gate`"); this
spec resolves the deferral.

## 2. Decision

### D1 — Template-side heading resolution (no project file is edited)

The collision is resolved in `templates/common/CLAUDE.md` (and the workspace-root
`CLAUDE.md` kept in lockstep):

- `### Pre-Edit Quality Gate (All Platforms)` → `### 2. Pre-Edit Quality Gate (All Platforms)`
  — restores the section number the five projects already use locally and keeps
  fresh-scaffold numbering continuous (§1–§11, the ADR-0101 promise).
- claude-s2 heading `### 2. Native Slash Commands` → `### 2.5 Native Slash Commands`
  — house-style N.M numbering (the `### 4.5 Skill Resolution Priority`
  precedent) for a section that slots between two others. In the five projects
  the insert then lands between their local §2 and §3 with no number collision;
  in co-architect/co-deck (no local §2) and fresh scaffolds the order is
  1, 2, 2.5, 3, 4, 4.5, 5, ... — continuous.

Rejected alternatives: renumbering §3–§11 fleet-wide (touches every project's
zone-delivered content — out of scope, high blast radius); unnumbering
claude-s2 (breaks the numbered-skeleton house style and the design's
numbering-integrity goal); editing the five project CLAUDE.md files (forbidden
by the ticket — their fix rides the next delivery wave via the MERGE pass).

### D2 — Loud, named collision detector

The insert-path number-collision skip in `mergeSkeletonSections()` now emits a
WARN-prefixed, named log line following the engine's existing `WARN: ` pattern
(ci.yml MERGE warnings):

```
    WARN: SKELETON HEADING COLLISION — insert skipped: <id> (<heading>) in <rel> — number <N> is already used by "<clashing heading>"; resolve on the template side or rename the project heading (T-20261027-008)
```

Semantics unchanged (still skip + never delete); only the log becomes loud and
names both colliding headings. A standing collision re-logs the WARN on every
run (pinned by test), so the conflict stays visible until resolved.

## 3. Registry / propagation

- `MANAGED_SKELETON_SECTIONS` claude-s2 heading updated; `@version` 1.0.0 → 1.1.0.
- `scripts/SCRIPTS.md` row cascaded (v1.1.0 note).
- L1 mirror `templates/common/scripts/lib/platform-skeleton-merge.ts` synced byte-identical.
- Tests updated: `tests/unit/platform-skeleton-merge.test.ts` (§2.5 inserts on
  the old-vintage shape; foreign-title collisions WARN; idempotency pins) and
  `tests/unit/managed-block-merge.test.ts` (composition now inserts 5 sections
  with no collision).
- `validate-templates.ts` skeleton-registry arm (SK-01) validates the renamed
  heading against the template unchanged (exact heading, out-of-zone, order,
  unique numbers — 2 and 2.5 are distinct numbers).

## 4. Verification

- `bun test tests/unit/platform-skeleton-merge.test.ts tests/unit/managed-block-merge.test.ts` — 60 pass.
- `bun run test:unit` exit 0; `bun scripts/audit.ts` exit 0;
  `bun scripts/validate-templates.ts` 0 errors; `bun scripts/verify-scripts.ts --verify` exit 0.
- Per-project collision inventory (read-only): co-develop CLAUDE.md:70,
  co-consult:70, co-export:74, co-game:74, co-newbiz:70 — all
  `### 2. Pre-Edit Quality Gate (All Platforms)`.
