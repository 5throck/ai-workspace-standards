# Shared Workflow Reference-Declaration Specification

> **Status**: Phase 0 (Action Item A-02) — Canonical spec. Ready for consumption by the automation-engineer's scaffold generator (Task A-01).
> **Owner**: Safety Governance Manager (SGM)
> **Scope**: `workflows/_shared/` and all industries under `workflows/domains/industry/`.
> **Language**: English (Layer A — governance/system spec consumed by tooling).

---

## 1. Purpose

This specification defines how an industry declares that it **references** (consumes) a shared workflow rather than duplicating the workflow content under its own industry directory. It establishes:

1. The `references:` block format in an industry's `schema.yaml`.
2. The naming convention for shared workflows.
3. The Tier-2 maturity bar rule (≥5 workflows counting shared + unique).
4. Override semantics (replace vs. add).
5. Validation rules the scaffold generator and audit scripts must enforce.

The goal is to eliminate workflow duplication across the 12 Tier-1 industries (battery, biotech, cosmetics, datacenter, defense, food, logistics, railway, semicon, shipbuilding, steelmaking, waste) plus the mature reference industries (ehsconst, ehschem, gasterm, powergen) by lifting genuinely common workflows to `workflows/_shared/`.

---

## 2. Naming Convention & Directory Layout

### 2.1 Shared workflows
Shared workflows live under:

```
workflows/_shared/<workflow-name>/
├── README.md          # human-readable (Layer C — Korean, per workflow README policy)
└── schema.yaml        # machine-readable; English keys + Korean statute proper nouns
```

- `<workflow-name>` is a short, lower-kebab-case identifier without an industry prefix (e.g. `tbm`, `permit-to-work`, `daily-safety-inspection`).
- Each shared `schema.yaml` MUST set `shared: true` and include a `consumed_by:` block listing the industries that reference it.
- The existing `workflows/_shared/_template/` (README + schema boilerplate) and `workflows/_shared/data-seeding.yaml` are NOT affected by this spec.

### 2.2 Industry workflows
Industries keep **only their unique workflows** under:

```
workflows/domains/industry/<industry>/<unique-workflow-name>/
├── README.md
└── schema.yaml
```

- `<unique-workflow-name>` MUST NOT collide with a shared workflow name. If a workflow exists as a shared workflow, the industry MUST NOT also maintain a full duplicate — it declares a `references:` block instead (§3).
- An industry MAY keep an industry-specific variant alongside a shared reference only when the variant contains non-generalizable, industry-mandated content (see §5 Preserved Overrides).

---

## 3. The `references:` Block (Declaration Format)

An industry declares consumption of a shared workflow by adding a `references:` block to its own `schema.yaml`. The block lives at the top level of the industry schema, alongside the standard fields.

### 3.1 Minimal form (reference only, no overrides)

```yaml
# workflows/domains/industry/<industry>/<workflow-name>/schema.yaml
schema_version: "1.0"
workflow_id: <industry>-<workflow-name>     # industry-scoped id
title: "<Industry> <Workflow Name>"
status: active
applicability: mandatory
workflow_type: core
industry_profile: <industry>
agent: <industry>-agent

references:
  - shared: ../../../../_shared/<workflow-name>   # relative path to shared workflow dir (no file extension)
```

### 3.2 Full form (reference + overrides)

```yaml
schema_version: "1.0"
workflow_id: <industry>-<workflow-name>
title: "<Industry> <Workflow Name>"
status: active
applicability: mandatory
workflow_type: core
industry_profile: <industry>
agent: <industry>-agent

references:
  - shared: ../../../../_shared/<workflow-name>
    overrides:
      signature_hazard: "<industry-specific representative hazard>"   # required for tbm
      legal_basis:
        add:                                    # ADD to the shared base (never replace by default)
          - "<industry-specific statute> Article N"
      evidence_model: <industry>-<record>.json  # optional — only when overriding the shared evidence model
```

### 3.3 Field rules

| Field | Required in industry schema? | Notes |
|-------|:---:|-------|
| `references[].shared` | Yes | Relative path from the industry `schema.yaml` to the shared workflow **directory** (no trailing `/`, no file extension). Resolved at scaffold/audit time. |
| `references[].overrides.signature_hazard` | Conditionally | Required when the shared workflow defines `signature_hazard` as a mandated industry field (currently `tbm`). |
| `references[].overrides.legal_basis.add` | Optional | A list of statute citations to ADD to the shared `legal_basis`. See §4 Override Semantics. |
| `references[].overrides.legal_basis.replace` | Discouraged | Replaces the shared `legal_basis` entirely. Requires a `justification:` note. Use only when the shared base is legally inapplicable to the industry. |
| `references[].overrides.industry_profile` | Optional | Defaults to the industry's own `industry_profile` field; set only when the referenced workflow needs a different profile. |
| `references[].overrides.agent` | Optional | Defaults to the industry's own `agent` field. |
| `references[].overrides.evidence_model` | Optional | Path to an industry-specific evidence model. Use only when a shared evidence model is insufficient (e.g. `ehsconst` retains `ehsconst-tbm-record.json` for construction-only provisions). |

