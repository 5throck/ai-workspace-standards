# Skill-Graph History Report — Auto-Emitted HTML Dashboard (fleet-report v2.5.0) + skill-graph-analytics Cadence Refresh

- **Spec id**: `2026-11-23-skill-graph-history-report-design`
- **Date**: 2026-11-23
- **Status**: implemented (landed 2026-11-23 — the approved direction carried through the fleet-report v2.5.0 dashboard + SKILL.md cadence-refresh implementation dispatch)
- **Author**: architect (PM-dispatched, Design Gate Row 0 — design + registration only; no implementation edits in this dispatch)
- **Tier**: L0 (`scripts/skill-graph-fleet-report.ts`, `scripts/SCRIPTS.md`, `docs/VERSION_MANIFEST.md`, `tests/unit/*`, the six `skill-graph-analytics` SKILL.md mirrors)
- **Related**: DEC-20261123-01 (gate rulings), DEC-20261107-01 (fleet SSOT — coverage denominator), ADR-0105 (unified 03:00 batch runner), `docs/designs/2026-11-12-unified-batch-runner-design.md`, `docs/designs/2026-11-20-runner-hardening-integrity-design.md` (v4/v5 hardening), `docs/governance/automation-prompts/runner-v5.snapshot.txt:58` (SECTION R1 — read-only citation), T-20261103-004 / `scripts/lib/git-aware-scan.ts` (transient-checkout filtering), the governance ticket documenting the 2026-11-20 Friday runner skip (filed separately, same change set)

## 1. Context

`scripts/skill-graph-fleet-report.ts` (v2.4.0, 853 lines) is the skill-graph-analytics
skill's Step 1: it derives the fleet (`lib/fleet.ts` SSOT minus transient `pr/*`
checkouts), cross-checks the root graph, and writes one dated JSON snapshot per
local calendar day to `memory/skill-graph-metrics/snapshot-YYYY-MM-DD.json`
(:809-812). The runner's SECTION R1 invokes it daily via
`bun scripts/skill-graph-fleet-report.ts --json --snapshot-dir memory/skill-graph-metrics`
(`docs/governance/automation-prompts/runner-v5.snapshot.txt:58`), and the prompt
snapshot is manifest-protected by sha256 (`prompts.manifest.json`) — it must NOT
change. Fridays additionally carry the FULL override with the weekly consolidation
triage (same line).

The snapshot directory is the only durable output: 33 JSON files
(2026-09-22 → 2026-11-22), ~3.2 MB raw total, latest 115 KB. There is no
human-readable surface over that history. Reading it today means re-deriving
trends by hand from raw JSON — and the series' gaps are invisible until someone
notices a missing file.

**Why this matters now (the incident)**: on Friday 2026-11-20 the runner ran but
silently skipped the fleet-report invocation (the triage text rolled the 2026-11-19
results forward), and no runner artifacts exist for 11-21 or 11-23 either. The
snapshot series consequently shows gaps at 11-09..11-18, 11-20, and 11-21+. A
separate governance ticket (filed by another row of this change set) documents the
skip. The design response is structural: every report run — daily orphan sweep,
Friday consolidation, or manual — refreshes a history page as a side effect, so a
stalled runner becomes visible as a stale page and a hatched gap band instead of
silence. Zero automation-prompt changes are needed, which is what keeps this inside
the manifest-protection boundary.

**Coverage nuance (measured 2026-11-22)**: the fleet has **17 members**
(`bun scripts/fleet-list.ts --json`); the latest snapshot carries **13**. All four
absentees — co-architect, co-consult, co-deck, co-safety — sit on transient `pr/*`
branches and are excluded by `filterTransientCheckouts` (their graph projections
exist on disk). The earlier "13/15" framing is stale; the page must compute
coverage dynamically, never hardcode a denominator.

## 2. Problem

1. Snapshot history (33 files, growing daily) has no rendered view: convergence
   class trends, fleet coverage over time, NEW/VANISHED skill diffs, and snapshot
   gaps are all raw-JSON-only.
2. The latest snapshot's actionable content — 16 divergent capability groups
   (hash → project lists), 27 converged, 2 hash-unknown, per-project delivery
   gaps, root orphans — has no shareable surface for triage sessions.
3. Runner skips are silent: a missing daily snapshot is discoverable only by
   listing the directory.
