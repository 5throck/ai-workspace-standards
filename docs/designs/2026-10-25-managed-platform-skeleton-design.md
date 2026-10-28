# Design: Managed platform-doc skeleton — out-of-zone CLAUDE.md/GEMINI.md becomes a delivery surface (spec 2026-10-25-managed-platform-skeleton-design)

- **Spec ID**: 2026-10-25-managed-platform-skeleton-design
- **Date**: 2026-10-25
- **Status**: implemented (registry SSOT; retro-marked per T-20261029-002 header-registry reconciliation)
- **Tickets**: Design Gate (Row 0); follow-on to T-20261025-anchor-repair (PR #1604) and the 2026-09-12 upgrade-wave incident

## Summary

The out-of-zone skeleton of the platform instruction docs (`CLAUDE.md`, `GEMINI.md` — content outside the
`<!-- COMMON-CLAUDE:START/END -->` / `<!-- COMMON-GEMINI:START/END -->` marker zones) currently freezes at
scaffold vintage: the upgrade MERGE pass re-injects zone content but never rewrites out-of-zone text, so the
11 pre-2026-09-12 projects lack `### 5. Agent Dispatch Rules`, `### 6. Native Sub-agents (Agent Tool)` and
related skeleton sections, and future template-side skeleton edits never reach existing projects. The decision:
a **canonical-section registry** (option b) — a new pure lib `scripts/lib/platform-skeleton-merge.ts` that the
upgrade MERGE pass runs after the managed-block merge — inserts missing registered skeleton sections at
template-relative anchors and replaces drifted registered section bodies under strict guards, without touching
zones or unregistered content. The machinery is L0-only engine code plus a registry; no template markers are
added and no project file is edited directly (ADR-0031), so the ordinary nightly `project-resync` wave
normalizes the fleet with no one-off migration.

## Context & evidence

**The 09-12 incident shape.** `### 5. Agent Dispatch Rules` + `### 6. Native Sub-agents` entered
`templates/common/CLAUDE.md` on 2026-06-07 (commit `3845d1a63`) and were never removed there. The
2026-09-12 fleet upgrade wave (e.g. co-newbiz `853239fe`, 169 files +23k lines) removed exactly those heading
lines from every existing project's CLAUDE.md while the template kept them. Verified fleet census (grep over
all 16 `Projects/co-*`, this session):

| Project | CLAUDE §3 | §4.5 | §5 | §6 | GEMINI §5 | Zones CLAUDE/GEMINI |
|---|---|---|---|---|---|---|
| co-abap | ✓ | ✗ | ✗ | ✗ | ✓ (LOCAL-PATCH, see below) | 11 / 8 |
| co-architect | ✗ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-consult | ✗ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-deck | ✗ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-develop | ✗ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-export | ✗ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-game | ✗ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-newbiz | ✗ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-price | ✓ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-safety | ✓ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-security | ✗ | ✗ | ✗ | ✗ | ✗ | 11 / 8 |
| co-design / co-hr / co-learning / co-news / co-work (post-09-25) | ✓ | ✓ | ✓ | ✓ | ✓ | 11 / 8 |

Zone parity is perfect everywhere (11 CLAUDE + 8 GEMINI zones per project, matching the templates), so the
existing positional COMMON-* merge phases are stable and this change must not perturb them. All 16 projects
carry `## Execution Plan Boilerplate` (census verified in `2026-10-25-fleet-anchor-repair-design.md`), making
it a valid insertion anchor. The 11 old projects also drift in unnumbered skeleton prose (Desktop App hook
rows, session-bootstrap note, GOVERNANCE-POINTER-TABLE); those stay **unregistered = untouched** in v1
(scope honesty — see Registry).

**Why the skeleton freezes.** `scripts/lib/upgrade-policy.ts:288` lists CLAUDE.md/GEMINI.md in
`MERGE_MANAGED_FILES` → `resolveClaim` returns `{ policy: 'MERGE_MANAGED', pass: 'MERGE' }` →
`upgrade-project.ts` MERGE pass → `mergeWorkspaceManaged` → `mergeManagedBlocks`
(`scripts/lib/managed-block-merge.ts`), which processes ONLY marker-delimited blocks
(`MANAGED_PATTERNS`: WORKSPACE-MANAGED, COMMON-CLAUDE/GEMINI/CODEX/HERMES, VARIANT-INJECT,
COMMON-AGENTS/CONTEXT, DYNAMIC_SKILLS). Everything outside markers is never read, let alone written —
by design, after the c8c6eb7 class of accidents.