### 3.4 Relative path convention

From `workflows/domains/industry/<industry>/<wf-dir>/schema.yaml`, the path to `workflows/_shared/<shared-wf>/` is:

```
../../../../_shared/<shared-wf>
```

(four levels up: `<wf-dir>` → `<industry>` → `industry` → `domains` → `workflows`, then into `_shared/<shared-wf>`).

> The scaffold generator (Task A-01) MUST resolve `references[].shared` relative to the industry `schema.yaml` file and validate that the target directory contains both `README.md` and `schema.yaml` with `shared: true`.

---

## 4. Override Semantics

### 4.1 `legal_basis` — additive by default
The shared base `legal_basis` (e.g. OSHA-KR Article 15, Article 36, SAPA Article 4) applies to ALL consuming industries by default. Industries use `legal_basis.add` to append industry-specific statutes. This guarantees the common statutory floor is never accidentally removed.

```yaml
overrides:
  legal_basis:
    add:
      - 항만안전특별법 Article 6
      - 항만안전특별법 Article 8
```

### 4.2 `legal_basis.replace` — exceptional
Only use `replace` when the shared base citation is legally inapplicable. A `justification:` note is MANDATORY and the audit script will flag any `replace` without one.

```yaml
overrides:
  legal_basis:
    replace:
      - "<alternative statute> Article N"
    justification: "Shared base cites construction-specific provision; industry X is non-construction."
```

### 4.3 Scalar fields — last-write-wins
Scalar overrides (`signature_hazard`, `evidence_model`, `agent`, `industry_profile`, `title`) replace the shared value directly. No merge is performed.

### 4.4 Effective schema resolution
The scaffold generator computes the **effective schema** for an industry workflow as:

1. Load the shared `schema.yaml` (deep copy).
2. For each field in `overrides`:
   - `legal_basis.add` → append to the shared list (de-duplicated).
   - `legal_basis.replace` → overwrite the shared list.
   - scalars → overwrite.
3. The resulting effective schema is what the audit and runtime layers treat as the industry's workflow definition.

---

## 5. Preserved Overrides (do NOT collapse into the shared base)

Certain industry variants contain non-generalizable content and MUST be preserved as overrides during Phase 1/2 migration:

| Industry | Workflow | Preservation reason |
|----------|----------|---------------------|
| `ehsconst` (construction) | `tbm` | Retains `ehsconst-tbm-record.json` evidence model (SAPA Art.5 subcontractor assurance duty / contractor tier, 건설기술진흥법 Art 24 construction-only provisions). Override `evidence_model` + `legal_basis.add` (건설기술진흥법 Art 24, SAPA Art 5). |
| `ehsconst` (construction) | `permit-to-work-construction` | Construction-specific permit regime (OSHA-KR Art 38 + 건설공사 작업허가제 기준; anchor corrected from legacy Art 98, 2026-08-24). Not generalizable — see §7 Gap Register. |

The migration scripts (Phase 1/2) MUST detect these and emit the corresponding `overrides` block automatically.

---

## 6. Tier-2 Maturity Bar Rule

An industry reaches **Tier-2 (mature)** when it has **≥5 workflows** in its directory, counted as:

```
tier2_count = (unique workflows in workflows/domains/industry/<industry>/)
            + (shared workflows properly referenced via a references: block)
```

### 6.1 Counting rules

- A shared workflow counts toward the total **only when** the industry declares a valid `references:` block for it. Undeclared shared workflows do NOT count.
- A `references:` block is valid only if:
  1. The `shared:` path resolves to an existing `workflows/_shared/<wf>/` directory.
  2. That directory contains `schema.yaml` with `shared: true`.
  3. All `overrides` required by the shared workflow (e.g. `signature_hazard` for `tbm`) are present.
- An industry MAY NOT double-count: a workflow that exists both as an industry directory AND as a `references:` entry counts once (the audit script flags this as a migration-pending error in Phase 0, and as a violation once Phase 1/2 migration completes).

### 6.2 Phase 0 vs Phase 1/2 enforcement