4. `skills/skill-graph-analytics/SKILL.md` "When to Run" is stale on two facts: it
   says "NO scheduled runner invokes this skill as of 2026-11-03" and points the
   weekly consolidation at "the 01:30 fleet runner's FRIDAY FULL OVERRIDE". Both
   are obsolete — the 01:30 runner was merged into the unified 03:00 batch runner
   (user directive 2026-11-12; v4 hardened 2026-11-20), and the v5 prompt snapshot
   (:58) already carries "FRIDAY FULL + weekly skill-graph consolidation triage".

## 3. Goals

- G1: every successful report run auto-regenerates a single self-contained HTML
  dashboard over the full snapshot history — default ON, zero prompt changes.
- G2: five tabs (Overview / Timeline / Divergence / Delivery gaps / Tickets)
  covering the analytics surfaces the skill's triage actually uses.
- G3: failure of the HTML emission can never fail the report run or corrupt the
  snapshot contract (WARN-only).
- G4: byte-compat guarantees: snapshot writes and `--json` stdout are unchanged
  from v2.4.0.
- G5: the SKILL.md cadence section reflects the unified 03:00 runner reality,
  version 1.4.0 → 1.5.0, all mirrors byte-identical.

## 4. Non-goals

- **No centrality ranking** — the page classifies and lists; it does not score or
  rank capabilities beyond the existing counts.
- **No runner-prompt or manifest changes** — `prompts.manifest.json` and
  `docs/governance/automation-prompts/*` are read-only citations, never edited.
- **No runner watchdog/repair** — the 11-20 skip is documented in its own ticket;
  this design only makes gaps visible, it does not detect or repair runner faults.
- **No SKILL.md content reconciliation across projects** — the six workspace-root
  mirrors are synced verbatim; project-side skill copies are out of scope.
- **Not using the `explain-me` skill path** — a purpose-built static renderer in
  the fleet-report script, not a session-time report generator.
- **No new schedule, no cron, no server** — the page exists only as a byproduct of
  report runs, regenerated in place.
- **No changes to snapshot schema or convergence classification** — v2.2.0+ fields
  are consumed as-is.

## 5. Design

### 5.1 D1 — CLI flags, emission point, failure semantics

**Flags** (extend the existing `--json` / `--snapshot-dir` surface):

| Flag | Behavior |
|------|----------|
| *(default)* | After a successful snapshot write, regenerate the history page at `<workspace-root>/docs/skill-graph-history.html` |
| `--no-html` | Skip the history-page emission entirely (snapshot still written) |
| `--html <path>` | Override the output path (parents created with `mkdirSync(recursive)`); combines with the default flow |

**Emission point**: immediately after the existing snapshot block (:809-812) and
its status line (:813-815), inside `main()`, before report rendering. It runs in
**both** markdown and `--json` modes — the daily runner uses `--json`, and
auto-emission in that mode is the entire point. `--json` stdout purity is
preserved: any HTML status line goes to stderr, exactly like the existing
snapshot status line (:813-815).

**Failure semantics (hard rule)**: the HTML emission is wrapped so that any error
(read failure on a malformed snapshot, ticket-scan error, write failure) becomes
one stderr WARN — `⚠️ history page generation failed (<reason>): <detail> — snapshot is unaffected`
— and the run continues to its normal exit (`process.exit(0)` untouched). The
snapshot is the primary artifact; the page is a courtesy render. No partial HTML
is left behind on failure (write to the final path only after the full string is
built; on write error the stale previous page remains, which is correct — a stale
page is honest, a missing one is not an error signal).

**Determinism**: the rendered HTML is a pure function of (sorted snapshot files,
fleet roster, ticket scan). No wall-clock timestamp, no generation marker in the
output. Identical inputs → byte-identical file, so runner reruns produce zero
noise and the page diffs cleanly if committed.

### 5.2 D2 — Page architecture

**Pattern source**: `scripts/ticket.ts` `board --html` (:666-698) — single
template-literal HTML document, inline `<style>`, CSP meta tag, every dynamic
value through the `escapeHtml` helper (:173-180). One deliberate extension:
ticket.ts's CSP (`default-src 'none'; style-src 'unsafe-inline'`, :672) has no
`script-src` because the board has no JS; this page has JS, so the meta tag is
`default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'`.
Zero external references of any kind (no CDN, no fonts, no images).

