# ADR-0051: co-abap Stable Promotion

**Status**: Accepted
**Date**: 2026-08-15
**Deciders**: pm, architect
**Supersedes**: ADR-0020 (abap_vibe_coding variant conversion)

## Context

The `co-abap` variant began as the standalone `abap_vibe_coding` project. ADR-0020 documented its conversion from a monolithic standalone project into a co-develop variant that references the workspace root CONSTITUTION.md for governance.

Following the variant lifecycle defined in CONSTITUTION.md, `co-abap` operated as a Phase A prototype while its structural compliance was validated and its agent/skill roster was stabilized. The promotion checklist criteria have been met:

- **Phase A complete**: All required variant files (AGENTS.md, CLAUDE.md, GEMINI.md, README.md, agents/, skills/, scripts/) are present and pass `validate-templates.ts`.
- **Agent roster finalized**: 21 agents covering SAP module analysts (SD, MM, FI, CO, PP, LE), technical execution (architect, code-writer, test-runner, DBA, DevOps, interface-expert, Fiori, form, GUI-scripter, security-monitor), and SAP-specific roles (sap-investigator, read-only-analyst, schema-inspector).
- **12 variant-specific skills** defined with proper phase mapping and platform parity flags.
- **5 local scripts** (vsp-task, vsp-audit, install-vsp, install-bun, setup) plus 7 operational scripts (new-requirement, scratch-cleanup, dispatch, dispatch-parallel, dispatch-serial, retry-handler, vsp-publish).
- **Governance integration**: PM Gateway workflow, Pre-Edit Quality Gate, and workspace boundary policy all enforced.

## Decision

Promote `co-abap` from Phase A prototype to **stable** status (v1.0.0).

- Update `variant.json` `status` to `"stable"` and `version` to `"1.0.0"`.
- Set `lifecycle.stablePromotedOn` to `"2026-08-15"`.
- The variant is now available as a production-ready template for SAP ABAP development projects.

## Consequences

**Positive:**

- `co-abap` is now a first-class stable variant, discoverable alongside co-design, co-develop, co-security, and co-consult in the variant roster.
- SAP ABAP development teams can scaffold new projects from a validated, governance-compliant template.
- Workspace governance updates (CONSTITUTION.md, scripts/) automatically propagate via the L1 common template inheritance chain.

**Negative / Trade-offs:**

- Stable status raises the bar for future changes: breaking modifications to the co-abap template contract now require a major version bump per ADR-0026's Template Version Policy.
- The vsp MCP server dependency means co-abap projects require external tooling beyond the standard workspace toolset.

**References:**

- ADR-0020: abap_vibe_coding variant conversion
- ADR-0026: Variant creation procedure and template version policy
- ADR-0031: L1-L2 Fork Model
