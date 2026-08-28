# Safety OS — Domain Context

> Variant-specific configuration for co-safety. This file is the WS-09-compliant
> variant context (shared SSOT template lives in `docs/context.md`).

## Tech Stack
<!-- VARIANT-INJECT: tech-stack -->

Safety OS is a docs/schema/workflow platform — no application source code.
Core tooling: Bun (TypeScript runtime), YAML (workflow schemas), JSON (evidence models).
<!-- END VARIANT-INJECT -->

## Agents
<!-- VARIANT-INJECT: agents -->

```text
PM (CSO — Chief Safety Officer)
  Governance track : PM → SGM → strategic decisions
  Operations track : PM → SWM → specialist agents
  Emergency track  : PM → emergency-agent  [SGM bypassed]
```

40 specialist agents: 2 orchestration (SGM, SWM), 9 functional (compliance,
legal, risk, reporting, training, PSM, asset integrity, contractor, occupational
health, MSDS), 22 industry (EHSChem, EHSConst, GasTerm, PowerGen, GMP, GLP,
GDP, GCP, GVP, MedDevice, Food, Cosmetics, Semicon, Battery, Shipbuilding,
Steel, DataCenter, Logistics, Railway, Waste, Defense, Biotech), 1 shared docs-writer,
2 audit/emergency, 2 GxP lifecycle. Full roster: `AGENTS.md`.
<!-- END VARIANT-INJECT -->

## Skills
<!-- VARIANT-INJECT: skills -->

Variant-specific workflow skills with `legal_basis` traceability:

| Skill | Used By Agents | Legal Basis |
|-------|---------------|-------------|
| risk-assessment | risk-assessment-agent, SWM | OSHA-KR Art 36 |
| permit-to-work | SWM, risk-assessment-agent | OSHA-KR Art 38 |
| emergency-response | emergency-agent | OSHA-KR Art 54 |
| compliance-gap | compliance-agent | OSHA-KR (general) |

Plus 30+ domain-specific skills (arc-flash-analyzer, gas-dispersion-analyzer,
ess-fire-risk-assessor, tank-integrity-validator, etc.). Full list: `AGENTS.md`.
<!-- END VARIANT-INJECT -->

## Development Workflow
<!-- VARIANT-INJECT: development-workflow -->

1. PM triages user request → dispatches to specialist agent
2. Specialist executes workflow (risk assessment, PTW, TBM, audit, etc.)
3. Evidence records written to `evidence-models/` with semver'd schemas
4. Every workflow record MUST include `legal_basis` (>=3 Korean EHS law articles)
5. `scripts/safety-audit.ts` validates `legal_basis` gate on audit runs
<!-- END VARIANT-INJECT -->

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Domain Guidelines

1. **`legal_basis` field is mandatory** in every workflow record
2. **Regulation content**: store metadata/references only — never embed full statutory text
3. **Evidence schemas** (`evidence-models/_shared/base/`): semver bump + migration required on change
4. **Legal interpretation**: user/organization responsibility — system provides automation assistance, not legal advice
5. **Computational integrity**: skills performing safety-critical calculations
   (arc-flash IEEE 1584, gas dispersion, tank integrity, ESS thermal runaway)
   MUST delegate to external tools — never estimate directly
