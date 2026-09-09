# Design: Marker Engine Remediation — Retire Mislabeled §8 Intentional-Duplicate Markers, Target-Aware Scrub Fix

**Date**: 2026-09-10
**Status**: Draft (Row 0 Design Gate document; evidence verified 2026-09-09 by direct code reading and a 3-agent survey, spot-reconfirmed 2026-09-10)
**Source**: PM-dispatched architect task, following the 2026-09-09 destructive `--marker-rewrite` incident
**Spec ID**: 2026-09-10-marker-engine-remediation-design
**Related**: [ADR-0062](../adr/0062-marker-based-doc-propagation-domains.md), [2026-08-24-marker-propagation-engine-design.md](2026-08-24-marker-propagation-engine-design.md), [ADR-0065](../adr/0065-accessibility-standard.md), [memory/2026-09-09.md](../../memory/2026-09-09.md), `scripts/propagate-to-templates.ts`, `scripts/helpers/markers.ts`, `scripts/verify-adr-governance.ts`

---

## Background

The `--marker-rewrite` mode of `scripts/propagate-to-templates.ts` maintains "intentional-duplicate" markers (`<!-- intentional-duplicate: workspace standards §N — maintained locally ...; source: docs/constitution/XX.md; hash: xxxxxxxx -->`) scanned from `templates/**/*.md` by `scanIntentionalDuplicateMarkers` (`scripts/helpers/markers.ts:254-302`). On a stale hash it splices the region from marker+1 down to the next intentional-duplicate marker or EOF (`scripts/propagate-to-templates.ts:1429-1447`), replacing it with the source file's content extracted as "first `###` heading → EOF" (`extractSectionContent`, `scripts/helpers/markers.ts:308-323`). The `§N` in the marker only resolves the source file name — it never slices content.

**Marker census** (grep re-confirmed 2026-09-10 — one item beyond the survey summary): 9 markers in 8 files, all hashes fresh from the 2026-09-09 bookkeeping bump.

| Marker | Location | Hash | Status per this design |
|--------|----------|------|------------------------|
| §8 | `templates/co-design/docs/co-design.context.md:103` | `b36aeedd` | Retire (D1) |
| §8 | `templates/co-work/docs/co-work.context.md:103` | `b36aeedd` | Retire (D1) |
| §8 | `templates/co-game/docs/co-game.context.md:128` | `b36aeedd` | Retire (D1) |
| §8 | `templates/co-abap/docs/co-abap.context.md:472` | `b36aeedd` | Retire (D1) |
| §8 | `templates/co-develop/docs/co-develop.context.md:109` | `b36aeedd` | Retire (D1) |
| §8 | `templates/co-security/docs/co-security.context.md:120` | `b36aeedd` | Retire (D1) |
| §8 | `templates/common/docs/variant.context.template.md:136` | `b36aeedd` | Retire (D1) |
| §3 | `templates/common/docs/variant.context.template.md:152` | `e43638d6` | Keep (D2) — genuine copy (/sync 7-step flow, lines 153-165) |
| §3 | `templates/common/docs/context.md:387` | `e43638d6` | Keep (D2 rationale applies equally) — genuine copy (/sync 7-step flow); omitted from the survey summary but present, and its strict-gate friction is by design like the other §3 |

**The §8 markers are mislabeled.** Survey conclusion: the content below the §8 markers is variant-authored text (6%-50% §8-derived; co-design ~6%), not a maintained copy — spot-checked (co-design's Design Guidelines principles at :103+, co-work's automation lane ladder at :103+ are variant-curated). The markers were hand-inserted by no current generator (`create-l3-scaffold.ts:389-412` writes plain stubs; `l3-to-variant-pipeline.ts` has no marker logic). A `--marker-rewrite` refresh executed 2026-09-09 destroyed variant content in all 7 files and was reverted pre-commit (`memory/2026-09-09.md`).

**The gate makes this recurring.** dev-sync step 3.97 runs `bun scripts/verify-adr-governance.ts --strict` (fail-closed, exit 1), which flags stale intentional-duplicate hashes. Every edit to `docs/constitution/08-coding-guidelines.md` (or `03-pr-workflow.md`) therefore re-stales the markers and blocks `/sync` until hashes are bumped — this happened 2026-09-09; hashes were bumped as pure bookkeeping.

