# Project Documentation

This directory contains all project documentation, organized by the lifecycle stage of the content rather than by subject-matter word association.

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `adr/` | All project Architecture Decision Records — the unified `ADR-NNN-slug.md` series (`ADR-001`…`ADR-017`, plus `ADR-0036`/`ADR-0037` from the workspace-level registry) including ADR-017 (the four-domain elevation architecture platform charter). Bare-number `00NN-slug.md` filenames were renamed to the `ADR-NNN` convention to unify the series; ADR numbers and IDs are unaffected |
| `designs/` | Hand-written feature/technical designs — the spec-ID system of record (ELEV, AXIS, PKG, AI, MCP, GOLDEN, etc. series), each named `<SPEC-ID>-design.md`. Architecture Decision Records live in `adr/`; skill-generated design specs live in `superpowers/specs/` |
| `superpowers/` | Brainstorming-skill output zone — `specs/` (skill-generated design specs) and `plans/` (skill-generated implementation plans). The hand-written equivalents live in `designs/` and `plans/`; the split between the two is intentional (by origin), not accidental |
| `reference/` | Living reference material, updated in place as the system evolves — status pages, vision docs, roadmap-reconciliation tables, postmortems, and other "the system as it stands" documents with no natural end state |
| `firm-governance/` | Org/business-process governance for the architecture-*firm* domain (agent team design, HITL gates, liability boundaries), plus persistent strategic initiatives such as the production-readiness program — kept separate from the CAD *software* documentation above to avoid the old "architecture" naming collision |
| `plans/` | Dated, time-boxed execution plans and roadmaps (`YYYY-MM-DD-<slug>.md`) that become historical once executed |
| `guides/` | End-user-facing guides — first-time setup, file curator, sandbox, CAD entity & space extraction |
| `research/` | Point-in-time research reports citing external sources — apartment design trends, story analysis, UX research (each must include a `## References` section, enforced by `scripts/audit.ts`) |
| `lifecycle/` | Lifecycle records for agents, skills, scripts, and project governance artifacts |
| `release/` | Release-specific notes and changelogs for delivered milestones |
| `reports/` | Review reports, audits, and generated status summaries retained for traceability |
| `specs/` | Project-level specifications retained outside the skill-generated `superpowers/specs/` tree |

**Placement rule for new docs** — ask in order: (1) Is it an Architecture Decision Record? → `adr/`. (2) Is it a hand-written Design Gate deliverable / feature design? → `designs/`. (3) Is it skill-generated (brainstorming output)? → `superpowers/specs/` (design) or `superpowers/plans/` (implementation plan). (4) Is it a living description of the system with no natural end-state? → `reference/`. (5) Is it firm-governance/process content, or a persistent cross-cutting program? → `firm-governance/`. (6) Is it a dated, time-boxed plan or roadmap? → `plans/`. (7) Is it written for an end user? → `guides/`. (8) Is it a research report citing external sources? → `research/`.

## Root-Level Files

| File | Purpose |
|------|---------|
| `context.md` | Single source of truth for all AI tools — architecture, tech stack, coding guidelines, multi-agent workflow (IMMUTABLE) |
| `co-architect.context.md` | Project-specific customization layer extending `context.md` |
| `phase-definitions.md` | Multi-agent workflow phase definitions (7 phases, 6 workflows) |
| `security.md` | Security policies, vulnerability reporting, and secure development guidelines |
| `testing-guidelines.md` | Testing standards, directory structure, temp resource management |

## Context Files

The `context.md` / `co-architect.context.md` files are the primary reference for:

- **Project Overview**: Tech stack, architecture, folder structure
- **Development Workflow**: Git conventions, PR process, sync pipeline
- **Coding Guidelines**: Language rules, file encoding, open-source policy
- **Multi-Agent System**: Agent roles, skills, dispatch protocols
- **Key Files**: Reference to all important project files

All AI tools (Claude Code, Gemini CLI, Codex) load these files at session start.

---

*Project documentation — co-architect*
