# agents/

Agent definition files for the **co-export** trade consulting team. Each agent file follows the
3-Section structure:
1. **Legal Basis** — authority/regulatory grounding for the role
2. **Role** — responsibilities and scope
3. **Protocols** — PM-only invocation, dispatch protocol, output format/destination, constraints

## Available Agents

| Agent | File | Tier | Role |
|-------|------|------|------|
| Trade Engagement Leader (PM) | `pm.md` | High | Orchestration, gates, lifecycle finalization |
| HS Classification Specialist | `hs-classification-specialist.md` | High | HS code classification, customs valuation, tariff rate |
| FTA/Origin Analyst | `fta-origin-analyst.md` | High | FTA rules of origin, origin certification requirements |
| Export Control & Sanctions Screening Specialist | `export-control-compliance-specialist.md` | High | Strategic items export control, sanctions/denied-party screening |
| Foreign Regulatory Intelligence Analyst | `foreign-regulatory-intelligence-analyst.md` | Medium | US/China/EU import regulation & tariff-change monitoring |
| Market Entry Strategist | `market-entry-strategist.md` | Medium | Market research, entry channel strategy, buyer discovery |
| Trade Documentation Specialist | `trade-documentation-specialist.md` | Medium | L/C, invoice, packing list, B/L, customs clearance docs |
| Customs Duty Drawback Specialist | `customs-duty-drawback-specialist.md` | High | Duty drawback eligibility, refund-method selection, usage-rate calculation |
| Logistics Coordinator | `logistics-coordinator.md` | Low | Incoterms, freight/forwarding, bonded warehouse logistics |

See [`AGENTS.md`](../AGENTS.md) for the canonical roster, dispatch triggers, and
[`docs/co-export.context.md`](../docs/co-export.context.md) for phase mapping and the output
destination table.

## Creating New Agents

```bash
bun scripts/agent-create.ts <name> --role "Display Name" --group <group>
```

After creating: update `AGENTS.md` and `docs/co-export.context.md § Agent Roster & Phase Mapping`.

## Listing / Verifying Agents

```bash
bun scripts/agent-list.ts
bun scripts/agent-verify.ts
```
