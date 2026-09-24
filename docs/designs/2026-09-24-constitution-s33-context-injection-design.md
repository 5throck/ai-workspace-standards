# Design: Pipeline-Enforced §3.3 Injection into the L1 context.md Mirror

| Field | Value |
|-------|-------|
| Spec ID | `2026-09-24-constitution-s33-context-injection-design` |
| Date | 2026-09-24 |
| Author | Template Architect (Design Gate, ADR-0074) |
| Status | draft (implementation has not happened) |
| Related ADRs | ADR-0038 (sequential branch rule), ADR-0062 (marker propagation), ADR-0081 (delivery-pipeline hardening), ADR-0055 (WARN-first playbook) |
| Related tickets | T-20260918-001..004 (ADR-0081 follow-ups), T-20260924-001 (sibling — SCRIPTS.md mirror projection, same manual-mirror-rot class) |
| Amendments | **Amendment 2** (2026-09-24, §13): scope extension — dev-sync scoped-staging `git add` deletion-handling fix rides in the same change set and the same 1.17.0 version bump. (First amendment recorded in this document; numbering follows the change-set sequence per PM directive.) |

---

## 1. Background

CONSTITUTION.md §3.3 defines the Sequential Branch Dependency Rule: merge a prior open PR before branching for the next task, unless the plan explicitly justifies parallel branches. The canonical text lives in `docs/constitution/03-pr-workflow.md` §3.3 (lines 59-72); CONSTITUTION.md line 118 carries the §3 summary sentence with an `[ADR-0081](docs/adr/0081-delivery-pipeline-hardening.md)` markdown link and the ticket range T-20260918-001..004.

The L1 mirror `templates/common/docs/context.md` carries the rule today only as **hand-maintained prose**, in two scattered presentations:

1. **Line ~448** — a blockquote "Conflicted-PR recovery (ADR-0081)" inside `## Git / PR Workflow` (heading at line 427). Current, ADR-0081-era content. It references §3.3 and `/sync --conclude-merge`.
2. **Line ~554** — `### Sequential Branch Dependency & Pipeline Integrity (ADR-0038)` under `## Platform Hooks & Governance Enforcement` (heading at line 518). It carries the legacy ADR-0038 label and mixes the "Sequential PR Merge Rule" bullet with an unrelated "Pluggable Variant Audit Hook" bullet. The section closes with the house link-convention note ("not linked here since this file's relative path to the workspace root differs across project depths (L2 vs. L3)...", line 559) and sits directly above the version footer `*context.md version: 2.9 — ...*` (line 561).

Because neither presentation is pipeline-managed, the rule can silently drift or rot. It already has diverged in labeling (ADR-0038 vs. the ADR-0081-era hardening) and duplicates content that the propagation engine already manages elsewhere: the "Pluggable Variant Audit Hook" text also exists as a pipeline-injected `COMMON-CONSTITUTION` zone in the same file (context.md ~302-305, sourced from CONSTITUTION.md ~663-666), and the core-script-immutability framing also ships via the `COMMON-AGENTS` zone of AGENTS.md.

This is the same **manual-mirror-rot** failure class as sibling ticket T-20260924-001 (the L1 SCRIPTS.md registry mirror accumulated a 13-row annotation-prose lag because no pipeline writes it). The systemic fix is the same in shape: move hand-maintained duplication into a propagation-managed zone.

All 12 scaffolded projects (`Projects/co-*/docs/context.md`) carry delivered copies of the two hand-maintained presentations. Refreshing them is upgrade-project's job and is explicitly out of scope here (Non-goal N4).

### 1.1 Verified mechanism facts (design constraints)

