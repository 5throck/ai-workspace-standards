# Governance workflows.md Variant Delivery — Rewrite as Roster-Agnostic L1 Guidance — Design

- **Spec ID**: `2026-10-28-governance-workflows-variant-delivery`
- **Date**: 2026-10-28
- **Author**: Template Architect + Documentation Writer (combined dispatch, Design Gate Row 0)
- **Ticket**: T-20261027-016 (manual) — provenance: T-20261027-015 findings, co-design PR #59 (R3 deletion), resync 2026-10-27 Step 4
- **Status**: implemented — option (a) selected and landed per DEC-20261028-01 (user standing blanket directive on ticket processing, 2026-10-28: design plus implementation in one landing).

## 0. Conclusion

Rewrite the L1 copy `templates/common/docs/governance/agents/workflows.md` as roster-agnostic variant lifecycle guidance, and make the rewrite durable by moving the file out of the verbatim L0→L1 propagation domain (`agents-governance-docs.exclude`). Content resolves the contradiction; the classification change makes it survive the next propagation run and the CI drift gate. The root file `docs/governance/agents/workflows.md` stays untouched — it is accurate for the L0 nine-agent roster it documents.

## 1. Context

### 1.1 The delivered file describes a roster that does not exist at the delivery target

`templates/common/docs/governance/agents/workflows.md` is a verbatim L0 relocation (its own header says so) of the workspace root's `docs/governance/agents/workflows.md`. It documents the nine-agent root roster's dispatch protocol, role boundary matrix, harness engineering workflow, and lifecycle/skill-review schedules. Variant projects receive it via L1 delivery, where it (a) describes a roster that does not exist in the variant, (b) contradicts variant phase rules (root Phase 6 is specialist-autonomous; variants are PM-owned), and (c) duplicates the AGENTS.md §4/§8/§9/§10 thin-dispatcher sections. co-design deleted it deliberately (PR #59 R3); every upgrade wave resurrects it (T-20261027-015).

### 1.2 Delivery mechanics (verified against code, 2026-10-28)

| Leg | Mechanism | Consequence |
|---|---|---|
| L0→L1 | `agents-governance-docs` domain in `scripts/propagation-map.json` copies `docs/governance/agents/*.md` → `templates/common/docs/governance/agents/`, scrubbing CONSTITUTION.md references (`scripts/lib/constitution-scrub.ts`) | A hand-rewrite of the L1 file is flagged `differs` and clobbered by the next `propagate --apply`; CI (`propagate --check-drift --json`, `.github/workflows/test.yml` L239) fails on the divergence |
| L1→L2 projects | TEMPLATE TREE SYNC pass (`scripts/upgrade-project.ts` + `scripts/lib/upgrade-policy.ts`) delivers by default (deny-list coverage) | Deleting the file project-side does not survive an upgrade wave — the resurrection co-design experienced |
| Fresh scaffolds | `scripts/new-project.ts` `copyDir(commonDir, projectDir)` | New projects receive whatever L1 carries |
| Parity checks | `validate-templates.ts` has no L0/L1 parity check on this path (only the agent-reference extractor lookbehind and the propagation-map schema PM-01) | No validator forces the L1 copy to equal the L0 file |

### 1.3 Reference surface (verified by grep, 2026-10-28)

The reference surface is wider than the ticket recorded. Fourteen variant AGENTS.md skeletons (co-abap, co-consult, co-deck, co-design, co-develop, co-export, co-game, co-hr, co-learning, co-news, co-price, co-safety, co-security, co-work) plus `templates/common/AGENTS.md` (L193/277/281/285), `templates/common/CLAUDE.md`, and `templates/common/GEMINI.md` all point at `docs/governance/agents/workflows.md` with load-bearing "Read it before X" mandates. Retiring delivery dangles all of them, fleet-wide.

## 2. Options

| Option | Description | Pro | Con | Verdict |
|---|---|---|---|---|
| (a) Rewrite the L1 copy as roster-agnostic variant lifecycle guidance | Author variant-context content at the same path; exclude the file from the verbatim propagation domain so L1 maintains it | Every AGENTS.md reference stays truthful with zero skeleton edits; every variant stays governed; the root file stays accurate for the root roster; resolves the co-design objection by content, so the deletion conflict dissolves | One more L1-maintained file that must not drift from variant reality; the propagation-map exclusion is a governance decision that needs a DEC record | **Selected** |
| (b) Retire L1 delivery and re-point skeletons at the L0 file | Fleet-wide AGENTS.md skeleton edit (14 variants + common, 40+ lines), then propagate | Single source of truth at L0; no duplicated guidance | Breaks L1/L2 standalone-ness (projects cannot resolve `../../docs/governance/...` into the workspace root); a 14-variant skeleton edit plus propagation is high-churn structural surgery; the L0 file's nine-agent roster content is actively misleading in a variant context even when it resolves | Rejected |
| (c) Status quo plus per-project deletion | Keep verbatim delivery; delete project-side copies each wave | No template-side change | The current pain: churn every upgrade wave, and each resurrection re-introduces the contradiction; the deletion conflict re-opens every wave (the exact U-005-adjacent loop D4 was written to end) | Rejected |

### 2.1 Reconciliation with the sync-overwrite-policy design (D4)

D4 (`docs/designs/2026-10-27-sync-overwrite-policy-design.md`) rejected a project-owned claim manifest and ruled that the sanctioned path for keeping locally-evolved state is "a governance decision that changes the template-side classification" — not a per-project policy fork. This design takes exactly that path at the template layer: adding `workflows.md` to the `agents-governance-docs.exclude` list (the propagator's only sanctioned carve-out, schema-validated by PM-01) reclassifies the file from "verbatim L0 mirror" to "L1-maintained governance doc". No deny-list claim, no project-side manifest, no exception machinery. After the rewrite lands, the project-side deletions stop being divergences that need preserving — the delivered content itself becomes the version co-design wanted, so the TREE SYNC re-delivery resolves the loop instead of perpetuating it.

## 3. Content requirements for the rewrite

The rewritten file is variant-context guidance maintained at L1. Its header must NOT claim "verbatim from L0"; it states its own maintenance model. Its roster SSOT is the project's AGENTS.md §1 plus `variant.json` `agents[]` — never the root nine-agent roster. Section structure mirrors the root file so the AGENTS.md "Read it before lifecycle finalization / before orchestrating" mandates stay meaningful:

| Root section | Variant rewrite |
|---|---|
| Header + load contract | Variant-context header: L1-maintained, companion to AGENTS.md §4/§8/§9/§10; load contract kept |
| §4.1 PM Subagent Dispatch Protocol | Dispatch decision (parallel reads / serial writes), tier adjustment rules, dispatch rules kept; Subagent Roster table replaced by a pointer to AGENTS.md §1 + `variant.json` `agents[]` |
| §4.2 Harness Engineering Workflow | Phase map kept, variant-calibrated: Phase 6 QA is PM-owned in variants (the variant PM runs the qa scripts; the root's autonomous auditor gate is L0-only) |
| §4.3 Role Boundary Matrix | Generic resolution rows + the `VARIANT-ROLE-BOUNDARY` marker zone preserved as the project's extension point |
| §8 Lifecycle Management | Phase 5 finalization trigger table kept (it decides WHEN, roster-agnostically); the WHO is the project's own PM (the root's lifecycle-manager is an L0-only agent absent from variant rosters); lifecycle records live in the project's `docs/lifecycle/` tree; variant status admission summary kept |
| §9 Maintenance Rule | New-agent / new-skill duties kept, pointed at the project's own roster surfaces (AGENTS.md, `variant.json`, `docs/lifecycle/`) and the project's skills/ set |
| §10 Periodic Skill Review Schedule | Quarterly cadence, triage severities, trigger conditions, deprecation sweep — scoped to the project's skills/ set |

Constraints: no "verbatim from source" framing; no nine-agent roster specifics; no contradictions with the thin-dispatcher sections; no CONSTITUTION.md / docs/constitution/ / docs/adr/ link targets (the file leaves the scrubber's pipeline, so it must be authored scrub-clean); references to root-only mechanics are qualified per the citation-qualifier convention, e.g. "(L0 workspace root — applies to the root roster)".

## 4. Files to change

| File | Action | Description |
|------|--------|-------------|
| `templates/common/docs/governance/agents/workflows.md` | rewrite | Roster-agnostic variant lifecycle guidance (§3 above) |
| `scripts/propagation-map.json` | modify | `agents-governance-docs.exclude: ["workflows.md"]` + note records the T-20261027-016 decision |
| `docs/designs/2026-10-28-governance-workflows-variant-delivery-design.md` | create | This design |
| `docs/decisions/DEC-20261028-01.md` | create | Decision record (ticket, directive, option, interim posture) |
| `docs/specs/entries/2026-10-28-governance-workflows-variant-delivery-design.json`, `docs/specs/registry.json` | regenerate | Spec registration per ADR-0074 |

Explicitly NOT changed: the root `docs/governance/agents/workflows.md` (accurate for L0); any of the 16 AGENTS.md/CLAUDE.md/GEMINI.md reference sites (same path, now truthful content); `skill-graph.json` and `docs/VERSION_MANIFEST.md` (verified: neither tracks this path; dev-sync regenerates the skill graph opportunistically and it has no node for this doc).

## 5. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — root-side governance prose only references the L0 sibling path, which is unchanged | N/A |
| Antigravity (GEMINI.md) | None — same reasoning; the L1 `templates/common/GEMINI.md` pointer text is generic ("Read it before X") and stays truthful against the rewritten content, no edit required (justification: the pointer names the path and the duty areas, both preserved) | N/A |
| templates/common | Propagation required — the rewritten workflows.md and the propagation-map exclusion land at L1 and reach existing projects via the next upgrade wave's TEMPLATE TREE SYNC; fresh scaffolds receive them at creation | `templates/common/docs/governance/agents/workflows.md`, `scripts/propagation-map.json` |

## 6. Acceptance criteria

- [ ] The rewritten file contains no "verbatim" claim, no nine-agent roster table, no CONSTITUTION.md/docs/constitution//docs/adr/ link targets.
- [ ] `grep -r "verbatim from the source" templates/` returns 0 hits on this path.
- [ ] Every internal reference in the rewritten file resolves under `templates/common/` (and therefore in every scaffolded project).
- [ ] The 14 variant skeletons' and common AGENTS.md/CLAUDE.md/GEMINI.md references to `docs/governance/agents/workflows.md` remain valid without edits (same path; content now covers the promised duty areas).
- [ ] `bun scripts/propagate-to-templates.ts --check-drift` reports no drift for `agents-governance-docs` (exclusion effective).
- [ ] `bun run test:unit`, `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`, `bun scripts/verify-scripts.ts --verify` all exit 0 with no new findings.
- [ ] The root `docs/governance/agents/workflows.md` is byte-identical to its pre-task state.

## 7. Consequences

- The L1 file becomes hand-maintained variant guidance: future edits to the root workflows.md no longer flow into it automatically. Variants are deliberately governed differently from the root roster, so this coupling was the bug, not the feature.
- The next upgrade wave re-delivers the rewritten file to all projects, including co-design. That delivery is the D5-adjacent adjudicated resolution: the template side now carries the content the project wanted, so no project-side preservation is needed.
- External adoptions that upgraded before this landing keep a stale verbatim copy until their next upgrade; the upgrade note in the PR body should mention the content change.
