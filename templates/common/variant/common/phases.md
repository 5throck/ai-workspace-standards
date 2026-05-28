# Workspace Root (Common) Core Phases

## Governance Workflow

Workspace root PM은 **cross-platform template maintenance**에 집중하며, 오직 다음 3개 core phase만 orchestrates:

## Core Phases (Workspace Root PM Only)

### Phase 0: Team Assembly
**Purpose**: 팀 구성 및 역할 정의
- Workspace standards 유지 관리
- Template scripts cross-platform 호환성 보장
- New project scaffolding

### Phase 2: Design
**Purpose**: 설계 승인 (user approval gate)
- Architect: Template structure design, folder hierarchies
- **User approval 필수** - 진행 전 확인

### Phase 6: Finalization
**Purpose**: PR 생성 및 memory logging
- memlog → sync pipeline 실행
- PR 생성 (Co-Authored-By line 포함)
- Completed work를 user에게 handoff

## Phases NOT Orchestrated by Workspace Root PM

- ~~Phase 1 (Triage)~~ → Autonomous analysis team (parallel, no PM)
- ~~Phase 4 (Implementation)~~ → Lead Agent autonomous dispatch
- ~~Phase 5 (QA)~~ → Consistency Auditor independent QA

## Agent Roster (Workspace Root)

| Phase | Group | Agent | Responsibility |
|-------|-------|--------|----------------|
| Triage | Analysis | auditor | Documentation cross-validation, consistency check |
| Design | Design | architect | Template structure design, architectural standards |
| Implementation | Execution | automation-engineer | Cross-platform scripting (.ps1, .sh), tool maintenance |
| Documentation | Execution | docs-writer | Markdown documentation standardization, translations |
| Security | Security | security-expert | Git hooks enforcement, .gitleaks configuration, credential management |
| Setup | Setup | scaffolding-expert | New project scaffolding, template synchronization, UTF-8 enforcement |

## Constraints

- **Mandatory 3-Tier Strategy**: PM이 execution/improvement tasks를 리드할 때 3-tier model strictly 사용
- **High-tier**: Complex reasoning, architectural design, planning, PM orchestration
- **Medium-tier**: Code review, testing, PR review, quality gates (Auditor / Security Expert)
- **Low-tier**: Fast, repetitive coding, script maintenance, strictly scoped execution (Automation Engineer)
- Dispatch independent tasks **in parallel** (single message, multiple Agent calls)
- Maximum **3 fix iterations** per review cycle before user escalation
- Never bypass audit hooks (`--no-verify` forbidden)
- All Git artifacts (commit messages, PR titles, branch names) must be in English
- Ensure all changes align with CONSTITUTION.md standards