| # | Fact | Evidence |
|---|------|----------|
| F1 | `propagation-map.json` domain `constitution-context` is `marker-inject`, source `CONSTITUTION.md`, target `docs/context.md`, marker `COMMON-CONSTITUTION`, `target_variants: ["common"]`, `scrub_constitution_refs: true` | `scripts/propagation-map.json:225-236` |
| F2 | The marker-rewrite engine iterates **all** marker-inject domains from the map (data-driven) and explicitly supports several domains targeting one file ("a target file can host zones from several domains — context.md carries both COMMON-CONSTITUTION and COMMON-CONTEXT"); zone filtering is per-marker | `scripts/propagate-to-templates.ts:1521-1526, 1577-1581` |
| F3 | Zone pairing is **positional**: "k-th zone of this marker ↔ k-th source zone", rewritten bottom-up | `scripts/propagate-to-templates.ts:1597` |
| F4 | The engine **only rewrites existing zones**. A target with zero zones of the marker is skipped ("no ... zones present (will inject on --apply)") — the L0→L1 path never appends. (Append-on-missing exists only in `publishDocs`/`--docs`, the L1→L2 direction.) | `scripts/propagate-to-templates.ts:1503-1506 (docblock), 1582-1586` |
| F5 | Existing `COMMON-CONSTITUTION` pairs: source CONSTITUTION.md zones at ~503-511 (Schema Governance) and ~608-672 (Language Policy) map by order onto target context.md zones at ~235-243 and ~245-309 | both files |
| F6 | Scrub rules A-1..A-8 handle only `CONSTITUTION.md` and `docs/constitution/...` references. A **docs/adr/ markdown link is NOT scrubbed by any rule** and would land verbatim in context.md — a workspace-root-relative link that 404s inside L2/L3 projects | `scripts/lib/constitution-scrub.ts:126-174` |
| F7 | A-5b rewrites any `docs/constitution/...` link target to `](docs/context.md)` keeping link text; A-6 then rewrites it to `](context.md)` for context.md targets. A-7 rewrites plain-text part-file mentions to `docs/context.md`. Both produce misleading self-references ("full details → context.md") | `scripts/lib/constitution-scrub.ts:144-174` |
| F8 | The L0 Leakage check scans every `templates/**/*.md` line for `CONSTITUTION\.md\|docs[/\\]constitution[/\\]` (occurrence-scoped, intentional-duplicate and policy-self-description exemptions). It has no per-domain knowledge | `scripts/audit.ts:2414-2450`, `scripts/helpers/l0-ref-policy.ts:35, 75-83` |
| F9 | The shared marker parser accepts any `COMMON-<NAME>` (`/<!--\s*(COMMON-[^:]+):(START\|END)\s*-->/`). `COMMON-CONSTITUTION-PR` parses, and cannot collide with `COMMON-CONSTITUTION` because all matchers use the literal `:START`/`:END` suffix | `scripts/helpers/markers.ts:132` |
| F10 | House convention: context.md references ADRs as plain text, never markdown links to workspace docs (relative path differs across project depths). Canonical statement at context.md line 559; line 516 back-references it ("for the same relative-path reason noted above") | `templates/common/docs/context.md:516, 559` |

### 1.2 Parity-derivation finding (the CRITICAL verification)

**Verdict: mixed — mostly data-driven, with exactly one hardcoded consumer that must change.**

**Data-driven (no .ts change needed):**

- The propagation engine itself — `runMarkerRewrite` loops over `Object.entries(map.domains)` filtered on `mode === 'marker-inject'` (`scripts/propagate-to-templates.ts:1521-1526`). A new domain entry is picked up with zero code change (F2).
- validate-templates.ts **PM-01** (map schema validation) — generic over all domains (`scripts/validate-templates.ts:4333-4352`; schema in `scripts/lib/propagation-map-schema.ts:65-115` requires only `source_file`, `marker`, non-empty `target_variants` for marker-inject mode; marker naming is unconstrained).
- validate-templates.ts **PM-02** (marker-zone-parity) — iterates every marker-inject domain from the map (`scripts/validate-templates.ts:4366-4449`). It only checks `co-*` variant targets; the `common` target is skipped by design (`if (!variant.startsWith('co-')) continue;`, ~4437), so a new `common`-targeted domain adds no PM-02 obligations.
- validate-templates.ts **PM-03** (propagation target derivation) — classifies domains **structurally**, never by name: a fixed `target_file` like `docs/context.md` makes the domain "fixed-target", validated only against its own declared shape (listed target = existing template dir carrying the resolved file) (`scripts/validate-templates.ts:4474-4560`; `scripts/lib/propagation-map-schema.ts:171` `markerInjectTargetScope`). The v1.31.0 header (validate-templates.ts:95-106) documents this design explicitly.
- audit.ts **L0 Leakage** — a generic whole-tree scan with no domain awareness (F8). Compliance comes from the scrub transform, not from registration.

**Hardcoded (a .ts change IS required):**

