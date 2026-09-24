# Design: Propagation-Engine Batch — Marker Append-on-Missing, L1 SCRIPTS.md Mirror Generator, `.agents/commands` Adjudication (Backlog PR C)

- **Spec id**: `2026-09-25-propagation-engine-batch-design`
- **Date**: 2026-09-25
- **Author**: Template Architect (Design Gate, ADR-0074)
- **Tickets**: T-20260924-006, T-20260924-001, T-20260925-003 (all `kind: manual`, status `backlog` at design time)
- **Program**: backlog-processing program, PR C (propagation-engine improvements)
- **Amendments**: Amendment 1 (2026-09-25, §14) — PM ruling during Phase 2 implementation: the L1 mirror's 81 legacy L0 rows are removed by a one-time normalization diff, accepted in this PR (supersedes the original D6 ordering/bootstrap claims).

---

## 1. Background

### 1.1 Ticket provenance

**T-20260924-006 — runMarkerRewrite append-on-missing.**
`runMarkerRewrite` (`scripts/propagate-to-templates.ts`, marker-inject loop, ~lines 1577–1641) only rewrites marker zones that already exist in the target file. When a target carries no zone for the domain's marker, it logs
`no <MARKER> zones present (will inject on --apply)` and skips. The message is false: `--apply` does not inject. Every new marker-domain bootstrap is therefore a manual hand-insertion of the marker pair. This happened for COMMON-CONSTITUTION (historically) and for COMMON-CONSTITUTION-PR (2026-09-24, where design
`docs/designs/2026-09-24-constitution-s33-context-injection-design.md` Decision D5 explicitly chose a one-time manual insert over an engine change — this spec supersedes that choice for future bootstraps).

**T-20260924-001 — L1 SCRIPTS.md mirror automation.**
`templates/common/scripts/SCRIPTS.md` is maintained by manual same-commit alignment. `propagate-to-templates.ts` only *parses* SCRIPTS.md for layer metadata (`parseScriptLayers`) and never writes the mirror. The 2026-09-24 incident (memory/2026-09-24.md): the mirror's annotation prose lagged the root registry by 13 rows (versions agreed, annotations stale); the fix copied root annotations verbatim (26 changed lines) and filed this ticket. `lifecycle-sync-audit.ts` Check B compares versions and file existence only — annotation prose drift is invisible to it.

**T-20260925-003 — `.agents/commands` surface adjudication.**
Finding D of spec `2026-09-25-verifier-platform-expansion-design.md` §8: the root `.agents/commands/` directory holds 7 files, `templates/common/.agents/` has no `commands/` directory, no producer writes it, and all command-parity checks exclude it by recorded decision. This spec investigates the surface and rules.

### 1.2 Investigation findings (verified 2026-09-25, branch main @ 8a2da508)

**Marker engine (T-006).**
- Four `marker-inject` domains exist in `scripts/propagation-map.json`: `governance-agents` (COMMON-AGENTS → 13 variant AGENTS.md, source = L1 AGENTS.md), `constitution-context` (COMMON-CONSTITUTION → `templates/common/docs/context.md`), `constitution-context-pr` (COMMON-CONSTITUTION-PR → same file), `variant-context` (COMMON-CONTEXT → 13 × `templates/co-*/docs/<variant>.context.md`).
- Domain fields today: `mode`, `source_file`, `target_file`, `marker`, `target_variants`, `exclude_variants`, `scrub_constitution_refs`, `disabled`, `note`.
- Per (domain, target), the engine pairs the k-th existing zone of the domain's marker ↔ the k-th source section (document order). Existing zones beyond the source section count are warned and skipped; source sections beyond the existing zone count are silently dropped.
- Zone format: `<!-- COMMON-<DOMAIN>:START -->` … `<!-- COMMON-<DOMAIN>:END -->` (`scripts/helpers/markers.ts`, `extractMarkerZones` / `findMarkerZones`).
- Writes normalize CRLF→LF then re-apply the target's detected line ending (`detectLineEnding`), so appended content must ride the same path.
- dev-sync Step 4.55 (WARN stage) runs `--marker-rewrite --domain <name>` (dry-run) for `['constitution-context', 'constitution-context-pr', 'variant-context']` and parses the `Would overwrite: N` summary counter.
- `validate-templates` PM-02 (zone byte-parity L1↔variants for governance-agents) and PM-03 (`target_variants` = co-* set minus excludes) constrain any append behavior.

