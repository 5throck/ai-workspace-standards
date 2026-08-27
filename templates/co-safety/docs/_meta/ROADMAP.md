# Safety OS — Strategic Roadmap

> Living document. Updated bi-weekly during architecture review meetings.
> Last Updated: 2026-08-27 | Owner: PM / Chief Safety Officer (CSO)

## Current State (2026-08-06)

| Metric | Value |
|--------|-------|
| Industry domains | 22 |
| Functional domains | 8 |
| Total domains | 30 |
| Domain agents | 25 |
| Shared/core agents | 15 |
| Workflows (schema.yaml) | 191 |
| Evidence models | 155 |
| Skills | 49 |
| Regulation YAMLs | 43 |
| Cross-cutting shared models | 2 (TBM, LOTO) |
| Version | 0.1.0 (first release cut) |

## Strategic Direction

The project completed a 7-week **horizontal expansion** phase (4 → 22 industry domains). The next phase shifts from breadth to **depth**: maturing existing domains, retiring structural debt, and establishing sustainable governance.

### Phase Transitions

```
Phase 1: Foundation (DONE)        Phase 2: Maturation (CURRENT)      Phase 3: Automation (NEXT)
─────────────────────────         ─────────────────────────           ──────────────────────────
• 30 domains scaffolded           • Domain maturity leveling          • Automated compliance checks
• 191 workflows                   • Cross-cutting consolidation       • MCP live law verification
• TBM + LOTO cross-cutting        • Profile/schema standardization    • Multi-tenant deployment
• 43 statute YAMLs                • Release cadence established       • Performance & scalability
```

## Phase 2: Maturation (2026-08-06 → 2026-10-31)

### 2.1 Domain Maturity Leveling (P2-2)

The 12 newer industry domains (logistics, railway, waste, defense, biotech, battery, shipbuilding, steelmaking, datacenter, semicon, food, cosmetics) have a maturity gap versus the original 4 (ehschem, ehsconst, gasterm, powergen):

| Cohort | Avg Workflows | Avg Skills | Avg Evidence Models |
|--------|--------------|-----------|---------------------|
| Original 4 | 10.0 | 3.3 | 8.5 |
| GxP 5 | 8.4 | 2.0 | 7.8 |
| Newer 12 | 5.0 | 1.0 | 5.0 |

**Target**: Bring all 12 newer domains to **Maturity Tier 2** (minimum: 5 workflows, 1 skill, 5 evidence models, full handoff protocols) by 2026-10-31. See [domain-maturity-matrix.md](domain-maturity-matrix.md) for per-domain tracking. **✅ Achieved 2026-08-07 — all 12 industries promoted to Tier 2 (ahead of the 2026-10-31 target).**

### 2.2 Cross-Cutting Consolidation (P1-4, P2-4)

Apply the ADR-001 promotion pattern to additional cross-cutting concerns:
- [x] TBM (Tool Box Meeting) — promoted to `_shared/tbm-record.json`
- [x] LOTO (Lockout/Tagout) — pilot base at `_shared/loto-record.json` (ADR-001)
- [ ] Confined Space Entry — promote to `_shared/confined-space-record.json` (P2-4)
- [ ] Hot Work Permit — evaluate promotion candidacy
- [ ] Inspection — evaluate shared inspection-result model

### 2.3 Structural Debt Retirement

- [x] Profile schema standardization (P1-1 — 26 profiles migrated to canonical schema)
- [x] PM-ONLY INVOCATION enforcement (P1-3 — 3 shared agents fixed)
- [x] TBM dispatch ambiguity (P1-2 — 14 agents de-duplicated)
- [ ] Dispatch trigger precedence rules (P2-3 — document in AGENTS.md)
- [ ] Glossary article accuracy sweep (recurring — verify all article descriptions against k-law live, 법제처 Open API)

## Governance Cadence

### Bi-Weekly Architecture Review (every other Friday)

| Agenda Item | Owner |
|-------------|-------|
| Domain maturity progress check | safety-governance-manager |
| Compliance findings review | compliance-agent |
| Cross-cutting promotion decisions | architect |
| Roadmap adjustment | PM/CSO |

### Release Cadence

- **Minor releases** (0.x.0): Bi-weekly, aligned with architecture review
- **Patch releases** (0.x.y): As needed for critical compliance fixes
- **First stable** (1.0.0): When all 12 newer domains reach Maturity Tier 2 + automated compliance checks green

## Decision Log

| Date | Decision | Reference |
|------|----------|-----------|
| 2026-08-06 | Adopt cross-cutting promotion pattern for shared evidence models | [ADR-001](adr/ADR-001-cross-cutting-evidence-promotion.md) |
| 2026-08-06 | First release cut (v0.1.0) — 51 days of development consolidated | CHANGELOG [0.1.0] |
| 2026-08-06 | TBM promoted from ehsconst-only to cross-industry (13 domains) | CHANGELOG 2026-08-06 |
| 2026-08-06 | Shift strategic direction from horizontal expansion to vertical maturation | This document |

## Backlog (Unprioritized)

- Automated glossary article verification script (validate descriptions against k-law live, 법제처 Open API)
- Domain-specific skill generation for the 12 newer domains (logistics, railway, waste, defense, biotech, battery, shipbuilding, steelmaking, datacenter, semicon, food, cosmetics)
- Evidence model DRY consolidation (reduce inline field duplication)
- Multi-language expansion beyond ko/en (ja, zh-CN per i18n locale structure)
- v3+ nuclear domain evaluation (currently explicitly excluded from powergen)

---

> This roadmap is a planning artifact, not a commitment. Priorities adjust based on regulatory changes, user feedback, and audit findings.