- **`scripts/dev-sync.ts:693`** — the Step 4.55 sync-time zone-drift check (WARN stage, per ADR-0055 WARN-first playbook) loops over a **literal list**: `for (const domain of ['constitution-context', 'variant-context'])`. A new domain is invisible to the only sync-time drift gate unless this list gains the new name. Evidence: `scripts/dev-sync.ts:683-711` (comment block 683-692 names the pilot domains as the reason for the hardcoded list).

**Consequences of the dev-sync.ts change (cascade):**

- dev-sync.ts is a registered L0+L1 script (`scripts/SCRIPTS.md:91`, version 1.16.0). The change bumps it to 1.17.0: script docblock/header version + the SCRIPTS.md row, aligned in the **same commit** in both `scripts/SCRIPTS.md` and the hand-maintained L1 mirror `templates/common/scripts/SCRIPTS.md` (enforced by the SCRIPTS.md registry version parity check, validate-templates.ts:1424-1452, T-20260915-001). Note: T-20260924-001 proposes automating exactly this mirror projection; until it lands, the manual same-commit alignment stands.
- Typecheck gate: dev-sync runs `bun scripts/typecheck.ts` (`tsc --noEmit` over scripts/ vs a recorded baseline) at scripts/dev-sync.ts:519-522. The edited dev-sync.ts must pass it; refresh the typecheck baseline if the checker flags the file.
- L0↔L1 script byte-parity (validate-templates l0-l1-script-parity, ~1397-1417, scrub-normalized) applies — the L1 copy of dev-sync.ts arrives via the `scripts` propagation domain, so only the L0 file is edited.
- Alternative considered and **rejected** for now: deriving the Step 4.55 list from `map.domains` (data-driven refactor). Rejected because a naive derivation would also pull in `governance-agents` (a `--docs`-mode L1→L2 domain over 13 variants), changing check scope and /sync runtime beyond this design's scope. The one-line list extension is the minimal, behavior-preserving change; the refactor can ride a future hardening pass.

---

## 2. Goals

- G1. §3.3 reaches `templates/common/docs/context.md` through the marker-injection pipeline (single source, pipeline-enforced, drift-checked).
- G2. The two hand-maintained presentations are unified into one pipeline-managed zone plus the retained recovery blockquote.
- G3. The rule stays visible and correct at L0, L1, and inside L2/L3 projects when delivered.
- G4. All existing gates pass: audit.ts (incl. L0 Leakage), validate-templates.ts (PM-01/02/03, script parity, registry parity), `--check-drift`, typecheck.

## 3. Non-goals

- N1. No engine change to append missing zones in `runMarkerRewrite` (the one-time zone bootstrap is manual; see D5).
- N2. No refactor of dev-sync.ts Step 4.55 to full map derivation (documented in §1.2; future work).
- N3. No change to `variant-context` (`COMMON-CONTEXT`) zones — the new zone lives in the L1 file outside any COMMON-CONTEXT zone, so variant `docs/<variant>.context.md` files are untouched.
- N4. No refresh of the 12 delivered project copies (`Projects/co-*/docs/context.md`) — they update via the upgrade-project flow in a separate task.
- N5. No change to qa-gate.ts — its whole-file scrub comparison is file-pair based and no file pair is added or removed.

---

## 4. Requirements (ASD-STE100, ADR-0079)

- R1. CONSTITUTION.md §3 carries the §3.3 rule in exactly one `COMMON-CONSTITUTION-PR` marker zone.
- R2. The zone text is layer-neutral: plain-text ADR and ticket references only. It contains no markdown links and no `docs/constitution/` paths.
- R3. The zone text passes `scrubConstitutionRefs` unchanged (already scrub-neutral, idempotent).
- R4. `propagation-map.json` declares a new marker-inject domain `constitution-context-pr` with marker `COMMON-CONSTITUTION-PR`, target `docs/context.md`, `target_variants: ["common"]`, `scrub_constitution_refs: true`.
- R5. `templates/common/docs/context.md` hosts exactly one `COMMON-CONSTITUTION-PR` zone inside `## Git / PR Workflow`, after the ADR-0081 recovery blockquote.
- R6. The legacy `### Sequential Branch Dependency & Pipeline Integrity (ADR-0038)` heading and both of its bullets are removed from context.md.
- R7. The link-convention note at context.md line 559 stays in place, because line 516 back-references it.
- R8. The context.md version footer is bumped to 2.10 and keeps the `*context.md version: X.Y — ...*` shape.
- R9. dev-sync.ts Step 4.55 checks the new domain: the literal list at line 693 gains `'constitution-context-pr'`.
- R10. The dev-sync.ts change bumps the script to 1.17.0 in its header and in both SCRIPTS.md files in the same commit.
- R11. After `--marker-rewrite --domain constitution-context-pr`, the report shows 1 zone, 0 would-overwrite.
- R12. The CRLF-normalized target zone equals the scrubbed source zone byte for byte.

