# Design: Self-Containment Remediation for `templates/common/docs/context.md` (D1–D8 + design-foundation Delivery)

- **Date**: 2026-09-24
- **Author**: Template Architect (Phase 1-2, Design Gate per ADR-0074)
- **Status**: Implemented (2026-09-24 — delivered with the design-foundation skill delivery pipeline in the same change set; Amendments: §8.13 placement revised to §8.18 at implementation review; Addendum 2 §15 (2026-09-24): two post-implementation residuals contracted — context.md Key Files row, AGENTS.md `stack-setup` phantom)
- **Audience**: docs-writer, automation-engineer, PM (approval), auditor (QA)
- **Sibling context**: `2026-09-24-constitution-s33-context-injection-design.md` (zone mechanics), tickets T-20260924-001..006

---

## 1. Background

Two read-only audits on 2026-09-24 found eight self-containment defects (D1–D8) plus one
internal contradiction in `templates/common/docs/context.md` v2.10 (570 lines). The file is
delivered into every new project at scaffold time by `scripts/new-project.ts`; after delivery
the workspace root is effectively unreachable. The owner's standing policy baseline:

> context.md must contain NO links/references to CONSTITUTION.md and must be self-standing —
> every reference must resolve INSIDE the delivered project.

All eight defects evade every existing gate. The audit-time L0 Leakage gate
(`scripts/audit.ts`) and the scaffold sanitizer both consume the same narrow pattern
(`scripts/helpers/l0-ref-policy.ts:37` — `L0_REF_PATTERN = /CONSTITUTION\.md|docs[\/\\]constitution[\/\\]/i`),
so lowercase bare mentions (`constitution §6.7`), sibling L1 paths (`templates/common/scripts/`),
and non-CONSTITUTION dangling referents (missing agents/skills) pass silently.

### 1.1 Owner directive for D3 (mid-flight steering)

The audit initially proposed a disclaim-only disposition for D3. The owner superseded it:

> "It would be good if the design-foundation skill were delivered on new-project creation —
> but a wrong delivery could turn it into an orphan skill."

So D3's fix is **proper delivery of the skill through the canonical propagation path, with
explicit orphan-avoidance guardrails** — not a disclaimer.

### 1.2 Verified delivery-mechanics facts (design constraints)

- `new-project.ts` blanket-copies `templates/common/`, then removes the L1-only docs dirs
  `docs/{_templates,_examples,adr,variants}` (`scripts/helpers/scaffold-markers.ts:264`,
  `NEW_PROJECT_L1_ONLY_DIRS`); all `.md` pass through `blankL0Refs` (§2.5b,
  `new-project.ts:622-627` — text-blanking, line-preserving); L0-only scripts are stripped;
  `docs/_common/` is flattened into `docs/`.
- A **second delivery filter** exists at `new-project.ts:1102-1121`: at scaffold, any
  `SKILL.md` under the five project skill bases (`skills/`, `.claude/skills/`, `.gemini/skills/`,
  `.agents/skills/`, `.codex/skills/`) whose frontmatter contains `l2_propagate: false` is
  **deleted from the delivered project**. This is a safety net, but it is load-bearing for D3.
- `templates/common/docs/adr/` contains only `.gitkeep` (verified) — no README.
- `templates/common/scripts/SCRIPTS.md` exists (delivered by blanket copy) — valid repoint target for D5.
- `templates/common/agents/` contains only `_COMMON.md`, `i18n-specialist.md`, `pm.md`.
- `decision-record` is delivered (declared in `common-contract.json` `common_platform_skills`,
  `propagated_to_common: true`); `docs/decisions/` is a use-time convention it governs.
- `templates/common/docs/procedure-schema-spec.md` and `templates/common/docs/design-foundation.md`
  are both delivered; `design-foundation.md:12,25` already references the `design-foundation` skill.

### 1.3 D3 delivery facts — the orphan shape already exists (verified 2026-09-24)

`design-foundation` currently EXISTS at: `skills/design-foundation/` (L0 SSOT),
`.agents/skills/`, `templates/common/.claude/skills/`, `templates/common/.gemini/skills/`.
It is MISSING from: `templates/common/skills/` (the project-shippable SSOT — 41 skills + index),
`docs/templates/common-contract.json` (no declaration anywhere), and delivered projects
(`Projects/co-design/.claude/skills` carries `service-design` + `ui-ux-design-intelligence`
but no `design-foundation`).

