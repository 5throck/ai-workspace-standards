# Design: Scaffold Hygiene Bundle (Seed Registry Cleanup, Unknown-Flag Hardening, Placeholder WARN Remediation)

- **Spec ID**: 2026-09-24-scaffold-hygiene-bundle
- **Date**: 2026-09-24
- **Status**: Implemented (2026-09-24 — Part A seed bijection 40==40 delivered by docs-writer; Part B unknown/valueless `--` flag hard error (exit 1, token named, six valid flags listed; `--yes` argv-scan exemption) as new-project.ts v1.28.0; Part C placeholder WARN remediation text as audit.ts v2.42.0 (L1 mirror same-commit); cascade: SCRIPTS.md rows both sides, test-new-project.ts v1.6.0 Test 0c, lifecycle record catch-up, VERSION_MANIFEST regen — the manifest does track script versions, so R8's no-regen note was corrected by the audit's VERSION_MANIFEST gate)
- **Author**: architect (dispatched via PM)
- **Provenance**: Owner's live `new-project co-design` scaffold run, 2026-09-24
- **Predecessor spec**: 2026-09-24-skills-registry-overlay-reconcile (T-20260924-008) — introduced the scaffold registry reconcile machinery this design now feeds a clean seed

---

## 1. Background

A live `new-project` co-design scaffold run on 2026-09-24 surfaced three hygiene issues. None breaks the delivered project — the delivered registry is correct (35 rows == 35 delivered dirs, post-scaffold audit passes) — but each one misleads an operator or a future maintainer.

1. **Seed registry dead weight.** The scaffold's registry reconcile logged 37 PRUNED rows. Nine are L0-only workspace skills (`create-variant`, `promote-variant`, `project-to-variant`, `upgrade-project`, `variant-feature`, `ticket-run`, `project-resync`, `release-template`, `context-commonization-review`) that AGENTS.md §6 declares never-shipped by design. Twenty-eight are rows in the seed's `### Variant-Exclusive Skills` section referencing skills that exist only in OTHER variants' trees (verified: `financial-modeling`, `mece-logic-auditor` in `templates/co-consult/skills/`; `sound-synth` in `templates/co-game/skills/`). The seed (`templates/common/skills/SKILLS.md`) carries 63 rows against 40 delivered-at-common dirs — 37 dead rows, 59% dead weight — and prints a misleading log wall on every fresh scaffold.

2. **Silent unknown-flag ignore.** The owner typo'd `--varaint co-design`. The parse loop in `scripts/new-project.ts` (L161-202) matches flags by guarded equality (`args[i] === '--variant' && args[i + 1]`); a token starting with `--` that matches no known flag fails the positional branches too (L200-201 require the token NOT to start with `--`) and is silently discarded. The run proceeded with the positional `co-design` filling `variant` — correct only by luck. Silent ignore of explicit intent is dangerous on a command that re-initializes a directory.

3. **Placeholder WARN without remediation.** Post-scaffold, the audit prints `[WARN] Live context placeholder check: 1 file(s): docs/project.md`. The WARN is the designed nag (TODO fallback is by design), but the message names the file without naming the fix.

## 2. Goals

- G1. Make the seed registry a pure catalog of what `templates/common/skills/` actually delivers: one row per delivered-at-common dir, no dead rows, no per-scaffold prune noise beyond region pruning.
- G2. Make `new-project.ts` reject any unrecognized or valueless `--flag` with a hard error listing the valid flags, uniformly for all flags.
- G3. Extend the audit live-placeholder WARN with an actionable remediation path, keeping WARN severity.

## 3. Non-goals

- N1. Fixing variant-side registries (`templates/co-*/skills/SKILLS.md`). Part A documents what is lost by dropping the common rows; the backfill is ticketed, not implemented here.
- N2. The T-20260924-002 inventory decision (common-contract.json `common_skills`/`common_platform_skills` scope). This design edits only the seed SKILLS.md, not common-contract.json, and does not pre-empt that decision.
- N3. Any behavior change to `upgrade-project.ts` or its registry reconcile path (`reconcileSkillRegistry` stays frozen per the predecessor design AC8).
- N4. Auto-filling placeholders or downgrading the WARN. The nag is designed.
- N5. Restructuring the delivered-registry contract (fold → prune → reconcile → align pass order from the predecessor design is unchanged).
- N6. Ticket lifecycle state changes for T-20260924-002/-003/-004/-008.