## 5. Acceptance criteria

- AC1. `bun scripts/propagate-to-templates.ts --marker-rewrite --domain constitution-context-pr` reports 1 zone in sync and exits 0. (R4, R5, R11)
- AC2. A sha256 comparison of the CRLF-normalized target zone and the scrubbed source zone returns equal hashes. (R3, R12)
- AC3. `grep -n "Sequential PR Merge Rule" templates/common/docs/context.md` returns nothing. (R6)
- AC4. `templates/common/docs/context.md` contains exactly two mentions of the branch rule: the injected zone and the ADR-0081 recovery blockquote. (G2, R5, R6)
- AC5. `bun scripts/propagate-to-templates.ts --check-drift` exits 0 with 0 unexpected drift. (G4)
- AC6. `bun scripts/validate-templates.ts` passes PM-01, PM-02, PM-03, l0-l1-script-parity, and SCRIPTS.md registry version parity. (G4, R10)
- AC7. `bun scripts/audit.ts` passes fully, including the L0 Leakage check. (G4, R2)
- AC8. `bun scripts/typecheck.ts` exits 0. (R9)
- AC9. The context.md footer reads `*context.md version: 2.10 — ...*`. (R8)
- AC10. CONSTITUTION.md §3 contains the `COMMON-CONSTITUTION-PR` markers exactly once each. (R1)

---

## 6. Design decisions and trade-offs

### D1. New marker domain, not a third zone in `COMMON-CONSTITUTION` — **picked**

- **Option A (picked): new domain `constitution-context-pr`, marker `COMMON-CONSTITUTION-PR`.** Immune to positional pairing (F3): the existing two zone pairs are untouched because pairing is scoped per-marker (F2). The marker name parses and cannot collide (F9). Multiple domains per target file are an explicitly supported, documented pattern (F2).
- **Option B (rejected): third source zone in the existing domain.** A new source zone at §3 (~line 118) would precede the existing zones at 503/608 in document order. Positional pairing would then map the PR-rule slice onto the target's first zone (Schema Governance at context.md ~235) and shift every other pair — clobbering delivered content on the next `--apply`. This failure mode is structural, not hypothetical.
- **Option C (rejected): merge the two existing presentations into one bigger hand-maintained section.** Keeps the rot class; violates G1.

### D2. Slice content: a layer-neutral §3.3 rendering, moved out of the summary paragraph — **picked**

The source change in CONSTITUTION.md §3: the last two sentences of the summary paragraph (line 118 — the "Sequential Branch Dependency Rule (...)" sentence and the ADR-0081/tickets sentence) move out of the paragraph into a standalone marked paragraph directly after it. Markers are line-based; a zone cannot wrap mid-paragraph (F5 shows both existing zones are self-contained blocks).

Proposed source zone (STE-conformant; final wording belongs to docs-writer within these constraints):

```markdown
<!-- COMMON-CONSTITUTION-PR:START -->
#### Sequential Branch Dependency Rule (§3.3)

Merge a previously opened PR before branching for the next task. Run parallel
PR branches only when the execution plan explicitly justifies each PR as safe
to leave open. `dev-sync.ts` touches shared pipeline files on every commit
(`CHANGELOG.md`, `memory/YYYY-MM-DD.md`, `docs/VERSION_MANIFEST.md`, generated
READMEs). Parallel unmerged branches therefore conflict by default. A conflict
may still land despite this rule. Recover per ADR-0081: conclude through the
gates with `/sync --conclude-merge`. Rule origin: ADR-0038. Hardening decisions
and follow-up tickets: ADR-0081, T-20260918-001..004.
<!-- COMMON-CONSTITUTION-PR:END -->
```