**Data inlining**: the entire data model is serialized into
`<script id="report-data" type="application/json">` as
`JSON.stringify(model).replace(/</g, "\\u003c")` — the `<` escape forecloses the
`</script>` breakout and satisfies the CSP with no network access. The page JS
reads the block, `JSON.parse`s it, and renders. No `fetch()`, no inline event
handlers with string interpolation.

**Model shape** (compact projection — NOT the raw snapshots):

```
{
  fleet:  { count: number, members: [{ name, transientAbsent: boolean }] },
  series: [ { date, projects: { <p>: { nodes, edges, skills } },
              classes: { converged, divergent, unknown },
              newSkills: string[], vanishedSkills: string[] } ],   // sorted by date
  latest: { date,
            convergence: { converged: string[],
                           convergenceWithDivergence: [{ capability, hashes: { <hash>: string[] } }],
                           hashUnknown: string[] },
            missingFromProjects: { <p>: string[] },
            fanIn2, rootOrphans },                                 // passed through
  tickets: [ { id, title, status, priority, source: "live"|"archive", runnerFiled } ]
}
```

- `series[].classes` and the NEW/VANISHED diffs are computed by the generator
  (replaying the existing pairwise diff logic across the sorted snapshot list) —
  snapshots do not store historical diffs.
- `fleet.count` / `members` come from the already-imported `listFleetProjects()`
  plus `lib/git-aware-scan.ts` transient-branch evidence; `transientAbsent` marks
  a member missing from the latest snapshot whose checkout sits on a `pr/*`
  branch — the page labels those "absent: transient PR checkout", which is what
  makes the 13/17 read honestly.
- Size estimate (measured inputs): 33 dates × ~2.5 KB series rows ≈ 80 KB;
  latest-snapshot detail ≈ 60 KB; fleet + tickets ≈ 20 KB; HTML/CSS/JS shell
  ≈ 30-40 KB → **≈ 200 KB** total, well under a 300 KB budget. Growth ≈ 2.5 KB/day
  (≈ 1 MB/year) — acceptable for a local artifact; history pruning is a future
  concern, not designed here.

**Tabs** (vanilla JS switching, English-only content):

1. **Overview** — fleet coverage headline (projects-with-graph / fleet members,
   dynamic, with the transient-absent annotation), convergence class counts of the
   latest snapshot (27 / 16 / 2 on current data), a class-count trend strip over
   all dates (three colored bars per date — converged / divergent / hash-unknown),
   and the latest headline stats (nodes/edges/skills totals).
2. **Timeline** — a date axis spanning min→max snapshot date; days with snapshots
   marked, days without rendered as hatched gap bands (**gap ranges are derived
   from the series, never hardcoded**); a per-date NEW/VANISHED skills table
   (scrollable, reverse-chronological).
3. **Divergence** — the latest snapshot's `convergenceWithDivergence`: capability
   → hash chips → project lists (the 16 groups), plus the converged (27) and
   hashUnknown (2) lists.
4. **Delivery gaps** — `missingFromProjects` per project: one collapsible section
   per project with a count badge, sorted by missing count descending.
5. **Tickets** — matching governance tickets: id, title, status, priority, source
   (live vs archive); titles starting with `skill-graph:` get a "runner-filed"
   badge; sorted by id descending (newest first).

**Search**: one input in the header; filters visible rows of the active tab by
case-insensitive substring over capability names, project names, hashes, skill
ids, and ticket ids/titles.

**Theme**: CSS custom properties; default follows `prefers-color-scheme`, toggle
button flips and persists via `localStorage`.

**XSS-safety rules (hard rules)**:
- Every dynamic string (skill ids, project names, capability names, hashes,
  ticket titles/ids/statuses, dates) passes through `escapeHtml` before template
  insertion — no exceptions, including inside attributes (the helper escapes
  `"` and `'`, matching ticket.ts:173-180).
- Snapshot-derived names are never inserted raw; a fixture snapshot containing
  `<img src=x onerror=…>` as a skill name must render inert.
- The JSON data block carries the `\u003c` escape (no literal `</script`
  sequence can exist in the document).

### 5.3 D3 — Governance ticket scan

