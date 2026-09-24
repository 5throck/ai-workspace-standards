# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-security variant-exclusive skills (T-20260924-009). One row per variant-exclusive skill directory; values come from each skill's SKILL.md frontmatter.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `finding-reconciliation` | 1.0.0 | active | security-expert | 2026-08-25 | — | co-security only — deduplicate SARIF/scan findings by code location |
| `samm-maturity` | 1.0.0 | active | pm | 2026-08-24 | — | co-security only — OWASP SAMM self-assessment and maturity roadmap |
| `sarif-exporter` | 1.0.1 | active | security-expert | 2026-08-25 | — | co-security only — export findings and threat matrices to SARIF v2.1.0 |
| `spdx-sbom` | 1.0.0 | active | pm | 2026-08-24 | — | co-security only — SPDX 2.3 SBOM generation from dependency manifests |
| `stride-threat-matrix` | 1.0.0 | active | security-expert | 2026-08-06 | — | co-security only — STRIDE threat matrix generation with DREAD scoring |
| `verify-authorization` | 1.0.0 | active | pm | 2026-06-13 | — | co-security only — hard gate for signed authorization documents |

## Usage

Skills are invoked by the PM orchestrator or team members using the trigger phrases defined in each `SKILL.md` file.

---

*Maintained by: co-security variant team*