**No capability is lost.** The variant files already receive the canonical workspace summary via engine-managed COMMON-CONTEXT zones (`variant-context` domain, `scripts/propagation-map.json:201-206` — the 4-bullet key-rules block). Removing the mislabeled §8 markers loses no propagation capability.

**Scrub coupling.** `audit.ts:2110` exempts files containing the string `intentional-duplicate` from the L0-leak check (`L0_LEAK_PATTERN = /CONSTITUTION\.md|docs[\/\\]constitution[\/\\]/i`) — the marker line's own `source: docs/constitution/...` is what would trip it. After marker removal, the files must independently pass the leak check (the survey found no other L0-pattern matches in them; the D6 audit run confirms). Separately, the shared scrub helper `scrubConstitutionRefs` (`scripts/propagate-to-templates.ts:620`) has a target-aware defect: rule A-5's class of rewrites emits `](docs/context.md)` links into files that live at `docs/context.md` themselves (variant contexts), where the correct relative link is `](context.md)`.

---

## Goals / Non-Goals

### Goals

- G1 — Retire the 7 mislabeled §8 markers: delete the single marker line in each file; zero content changes otherwise.
- G2 — Remove the recurring strict-gate friction: future §8 edits must no longer re-stale variant markers or block `/sync`.
- G3 — Eliminate the destructive-rewrite exposure for the 7 files (any future stale-hash `--marker-rewrite` run would replace curated variant text with the full ~170-line §8).
- G4 — Fix the scrub A-5 target-aware defect so `docs/context.md`-located targets get `](context.md)` links.
- G5 — Preserve the intentional-duplicate mechanism for genuine duplicates (both §3 markers stay).

### Non-Goals

- NG1 — No rewrite or reorder of variant content under the retired markers (only the marker line is deleted).
- NG2 — No fix for the multi-marker stale-index splice bug (becomes unreachable after D1; recorded under Known Limitations).
- NG3 — No changes to the `qa-gate.ts` blanket copy, the `verify-scripts.ts:263` inline copy, or the plain-texted Language Policy line in `CONSTITUTION.md` (see D3).
- NG4 — No new engine features (no suppress/ignore flag — see Decision rationale).
- NG5 — Pre-existing defects stay out of scope: co-game's duplicate `## Template Provenance` sections (~lines 221-230); co-work's stacked version footer lines (~188-189).

---

## Decision

### D1 — Retire the 7 §8 markers (delete marker line only)

Delete the single `<!-- intentional-duplicate: ... §8 ... -->` line in the 6 variant `co-*.context.md` files and `variant.context.template.md:136`. **Zero content changes otherwise.** Effect: no future §8-edit strict-gate blocks, no hash-bump duty, no destructive-rewrite exposure for these files; the false "maintained locally" provenance claim disappears.

*Rationale — retire vs. restructure vs. suppress flag*:

- **Restructure** (make the region a true maintained copy of §8) would reorder curated variant content and replace deliberate condensations with the full ~170-line §8 text — exactly the damage the 2026-09-09 refresh caused before it was reverted. It would also bloat every variant context file for no context-proximity gain (the COMMON-CONTEXT key-rules block already provides the sanctioned summary).
- **Suppress flag** (teach the engine to ignore these markers) adds parser machinery for markers that should not be tracked at all — it would keep the semantic lie ("maintained locally") in the files while making the codebase carry special-case knowledge of the lie. Deleting the mislabel is strictly cheaper.
- Even a "correct" rewrite could never do what these markers imply: `§N` only resolves the source filename; the engine has no per-section slicing (`extractSectionContent` takes "first `###` → EOF"). The mechanism never matched the markers' claim.

### D2 — Keep both §3 markers (mechanism retained and exercised)

`variant.context.template.md:152` sits above a genuine §3-derived copy (the /sync 7-step flow, lines 153-165); `templates/common/docs/context.md:387` holds the same genuine copy at L1. These are the only legitimate uses of the mechanism — keep both. Their strict-gate friction when `03-pr-workflow.md` changes is **by design**: a real duplicate should be re-synced when its source changes. (The L1 §3 marker was absent from the survey summary but is confirmed present; it requires no action under this design.)

### D3 — Target-aware scrub rule A-5 fix in `scrubConstitutionRefs`