**Project-local content lives in identifiable places.** co-abap's `## SAP Safety (co-abap hardening)` +
`## Session Start Checklist` + `## Hooks` sections sit at EOF after the last zone (lines 238+);
co-price's `## Session Start` / `## CLI Commands` / `## Co Price Context` tail likewise (lines 257+);
co-newbiz's `## Co Newbiz Context` tail likewise (line 289+). One exception found:
`Projects/co-abap/GEMINI.md` carries an in-skeleton section
`### 5. Agent Dispatch Rules` preceded by `<!-- LOCAL-PATCH(upstream-request: pending): heading added for
governance anchors -->` with project-local body text — the guard case any replace path must respect.

**L0→L1 channel already exists.** `scripts/propagate-to-templates.ts` `GOVERNANCE_L1_FILES` deploys
L0 `CLAUDE.md`/`GEMINI.md` → `templates/common/` with `applyGovernanceTransforms` (CONSTITUTION.md→context.md
ref scrub, workspace-content removal B-1..B-6, per-file §9 boundary-section replacement, fatal guard B-8).
Template-side skeleton edits therefore already have a governed path L0 → templates/common; what is missing is
the templates/common → existing-projects path for out-of-zone content.

**CODEX/HERMES status (verified).** `templates/common/CODEX.md` and `HERMES.md` each carry their single
COMMON zone in template and all projects, and `### 5.` headings exist in all 16 project copies of both files
(census above context). The 09-12 wave predates both files' merge-claim activation (CODEX 2026-09-24,
HERMES delivered 2026-09-27), so they arrived at full vintage and have zero normalization need.
Note: the upgrade-policy v1.13.0 comment "the merge is a no-op today" is **stale** — managed-block-merge
v1.2.0/v1.3.0 added COMMON-CODEX/COMMON-HERMES to `MANAGED_PATTERNS`, so those merges are active.

## Decision (mechanism)

### Options analyzed

**(a) Keyed `WORKSPACE-MANAGED` wrappers around skeleton segments (2026-09-16 machinery).**
Nesting legality — the critical question — resolves as follows. `scanPatternBlocks`
(`managed-block-merge.ts:120`) compiles one regex per pattern family (`open[\s\S]*?close`, non-greedy) and
scans content independently per family, so a WORKSPACE-MANAGED wrapper *containing* COMMON-CLAUDE zones does
extract without breaking either scanner (different families never consume each other's markers; same-family
nesting would break the non-greedy scan, but CLAUDE.md/GEMINI.md carry zero WORKSPACE-MANAGED blocks today).
The phases, however, make it operationally wrong:
1. Patterns iterate in `MANAGED_PATTERNS` order — WORKSPACE-MANAGED first — so the wrapper phase
   *wholesale-replaces* the whole skeleton span (zones included) before the zone phase re-runs as a byte-equal
   no-op. Any project-local content inside a wrapper span dies unguarded (c8c6eb7 class, no snapshot hook at
   that granularity).
2. Missing wrappers (all 11 target projects have none) take `findInsertionPosition`
   (`managed-block-merge.ts:213`): heading-anchored (the headings are missing — that is the defect), then
   "after the last block of the same label" (the *first* skeleton segment), then EOF. Restored sections
   therefore stack at the wrong position and break §-numbering order — the exact outcome the goal forbids.
3. Wrapping requires hand-structuring ~12 keyed segments into 16 project files, violating ADR-0031
   (fleet changes flow template → upgrade wave; no direct project edits), or a one-off migration script —
   the path this design is required to avoid.

**(c) Full-file regenerate-with-preserve.** Requires heuristic "project-local content" extraction to
rebuild each file from the template. Highest c8c6eb7 risk; the preserve-extractor is exactly the kind of
unstated-content logic the MERGE pass exists to avoid. Rejected.

**(b) Canonical-section allowlist delivery — CHOSEN.** A versioned registry names the canonical skeleton
sections per file; the MERGE pass, after the existing managed-block merge, runs a new pure step that
inserts missing sections at template-relative anchors and replaces drifted section bodies under guards.
No new template markers (templates stay byte-identical in shape), granularity is one section, every write is
anchored and snapshotted, and the delivery path is the ordinary nightly wave.

### Merge semantics (new lib `scripts/lib/platform-skeleton-merge.ts`)

`mergeSkeletonSections(projectContent, templateContent, rel, dryRun)` →
`{ content, merged, log, snapshots }` (same shape discipline as `ManagedBlockMergeResult`; pure, no I/O):

1. **Extract the template's registered sections** by their exact heading lines, outside all COMMON-* zones
   (span = heading line up to the next registered heading or next zone-start marker, whichever comes first).