Scrub audit of this text against rules A-1..A-8 (`scripts/lib/constitution-scrub.ts:126-174`): no `CONSTITUTION.md` (A-1..A-4 no-op), no `docs/constitution/` paths (A-5/A-5b/A-7/A-8 no-op), no markdown links at all (A-2/A-3/A-6 no-op). The text is already scrub-neutral and idempotent, and passes the L0 Leakage pattern trivially (F8). Plain-text ADR/ticket references follow the house convention (F10) and cannot 404 inside projects (F6).

- **The details-doc pointer stays out of the zone.** A `docs/constitution/03-pr-workflow.md` link inside the zone would be rewritten by A-5b + A-6 into a link to context.md itself, and a plain-text mention would be rewritten by A-7 to `docs/context.md` — both produce "full details: context.md §3.3", a misleading self-reference (F7). At L0, §3.3 resolves through the section's existing "Full details:" link at the top of §3, so nothing is lost.
- **L0 trade-off accepted:** the ADR-0081 hyperlink disappears from the §3 summary paragraph (the zone carries the plain-text reference instead). The full hyperlink remains in `docs/constitution/03-pr-workflow.md` §3.3 and in AGENTS.md §3.3's pointer. Rejected alternative: keep the linked sentence in the summary AND add the zone — this states the rule twice in the same section at L0 and invites re-divergence.
- **Exactly one source zone** for the new marker keeps PM-02's first-zone extraction correct and stays clear of the v2.15.1 multi-section guard in `replaceCommonSection`.

### D3. Target zone placement: inside `## Git / PR Workflow`, after the recovery blockquote — **picked**

The section (context.md line 427) is the rule's natural home; the ADR-0081 recovery blockquote (~448) directly precedes the injection point, so rule and recovery read as one unit. Rejected: placement under `## Platform Hooks & Governance Enforcement` — that section is about enforcement mechanics, and its legacy subsection is being removed (D4).

### D4. Unification: delete the legacy subsection; keep the recovery blockquote and the convention note — **picked**

- Remove the `### Sequential Branch Dependency & Pipeline Integrity (ADR-0038)` heading, the "Sequential PR Merge Rule" bullet (superseded verbatim by the injected zone), and the "Pluggable Variant Audit Hook" bullet. The bullet duplicates pipeline-managed content: the `COMMON-CONSTITUTION` zone "Pluggable Variant Audit Hook" already lands in context.md (~302-305) from CONSTITUTION.md ~663-666, and the core-script-immutability framing ships via the `COMMON-AGENTS` zone of AGENTS.md. No information is lost.
- Keep the ADR-0081 recovery blockquote (~448) as-is. It documents conflict *recovery*, which complements — not duplicates — the *rule* the zone now carries.
- Keep the link-convention note (line 559) exactly where it is, as the closing paragraph of `## Platform Hooks & Governance Enforcement`. Line 516 back-references it ("for the same relative-path reason noted above"); moving or deleting it orphans that back-reference (R7).
- Corrected section title question resolved by deletion: no retitled section is needed, because its only surviving content (the audit-hook bullet) already lives in a pipeline-managed zone.

### D5. One-time manual bootstrap of the target zone — **picked (manual insert, not engine change)**

`runMarkerRewrite` never appends a missing zone (F4). Two options:

- **Option A (picked): docs-writer inserts the zone once**, copying the source slice verbatim (it is scrub-neutral by construction), then `--marker-rewrite --dry-run` must report "in sync" — which is the byte-check (AC1/AC2). This matches established practice: the existing COMMON-CONSTITUTION zones were bootstrapped the same way (ADR-0062 era), and publishDocs' append-on-missing exists only in the L1→L2 direction.
- **Option B (rejected): teach `runMarkerRewrite` to append missing zones.** More robust long-term, but it changes engine semantics for every domain (append-position policy, heading context, idempotency) — a scope multiplier this design does not need. Recorded as a candidate follow-up ticket.

### D6. dev-sync.ts: one-line list extension, not a map-derived refactor — **picked**

Rationale and rejected alternative documented in §1.2. Version cascade: dev-sync 1.16.0 → 1.17.0, SCRIPTS.md rows aligned same-commit in L0 and L1, typecheck gate re-run.

