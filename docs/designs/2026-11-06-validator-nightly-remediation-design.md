# Validator Nightly Remediation — 2026-11-06 E2E Nightly Red (Run 41993138298) — Design

- **Spec ID**: `2026-11-06-validator-nightly-remediation-design`
- **Date**: 2026-11-06
- **Author**: Template Architect (Design Gate Row 0 dispatch)
- **Ticket**: T-20261106-004 (priority: high, backlog)
- **Status**: implemented (single remediation PR per §6 Rollout; nightly acceptance pending the next scheduled run)
- **CI evidence**: nightly run [41993138298](https://github.com/5throck/ai-workspace/actions/runs/41993138298) (2026-11-05T08:16Z, head `c8aba5d6`), job `scaffold-e2e-all-variants`

## 0. Conclusion

Three independent failure classes, none of them a validator bug. Class A (the
Major, blocker of the initial scaffold commit) is an L1 content defect:
`templates/common/AGENTS.md` §6 carries three skill-table rows for L0-only
skills that the L1 delivery contract deliberately does not ship. Class B is not
a rendering regression (as the ticket assumed) but a stale test expectation:
the scaffold's `<variant>` placeholder substitution is correct; Test 25's
expected line is not normalized before comparison. Class C is one variant
source file (`templates/co-safety/README.md`) carrying substantive Korean into
the EN-original README, which is exempt at L0 (variant locale exemption) but
not in the scaffolded project. All three fixes are small, template-side or
test-side, and land in one PR.

## 1. Problem statement (CI evidence)

Run 41993138298, `scaffold-e2e-all-variants` (15 variants × 2 scaffold passes
each):

- **Class A — every variant.** In each scaffold's first-commit audit:
  ```
  [FAIL] AGENTS.md references `skills/create-variant/` but skills/create-variant/SKILL.md does not exist — stale §6 skill-table path
  [FAIL] AGENTS.md references `skills/promote-variant/` ...
  [FAIL] AGENTS.md references `skills/simulate-pipeline/` ...
  [FAIL] AGENTS.md §6 references 'skills/create-variant/' but skills/create-variant/SKILL.md does not exist on disk
  ... (both audit.ts #29 surfaces, 6 check(s) failed)
  [FAIL] Lifecycle audit detected drift - commit blocked.
  ❌ Test 4: no initial scaffold commit (HEAD missing)
  ```
  The audit gate behaves exactly as designed (T-20260910-016); the scaffolded
  content it audits is wrong.
- **Class B — one variant.** co-architect only, both passes:
  ```
  ❌ Test 25: variant_overrides.governance_workflow not rendered into body
     (missing line: "Phase numbering and names are variant-specific. The authorit…")
  ```
- **Class C — one variant.** co-safety, both passes, in the scaffolded
  project's own `validate-md-language.ts` gate:
  ```
  ❌ Found 1 language violation(s) in official documents:
     📄 README.md — Reason: Korean content detected without lang: ko declaration
  ```

Net effect: every nightly scaffold is red at first commit (Test 4 no-HEAD
downstream of class A), co-architect fails Test 25, and the co-safety
scaffold's language gate fails.

## 2. Root-cause analysis per class

### Class A — L0-only skill rows in the L1 common AGENTS.md §6 table

- `templates/common/AGENTS.md:252-254` (verified) carries §6 rows for
  `create-variant`, `promote-variant`, `simulate-pipeline`, each annotated
  "workspace-root (L0) only, not shipped in scaffolds". These three skills
  live only in the workspace root `skills/` directory (L0), per their own
  AGENTS.md §6 descriptions.
- The scaffold delivers `AGENTS.md` verbatim from `templates/common/AGENTS.md`
  (plus variant overlays), so the scaffolded AGENTS.md §6 references
  `skills/create-variant/` etc., which do not exist in the project.
- audit.ts enforces the §6 contract in two places (both fired in CI):
  `checkAgentsMdSkillTable()` (root audit, ~line 2184) and the standalone §29
  block (~line 3375). Both FAIL on ≥3 scaffold groups → the pre-commit audit
  gate blocks the initial commit → Test 4 reports no HEAD.
- **This is the same defect family as DEC-20261028-05** (L0-only governance
  doc cleanup): L0-only operational content verbatim-mirrored into L1
  delivery. The L1 COMMON template legitimately needs neither row set — the
  workspace root `AGENTS.md` is a separate, hand-maintained file (no parity
  check ties the two §6 tables together; verified by grep across
  dev-sync/audit/propagation scripts).

### Class B — Test 25 expectation vs `<variant>` placeholder substitution (co-architect)

- The renderer chain is **correct and working**: `new-project.ts` §2.3b
  resolves the co-architect `agents/pm.md` extends-stub through
  `scripts/helpers/resolve-pm-stub.ts` (`composeResolvedAgentContent`),
  which injects `variant_overrides.governance_workflow` into the body
  (verified locally: the composed content contains the expected line).
- The substitution step (`scripts/helpers/substitute-placeholders.ts` §5 of
  the scaffold) then rewrites backtick `<variant>` paths:
  `` `docs/<variant>.context.md` `` → `` `docs/co-architect.context.md` ``.
  The co-architect governance override's first content line contains exactly
  such a backtick path (template line 44).
- Test 25 (`scripts/test-new-project.ts:813-817`) reads the override line
  from the **raw template YAML** and asserts `pmContent.includes(contentLine)`
  — with the literal `<variant>` still in the expected string. The scaffolded
  file has the substituted form, so `includes()` fails. Reproduced locally
  with `--variant co-architect`; the scaffolded body contains
  `docs/co-architect.context.md` while the test expects
  `docs/<variant>.context.md`.
- So: rendering pipeline = correct; test expectation = stale. The ticket's
  "render the override or fix the override source" direction does not apply —
  neither the renderer nor the source is broken.

### Class C — co-safety README.md Korean without `lang: ko` in the scaffold

- `templates/co-safety/README.md` (the EN original of the bilingual twin pair)
  carries substantive Korean: 75 Hangul characters across the agent-roster
  table (industry-specific Korean domain terms appended after the English
  specialist names, e.g. the Chemical Plant Safety and Gas Terminal Safety
  rows). Every other variant README has exactly 3 Hangul chars — the
  language-link line pointing at the KO twin, which v1.16.0's link stripper
  deliberately exempts.
- At the workspace root this file is **exempt**: `validate-md-language.ts`
  v1.7.0's variant-aware exemption skips `templates/<variant>/` files when
  the variant's `variant.json` declares `country_config.locales` containing
  `ko` — co-safety is the only variant with `locales: ['ko']`. This is why
  the root audit is green while every scaffold is red.
- The scaffold copies `README.md` verbatim to the project root. In the
  scaffolded project there is no `templates/` tree, so the variant-aware
  exemption can never fire (it is path-scoped to `templates/`), and the
  project's own `validate-md-language.ts` gate FAILs on the undeclared
  Korean.
- **Ticket discrepancy**: the ticket says "2 variants". CI evidence shows one
  variant (co-safety) flagged in its two scaffold passes. Design proceeds on
  the CI evidence.

## 3. Chosen fix per class

### Class A — strip the three L0-only rows from `templates/common/AGENTS.md` §6

Remove the `create-variant`, `promote-variant`, `simulate-pipeline` rows from
the §6 "Common workspace-level skills" table in `templates/common/AGENTS.md`
(lines 252-254). The workspace-root `AGENTS.md` §6 keeps its rows — the root
legitimately ships those skills and its own audit checks resolve there.

**Rejected alternatives**:
- *Teach audit.ts an L0-only annotation* (skip rows whose Purpose cell says
  "not shipped in scaffolds"): rejected — it adds string-matching validator
  complexity to excuse a content defect, and the annotation is already in the
  text today (the rows self-describe). The L1 template carrying rows for
  skills it does not deliver is the bug; fixing the content keeps the
  validator contract strict ("every backtick `skills/<name>/` path in
  AGENTS.md must resolve").
- *Ship the three skills to scaffolds*: rejected — contradicts the delivery
  contract (variant scaffolding/promotion is L0-only tooling; ADR lineage:
  create-variant/promote-variant/simulate-pipeline are documented as
  "workspace-root (L0) only, not shipped in scaffolds").

**Rationale**: aligns with the DEC-20261028-05 principle (no L0-only
operational content in L1 delivery), requires no validator changes, and the
scaffolded AGENTS.md §6 then satisfies the audit contract by construction.

### Class B — normalize the Test 25 expected line for placeholder substitution

In `scripts/test-new-project.ts` Test 25, apply the same backtick-path
substitution the scaffold applies before the `includes()` assertion: replace
`` `...<variant>...` `` in `contentLine` with the actual variant name (reuse
the exact regex semantics from `scripts/helpers/substitute-placeholders.ts` —
backtick-path-scoped `<variant>` replacement — ideally by importing or
duplicating the exported helper so the two cannot drift).

**Rejected alternatives**:
- *Render the override differently* (e.g. stop substituting inside pm.md
  bodies): rejected — the substitution is the correct scaffold behavior
  (a scaffolded project must not ship dangling `docs/<variant>.context.md`
  pointers); the CI evidence shows the rendered body is what a project PM
  needs.
- *Fix the override source* (remove `<variant>` from the co-architect
  template): rejected — `docs/<variant>.context.md` is the sanctioned
  placeholder convention (used across template surfaces); special-casing one
  template's prose to satisfy a test assertion inverts the contract.

**Rationale**: the test's job is to verify the ADR-0039/ADR-0034 scaffold-time
contract ("the override is rendered into the body"). Comparing the raw
template text against post-substitution output tests an implementation detail
(placeholder spelling) rather than the contract. Normalizing the expectation
restores the intended assertion.

### Class C — anglicize the Korean fragments in `templates/co-safety/README.md`

Rewrite the Korean fragments in the co-safety agent-roster rows as English
(the Korean industry parentheticals and per-law references move out of the EN
original; the Korean industry terminology already lives in the
KO twin `templates/co-safety/README_ko.md`, which declares
`lang: ko` + `lang_reason: source-material` per the v1.15.0 batch). Regenerate
the `content_hash` frontmatter pair via the README-sync tooling after the edit
(the sync_version/content_hash twins must stay in step; CI runs
"README content hashes refreshed (EN + KO)").

**Rejected alternatives**:
- *Stamp `lang: ko` + `lang_reason` on the EN original*: rejected — the file
  is ~99% English prose; a file-wide Korean declaration misstates the
  document and breaks the bilingual-twin contract (README.md is the EN
  original; v1.16.0 explicitly puts EN originals under the Korean FAIL rule).
- *Extend the variant-aware exemption to scaffolded projects* (e.g. read the
  scaffolded variant identity and exempt its README): rejected — it weakens
  the project-side language gate to accommodate one template's content, the
  opposite direction of the v1.16.0 perimeter hardening.
- *Move the Korean terms to README_ko.md only* — this is exactly what the
  chosen fix does; listed for completeness.

**Rationale**: EN originals must be English (CONSTITUTION.md §4.1); the Korean
domain names are preserved in the KO twin; zero validator or scaffold changes.

## 4. Files to change

| File | Action | Description |
|------|--------|-------------|
| `templates/common/AGENTS.md` | edit | Remove the 3 L0-only skill rows (lines 252-254) from the §6 table |
| `scripts/test-new-project.ts` | edit | Test 25: substitute backtick `<variant>` paths in `contentLine` before `includes()` |
| `templates/co-safety/README.md` | edit | Anglicize Korean fragments in the agent-roster rows; refresh content_hash via README-sync |
| `templates/co-safety/README_ko.md` | verify | Confirm the Korean terminology is fully present in the KO twin before dropping it from the EN original |

No validator (`audit.ts`, `validate-md-language.ts`, `resolve-pm-stub.ts`,
`substitute-placeholders.ts`) changes.

## 5. Test plan (regression per class)

- **Class A**: covered by the existing nightly itself — after the row strip,
  `bun scripts/test-new-project.ts <name> --variant co-abap --platform all`
  must reach Test 4 with a HEAD (initial commit lands; audit §29 green).
  No new test: the audit gate (T-20260910-016) already detects the defect;
  the fix removes its trigger. Optional hardening (out of scope here): a
  `validate-templates.ts` check that §6 backtick rows in
  `templates/common/AGENTS.md` resolve under `templates/common/skills/`.
- **Class B**: the co-architect E2E leg is the regression test —
  `bun scripts/test-new-project.ts <name> --variant co-architect --platform all`
  Test 25 must PASS; assert in review that the assertion still fails when the
  override is genuinely dropped from the body (mutation check by temporarily
  removing the injection in a scratch run is acceptable evidence).
- **Class C**: the co-safety E2E leg — the scaffolded project's
  `validate-md-language.ts` gate must PASS ("Language validation: no
  Korean-only markdown files found"); root `bun scripts/validate-md-language.ts`
  must stay green (it scans `templates/co-safety/README.md` once the locale
  exemption no longer matters — the file is English).
- **Nightly (acceptance)**: run 41993138298's successor must be green across
  all 15 variants: audit clean on every scaffold validation, Test 4 HEAD
  present, Test 25 PASS (all variants), language validation PASS (all
  variants).

## 6. Rollout

Single PR (one reviewer pass, three small diffs):

1. Edit `templates/common/AGENTS.md` (class A) — no version bump needed
   (template content, not a script).
2. Edit `scripts/test-new-project.ts` (class B) — version bump required by
   the dev-sync script-registry gate; update the header changelog.
3. Edit `templates/co-safety/README.md` (class C) + regenerate the sync hash
   pair with the README-sync refresh step.
4. `bun scripts/audit.ts` green at the root; `/sync` pipeline carries the
   spec registration; then trigger the nightly and confirm green.

## 7. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — instruction-surface content only; no dispatch or hook changes | N/A |
| Antigravity (GEMINI.md) | None — GEMINI.md is not touched by any of the three fixes; class A only edits the shared AGENTS.md §6 table which GEMINI.md does not mirror | N/A (justification: none of the touched files feed GEMINI.md) |
| templates/common | Propagation required — class A edits `templates/common/AGENTS.md` directly; class C edits a variant template (`templates/co-safety/`); neither needs a propagation run because both are hand-maintained template sources, not managed-block content | templates/common/AGENTS.md, templates/co-safety/README.md |

## 8. Acceptance criteria

- [ ] `templates/common/AGENTS.md` §6 contains no row referencing a skill absent from `templates/common/skills/`
- [ ] Workspace-root `AGENTS.md` §6 unchanged (create-variant/promote-variant/simulate-pipeline rows retained)
- [ ] co-architect E2E Test 25 passes with the placeholder-normalized expectation
- [ ] `templates/co-safety/README.md` contains no Hangul outside the language-link line; content_hash pair refreshed
- [ ] Root `bun scripts/audit.ts` and root `bun scripts/validate-md-language.ts` green
- [ ] Nightly scaffold E2E green on all variants (acceptance per ticket T-20261106-004)

## 9. Deviations from the ticket's suggested fix direction

- **Class A**: chosen "strip rows from the L1 template" (the ticket's first
  option); "teach audit the L0-only annotation" rejected (see §3).
- **Class B**: ticket assumed a rendering regression; investigation shows the
  renderer is correct and the fix lands in the test harness expectation
  instead.
- **Class C**: ticket suggested "add lang: ko frontmatter to the 2 variant
  README sources"; the chosen fix is anglicizing the EN original instead —
  declaring the EN README as Korean would misstate the document. Also, CI
  evidence shows one affected variant (co-safety), not two.

## References

- CI run: https://github.com/5throck/ai-workspace/actions/runs/41993138298
- Ticket: `tickets/governance/T-20261106-004.yaml`
- Precedent: `docs/designs/2026-10-28-l0-only-governance-doc-cleanup-design.md` (DEC-20261028-05)
- Validator contract: `scripts/audit.ts` §29 / `checkAgentsMdSkillTable()` (T-20260910-016)
- Language policy: `CONSTITUTION.md §4.1`; `scripts/validate-md-language.ts` v1.15.0/v1.16.0/v1.7.0 changelog
- Scaffold contract: ADR-0039/ADR-0034 via `scripts/helpers/resolve-pm-stub.ts`; `scripts/helpers/substitute-placeholders.ts`
