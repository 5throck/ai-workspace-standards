# co-abap variant-identity disposition — design

- **Status**: implemented
- **Date**: 2026-11-04
- **Tickets**: T-20261104-002 (disposition), T-20261103-002 (mechanism)
- **Decision record**: DEC-20261104-01
- **Related design**: docs/designs/2026-11-01-hub-consolidation-design.md §15

## 1. Problem

checkHubDoctrineDuplication (scripts/helpers/hub-topology.ts) flags a local
agent file when its name matches a hub-doctrine asset of another variant
unless a registry row sanctions it. The §15.1 variant-identity sanction
cleared co-architect and co-price. co-abap retained three fails:

| asset | file | why it is flagged |
|---|---|---|
| architect | templates/co-abap/agents/architect.md | co-develop carries a hub-doctrine row named `architect` |
| code-writer | templates/co-abap/agents/code-writer.md | co-develop carries a hub-doctrine row named `code-writer` |
| test-runner | templates/co-abap/agents/test-runner.md | co-develop carries a hub-doctrine row named `test-runner` |

The names collide. The bodies do not: the co-abap frontmatter declares
SAP-domain roles (SAP Technical Architect; SAP ABAP Code Implementation
Specialist; SAP test-runner) with SAP-specific examples and phases.

## 2. Requirement

Choose one disposition per file and record it as a gate-moment decision
(ADR-0061):

1. variant-identity registration — the file is a distinct role that merely
   shares a name;
2. declared consumer — co-abap genuinely reads the co-develop doctrine;
3. removal as drift — the file is an unintended copy.

## 3. Decision

Option 1 for all three (DEC-20261104-01). Option 2 is rejected because
nothing in the co-abap bodies references or imports the co-develop doctrine,
and a consumer declaration would create minimum_version obligations over
unconsumed content. Option 3 is rejected because all three files are active
members of the co-abap roster with variant-specific dispatch examples.

## 4. Change set

- `docs/workspace-schema.json` and `templates/common/docs/workspace-schema.json`:
  three `variant-identity` rows (asset/domain/hub_variant per file, version
  1.1.1, consumers `[]`), both copies in one commit.
- `templates/co-abap/variant.json`: unchanged (no hub.consumes addition).
- No agent content changes — registry-only.

## 5. Acceptance

- `tests/unit/hub-topology-legs.test.ts` case-6 real-workspace pin asserts
  `checkHubDoctrineDuplication(co-abap).fails` is `[]`, while the
  security-monitor E4 assertion is unchanged.
- `bun scripts/validate-templates.ts` 0 errors; `bun scripts/audit.ts` green;
  root `bun test` green.

## 6. Consequences

co-abap's fresh scaffolds and promotion waves no longer fail the duplication
preflight for these paths. Promotion must not overwrite a registered file
with co-develop's doctrine; a genuine future adoption requires a new
consumption declaration and its own gate-moment record.
