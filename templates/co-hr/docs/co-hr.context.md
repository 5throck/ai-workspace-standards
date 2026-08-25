# co-hr Context

co-hr is a 12-agent Multi-AI-Team for labor-law compliance of the target jurisdiction (country profiles under `docs/countries/`), HR management/development, and organizational design consulting. It routes incoming engagements to one of 11 domain-lead archetypes (labor compliance, labor relations, safety & health, org design, compensation & benefits, performance management, talent acquisition, learning & development, career & succession, change management, or cross-functional transformation), each drawing on a shared bench of specialist agents and skills. PM performs intake classification, dispatches the archetype lead and supporting agents, and enforces compliance sign-off and approval gates before any deliverable reaches the client.

## Tech Stack

<!-- VARIANT-INJECT: tech-stack -->
| Purpose | Tool |
|---------|------|
| AI-team orchestration | Multi-platform agent team (Claude Code + Gemini CLI) |
| Operational scripts | TypeScript, run via `bun scripts/*.ts` |
| Architecture | Agent role definitions (`agents/*.md`) + skills (`skills/<name>/SKILL.md`) |
<!-- END VARIANT-INJECT -->

## Agents

<!-- VARIANT-INJECT: agents -->
| Agent | Tier | Role |
|-------|------|------|
| **pm** | medium | Engagement orchestration — intake classification, archetype routing, client interface, QA gate |
| **labor-compliance-analyst** | medium | labor-law compliance review (jurisdiction per active country profile), work rules maintenance, wage & working-time system review |
| **labor-relations-specialist** | medium | labor-relations-authority case response, collective bargaining strategy support, labor-management council operation advisory, precedent research |
| **safety-health-officer** | medium | occupational safety and health compliance (incl. serious-accident liability regimes where enacted), safety and health management system + safety-health committee operation |
| **org-design-consultant** | medium | Org structure/job architecture design, workforce planning, governance, reorganization, workforce restructuring linked to voluntary retirement and outplacement support |
| **compensation-benefits-analyst** | medium | Wage structure, incentives, benefits design, compensation benchmarking (HRM) |
| **performance-management-consultant** | medium | Evaluation system, KPI/OKR design, performance feedback process (HRM) |
| **talent-acquisition-specialist** | medium | Recruiting strategy, sourcing, selection process, talent pipeline design (HRM) |
| **learning-development-specialist** | medium | Training system design, competency model, training program operation (HRD) |
| **career-succession-consultant** | medium | Career path design, leadership pipeline, succession planning (HRD) |
| **change-management-partner** | medium | Change management for reorganizations/new-system rollouts, stakeholder alignment, resistance management, organizational culture diagnosis with DEI lens |
| **data-analyst** | medium | Workforce statistics, turnover/hiring-conversion/labor-cost analysis, HR dashboards/people analytics |

> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.

### Team Configuration Scenarios

| Archetype | Lead | Support |
|---|---|---|
| Labor Law Compliance Audit | labor-compliance-analyst | safety-health-officer, data-analyst |
| Labor Dispute / Labor-Relations-Authority Response | labor-relations-specialist | labor-compliance-analyst, change-management-partner |
| Occupational Safety & Health Compliance | safety-health-officer | labor-compliance-analyst, org-design-consultant |
| Org Restructuring / Workforce Planning | org-design-consultant | change-management-partner, data-analyst, labor-compliance-analyst, talent-acquisition-specialist |
| Compensation & Benefits Redesign | compensation-benefits-analyst | org-design-consultant, data-analyst, performance-management-consultant |
| Performance Management System Design | performance-management-consultant | compensation-benefits-analyst, learning-development-specialist |
| Talent Acquisition Strategy | talent-acquisition-specialist | compensation-benefits-analyst, org-design-consultant |
| Learning & Development / Capability Building | learning-development-specialist | career-succession-consultant, performance-management-consultant |
| Career & Succession Planning | career-succession-consultant | learning-development-specialist, data-analyst |
| Change Management / Culture & Rollout | change-management-partner | domain lead of the underlying change + data-analyst |
| Cross-Functional HR Transformation | pm (coordinates multiple leads sequentially/in parallel) | all agents as needed |

PM classifies the incoming request at Phase 0 intake and assigns it to the matching archetype row above. If a request spans multiple archetypes, PM either sequences them — letting one archetype's engagement complete (through Phase 4) before the next starts — or, for the "Cross-Functional HR Transformation" case, runs the relevant archetypes with PM directly coordinating cross-validation between leads, mirroring co-consult's Phase 1.5 Cross-Validation Matrix pattern (see [`engagement-orchestration.md`](engagement-orchestration.md)).
<!-- END VARIANT-INJECT -->