Of the 55 dirs under `templates/common/.claude/skills/`, 22 are not in the contract
(adopt-project, context-commonization-review, create-variant, design-foundation, graft, k-dart,
k-ecos, k-kosis, k-krx, k-law, k-opendata, migrate-project, project-resync, project-to-variant,
promote-variant, release-template, simulate-pipeline, skill-graph-analytics, sound-synth,
ticket-run, upgrade-project, variant-feature). Most are workspace-root (L0)-only by design
(AGENTS.md §6: create-variant / promote-variant / simulate-pipeline etc. "not shipped in
scaffolds") — correctly excluded. **`design-foundation` is not in that class**: it is genuinely
project-relevant (context.md L128 references it; `docs/design-foundation.md` IS delivered).

---

## 2. Goals

1. Make every reference in `templates/common/docs/context.md` resolve inside a delivered project, or carry the house not-linked disclaimer.
2. Deliver the `design-foundation` skill to new projects through the canonical pipeline, without creating an orphan skill.
3. Fix the D6 defect at its source (`CONSTITUTION.md`) so the injected zone cannot regress.
4. Relocate D7 content and verify L0 coverage for D8 with zero information loss at the workspace root.
5. Keep every existing gate green and add no new gate-pattern changes (that is a separate follow-up ticket).

## 3. Non-goals

- Fleet refresh of existing `Projects/co-*` copies (each project picks the fix up at its next upgrade).
- Overview-placeholder identity filling (scaffold behavior; separate follow-up candidate).
- Variant `co-*.context.md` dedup (T-20260924-002/003/005 class).
- The other 21 undeclared platform mirrors (T-20260924-002 owns the inventory-scope decision).
- Changes to `l0-ref-policy.ts` / constitution-scrub gate patterns (follow-up ticket candidate — the pattern gap that let all eight defects through).
- The COMMON-CONSTITUTION-PR zone (fresh, audit-clean).
- The same phantom `stack-setup` references in root `AGENTS.md` §7 and `templates/common/AGENTS.md:598` (different files; candidate follow-up ticket).

---

## 4. Requirements (ASD-STE100, ADR-0079)

Order: R1 context.md prose → R2 CONSTITUTION source → R3 skill frontmatter/indexes →
R4 contract → R5 propagation → R6 L0 relocation.

| # | Requirement | Owner | Defect |
|---|-------------|-------|--------|
| R1 | Replace the dead referent at context.md L492. Keep the delivered `docs/procedure-schema-spec.md` pointer. Drop the `constitution §6.7` mention. | docs-writer | D1 |
| R2 | Rewrite the ADR subsection at context.md L203-209. Remove the "seeded with a README" claim. Remove the scaffold-provides implication. Keep `docs/adr/NNNN-<slug>.md` as the project-authored convention. State that the first record creates the directory. Point gate-moment rulings at the delivered `decision-record` skill. | docs-writer | D2 |
| R3 | Deliver the `design-foundation` skill: remove the `l2_propagate: false` line from `skills/design-foundation/SKILL.md:15` (keep `scope: common`). Update the matching annotation in the `skills/SKILLS.md:43` and `templates/common/skills/SKILLS.md:40` row notes. | automation-engineer | D3 |
| R4 | Add a `design-foundation` entry to `common-contract.json` `common_skills`. Mirror the `ui-ux-design-intelligence` entry shape (source / version / overridable: false / description). | automation-engineer | D3 |
| R5 | Run the propagation: `sync-skills` re-mirrors the platform copies, then `propagate-to-templates --apply` populates `templates/common/skills/design-foundation/` and refreshes all platform mirrors. Verify no `design-foundation` copy anywhere carries `l2_propagate: false`. | automation-engineer | D3 |
| R6 | Replace the phantom `stack-setup` agent mention at context.md L409 with a self-standing instruction (PM dispatch + security review + explicit user approval). | docs-writer | D4 |
| R7 | Repoint context.md L480 to the project's own `scripts/SCRIPTS.md`. Define Tier 2 in one line at the same blockquote. | docs-writer | D5 |
| R8 | Replace `CONSTITUTION.md:680` ("See docs/context.md for the skill-lifecycle registration details.") with the layer-neutral wording in §6.6. Refresh the context.md zone via `--marker-rewrite --domain constitution-context --apply`. | docs-writer (edit) + automation-engineer (rewrite) | D6 |
| R9 | Relocate the Context Commonization Review subsection (context.md L505-529) to `docs/constitution/08-coding-guidelines.md` as a new §8.13 adjacent to §8.12. Write the new L0 prose (none exists today — grep-verified). Remove the subsection from context.md. Preserve the full content inventory in §6.7. | docs-writer | D7 |
| R10 | Remove the Workspace & Template Boundary Policy from context.md (L346-349). L0 coverage already exists (evidence in §6.8) — no relocation prose needed. | docs-writer | D8 |
| R11 | Resolve the Korean-exception contradiction: align context.md L227 with the injected zone wording (agents/skills MAY declare with `lang_reason`; context/core files may not). Delete the L229 duplicate paragraph (the injected zone L296-302 already covers it). | docs-writer | contradiction |
| R12 | Apply the drive-by edits listed in §6.9, inside touched sections only. | docs-writer | drive-bys |
| R13 | Bump the version footer to 2.11 with a change note. | docs-writer | footer |
| R14 | Introduce no new reference to a workspace-root-only path anywhere in the touched files. | all | invariant |

## 5. Acceptance criteria (ASD-STE100, ADR-0079)

| # | Criterion | Verification |
|---|-----------|--------------|
| AC1 | `bun scripts/audit.ts` exits 0 on the workspace root after all edits. | run audit.ts |
| AC2 | The only `L0_REF_PATTERN` match in context.md is the L429 `intentional-duplicate` marker annotation. A `blankL0Refs` simulation on the fixed file produces zero text deltas beyond that marker-line blank. | inline bun probe (same as today's baseline simulation) |
| AC3 | `propagate-to-templates --dry-run` lists `templates/common/skills/design-foundation/SKILL.md` as `missing` before `--apply`, and `in-sync` after. All four platform-mirror domains report `design-foundation` in-sync. | dry-run + apply + re-run |
| AC4 | `grep -rn "l2_propagate" ` over every `design-foundation/SKILL.md` copy (root skills/, four root platform mirrors, four template mirrors) returns zero hits. | grep |
| AC5 | Fresh-scaffold simulation: the delivered project contains `skills/design-foundation/SKILL.md` and `.claude/skills/design-foundation/SKILL.md`; the scaffold sweep logs no exclusion for `design-foundation`; the delivered context.md `design-foundation` reference resolves to `skills/design-foundation/SKILL.md`; the delivered `docs/design-foundation.md` skill references resolve too. | new-project into a scratch dir (or `simulate-pipeline`) |
| AC6 | `bun scripts/validate-templates.ts` reports no new FAIL or WARN versus the pre-change baseline. C-CM-05 stays green (the mirror copy is recognized as a "mirrored workspace skill", `validate-templates.ts:2869`). Contract Check H stays green with the new entry. | run before/after, diff |
| AC7 | `--marker-rewrite --domain constitution-context` dry-run shows exactly one zone refresh (the COMMON-CONSTITUTION zone carrying the D6 line). After `--apply`, the sibling Schema Governance zone and the COMMON-CONSTITUTION-PR zone are byte-identical to before. A second `--apply` is a no-op (idempotence). | dry-run → apply → apply → byte-compare |
| AC8 | Inverted reference re-inventory over the fixed context.md: for every external-artifact mention, a delivered referent exists or an approved not-linked disclaimer is present. Zero DEFECT-class rows remain. | re-run today's audit method |
| AC9 | `docs/constitution/08-coding-guidelines.md` §8.13 carries the full D7 content inventory (§6.7) and context.md no longer carries the subsection. | read both files |
| AC10 | The workspace-root VERSION_MANIFEST row for design-foundation (`docs/VERSION_MANIFEST.md:47`) needs no change — delivered SSOT skills keep the `skills/<name>` location + `workspace` platform row shape (precedent: ui-ux-design-intelligence, `docs/VERSION_MANIFEST.md:88`). The skills↔manifest parity gates pass. | run audit + manifest check |

---

## 6. Design decisions and trade-offs

### 6.1 D3 root-cause diagnosis: how `templates/common/skills/` is populated and why design-foundation fell through (required design input)

**Population mechanism.** `templates/common/skills/` is written by exactly one path: the
`skills` domain of `scripts/propagate-to-templates.ts` (propagation-map.json domain `skills`,
source `skills/` → target `templates/common/skills/`, exclude `['local','external']`). The
domain applies a per-skill frontmatter filter on top of the exclude list
(`propagate-to-templates.ts:504-507`): `if (!includeSkillInL1(skillName)) continue;`

**The filter.** `includeSkillInL1` (`scripts/helpers/layer-filter.ts:262-268`) consults
`parseSkillLayers` (`layer-filter.ts:122-190`), which reads each `skills/*/SKILL.md`
frontmatter. `scope: common` maps to layer `L0+L1` — but an explicit `l2_propagate: false`
line **overrides** it to layer `L0` (`layer-filter.ts:181-184`: "l2_propagate: false overrides
scope — skill stays in L0 only"). Layer `L0` fails `includeSkillInL1`, so the `skills` domain
skips the skill and `templates/common/skills/design-foundation/` is never created.

**Why the platform mirrors got it anyway.** `sync-skills.ts` mirrors root `skills/` into
`.claude/skills/`, `.gemini/skills/`, `.agents/skills/`, `.codex/skills/` and excludes only
`mirror: false` skills (`sync-skills.ts:272`). `design-foundation` carries no `mirror: false`
— so all four root platform mirrors received it. The propagation-map platform domains
(claude-skills / gemini-skills / agents-skills / codex-skills) then copy the mirrors wholesale:
their per-skill scope-skip was removed by T-20260916-008 (`propagate-to-templates.ts:517-525`),
leaving each domain's `exclude` list as the only carve-out. Result: the mirror copies exist
under `templates/common/.{claude,gemini,agents}/skills/` while the SSOT mirror
(`templates/common/skills/`) does not — the asymmetry the audit found.

**Why delivery still fails.** Even if a mirror copy reaches a scaffolded tree,
`new-project.ts:1102-1121` deletes any skill whose SKILL.md contains `l2_propagate: false`
from all five project skill bases. The mirrored SKILL.md carries the flag verbatim, so the
sweep removes it — which is exactly what `Projects/co-design` shows (variant skills present,
design-foundation absent).

**Why it fell through, in one sentence.** The skill was authored on 2026-08-30 with
`scope: common` + `l2_propagate: false` (SKILLS.md rows record the flag verbatim), while
context.md L122-128 and the delivered `docs/design-foundation.md` were written to reference it
project-side — the frontmatter contradicted the delivery intent, and no gate compares context.md
skill references against the delivered skill set, so nothing flagged the divergence.

**The precedent that decides the fix.** `ui-ux-design-intelligence` — also promoted into
common delivery — has `scope: common` and NO `l2_propagate` line
(`skills/ui-ux-design-intelligence/SKILL.md:9`), a `common_skills` contract entry, and a
`workspace`-platform VERSION_MANIFEST row. That is the exact target state for design-foundation.

### 6.2 D3 delivery route — **picked**: frontmatter flip + contract entry + pipeline refresh

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| A. Disclaim-only (audit original) | One-line edit | Contradicts the owner directive; leaves the delivered `docs/design-foundation.md` references dangling; leaves context.md L128 false | rejected |
| B. Hand-copy the skill into `templates/common/skills/` + contract | Fastest | Creates exactly the orphan the owner warns about: a hand-maintained mirror outside the pipeline, untracked by layer-filter, diverging silently; the scaffold sweep would still delete it at delivery until the frontmatter is fixed | rejected |
| C. Frontmatter flip (remove `l2_propagate: false`, keep `scope: common`) + `common_skills` contract entry + propagation refresh | Travels the canonical path end-to-end; single control point (SSOT frontmatter); mirrors stay pipeline-derived; matches the ui-ux-design-intelligence precedent; C-CM-05 already recognizes the mirror class | Widens delivery surface by one skill to every new project (accepted — genuinely project-relevant) | **picked** |

**Orphan-avoidance guardrails (binding for implementation):**

1. **Pipeline-only mirrors.** The skill reaches projects only through
   `skills/` (SSOT) → `propagate-to-templates` skills domain → `templates/common/skills/` →
   scaffold blanket copy, with platform mirrors derived by `sync-skills` + the platform
   domains. No hand copies anywhere. The SSOT frontmatter is the single inclusion control point.
2. **Validator recognition.** No new exception is needed: C-CM-05's reverse-coverage exempts
   the `templates/common/.claude/skills/design-foundation` copy as a *mirrored workspace skill*
   (`validate-templates.ts:2869` — root `skills/<name>/SKILL.md` exists); the contract entry
   gives Check H forward coverage; AC4 pins the frontmatter invariant.
3. **Sweep stays armed.** The `new-project.ts:1102-1121` safety net is not weakened. It becomes
   the negative test: after the flip, the sweep must log no `design-foundation` exclusion (AC5).
4. **No T-20260924-002 pre-emption.** Only design-foundation gets a contract entry. The other
   21 undeclared mirrors keep their current state; T-002 owns their inventory-scope decision.
5. **No T-20260924-004 regrowth.** This route never creates hand-maintained variant mirror
   copies — design-foundation travels only through the pipeline, so the stale-mirror class
   T-004 wants to police cannot regrow from this change.

### 6.3 D1 — **picked**: drop the dead mention, keep the delivered referent

Options: (a) drop `and constitution §6.7`; (b) inline §6.7's normative content. The sentence
already carries the operational content (validate + coverage commands, both project-runnable —
`validate-procedures.ts` is L1, `procedure-coverage.ts` is truthfully annotated as workspace-only).
Inlining lifecycle prose duplicates the spec doc. **Picked (a)**: "Author procedures against
`docs/procedure-schema-spec.md`." The referent is delivered and self-standing.

### 6.4 D2 — **picked**: truthful rewrite; keep `docs/adr/` as the project-authored convention

Options: (a) repoint wholly to the `decision-record` skill / `docs/decisions/`; (b) keep
`docs/adr/NNNN-<slug>.md` as the forward-looking convention, remove both false claims, name the
3-section format inline. (a) conflates two artifact classes: ADRs (architecture, one decision
per file) and DEC records (gate-moment rulings — different skill, different path, ADR-0061).
Projects legitimately author their own ADRs after delivery. **Picked (b)**. Replacement text
contracted in §7.1.

### 6.5 D4 — **picked**: remove the phantom reference (stronger than disclaim)

Investigation finding: **the `stack-setup` agent does not exist at any layer** — workspace-root
`agents/` holds 9 files, none named stack-setup; `templates/common/agents/` holds 3. Disclaiming
a workspace-root location would point at nothing. The step's normative core (never install
without security review and explicit user approval) is self-standing. **Picked**: replace the
mention with PM-dispatch + security-review wording (§7.1). The same phantom in root `AGENTS.md`
§7 and `templates/common/AGENTS.md:598` is out of scope (§3) — candidate follow-up ticket.

### 6.6 D5 + D6 source wording

**D5**: repoint to `scripts/SCRIPTS.md` (verified delivered) and define the tier vocabulary in
the same blockquote: Tier 1 = workspace-root `scripts/` SSOT; Tier 2 = the published
`templates/common/scripts/` snapshot; Tier 3 = the project's own `scripts/` copy
(definition matches `templates/common/scripts/SCRIPTS.md:3-5`).

**D6 source wording (exact replacement for `CONSTITUTION.md:680`)**:

> Register new skills and skill changes through the `skill-lifecycle-manager` skill. See AGENTS.md §8 (Lifecycle Management) for the governance workflow.

Scrub-neutral by construction: plain text, no markdown links, no `docs/constitution/` paths
(no scrub rule touches it). Resolves at both layers: at L0 (`skills/skill-lifecycle-manager/`
and root `AGENTS.md` exist) and in delivered projects (both artifacts delivered). Note the
current line is dead at L0 too — root `docs/context.md` does not exist (verified).

### 6.7 D7 — **picked**: relocate to `docs/constitution/08-coding-guidelines.md` new §8.13; new L0 prose contracted to docs-writer

Existing L0 coverage: **none** — grep over `CONSTITUTION.md`, `docs/constitution/`, `AGENTS.md`
for context-commonization content returns zero hits (verified 2026-09-24). Relocation therefore
requires new L0 prose. Target: §8.13 "Context Commonization Review (ADR-0050)", immediately
after §8.12 "Variant Script Inheritance (ADR-0050)" (`docs/constitution/08-coding-guidelines.md:136`)
— the natural home, since the subsection explicitly extends ADR-0050's one-directional
inheritance rule from scripts to context.md files. At L0 all its references resolve
(`skills/context-commonization-review/`, `scripts/promote-context-section.ts`,
`scripts/audit.ts checkVariantContextCommonization`, ADR-0050 Part 3).

**No-loss inventory the §8.13 prose must carry** (docs-writer contract):
1. SSOT rule: context.md is the SSOT for genuinely-shared content; variant context files add only variant-specific content.
2. Trigger: after scaffolding a new variant (`create-variant` skill), and at minimum every 5 new variants or once per quarter.
3. Detection: `checkVariantContextCommonization()` in `scripts/audit.ts` — WARN-only heuristic mirroring `checkVariantScriptDrift()`, requires human judgment.
4. Decision rule (architect-owned): shared-by-nearly-all → promote via `scripts/promote-context-section.ts` (version-footer sync in `upgrade-project.ts` propagates it); shared-by-subset → shared skill or opt-in `docs/_common/` reference; coincidental → leave alone.
5. Diff-before-write: `promote-context-section.ts` shows a per-variant diff; near-identical text can carry a deliberate, load-bearing difference.
6. Pointers: `skills/context-commonization-review/SKILL.md`; ADR-0050 Part 3 for rationale, thresholds, worked examples.

The L567-style "not linked here" disclaimer is unnecessary at this target — L0 docs may link
freely. Context.md loses the subsection entirely (its audience — delivered projects — never
performs SSOT-maintainer reviews).

### 6.8 D8 — **picked**: remove; L0 coverage already exists (evidence)

The Workspace & Template Boundary Policy exists verbatim at the workspace root:
`CLAUDE.md:307` ("### 9. Workspace & Template Boundary Policy"), `GEMINI.md:229` ("### 6."),
`CODEX.md:142` ("### 7."). Removal from context.md is lossless at L0. In delivered projects the
policy is inapplicable (no `templates/` dir exists). No relocation prose needed.

### 6.9 Contradiction and drive-by edits

**Contradiction (L227 vs zone L263-266)**: the injected zone matches workspace AGENTS.md policy
(agents/*.md and skills/*.md MAY declare the exception with `lang_reason`); hand prose L227 says
the opposite — stale. **Direction: align the hand prose to the zone; delete the L229 duplicate**
(the zone's "Non-English Reference Material in Skills" section L296-302 covers the same
mechanism). The zone refreshes from CONSTITUTION.md and is not touched.

**Drive-bys (inside touched sections only)**:

| Site | Edit | Note |
|------|------|------|
| L8 | "IMMUTABLE after project creation" → "pipeline-maintained — make no hand edits after project creation" | keeps the variant-config redirect line |
| L69-80 | Add `.codex/` line to the directory diagram | `CODEX.md` stays unlisted like CLAUDE.md/GEMINI.md (the diagram lists dirs only) |
| L156 | One-line definition of the style-neutrality check: it verifies design docs prescribe no colors, fonts, or trends — style decisions stay project-owned | |
| L313-323 | Reword the circular sentence (L316) to "This project follows the coding standards in the key-rules list below." | ⚠️ INSIDE the COMMON-CONTEXT zone — see interplay note below |
| ~L484 | Remove one blank line of the pre-existing triple-blank run | makes `blankL0Refs` byte-stable on this file (its `\n{3,}` collapse currently drops the line at delivery) |
| L529 "noted above" | moot — the D7 removal deletes the sentence | |
| L480 | covered by D5 | |

**Zone-interplay note (L316)**: the COMMON-CONTEXT zone in context.md is the *source* side of
the variant-context domain; editing it adds at most one zone to T-20260924-005's pre-existing
26-zone would-overwrite inventory until variants refresh. Fix-at-source doctrine says fix it
here rather than let the circular sentence persist in all 13 variants; the delta is declared
here and triaged under T-005. If PM prefers zero T-005 interaction, skip this one drive-by —
it is the only defensible cut line.

### 6.10 Version footer

Bump to: `*context.md version: 2.11 — self-containment remediation: dead referents removed or repointed (D1-D8); design-foundation skill now delivered; Context Commonization Review relocated to workspace governance docs*`.

---

## 7. Implementation brief (by owner)

### 7.1 docs-writer — prose (R1, R2, R6, R7, R8-edit, R9, R10, R11, R12, R13)

All edits in `templates/common/docs/context.md` unless noted. Replacement intents (wording may
be polished, semantics may not):

- **D1 (L492)**: replace "See `docs/procedure-schema-spec.md` and constitution §6.7." with "Author procedures against `docs/procedure-schema-spec.md`."
- **D2 (L203-209)**: replace the subsection body with: project-level architecture decisions live in `docs/adr/NNNN-<slug>.md`; the first record creates the directory; one decision per file; immutable once accepted — reversal is a NEW record naming its predecessor via `Supersedes:`; use the 3-section format (Context, Decision, Consequences); gate-moment rulings additionally emit `docs/decisions/DEC-YYYYMMDD-NN.md` — see the `decision-record` skill.
- **D4 (L409)**: replace "route through the `stack-setup` agent" with "request installation through the PM" — keep the bolded prohibition verbatim.
- **D5 (L480)**: replace the blockquote with: "See `scripts/SCRIPTS.md` for the full lifecycle registry. Tier 1 is the workspace-root `scripts/` registry; Tier 2 is its published `templates/common/scripts/` snapshot; this project's `scripts/` copy is Tier 3."
- **D6 source (`CONSTITUTION.md:680`)**: apply the §6.6 wording exactly.
- **D7**: write §8.13 per §6.7's six-item inventory; delete context.md L505-529.
- **D8**: delete context.md L346-349 (heading + two bullets).
- **Contradiction**: apply §6.9; delete L229.
- **Drive-bys + footer**: apply §6.9 and §6.10.

### 7.2 automation-engineer — pipeline (R3, R4, R5, R8-rewrite)

1. Remove line 15 (`l2_propagate: false`) from `skills/design-foundation/SKILL.md`; keep `scope: common` (line 14). Update the two SKILLS.md row notes that cite the flag (`skills/SKILLS.md:43`, `templates/common/skills/SKILLS.md:40`).
2. Add to `docs/templates/common-contract.json` `common_skills`:
   `"design-foundation": {"source": "skills/design-foundation/SKILL.md", "version": "1.0.0", "overridable": false, "description": "Style-neutral design system derivation: principles, decision record, 3-layer token architecture"}` (mirror the ui-ux-design-intelligence entry shape).
3. Refresh mirrors: run `sync-skills` (platform copies pick up the flag-free SKILL.md), then `bun scripts/propagate-to-templates.ts --apply` (skills domain creates `templates/common/skills/design-foundation/`; platform domains refresh).
4. Execute the marker rewrite: `bun scripts/propagate-to-templates.ts --marker-rewrite --domain constitution-context --apply` after docs-writer's CONSTITUTION.md edit lands (same PR).
5. Run the §8 verification battery; attach outputs to the task report.

Sequencing: docs-writer prose first, then automation-engineer (the marker rewrite must not run
before the source edit, or it would rewrite the zone to the old wording).

### 7.3 Ownership note: `common-contract.json`

Assigned to **automation-engineer**, deliberately: the file is pipeline-consumed governance
config (validate-templates C-CM checks, upgrade-project) whose edit semantics are
pipeline behavior, not prose. docs-writer owns the `.md` files. Both roles land in one PR;
`/sync` finalization dispatches lifecycle-manager (contract governance-file trigger, AGENTS.md §8).

## 8. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | Mirror refresh via pipeline — `.claude/skills/design-foundation/` loses the stale flag; delivered projects gain the skill | `skills/design-foundation/SKILL.md`, `.claude/skills/design-foundation/`, `templates/common/.claude/skills/design-foundation/`, `templates/common/docs/context.md` |
| Antigravity (GEMINI.md) | Same mirror refresh for `.gemini/skills/` and `.agents/skills/`; no GEMINI.md body change required — the design touches no platform behavior file (context.md is platform-neutral shared reference) | `.gemini/skills/design-foundation/`, `.agents/skills/design-foundation/`, `templates/common/docs/context.md` |
| templates/common | `skills/design-foundation/` added (pipeline), `docs/context.md` remediated, SKILLS.md row note updated | `templates/common/skills/design-foundation/`, `templates/common/skills/SKILLS.md`, `templates/common/docs/context.md` |
| Codex | Mirror refresh for `.codex/skills/` (ADR-0077 parity) | `.codex/skills/design-foundation/`, `templates/common/.codex/skills/design-foundation/` |

Justification for no GEMINI.md/CODEX.md body change: every defect lives in shared or L0
governance surfaces; no platform-specific behavior statement changes.

## 9. Verification plan

Executed by automation-engineer; evidence attached to the task report:

1. **Workspace audit**: `bun scripts/audit.ts` → exit 0.
2. **Sanitizer simulation** (inline bun, as run during design): `blankL0Refs(fixed)` vs `blankL0Refs(current)` — expected deltas: none beyond the L429 marker blank (the triple-blank drive-by makes even that comparison byte-stable apart from the marker line).
3. **Propagation**: `--dry-run` → apply → `--dry-run` (AC3); grep battery (AC4).
4. **Contract checks**: `bun scripts/validate-templates.ts` before/after diff (AC6).
5. **Zone sync**: `--marker-rewrite --domain constitution-context` dry-run → apply → apply (AC7, idempotence + sibling-zone byte-identity).
6. **Scaffold simulation**: new-project into a scratch dir under `tests/.temp/` (or `simulate-pipeline`): presence checks, sweep-log check, delivered-reference resolution (AC5). Delete the scratch project afterwards.
7. **Inverted re-inventory**: re-run the audit's inverted reference scan on the fixed context.md; require zero DEFECT-class rows (AC8).
8. **Drift**: `propagate-to-templates --check-drift` — no new drift rows (skills domain is `l2_drift_eligible: false`; platform domains report in-sync after apply).

## 10. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Zone rewrite (D6) touches the sibling COMMON-CONSTITUTION zone via positional pairing | low | AC7 byte-identity check on the sibling + PR zones; the s33 design's single-zone-marker lesson already isolates the PR zone |
| COMMON-CONTEXT zone edit (L316) adds 1 to T-005's would-overwrite inventory | certain (by design) | Declared in §6.9; triage stays with T-005; skip-line documented if PM opts out |
| Frontmatter flip widens delivery surface to every variant's projects | certain (intended) | One skill dir; genuinely project-relevant; anti-swelling unaffected (context.md prose unchanged at L128) |
| Stale mirror copies retain the flag if sync-skills is skipped | medium | AC4 grep battery is mandatory; the scaffold sweep would otherwise still delete delivered copies |
| D7 relocation prose drops a load-bearing detail | low | §6.7 six-item inventory is the acceptance checklist (AC9) |

## 11. Accessibility exemption (ADR-0065)

Exempt. This change remediates governance documentation and a skill-propagation pipeline. It
produces no user-facing UI, CLI interaction surface, or generated document template. No
interaction areas are affected.

## 12. Preview-verification exemption (ADR-0070)

Exempt. No rendered UI change exists to preview. The equivalent "seen rendered" evidence for
this change class is the scaffold simulation (AC5): the delivered files are observed on disk in
a fresh project, and the delivered context.md reference is verified to resolve.

---

## 13. Provenance

- Defect inventory: two read-only audits, 2026-09-24 (context.md v2.10, 570 lines; line numbers against that revision).
- Owner D3 directive: mid-flight steering, 2026-09-24 — supersedes the audit's disclaim-only D3 disposition.
- Mechanism evidence: file:line citations in §1.2, §1.3, §6.1-§6.8, all verified at main `d92ad4c8` on 2026-09-24.

---

## 14. Addendum (2026-09-24) — D7 relocation target deviation: delivered §8.18, not §8.13

**Deviation.** Design said the relocated Context Commonization Review lands as a new §8.13
adjacent to §8.12 (R9, AC9, §6.7, §7.1 all say "§8.13"). Delivered reality: it landed as
**§8.18 "Context Commonization Review (ADR-0050)" at the end of the part file**
(`docs/constitution/08-coding-guidelines.md:195-204`). Sections §8.13–§8.17 already existed
(Computational Integrity, Accessibility ADR-0065, Schema Governance, UI Preview Verification
ADR-0070, Language Policy Enforcement Channels); inserting at 8.13 would have renumbered five
sections and broken at least 4 hub references — including the CONSTITUTION.md §8 hub summary
line (L514) and the immutable ADR-0065:42. Renumbering was rejected; appending was approved
in-session.

**Supersession.** Wherever this doc says "new §8.13", read **§8.18**. Heading sequence
8.1 → 8.18 is monotonic. AC9 is satisfied by §8.18: the six-item no-loss inventory (§6.7) is
fully carried — SSOT rule (opening statement), trigger cadence, `checkVariantContextCommonization()`
detection, architect-owned promote/extract/leave decision rule, diff-before-write, and the
`context-commonization-review` skill + ADR-0050 Part 3 pointers. context.md no longer carries
the subsection.

**For the record.**
1. The CONSTITUTION.md §8 hub summary line (L514) gains the missing Context Commonization
   Review sentence in a follow-up docs-writer step — in flight at the time of this addendum;
   the engineer's verification battery must not treat its absence as a D7 failure.
2. Spec `2026-09-24-context-md-self-containment-remediation-design` remains **status: draft**
   until the QA gate; the registry is not moved to implemented by this addendum.

---

## 15. Addendum 2 (2026-09-24) — post-implementation residuals: context.md Key Files row and the AGENTS.md `stack-setup` phantom

Post-implementation audits on 2026-09-24 (delivered-tree QA plus a repo-wide phantom sweep) found
two residuals in the same falsity families this spec already remediated. Both are contracted here.
Registry status of this spec stays **`implemented`** — this is a document-only extension; no
registry touch (precedent: the s33 sibling's post-implementation Amendment 2 records the same
ruling).

**Supersession.** §3 (Non-goals) excludes "the same phantom `stack-setup` references in root
`AGENTS.md` §7 and `templates/common/AGENTS.md:598`" (restated at the end of §6.5). Read that
exclusion as superseded by this section: the AGENTS.md phantom is now in scope (R16). No other §3
row changes. Also for the record: §14 item 2 described the pre-QA-gate state; the registry has
since moved to `implemented` (same day, after the QA gate).

### 15.1 R15 — context.md L91 Key Files row (residual 1)

Defect: the `docs/context.md` row in the Key Files table still reads "This file — immutable
project identity". Same falsity family as the L8 drive-by fixed in delivery ("pipeline-maintained
— make no hand edits after project creation"): the file is pipeline-maintained, not immutable.

Contract (docs-writer, `templates/common/docs/context.md`):

- L91: replace `This file — immutable project identity` with
  `This file — pipeline-maintained shared reference; make no hand edits`.
- Footer: bump to
  `*context.md version: 2.12 — Key Files: context.md row corrected to pipeline-maintained (was "immutable")*`.

No zone interaction: L91 and the footer sit outside every marker zone. R15 introduces no
L0-pattern content, so the `blankL0Refs` delivery-simulation expectation is unchanged.

### 15.2 R16 — AGENTS.md §7 Computational Integrity bullet (residual 2)

Defect: the bullet routes high-precision computation "via the `stack-setup` agent". Verified
phantom at every layer the bullet is delivered to: workspace-root `agents/` holds 9 files, none
named stack-setup; `templates/common/agents/` holds 3. (The name resolves in exactly two delivered
variants — co-develop, co-game — see §15.3.)

Contract (docs-writer, root `AGENTS.md:620` — the L1 copy follows by propagation, never by hand).

Replace the sentence:

> For aerospace, aviation, precision control, or regulated financial computations, delegate to a validated external tool (Fortran, Python+NumPy/SciPy, Julia, etc.) via the `stack-setup` agent.

with:

> For aerospace, aviation, precision control, or regulated financial computations, delegate to a validated external tool (Fortran, Python+NumPy/SciPy, Julia, etc.). If the tool is missing, request installation through the PM — **never install tools without security review and explicit user approval**.

This applies the D4 (context.md L406) replacement pattern to the AGENTS.md carrier: only the
phantom agent pointer is replaced. The validated-external-tool substance stays verbatim — the
tool list, the approximate-labeling rule, and the compute-via-executed-code rule. Nothing else in
the bullet changes.

Propagation (automation-engineer): root edit lands first, then run
`bun scripts/propagate-to-templates.ts --governance-l1`. That flag mode is the L0→L1 deployment
carrying `AGENTS.md → templates/common/AGENTS.md` (`GOVERNANCE_L1_FILES`,
`scripts/propagate-to-templates.ts:1082-1087`); it is not a propagation-map.json domain. Do not
route this through the `governance-agents` domain: that domain is the L1→L2 COMMON-AGENTS
zone injector, and the bullet sits outside the COMMON-AGENTS markers (L1 markers L224-292,
bullet L598), so zone injection cannot carry it. The replacement wording is transform-neutral
(no CONSTITUTION.md references, no workspace-root-only paths), so the L1 copy lands equal to the
L0 sentence. Sequencing mirrors §7.2: prose before propagation, or the propagate ships the old
wording.

### 15.3 Repo-wide `stack-setup` disposition (verification input)

Post-fix acceptance is NOT "zero hits repo-wide" — most hits are genuine records of delivered
things. The engineer classifies every remaining hit into this table in the task report; an
unclassifiable hit blocks the PR.

| Class | Hits | Disposition |
|-------|------|-------------|
| Phantom carrier (this contract) | root `AGENTS.md:620`; `templates/common/AGENTS.md:598` | fixed by R16 + `--governance-l1` |
| Resolving variant carriers | `co-develop/AGENTS.md:568`, `co-game/AGENTS.md:642` | leave — `agents/stack-setup.md` exists in both variants; referent resolves |
| Phantom variant carriers (follow-up ticket, NOT this change) | 10 variants, bullet at: co-deck:740, co-consult:620, co-design:576, co-work:560, co-hr:671, co-news:601, co-safety:1068, co-abap:404, co-export:643, co-security:546 | L2-owned prose outside the COMMON-AGENTS zone — does not self-heal from the L1 fix; each variant edits via its own pipeline (co-price carries no hit) |
| Genuine delivered agents | everything under `templates/co-develop/` and `templates/co-game/` (agent file, variant.json, rosters, raci/gates/stages, procedures, user guides, lifecycle records, variant skill-graph.json); `templates/README.md:40` + `README_ko.md:40` | leave — accurate records of delivered agents |
| Genuine delivered tooling and skill config | `zod-contract-gate/SKILL.md:57` agentRole enum (root `skills/` + 4 platform mirrors + 5 template mirrors); `templates/common/scripts/generate-ide-rules.ts:149,256`; `templates/common/scripts/helpers/merge-frontmatter.ts:860` | leave — project-side role lists for rosters that ship stack-setup; inert elsewhere |
| Generated or historical records | `docs/skill-graph.json`; `docs/variant-benchmark-backlog.md`; `docs/variant-roadmap-2026-q3-q4.md`; `docs/designs/` records (`variant-templates-advancement-design.md`, `2026-08-29-procedure-coverage-and-l0-design.md`, `pm-md-group-type-mapping-spec.md`, `pm-md-variant-specific-content-injection-design.md`, this doc's D4 record); `docs/lifecycle/templates/co-develop.md`, `co-game.md` | leave — never retro-edit design history or generated graphs |

Sharper variant-level phantom found during the sweep (file it, do not fix here):
`templates/co-abap/scripts/co-abap/setup.ts:20,373,375` instructs the user to invoke the
`stack-setup` agent and points at `agents/stack-setup.md` — co-abap ships no such agent file
(verified: 24 agent files, none named stack-setup). User-facing script output referencing a
missing file. Candidate follow-up ticket alongside the 10 variant AGENTS.md rows.

### 15.4 Addendum acceptance criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC11 | context.md L91 carries the R15 wording; footer reads 2.12; no other line changed. | diff |
| AC12 | Root AGENTS.md carries the R16 replacement; the same bullet in `templates/common/AGENTS.md` is byte-equal to root after `--governance-l1`; COMMON-AGENTS zone parity (validate-templates PM-02/PM-03) stays green — the edit is outside the zone. | grep + validate-templates |
| AC13 | Phantom-class sweep result per §15.3 (zero hits in the phantom-carrier class); `bun scripts/audit.ts` exits 0; L0 Leakage gate green; `blankL0Refs` simulation on the fixed context.md keeps the unchanged expectation. | sweep + audit + inline probe |

Platform impact: no platform behavior file changes — root AGENTS.md is platform-neutral
governance; templates/common gains the refreshed `AGENTS.md` (via `--governance-l1`) and the
edited `docs/context.md` (in place; no propagation needed — `templates/common/docs/context.md`
has no root counterpart).
