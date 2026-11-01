---
name: stride-threat-matrix
description: >
  Automated STRIDE threat matrix generation and DREAD risk scoring framework
  for architecture, API endpoints, data flows, and infrastructure models.
version: 1.1.0
status: active
owner: security-expert
last_reviewed: 2026-11-01
prerequisites: Architecture diagrams or data flow specifications (DFD), system component inventory
relates_to:
  - skill: finding-reconciliation
    type: follows
scope: co-security
l2_propagate: true
metadata:
  type: threat-modeling
  triggers:
    - stride-threat-matrix
    - /stride-threat-matrix
    - threat modeling
    - dread risk scoring
    - stride matrix
---

# 🛡️ Skill: stride-threat-matrix

## Context

In security-focused engineering and threat modeling engagements (`co-security`), identifying structural vulnerabilities and prioritizing remediation requires a systematic categorization of potential threats and a reproducible risk scoring methodology.

`stride-threat-matrix` provides the standard framework for automated threat classification using the **STRIDE** model combined with quantitative risk scoring via the **DREAD** framework across system architecture boundaries, API endpoints, data pipelines, and infrastructure deployments.

## When to Use

- Performing architectural threat modeling during {{PROJECT_PHASE_GATES}}.
- Evaluating new service endpoints, inter-process communication (IPC) channels, or external data ingestion paths.
- Calculating quantitative risk scores for identified design vulnerabilities before remediation planning.
- Generating structured threat matrix artifacts for security documentation, stakeholder reviews, and audit compliance.

## Execution Steps

1. **System Boundary & Data Flow Decomposition**
   - Identify system components: processes, data stores, data flows, external interconnections, and trust boundaries.
   - Assign trust levels to each component and network boundary (e.g., untrusted ingress, semi-trusted DMZ, trusted internal core).

2. **STRIDE Threat Classification**
   For each system element and data flow, analyze and document potential threats across the six STRIDE categories:
   - **S - Spoofing**: Authentication bypass, identity spoofing, rogue agent payload injection.
   - **T - Tampering**: Unauthorized modification of payload data, config parameters, or memory state.
   - **R - Repudiation**: Inadequate logging, missing audit trails, non-repudiable state mutations.
   - **I - Information Disclosure**: Data leakage in logs, unencrypted transmission, exposed API keys or secrets.
   - **D - Denial of Service**: Resource exhaustion, unhandled exception loops, rate limit evasion.
   - **E - Elevation of Privilege**: Unauthorized execution rights, command injection, broken access controls.

3. **DREAD Quantitative Risk Scoring**
   Assign a score from 1 (Low) to 10 (Critical) for each of the five DREAD parameters:
   - **Damage (D)**: How severe is the potential impact if exploited?
   - **Reproducibility (R)**: How easy is it to reliably reproduce the exploit?
   - **Exploitability (E)**: How much technical skill or effort is required?
   - **Affected Users (A)**: What percentage of users/services are impacted?
   - **Discoverability (D)**: How easily can the threat or flaw be discovered?

   Calculate the composite DREAD Risk Rating:
   $$\text{DREAD Score} = \frac{D + R + E + A + D}{5}$$

   Risk Classification Matrix:
   - **Critical**: Score $\ge 8.0$ (Requires immediate mitigation before {{PROJECT_PHASE_GATES_CRITICAL}})
   - **High**: Score $6.0 - 7.9$ (High priority fix; security gate blocker)
   - **Medium**: Score $4.0 - 5.9$ (Scheduled remediation in sprint cycle)
   - **Low**: Score $< 4.0$ (Documented residual risk; monitor)

4. **Mitigation Control Mapping**
   - Define concrete security controls (e.g., TLS 1.3, HMAC verification, RBAC rules, input validation gates).
   - Verify post-mitigation residual DREAD score satisfies safety threshold ($< 4.0$).

5. **Artifact Generation & Output Compilation**
   - Output the threat matrix as structured markdown and XML/JSON format.

## Output Format

```markdown
## STRIDE Threat Matrix & DREAD Risk Assessment

**Target System**: [System / Module Name]
**Evaluation Date**: 2026-08-06
**Evaluator**: {{PROJECT_ROLE}}

### Threat Summary

| ID | STRIDE Category | Threat Description | Affected Element | D | R | E | A | D | DREAD Score | Severity | Proposed Mitigation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| THREAT-001 | Elevation of Privilege | Unauthenticated CLI invocation via IPC socket | Command Processor | 9 | 8 | 8 | 9 | 7 | 8.2 | Critical | Enforce signed auth token (verify-authorization) |
| THREAT-002 | Information Disclosure | Plaintext token output in debug log files | Logging Subsystem | 7 | 9 | 4 | 8 | 6 | 6.8 | High | Redact authorization tokens before writing logs |

### Detailed Threat Breakdown

#### THREAT-001: Elevation of Privilege
- **STRIDE Category**: Elevation of Privilege
- **Component**: Command Processor (scripts/)
- **DREAD Calculation**: (9 + 8 + 8 + 9 + 7) / 5 = **8.2 (Critical)**
- **Mitigation Requirement**: Mandatory authentication check prior to command dispatch.
```

## Co-develop Integration Note

This file is the hub-doctrine canonical for the co-security assurance suite
(spec 2026-11-01-hub-consolidation-design, Phase 1 batch C). Co-security
engagements run it as written. A co-develop pipeline instance derives from this
doctrine by substituting the bindings below — the derivation never edits
frontmatter: `owner: security-expert` stays single-valued here, and the
co-develop ownership binding lives in this note only.

Parameterization — unfilled placeholders resolve to the co-security doctrine
defaults; a co-develop derivation substitutes the bindings:

| Placeholder | Instance | Unfilled default (co-security) | Co-develop binding |
|---|---|---|---|
| {{PROJECT_PHASE_GATES}} | When to Use, first bullet | Phase 1 security assessments | Phase 1–2 design (architect) and Phase 0/5 security-monitor scans |
| {{PROJECT_PHASE_GATES_CRITICAL}} | Risk Classification Matrix, Critical line | Phase 2 operations | Phase 4 execution |
| {{PROJECT_ROLE}} | Output Format, `**Evaluator**` line | security-expert | security-monitor |

Co-develop bindings beyond placeholders:

- Ownership: co-develop renders this skill as co-owned `architect, security-monitor` (threat modeling runs during Phase 1–2 design by the architect and again in the Phase 0/5 security-monitor scans). Frontmatter here stays `owner: security-expert`.
- Engagement label: the Context sentence keeps `co-security`; a co-develop derivation reads it as `co-develop`.
- Example mitigation text and Related Skills: co-develop omits the `verify-authorization` references (that pre-flight gate is a co-security engagement skill not adopted in the co-develop pipeline). This canonical keeps them doctrine-fixed.
- Delivery: the co-develop fork carries `scope: common`; this canonical keeps `scope: co-security`.

## Related Skills

- `verify-authorization` — mandatory pre-flight gate confirming signed scope authorization.
- `sarif-exporter` — exports generated threat findings and DREAD risk metrics into SARIF v2.1.0 JSON format.
- `security-scan` — executes static analysis and secret detection across codebase assets.