Extend `scrubConstitutionRefs(content, filePath?, targetPath?)` (`scripts/propagate-to-templates.ts:620`): when `targetPath` ends with `docs/context.md`, rewrite `](docs/context.md)` → `](context.md)` after rules A-1..A-5. No `targetPath` → output unchanged (backward compatible; the A-5 rule lives in the markdown branch — code files return early via `isCode`, which derives from `filePath`).

Thread target paths at call sites:

| Call site | Thread |
|-----------|--------|
| `propagate-to-templates.ts:463` | `d.targetPath` |
| `propagate-to-templates.ts:689` | `d.targetPath` |
| `propagate-to-templates.ts:835` | governance target path |
| `propagate-to-templates.ts:1289` | move the zone scrub into the per-variant loop, passing the per-variant target path (scrub is idempotent) |
| `scripts/validate-templates.ts:1169` | `l1Path` as `targetPath` (currently only L0 paths are passed) |
| `scripts/validate-templates.ts:1223` | `l1FilePath` as `targetPath` (same) |

The validate-templates sites compare `scripts/` trees, so the new rule is a no-op there — threading keeps semantics honest rather than changing behavior.

**Do NOT touch**: `scripts/qa-gate.ts` blanket copy (both-sides hash compare, self-consistent, pinned by `tests/unit/qa-gate-crlf.test.ts`); `scripts/verify-scripts.ts:263` inline copy; the plain-texted Language Policy line in `CONSTITUTION.md` (stable form, no link restoration needed).

### D4 — New unit test `tests/unit/scrub-constitution-refs.test.ts`

Three cases: (a) no `targetPath` → byte-identical to legacy output for a fixture containing A-2/A-5 triggers; (b) `targetPath` ending in `docs/context.md` → `](docs/context.md)` becomes `](context.md)`; (c) other `targetPath` (e.g. `docs/other.md`) → unchanged. Note: `tests/unit/propagate-to-templates.test.ts:10` already imports from `scripts/propagate-to-templates.ts`, so importing is safe.

### D5 — `agents/docs-writer.md` Constraints bullet on gitignored-path verification

In `agents/docs-writer.md` `## Constraints` (~L113-122), add one bullet: edits under gitignored paths (e.g. `Projects/**`) are invisible to git diff; verification must paste Read/grep output, never rely on git-based tooling. Root `agents/` files are excluded from L0→L1 propagation (`propagation-map.json` comment), so there is no L1 parity obligation; the agent-file change triggers lifecycle sync, handled by `/sync`.

### D6 — Verification gates for the whole change

1. `bun scripts/test-runner.ts unit`
2. Integration tests: `tests/marker-rewrite.test.ts` + `tests/propagate-to-templates.test.ts`
3. `bun scripts/propagate-to-templates.ts --marker-rewrite --domain constitution-context --dry-run` — expect in-sync, `Would overwrite: 0`
4. `bun scripts/verify-adr-governance.ts --strict` — expect pass, with exactly two intentional-duplicate markers remaining: `templates/common/docs/context.md:387` (§3) and `variant.context.template.md:152` (§3)
5. `bun scripts/validate-templates.ts`
6. `bun scripts/audit.ts` — confirms the 7 marker-removed files independently pass the L0-leak check (previously covered by the `intentional-duplicate` exemption at `audit.ts:2110`)

---

## Proposed Changes

| # | File | Action | Change |
|---|------|--------|--------|
| 1 | `templates/co-design/docs/co-design.context.md` | Modify | Delete §8 marker line :103 only |
| 2 | `templates/co-work/docs/co-work.context.md` | Modify | Delete §8 marker line :103 only |
| 3 | `templates/co-game/docs/co-game.context.md` | Modify | Delete §8 marker line :128 only |
| 4 | `templates/co-abap/docs/co-abap.context.md` | Modify | Delete §8 marker line :472 only |
| 5 | `templates/co-develop/docs/co-develop.context.md` | Modify | Delete §8 marker line :109 only |
| 6 | `templates/co-security/docs/co-security.context.md` | Modify | Delete §8 marker line :120 only |
| 7 | `templates/common/docs/variant.context.template.md` | Modify | Delete §8 marker line :136 only; keep §3 marker :152 untouched |
| 8 | `scripts/propagate-to-templates.ts` | Modify | D3: `targetPath` param + A-5 rule; thread at :463, :689, :835, :1289 (move zone scrub into per-variant loop) |
| 9 | `scripts/validate-templates.ts` | Modify | D3: thread `l1Path` / `l1FilePath` as `targetPath` at :1169, :1223 |
| 10 | `tests/unit/scrub-constitution-refs.test.ts` | Create | D4: three-case unit test |
| 11 | `agents/docs-writer.md` | Modify | D5: one Constraints bullet on gitignored-path verification |