## Skills

<!-- VARIANT-INJECT: skills -->
Ten variant-specific domain skills are registered for co-hr in `skill_manifest.variant_specific` (`variant.json`); see `skills/SKILLS.md` for the authoritative registry, versions, and owners. In addition, skills inherited from `templates/common` are available to all agents, with one exception: KR-scoped skills in the `country_scoped_assets` registry — `k-law` (Korean statutory research via the open.law.go.kr API) and `k-kosis` (Korean national statistics) — deploy only to projects scaffolded with `--country KR` (see `docs/countries/`).

| Skill | Owner |
|-------|-------|
| `k-law` (present only in KR-scaffolded projects) | labor-compliance-analyst / labor-relations-specialist / safety-health-officer (statutory research when the active profile is KR) |
| `stakeholder-alignment` | change-management-partner |
| `org-readiness-assessment` | change-management-partner |
| `consulting-report-writing` | shared — pm (final deliverable formatting, available to any agent) |
| `org-design-framework` | org-design-consultant |
| `hr-metrics-analysis` | data-analyst |
| `talent-acquisition-strategy` | talent-acquisition-specialist |
| `compensation-benchmarking` | compensation-benefits-analyst |
| `performance-system-design` | performance-management-consultant |
| `learning-curriculum-design` | learning-development-specialist |
| `career-path-succession-planning` | career-succession-consultant |

> Lifecycle management: `bun scripts/skill-lifecycle-audit.ts`
<!-- END VARIANT-INJECT -->

## Environment Setup

<!-- VARIANT-INJECT: environment-setup -->
- `bun install` — installs dependencies for the bun-run TypeScript operational scripts.
- `LAW_API_OC` environment variable — **required** by the `k-law` skill (present only in KR-scaffolded projects) to query the National Law Information Center Open API (open.law.go.kr).
- Git Bash required on Windows — workspace hooks and operational scripts use Unix-style shell conventions.
<!-- END VARIANT-INJECT -->

## Development Workflow

<!-- VARIANT-INJECT: development-workflow -->
| Phase | Name | What Happens | Primary Owner |
|-------|------|--------------|---------------|
| 0 | Intake & Archetype Classification | PM classifies the incoming request into one of 11 engagement archetypes (see Team Configuration Scenarios above) and assigns the archetype's lead + supporting agents | pm |
| 1 | Diagnosis & Research | Archetype lead conducts research/diagnosis (statutory research per the active country profile, workforce data via data-analyst, or domain-specific per archetype) | Archetype lead |
| 1.5 | Compliance & Cross-Validation | For any engagement with legal exposure (restructuring, policy change, dismissal-adjacent), labor-compliance-analyst signs off before Phase 2; data-analyst validates any quantitative claim's methodology | pm (dispatches validators) |
| 2 | Design & Approval Gate | Archetype lead + supporting agents produce the design/recommendation; **approval gate** — no execution without client sign-off | Archetype lead |
| 3 | Stakeholder Validation | change-management-partner is always involved here regardless of archetype lead, for any org-wide rollout | change-management-partner |
| 4 | Delivery & Rollout | Final deliverable production and rollout plan execution | Archetype lead |
<!-- END VARIANT-INJECT -->

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Guidelines

- **Documentation language**: English only for all documentation and deliverables; statute names and legally required proper nouns of the active jurisdiction remain in that jurisdiction's language.
- **Legal disclaimer**: co-hr deliverables are not legal advice. Matters requiring a legal determination must be reviewed by the jurisdiction's licensed labor professional or lawyer (per the active country profile).
<!-- END VARIANT-INJECT -->

## Computational Integrity

All numeric outputs in deliverables (aggregations, statistics, percentages, metrics) must be computed by executed code (bun/TypeScript scripts) — never by the AI performing arithmetic directly. High-precision or safety-critical domains (Class A: aerospace, precision control, regulated finance) require validated external tools. See `docs/context.md` § Computational Integrity Standards for the full policy; label AI estimates **approximate**.

## File Organization Policy

