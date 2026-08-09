# Phase Definitions — co-security

This document defines the workflow phases used by the `co-security` variant. It follows the standard workspace phase structure (see `templates/common/docs/phase-definitions.md`) with co-security's actual specialist agents mapped to each phase, per each agent's `phases:` frontmatter field in `agents/*.md` and the Phase Determination table in `AGENTS.md §3.5`.

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Project Initiation & Authorization Gate | Gate Keeper | PM (`verify-authorization` skill) |
| 1 | Threat Surface Recon & Modeling | Observer | `red-team-lead`, `threat-modeler` |
| 2 | Threat Model Review & Approval | Gate Keeper | PM + `red-team-lead`, `threat-modeler` |
| 3 | Exploitation & PoC Development | Coordinator | `red-team-lead`, `pentester` |
| 4 | Remediation | Coordinator | `patch-engineer` |
| 5 | Reporting & Lifecycle Finalization | Owner | `report-writer`, PM |
| 6 | Quality Assurance & Finalization | Owner | PM, `pentester`, `patch-engineer`, `report-writer` |

---

## Phase Details

### Phase 0 — Project Initiation & Authorization Gate
**PM enforces the hard gate**: no Phase 1+ activity may begin without confirmed authorization.
- PM reviews the engagement request and confirms `docs/scope.md` exists
- PM runs the `verify-authorization` skill (`skills/verify-authorization/SKILL.md`, `security-gate: true`) to confirm a signed authorization document and scope doc exist
- PM identifies which specialist agents are needed for the engagement (including whether the optional `patch-engineer` is in scope for report-only engagements)
- **Output**: confirmed scope, signed authorization on file, team assignment
- **Gate**: `verify-authorization` must return PASS before any Phase 1 activity proceeds

### Phase 1 — Threat Surface Recon & Modeling
**PM observes**: specialists work autonomously.
- `red-team-lead` (Tier: High) defines offensive strategy and maps the attack surface, drawing on MITRE ATT&CK TTPs
- `threat-modeler` (Tier: High) performs STRIDE/PASTA analysis, attack tree construction, and ATT&CK mapping using the `stride-threat-matrix` skill
- PM intervenes only if quality standards are not met
- **Output**: STRIDE tables, attack trees, and MITRE ATT&CK mappings in `docs/threat-models/`
- **Gate**: none — phase ends when agents signal completion

### Phase 2 — Threat Model Review & Approval
**PM enforces the gate**: no exploitation without explicit user approval.
- `red-team-lead` and `threat-modeler` present the consolidated threat model and proposed offensive strategy
- PM synthesizes findings into a decision recommendation
- **USER APPROVAL REQUIRED** before proceeding to Phase 3 (exploitation)
- **Output**: approved threat model and authorized attack plan

### Phase 3 — Exploitation & PoC Development
**PM coordinates**: specialists execute the approved attack plan.
- `red-team-lead` (Tier: High) oversees exploitation and reviews PoCs for accuracy and safety
- `pentester` (Tier: Medium) performs hands-on exploitation and PoC development within the approved scope
- Agents may hand off directly to each other without PM intervention
- **Output**: vulnerability finding tickets (`FIND-NNNN.md`) with CVSS scores in `docs/findings/`

### Phase 4 — Remediation
**PM coordinates**: remediation is delivered against confirmed findings.
- `patch-engineer` (Tier: Medium, optional) develops remediation scripts and Ansible playbooks, and deploys cross-platform patches
- Optional: skipped for report-only engagements where remediation is out of scope (per `variant.json → agent_manifest.optional`)
- **Output**: applied remediations logged to `PATCH_LOG.md`

### Phase 5 — Reporting & Lifecycle Finalization
**PM owns**: governance records and final documentation are updated together.
- `report-writer` (Tier: Medium) authors technical and executive reports, including CVSS scoring, into `docs/reports/`
- PM updates governance documents for agent/skill/script changes
- PM logs decisions to `memory/YYYY-MM-DD.md`
- **Output**: pentest report, executive summary, governance records updated

### Phase 6 — Quality Assurance & Finalization
**PM owns**: finalizes the engagement.
- `pentester` performs re-testing to confirm remediations closed the reported findings
- `patch-engineer` re-verifies deployed patches (when engaged in Phase 4)
- `report-writer` performs final QA pass on report accuracy and CVSS scoring
- PM runs `audit-workspace` skill
- PM runs `validate-docs-links` skill
- Maximum 2 fix iterations before escalating to user
- PM runs `/sync` pipeline
- PR opened with English title and description
- Memory log updated
- **Output**: passing audit report, closed findings confirmed, merged PR or open PR link

---

## Agent-to-Phase Mapping (Source of Truth)

Per each agent's phase assignment in `templates/co-security/AGENTS.md §1` and `§3.5`:

| Agent | Phases | Tier | Optional? |
|-------|--------|------|-----------|
| `red-team-lead` | 1, 2, 3 | High | No |
| `threat-modeler` | 1, 2 | High | No |
| `pentester` | 3, 6 | Medium | No |
| `patch-engineer` | 4, 6 | Medium | Yes |
| `report-writer` | 5, 6 | Medium | No |

`patch-engineer` is declared optional in `variant.json → agent_manifest.optional` ("skip for report-only engagements where remediation is out of scope").

---

## Variant Customization Points

co-security declares its specialist agents per phase in `AGENTS.md §3.5 Phase Determination` and each agent's `agents/<name>.md` frontmatter:

```yaml
# Example agent frontmatter (pentester)
phases: [3, 6]
handoff_to: [patch-engineer, report-writer]
handoff_from: [red-team-lead]
required_skills: [sarif-exporter]
```

The PM role and Phase 0/6 gate structure are stricter than the workspace-standard phase model: co-security's Phase 0 is a hard **authorization gate** (`verify-authorization`, `security-gate: true`) rather than simple project setup, and no Phase 1 recon, Phase 3 exploitation, or Phase 4 patching may begin until it returns PASS. co-security also splits "Research/Analysis" into recon + threat modeling (Phase 1) with a dedicated approval gate (Phase 2) before any offensive activity, and separates "Exploitation" (Phase 3) from "Remediation" (Phase 4) so that `patch-engineer` can be skipped entirely for report-only engagements.

---

## PM Facilitation per Phase

| Phase | PM Opening | PM Monitoring | PM Synthesis |
|-------|-----------|---------------|--------------|
| 0 | Confirm scope doc, run `verify-authorization` | Block all activity until PASS | Signed authorization on file |
| 1 | Brief `red-team-lead`/`threat-modeler` on engagement scope | Check quality of threat model | STRIDE/attack tree summary |
| 2 | Present threat model for approval | — | Decision + authorized attack plan |
| 3 | Hand off approved plan to `red-team-lead`/`pentester` | Intervene if outside authorized scope | Findings review (CVSS) |
| 4 | Confirm remediation targets with `patch-engineer` | Track patch deployment | Remediation confirmation (`PATCH_LOG.md`) |
| 5 | Hand off findings to `report-writer` | Verify lifecycle drift | Report + governance records updated |
| 6 | Run re-test, audit + `/sync` | Fix issues (max 2 iterations) | Audit pass report + PR link |