**SCRIPTS.md pair (T-001).** Row-set comparison (parsed 2026-09-25): root registry 200 rows, mirror registry 209 rows.
- Root-only rows: 17, every one layer `L0` (e.g. `review-baseline.ts`, `resync-audit.ts`, `helpers/template-version.ts`, `test-*.ts`, `experiments/infer-graph-from-phases.ts`).
- Mirror-only rows: 26 — `handbook/*.ts` (23) and `tests/*.test.ts` (3). These files exist **only** under `templates/common/scripts/` (no root counterpart) and carry `// @version X.Y.Z` headers matching their mirror rows (spot-checked: `check-authoring.ts` 1.2.0, `check-search.ts` 2.0.0, `apply-handbook-theme.test.ts` 1.0.1).
- Shared rows: 183. Version mismatches: 0. Layer mismatches: 0. All 183 shared rows are byte-identical between the two files (the 2026-09-24 alignment holds today). **Amendment 1 correction**: 81 of the 183 shared rows carry root layer `L0` (`propagate-to-templates.ts`, `ticket.ts`, `new-project.ts`, `helpers/ticket-store.ts`, `validators/*`, …). Every one of those 81 rows references a script with **no** copy under `templates/common/scripts/` — they are legacy registrations from before the delivery filter existed, not tier-delivered scripts. They are invisible to Check B (it skips root `L0` rows) and stripped at delivery anyway: `new-project.ts:1461` and `create-l3-scaffold.ts:342` both print `📝 Filtered SCRIPTS.md: removed N L0-only registry entries` (owner's 2026-09-24 scaffold log: `removed 81`). Post-normalization the mirror is 128 rows, matching the template tree's 128 `.ts` files 1:1 with zero uncovered files — the registry then lists what the tier delivers.
- Mirror ordering: shared rows keep **root file order** (root order is historical append order, not sorted); mirror-only rows sit as sorted groups at the position "before the first row (in file order) whose script key is lexicographically greater" (handbook block between `graph-delta-log.ts` and `helpers/beta-lifecycle.ts`; tests block between `helpers/ticket-store.ts` and `validators/types.ts`). **Amendment 1**: this layout is an artifact of manual maintenance, not a reproducible generation rule — once the 81 L0 rows are removed, the rule's positions shift (engineer-flagged: 5 changed rows; measured composition: 3 ordering corrections + 2 lockstep row refreshes — §14.2). Superseded by the canonical-order rule in §6-D6 as amended.
- Mirror-only row byte format: `` | `<key>` | L0 | <version> | active | — | — | common | — | `` (regular spaces).
- Template-tree consistency (corrected per Amendment 1): no `.ts` file under `templates/common/scripts/` is unregistered, and every non-L0 mirror row has its file (Check B enforces this). The reverse does not hold: 81 mirror rows lack template-tree files (the legacy L0 rows above). They are removed by this spec's normalization; no producer copies them.
- `generate-scripts-readme.ts` precedent: standalone generator, invoked from dev-sync **Step 2.5** via `existsSync` + `try/catch` + hard-exit-on-failure idiom; writes both `scripts/README.md` and `templates/common/scripts/README.md`.
- `verify-scripts.ts --check-drift` checks package.json aliases vs the scripts directory — wrong tool for this drift class.

**`.agents/commands` (T-003).**
- The 7 files: `changelog.md`, `commit-push-pr.md`, `meeting.md`, `memlog.md`, `new-task.md`, `project-review.md`, `sync.md` (251 lines total; `.claude/commands` has 8 — `gateguard.md` has no `.agents` copy).
- Provenance: created 2026-07-11 in commit `59dc781b` "fix(agents): close .agents/ command and skill registry parity gap" — the workspace-hardening WS1 M9/M10 deliverable ("Add missing command files, verify skill registry completeness", `docs/designs/workspace-hardening-design.md`), explicitly framed as an Antigravity-platform parity fix.
- Content vs `.claude/commands`: `changelog.md`, `memlog.md`, `new-task.md` byte-identical; `sync.md` byte-identical (and was updated in same-commit lockstep on 2026-08-04, commit `518801ab`, alongside the `.claude`/`.gemini` root copies and the `templates/common/.claude|.gemini/commands` mirrors); `commit-push-pr.md` and `project-review.md` carry Antigravity/Gemini-CLI-specific prose ("Redirects … Gemini/Antigravity enforcement", "On Antigravity/Gemini CLI: delegates to /meeting …"); `meeting.md` is a distinct Antigravity skill-shim (full SKILL.md frontmatter, not a copy of `.claude/commands/meeting.md`).
- Consumers/producers: `sync-skills.ts` manages `.agents/skills/` (Phase 1 copy, Phase 2 back-sync) but has no `.agents/commands` arm. `validate-md-language.ts` scans the files (read-only English check). The recorded exclusions stand at 5 check sites: `audit.ts:1083`, `validate-templates.ts:1229`, `verify-platform-lifecycle.ts:174` (Check G), `helpers/scan-l3-project.ts` commands roots, and pre-commit 6b / post-write-lifecycle-check 3.
- `platform-command-lifecycle-manager` skill documents only `.claude/commands` and `.gemini/commands` lifecycles.

---

## 2. Goals

1. T-006: give `runMarkerRewrite` an opt-in, placement-controlled append path for missing zones, so a new marker-domain bootstrap no longer requires a manual hand-insertion.
2. T-006: make every marker-rewrite log line truthful.
3. T-001: generate the `templates/common/scripts/SCRIPTS.md` L1 view from the root registry, byte-stably, inside the standard sync pipeline.
4. T-001: make mirror drift fail loudly instead of accumulating silently.
5. T-003: adjudicate the `.agents/commands` surface by evidence and record the ruling where future contributors will find it.

## 3. Non-goals

- Variant SKILLS.md authoring (T-009) and the contract inventory (T-002).
- The T-20260925-002 soak decision.
- New platform surfaces (no new `.agents`/`.codex` arms anywhere).
- Placement changes for existing domains' zones: no domain's existing zones move, re-order, or re-pair. Domains without the new opt-in flag keep today's exact behavior.
- Governing `.agents/commands` via a propagation domain (ruled out in §6-D8).
- Making the generator own the mirror's prose sections (preamble, Guide, Version Bump Policy) — registry table only (§6-D6).
- Full-file parity checks for SCRIPTS.md prose (preamble drift remains out of machine scope).

## 4. Requirements (ASD-STE100, ADR-0079)

### 4.1 T-20260924-006 — append-on-missing

- R1. Add an optional `append_on_missing` boolean to marker-inject domains in `scripts/propagation-map.json`. Default is `false`.
- R2. Honor `append_on_missing` only for domains that declare it `true`. Keep all other domains byte-for-byte on current behavior.
- R3. Add an optional `insert_after_marker` string field. Its value is another marker name. When set, resolve the insertion point to the line after the LAST zone of that marker in the target file.
- R4. When `insert_after_marker` is absent, resolve the insertion point to end-of-file (after the last non-empty line; preserve the trailing newline).
- R5. When the anchor marker has no zone in the target file, derive no placement. Skip the target and log the skip. Do not fall back to end-of-file in this case.
- R6. Fire the append path when `existingZones.length < sourceSections.length` (0 existing = full bootstrap; k existing = append the unmatched tail). Keep the existing k-th ↔ k-th pairing for zones that already exist.
- R7. Build each appended zone as `<START line>` + source section content (post-scrub) + `<END line>`. Insert all appended zones of one target in one contiguous block, in source order.
- R8. Normalize appended content to the target file's detected line ending. Write through the existing normalize-and-reapply path.
- R9. In dry-run, print the planned append per target and add the count to a new `Would append: N` summary counter. Write nothing.
- R10. In `--apply`, write the file and log the append. After one apply, a second dry-run reports the domain in sync (0 overwrite, 0 append).
- R11. Replace the misleading `no ${marker} zones present (will inject on --apply)` message. Use a truthful message naming the domain's opt-in state (see §6-D4 wording).
- R12. Extend dev-sync Step 4.55 to parse `Would append: N` and WARN on the sum of would-overwrite + would-append.
- R13. Enable `append_on_missing: true` + `insert_after_marker: "COMMON-CONSTITUTION"` on the `constitution-context-pr` domain only. Produce no diff on today's tree (its zone already exists in every current target).

### 4.2 T-20260924-001 — L1 SCRIPTS.md mirror generator

- R14. Create `scripts/generate-scripts-mirror.ts` (L0-only). It regenerates the registry table of `templates/common/scripts/SCRIPTS.md` from `scripts/SCRIPTS.md` plus the template scripts tree.
- R15. Define the generated span as: the `| script |` header row through the last table row before the next `## ` heading inside `## Registry`. Leave all prose sections hand-maintained.
- R16. Implement the row rules of §6-D6 (as amended) exactly. Mirror non-L0 root rows byte-for-byte. Synthesize mirror-only rows from each file's `// @version` header. Fail loudly on a mirror-only file without a parseable version header. The generated span never contains an L0-layer row, even when the current mirror carries one (legacy rows are removed, see R18).
- R17. Exclude files whose basename starts with `_` from the mirror-only scan (test-fixture policy).
- R18. Make the output deterministic: identical inputs produce byte-identical output. The first run on today's tree produces the ONE-TIME normalization diff defined in §6-D6 (Amendment 1): deletions of the 81 legacy L0 rows, 3 ordering corrections, and 2 lockstep row refreshes (dev-sync 1.18.0, lifecycle-sync-audit 1.16.0 — byte-verbatim from rows edited in this change set), reviewed and accepted in this PR. The SECOND and every subsequent run produces zero changed lines.
- R19. Support `--check`: compare the regenerated span against the file without writing. Exit 0 when byte-identical; exit 1 with a drifted-row summary otherwise.
- R20. Wire the generator into dev-sync as Step 2.6 (after Step 2.5 `generate-scripts-readme.ts`, same existsSync + hard-exit idiom). It runs in write mode.
- R21. Extend `lifecycle-sync-audit.ts` Check B with a projection arm: import the generator's pure builder, regenerate the expected span, and byte-compare it with the mirror's actual span. Emit an error with fix hint `bun scripts/generate-scripts-mirror.ts` on mismatch. Keep the existing version and file-existence checks.
- R22. Do not add a propagation-map domain for the mirror. The mirror is a derived projection, not a file copy.

### 4.3 T-20260925-003 — `.agents/commands` adjudication

- R23. Rule the surface L0-resident by design (ruling (a), §6-D8).
- R24. Document the surface in AGENTS.md §6 ("Platform Skills Distribution" area): what the 7 files are, who consumes them, the same-commit lockstep maintenance rule with `.claude/commands`, and the recorded exclusion from command-parity checks and propagation.
- R25. Add one line to the `platform-command-lifecycle-manager` skill: root `.agents/commands/*.md` updates ride the same commit as their `.claude/commands` counterparts; no propagation target exists.
- R26. Keep the recorded exclusions at the 5 check sites. Keep `validate-md-language.ts` scanning the files.
- R27. Close ticket T-20260925-003 via `bun scripts/ticket.ts move T-20260925-003 done --result "<ruling summary>"` in the implementation PR. Use `--result`; the command requires it.

## 5. Acceptance criteria

- AC-1 (R1–R2, R13). `grep -c append_on_missing scripts/propagation-map.json` returns 1 (only `constitution-context-pr`), and all three Step-4.55 domains produce identical zone outputs to the pre-change engine on today's tree.
- AC-2 (R3–R5, unit). With `insert_after_marker` set and the anchor present, the helper inserts after the anchor's END line. With the anchor missing, the helper mutates nothing and reports no placement.
- AC-3 (R6, unit). For a target with k < n zones in an opted-in domain, the first k existing zones keep their k-th ↔ k-th source pairing and sections k+1..n append in source order.
- AC-4 (R6, R10, unit). Running the append logic on its own output a second time appends nothing (idempotent).
- AC-5 (R8, unit). A CRLF target receives CRLF appended content and no `\r\r\n` sequences.
- AC-6 (R9–R11, integration). Dry-run on the current tree prints `Would append: 0` for all Step-4.55 domains and the string `will inject on --apply` appears nowhere in the output.
- AC-7 (R12). Step 4.55 WARNs when a fixture-induced append is pending (verified by the pure-counter path or a dry-run simulation; no live repo mutation in tests).
- AC-8 (R14–R18). The first generator run's diff on today's tree contains ONLY: deletions of L0-layer rows, 3 ordering relocations, and 2 lockstep row refreshes (dev-sync 1.18.0, lifecycle-sync-audit 1.16.0 — byte-verbatim from rows edited in this change set); no other surviving row's content changes (reviewed normalization). `bun scripts/generate-scripts-mirror.ts && bun scripts/generate-scripts-mirror.ts && git diff --exit-code templates/common/scripts/SCRIPTS.md` passes (second-run byte-stability).
- AC-9 (R18). A double run leaves the mirror byte-identical (idempotency).
- AC-10 (R16, unit). A root row with layer `L0` never appears in the generated span — including the 81 legacy rows the current mirror carries; a layer `L0+L1` row appears byte-verbatim; a template-tree file without a root row produces a synthesized row with the version from its `// @version` header; a missing version header throws.
- AC-11 (R19). On a normalized tree (after the generator's write run, or on the post-PR tree), `--check` exits 0; after a hand-inserted fake row in the mirror's registry span (test fixture), it exits 1 and names the drifted region. On the pre-normalization tree, `--check` exits 1 by design — the pending normalization IS the drift it reports.
- AC-12 (R21). With a test fixture that makes the projection differ, `lifecycle-sync-audit.ts` reports a Check B error whose fix hint names the generator. With the tree in sync, Check B reports no projection issue. Post-normalization interplay (Amendment 1, verified): Check B iterates the ROOT registry and skips `L0` rows, so the 81 deletions cannot surface as missing-row errors, and Check B never iterates the mirror for extra rows — the reduced 128-row mirror set needs no Check B changes. The mirror-only handbook/tests rows and the row-set asymmetry remain legitimate (unchanged behavior).
- AC-13 (R20). dev-sync Step 2.6 runs the generator and aborts the sync on a generator failure (hard-exit idiom, mirroring Step 2.5).
- AC-14 (R23–R27). AGENTS.md §6 carries the `.agents/commands` paragraph; the skill carries the lockstep note; the ticket is `done` with a non-empty result; the 5 exclusion comments still cite the adjudication (updated ticket reference).
- AC-15. Full battery passes: `bun test`, `bun scripts/validate-templates.ts`, `bun scripts/audit.ts`, `tsc --noEmit` (Step 3.95b scope), and dev-sync Step 4.55 domains all report 0 would-overwrite / 0 would-append.

## 6. Design decisions and trade-offs

### D1. Opt-in per domain, not global — **picked**

A global append-on-missing would change behavior for all four marker-inject domains at once, including domains whose correct missing-zone handling is "warn and skip" (e.g. a variant that deliberately dropped a zone). A per-domain flag keeps the fail-safe default and honors the ticket's precedent constraint: existing domains pair as before. Cost: two new map fields and one flag check. Rejected: global flag (unsafe), auto-detection via sibling-zone heuristics (non-deterministic placement).

### D2. Placement: `insert_after_marker` anchor with fail-safe skip; end-of-file only as the anchorless default — **picked**

Resolution order per (domain, target file) when the append path fires:
1. `insert_after_marker` set and the target has ≥1 zone of that marker → insert after the LAST such zone's END line.
2. `insert_after_marker` set and the target has no zone of that marker → no placement derivable → skip + truthful log (counted as skipped).
3. No `insert_after_marker` → append at end-of-file.

The anchor form covers the real bootstrap shape (COMMON-CONSTITUTION-PR belongs directly after the COMMON-CONSTITUTION block in `docs/context.md`, not at file end). The skip-on-missing-anchor rule is fail-safe: a wrong anchor name degrades to today's behavior (skip), never to a surprising EOF dump. Bare end-of-file stays available for domains whose zones genuinely live at the end (COMMON-AGENTS in AGENTS.md is end-of-file today). Rejected: end-of-file-only (wrong location for mid-file zone families); literal-text anchors (string-matching prose is fragile across variants); a per-domain `insert_before` twin (no current use case — add symmetrically if one appears).

### D3. Pairing: append only the unmatched source tail; never re-pair existing zones — **picked**

The k-th ↔ k-th document-order pairing is invariant under this design: existing zones keep indices 0..k-1; appended zones take indices k..n-1 in source order. The dangerous alternative — re-pairing all zones when counts differ — is explicitly not implemented. This satisfies the ticket's "existing zones in that domain pair as before" constraint and keeps `constitution-context` (2 zones) and `constitution-context-pr` (1 zone) independent, per the s33 design's single-zone-domain rationale.

### D4. Truthful log lines — **picked**

- Flag off, no zones: `no ${marker} zones present — append-on-missing not enabled for this domain; add the zone manually or set append_on_missing in propagation-map.json`.
- Flag on, anchor unresolvable: `no ${marker} zones present and anchor ${anchorMarker} not found — skipped (no placement derived)`.
- Flag on, append planned (dry-run): `[dry-run] would append N zone(s) to ${variantLabel} (after ${anchorMarker} zone / at end-of-file)`.
- Flag on, appended (apply): `✅ appended N zone(s) to ${variantLabel}`.
The string `will inject on --apply` is deleted from the codebase (AC-6 greps for its absence).

### D5. `constitution-context-pr` is the pilot enablement — **picked**

It is the domain whose bootstrap motivated the ticket, its anchor (COMMON-CONSTITUTION) exists in every current target, and its zone already exists everywhere — so enabling the flag produces zero live diff while the mechanism ships fully tested. `constitution-context`, `governance-agents`, and `variant-context` stay flag-off; their placement policy is decided when a real bootstrap need appears. Rejected: enabling on all domains now (violates the non-goal; untested placement choices).

### D6. Generator row rules — **picked, amended by PM ruling (Amendment 1, §14)**

- R1-rule: a root registry row with `normalizeLayer(layer) != "L0"` (i.e. `L0+L1`, `L0+L1+L2`, `common`) is mirrored **byte-for-byte**, all columns including the annotation.
- R2-rule: the generated span contains **no L0-layer row**. Root rows with layer `L0`/`L0-only` are excluded — and so are the mirror's 81 legacy L0 rows (shared root rows whose files have no template-tree copy; see §1.2): the generator's input is the root registry plus the template tree, and legacy rows are not derivable from either. They are deleted by the one-time normalization.
- R3-rule: a `.ts` file under `templates/common/scripts/` (recursive, keys relative to that dir, `_`-prefixed basenames excluded) with no root registry row gets a synthesized row `` | `<key>` | L0 | <@version> | active | — | — | common | — | ``; version comes from the file's `// @version` header; unparseable → hard error.
- R4-rule (canonical ordering — replaces the original reproduction rule): the generator emits its canonical order — surviving R1 rows keep root file order; the R3 group is generated as a sorted block inserted before the first R1 row whose key is lexicographically greater than the group's keys (append at end if none). This is a deterministic definition, not a reproduction of today's hand-maintained layout: the resulting 3 ordering corrections (plus the 2 lockstep row refreshes of §14.2) are part of the accepted normalization diff.
- R5-rule (one-time normalization, PM ruling Option (b)): the first run deletes the 81 legacy L0 rows and applies the 3 ordering corrections and 2 lockstep row refreshes (~86-line diff, reviewed and accepted in this PR); every subsequent run is byte-stable. Rationale: mirrors list what the tier delivers (the SKILLS.md seed-cleanup principle — registries list what's delivered). The 81 rows serve nobody: workspace developers read root SCRIPTS.md, delivered projects receive the already-filtered file (the scaffold log's `removed 81` proves the filter runs), and the rows mislead template-tree readers into looking for absent files.

Rationale: R1–R3 are the 2026-09-24 alignment session's conventions, observed and now pinned. Rejected alternatives (Amendment 1 re-adjudicated): reproducing the legacy rows byte-for-byte (impossible — not derivable from the builder's inputs; faithful implementation forced either generator-side hard-coding of an L0 row table or the normalization); preserving legacy rows via a hand-maintained overlay (a second registry to drift); lexicographic normalization of the whole table (a much larger first-run diff for zero functional gain).

### D7. Generator placement: standalone script + dev-sync Step 2.6 + Check B projection arm — **picked**

- Standalone `scripts/generate-scripts-mirror.ts` (L0), pure builder exported for reuse, CLI dispatch under `import.meta.main` (house import-safe pattern). It mirrors the `generate-scripts-readme.ts` Step 2.5 wiring shape.
- dev-sync Step 2.6 runs it in write mode on every sync, so drift cannot land in a `/sync` commit (auto-heal at the point where README.md is already regenerated).
- `lifecycle-sync-audit.ts` Check B gains the projection-comparison arm (imports the builder; no logic duplication), catching out-of-band hand edits between syncs. Check B's existing version/file checks stay as defense in depth; the generator makes version drift structurally impossible at the source.
- Rejected: a propagation-map domain (the mirror is a layer-filtered projection, not a byte copy — the copy engine would need a new mode, coupling two engines for no gain); enforcement inside `verify-scripts --check-drift` (that flag answers a different question: package.json aliases vs files); running the generator from `propagate-to-templates` (wrong direction — propagate copies L0→L1 byte-identical files; this projection re-renders).

### D8. `.agents/commands` ruling: L0-resident by design (option a) — **picked, by evidence**

The evidence supports "active Antigravity workspace command surface", not "vestigial copy":
1. Deliberate creation as the WS1 M9/M10 Antigravity parity deliverable (2026-07-11), not drift.
2. Active maintenance: same-commit lockstep updates with the `.claude`/`.gemini` root commands as recently as 2026-08-04; `sync.md` is byte-identical to the `.claude` copy today.
3. Adapted content: 4 of 7 files are Antigravity-specific (platform prose or a skill-shim form) — a 1:1 mirror contract is factually wrong for this surface.
4. The consumer is the Antigravity CLI reading the workspace root; the workspace root is exactly where the operator runs Antigravity. No propagation is needed for that consumer to work.
5. Option (c) (govern via an `agents-commands` propagation domain) is rejected: it would either overwrite the 4 adapted files with `.claude` content (wrong) or require a new per-file adaptation contract (new machinery for a surface with no L1 demand — `templates/common/.agents/` has never carried commands). Option (b) (retire) is rejected: the surface is maintained and consumed.
Consequences: documentation (R24–R25) replaces machinery; the 5 recorded exclusions become permanent, cited to this spec; `gateguard.md` has no `.agents` copy — recorded as intentional (its skip-marker class), not an action item.

### D9. Test strategy: pure helper unit tests + real-tree CLI integration tests — **picked**

The append engine's placement/pairing/idempotency logic is extracted into an import-safe pure helper in `scripts/helpers/markers.ts` (the `managed-block-merge` precedent: extract the core, keep the CLI thin), because `runMarkerRewrite` pins paths to the real workspace root and cannot run against temp fixtures. Unit tests import the helper directly. CLI tests (`tests/marker-rewrite.test.ts` spawn pattern) assert current-tree invariants: `Would append: 0`, no misleading message, corrected flag-off wording. The generator is born import-safe with the same split: pure builder unit-tested with in-memory strings and a temp fixture tree; CLI `--check` tested against the real tree.

## 7. Verification plan

### 7.1 T-20260924-006

- **Before evidence (capture first)**: `bun scripts/propagate-to-templates.ts --marker-rewrite --domain constitution-context-pr --dry-run` output shows the current in-sync state; grep confirms `will inject on --apply` exists in the pre-change source.
- Unit (new `tests/unit/marker-append.test.ts` over the pure helper): AC-2, AC-3, AC-4, AC-5, plus anchor-is-LAST-zone semantics and source-order block integrity.
- Integration (extend `tests/marker-rewrite.test.ts`): AC-1, AC-6 (real-tree dry-run), plus a source-level assertion that the misleading string is gone.
- Apply-path proof: in a scratch checkout (not the workspace), delete the COMMON-CONSTITUTION-PR zone from `templates/common/docs/context.md`, run `--marker-rewrite --domain constitution-context-pr --apply`, verify the zone reappears byte-identical to the pre-deletion block (git diff clean), then verify a second dry-run reports 0/0. Attach before/after diffs to the PR.

### 7.2 T-20260924-001

- **Before evidence**: the 2026-09-24 incident entry (memory/2026-09-24.md, 13-row lag) and today's clean-but-unenforced state (`lifecycle-sync-audit` passes while nothing prevents recurrence).
- Normalization + stability: AC-8 — first-run diff reviewed (81 legacy deletions + 3 ordering relocations + 2 lockstep refreshes only; no other surviving-row content change); second run `git diff --exit-code` clean.
- Idempotency: AC-9 (double run).
- Rule coverage: AC-10 (unit tests over the pure builder).
- Drift detection: AC-11 (`--check` on a fixture-drifted mirror), AC-12 (Check B error + fix hint on induced drift; clean when in sync). Induced-drift method for the live check: temporarily hand-edit one mirror row in the working tree, run `--check` and `lifecycle-sync-audit`, capture the failures, then `git checkout -- templates/common/scripts/SCRIPTS.md`.
- Pipeline wiring: AC-13 (Step 2.6 hard-exit behavior inspected; full dev-sync run regenerates nothing on a clean tree).

### 7.3 T-20260925-003

- Ruling evidence is §1.2 of this document (provenance commit, lockstep commits, content diff census, consumer analysis).
- After evidence: AC-14 (AGENTS.md prose present, skill note present, ticket `done` with result, exclusion comments cite this spec).

### 7.4 Full battery

`bun test`; `bun scripts/validate-templates.ts`; `bun scripts/audit.ts`; `bun scripts/lifecycle-sync-audit.ts`; `tsc --noEmit` (Step 3.95b scope); dev-sync Steps 4.55 domains report 0 would-overwrite / 0 would-append; `/sync` pipeline end-to-end on the implementation PR.

## 8. Registry cascade

| Artifact | Change | Layer | Cascade |
|---|---|---|---|
| `scripts/propagate-to-templates.ts` | 2.17.0 → 2.18.0 (append path, truthful logs, `Would append` counter) | L0-only | No L1 mirror; registry row + VERSION_MANIFEST + Guide note |
| `scripts/helpers/markers.ts` | 1.2.0 → 1.3.0 (new pure append-placement helper) | L0+L1 | L1 file copy in lockstep; registry rows both sides |
| `scripts/generate-scripts-mirror.ts` | NEW 1.0.0 | L0-only | New registry row + VERSION_MANIFEST row + Guide entry; **must not** appear in the L1 mirror (R2-rule proves itself) |
| `scripts/dev-sync.ts` | 1.17.0 → 1.18.0 (Step 2.6, Step 4.55 regex) | L0+L1 | L1 file copy in lockstep; registry rows both sides |
| `scripts/lifecycle-sync-audit.ts` | 1.15.0 → 1.16.0 (Check B projection arm) | L0+L1 | Registry rows both sides (lockstep) + L1 file copy + VERSION_MANIFEST |
| `scripts/propagation-map.json` | `constitution-context-pr` gains `append_on_missing` + `insert_after_marker` | L0-only | Data-only; no registry row |
| `AGENTS.md` §6 | `.agents/commands` prose block (R24) | L0-only | Not in the COMMON-AGENTS zone; no variant injection |
| `.agents/skills/platform-command-lifecycle-manager/SKILL.md` + platform mirrors | Lockstep note (R25) | L0 SSOT | `sync-skills.ts` distributes; bump frontmatter version per skill lifecycle |
| `docs/VERSION_MANIFEST.md` | Rows per table above | — | Standard |
| `CHANGELOG.md` | `[Unreleased]` entry | — | Standard |
| Tickets T-20260924-006 / -001 / T-20260925-003 | `move <id> done --result …` | — | In the implementation PR |
| `sync-skills.ts` | untouched | — | No platform-surface change (D8) |

## 9. Implementation brief (ordered phases, for automation-engineer)

**Phase 1 — T-006 engine (marker append).**
1. Add `appendMissingZones()` (name flexible) pure helper to `scripts/helpers/markers.ts`: inputs `(variantContent, existingZones, sourceSections, marker, { anchorMarker?: string })` → `{ content, appended, placement: 'after-anchor' | 'eof' | 'none' }`. Bump markers.ts to 1.3.0.
2. In `runMarkerRewrite`: read the two new domain fields; when `append_on_missing` and `existingZones.length < sourceSections.length`, call the helper, splice, mark `fileOverwritten`, log per D4; replace the misleading message per D4; add the `Would append: N` summary counter. Bump to 2.18.0.
3. `propagation-map.json`: enable the flag on `constitution-context-pr` per R13.
4. Tests: new `tests/unit/marker-append.test.ts`; extend `tests/marker-rewrite.test.ts` (AC-1..AC-7).
5. Update registry rows (both sides per cascade), VERSION_MANIFEST, CHANGELOG.

**Phase 2 — T-001 generator.**
1. Create `scripts/generate-scripts-mirror.ts`: export `buildMirrorRegistrySpan(rootContent, templateScriptsDir)` (pure, deterministic per §6-D6); CLI default = write, `--check` = compare+exit code per R19; hard error on missing `// @version`.
2. dev-sync Step 2.6 (write mode, Step 2.5 idiom) + Step 4.55 `Would append` parsing; bump dev-sync 1.18.0.
3. `lifecycle-sync-audit.ts` Check B projection arm importing the builder; bump 1.16.0.
4. Tests: new `tests/unit/generate-scripts-mirror.test.ts`; extend `tests/unit/lifecycle-sync-checks.test.ts` (AC-8..AC-13).
5. Registry rows (generator is L0-only — verify it does NOT appear in the generated mirror), VERSION_MANIFEST, CHANGELOG.

**Phase 3 — T-003 adjudication landing.**
1. AGENTS.md §6 prose block (dispatch docs-writer per PM gateway; architect-approved content in R24).
2. `platform-command-lifecycle-manager` SKILL.md note + version bump; run `bun scripts/sync-skills.ts`.
3. Update the 5 exclusion comments to cite this spec + ticket.
4. `bun scripts/ticket.ts move T-20260925-003 done --result "…"` (and -006/-001 after their phases pass QA).

**Phase 4 — verification + `/sync`.** Run §7.4; attach per-ticket before/after evidence to the PR; `/sync "feat(propagation): marker append-on-missing, L1 SCRIPTS.md mirror generator, .agents/commands adjudication"`.

**Expected behaviors (summary).** Existing domains: unchanged output except the corrected skip message. Opted-in domain with a missing zone: dry-run plans, apply appends at the anchor, second dry-run is clean. Generator: first run lands the reviewed one-time normalization (81 legacy L0 deletions + 3 ordering corrections + 2 lockstep refreshes; post-PR mirror = 128 rows == 128 template files); second and later runs are no-op diffs; any hand edit to the mirror registry fails `--check` and Check B with the generator named as the fix. `new-project.ts` / `create-l3-scaffold.ts` SCRIPTS.md filters stay — near-no-ops post-normalization, retained as defense-in-depth on the delivered file.

## 10. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no `.claude/` surface changes | N/A |
| Antigravity (GEMINI.md) | Documentation only — the `.agents/commands` ruling is an Antigravity-surface decision, recorded in AGENTS.md §6 prose and the `platform-command-lifecycle-manager` skill; GEMINI.md itself unchanged | `AGENTS.md`, `.agents/skills/platform-command-lifecycle-manager/SKILL.md` (+ platform mirrors via sync-skills) |
| templates/common | Yes — lockstep L1 copies of `helpers/markers.ts` and `dev-sync.ts`; generated refresh of `templates/common/scripts/SCRIPTS.md` registry (byte-identical on day one) | `templates/common/scripts/helpers/markers.ts`, `templates/common/scripts/dev-sync.ts`, `templates/common/scripts/SCRIPTS.md` |

> Antigravity impact is declared above (documentation + skill note), not "None".

## 11. Risks

- **Anchor marker renames** silently break placement (fail-safe: skip + log). Mitigation: PM-03-style validation could later assert anchors resolve in ≥1 target; out of scope here, noted for the backlog.
- **Byte-stable bootstrap depends on the accepted normalization** (R5-rule, Amendment 1): if the mirror is hand-edited again before this lands, the first-run diff shifts; the review-in-PR AC then applies to the pre-PR tree state, and second-run stability always applies to the post-PR tree.
- **One-time diff is deliberate, not accidental**: the ~86-line normalization (81 legacy L0 deletions + 3 relocations + 2 lockstep refreshes) is reviewed in this PR as a design decision. Review criterion: the diff contains ONLY those deletions, relocations, and refreshes — any other surviving-row content change is a generator bug (AC-8).
- **Delivery-filter interplay**: `new-project.ts:1461` and `create-l3-scaffold.ts:342` keep their SCRIPTS.md L0 filters. Post-normalization they remove 0 rows on a current template; they remain as defense-in-depth for out-of-date templates and hand-maintained forks.
- **Generator vs manual prose edits**: the generated span is fenced by the `| script |` header → next `## ` span; edits to prose sections are unaffected. An edit *inside* the span now fails Check B by design (that is the point).
- **Step 4.55 counter coupling**: a refactor renaming `Would append:` would silently degrade Step 4.55 to the "no drift counter" WARN branch, which is visible, not silent.

## 12. Accessibility exemption (ADR-0065)

Exempt. This design changes build tooling, a propagation engine, and governance documentation. It ships no user-facing UI, CLI output beyond existing log lines, or document layout; no interaction areas are affected.

## 13. Preview-verification exemption (ADR-0070)

Exempt. No rendered UI, HTML, or document-preview artifact is produced. Verification is command-exit and byte-comparison based (§7).

## 14. Amendment 1 (2026-09-25) — PM ruling during Phase 2: one-time mirror normalization accepted

### 14.1 Event

Phase 2 (T-001) implementation halted at the Design Gate hard constraint: the engineer could not implement D6 as originally written. The original D6 claimed the empirical rules reproduced today's mirror byte-for-byte on first run. The engineer's evidence (verified at 8a2da508) disproved two claims: 81 of the 183 shared mirror rows carry root layer `L0` and have no file under `templates/common/scripts/` (not derivable from `buildMirrorRegistrySpan`'s inputs), and the original ordering claim fails for 5 rows (final QA-measured composition of those 5 changed rows: 3 ordering corrections + 2 same-commit lockstep refreshes — see §14.2). Faithful implementation as written produced either an impossible generator or a ~86-line first-run diff.

### 14.2 Verified facts (architect re-verification)

- Mirror registry: 209 rows = 102 non-L0 shared (`L0+L1`) + 26 mirror-only (`handbook/*`, `tests/*`) + **81 shared rows with layer `L0`**; all 81 lack a template-tree file (samples: `propagate-to-templates.ts`, `check-upgrade-coverage.ts`, `create-l3-scaffold.ts`, `generate-scripts-readme.ts`, `lib/managed-block-merge.ts`). The original §1.2 scan checked only mirror-only rows against the template tree and missed this class; corrected in §1.2.
- Corroborating producer-side fact: the delivery filter already strips exactly this class — `new-project.ts:1461` and `create-l3-scaffold.ts:342` print `📝 Filtered SCRIPTS.md: removed ${removed} L0-only registry entries`; the owner's 2026-09-24 scaffold log recorded `removed 81`. The L1 mirror's L0 rows are dead weight: never delivered, invisible to Check B, and misleading in the template tree.
- Post-normalization invariant (the design target): mirror rows = 128, template `.ts` files = 128, 1:1, zero uncovered — the registry lists what the tier delivers (the SKILLS.md seed-cleanup principle).
- QA-measured composition of the normalization diff: 81 legacy-row deletions + **3 ordering corrections** + **2 same-commit lockstep row refreshes** (the dev-sync 1.18.0 and lifecycle-sync-audit 1.16.0 rows — byte-verbatim from rows edited in this change set; lifecycle-sync-audit is layer `L0+L1`, so its mirror row and file copy ride the lockstep rule).

### 14.3 Ruling (PM, Option (b)) — adopted

Pure-function generator; accept the one-time normalization diff in this PR. Amendments: R16, R18, AC-8, AC-10, AC-12, D6 (R4-rule → canonical order; new R5-rule), §7.2, §9, §11, and §1.2 of this document are updated accordingly. Cascade unchanged (dev-sync 1.18.0 slot, lifecycle-sync-audit 1.16.0, generate-scripts-mirror NEW 1.0.0). The engineer is cleared to complete Phase 2 against the amended contract; second-run byte-stability (not first-run no-op) is the acceptance bar, and the first-run diff is a reviewed PR artifact bounded by AC-8's content criterion.
