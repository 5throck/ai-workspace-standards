---
name: samm-maturity
description: >
  OWASP SAMM maturity self-assessment producing a scored 15-stream posture
  roadmap across five business functions with three-level maturity rubric.
version: 1.0.0
last_reviewed: 2026-08-24
status: active
owner: pm
prerequisites: Repository access, security artifacts (policies, scan results, incident logs)
scope: co-security
metadata:
  type: process
  triggers:
    - samm
    - samm assessment
    - maturity assessment
    - security posture assessment
---

# 📊 Skill: samm-maturity

## Context

OWASP SAMM (Software Assurance Maturity Model) provides a structured framework for assessing software security practices across five business functions, each with three security practices, totaling 15 streams. Maturity is scored 0–3 per stream (Level 0 = ad-hoc/absent, Level 1 = performed, Level 2 = quantified/managed, Level 3 = optimized).

`samm-maturity` standardizes engagement-based security posture assessment by scoring all 15 streams against evidence, computing per-function and overall maturity, and generating a prioritized improvement roadmap.

## When to Use

- Performing baseline security posture assessment during Phase 1 security engagements.
- Evaluating security program maturity before recommending tooling or process investments.
- Tracking security improvement progress across multiple engagement cycles.
- Generating stakeholder-ready maturity reports for governance, risk, and compliance (GRC) reviews.

## Execution Steps

1. **Scope the Engagement & Gather Evidence**
   - Define assessment scope: organization, business unit, or product line.
   - Collect evidence per stream: policy documents, architecture diagrams, CI/CD configs, scan reports, incident logs, training records.
   - Interview stakeholders: security leadership, engineering managers, DevOps owners, incident responders.

2. **Score Each of the 15 Streams (0–3)**
   For each stream, assign a maturity level with one-line evidence citation:

   **Governance**
   - **Strategy & Metrics** (G1): Security strategy, objectives, metrics program
   - **Policy & Compliance** (G2): Security policies, regulatory compliance tracking
   - **Education & Guidance** (G3): Security training, guidance docs, secure development resources

   **Design**
   - **Threat Assessment** (D1): Threat modeling, attack surface analysis
   - **Secure Architecture** (D2): Secure design patterns, reference architectures
   - **Security Requirements** (D3): Security requirements definition, acceptance criteria

   **Implementation**
   - **Secure Build** (I1): Secure build practices, dependency management, SAST/DAST
   - **Secure Deployment** (I2): Secure deployment automation, environment hardening
   - **Defect Management** (I3): Vulnerability tracking, remediation SLAs

   **Verification**
   - **Implementation Verification** (V1): Code review, manual security testing
   - **Security Testing** (V2): Automated security testing in CI/CD
   - **Requirements-driven Testing** (V3): Test coverage of security requirements

   **Operations**
   - **Incident Detection** (O1): Security monitoring, alerting, log analysis
   - **Incident Response** (O2): Incident response playbook, forensics, communication
   - **Operational Management** (O3): Configuration management, patch management, access control

   **Maturity Level Rubric**:
   - **Level 0**: Ad-hoc or absent (no documented process)
   - **Level 1**: Performed (process exists but not consistent across org)
   - **Level 2**: Quantified/managed (measured, tracked, some automation)
   - **Level 3**: Optimized (fully automated, quantitative metrics, continuous improvement)

3. **Compute Maturity Scores**
   - Calculate per-function average: (sum of 3 stream scores) / 3
   - Calculate overall maturity score: (sum of all 15 stream scores) / 15
   - Round scores to one decimal place (e.g., 1.7, 2.3)

4. **Build Target-State Roadmap**
   For each stream below target maturity (typically Level 2 or 3):
   - Identify current score and target score
   - Define one concrete improvement action (S/M/L size)
   - Tie action to the next maturity level step
   - Prioritize by risk impact and implementation effort