### D7. Domain/marker naming — `constitution-context-pr` / `COMMON-CONSTITUTION-PR`

Follows the house `COMMON-<NAME>` marker pattern (F9) and the existing domain naming (`constitution-context`, `variant-context`). The `-pr` suffix scopes the namespace to the PR-workflow slice; future §3 slices (e.g. a commit-protection slice) would take their own `-<topic>` domains rather than growing this one, keeping one-zone-per-domain as the invariant that makes positional pairing trivially safe.

---

## 7. Verification plan

1. `bun scripts/propagate-to-templates.ts --marker-rewrite --domain constitution-context-pr` — expect: 1 zone, "in sync", 0 would-overwrite (AC1).
2. `bun scripts/propagate-to-templates.ts --marker-rewrite` (all domains) — expect 0 would-overwrite everywhere (no collateral drift).
3. `bun scripts/propagate-to-templates.ts --check-drift` — exit 0, 0 unexpected (AC5).
4. Byte-check (AC2): sha256 of CRLF-normalized target zone vs `scrubConstitutionRefs(sourceZone, 'CONSTITUTION.md', 'templates/common/docs/context.md')` — equal hashes. One-off bun snippet in `tests/.temp/` is acceptable per house rules.
5. `bun scripts/validate-templates.ts` — PM-01/02/03, l0-l1-script-parity, SCRIPTS registry parity PASS (AC6).
6. `bun scripts/audit.ts` — full pass including L0 Leakage (AC7).
7. `bun scripts/typecheck.ts` — exit 0 (AC8).
8. Manual grep checks for AC3, AC4, AC9, AC10.

---

## 8. Implementation brief (by owner)

**docs-writer (.md files):**
- CONSTITUTION.md §3: move the §3.3 + ADR-0081/tickets sentences out of the summary paragraph into the new `COMMON-CONSTITUTION-PR` zone per D2 (heading `#### Sequential Branch Dependency Rule (§3.3)`, plain-text refs only, no links, no docs/constitution/ paths).
- templates/common/docs/context.md: insert the identical zone content inside `## Git / PR Workflow` after the ADR-0081 recovery blockquote (one-time bootstrap, D5); delete the legacy `### Sequential Branch Dependency & Pipeline Integrity (ADR-0038)` heading and both bullets; keep the line-559 convention note and the recovery blockquote untouched; bump the footer to `*context.md version: 2.10 — Sequential Branch Dependency Rule now pipeline-injected (COMMON-CONSTITUTION-PR); legacy ADR-0038 subsection removed*`.

**automation-engineer (config + .ts):**
- scripts/propagation-map.json: add the `constitution-context-pr` domain per R4 (description + note citing this design and ADR-0062 lineage); bump map `version` 1.10.0 → 1.11.0; propagate the map's own L1 copy via the `propagation-map` domain.
- scripts/dev-sync.ts: extend the Step 4.55 list at line 693 with `'constitution-context-pr'`; bump the script version to 1.17.0 (docblock + change note); align the dev-sync row in `scripts/SCRIPTS.md` and `templates/common/scripts/SCRIPTS.md` in the same commit. Per Amendment 2 (§13), the same 1.17.0 change set also carries the scoped-staging `git add` deletion-handling fix (§13.3) and the regression tests (§13.4) — the v1.17.0 annotation and the SCRIPTS.md row description must cover both changes.
- Run the full verification plan (§7); file the follow-up ticket candidates (runMarkerRewrite append-on-missing; Step 4.55 map-derived refactor) if approved by PM.

## 9. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None beyond governance content (no .claude/ file changes) | N/A |
| Antigravity (GEMINI.md) | None — justified: context.md is platform-neutral governance content; no `.agents/`/`.gemini/` artifact carries marker zones, and no platform skill/command changes | N/A |
| templates/common | Propagation required — context.md zone bootstrap, propagation-map.json L1 copy, dev-sync.ts L1 copy, SCRIPTS.md L1 mirror | `templates/common/docs/context.md`, `templates/common/scripts/propagation-map.json`, `templates/common/scripts/dev-sync.ts`, `templates/common/scripts/SCRIPTS.md` |

## 10. Risks