2. **Present path.** Project has the exact heading line:
   - bodies byte-equal → no-op;
   - bodies differ → **replace guards**, all must pass: (G1) project span contains no ATX heading or HTML
     comment line absent from the template span (protects co-abap GEMINI §5's `LOCAL-PATCH` block — skip +
     `SKELETON REPLACE SKIPPED (project-local content)`); (G2) span ≤ 120 lines (blast-radius cap — skip +
     manual-review log). Guards pass → replace span, push `snapshots[]` entry; caller persists
     `<file>.pre-skeleton.bak` BEFORE writing, fail-closed (T-20260917-010 pattern).
3. **Missing path.** Insert at the template-relative anchor:
   - `beforeZoneContaining(headingText)` — locate the heading, walk back to the nearest preceding
     `<!-- COMMON-<X>:START -->` line, insert before that marker;
   - `afterZoneContaining(headingText)` — locate the heading, take the next `<!-- COMMON-<X>:END -->`
     after it, insert after that line.
   - Number-collision guard: never insert a numbered section (`N.` / `N.M`) when the project already has a
     heading with the same number and a different title (old-vintage `### 2. Pre-Edit Quality Gate` must not
     gain a duplicate `### 2. Native Slash Commands`) — skip + `SKELETON DRIFT (manual review)` log.
   - Unresolved anchor (heading not found) → log `SKELETON ANCHOR NOT FOUND — skipped`, **no write**
     (never throws; one project's failure cannot affect others — the wave runs per-project, batches of 1–3
     per `skills/project-resync` daily cadence).
4. **Idempotency.** After an insert, the heading exists → subsequent runs take the present path; equal
   bodies → no-op. Re-runnable by construction.
5. **Order.** The step runs strictly AFTER `mergeManagedBlocks` inside `mergeWorkspaceManaged`, so zone
   markers/anchors are guaranteed present before skeleton anchors resolve against them.

### Registry (v1, ordered)

Content source is always `templates/common/<file>` at merge time — the registry names sections and anchors
only, so there is no second content SSOT.

**CLAUDE.md** (restores continuous integer numbering §1–§11 in all 16 projects):

| id | heading | position rule |
|---|---|---|
| `claude-s2` | `### 2. Native Slash Commands` | before `claude-s3`'s heading; if `claude-s3` absent, beforeZoneContaining(`### 4. Language Policy for Documentation`); only when no `### 2.` heading exists |
| `claude-s3` | `### 3. MCP Configurations & Absolute Resolving` | beforeZoneContaining(`### 4. Language Policy for Documentation`) |
| `claude-s45` | `### 4.5 Skill Resolution Priority` | afterZoneContaining(`### 4. Language Policy for Documentation`) |
| `claude-s5` | `### 5. Agent Dispatch Rules` | beforeZoneContaining(`## Execution Plan Boilerplate`) |
| `claude-s6` | `### 6. Native Sub-agents (``Agent`` Tool)` (heading line only) | afterZoneContaining(`## Execution Plan Boilerplate`) |

**GEMINI.md** (single entry — every other numbered GEMINI section is present fleet-wide):

| id | heading | position rule |
|---|---|---|
| `gemini-s5` | `### 5. Agent Dispatch Rules` | beforeZoneContaining(`## Execution Plan Boilerplate`) |

Unnumbered skeleton (session-bootstrap note, GOVERNANCE-POINTER-TABLE, Pre-Edit Quality Gate, nul
safeguard, Agent Teams, graft block) stays **unregistered and untouched** in v1 — extending the registry is
a one-table change after fleet review. This is deliberate scope honesty: v1 guarantees numbered-section
integrity and forward propagation for registered sections; it does not silently rewrite prose blocks whose
project-side drift has never been audited.

### Expected first-wave operations per project (dry-run predictions)

- **No-op**: co-design, co-hr, co-learning, co-news, co-work (all registered sections present and current).
- **CLAUDE.md inserts only**: co-abap `§4.5, §5, §6`; co-price, co-safety `§4.5, §5, §6`;
  co-consult, co-develop, co-export, co-game, co-newbiz, co-security `§3, §4.5, §5, §6`
  (§2 skipped — number occupied by local `### 2. Pre-Edit Quality Gate`); co-architect, co-deck
  `§2, §3, §4.5, §5, §6`.
- **GEMINI.md inserts**: `§5` in the 10 projects lacking it (all old-vintage except co-abap).
- **Replace-guard skip (expected, by design)**: co-abap GEMINI `§5` — `LOCAL-PATCH` content triggers G1;
  stays local until its `upstream-request: pending` lands via the ADR-0031 channel.

