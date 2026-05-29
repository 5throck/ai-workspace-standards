# co-security Variant Phases

## Domain Workflow

co-security variant는 보안 엔게이지먼트 중심의 workflow를 따릅니다:

**Authorization → Reconnaissance → Exploitation → Remediation → Reporting**

## Phase Definitions

### Authorization Phase (Pre-Phase 0)
**Purpose**: 법적 권한 확인
**Critical**: 서명된 authorization document 필수 (`docs/authorization.md`)
- verify-authorization skill이 승인 확인
- 승인 없으면 Phase 1+ 진행 불가

### Phase 0: Team Assembly & Skill Orchestration
**Purpose**: 보안 엔게이지먼트 kick-off 및 팀 구성
- Engagement scope 확인 (`docs/scope.md`)
- Security-monitor, Architect, Analyst 할당
- 필요한 스킬 확인 (security-scan)

### Phase 1: Analysis & Triage (Reconnaissance)
**Purpose**: 대상 시스템 정찰
- Read-only reconnaissance
- Vulnerability scanning
- Threat modeling

### Phase 2: Design
**Purpose**: 엔게이지먼트 계획 수립 및 승인
- Architect: Exploitation strategy + ADR
- Security-monitor: Attack path analysis
- **User approval gate**

### Phase 3: Implementation (Exploitation & Remediation)
**Purpose**: 취약점 입증 및 패치
- Security-monitor: Exploitation (authorized targets only)
- Automation-engineer: Ansible playbook execution
- Ansible dry-run first (--check flag)

### Phase 4: QA Gate
**Purpose**: 보안 검증
- Test-runner: Patch validation
- Auditor: Secret scan (.gitleaks), documentation check
- Max 2 iterations before PM escalation

### Phase 5: Finalization
**Purpose**: 최종 보고
- Engagement log: memory/engagement-YYYY-MM-DD.md
- Finding tickets: docs/findings/FIND-NNNN.md
- PR 생성 및 handoff

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
