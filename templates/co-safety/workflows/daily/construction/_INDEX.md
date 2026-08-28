---
legal_basis:
  - OSHA-KR Articles 15, 17, 98-103
---

# Construction Daily Workflows

> Cross-reference index for daily construction safety workflows. Most items below are **implemented under domain-specific directories** rather than here — this index maps each daily operation to its canonical location. Items genuinely not yet implemented remain marked `Pending`.

| Workflow | Description | Risk | Status |
|----------|-------------|------|--------|
| TBM (Tool Box Meeting) | Daily safety briefing before work starts | General | ✅ Active — `workflows/domains/industry/ehsconst/tbm-tool-box-meeting/` (construction-dedicated); cross-industry TBM skill at `skills/daily/tool-box-meeting/` + 14 industry profiles via `tbm-pre-work-briefing` workflows |
| Heavy Equipment Operations | Safety checks for cranes, excavators, etc. | High | ⚠️ Partial — crane safety covered by `workflows/domains/industry/logistics/port-crane-agv-safety/`; general construction heavy-equipment workflow Pending |
| Fall Protection | Harness inspection, scaffolding checks | High | ✅ Active — `workflows/domains/industry/ehsconst/fall-prevention/` + `skills/domains/industry/ehsconst/fall-hazard-assessor/` |
| Electrical Safety | LOTO redirected to `workflows/domains/functional/psm/loto-lockout-tagout/` (cross-industry, covers construction); temporary wiring checks still pending | Medium | ⚠️ Partial — LOTO Active via PSM; temporary wiring checks Pending |
| Hot Work | Welding, cutting, grinding safety | Medium | ✅ Active — `workflows/domains/functional/psm/hot-work-permit/` |
| Confined Space Entry | Ventilation, gas monitoring, standby person | High | ✅ Active (cross-industry) — `shipbuilding/ship-tank-confined-space/`, `railway/rail-track-confined-maintenance/`, `waste/sewage-confined-h2s-prevent/`; construction-specific confined space Pending |