- **Phase 0 (current)**: Audit scripts MAY warn but MUST NOT fail when an industry has both a per-industry duplicate AND a shared reference. The duplicate is expected to be migrated in Phase 1/2.
- **Phase 1/2 (post-migration)**: Audit scripts MUST fail when an industry maintains a full duplicate of a shared workflow without a `references:` block, or when a `references:` block coexists with a non-overriding duplicate directory.

---

## 7. Validation Checklist (for scaffold generator + audit scripts)

The scaffold generator (Task A-01) and `scripts/safety-audit.ts` SHOULD enforce the following on every industry `schema.yaml` that contains a `references:` block:

- [ ] **V-01** `references[].shared` path resolves to a directory containing `schema.yaml` with `shared: true`.
- [ ] **V-02** The shared workflow directory also contains `README.md`.
- [ ] **V-03** All `overrides` required by the shared workflow are present (e.g. `signature_hazard` for `tbm`).
- [ ] **V-04** `legal_basis.replace` (if used) is accompanied by a `justification:` note.
- [ ] **V-05** No duplicate counting (see §6.1).
- [ ] **V-06** The `consumed_by.industries` list in the shared `schema.yaml` includes the referencing industry.
- [ ] **V-07** Statute citations use the canonical Korean proper-noun form (e.g. `산업안전보건법 Article 15`) — never translated.

---

## 8. Gap Register — Candidate Workflows Deferred in Phase 0

The Phase 0 task list proposed 5 shared workflows. Investigation of the existing `workflows/` tree shows **only TBM is genuinely duplicated across the Tier-1 industries**. The other 4 candidates are documented here as gaps rather than fabricated, per the Phase 0 instruction ("if a candidate has no existing per-industry content to consolidate, document that as a gap rather than fabricating content").

| Candidate | Existing locations | Per-industry duplication? | Phase 0 decision | Rationale |
|-----------|--------------------|:---:|---|---|
| `tbm` | 15 industries under `workflows/domains/industry/*/tbm-pre-work-briefing/` + `ehsconst/tbm-tool-box-meeting/` | **Yes** | **LIFTED to `workflows/_shared/tbm/`** | Genuine cross-industry duplication; the only valid consolidation candidate in Phase 0. |
| `permit-to-work` | `workflows/daily/manufacturing/permit-to-work`, `workflows/domains/functional/psm/hot-work-permit`, `workflows/domains/industry/ehsconst/permit-to-work-construction` | No — only 1 industry variant (`ehsconst`); others are functional/PSM-scoped | **DEFERRED (gap)** | Lifting a single industry's construction-specific permit (OSHA Art 98 + 건설공사 작업허가제) to "shared" would misrepresent it as the cross-industry canonical form. Revisit in a later phase when ≥3 industries have permit regimes to consolidate. |
| `daily-safety-inspection` | `workflows/domains/industry/ehsconst/daily-safety-inspection`, `workflows/daily/manufacturing/equipment-inspection` | No — only 1 industry variant (`ehsconst`) | **DEFERRED (gap)** | Same rationale as `permit-to-work`. Industry-specific inspection workflows (e.g. `powergen/power-plant-inspection`, `glp/qau-inspection`) are domain-specific, not duplicates of a common daily inspection. |
| `incident-reporting` | `workflows/domains/functional/incident-investigation/incident-initial-report`, `workflows/domains/functional/psm/incident-investigation-psm` | No — 0 industry-variant duplicates; only functional-domain versions exist | **DEFERRED (gap)** | No per-industry content to consolidate. A functional cross-cutting workflow already exists under `workflows/domains/functional/`. Lifting it to `workflows/_shared/` would conflate the functional layer with the industry-shared layer. |
| `contractor-onboarding` | `workflows/daily/manufacturing/contractor-management`, `workflows/domains/functional/contractor-safety`, `workflows/domains/functional/psm/contractor-management`, `workflows/domains/industry/ehsconst/subcontractor-management`, `workflows/domains/industry/shipbuilding/heavy-crane-subcontractor-safety` | No — 0 industries use the name "contractor-onboarding"; variants are industry-specific subcontractor workflows | **DEFERRED (gap)** | Variants are non-equivalent (subcontractor tier management vs. functional contractor safety). No common content to lift without inventing a synthesis. |

**Recommendation for the PM**: Re-open the 4 deferred candidates for Phase 2 review once per-industry coverage expands. The honest SGM position is that consolidating them now would produce fabricated shared content — the opposite of the de-duplication goal.

---

## 9. Change Log

| Date | Phase | Change | Author |
|------|-------|--------|--------|
| 2026-08-07 | Phase 0 (A-02) | Initial spec. Lifted TBM to shared; deferred 4 candidates as gaps per investigation. | SGM |
