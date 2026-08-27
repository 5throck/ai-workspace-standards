# Governance Record: training-agent

Runtime definition: `agents/domains/functional/training/training-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/functional/training/training-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/functional/training/` holds 8 scenario dirs (new-hire-training, regular-safety-training, special-safety-training, supervisor-training, job-transfer-training, msds-chemical-training, first-aid-training, training-compliance-tracking), each with `README.md` + `schema.yaml` — covering the OSHA-KR Article 29/31/32/13/36/114 education categories named in Section A
- [x] All 5 evidence schemas in `evidence-models/domains/functional/training/` (training-record, training-compliance-record, training-plan-record, training-curriculum-record, instructor-qualification-record) enforce `legal_basis` `minItems: 3`, including PIPA citations for worker-PII records
- [x] Bulk ingestion path is executable: `bun scripts/training-ingest.ts` exists (CSV input, strict e-signature policy rejecting rows missing `signer_id`/`signed_at`); record target `memory/training/` exists and is machine-validated by `scripts/safety-audit.ts`
- [x] Statute SSOT traceability: every record's `legal_basis` resolves against `regulations/KR/legal-glossary.yaml`; dedicated metadata at `regulations/KR/OSHA-KR-Training.yaml` and `regulations/KR/SAPA-Training.yaml`
- [x] Escalation triggers concrete: untrained-worker operation (Article 29 violation) escalates to PM + SWM immediately; schema-validation failure or unresolvable `legal_basis` escalates as broken traceability