6. **Country profile**: co-safety currently supports only the KR jurisdiction
   (`variant.json` `country_config.supported: ["KR"]`, default `KR`) — see
   `docs/countries/KR.md` for the active profile and `common/docs/country-profiles.md`
   for the mechanism. `regulations/KR/` holds Korea-specific regulation metadata
   (`regulations/international/` is jurisdiction-neutral and always ships); the
   `k-law` skill (inherited from `templates/common/`, KR-scoped per
   `docs/workspace-schema.json`'s `country_scoped_assets`) provides statutory
   research and is pruned from region-neutral scaffolds
<!-- END VARIANT-INJECT -->

## File Organization Policy
<!-- VARIANT-INJECT: file-organization -->

```
co-safety/
├── agents/              # Role-based agent definitions (_core/, _shared/, domains/)
├── skills/              # Reusable workflow skills (SSOT for all platforms)
├── workflows/           # Per-domain workflow schema.yaml + README.md pairs
├── evidence-models/     # JSON schemas for evidence records
├── regulations/         # Regulatory reference data (KR/*.yaml — KR country profile; international/ is jurisdiction-neutral)
├── industry-profiles/   # Industry-specific profile configs (26 profiles)
├── policies/            # CSO-approved governance policy documents
├── docs/countries/      # KR.md — active country profile (see docs/countries/KR.md, common/docs/country-profiles.md)
├── docs/                # context.md (SSOT) + co-safety.context.md (this file)
├── scripts/              # Automation scripts (TypeScript via bun)
├── memory/               # Session logs (MEMORY.md index + daily logs)
├── mcp/                  # Project-local MCP server implementations
├── .claude/              # Claude Code settings, commands, skills
├── .gemini/              # Gemini CLI settings, commands, skills
└── .agents/              # Antigravity settings, skills
```
<!-- END VARIANT-INJECT -->

## Domain Rules
<!-- VARIANT-INJECT: domain-rules -->

### Regulatory Framework

- **OSHA-KR** (`산업안전보건법`): Primary workplace safety framework (`고용노동부`).
  Key articles: 15 (safety manager), 29 (training), 36 (risk assessment),
  38 (safety measures), 54 (serious accident response), 63 (contractor safety).
- **SAPA** (`중대재해처벌법`): Criminal liability for serious industrial accidents
  (effective 2022-01-27). Key articles: 4 (CEO safety duty), 6 (penalties),
  13 (record keeping).
- Full Tier 1-4 regulatory scope: see `AGENTS.md`.

### Workflow Library

| Workflow | Legal Basis | Agent Chain |
|----------|-------------|-------------|
| risk-assessment | OSHA-KR Art 36, 38 + SAPA Art 4 | SWM → risk-assessment-agent |
| permit-to-work | OSHA-KR Art 38 + SAPA Art 4 | SWM → risk-assessment → compliance |
| equipment-inspection | OSHA-KR Art 93, 108 + SAPA Art 4 | SWM → audit-agent |
| contractor-management | OSHA-KR Art 63, 61 + SAPA Art 5 | SWM → compliance → risk-assessment |
| safety-training | OSHA-KR Art 29 + SAPA Art 8 | SWM → compliance-agent |
| safety-patrol | OSHA-KR Art 15, 16 + SAPA Art 4 | SWM → risk-assessment → audit |
<!-- END VARIANT-INJECT -->

---

## Variant-Specific PM Configuration

### Governance Workflow

<!-- VARIANT-SECTION: governance-workflow -->
## Governance Workflow

The PM acts as **Chief Safety Officer (CSO)** and is the SINGLE point of entry for
Safety OS. All specialist agents are dispatched only through the PM (4-level
enforcement: tool-level, system-prompt-level, agent-file-level, QA-gate-level).
Every workflow must pass the `legal_basis` gate (>= 3 Korean regulatory sources,
e.g. OSHA-KR / SAPA articles) before dispatch; violations escalate to the PM
immediately. The PM is an escalation gateway, not an executor — direct execution
is limited to the whitelist in `AGENTS.md` PM Gateway Policy.
<!-- END VARIANT-SECTION -->


### Agent Roster

<!-- VARIANT-SECTION: agent-roster -->
## Agent Roster

Safety OS agents only: orchestration (PM/CSO), safety management (governance,
workflow, training, PSM, MSDS), compliance & risk (compliance, legal, risk,
reporting), emergency & audit (emergency, disaster, incident investigation,
audit), shared specialists (asset integrity, contractor safety, occupational
health, docs-writer), and domain agents under `agents/domains/` (5 functional +
22 industry: EHS, GxP, medical devices, food/cosmetics, high-tech and heavy
industries). The canonical dispatch index lives in `AGENTS.md`.
<!-- END VARIANT-SECTION -->


### Dispatch Protocol

<!-- VARIANT-SECTION: dispatch-protocol -->
## Dispatch Protocol

`User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate →
Finalization`. Trigger precedence: (1) domain specificity wins; (2) functional
specialization wins for cross-cutting tasks; (3) shared skills are the single
entry point for cross-industry workflows (TBM → `tool-box-meeting`, PTW →
`permit-to-work`); (4) PM arbitration — ask the user to clarify scope before
dispatching. Every execution plan ends with `/sync`. Full specialist roster and
dispatch triggers: `AGENTS.md` Specialist Agent Roster.
<!-- END VARIANT-SECTION -->