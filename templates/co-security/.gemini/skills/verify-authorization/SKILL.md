---
name: verify-authorization
description: Verify that a security engagement has proper written authorization before beginning any red team, pentest, or vulnerability assessment activity
version: "1.0.0"
status: active
scope: co-security
triggers:
  - "verify authorization"
  - "check authorization"
  - "engagement authorization"
---

## Skill: verify-authorization

This skill confirms that the current engagement has documented written authorization before any offensive security work begins.

### Authorization Checklist

Before proceeding with any red team, pentest, or threat modeling work, PM must confirm:

1. **Written authorization exists** — signed engagement letter, bug bounty scope, or equivalent
2. **Scope is defined** — target systems, IP ranges, and exclusions are documented
3. **Time window is specified** — engagement start and end dates are agreed upon
4. **Emergency contacts are established** — client POC and escalation path are known
5. **Rules of engagement are signed** — no data exfiltration, no DoS, no out-of-scope targets

### Usage

Dispatch this skill at the start of every co-security engagement. PM invokes:

```
/verify-authorization
```

If any checklist item is unmet, halt the engagement and escalate to the client.

### Related Agents

- `red-team-lead` — requires authorization before phase 1
- `pentester` — requires scope confirmation before testing
- `threat-modeler` — requires authorization for sensitive system access