- **Zone bootstrap mismatch**: if docs-writer's hand-inserted zone differs by a byte from the scrubbed source, step 4.55 reports a WARN and AC1/AC2 fail loudly — the failure mode is visible, not silent.
- **Future slice edits that reintroduce links**: no scrub rule covers docs/adr/ links (F6); the L0 Leakage check will not catch them. Mitigation: this design's constraints (R2), Design Gate review of future slice changes, and the AC2 byte-check.
- **SCRIPTS.md hand-alignment** remains error-prone until T-20260924-001 lands; the registry version parity check (validate-templates.ts:1424-1452) is the current backstop.

## 11. Accessibility exemption (ADR-0065)

Non-UI documentation-only change (Markdown governance content). No user-facing interface, interaction, or document rendering feature is affected. Exempt with this explicit statement per ADR-0065's backend/non-UI exemption.

## 12. Preview-verification exemption (ADR-0070)

No user-facing web/app UI is touched. Exempt with this explicit statement per ADR-0070's non-UI exemption. Verification is fully covered by the §7 gate battery instead.

---

## 13. Amendment 2 (2026-09-24) — dev-sync scoped-staging `git add` deletion handling

**Scope extension, PM-approved**: a delivery-blocking pipeline bug fix rides in the same change set as this spec's implementation and inside the same dev-sync **1.17.0** bump — extend the v1.17.0 annotation and the SCRIPTS.md row description to cover both changes; do **not** bump to 1.18.0. Registry status of this spec stays `implemented`.

### 13.1 Bug report (today's evidence)

