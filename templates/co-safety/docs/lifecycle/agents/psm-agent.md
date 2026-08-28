# Governance Record: psm-agent

Runtime definition: `agents/domains/functional/psm/psm-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/functional/psm/psm-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 12 OSHA-KR Article 44 elements plus supporting scenarios exist as workflows: `workflows/domains/functional/psm/` holds 15 element dirs (psi-management, process-hazard-analysis via pha-hazop, sop-management, psm-worker-training, contractor-management, pre-startup safety via pssr-review, mechanical integrity via mi-inspection, hot-work-permit, moc-process, incident-investigation-psm, eap-emergency-planning, psm-compliance-audit, employee-participation, trade-secrets-management, loto-lockout-tagout), each with `README.md` + `schema.yaml`
- [x] All 15 evidence schemas in `evidence-models/domains/functional/psm/` enforce `legal_basis` `minItems: >= 3` (primary OSHA-KR Art 44 + adjacent statutes per Section A); LOTO records additionally covered by the shared `evidence-models/_shared/loto-record.json` (minItems 3)
- [x] Owned skills exist: `hazop-analysis` (`skills/investigation/hazop-analysis/`), and PSM MOC / LOTO skills at `skills/domains/functional/psm/{moc,loto}/`, each with `SKILL.md`
- [x] LOTO procedure verification anchored to KOSHA GUIDE Z-40-2022 and 안전보건기준규칙 Article 92 (zero-energy state) as declared; regulation metadata `regulations/KR/Chemical-Plant-Safety.yaml` exists
- [x] Scope separation is tool-enforced: mi-inspection limited to PSM-covered process equipment — structural tank validation stays with gasterm's `tank-integrity-validator` skill and general aging equipment with asset-integrity-agent; boundary check implemented in `scripts/co-safety/safety-audit.ts`
