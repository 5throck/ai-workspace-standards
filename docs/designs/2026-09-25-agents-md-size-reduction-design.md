# AGENTS.md Size Reduction Design — Thin Dispatcher, Marker Governance, L0 Diet

- **Date**: 2026-09-25
- **Status**: Approved (user decision 2026-09-26, Option 1 — full restructure; see meeting `memory/meeting-2026-09-26-agents-md-thinning-plan-review.md`)
- **Related**: ADR-0088 (Hermes platform support — truncation origin), ADR-0074 (Design Gate), ADR-0043/Fork-Model (variant agents), `docs/analysis/2026-09-25-agents-md-size-analysis.md` (measurement input — required reading)
- **Scope**: Structural remedy for the context-cap truncation finding. Changes AGENTS.md structure at L0/L1/L2, the propagation machinery, and validators. Does NOT change any governance rule's content — rules move or get pointerized, never weakened.

---

## 1. Problem

Every AGENTS.md exceeds Hermes Agent's default 20,000-char context-file cap (L0 57,018 / L1 49,190 / L2 27,927–82,099), so context-file-based consumers silently lose everything past the cap — in 11 of 13 variants the loss lands inside the COMMON-AGENTS governance zone (Design Gate, LLM routing, STE100, PM authority). The interim remedy (`context_file_max_chars 100000`, documented AGENTS.md §6 / CONSTITUTION §11) is user-side and per-harness; it does not generalize. The measurement and cut-position map are in `docs/analysis/2026-09-25-agents-md-size-analysis.md` (key facts: zero byte-identical H2 sections across the 13 variant bodies — fork-drift, not copy-paste; §3 PM Gateway + §4 Other Workflows + §2 agent definitions + rosters carry the weight; rosters restate `variant.json`/`agents/*.md` SSOT data).

### 1.1 Duplication-audit evidence (2026-09-25)

The companion duplication audit (`docs/analysis/2026-09-25-agents-md-duplication-audit.md`) confirms the weight is also a dual-maintenance liability: the L0 COMMON-AGENTS zone's ADR-0078/0079/0080 summaries are near-verbatim copies of owned §3 subsections (tok 0.89–0.97); PM Gateway is double-registered in AGENTS §3 vs CONSTITUTION §5.5 (tok 0.66); §1↔§2 roster restatement is HIGH (0.83–0.94) in all 13 variants; the context.md `## Agents` sync rule is unenforced and unmet 13/13 (strict subsets); and audit.ts check #29 silently skips 3 of 12 projects whose AGENTS.md lacks the exact `## §6: Skills` heading.

### 1.2 Design-review amendments (2026-09-26, six-role meeting — A–H)

A six-role review (architect / automation-engineer / docs-writer / auditor / security-expert / red-team; transcript in `memory/meeting-2026-09-26-agents-md-thinning-plan-review.md`) amended this design before implementation:

- **A — Zone reuse**: no second managed zone. The existing COMMON-AGENTS zone (label hardcoded across ~10 consumers) carries the pointer table + load contract. The earlier COMMON-AGENTS-GOVERNANCE new-zone idea is withdrawn.
- **B — Move target split**: §3/§5 operational bodies → `docs/governance/*.md` (NOT into CONSTITUTION §5.5 — CONSTITUTION.md:169 already delegates AGENTS-ward; CONSTITUTION keeps MUST-level policy only, and its deference anchors retarget to the governance files).
- **C — Validators first (W0)**: size-budget (WARN), pointer-integrity, audit §-gate alignment, and Phase B-AGENTS die-guard land BEFORE any restructure — no unenforced window.
- **D — Dedicated AGENTS_RESTRUCTURE upgrade step**: MERGE preserves out-of-zone content, so fleet conversion needs a one-time restructure step (CONTEXT_COMMONIZATION pattern + pre-reconcile snapshots); MERGE alone cannot strip legacy bodies.
- **E — Mirror twins keep full content**: CLAUDE/GEMINI/CODEX.md (26.7k/26.2k/15.4k) serve cap-less harnesses and keep their bodies; they gain the pointer table for navigation. Platform-parity checks updated to the new AGENTS shape.
- **F — Security additions**: governance reference-file hash manifest; MERGE divergence WARN (tamper visibility); roster-generation escaping; §3.7.5 partitioned as L0-only (stays inline in L0 AGENTS.md, never ships in fleet-delivered governance files); non-overridable security floor kept inline.
- **G — Load contract + anchor inventory**: the enforceable load-contract text (meeting transcript) sits in the first screen; anchor updates enumerated (CONSTITUTION ~10, twins ~14, scripts ~10, skill 4-copy sets, README/README_ko) with terminology registration.
- **H — Mechanical preservation gate**: normalized text-coverage diff of every moved section against the git-history original — relocation-only is machine-verified, not review-verified.