- Symptom: `/sync` with `SYNC_SCOPED_STAGING=1` failed with `fatal: pathspec 'templates/co-consult/.claude/skills/documentation-writing/SKILL.md' did not match any files`.
- Root cause: the scoped-staging add step in `scripts/dev-sync.ts` (~1035-1041, the `git add -- ${[...committable].sort()}` call at ~1036) batches `committable = taskStaged ∪ pipelineOutputs` (`taskStaged` from `git diff --cached --name-only -z` at ~994-998; `pipelineOutputs` = S1∖S0). For a **staged deletion**, the path exists in neither the worktree nor the index — a plain pathspec `git add` exits 128.
- Batch poisoning (probed): `git add -- good.txt ghost.txt` fatals 128 **and stages nothing** — `good.txt` remained untracked. One unresolvable pathspec aborts staging of every declared path. All gates had already passed; the failure is purely this add step. Consequence: **deletion workloads can never pass scoped-staging sync** (hit today delivering Set A, the concurrent session's deletion set).

### 13.2 Verified git semantics (probes, scratch repo under `tests/.temp/git-add-probe`)

| # | Index/worktree state | Command | Result |
|---|----------------------|---------|--------|
| P1 | staged deletion (`D` in index, absent from worktree) | `git add -- <path>` | **fatal 128** (today's bug) |
| P2 | staged deletion | `git add -A -- <path>` | **fatal 128 — the proposed `-A` fallback does NOT work** |
| P3 | never-existed ghost | `git add -A -- <path>` | fatal 128 |
| P4 | worktree-deleted, still indexed | `git add -- <path>` | exit 0, deletion staged |
| P5 | staged-as-added, worktree file vanished (`AD`) | `git add -- <path>` | exit 0 |
| P6 | mixed batch: present file + staged-deleted path | `git add -- <both>` | fatal 128; present file **not** staged |

Conclusions: (a) the PM's `present/absent` fs-split with an `-A` fallback is empirically insufficient (P2); (b) plain `git add -- <path>` resolves any path present in the worktree **or** the index (P4, P5); (c) the only index-removed classes are staged deletions (`D`) and rename sources (`R*`) — for these the index already holds the desired state, so no add is needed at all.

### 13.3 Fix contract (implement exactly this)

In the scoped-staging branch of dev-sync.ts step 6.5, replace the single batch add with:

1. Parse `git diff --cached --name-status -z` once. Build `indexRemoved` = every path with status `D`, plus the **source** path of every `R<score>` rename record (a staged rename removes the source from the index; its target stays).
2. `skip = committable ∩ indexRemoved`. Skip these paths — the index already holds the desired state. Emit one dim/verbose log line naming the skipped count.
3. `toStage = committable \ skip`.
4. `present` = `toStage` paths where `fs.existsSync(path)` is true → one batch `git add -- <present, sorted>` (unchanged call shape).
5. `absent` = `toStage \ present` → run `git add -- <path>` **per path** with `.nothrow()` (P5: exit 0 for index-present paths whose worktree file vanished). A per-path failure means a true ghost — the path matches neither worktree nor index (e.g. a pipeline output deleted mid-run after the S1 snapshot) → print a loud `❌` naming the path and `process.exit(1)`. Fail-closed: silently dropping a declared committable path would under-deliver the commit.
6. The WARN-soak branch (bare `git add -A`) stays unchanged.

**Rejected alternatives** (documented for the record):
- PM's original direction — `git add -A -- <absent>` as the fallback: empirically fatal 128 (P2); superseded by the skip-set contract before implementation.
- Retry shape (batch first, parse stderr, retry per path on failure): two code paths keyed on stderr parsing; less deterministic than the skip-set-first shape.
- Extracting a staging planner into `scripts/lib/`: would add a SCRIPTS.md row plus an L1 parity/propagation cascade to a hotfix. Keep the logic inline in dev-sync.ts; extraction can ride a future refactor (candidate follow-up ticket).

### 13.4 Regression-test requirement

Extend the scoped-staging coverage from `docs/designs/2026-09-12-dev-sync-scoped-staging-design.md`:

- T1 (reproduces today's failure): stage a deletion, run the scoped-staging add path with `SYNC_SCOPED_STAGING=1` → add succeeds, exit 0, and `git status --porcelain` records the staged `D `. This is the acceptance gate for the amendment; it must fail against the current code and pass after the fix.
- T2: staged-as-added path whose worktree file vanished (`AD`) → recorded as a staged deletion, exit 0 (P5 class).
- T3: mixed committable (one staged deletion + one present file) → the present file is staged **and** the staged deletion is preserved (guards the P6 batch-poisoning class).
- T4: unresolvable ghost path in committable (neither worktree nor index, not a staged deletion) → loud failure, exit 1 (fail-closed contract, §13.3 step 5).
- T5 (parser, `tests/unit/git-status.test.ts`): cached name-status `D` and `R100` records classify into `indexRemoved`.

Test shape: integration-style over a scratch git repo under `tests/.temp/` (gitignored) exercising the real command shapes, plus parser unit cases in the existing `tests/unit/git-status.test.ts`. Extracting a helper lib is not required (see §13.3 rejected alternatives).

### 13.5 Amendment requirements and acceptance criteria (ASD-STE100, ADR-0079)

Requirements:
- R12. The scoped-staging add step skips paths recorded as removed by the cached diff (`D` status and rename sources).
- R13. The scoped-staging add step stages present paths in one batch call.
- R14. The scoped-staging add step attempts each remaining absent path individually.
- R15. The add step exits 1 with a loud message when a committable path matches neither the worktree nor the index.
- R16. A regression test reproduces the staged-deletion scoped-staging failure and passes after the fix.
- R17. The 1.17.0 annotation and the SCRIPTS.md row description cover both the domain-list extension and this fix.

Acceptance criteria:
- AC11. A staged deletion plus `SYNC_SCOPED_STAGING=1` sync completes its add step with exit 0. (R12, R16)
- AC12. `git status --porcelain` after the fixed add step still shows the staged deletion. (R12)
- AC13. A committable set mixing a staged deletion and a present file stages both correctly. (R12, R13)
- AC14. A ghost path in committable aborts the sync with exit 1 and names the path. (R15)
- AC15. `bun test tests/unit/git-status.test.ts` and the repo integration suite pass with the new cases. (R16)

### 13.6 Verification checklist adjustments (extends §7)

- Run `bun test tests/unit/git-status.test.ts` (T5) and the repo integration suite (T1-T4) — new cases must pass.
- Re-confirm AC1-AC10 unchanged; AC11-AC15 added.
- The dev-sync 1.17.0 row in both SCRIPTS.md files must mention both changes in one row (R17) — registry version parity check then validates the L0/L1 alignment as before.

### 13.7 Amendment risk note (extends §10)

The fail-closed ghost contract (§13.3 step 5) can abort a sync when a pipeline step deletes its own output after the S1 snapshot. This is deliberate: the alternative — silently dropping the path — under-delivers the commit. If a real recurrence appears, the remedy is a pipeline fix (do not delete declared outputs mid-run), not a relaxation of this contract.

