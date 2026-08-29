# Procedure Schema Specification v1.0

Author-facing specification for structured procedure definitions across all
variant templates. This document is 1:1 with the normative design document
[`docs/designs/2026-08-29-procedure-schema-design.md`](../../../docs/designs/2026-08-29-procedure-schema-design.md)
at the workspace root. Where wording differs, the design document governs.

---

## Why procedures

Free-prose phase documents cannot be validated or graphed. A procedure file
makes the step contract machine-checkable:

- **who** executes each step (`agent_key`),
- **what capability** each step invokes (`skill_key`),
- **what artifact** each step produces (`output_type`),
- **in what order** the steps run (`steps[].id`).

The Skill Graph is derived from these files — it is never edited by hand
(Canonical Source Invariant, INV-1 of the design document).

## File layout

Each variant template owns:

```
templates/<variant>/procedures/
  _output-types.yaml                 # closed vocabulary of artifact types
  <kebab-name>/schema.yaml           # one directory per procedure
```

The authoring skeleton lives at `templates/common/procedures/_template/schema.yaml`.

## Authoring rules

1. Copy `_template/schema.yaml` into `procedures/<kebab-name>/schema.yaml` and
   fill every field. Delete nothing — all fields are required (some may be
   empty arrays as noted in the field table).
2. `procedure_id` must be `<variant>-<kebab-name>` (e.g. `co-design-discover`)
   and must match the containing directory.
3. Register **every** input, output, and step `output_type` in the variant's
   `_output-types.yaml` before validating. The vocabulary is closed.
4. Reference only agents and skills that actually exist in the variant (or in
   `templates/common`). The validator checks file existence — a typo is an
   error, not a warning.
5. Keep `outputs`, `inputs`, and `relations` semantically separate:
   - `inputs` — output types this procedure consumes;
   - `outputs` — output types this procedure produces;
   - `relations` — semantic links to other procedures or skills
     (`follows`, `enables`, `composes_with`).
   Never encode a dependency as a relation, or a relation as an input.
6. Use fractional step ids (`2.5`) to insert a step between existing steps
   without renumbering.
7. `produces` edges are derived automatically (see the design document,
   INV-4). Do not try to express production through `relations`.
8. Version procedure changes with semver and keep `status` current
   (`draft` → `active` → `deprecated`).

## Validation

```
bun scripts/validate-procedures.ts --all          # every variant
bun scripts/validate-procedures.ts --variant co-design
```

Validation layers (all fail-closed):

| Layer | Check |
|---|---|
| L1 | YAML parses; top level matches schema shape |
| L2 | Required fields; enums; id formats; phase 0–6 |
| L3 | All input/output/output_type values registered in `_output-types.yaml` |
| L4 | `agent_key` / `owner_agent` resolve to a real `agents/<key>.md` |
| L5 | `skill_key` resolves to a real `skills/<key>/SKILL.md` |
| L6 | Relation type in `follows` / `enables` / `composes_with` |
| L7 | Relation target resolves to an existing procedure or skill |
| L8 | Cross-reference consistency (id/variant match, uniqueness) |

## Lifecycle

- **Adding a procedure**: write the file, register output types, run the
  validator, regenerate the skill graph, run graph verification, then commit
  through `/sync`.
- **Changing a procedure**: bump `version`; the same chain applies.
- **Deprecating**: set `status: deprecated` and remove steps only when no
  other procedure's `relations` target it.

## v1 scope note

Predicate conditions, layered overrides, kill criteria, conditional
transitions, and dynamic composition are deliberately out of scope (frozen to
Schema v2 candidates). Do not add speculative fields.