Accepted red-team risks (verbatim dissent in the meeting transcript): objection 3 (adjudication one-way door) mitigated by C+D+H; objection 4 (budget pressure) mitigated by WARN-first and the relocation-only gate; objections 1 (config sufficiency) and 2 (4-harness context loss) accepted by user decision, with E minimizing the loss.

## 2. Goals / Non-Goals

**Goals**

- G1: **Size budget — every AGENTS.md ≤ 15,000 chars** (25% headroom under the 20k default cap), enforced by a fail-closed validator arm after soak.
- G2: Zero governance loss — every moved section keeps a canonical home (reference file or SSOT) reachable by pointer from the thin AGENTS.md.
- G3: End the 14-edition fork-drift of §3/§5-style governance skeleton via marker governance (the COMMON-AGENTS mechanism, extended).
- G4: Variant specificity preserved — genuinely variant-specific rules survive in short, variant-owned "Variant Overrides" sections.

**Non-Goals**

- N1: No change to CLAUDE.md/GEMINI.md/CODEX.md structure in this effort (same disease, separate prescription; their §-bodies are already marker-managed where it matters).
- N2: No behavioral change to any PM Gateway rule — the adjudication sweep may not edit rule content, only relocate or point.
- N3: No harness-side changes — the config remedy stays documented for users who skip upgrades.

## 3. Design Decisions

- **D1 — Thin-dispatcher shape (S2)**: every AGENTS.md becomes: header + pointer table (first screen) → roster summary (generated) → section index with reference-file pointers → variant overrides (L2 only) → managed marker zones. Budget-fitting target shape ≤ 15,000 chars. Deep content moves to reference files under `docs/governance/` (L0: `pm-gateway-workflow.md`, `workflows.md`, `execution-plan-templates.md`; delivered to projects by scaffold/upgrade so project agents can Read them locally).
- **D2 — Load contract**: the header pointer table MUST state that section bodies live in the referenced files and MUST be Read before governing work. All five supported harnesses have file-read tools; the pointer table is the contract. validate-templates gains a pointer-integrity arm (every referenced file exists at every layer that ships it).
- **D3 — Marker governance extension (S3)**: a second managed zone (`COMMON-AGENTS-GOVERNANCE`) carries the canonical §3-summary/§5-summary into L1/L2 via the existing marker-inject machinery — same mechanism as COMMON-AGENTS, byte-constant everywhere. The 13 diverged §3/§5 editions are adjudicated against the L0 canonical: identical-intent drift adopts canonical; genuinely variant-specific rules are preserved (shortened if prose) into the variant's "Variant Overrides" section; stale duplicates drop. Adjudication outcomes recorded per variant in this document's Addendum.
- **D4 — Roster generation (S3)**: §1/§2 roster tables generate from `variant.json` `agents[]` + `agents/*.md` frontmatter at propagation time (regen step 4.62-class), eliminating hand-maintained duplicate data. Generation is deterministic; hand edits to roster tables are overwritten by design (SSOT: variant.json).
- **D5 — L0 diet (S4)**: §6 curated skills table → pointer to `docs/VERSION_MANIFEST.md` (already the declared SSOT); §3 tables duplicated from `agents/pm.md` → single home in pm.md, pointer from AGENTS.md; §3 body → `docs/governance/pm-gateway-workflow.md` with a rule-summary retained inline.
- **D6 — Budget enforcement**: `validate-templates.ts` arm `agents-md-size-budget` (FAIL: any AGENTS.md > 15,000 chars at L0/L1/L2) after a WARN soak; `audit.ts` gains the same check for the workspace root. `sync` pipeline order guarantees propagation precedes validation.