## 4. Verified facts (design inputs)

| # | Fact | Evidence |
|---|------|----------|
| F1 | Seed has 63 rows: 35 `### Workspace Skills` + 28 `### Variant-Exclusive Skills` | `templates/common/skills/SKILLS.md` L20-54, L62-89 (the owner brief's "65" is a miscount; 63 matches `scripts/helpers/skills-registry.ts` header and the T-20260924-008 ticket text) |
| F2 | `templates/common/skills/` holds 40 skill dirs (plus README.md, README_ko.md, SKILLS.md files); the owner brief's "43" is a miscount | `ls templates/common/skills/` — 43 entries, 3 files |
| F3 | 26 of the 35 Workspace rows have matching common dirs; the 9 L0-only rows do not (they exist only in root `skills/`, 39 dirs) | dir listing cross-check |
| F4 | 14 delivered-at-common dirs have NO seed row: `decision-record`, `evidence-ledger`, `handbook`, `handbook-sync-audit`, `i18n-audit`, `i18n-formatting`, `i18n-layout`, `i18n-locale-config`, `k-dart`, `k-ecos`, `k-kosis`, `k-krx`, `k-law`, `k-opendata`. All 14 carry parseable frontmatter (version/status/owner/last_reviewed verified) | `templates/common/skills/<dir>/SKILL.md` frontmatter |
| F5 | Of the five variants named in the Variant-Exclusive section, ONLY co-game carries parseable registry rows: co-game SKILLS.md = 5 shape-valid rows (incl. `sound-synth`). co-consult = 0 rows (auto-generated link index, "Auto-generated by verify-skills.ts", bullet links, no metadata — and it lists 18 dirs, 4 of which the common section never tracked). co-deck = 0 rows (10 dirs), co-security = 0 rows (6 dirs), co-develop = 0 rows (4 dirs) | shape test `^\| \`name\` \| version…` per `parseSkillRegistryRows` (`scripts/helpers/skills-registry.ts` L77-118) |
| F6 | The registry row shape test is: table row whose 2nd cell is a backticked name and whose 3rd cell looks like a version — section headings are irrelevant to the parser | `skills-registry.ts` L77-84 (`matchSkillRowCells`) |
| F7 | The delivered-project audit parser reads ONLY the `### Workspace Skills` section when the heading exists | `foldVariantExclusiveRowsIntoWorkspaceSection` docstring, `skills-registry.ts` L307-329 |
| F8 | Scaffold reconcile pass order: fold (new-project.ts:1289) → prune to DIR-based keep-set (L1299-1305) → collect+reconcile (L1309-1310) → align (L1311) → write (L1325-1327). PRUNED log at L1313-1315 | `scripts/new-project.ts` L1280-1334 |
| F9 | No validator constrains the seed's ROW set: validate-templates checks dirs vs common-contract.json (C-CM-04, L3212-3220; B-11 L1856-1879), lifecycle-sync-audit Check C compares SKILL.md file content (L362-417), validate-skills.ts never parses SKILLS.md rows. Dropping rows cannot fail a check | grep over the three validators |
| F10 | The L1 seed is NOT propagated from root `skills/SKILLS.md` — no markers, no propagation wiring in `propagate-to-templates.ts`, and the two files have already diverged (root: newer versions, plus `simulate-pipeline`/`adopt-project` rows; seed: stale). Root SKILLS.md is the workspace-wide index and keeps the 9 L0-only rows | diff of the two files; grep of propagate-to-templates.ts |
| F11 | Arg loop: 6 known flags (`--variant`, `--description`, `--type`, `--version`, `--platform`, `--country`), guarded-equality style, values consumed via `args[++i]`; unknown `--` tokens fall through silently. A known flag whose next token is another flag or end-of-args also falls through (and the next flag token can be consumed as a value — pre-existing quirk, see §8 residual risk) | `scripts/new-project.ts` L160-202 |
| F12 | new-project.ts is at `@version 1.27.0` (v1.26.0 = identity overview; v1.27.0 = T-008 reconcile). SCRIPTS.md row: L0, 1.27.0. The brief's "1.26.0?" is stale | `scripts/new-project.ts` L2; `scripts/SCRIPTS.md` L204 |
| F13 | The placeholder check block spans audit.ts L605-629; ONE message (L627) serves all scanned files: `docs/context.md` (`projectCtxPath`, L165), `docs/*.context.md` (L609-613), `docs/project.md` (R8 addition, L614-616). audit.ts is `@version 2.41.0`, SCRIPTS.md row L0+L1, 2.41.0 | `scripts/audit.ts` L605-629; `scripts/SCRIPTS.md` L76 |
| F14 | Co-design delivery today: 40 common dirs − 6 region-pruned k-* = 34 common + 1 variant-exclusive (`service-design`) = 35 delivered; seed reconcile produced 37 prunes (9 + 28) and a correct 35-row registry | owner run log; T-20260924-008 ticket text (35 dirs, 32→0 errors after reconcile) |

## 5. Requirements (ASD-STE100, ADR-0079)

- R1. Remove the `### Variant-Exclusive Skills` section from `templates/common/skills/SKILLS.md`. Remove its 28 rows, its prose, and its table header.
- R2. Remove the 9 L0-only rows from the seed's `### Workspace Skills` table. Keep them in the root `skills/SKILLS.md` index (untouched).
- R3. Add one registry row per currently-unlisted delivered-at-common dir (the 14 dirs of F4). Take version/status/owner/last_reviewed values from each dir's SKILL.md frontmatter.
- R4. After R1-R3, the seed's row count equals the delivered-at-common dir count (40 rows == 40 dirs). Every row lives under `### Workspace Skills`.
- R5. Replace the removed section with a short pointer note stating: (a) workspace-only skills exist by design and are indexed in the root `skills/SKILLS.md` — do not re-add them here; (b) variant-exclusive skills live in `templates/co-*/skills/` and their registries belong in the owning variant's own `skills/SKILLS.md` (DEC-20260829-02). Keep the existing header reference to DEC-20260829-02 consistent with this note.
- R6. In `new-project.ts`, error and exit(1) when an argument token starts with `--`, matches no known flag, or is a known flag with no value. The error names the offending token, lists the six valid flags, and prints the usage line. Apply uniformly to all flags (covers `--varaint`, `--platfrom`, and valueless forms).
- R7. Extend the audit WARN message (audit.ts L627) to state the remediation: fill the named files' placeholder fields, or re-scaffold with `--description`/`--type` to pre-fill `docs/project.md`. Keep severity WARN. One message continues to serve all scanned files.
- R8. Update `scripts/SCRIPTS.md`: `new-project.ts` → 1.28.0 (R6), `audit.ts` → 2.42.0 (R7). Update the L1 mirror row for `audit.ts` (L0+L1 pair) in `templates/common/scripts/SCRIPTS.md` in the same commit. No VERSION_MANIFEST regen is required (no skill, agent, or script-lifecycle metadata changes; dev-sync regenerates on drift).

## 6. Acceptance criteria

- AC1. A real fresh co-design scaffold prints NO prune log line for any of the 9 L0-only skills or any of the 28 former variant-exclusive skills. Prune lines list only k-* skills (6 expected for co-design region-neutral).
- AC2. The same scaffold's `ADDED registry row` lines are limited to variant-exclusive delivered skills (for co-design: `service-design`). Post-scaffold `bun scripts/audit.ts` reports 0 FAIL.
- AC3. The seed's registry row count equals 40, and the row set equals the delivered-at-common dir set (bijection).
- AC4. `bun scripts/new-project.ts x --varaint co-design` (and any unknown/valueless flag) exits non-zero with a message naming `--varaint` and listing the six valid flags. No directory is created.
- AC5. On a scaffold with unfilled placeholders, the WARN line contains remediation text naming `--description`/`--type` and the fill-in path, and remains a WARN (audit exit code unchanged).
- AC6. `bun scripts/test-new-project.ts` (all tests incl. 29-30), `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`, and `bun scripts/validate-skills.ts` pass at HEAD plus this change.
- AC7. SCRIPTS.md rows and the L1 mirror row match the new script versions (R8).

## 7. Design decisions and trade-offs

### D1 — Drop the `### Variant-Exclusive Skills` section entirely (28 rows). DROP beats ANNOTATE.

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| D1a. Drop the section; add pointer note (R5) | Seed becomes a true catalog of what common delivers; prune wall disappears; the fold pass becomes a natural no-op | Loses the only structured (version/status/owner) record for 27 of the 28 skills (F5) | **ADOPTED** |
| D1b. Keep rows, annotate them as "other variants — never delivered" | Preserves the cross-variant metadata record | Every scaffold keeps pruning all 28 rows forever; the annotation documents noise instead of removing it; contradicts the seed's purpose (a registry of THIS tree) | Rejected |
| D1c. Split the seed per variant | Perfect per-variant registries | 13 new files, new propagation machinery — exactly what the predecessor design avoided | Rejected (out of scope, N1) |

**What is lost, and where responsibility lands.** Dropping the section destroys the last parseable registry record for 27 skills: co-consult (14 rows incl. `financial-modeling`, `mece-logic-auditor`), co-deck (9), co-security (3), co-develop (1). `sound-synth` (co-game) is safe — co-game's own SKILLS.md already carries its row in the parseable shape (F5). Existence of the 27 remains recorded in each variant's skills directory and, for co-consult, in its auto-generated link index (names only, no metadata; that index also covers 4 skills the common section never tracked). Per the Fork Model and DEC-20260829-02, the registry rows for variant-exclusive skills belong in the owning variant's `templates/co-*/skills/SKILLS.md`. The backfill is a docs/data task per variant and is deliberately NOT in this bundle's scope (N1): file it as a new backlog ticket, sibling of the T-20260924-002/-004 contract-inventory family ("variant SKILLS.md registries carry 0 parseable rows for 4 of 5 variants that own exclusive skills; backfill co-consult/co-deck/co-security/co-develop"). Until then, the workspace-wide skill-graph and VERSION_MANIFEST remain the metadata sources of record.

### D2 — Drop the 9 L0-only rows from the seed. DROP beats ANNOTATE, with one pointer note.

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| D2a. Drop the 9 rows; add the R5 pointer note | Zero prune noise; root SKILLS.md stays the L0 index (F10: two files, two audiences) | A future reader grepping only the seed will not see them | **ADOPTED** |
| D2b. Keep the 9 rows with a `workspace-only` annotation | Discoverable in the seed | 9 guaranteed prune lines on every scaffold — annotation preserves the noise we are removing | Rejected |
| D2c. Teach the reconcile a documented keep-list to skip logging | Log shrinks without touching data | Adds a second source of truth (the keep-list) inside the scaffold script for a problem the data itself can express; more code to maintain for zero functional gain | Rejected — simplest wins |

The R5 note is the durable guard against re-adding these rows: it states the AGENTS.md §6 rule in the file where a future editor would make the mistake.

### D3 — Add the 14 missing rows (R3). The seed must equal the delivered-at-common dir set.

Without this, cleanup alone yields 26 rows against 40 dirs, and every scaffold prints 14 `ADDED registry row` lines as reconcile re-derives them — trading prune noise for add noise. Adding the rows once, sourced from frontmatter (F4), makes the seed the true catalog and reduces per-scaffold reconcile output to region pruning plus genuine variant-exclusive additions. The scaffold-time align/reconcile passes keep the values honest afterward. The k-* rows are included: they are region-pruned at delivery, and their prune lines are the ONE intended remaining prune class (AC1).

### D4 — Keep `foldVariantExclusiveRowsIntoWorkspaceSection` even though it becomes a no-op.

With the section gone, the fold pass returns `moved=0` on every run (heading absent → unchanged, `skills-registry.ts` L335-336). Keep it: the cost is one string scan, and it remains load-bearing the day a variant overlay or future seed reintroduces the section — the audit parser reads only `### Workspace Skills` (F7), so silently losing that safety net would reintroduce the predecessor bug class. No code change; the design records the intent so a future cleanup does not mistake the no-op for dead code.

### D5 — Unknown flags: HARD ERROR, not warn-and-continue.

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| D5a. Hard error (exit 1) listing valid flags | Explicit intent is never dropped; failure is at the cheapest possible moment (before any writes) | A strictly-typo'd-but-otherwise-harmless run now fails | **ADOPTED** |
| D5b. Warn and continue | Typo runs still succeed | On a command that re-initializes a directory, a dropped `--variant` or `--platform` silently changes WHAT gets built; the owner's `--varaint` case shows the positional fallback masks the loss | Rejected |

Implementation shape: a catch-all branch at the end of the parse loop (`new-project.ts` L161-202) — any token starting with `--` that reached it matched no known flag (or a known flag with no value, since those guards require a truthy next token) and is rejected. Error message: the offending token, the six valid flags with their value domains, and the usage line (L205). This is uniform across all flags: `--platfrom`, `--Variant`, and a trailing valueless `--variant` all fail the same way. Positional parsing (project name, then variant) is unchanged.

### D6 — WARN keeps severity; message gains remediation text (R7).

The WARN is the designed nag for the TODO fallback (v1.26.0 identity-overview contract; predecessor design AC2/AC3). Auto-filling would erase the operator's signal; downgrading or removing it would hide unfilled identity fields. One message serves `docs/context.md`, `docs/*.context.md`, and `docs/project.md` (F13), so the remediation text covers both paths: fill the named files directly, or re-scaffold with `--description`/`--type` for the `docs/project.md` identity fields. Proposed shape:

```
[WARN] Live context placeholder check: 1 file(s) still contain scaffold placeholders: docs/project.md — fill the placeholder fields (project name, one-sentence description, TODO/TBD items) in the listed file(s), or re-scaffold with --description "<one sentence>" --type web|cli|api|mcp to pre-fill docs/project.md
```

### D7 — Versioning and cascade.

`new-project.ts` 1.27.0 → 1.28.0 (F12 corrects the brief's 1.26.0 guess — v1.27.0 already shipped today for T-008). `audit.ts` 2.41.0 → 2.42.0. SCRIPTS.md rows updated same-commit; the L1 mirror row for `audit.ts` (L0+L1 pair) updated in `templates/common/scripts/SCRIPTS.md` in the same commit (the mirror is manually aligned per T-20260924-001 — it is not yet auto-projected). `SKILLS.md` is a template data file: no script bump. No VERSION_MANIFEST regen needed (R8).

## 8. Residual risks

- RR1 (pre-existing, documented, not fixed here): in the current parser, a flag followed by another flag consumes that flag as its value (`--description --type web` sets description to the literal `--type`). The R6 catch-all does not fire for the consumed token. Fixing value-consumption semantics (e.g. rejecting values that start with `--`) is a candidate follow-up ticket; it changes accepted input shapes and deserves its own design.
- RR2: until the variant-registry backfill ticket lands, the 27 dropped-skill metadata records exist only in skill-graph/VERSION_MANIFEST and the variant dirs — the seed is no longer a cross-variant index. This is the accepted cost of D1 and is recorded in the seed itself (R5).
- RR3: k-* prune lines remain by design (region delivery). Operators seeing 6 prune lines on a region-neutral co-design scaffold are seeing intended behavior; the R5-adjacent seed prose (k-* are region-scoped) keeps this legible.

## 9. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no `.claude/` surface changes; skills registry content only | N/A |
| Antigravity (GEMINI.md) | None — no agent/dispatch surface changes; justification: this bundle touches scaffold tooling and a template data file, neither of which feeds GEMINI.md or `.agents/` | N/A |
| templates/common | Propagation required — the seed SKILLS.md edit (Part A) and the audit.ts SCRIPTS.md L1 mirror row (D7) live in templates/common and reach every scaffold and upgrade | `templates/common/skills/SKILLS.md`, `templates/common/scripts/SCRIPTS.md` |

## 10. Files to change

| File | Action | Owner | Part |
|------|--------|-------|------|
| `templates/common/skills/SKILLS.md` | edit — drop 2 sections' rows (9 + 28), add 14 rows, rewrite section note (R1-R5) | docs-writer | A |
| `scripts/new-project.ts` | edit — catch-all unknown/valueless flag hard error (R6); @version 1.28.0 + header note | automation-engineer | B |
| `scripts/audit.ts` | edit — WARN remediation text (R7); @version 2.42.0 + header note | automation-engineer | C |
| `scripts/SCRIPTS.md` | edit — new-project.ts 1.28.0, audit.ts 2.42.0 rows (R8) | automation-engineer | B, C |
| `templates/common/scripts/SCRIPTS.md` | edit — audit.ts L1 mirror row (R8) | automation-engineer | C |
| `scripts/test-new-project.ts` | edit — assertion for AC4 (unknown flag exits non-zero, no dir created); optionally pin AC1 prune classes | automation-engineer | B (verification) |
| `docs/VERSION_MANIFEST.md` | none — no regen required (R8) | — | — |

## 11. Verification plan

1. **Seed bijection (AC3)**: script check — seed row set == `ls templates/common/skills/*/` dir set (40 == 40), all rows under `### Workspace Skills`.
2. **Fresh scaffold (AC1, AC2)**: real `bun scripts/new-project.ts` co-design scaffold into `tests/.temp/` — reconcile log shows ONLY k-* prune lines (6) plus at most `service-design` ADDED; then `bun scripts/audit.ts` inside the scaffold reports 0 FAIL.
3. **Flag hardening (AC4)**: run with `--varaint co-design`, `--platfrom all`, and a valueless `--variant` — each exits non-zero, names the token, lists valid flags, and creates no directory.
4. **WARN remediation (AC5)**: on the fresh scaffold (which keeps the TODO fallback when `--description`/`--type` are omitted), the WARN line contains the remediation text; audit exit code unchanged.
5. **Suites (AC6)**: `bun scripts/test-new-project.ts`, `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`, `bun scripts/validate-skills.ts` green.
6. **Cascade (AC7)**: SCRIPTS.md rows and the L1 mirror row show the new versions.

## 12. Interplay with backlog tickets

- **T-20260924-002** (common_platform_skills inventory scope, backlog): the 28 dropped rows intersect its "delivered inventory vs registry/index" decision thematically, but this design edits only the seed SKILLS.md — common-contract.json is untouched. This cleanup does NOT pre-empt the T-002 decision; T-002 remains open as filed.
- **T-20260924-008** (skills registry overlay reconcile): direct predecessor. Its machinery (fold/prune/reconcile/align, `skills-registry.ts` v1.1.0, `new-project.ts` v1.27.0) is at HEAD and is what turns a clean seed into a correct delivered registry. Note: the ticket tracker still lists it `[backlog]` while its implementation has shipped — the status move belongs to the PM's lifecycle pass, not this design.
- **T-20260924-003** (i18n-specialist agent inheritance): unrelated — agents domain, not the skills registry.
- **New ticket to file** (from D1): variant SKILLS.md registry backfill — co-consult/co-deck/co-security/co-develop carry 0 parseable registry rows for their 27 exclusive skills; sibling of the T-20260924-002/-004 contract-inventory family. Filed at dispatch; not in this bundle.

## 13. Exemptions

- **Accessibility (ADR-0065): EXEMPT.** No user-facing web/app/CLI/document UI changes — scaffold tooling behavior and a template data file. Explicit statement per ADR-0065's backend exemption clause.
- **Preview verification (ADR-0070): EXEMPT.** No rendered UI artifact exists to verify; verification is CLI exit codes and log/audit output (§11).

## 14. Execution plan

| # | Task | Agent | Tier | Spec |
|---|------|-------|------|------|
| 0 | This design doc + registry entry | architect | High | 2026-09-24-scaffold-hygiene-bundle |
| 1 | Part A — seed SKILLS.md data cleanup (R1-R5) | docs-writer | Medium | 2026-09-24-scaffold-hygiene-bundle |
| 2 | Part B — new-project.ts flag hardening + test (R6) | automation-engineer | Low | 2026-09-24-scaffold-hygiene-bundle |
| 3 | Part C — audit.ts WARN remediation (R7) | automation-engineer | Low | 2026-09-24-scaffold-hygiene-bundle |
| 4 | SCRIPTS.md + L1 mirror cascade (R8) | automation-engineer | Low | 2026-09-24-scaffold-hygiene-bundle |
| 5 | `/sync "feat(scaffold): seed registry cleanup, unknown-flag hard error, placeholder WARN remediation"` | pm | Medium | |

**Execution order**: Sequential for writes (rows 1-4 touch shared pipeline files); row 1 is independent of rows 2-4 and may parallelize only if branched after row 1's PR merges (CONSTITUTION.md §3.3 — dev-sync touches shared files on every commit).

**Trade-off summary**: see §7 table. Bundle rationale: all three parts came from one scaffold run, share one verification vehicle (a fresh scaffold), and each is small; splitting into three PRs would triple the dev-sync ceremony for no isolation benefit. Risk is bounded: Part A is data-only with a bijection check; Parts B/C are one guard and one message string.
