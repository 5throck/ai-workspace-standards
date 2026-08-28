# agents/

Safety OS agent definitions — the full roster and dispatch rules live in
[`../AGENTS.md`](../AGENTS.md) (canonical agent index, auto-loaded by Claude Code).

This variant uses a **nested roster layout**:

```
agents/
├── pm.md                      # CSO override (extends templates/common pm.md); CSO-specific
│                               #   Section A/B/C content lives in docs/co-safety.context.md
├── safety-governance-manager.md  # SGM — flat, self-contained (no common-template counterpart)
├── safety-workflow-manager.md    # SWM — flat, self-contained (no common-template counterpart)
├── _shared/                   # Cross-cutting specialists
└── domains/
    ├── functional/            # psm, msds, training
    └── industry/              # 21 industry domain agents (ehschem, gasterm, gmp, ...)
```

Every specialist agent file follows the mandatory **3-Section structure**:

1. **Section A — Legal Basis**: applicable Korean EHS/GxP law articles
   (OSHA-KR, SAPA, domain acts) with enforcement agency and tier
2. **Section B — Role & Responsibilities**: purpose, KPIs, boundaries
3. **Section C — Operational Protocols & Escalation Rules**: procedures,
   escalation thresholds, handoff protocols

All agents are dispatched **only through the PM/CSO gateway** — never invoked
directly. Register new agents in `AGENTS.md` and verify with
`bun scripts/agent-verify.ts`.
