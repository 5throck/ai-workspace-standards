# resync-audit RETENTION-PRUNE verdict class — corroborated memory-retention prunes stop forcing manual adjudication (Design-lite, Row 0)

- **Spec ID**: `2026-11-18-resync-audit-retention-prune-design`
- **Date**: 2026-11-18
- **Status**: implemented (design-lite ratified and registered with the implementation per the Row 0 house pattern)
- **Author**: architect + automation-engineer hybrid (PM-dispatched, Design Gate Row 0, ADR-0074)
- **Input ticket**: T-20261118-004 (backlog — the 2026-11-18 co-export/co-price fleet landings each required a human to confirm 3+ working-tree deletions were dev-sync's retention prune; adjudicated via MEMORY.md de-linking in the same tree)
- **Decision record**: none — verdict-class extension inside an existing audit tool; no ADR-level policy change
- **Related**: [`2026-11-18-resync-audit-merge-delivery-routing-design.md`](2026-11-18-resync-audit-merge-delivery-routing-design.md) (the v1.10.0 PRESUME-STALE guard this sits beside), `scripts/archive-memory.ts` v1.2.0 (the prune selection rule mirrored here — **read, not modified**)
- **File:line currency**: measured on workspace root @ origin/main 1a2ed11cc, 2026-11-18; `scripts/resync-audit.ts` @ 1.10.0, `scripts/archive-memory.ts` @ 1.2.0.

## 0. Summary

dev-sync step 3.8 runs `scripts/archive-memory.ts`, which moves flat `memory/*.md` logs older than 7 days into the gitignored `memory/archive/` directory and tombstones their `memory/MEMORY.md` index rows in the same run. In variant projects the archive directory is gitignored, so the rename surfaces in `git status` as a **deletion** of the tracked `memory/<date>.md` plus a modification of `memory/MEMORY.md` — and resync-audit's deleted-file path has no rule for it: every cycle each pruned log lands as KEEP `deleted in working tree — no file content to audit; restore or commit the deletion`, forcing a human to re-confirm what the pipeline itself just did. Fix ruling: a **new RETENTION-PRUNE verdict**, corroborated when (a) the deleted path matches the archive-memory selection shape AND (b) the working-tree `memory/MEMORY.md` no longer links the deleted file — the prune is dev-sync's own settled action and the de-link is the in-tree corroboration. Anything not corroborated stays KEEP exactly as today; the safety net is untouched.

## 1. Problem

### 1.1 The mechanics (verified against co-price/co-export and the delivered template)

`scripts/archive-memory.ts` (run by dev-sync step 3.8; byte-identical L1 mirror in `templates/common/scripts/`):

1. Scans the **flat** `memory/` directory only — `.md` files, skipping `MEMORY.md` and subdirectories (`:88`, `:97-102`).
2. Selection window (`:104-115`): a date-named log `^(\d{4}-\d{2}-\d{2})\.md$` is dated by its **filename date**; any other flat log (e.g. `meeting-*.md`) by its **mtime**; archived iff `(today local midnight − fileDate) / 86400000 > 7` (strict — exactly 7 days is not archived).
3. Action (`:116`): `fs.renameSync` into `memory/archive/` — a **move, not a delete**.
4. Index repair (`:123-136`): `tombstoneIndex` rewrites `[date](date.md)` session rows to plain dates and every other broken link to `*(archived — local only)*`.

Variant projects (e.g. co-price, .gitignore:135) track flat `memory/*.md` and `memory/MEMORY.md` in git while `memory/archive/` is **gitignored** — so step 3 is invisible to git and step 1+4 surface as ` D memory/<date>.md` + ` M memory/MEMORY.md`.

### 1.2 The audit gap

resync-audit `classify()` (`scripts/resync-audit.ts:608-621`) handles working-tree deletions with a delivery-manifest ladder: tombstoned → KEEP honored; baselined → TOMBSTONE-UNCONFIRMED; else → KEEP `deleted in working tree — no file content to audit`. Memory logs are never in the delivery manifest, so every pruned log ends in the bare KEEP — human adjudication every cycle, three+ times per landing during retention-heavy sweeps.

## 2. Options considered and ruling

| Option | Mechanism | KEEP safety net | Change surface | Verdict |
|---|---|---|---|---|
| **(a) RETENTION-PRUNE verdict** — corroborated deletion of a retention-governed memory log (selection shape + window) whose MEMORY.md row is de-linked in the same tree | new verdict branch in the deleted-file ladder | **unchanged** — corroboration failure of any kind → bare KEEP | `resync-audit.ts` only | **ADOPTED** |
| (b) Treat all `memory/*` deletions as prune | pattern-only, no de-link check | **weakened** — a hand-deleted still-linked log would auto-pass | `resync-audit.ts` | **REJECTED** |
| (c) dev-sync writes a marker/manifest for prunes | delete-logging in the pipeline | unchanged | `dev-sync.ts` + `archive-memory.ts` (forbidden scope; the prune selection rule is mirrored, not modified) | **REJECTED** |
| (d) Status quo — keep adjudicating manually | none | unchanged | none | **REJECTED** (the ticket's recurring noise) |

## 3. Exact change spec — `scripts/resync-audit.ts` 1.10.0 → 1.11.0

### 3.1 New exported helpers (house pattern: pure core pinned by unit tests)

- `retentionPrunePattern(relFile): { kind: "date"; date: string } | { kind: "flat" } | null` — mirrors the selection **shape**: flat single-segment `memory/<name>.md`, `.md` suffix, name ≠ `MEMORY.md` (the prune explicitly skips the index). Date-named → `{kind:"date", date}`; other flat logs → `{kind:"flat"}`; anything else (subdirectory paths, non-.md, the index itself) → null.
- `retentionWindowElapsed(date, now = new Date())` — mirrors the window arithmetic exactly: `now` normalized to local midnight (`setHours(0,0,0,0)`), `new Date(date)` for the file date, selected iff `diffDays > 7` (NaN-safe: an invalid date is never selected, same as archive-memory's NaN comparison).
- `retentionPruneCorroborated(projectPath, relFile, now?): string | null` — the full two-condition rule; returns the basis string when corroborated, null otherwise (fail-closed on every read failure):
  - **(a) selection**: pattern + window for date-named logs. For **non-date** flat logs the prune keys on mtime, unreadable post-deletion — the only post-deletion observable of the same rule is the rename destination: `memory/archive/<name>` must exist.
  - **(b) de-link**: working-tree `memory/MEMORY.md` exists, is readable, and contains **no** link to the deleted target — date: no `[date](date.md)`; non-date: no `](<name>.md)` flat-target link (mirroring `tombstoneIndex`'s exact-target matching; path-segment links never matched there, never matched here).

### 3.2 classify() deleted-file ladder

In the `!existsSync(abs)` branch (`:608`), after the delivery-manifest checks (manifest contract stays primary) and before the bare KEEP:

```ts
const prune = retentionPruneCorroborated(projectPath, relFile);
if (prune) { row.verdict = "RETENTION-PRUNE"; row.basis = prune; return row; }
```

`FileRow.verdict` gains `"RETENTION-PRUNE"`. RETENTION-PRUNE rows are **not** discard-snapshot candidates (nothing remains to snapshot; `snapshotDiscardables` stays STALE-RESIDUE-only) and do not enter the tombstone census (basis-prefixed KEEP rows only).

### 3.3 Report legend

`markdownReport` gains: `RETENTION-PRUNE = dev-sync's own memory-retention prune, corroborated by the de-linked memory/MEMORY.md index in the same tree (auto-discard-safe: commit the deletion)`.

## 4. Test plan (`tests/unit/resync-audit-retention-prune.test.ts`)

Temp git repo per case (classify() reads HEAD); fixed old dates keep the window green forever; boundary cases pin the window with an injected `now`.

- **RP-T1** corroborated date-log prune → RETENTION-PRUNE (the 2026-11-17 sweep shape: old dated log deleted from the tree, MEMORY.md row tombstoned to a plain date).
- **RP-T2** still-linked deletion (MEMORY.md keeps `[date](date.md)`) → KEEP.
- **RP-T3** unknown pattern → KEEP: `memory/MEMORY.md` itself, `memory/archive/x.md`, `memory/sub/x.md`, `docs/x.md` (non-memory unaffected), non-.md, and a date-named log inside the window (injected now: exactly 7 days → KEEP; 7+ε days → RETENTION-PRUNE).
- **RP-T4** non-date flat log with the archive copy present + de-linked → RETENTION-PRUNE (the meeting-file pattern); same log with **no** archive copy → KEEP.
- **RP-T5** no/absent MEMORY.md → KEEP (no in-tree corroboration, fail-closed).
- **RP-T6** regression: all 36 existing resync-audit tests green; `bun run test:unit` green.

## 5. Risks

- **R1 — false corroboration.** A hand-deleted old log whose index row was also hand-removed is indistinguishable from a prune; the resulting action (commit the deletion) is identical to the prune's settled action, and both conditions must hold simultaneously. Accepted per ticket (the corroboration rule is narrow by design).
- **R2 — KEEP net intact.** Still-linked, in-window, non-flat, non-memory, unreadable-index deletions all fall through to the bare KEEP — bit-identical to today.
- **R3 — window arithmetic drift.** The window check re-implements archive-memory's arithmetic (local-midnight now, UTC-parsed filename date, strict `> 7`). Mirrored, not imported — archive-memory is template-delivered and its selection rule is out of scope by dispatch. Documented here as the coupling point: a future retention-window change in archive-memory must be mirrored in `retentionWindowElapsed` (test RP-T3 pins the boundary).
- **R4 — mtime asymmetry for non-date logs.** The original rule keys on mtime; post-deletion the observable proxy is archive-presence. A non-date log deleted by hand with no archive copy → KEEP (safe direction; never the reverse).
- **R5 — propagation.** resync-audit.ts is L0-only (no templates/common mirror; confirmed by find). SCRIPTS.md row + VERSION_MANIFEST.md (auto-generated, reconciliation-gated) regenerate at sync.

## 6. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None beyond running the updated audit (platform-independent bun + git) | N/A (scripts only) |
| Antigravity (GEMINI.md) | None — resync-audit is invoked via the shared project-resync/sync skills; no GEMINI.md text changes required | N/A |
| templates/common | None — resync-audit.ts is workspace-root-only (L0), not template-delivered; no mirror exists or is required | N/A |

## 7. Acceptance criteria

- [ ] Corroborated prune (date log + de-linked index) → RETENTION-PRUNE; still-linked, in-window, unknown-pattern, non-memory deletions → KEEP (RP-T1..T5).
- [ ] Report legend documents the new verdict.
- [ ] Full resync-audit battery (36 existing + new) + `bun run test:unit` + verify-scripts + audit.ts green.
- [ ] No dev-sync.ts / archive-memory.ts changes (selection rule mirrored, not modified).
