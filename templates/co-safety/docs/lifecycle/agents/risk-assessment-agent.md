# Governance Record: risk-assessment-agent

Runtime definition: `agents/_shared/risk-assessment-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/risk-assessment-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Scenario workflow library exists: `workflows/domains/functional/risk-assessment/` holds 5 scenario dirs (daily-risk-assessment, job-safety-analysis, change-risk-assessment, post-incident-risk-assessment, risk-register-management), each with `schema.yaml`; daily template present at `workflows/daily/manufacturing/risk-assessment/`
  - [x] Daily RA templates for the remaining `workflows/daily/` industries (chemical, construction, datacenter, semiconductor) (verified: all four subtrees exist with README.md + schema.yaml mirroring the manufacturing exemplar)
- [x] Evidence schemas enforce the multi-source policy: both schemas in `evidence-models/domains/functional/risk-assessment/` (risk-assessment-record, risk-register-record) enforce `legal_basis` `minItems: 3`; Section A cites OSHA-KR Art 36/38/39, 시행규칙 Art 37, MOEL risk-assessment notice, and SAPA
- [x] Register rollup is executable: `bun scripts/risk-register-rollup.ts` exists with manager sign-off flags (`--manager-id`, `--signer-id`, `--signed-at`, `--dry-run`); write targets `memory/assessments/` and `memory/registers/` exist; owned skill `risk-assessment` exists at `skills/daily/risk-assessment/SKILL.md`
- [x] Role separation enforced by tooling: EHS-only scope boundary (product quality → gmp-agent/gmp-qrm; process safety → psm-agent; device risk → meddevice iso14971-risk-scorer; construction falls → ehsconst fall-hazard-assessor) is checked by `scripts/safety-audit.ts`
- [x] Scoring model explicit: Likelihood x Severity matrix with defined 1-5 anchors; scores >= 13 flagged `escalate: true` for SWM review
