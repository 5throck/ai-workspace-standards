# Agent Governance Record — customs-duty-drawback-specialist

## Overview

- **Agent Name**: customs-duty-drawback-specialist
- **Role**: Post-export duty refund eligibility, individual/simplified fixed-rate refund method
  selection, usage-rate calculation support (Duty Drawback Act basis)
- **Phase**: beta

## Phase History

- **2026-08-08**: Added to fill a gap identified in the team's coverage of customs duty drawback,
  a legal domain distinct from HS classification (Customs Act Art. 84/30) and from ordinary
  erroneous-payment refunds (Customs Act Art. 46).

## Acceptance Criteria

- [x] Defined in `agents/customs-duty-drawback-specialist.md`
- [x] Follows 3-Section structure (Legal Basis / Role / Protocols)
- [x] Registered in `AGENTS.md` (roster, dispatch triggers, domain skills) and
  `docs/co-export.context.md` (roster/phase mapping, dispatch chain, output destination)
- [x] Paired skill `skills/customs-duty-drawback-workflow/SKILL.md` created and mirrored to
  `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`
- [x] Validated by `scripts/agent-verify.ts` and `scripts/validate-agents.ts`