<!-- VARIANT-INJECT: file-organization -->
| Path | Contents |
|------|----------|
| `agents/` | Agent role definitions (one `.md` per agent) |
| `skills/` | Variant-specific skills (`<name>/SKILL.md`) |
| `docs/` | Variant context (this file) and engagement documentation |
| `.claude/`, `.gemini/` | Platform configuration (commands, skills, settings) |
<!-- END VARIANT-INJECT -->

## Domain Rules

<!-- VARIANT-INJECT: domain-rules -->
Applicable statute families are defined by the active country profile (`docs/countries/<CODE>.md`; see `docs/countries/KR.md` for the KR profile's statute families — labor standards, trade union & labor relations adjustment, worker participation & cooperation, occupational safety and health, and serious-accident liability). Identify the active profile at Phase 0 intake; when no profile is active, confirm the applicable jurisdiction with the client before any statutory work. **[HR-R1]**
<!-- END VARIANT-INJECT -->

<!-- COMMON-CONTEXT:START -->
This project follows the workspace coding standards defined in the project's Coding Guidelines section.

Key rules:
- All operational scripts must be TypeScript (`.ts`) — run via `bun scripts/<name>.ts` (ADR-0036; no `.sh`/`.ps1` pairs)
- Git hook scripts in `.githooks/` remain Unix shell (`.sh`) for git compatibility
- All text files saved as **UTF-8 (without BOM)**
- Commit messages and PR artifacts in **English only**
<!-- COMMON-CONTEXT:END -->

---

*co-hr.context.md version: 1.1 — restructured to the WS-09 standard slot order (Tech Stack / Agents / Skills / Environment Setup / Development Workflow / Guidelines / File Organization Policy / Domain Rules); v1.0 content preserved*

---

## Variant-Specific PM Configuration

### Governance Workflow

<!-- VARIANT-SECTION: governance-workflow -->
## Governance Workflow

PM orchestrates HR/labor consulting engagements through four phases:

- **Phase 0 - Intake**: Clarify engagement scope with the client (labor compliance
  audit, HRM/HRD design, org restructuring, change management, or a combination).
  Identify the applicable law families up front (per the active country profile,
  `docs/countries/`) so the correct
  labor-relations specialists are engaged from Phase 1.
- **Phase 1 - Research & Diagnosis**: Dispatch labor-compliance-analyst,
  labor-relations-specialist, safety-health-officer (statutory/labor research), and
  data-analyst (baseline workforce metrics) as needed. Dispatch change-management-partner
  for culture/readiness diagnosis when restructuring or new-system rollout is in scope.
- **Phase 2 - Design**: Dispatch the relevant HRM/HRD specialists (talent-acquisition,
  compensation-benefits, performance-management, learning-development,
  career-succession) plus labor-relations-specialist/safety-health-officer for
  compliance-constrained design elements. org-design-consultant synthesizes all
  Phase 2 inputs into a coherent structural design, including restructuring/voluntary-retirement
  process design when in scope.
- **Phase 3 - Validation & Delivery**: change-management-partner leads rollout/adoption
  planning off the approved org-design-consultant output; data-analyst measures impact
  and delivers final metrics to PM for engagement synthesis.

Every deliverable touching statutory interpretation (labor-compliance-analyst,
labor-relations-specialist, safety-health-officer outputs) must carry the legal
disclaimer and be flagged for review by the jurisdiction's licensed labor professional or lawyer where ambiguous.
This section replaces the workspace PM's governance workflow with variant-specific logic.
<!-- END VARIANT-SECTION -->


### Agent Roster

<!-- VARIANT-SECTION: agent-roster -->
## Agent Roster

See [AGENTS.md](../AGENTS.md) for the full 12-agent roster (this pm agent plus 11
specialists spanning labor compliance/relations/safety, HRM, HRD, org design, change
management, and HR data analytics).
This section replaces the workspace PM's agent roster with variant-specific agents.
<!-- END VARIANT-SECTION -->


### Dispatch Protocol

<!-- VARIANT-SECTION: dispatch-protocol -->
## Dispatch Protocol

**Tier**: claude=high (PM orchestrates a 12-agent roster spanning legal-compliance,
HRM, HRD, org design, and change management domains — high-tier reasoning is
required to correctly sequence handoffs and catch compliance-review gaps).

PM dispatches specialists per the Governance Workflow phase mapping above. Every
specialist agent is PM-only invocation (see each agent's "⚠️ PM-ONLY INVOCATION"
section) — PM never allows a user to bypass PM and address a specialist directly.
This section replaces the workspace PM's dispatch protocol with variant-specific logic.
<!-- END VARIANT-SECTION -->