- Read-only over `tickets/governance/*.yaml` and `tickets/governance/archive/*.yaml`.
- **Match rule**: extracted title contains `skill-graph` (case-insensitive).
  Titles beginning with the `skill-graph:` prefix (the runner's NEW-id ticket
  convention, `runner-v5.snapshot.txt:58`) are tagged `runnerFiled`.
- **YAML reading**: a minimal purpose-built frontmatter reader extracting
  `id`, `title`, `status`, `priority`. Titles are multi-line **folded block
  scalars** (`>-`; measured: T-20261122-004) — the reader must implement folded
  (`>` / `>-`: newline → space, indicator stripped, indentation stripped) and
  literal (`|` / `|-`) scalars, not line-grep. A malformed file is skipped with a
  stderr note (WARN posture, never fails the run). Absent tickets directories →
  empty ticket list, no error.

### 5.4 D4 — SKILL.md cadence refresh (bundled governance change)

**Files**: all **six** mirror trees of `skills/skill-graph-analytics/SKILL.md` —
`skills/`, `.agents/`, `.claude/`, `.codex/`, `.gemini/`, `.hermes/` (measured
2026-11-23: all six byte-identical today; the brief named two, but the mirror-sync
convention — hash-synced SKILL.md trees, cf. the 2026-11-07 fleet-membership
design §3 — requires editing all six together).

**Changes**:
1. Frontmatter: `version: 1.4.0` → `1.5.0`; `last_reviewed: 2026-11-08` →
   `2026-11-23`.
2. **When to Run** weekly-cadence bullet: replace the stale text ("NO scheduled
   runner invokes this skill as of 2026-11-03… Revival home DECIDED 2026-11-03
   (T-20261101-004): the 01:30 fleet runner's FRIDAY FULL OVERRIDE… run it
   manually at the start of a weekly maintenance session") with the current
   reality: the weekly consolidation + daily orphan sweep run under the **unified
   03:00 batch runner**'s SECTION R1 Friday FULL (01:30 runner merged 2026-11-12,
   hardened 2026-11-20; cite the prompt snapshot
   `docs/governance/automation-prompts/runner-v5.snapshot.txt` line 58 as the
   as-deployed record). **Drop the "run it manually" standby phrasing**; keep the
   on-demand bullet (post-wave, pre-consolidation, suspected drift) unchanged.
3. Description frontmatter line: "(manual until the Friday full-override revival —
   see When to Run)" → aligned phrasing ("weekly under the unified 03:00 runner's
   Friday FULL — see When to Run").
4. Landing also bumps the `docs/VERSION_MANIFEST.md` skill row (:84) 1.4.0 → 1.5.0.

Nothing under `docs/governance/automation-prompts/` or `prompts.manifest.json` is
modified — they are citations.

### 5.5 Version bump and registry rows (same change set)

- Script header: `@version 2.5.0` entry citing this spec (appended above the
  v2.4.0 entry, house style).
- `scripts/SCRIPTS.md`: row :101 → 2.5.0 with the version note; usage line :444
  gains `[--no-html] [--html <path>]`.
- `docs/VERSION_MANIFEST.md`: script row :191 → 2.5.0; skill row :84 → 1.5.0.
- Unit test: `tests/unit/skill-graph-history-report.test.ts` (bun:test,
  `mkdtempSync` fixtures, imports from `../../scripts/…` — the
  `tests/unit/fleet-membership.test.ts` house style). Exported pure helpers:
  `buildHistoryModel(snapshotList, fleetInfo)`, `scanSkillGraphTickets(liveDir, archiveDir)`,
  `escapeHtml`, `renderHistoryPage(model)`. Covered:
  - `buildHistoryModel`: date ordering; class-count extraction; NEW/VANISHED
    replay across a 3-snapshot fixture sequence; gap derivation (expected ranges
    computed from fixtures); `transientAbsent` annotation; absent ticket dir
    tolerance.
  - `scanSkillGraphTickets`: folded-scalar (`>-`) title extraction across lines;
    `skill-graph:` prefix → `runnerFiled`; archive inclusion; malformed file
    skipped with note; non-matching titles excluded.
  - `escapeHtml`: entity coverage (`& < > " '`).
  - `renderHistoryPage`: contains the CSP meta; contains no `http://`/`https://`
    reference; contains no literal `</script` sequence after the data block
    escaping; an XSS fixture (skill named `<img src=x onerror=alert(1)>`)
    produces no raw `<img`; two identical renders are byte-identical
    (determinism pin).

