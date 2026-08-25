# Transport Release Quality Gate

> **Owner**: `devops-admin` (release decision)  
> **Upstream workflow**: [skills/abap-dev/SKILL.md](../skills/abap-dev/SKILL.md) `sap:transport-manager`  
> **Decision record**: closes the co-abap gap "No transport-release quality gate doc (release-strategy rules, import ordering)" from the variant benchmark backlog (`docs/variant-benchmark-backlog.md` §11, co-abap row), closed 2026-08-25.

---

## Purpose

The rules governing transport release were previously split across two contracts:

- [agents/devops-admin.md](../agents/devops-admin.md) - the QA-chain constraint, the never-release-with-failures behavior rule, and the "Quality Gate & Release Log" output section.
- [skills/abap-dev/SKILL.md](../skills/abap-dev/SKILL.md) `sap:transport-manager` - the create/add/release workflow and its step 4 pre-release gate.

This checklist consolidates both into a single runbook the `devops-admin` agent walks before every `ReleaseTransport` call. It does not change either contract - it restates their rules in execution order and adds the import-ordering rules that were previously undocumented.

## Release Gate

Run all four checks, in this order, before releasing:

| # | Check | Pass condition | Source contract |
|---|-------|----------------|-----------------|
| 1 | `SyntaxCheck` | 0 errors on ALL objects in the request | devops-admin Constraints (QA chain); abap-dev `sap:transport-manager` step 4 |
| 2 | `RunUnitTests` | 0 failures (100% pass) | devops-admin Constraints (QA chain); abap-dev `sap:transport-manager` step 4 |
| 3 | `GetCodeCoverage` | ≥ 70% | devops-admin Constraints (QA chain) |
| 4 | `RunATCCheck` | 0 Priority-1 findings | devops-admin Constraints (QA chain) + Behavior rule 1; abap-dev `sap:transport-manager` step 4 + golden rule |

**Hard rule**: any failing row means NO release **[ABAP-R1]**. Releasing a transport request with failing unit tests or Priority-1 ATC findings violates the core project governance rules (devops-admin Behavior rule 1). If a failure cannot be resolved, escalate to the PM - never release with Priority-1 ATC findings (abap-dev `sap:transport-manager` golden rule).

## Release Strategy Rules

- **One transport request per logical change.** Unrelated changes go into separate requests.
- **Check before creating.** Call `ListTransports` first; reuse an open request only when the task is part of the same ongoing change (abap-dev `sap:transport-manager` step 1).
- **Describe the request strictly as `<type>: <summary>`** (e.g., `feat: sales order pricing fix`) - devops-admin Behavior rule 2.
- **Add objects as they are written.** Call `AddToTransport` immediately after each `WriteSource` / `EditSource` / `Activate`, with the object URL and transport number, so the request is complete at release time (abap-dev `sap:transport-manager` step 3).
- **Keep writes strictly serial** - never parallelize `WriteSource` / `EditSource` (devops-admin Constraints).
- **Log the release.** Record the released transport number in `memory/YYYY-MM-DD.md` (abap-dev `sap:transport-manager` step 5).

## Import Ordering

Standard CTS practice, stated conservatively:

- Imports follow release sequence: requests are imported into the target system in the order they were released in the source layer.
- For a change spanning multiple requests, release in dependency order and import into the target system in that same order.
- The QAS import and verification (the release gate is re-checked there) precede any PRD import - the input contract's `target_system` is `QAS|PRD`, and QAS is the verification layer.
- Single-request changes are preferred precisely because they cannot be imported out of order.

## Checklist

The runbook `devops-admin` walks for each release:

| Step | Action | Tool | Done when |
|------|--------|------|-----------|
| 1 | Confirm request contents | `GetTransport` | Object list matches the intended change - no missing or stray objects |
| 2 | Gate check 1 | `SyntaxCheck` | 0 errors on all objects |
| 3 | Gate check 2 | `RunUnitTests` | 100% pass |
| 4 | Gate check 3 | `GetCodeCoverage` | ≥ 70% |
| 5 | Gate check 4 | `RunATCCheck` | 0 Priority-1 findings |
| 6 | Resolve or escalate failures | - | Fix applied and gate re-run, or PM escalation recorded - no release while any row fails |
| 7 | Release the request | `ReleaseTransport` | Release status is `Released` |
| 8 | Record the transport | - | Transport number logged in `memory/YYYY-MM-DD.md` |
| 9 | Report | - | Output contract section 2 "Quality Gate & Release Log" filled in (checkboxes + release status) |

## Consumers

| Consumer | Role |
|----------|------|
| [agents/devops-admin.md](../agents/devops-admin.md) | Owner of the release decision; its Behavior rule 6 requires running this checklist before every `ReleaseTransport` |
| [skills/abap-dev/SKILL.md](../skills/abap-dev/SKILL.md) `sap:transport-manager` | Upstream workflow whose step 4 pre-release gate this doc expands |

This checklist does not modify either contract - it consolidates them.
