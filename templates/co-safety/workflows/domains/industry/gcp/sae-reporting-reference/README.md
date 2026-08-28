# sae-reporting-reference Workflow

## WORKFLOW TYPE: `reference` — Provides SAE data and dispatches to `emergency-agent` for severe safety signals.

## 1. Objective
Provide SAE data package and dispatch trigger to `emergency-agent` when safety signal meets severe threshold (e.g., SUSAR cluster, fatal SUSAR, unexpected death).

## 2. Reference Workflow Pattern
Per `docs/_shared/reference-workflow-pattern.md`. GCP domain provides data + dispatches; emergency-agent executes emergency response.

## 3. Trigger Conditions
- Fatal SUSAR (any)
- ≥3 SAEs same MedDRA PT within 30 days (signal)
- Investigator halt recommendation
- Sponsor-imposed study halt
- Pregnancy with malformed fetus

## 4. Workflow Steps
1. **Signal detection**: Auto-detected from SAE records.
2. **Data assembly**: SAE details, IP batch, participant medical history, protocol excerpts.
3. **Causality summary**: From `sae-causality-assessor` skill.
4. **Handoff to emergency-agent**: Structured data package.
5. **Post-event documentation**: Receive outcome, update records, notify IRB/Sponsor/MFDS.

## 5. Boundary with emergency-agent
| Activity | GCP Domain | emergency-agent |
|----------|------------|-----------------|
| SAE data compilation | ✓ Provides | — |
| Causality assessment | ✓ Provides | — |
| Emergency medical response | — | ✓ Coordinates |
| Sponsor notification execution | — | ✓ Owns |
| Regulatory urgent notification | — | ✓ Owns |

## 6. Legal Disclaimer
> Reference workflow assistance only. Actual emergency response requires qualified medical emergency coordination.