## 6. Acceptance criteria

- [ ] **AC1 (default emission)**: a default run (with and without `--json`)
      regenerates `docs/skill-graph-history.html`; `--no-html` skips it;
      `--html <path>` writes there (parents auto-created).
- [ ] **AC2 (self-contained)**: the generated file contains zero external
      references (no `http://` / `https://` / `src="…http` / `href="…http`) and
      carries the CSP meta `default-src 'none'; style-src 'unsafe-inline';
      script-src 'unsafe-inline'`.
- [ ] **AC3 (byte-compat)**: snapshot writes remain byte-identical
      (`JSON.stringify(snapshot, null, 2) + "\n"`, same-day overwrite preserved);
      `--json` stdout is byte-identical to v2.4.0 for the same inputs (verified by
      diffing a pre-change vs post-change run; snapshot file `git diff` clean on a
      same-day rerun).
- [ ] **AC4 (WARN-only failure)**: with `--html` pointed at an unwritable path,
      the run prints one stderr WARN naming the reason, still writes the
      snapshot, still prints the normal report, and exits 0.
- [ ] **AC5 (determinism)**: two consecutive runs with unchanged inputs produce
      byte-identical HTML.
- [ ] **AC6 (Overview)**: coverage is computed dynamically (13/17 with four
      `transientAbsent` annotations on 2026-11-22 data) — no hardcoded
      denominator anywhere in the script; class counts render 27 / 16 / 2 from
      the latest snapshot.
- [ ] **AC7 (Timeline)**: all 33 snapshot dates render; gap bands are derived
      from the series (current data yields 2026-09-24..26, 10-02, 10-06, 10-10,
      10-12..13, 10-16, 10-18, 10-20..23, 11-04..05, 11-07, 11-09..18, 11-20,
      11-21) — zero hardcoded date ranges; per-date NEW/VANISHED diffs render.
- [ ] **AC8 (Divergence)**: the 16 divergent groups render as capability →
      hashes → projects; converged (27) and hashUnknown (2) lists render.
- [ ] **AC9 (Delivery gaps)**: `missingFromProjects` renders for every project in
      the latest snapshot with per-project counts.
- [ ] **AC10 (Tickets)**: live + archive governance tickets whose titles contain
      `skill-graph` render with id/title/status/priority/source; `skill-graph:`
      prefixed titles get the runner-filed badge; multi-line folded titles render
      in full (T-20261122-004 shape).
- [ ] **AC11 (Search + theme)**: the search input filters rows in every tab;
      the theme toggle flips the palette and persists across reloads.
- [ ] **AC12 (XSS safety)**: every dynamic string passes through `escapeHtml`
      (unit-test XSS fixture renders inert); the JSON data block contains no
      literal `</script` sequence.
- [ ] **AC13 (size budget)**: with the current 33-snapshot corpus the generated
      file is ≤ 300 KB.
- [ ] **AC14 (SKILL.md)**: version 1.5.0; `last_reviewed: 2026-11-23`; When to
      Run cites the unified 03:00 runner SECTION R1 Friday FULL and the prompt
      snapshot path; no "run it manually" standby phrasing; on-demand triggers
      preserved; **all six mirrors byte-identical**; VERSION_MANIFEST skill row at
      1.5.0.
- [ ] **AC15 (registries)**: script header `@version 2.5.0`; SCRIPTS.md row 2.5.0
      with usage flags; VERSION_MANIFEST script row 2.5.0.
- [ ] **AC16 (tests)**: the new unit test file is green; full `bun test` green.

## 7. Verification plan

1. `bun test tests/unit/skill-graph-history-report.test.ts` — new suite green.
2. `bun test` (root) — full suite green.
3. Byte-compat proof: checkout the pre-change script (`git stash` or worktree),
   run `bun scripts/skill-graph-fleet-report.ts --json --snapshot-dir <tmp>`,
   repeat post-change into a second tmp dir, `diff -r` the two snapshot dirs →
   identical (AC3). `--json` stdout diff → identical.
4. Failure posture: `--html /nonexistent-root/x/y.html` on a read-only parent →
   WARN + exit 0 + snapshot written (AC4).