## Files to change (implementer task list)

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/platform-skeleton-merge.ts` | create | Pure lib: `MANAGED_SKELETON_SECTIONS` registry, `mergeSkeletonSections()`, anchor primitives, guards. Import-safe (no I/O), returns log lines verbatim (MERGE-pass convention). |
| `scripts/upgrade-project.ts` | modify `mergeWorkspaceManaged` | After `mergeManagedBlocks`, run the skeleton step for `rel ∈ {CLAUDE.md, GEMINI.md}`; persist `snapshots[]` to `<file>.pre-skeleton.bak` before write, fail-closed on write error (mirror the `.pre-reconcile.bak` block at :1356). Version bump + header note. |
| `scripts/lib/upgrade-policy.ts` | comment-only fix | Correct the stale v1.13.0 "CODEX merge is a no-op today" comment (superseded by managed-block-merge v1.2.0/v1.3.0). No classification change — CLAUDE/GEMINI are already `MERGE_MANAGED`. |
| `scripts/validate-templates.ts` | add arm `skeleton-registry` | Every registry heading must exist in `templates/common/{CLAUDE,GEMINI}.md`, OUTSIDE all COMMON-* zones, in registry order; duplicate numbers inside a template skeleton fail. Severity: Error. |
| `tests/unit/platform-skeleton-merge.test.ts` | create | Fixtures: newbiz-shape insert (§3/§4.5/§5/§6), §2 number-collision skip, co-abap GEMINI LOCAL-PATCH replace-skip, idempotent second run, zone-content-untouched property, snapshot data on replace, unresolved-anchor no-write. |
| `tests/unit/managed-block-merge.test.ts` | extend | One integration fixture: project-local EOF tail + full zone set + skeleton sections missing → one MERGE-pass invocation yields zones merged, tail intact, sections inserted in order. |
| `scripts/validate-docs-links.ts` | add arm (recommended, separable) | Relative links from delivered `docs/governance/**` into `../../../CLAUDE.md#…` / `../../../GEMINI.md#…` must resolve against `templates/common/<file>` heading slugs (the project delivery source) — encodes the 09-12/anchor-repair incident invariant. May land as a follow-up PR without blocking this design. |

No template-marker changes: `templates/common/CLAUDE.md` / `GEMINI.md` keep their current shape; the L0→L1
publish (`propagate-to-templates.ts --governance-l1`) is unchanged. No project file is edited by hand.

## Normalization rollout (nightly wave — no one-off script)

The engine is L0-only (ADR-0073) and the nightly runner executes upgrades from L0, so once this lands and
releases:

1. Land at L0 via `/sync` PR; `propagate-to-templates.ts --governance-l1` (no-op for templates — no marker
   changes); patch release via the ordinary `auto-release-template.ts` path.
2. Manual dry-run battery (pre-wave, same session): `bun scripts/upgrade-project.ts Projects/co-work
   --variant co-work --platform all --dry-run` → expect zero `SKELETON` lines (no-op canary);
   `... Projects/co-newbiz ... --dry-run` → expect CLAUDE `§3/§4.5/§5/§6` + GEMINI `§5` INSERTED lines and
   nothing else new.
3. Nightly `project-resync` wave (daily cadence, batches of 1–3 projects): canary project first — co-work
   (no-op expected) — then the 11 restore targets over successive batches; each project's PR/diff reviewed
   by the standing resync audit (LOCAL-WORK / STALE-RESIDUE classification).
4. `#5-agent-dispatch-rules` / `#6-native-sub-agents-agent-tool` anchors resolve again in all 16 projects
   after restoration; PR #1604's links already target `#execution-plan-boilerplate` and remain valid (that
   heading is zone-delivered and present everywhere).

## Validation battery

- `bun test tests/unit/platform-skeleton-merge.test.ts` and `bun test tests/unit/managed-block-merge.test.ts`.
- `bun scripts/validate-templates.ts` — new `skeleton-registry` arm + existing PM-04 (both must pass).
- `bun scripts/validate-docs-links.ts --all` (plus the new arm if landed).
- `bun scripts/audit.ts` (workspace QA gate; enforces docs-links at L0).
- `bun scripts/propagate-to-templates.ts --governance-l1 --docs` dry-run re-check (no drift).
- Upgrade dry-run checklist per §Rollout step 2 (co-work no-op canary, co-newbiz restore), then apply-mode
  on one pre-09-12 project (co-newbiz) and re-run `--dry-run` → second run must print zero `SKELETON` lines
  (idempotency proof on real files).
- Fleet assertion after the wave: grep census `### 5. Agent Dispatch` / `### 6. Native Sub` /
  `### 3. MCP` / `### 4.5 Skill` = 16/16 on CLAUDE.md; `### 5. Agent Dispatch` = 16/16 on GEMINI.md.

## Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | CLAUDE.md skeleton becomes registry-managed; §2/§3/§4.5/§5/§6 restored in 11 projects | scripts/lib/platform-skeleton-merge.ts, scripts/upgrade-project.ts, tests |
| Antigravity (GEMINI.md) | GEMINI.md skeleton becomes registry-managed; §5 restored in 10 projects; co-abap LOCAL-PATCH preserved by guard G1 | same lib + tests |
| templates/common | None — no template file changes; the L0→L1 channel and marker zones are untouched (registry reads templates at merge time) | N/A (justified: option b requires no template markers; PM-04 parity unchanged) |
| Codex / Hermes | Deferred (see Alternatives) — zero fleet drift verified | N/A |

## Risks / rollback

- **Bad section replace in one project** → guards G1/G2 + `<file>.pre-skeleton.bak` snapshot written before
  the merged content lands (fail-closed abort mirrors T-20260917-010). Undo in one project: restore the
  `.bak`, or `git checkout -- CLAUDE.md` in the project repo, or `upgrade-project --rollback`; the wave's
  per-project isolation means other projects are unaffected.
- **Registry/template rot** (heading renamed in template, registry stale) → `skeleton-registry` validator
  arm fails at L0 before any release; anchors that no longer resolve in a project degrade to
  `ANCHOR NOT FOUND — skipped` (no write), never corruption.
- **Zone regression** → structurally impossible: the step never writes inside a COMMON-* zone span; inserts
  splice only at zone boundary lines; the integration fixture asserts the zone-untouched property.
- **c8c6eb7 repeat** → impossible by construction on the skeleton layer (G1 blocks any replace whose span
  carries content absent from the template section; inserts delete nothing) and unchanged on the zone layer
  (existing MERGE semantics untouched).
- **Fleet-wide rollback** → registry entries are data: shipping a version with an empty/trimmed registry
  makes the step a no-op everywhere on the next wave; already-inserted sections stay (they are correct
  content) or are removed by git in the affected projects.

## Alternatives rejected

- **Status quo** (per the 09-12 incident and PR #1604's link re-pointing): leaves 11 projects with broken
  §-numbering and dead anchors, and every future skeleton edit re-creates the same drift. Rejected — the
  anchor-repair design itself notes re-adding the headings "fights the delivery channel"; this design fixes
  the channel.
- **Keyed WORKSPACE-MANAGED wrappers** (option a): analyzed above — wholesale-replace risk without section
  granularity, wrong-position inserts for missing wrappers, and an ADR-0031-violating hand-migration.
- **Full-file regenerate-with-preserve** (option c): heuristic preserve logic is the c8c6eb7 class
  institutionalized. Rejected.
- **"docs must never link out-of-zone anchors" as the whole answer**: treats the symptom (dead anchors)
  while the skeleton stays unmanaged; new skeleton sections would still never reach existing projects.
  The recommended `validate-docs-links` arm is kept as defense-in-depth, not the fix.
- **CODEX.md / HERMES.md in scope**: deferred. Both carry `### 5.` in all 16 projects (zero drift — their
  files post-date the 09-12 wave), their skeleton shapes differ (CODEX §7 boundary section lives inside its
  single zone; per-file transform already in `applyGovernanceTransforms`), and adopting them later is a
  registry extension plus validator arm extension, not a redesign. Re-scoping later keeps this change small.

## ASSUMED / UNKNOWN

- **ASSUMED** — the nightly runner executes `upgrade-project` from the L0 working tree (evidenced by
  ADR-0073 engine scope, `skills/project-resync` cadence notes, and the delivery path recorded in
  `2026-10-25-fleet-anchor-repair-design.md`); the 01:30 KST schedule definition itself lives outside the
  repo and was not inspected. **UNKNOWN** — where that schedule is defined.
- **ASSUMED** — `.pre-skeleton.bak` is covered by the `*.bak` gitignore pattern (`templates/common/.gitignore:51`,
  same coverage as `.pre-reconcile.bak`); implementer must confirm project `.gitignore` copies inherit it.
- **ASSUMED** — the 5 post-09-25 projects' registered sections are byte-identical to the current template
  (co-design §5 verified; §4.5/§6/GEMINI §5 spot-checks pass). If any drifts, the replace path + G1/G2
  handles it; first-wave dry-run report is the authority.
- **UNKNOWN** — whether any project holds uncommitted local edits to CLAUDE.md/GEMINI.md at wave time;
  `project-resync`'s LOCAL-WORK classification already governs this class and is unchanged.
