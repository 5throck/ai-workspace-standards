# Design: Schema Governance — Workspace-Wide ADR Baseline

**Date**: 2026-09-09
**Status**: Approved (architecture user-approved in session; this is the Row 0 Design Gate document)
**Source**: PM-dispatched architect task promoting a proven project rule to workspace baseline
**Spec ID**: 2026-09-09-schema-governance-adr-design
**Related**: [CONSTITUTION.md §8](../../CONSTITUTION.md), [docs/constitution/08-coding-guidelines.md](../constitution/08-coding-guidelines.md), [ADR-0062](../adr/0062-marker-based-doc-propagation-domains.md), [2026-08-24-marker-propagation-engine-design.md](2026-08-24-marker-propagation-engine-design.md), [ADR-0065](../adr/0065-accessibility-standard.md), `Projects/co-newbiz/CLAUDE.md` / `Projects/co-newbiz/GEMINI.md`

---

## Background

A rule — **"DB schema changes require an ADR"** — exists today only in the live project `Projects/co-newbiz` (`CLAUDE.md:398` and `GEMINI.md:366`, lifecycle-rules table row: `| DB schema, auth, MCP tool scope | ADR required — see the ADR trigger list in the design doc |`), referencing that project's design-doc §7 ADR trigger list. The workspace root (L0) has no equivalent baseline: `CONSTITUTION.md` §8 (Coding Behavior Guidelines) and `docs/constitution/08-coding-guidelines.md` (§8.1–§8.14) say nothing about schema-change governance.

A structural change to persisted data (tables, columns, constraints, indexes, migrations) is exactly the class of decision ADRs exist for: it is hard to reverse, it outlives the code that motivated it, and it deserves a written context → decision → consequences record. Every L3 project currently relies on ad-hoc project-level judgment to reach that conclusion.

**Decision**: promote the rule to a workspace-wide baseline, while preserving project-level trigger lists as authoritative supersets within their own projects.

### Baseline wording (to encode verbatim)

> Any database schema change — tables, columns, constraints, indexes, or migrations — requires an ADR before merge. Projects may maintain a broader project-specific ADR trigger list (e.g., auth boundaries, MCP tool scope); the project list is authoritative within its project, and the workspace baseline applies where no project list exists.

---

## Goals / Non-Goals

### Goals

- G1 — Single-source the rule body at L0: one summary entry in the `CONSTITUTION.md` §8 hub paragraph, one full subsection (`§8.15`) in `docs/constitution/08-coding-guidelines.md`.
- G2 — Propagate a self-contained summary into the L1 common template (`templates/common/docs/context.md`) via the existing `constitution-context` marker-inject domain — no hand-copied duplicate.
- G3 — Annotate the originating project (`Projects/co-newbiz`) in both platform files with a self-contained workspace-baseline note, preserving its richer project trigger list as the in-project authority.
- G4 — Dogfood the rule honestly: record explicitly why this change itself does not require an ADR.

### Non-Goals

- NG1 — **L1→L2 propagation** of the new section to variant templates' `docs/<variant>.context.md` is out of scope this round (see D5 / Future Work).
- NG2 — No mechanical enforcement (no audit.ts check that fails merges lacking an ADR). This round is a policy/documentation baseline only.
- NG3 — No changes to co-newbiz's project design-doc §7 ADR trigger list; the project list remains the in-project SSOT.
- NG4 — No new ADR document for this change (rationale recorded in D4).

---

## Decision

### D1 — Rule body SSOT: CONSTITUTION.md §8 + docs/constitution/08-coding-guidelines.md §8.15

