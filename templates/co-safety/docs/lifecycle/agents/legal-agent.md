# Governance Record: legal-agent

Runtime definition: `agents/_shared/legal-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/legal-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Live-retrieval toolchain named: `k-law` skill (법제처 Open API; replaced `mcp-kr-legislation` MCP, removed 2026-08-26) plus K-Skill OpenAPI for statute, enforcement-decree, and MOEL-guideline retrieval; unreachable/contradictory service escalates to PM (CSO)
- [x] Attribution rule strictly enforced: all retrieved data must carry explicit source citations (`[Source: MOEL OpenAPI / Law ID: XXX]`); unverified claims must be marked `Unverified` — matches project Source Attribution standards
- [x] Regulation metadata base exists: `regulations/KR/` directory (incl. `legal-glossary.yaml`, `OSHA-KR.yaml`, `SAPA.yaml`) backs the agent's metadata reference
- [x] Escalation triggers defined: workflows lacking clear legal basis or violating identified regulations are escalated to PM before execution
- [x] Advisory-only boundary explicit: outputs are not legally binding counsel; KPIs include zero unverified legal claims
