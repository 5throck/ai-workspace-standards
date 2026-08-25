# Skills Index — co-security

This directory contains variant-specific skills for the `co-security` template.

## Available Skills

| Skill | Directory | Purpose |
|-------|-----------|---------|
| Verify Authorization | `verify-authorization/` | Verify that authorization controls and access rights are properly configured |
| STRIDE Threat Matrix | `stride-threat-matrix/` | Automated STRIDE threat matrix generation and DREAD risk scoring framework |
| SARIF Exporter | `sarif-exporter/` | Export security findings and threat matrices into SARIF v2.1.0 JSON format |
| Finding Reconciliation | `finding-reconciliation/` | Merge duplicate SARIF/scan findings by code location and rule identity into one deduplicated finding set |
| SAMM Maturity | `samm-maturity/` | SAMM maturity self-assessment producing a scored maturity roadmap per engagement |
| SPDX SBOM | `spdx-sbom/` | Dependency extraction and SPDX SBOM generation |

## Usage

Skills are invoked by the PM orchestrator or team members using the trigger phrases defined in each `SKILL.md` file.

---

*Maintained by: co-security variant team*