The rule body lives at L0 in two coordinated places, following the established hub/detail pattern (the 08 file's header warns *"Do not edit in isolation — changes must be reflected in the hub index"*):

- **Hub entry**: append one summary sentence to the `CONSTITUTION.md` §8 summary paragraph (line 484), in the established `**Name**: text` style (no ADR number — see D4): `**Schema Governance**: any database schema change — tables, columns, constraints, indexes, or migrations — requires an ADR before merge; projects may maintain a broader ADR trigger list that is authoritative within the project (see §8.15).`
- **Full subsection**: append `#### 8.15 Schema Governance` after the current last subsection (8.14 Accessibility, file ends at line 161), containing the baseline wording above plus a short "project trigger list supersedes within its project" clarification and a pointer to the originating example (co-newbiz).

`docs/constitution/08-coding-guidelines.md` carries declared `lang: ko / lang_reason: source-material` frontmatter (a Language Policy exception for Korean source quotations in §8.6); **new §8.15 content stays English** — the exception covers existing Korean quotations, not new additions.

*Rationale*: the hub paragraph is what sessions actually load; the subsection is the citable normative text. Splitting them follows exactly the pattern used by §8.13/§8.14.

### D2 — Propagation to L1 via the constitution-context marker-inject domain

`CONSTITUTION.md` is the master source of the `constitution-context` domain in `scripts/propagation-map.json` (mode `marker-inject`, marker `COMMON-CONSTITUTION`, target whitelist: `templates/common/docs/context.md` only, scrub transform removes `docs/constitution/` links to satisfy the L0-leakage check). The engine (`scripts/propagate-to-templates.ts`, `extractCommonSections`/`replaceCommonSection`) copies marker zones from the source; zones whose heading does not yet exist in the target are **appended**.

Therefore: add a **new small `<!-- COMMON-CONSTITUTION:START/END -->` zone** in `CONSTITUTION.md` (immediately after the existing zone at lines 569–617, before §11) containing a `#### Schema Governance` section — the baseline wording, self-contained, **with no markdown links at all** (do not rely on the scrub transform to strip links; write it link-free so nothing dangles after scrubbing). Then run:

```
bun scripts/propagate-to-templates.ts --domain constitution-context --apply
```

which injects the zone into `templates/common/docs/context.md`. `templates/common/docs/context.md` is a **generated artifact** for this change — never hand-edited.

*Rationale*: this is the one sanctioned mechanism for getting CONSTITUTION content into L1; hand-copying would create exactly the untracked duplicate the marker engine exists to eliminate (ADR-0062).

### D3 — Projects/co-newbiz: self-contained baseline note, platform parity

Add one sentence below the "### Co Newbiz Lifecycle Rules" table (before "### Disclaimer"), **identical in both** `Projects/co-newbiz/CLAUDE.md` and `Projects/co-newbiz/GEMINI.md` (platform parity):

> Workspace baseline: any database schema change — tables, columns, constraints, indexes, or migrations — requires an ADR before merge; the project-specific ADR trigger list above remains authoritative within this project and is a superset of this baseline.

**Constraint**: no links to workspace-root paths (`CONSTITUTION.md`, `docs/constitution/`) from L3 platform files — the workspace enforces L0-leakage prevention (see the `L0-ONLY` comment at `co-newbiz/CLAUDE.md:4` and the scrub-transform rationale). The note is therefore fully self-contained. The project's existing table row (line 398 / 366) stays as-is, still pointing at the project design doc's fuller trigger list.

*Rationale*: co-newbiz already had the strictest form of the rule; the note records that the workspace has caught up to (not overwritten) the project standard, without an L0 reference that would fail the leakage check.

### D4 — No new ADR for this change (dogfooding rationale, recorded explicitly)

This change is **governance documentation**, not a database schema change. The new baseline is scoped to database schema changes; it does not require an ADR for policy-document promotion itself. The Row 0 Design Gate document (this file) plus the PM Gateway workflow provide the review trail. Creating an ADR here would misapply the rule to its own birth — the honest dogfood is to state that scoping explicitly, which this section does.

### D5 — L1→L2 chain is a non-goal this round

The injected zone uses the `COMMON-CONSTITUTION` marker, which the `variant-context` domain (variant templates' `docs/<variant>.context.md`, `--docs` flag) does **not** consume. Carrying the section to variants would require either extending that domain or adding a new mapping — a separate decision, appropriately gated, because the marker-propagation engine is a WARN-stage pilot per ADR-0062 and the 2026-08-24 marker-propagation-engine design. **Future work**: decide whether `Schema Governance` should reach L2 variant context files, and via which domain, after the engine graduates from pilot stage.

---

## Proposed Changes

| # | File | Action | Change |
|---|------|--------|--------|
| 1 | `CONSTITUTION.md` | Modify | Append `**Schema Governance**: …` summary sentence to the §8 hub paragraph (line 484) |
| 2 | `CONSTITUTION.md` | Modify | Add new `<!-- COMMON-CONSTITUTION:START/END -->` zone with `#### Schema Governance` (link-free), after the existing zone (line 617), before §11 |
| 3 | `docs/constitution/08-coding-guidelines.md` | Modify | Append `#### 8.15 Schema Governance` (full baseline wording, English) after §8.14 (line 161) |
| 4 | `templates/common/docs/context.md` | Generated | Via `bun scripts/propagate-to-templates.ts --domain constitution-context --apply` — verify the appended `#### Schema Governance` zone and that no `docs/constitution/` links remain |
| 5 | `Projects/co-newbiz/CLAUDE.md` | Modify | One-sentence workspace-baseline note below the lifecycle-rules table (before "### Disclaimer") |
| 6 | `Projects/co-newbiz/GEMINI.md` | Modify | Identical note (platform parity with #5) |

Execution order: **Sequential** — rows 1–2 before row 4 (propagation reads the source); rows 3, 5, 6 independent of row 4. Row 4 must be verified with a diff of `templates/common/docs/context.md` before commit (second source zone is the engine's less-traveled path — see Trade-offs).

Verification checklist:
- [ ] `bun scripts/audit.ts` passes (L0-leakage check: no workspace-root links in L1/L3 files)
- [ ] `templates/common/docs/context.md` diff contains exactly one new `#### Schema Governance` zone, link-free
- [ ] co-newbiz CLAUDE.md and GEMINI.md notes are byte-identical
- [ ] No `docs/constitution/08-coding-guidelines.md` Korean-content drift; new §8.15 is English

---

## Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | changes required | `Projects/co-newbiz/CLAUDE.md` |
| Antigravity (GEMINI.md) | changes required | `Projects/co-newbiz/GEMINI.md` (parity with Claude) |
| templates/common | propagation required | `templates/common/docs/context.md` via `constitution-context` domain (generated, not hand-edited) |

---

## Trade-offs

- **Single PR, sequential**: all six file changes land in one PR, executed sequentially. Rationale: `dev-sync.ts` touches shared pipeline files on every commit, so per CONSTITUTION §3.3 (Sequential Branch Dependency Rule) unmerged parallel branches conflict by default; and splitting the L0 SSOT change from its L1 propagation would leave a window where the hub says one thing and the template another.
- **Second marker zone in the source (D2)**: the source currently has one `COMMON-CONSTITUTION` zone; adding a second exercises a path the pilot-stage engine (ADR-0062, WARN stage) has less history with. Mitigation: inspect the `--apply` diff on `templates/common/docs/context.md` before commit; if the engine mishandles the second zone, fall back to extending the existing zone (acceptable, slightly less cohesive) — engine fix is out of scope for this spec.
- **Manual duplicate in co-newbiz (D3)**: the one-sentence note duplicates baseline wording by hand (L3 files cannot reference L0). Surface is minimal (one sentence) and semantically anchored ("superset"), so drift risk is low; the project trigger list remains the in-project authority, so an outdated note degrades to the workspace baseline — which is still correct.
- **No mechanical enforcement (NG2)**: the rule is prose-only this round; compliance depends on session context loading. Accepted because the originating project demonstrates the prose rule works in practice; an audit.ts ADR-presence check is a candidate follow-up, not a rides-along.

---

## Accessibility

**Explicit exemption per ADR-0065** (backend/non-UI exemption, stated as required): this is a documentation-only governance change with no user-facing UI, CLI, or generated-document interaction surface. No keyboard, screen-reader, contrast, motion, or target-size impact. No accessibility verification method applies beyond standard Markdown review.

---

## Open Questions

- None blocking implementation. For the record: whether `audit.ts` should eventually WARN (then FAIL) on schema-migration file changes lacking a same-PR ADR — deferred as NG2/Future Work, to be decided independently of this documentation baseline.
