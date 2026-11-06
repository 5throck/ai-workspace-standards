# Security-Audit Skill — Lifecycle Record

## Metadata
- **Skill**: security-audit
- **Status**: active
- **Version**: 1.1.0
- **Created**: 2026-11-07
- **Last Updated**: 2026-11-07

## Description
Six-phase adversarial security audit workflow: find vulnerabilities that violate a real trust boundary, then deliver source evidence, safe reproduction, priority, and the smallest effective fix. Covers web protocols and auth, AI/LLM surfaces, cloud deployment, client-side, memory safety, supply chain, and more, with findings and coverage-ledger validators.

## Changelog
- 2026-11-07: Upstream validator test suites executed post-adoption (user-directed progression; the "after human review" condition was treated as satisfied — two independent agent scans, full gate suite, commits landed): `node validate-findings.test.cjs` → 34 pass / 0 fail; `node validate-coverage-ledger.test.cjs` → 31 pass / 0 fail (Node v26.10.0, run from /tmp with absolute paths, vendored dir never CWD). The "never execute the `.cjs` validators against untrusted input" boundary is unchanged — it applies to untrusted target input, not to the validators' self-tests over bundled fixtures.
- 2026-11-07: Version 1.0.0 → 1.1.0 — hub_topology consumer-floor alignment: co-develop declares domain-level `hub.consumes` minimum_version 1.1.0 for co-security, and the workspace `hub-consumer-min-version` leg enforces every co-security registry entry at or above that floor (DEC-20261107-02). Frontmatter/registry markers only; upstream body unchanged.
- 2026-11-07: Vendored from cloudflare/security-audit-skill (MIT, pinned c1c8a8c1471069fb0e188eeaff69b8e8db6564a8) into the co-security hub project (`Projects/co-security/skills/security-audit/`), independently verified, then promoted verbatim to the L2 canonical template (`templates/co-security/skills/security-audit/`) per design 2026-11-07-security-audit-skill-adoption-design (DEC-20261107-01; L2 promotion + declaration directed by DEC-20261107-02). Variant-exclusive to co-security; registered in the SKILLS.md Registry and in `hub_topology` assets (docs/workspace-schema.json).

## Dependencies
- Node.js >= 18 (zero-dependency findings/coverage-ledger validators)
- OS-enforced sandbox (no network, allowlisted environment, resource limits, scratch-only writes) for any target-controlled execution
- Isolated sub-agent dispatch capability (Task-tool equivalent)
- Composes with: finding-reconciliation, sarif-exporter

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-11-07 | - | production | Vendored from upstream (MIT, pinned c1c8a8c1), verified, promoted to L2 canonical template | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/security-audit/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in SKILLS.md Registry
- [x] Scope: co-security
- [x] Upstream provenance recorded: source URL, pinned SHA, vendored date, license (MIT)
- [x] L2 copy is a byte-exact mirror of the hub vendored copy (21/21 files, cmp)

## Notes
- Variant-exclusive to co-security; no L0 dev-home copy
- Vendored content is third-party (Cloudflare, MIT); read/copy only — never execute the `.cjs` validators against untrusted input
- VENDOR-NOTICE.md inside the skill folder documents upstream provenance
- Owner: security-expert
