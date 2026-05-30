# co-security Variant Phases

## Domain Workflow

The co-security variant follows a security engagement-centric workflow:

**Authorization → Reconnaissance → Exploitation → Remediation → Reporting**

## Phase Definitions

### Authorization Phase (Pre-Phase 0)
**Purpose**: Verify legal authorization
**Critical**: A signed authorization document is required (`docs/authorization.md`)
- verify-authorization skill confirms approval
- Phase 1+ cannot proceed without approval

### Phase 0: Team Assembly & Skill Orchestration
**Purpose**: Security engagement kick-off and team assembly
- Confirm engagement scope (`docs/scope.md`)
- Assign Security-monitor, Architect, Analyst
- Identify required skills (security-scan)

### Phase 1: Analysis & Triage (Reconnaissance)
**Purpose**: Target system reconnaissance
- Read-only reconnaissance
- Vulnerability scanning
- Threat modeling

### Phase 2: Design
**Purpose**: Establish and approve engagement plan
- Architect: Exploitation strategy + ADR
- Security-monitor: Attack path analysis
- **User approval gate**

### Phase 3: Implementation (Exploitation & Remediation)
**Purpose**: Demonstrate vulnerabilities and apply patches
- Security-monitor: Exploitation (authorized targets only)
- Automation-engineer: Ansible playbook execution
- Ansible dry-run first (--check flag)

### Phase 4: QA Gate
**Purpose**: Security validation
- Test-runner: Patch validation
- Auditor: Secret scan (.gitleaks), documentation check
- Max 2 iterations before PM escalation

### Phase 5: Finalization
**Purpose**: Final reporting
- Engagement log: memory/engagement-YYYY-MM-DD.md
- Finding tickets: docs/findings/FIND-NNNN.md
- Create PR and handoff

## Specialist Agents

| Phase | Agent | Responsibility |
|-------|-------|----------------|
| Reconnaissance | security-monitor | Vulnerability scanning, threat modeling |
| Design | architect | Exploitation strategy + ADR |
| Implementation | security-monitor | Exploitation (authorized) |
| Implementation | automation-engineer | Ansible playbook execution |
| QA | auditor | Secret scan, documentation check |

## Security-Specific Rules

1. **Authorization first**: No Phase 1+ work without signed authorization
2. **Scope enforcement**: Targets not in `docs/scope.md` are out-of-scope
3. **Secret hygiene**: Never commit credentials, API keys, passwords
4. **Ansible dry-run**: Always use --check flag before live apply
5. **Engagement log**: All actions logged to memory/engagement-YYYY-MM-DD.md