5. **Generate Output Artifact**
   - Compile markdown assessment report with summary table and roadmap
   - Save to `docs/security/samm-assessment-<YYYY-MM-DD>.md`

## Output Format

```markdown
# OWASP SAMM Maturity Assessment

**Organization**: [Organization Name]
**Assessment Date**: 2026-08-24
**Evaluator**: [Evaluator Name]

## Executive Summary

**Overall Maturity**: 1.7 / 3.0

| Business Function | Stream Scores | Average |
|---|---|---|
| Governance | G1: 2, G2: 1, G3: 2 | 1.7 |
| Design | D1: 1, D2: 1, D3: 1 | 1.0 |
| Implementation | I1: 2, I2: 2, I3: 1 | 1.7 |
| Verification | V1: 1, V2: 1, V3: 0 | 0.7 |
| Operations | O1: 2, O2: 2, O3: 2 | 2.0 |

## Detailed Stream Scores

### Governance (1.7 / 3.0)
- **G1 Strategy & Metrics**: Level 2 — Metrics program established with quarterly KPI reviews (evidence: `docs/security/metrics-2026-Q2.md`)
- **G2 Policy & Compliance**: Level 1 — Policies exist but compliance tracking is manual (evidence: `docs/policies/`)
- **G3 Education & Guidance**: Level 2 — Annual security training plus secure coding guidelines (evidence: `docs/training/`)

### Design (1.0 / 3.0)
- **D1 Threat Assessment**: Level 1 — Ad-hoc threat modeling, no standardized process
- **D2 Secure Architecture**: Level 1 — Secure patterns documented but not enforced
- **D3 Security Requirements**: Level 1 — Requirements defined per project, no standard catalog

### Implementation (1.7 / 3.0)
- **I1 Secure Build**: Level 2 — SAST in CI/CD, dependency scanning enabled (evidence: `.github/workflows/`)
- **I2 Secure Deployment**: Level 2 — Infrastructure as code with security checks (evidence: `terraform/`)
- **I3 Defect Management**: Level 1 — Vulnerability tracking in Jira, inconsistent SLAs

### Verification (0.7 / 3.0)
- **V1 Implementation Verification**: Level 1 — Manual code reviews, no standardized checklist
- **V2 Security Testing**: Level 1 — DAST on production only, no pre-production testing
- **V3 Requirements-driven Testing**: Level 0 — No security test coverage tracking

### Operations (2.0 / 3.0)
- **O1 Incident Detection**: Level 2 — SIEM deployed with alert rules (evidence: `docs/siem-rules.md`)
- **O2 Incident Response**: Level 2 — Documented playbook, quarterly drills (evidence: `docs/ir-playbook.md`)
- **O3 Operational Management**: Level 2 — Automated patch management, quarterly access reviews

## Prioritized Improvement Roadmap

| Stream | Current | Target | Action | Size | Priority |
|---|---|---|---|---|---|
| V3 Requirements-driven Testing | 0 | 2 | Implement security test coverage tracking in CI/CD | M | High |
| D1 Threat Assessment | 1 | 2 | Standardize threat modeling process with template | S | High |
| I3 Defect Management | 1 | 2 | Define vulnerability SLAs and automate tracking | M | High |
| D2 Secure Architecture | 1 | 2 | Enforce secure patterns via architecture review gate | M | Medium |
| V2 Security Testing | 1 | 2 | Integrate DAST into pre-production pipeline | M | Medium |

**Size Legend**: S (1-2 weeks, <5 person-days), M (3-8 weeks, 5-20 person-days), L (9+ weeks, >20 person-days)
```

## Related Skills

- `stride-threat-matrix` — feeds Design/Verification evidence (D1, D2, V1, V2) by identifying structural threats and risk ratings.
- `sarif-exporter` — feeds Implementation/Verification evidence (I1, I3, V2) by providing vulnerability findings and scan results in standardized format.
- `security-scan` — produces SAST/DAST/secret detection results ingested into I1, I3, V2 scoring.