5. Page walkthrough (manual): open the page, verify 5 tabs, search `sap-fi`
   (Timeline/Divergence rows), search `skill-graph:` (badged ticket rows), toggle
   theme + reload persistence, confirm the 11-09..11-18 gap band is visible
   (AC6/7/11 — the incident made visible).
6. `bun scripts/verify-scripts.ts --verify` and `bun scripts/audit.ts` green in
   the landing PR (audit is the QA row's gate; listed for completeness).
7. Mirror check: `diff` each of the six SKILL.md trees against `skills/` →
   identical (AC14).

## 8. Rollback

Single-commit revert of the implementation change set restores v2.4.0 behavior:
the script stops emitting HTML, the stale `docs/skill-graph-history.html` remains
(or is deleted — it is a generated artifact with no consumers), snapshot data
needs no migration (byte-compat means nothing to undo), and the SKILL.md mirrors
revert to 1.4.0 text. No runner or manifest state is involved at any point.

## 9. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None beyond the mirror-synced SKILL.md text applied uniformly to all mirror trees | `.claude/skills/skill-graph-analytics/SKILL.md` |
| Antigravity (GEMINI.md) | None — the `.gemini` mirror receives the identical SKILL.md text; no GEMINI-specific delta beyond the shared mirror sync | `.gemini/skills/skill-graph-analytics/SKILL.md` |
| Other mirrors (`.agents`, `.codex`, `.hermes`) | Same shared SKILL.md text | `.agents/skills/skill-graph-analytics/SKILL.md`, `.codex/skills/skill-graph-analytics/SKILL.md`, `.hermes/skills/skill-graph-analytics/SKILL.md` |
| templates/common | None — hard rule: the skill is `l2_propagate: false` / workspace-scoped, and the script + generated page are L0-only; nothing enters any propagation map, the common-contract delivery, or L1/L2 deliveries | N/A |

## 10. Landing requirements

1. Script `@version 2.5.0` header entry + the D1/D2/D3 implementation (single
   script; cite this spec).
2. `tests/unit/skill-graph-history-report.test.ts` per §5.5.
3. SCRIPTS.md (:101, :444) + VERSION_MANIFEST (:191 script, :84 skill) rows.
4. SKILL.md refresh per §5.4 across all six mirrors.
5. CHANGELOG `[Unreleased]` entry (workspace root).
6. The governance ticket documenting the 2026-11-20 runner skip is referenced in
   the PR body (motivation; filed separately).

## 11. Out of scope

- Runner watchdog, skip-detection, or any `prompts.manifest.json` /
  `docs/governance/automation-prompts/` edit.
- Snapshot schema changes, convergence-threshold changes, or history pruning.
- Centrality scoring, per-capability ranking, or diff-of-divergence-over-time
  views (a natural v2.6 candidate once the page exists).
- explain-me-based generation, external chart libraries, or any networked asset.

## 12. References

- Measured inputs (2026-11-23): `ls memory/skill-graph-metrics/` = 33 snapshots
  2026-09-22→2026-11-22, 3.2 MB; `snapshot-2026-11-22.json` = 115 KB,
  13 projects, convergence 27/16/2; `bun scripts/fleet-list.ts --json` = 17
  members (co-architect/co-consult/co-deck/co-safety absent on `pr/*` branches).
- `scripts/skill-graph-fleet-report.ts` :809-815 (snapshot write + status line),
  header (v2.4.0), `defaultProjects()` via `lib/fleet.ts`.
- `scripts/ticket.ts` :173-180 (`escapeHtml`), :666-698 (`board --html`, CSP
  pattern), :182-191 (NFKC lookalike folding — cited as prior art for hostile
  strings; the page reuses `escapeHtml` semantics only).
- `docs/governance/automation-prompts/runner-v5.snapshot.txt:58` (SECTION R1,
  Friday FULL + weekly triage — citation only).
- `skills/skill-graph-analytics/SKILL.md` :3, :18, :48-59 (stale cadence text);
  six identical mirror trees verified 2026-11-23.
- `scripts/SCRIPTS.md` :101, :444; `docs/VERSION_MANIFEST.md` :84, :191.
- `tests/unit/fleet-membership.test.ts` (house test style).
- `docs/designs/2026-11-07-fleet-membership-ssot-design.md` (fleet SSOT,
  mirror-sync convention, DEC-20261107-01); `docs/designs/2026-11-22-dev-sync-
  skill-graph-preconvergence-design.md` (format exemplar).
