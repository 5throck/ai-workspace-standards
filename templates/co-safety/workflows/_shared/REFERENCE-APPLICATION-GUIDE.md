# Shared Workflow Reference-Application Guide

> **Status**: Phase 1 (Action Item A-08) — Practitioner guide. Companion to [`REFERENCE-SPEC.md`](./REFERENCE-SPEC.md).
> **Owner**: Safety Governance Manager (SGM)
> **Audience**: AI agents that scaffold new industry domains, and human authors who add a new industry's adoption of a shared workflow.
> **Language**: English (Layer A — governance/system guide consumed by tooling and future industry authors).
> **Scope**: `workflows/_shared/` and all industries under `workflows/domains/industry/`.

---

## 1. Purpose

This guide explains **how an industry adopts a shared workflow without duplicating it**. It is the practitioner-facing companion to [`REFERENCE-SPEC.md`](./REFERENCE-SPEC.md), which is the canonical specification. Use this guide when:

- You are adding a new industry that should consume the shared **TBM (Tool Box Meeting)** workflow, or
- You are lifting a future shared workflow (post-Phase 2) and need to migrate per-industry duplicates to thin references.

The shared-workflow pattern exists to eliminate duplication: instead of copying the TBM workflow into every one of the 15+ consuming industries, an industry declares a thin **`references:`** block that points to the shared base and declares only its industry-specific overrides.

> **Read REFERENCE-SPEC.md first.** This guide summarizes and links to the spec; it does not restate it. The spec is authoritative where the two disagree.

---

## 2. The Pattern in One Paragraph

An industry does **not** keep a full copy of a shared workflow under its own directory. Instead, it creates a thin workflow directory that contains only a `schema.yaml` with a top-level `references:` block pointing to the shared workflow directory, plus any industry-specific overrides (representative hazard, additional statutes, optional evidence model). At scaffold and audit time, the shared base is merged with the overrides to compute an **effective schema** for the industry. The shared README is the single human-readable source for the workflow's common content; the industry does not duplicate that prose.

---

## 3. The `references:` Block Anatomy

A `references:` block lives at the top level of an industry's `schema.yaml`, alongside the standard fields (`workflow_id`, `title`, `status`, `industry_profile`, `agent`, …). Full field rules are in [`REFERENCE-SPEC.md §3.3`](./REFERENCE-SPEC.md#33-field-rules); the shape is:

```yaml
references:
  - shared: ../../../../_shared/<workflow-name>      # REQUIRED — relative path to shared dir
    overrides:
      signature_hazard: "<industry-specific hazard>" # REQUIRED for tbm; optional elsewhere
      legal_basis:
        add:                                          # PREFERRED — additive
          - "<industry statute> Article N"
      # legal_basis:
      #   replace:                                    # DISCOURAGED — needs justification
      #     - "<alternative statute> Article N"
      #   justification: "..."
      evidence_model: <path>                          # OPTIONAL — only when overriding shared EM
```

| Element | Required? | Notes |
|---------|:---------:|-------|
| `references[].shared` | Yes | Relative path from the industry `schema.yaml` to the shared workflow **directory** (no trailing `/`, no `.yaml`). From `workflows/domains/industry/<industry>/<wf-dir>/schema.yaml` the path is `../../../../_shared/<wf>` (four levels up). Spec §3.4. |
| `overrides.signature_hazard` | Conditional | Required when the shared workflow defines `signature_hazard` as mandated (currently `tbm`). Spec §3.3. |
| `overrides.legal_basis.add` | Optional | A list of statute citations appended to the shared base. **Never** removes the common statutory floor. Spec §4.1. |
| `overrides.legal_basis.replace` | Discouraged | Replaces the shared `legal_basis` entirely. Requires a `justification:` note or the audit fails. Spec §4.2. |
| `overrides.evidence_model` | Optional | Path to an industry-specific evidence model. Use only when a shared EM is insufficient (e.g. `ehsconst` retains construction-only provisions). Spec §3.3, §5. |

---

## 4. Concrete Example — Cosmetics Adopting the Shared TBM

This is an **illustrative** example (the cosmetics TBM reference is a Phase 1/2 adoption candidate; see the shared TBM README note). It shows the minimal thin-reference form plus one additive statute:

```yaml
# workflows/domains/industry/cosmetics/tbm/schema.yaml
schema_version: "1.0"
workflow_id: cosmetics-tbm
title: "Cosmetics — Tool Box Meeting (TBM)"
status: active
applicability: mandatory
workflow_type: core
industry_profile: cosmetics
agent: cosmetics-agent

references:
  - shared: ../../../../_shared/tbm
    overrides:
      signature_hazard: "화장품 제조 — 분체·용제 노출 (powder & solvent exposure)"
      legal_basis:
        add:
          - 화장품법 Article 5     # Cosmetics Act — facility standards (safety overlap)
```

What happens at scaffold/audit time:

1. The resolver loads `workflows/_shared/tbm/schema.yaml` (deep copy) — this contributes the common floor (`산업안전보건법 Article 15`, `산업안전보건법 Article 36`, `중대재해처벌법 Article 4`) and the shared evidence model `evidence-models/_shared/tbm-record.json`.
2. It then applies the cosmetics overrides: the `signature_hazard` is set, and `화장품법 Article 5` is **appended** to `legal_basis` (de-duplicated).
3. The resulting effective schema is what `safety-audit.ts` and the runtime layer treat as the cosmetics TBM definition.

For contrast, the **preserved-override** pattern (when an industry keeps genuinely non-generalizable content) is `ehsconst`: it references the shared TBM but overrides `evidence_model` to `ehsconst-tbm-record.json` and adds `건설기술진흥법 Article 24` + `중대재해처벌법 Article 5` via `legal_basis.add`. See [`REFERENCE-SPEC.md §5`](./REFERENCE-SPEC.md#5-preserved-overrides-do-not-collapse-into-the-shared-base).

---

## 5. Effective-Schema Resolution (summary)

The scaffold generator computes the **effective schema** for an industry workflow as:

1. Load the shared `schema.yaml` (deep copy).
2. For each key in `overrides`:
   - `legal_basis.add` → append to the shared list (de-duplicated).
   - `legal_basis.replace` → overwrite the shared list (requires `justification`).
   - scalar fields (`signature_hazard`, `evidence_model`, `agent`, `industry_profile`, `title`) → overwrite (last-write-wins).
3. The resulting effective schema is the industry's workflow definition for audit and runtime.

Full semantics, including the "common statutory floor is never accidentally removed" guarantee, are in [`REFERENCE-SPEC.md §4`](./REFERENCE-SPEC.md#4-override-semantics).

---

## 6. Step-by-Step: Adding a New Industry Thin-Reference

To adopt a shared workflow (today: TBM) for a new industry `<industry>`:

1. **Create the thin workflow directory**:
   ```
   workflows/domains/industry/<industry>/<workflow-name>/
   ```
   Use a short, lower-kebab-case `<workflow-name>` that matches the shared workflow where sensible (e.g. `tbm`). Do **not** copy any shared content into this directory.

2. **Drop a `schema.yaml` containing the `references:` block** — copy §4's example and replace:
   - `workflow_id`: `<industry>-<workflow-name>` (industry-scoped id).
   - `industry_profile`: `<industry>`.
   - `agent`: `<industry>-agent`.
   - `references[0].shared`: `../../../../_shared/<workflow-name>`.
   - `references[0].overrides.signature_hazard`: the industry's representative hazard (Korean proper nouns preserved; English gloss in parentheses encouraged).
   - `references[0].overrides.legal_basis.add`: optional industry-specific statutes.

3. **Add a one-line README pointer** in `workflows/domains/industry/<industry>/<workflow-name>/README.md` (Korean, Layer C) pointing to the shared README, plus an EN mirror `README.en.md`:
   ```markdown
   # <Industry> — <Workflow Name> (shared-workflow reference)

   본 워크플로우는 공통 워크플로우를 참조(thin-reference)합니다.
   전체 내용은 [`workflows/_shared/<workflow-name>/README.md`](../../../../_shared/<workflow-name>/README.md)를
   참조하십시오. 산업 고유 override는 `schema.yaml`의 `references:` 블록에 선언되어 있습니다.
   ```

4. **Register the industry in the shared `schema.yaml`** — add `<industry>` to the `consumed_by.industries` list in `workflows/_shared/<workflow-name>/schema.yaml` (V-06, §7).

5. **Run the audit**:
   ```bash
   bun scripts/safety-audit.ts
   ```
   Expect: cross-domain reference integrity clean; no V-01..V-07 violations (§7).

6. **(Phase 1/2 migration only)** If a per-industry duplicate of the workflow already exists under `workflows/domains/industry/<industry>/<old-wf-dir>/`, migrate any non-generalizable content into the new `references.overrides` block, then delete the old duplicate directory. Until deletion, the audit tolerates the coexistence in Phase 0 but MUST fail it after Phase 1/2 (V-05, Spec §6.2).

---

## 7. Validation Checklist (enforced by `safety-audit.ts`)

The audit enforces the following on every industry `schema.yaml` that contains a `references:` block. Full rule text is in [`REFERENCE-SPEC.md §7`](./REFERENCE-SPEC.md#7-validation-checklist-for-scaffold-generator--audit-scripts).

- [ ] **V-01** — `references[].shared` resolves to a directory containing `schema.yaml` with `shared: true`.
- [ ] **V-02** — The shared workflow directory also contains `README.md`.
- [ ] **V-03** — All `overrides` required by the shared workflow are present (e.g. `signature_hazard` for `tbm`).
- [ ] **V-04** — `legal_basis.replace` (if used) is accompanied by a `justification:` note.
- [ ] **V-05** — No double counting (an industry does not maintain both a duplicate directory and a `references:` block for the same workflow). Spec §6.1.
- [ ] **V-06** — The `consumed_by.industries` list in the shared `schema.yaml` includes the referencing industry.
- [ ] **V-07** — Statute citations use the canonical Korean proper-noun form (e.g. `산업안전보건법 Article 15`) — never translated.

A failure on any of V-01, V-02, V-03, V-06 is a hard error in every phase. V-05 is a warning in Phase 0 (pre-migration) and a hard error in Phase 1/2. V-04 fails on a `replace` without `justification`.

---

## 8. Current Shared-Workflow Inventory & Deferred Gaps

As of Phase 0 (2026-08-07), only **one** shared workflow exists:

| Shared workflow | Path | Status | Consumed by |
|-----------------|------|--------|-------------|
| **TBM (Tool Box Meeting)** | [`./tbm/`](./tbm/) | Lifted; ready for consumption | 16 declared industries (battery, biotech, cosmetics, datacenter, defense, ehschem, ehsconst-partial, food, gasterm, logistics, powergen, railway, semicon, shipbuilding, steelmaking, waste) |

Four other candidate shared workflows investigated in Phase 0 were **deferred as gaps**, not fabricated:

| Candidate | Reason deferred | Revisit trigger |
|-----------|-----------------|-----------------|
| `permit-to-work` | Only one industry variant (`ehsconst`); others are functional/PSM-scoped | ≥3 industries with equivalent permit regimes |
| `daily-safety-inspection` | Only one industry variant (`ehsconst`); others are domain-specific | ≥3 industries with equivalent daily-inspection workflows |
| `incident-reporting` | 0 industry-variant duplicates; only functional-domain versions exist | A cross-industry consensus emerges that is distinct from the functional layer |
| `contractor-onboarding` | 0 industries use that name; existing variants are non-equivalent subcontractor workflows | Industry variants converge on a common form |

**Implication for new industry authors**: if your new industry needs one of the four deferred workflows, do **not** invent a shared version. Add the workflow as an industry-unique workflow under `workflows/domains/industry/<industry>/` (with its own full `schema.yaml` and README), and surface the consolidation candidate to the SGM for Phase 2 triage. Full rationale is in [`REFERENCE-SPEC.md §8`](./REFERENCE-SPEC.md#8-gap-register--candidate-workflows-deferred-in-phase-0).

---

## 9. Related Documents

- [`REFERENCE-SPEC.md`](./REFERENCE-SPEC.md) — Canonical specification (single source of truth).
- [`./tbm/README.md`](./tbm/README.md) — The shared TBM workflow human-readable README (Korean, Layer C).
- [`./tbm/schema.yaml`](./tbm/schema.yaml) — The shared TBM machine-readable schema (`shared: true`, `consumed_by.industries`).
- [`../../regulations/KR/industry-regulatory-anchors.yaml`](../../regulations/KR/industry-regulatory-anchors.yaml) — Source for industry `legal_basis.add` citations (verify live before adding).

---

## 10. Change Log

| Date | Phase | Change | Author |
|------|-------|--------|--------|
| 2026-08-07 | Phase 1 (A-08) | Initial practitioner guide. Companion to REFERENCE-SPEC.md. | docs-writer |