Execution order: **Sequential**, single PR (see Trade-offs). Rows 1-7 (marker deletion) are independent of rows 8-10 (scrub fix); row 11 independent. All rows 1-7 must land in the same commit-set as D6 gate 3/4 run after them.

Verification checklist (D6 gates, in order):
- [ ] Unit suite green (`test-runner.ts unit`)
- [ ] `tests/marker-rewrite.test.ts` and `tests/propagate-to-templates.test.ts` green
- [ ] `--marker-rewrite --dry-run` reports in-sync, `Would overwrite: 0`
- [ ] `verify-adr-governance.ts --strict` exits 0 with only the two §3 markers remaining
- [ ] `validate-templates.ts` passes
- [ ] `audit.ts` passes — 7 files pass L0-leak check without the marker exemption
- [ ] Diff inspection: rows 1-7 change exactly one line each (no variant content touched)

---

## Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None | No `.claude/` command/config files touched; scripts are platform-neutral |
| Antigravity (GEMINI.md) | None | Justification: no `.gemini/` or `.agents/` files affected; `agents/docs-writer.md` is the platform-neutral root agent definition consumed by all platforms |
| templates/common | changes required | `templates/common/docs/variant.context.template.md` (§8 marker removal); scrub fix changes future propagation output where targets live at `docs/context.md` |

---

## Trade-offs

- **Single PR, sequential**: `dev-sync.ts` touches shared pipeline files on every commit, so per CONSTITUTION §3.3 (Sequential Branch Dependency Rule) unmerged parallel branches conflict by default; marker removal and the scrub fix also share the D6 gate sequence.
- **Losing the §8 drift signal is intended**: there is no real local copy to drift — the "signal" was monitoring files that do not exist. Genuine-duplicate drift detection is retained via the two §3 markers, which is the mechanism working as designed.
- **Signature widening (D3) is backward compatible**: optional `targetPath`, no-`targetPath` → unchanged; the D4 legacy-identity test pins that contract.
- **validate-templates threading is deliberately inert** (no behavior change at :1169/:1223 today); it prevents the next target-aware rule from silently misfiring on those compare sites.
- **Post-D1 governance surface shrinks**: `verify-adr-governance.ts --strict` tracks only the two §3 markers; §8 source edits stop churning variant hashes (bookkeeping-only bumps like 2026-09-09's become unnecessary).

---

## Accessibility

**Explicit exemption per ADR-0065** (backend/non-UI exemption, stated as required): this is a documentation-and-engine remediation with no user-facing UI, CLI, or generated-document interaction surface. No keyboard, screen-reader, contrast, motion, or target-size impact. No accessibility verification method applies beyond standard Markdown review.

---

## Known Limitations

- **Multi-marker stale-index splice (engine, NOT fixed here)**: `--marker-rewrite` splices at scan-time line numbers while re-reading the file each iteration, so a file with 2+ intentional-duplicate markers can splice at stale indices. After D1, no file has 2+ markers, making the bug unreachable today. **It re-arms if a future genuine second marker lands in one file** — a candidate engine fix, intentionally out of scope (NG2).
- **§8 fidelity gap remains by design**: variants keep receiving §8's canonical summary only via the 4-bullet COMMON-CONTEXT key-rules block (`variant-context` domain); full §8 stays at L0/L1. This is the intended AI-context-proximity trade, unchanged by this design.
- **audit.ts exemption coupling**: until D1 lands, the L0-leak exemption (`audit.ts:2110`) still covers these files via the marker string; after D1 the files must stand on their own (D6 gate 6 verifies).

---

## Open Questions

- None blocking implementation. For the record: whether the multi-marker stale-index bug deserves a scheduled engine fix was deliberately deferred (NG2 / Known Limitations) — it is unreachable after D1 and should be revisited only if a genuine second marker ever co-locates in one file.
