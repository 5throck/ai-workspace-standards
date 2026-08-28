# workflows/compliance/

Reserved directory for compliance-specific workflow definitions (e.g. periodic
regulatory-update impact assessments, cross-domain compliance checklists) that
don't belong to a single functional or industry domain.

## Current Status

Empty by design. `compliance-agent` currently performs regulation gap analysis
directly against `regulations/KR/legal-glossary.yaml` and per-domain
`legal_basis` citations rather than a dedicated workflow file here — see
`agents/_shared/compliance-agent.md` §Section B.

## Audit Coverage

`scripts/safety-audit.ts` treats this tree the same as `workflows/daily/**` and
`workflows/emergency/**`: any `schema.yaml` added here is validated for a
`legal_basis` array with `minItems >= 3`. Add compliance workflows here when a
checklist becomes standalone enough to warrant its own `README.md` +
`schema.yaml` (see `workflows/_shared/_template/README.md` for the pattern).