## 4. Waves

| Wave | Content |
|---|---|
| W1 | L0 diet (D5): create `docs/governance/{pm-gateway-workflow,workflows,execution-plan-templates}.md` (content moved verbatim), §6 → pointer, roster/table dedupe vs `agents/pm.md`; L0 target ≤ 40k intermediate |
| W2 | L0 thin-dispatcher restructure (D1/D2): pointer table + load contract + section index; L0 ≤ 15k |
| W3 | Marker governance (D3): COMMON-AGENTS-GOVERNANCE zone + adjudication sweep of the 13 variant §3/§5 editions (wave-gated 4–5 variants per sub-wave, outcomes in Addendum); roster generation (D4) |
| W4 | Validators (D6) + propagation wiring (governance-l1, marker-inject, scaffold/upgrade delivery of reference files) + docs (07-new-project, 06-skill-lifecycle cross-refs) |
| W5 | Fleet rollout (upgrade-project) + live Hermes re-verification (all AGENTS.md fit the default cap — config remedy becomes optional) + soak |

Each wave lands as its own PR per the Sequential Branch Dependency Rule.

## 5. Acceptance Criteria

- AC1: every AGENTS.md at L0/L1/L2 ≤ 15,000 chars (mechanically checked).
- AC2: every section removed from an AGENTS.md is reachable via a pointer that resolves at the same layer (pointer-integrity check green).
- AC3: adjudication Addendum records a disposition for all 13 variants' §3 and §5 editions.
- AC4: live Hermes session loads full AGENTS.md with NO truncation warning at default config.
- AC5: no governance rule text lost — diff review confirms relocation-only for W1–W2 (verbatim moves), adjudication-approved edits for W3.

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Harnesses/agents skip the pointers and miss governance | Pointer table is the file's first screen with an explicit load-contract line; pointer-integrity validator; W5 live verification across harnesses |
| Adjudication mistakenly drops a variant-specific rule | N2 forbids rule-content edits; per-variant Addendum dispositions reviewed in the wave PRs |
| Generated rosters lose nuance (notes columns) | Generator preserves variant.json fields verbatim; nuance moves to `agents/*.md` (its SSOT) |
| Propagation regressions across 14 templates | Re-uses the proven marker-inject path; W4 adds the budget arm before W5 fleet rollout |

## 7. Platform Impact

| Surface | Impact |
|---|---|
| Hermes Agent | Primary beneficiary — AGENTS.md fits the default cap; config remedy optional |
| Claude Code / Gemini / Codex / Antigravity | Thin AGENTS.md + reference files; agents Read references on demand (file-capable everywhere); load contract stated in-file |

## 8. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: exempt — documentation-structure infrastructure; no user-facing UI.
- **Preview Verification (ADR-0070)**: exempt — no rendered UI artifact; verification is mechanical (size/pointer checks) plus live-session (AC4).

## 9. References

- Analysis input: `docs/analysis/2026-09-25-agents-md-size-analysis.md` (measurement, cut map)
- Duplication audit: `docs/analysis/2026-09-25-agents-md-duplication-audit.md` (F1–F8 findings feeding D3/D4/D5 and the new size-budget validator)
- ADR-0088 + its Addendum 1 (truncation origin, config remedy); COMMON-AGENTS marker mechanism (AGENTS.md injection, `propagate-to-templates.ts`)
- CONSTITUTION §6 (skill lifecycle), `docs/VERSION_MANIFEST.md` (skills SSOT), `variant.json` schema (roster SSOT)
