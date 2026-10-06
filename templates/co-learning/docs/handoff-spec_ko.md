# 에이전트 핸드오프 명세서

이 문서는 멀티 에이전트 워크플로우에서 에이전트 간 JSON 기반 핸드오프 형식을 정의합니다.

## 핸드오프 형식

모든 에이전트 핸드오프는 명확한 통신과 추적 가능성을 보장하기 위해 구조화된 JSON 형식을 사용합니다.

### 기본 구조

```json
{
  "handoff_version": "1.0",
  "task_id": "unique-identifier",
  "from_agent": "agent-name",
  "to_agent": "agent-name",
  "timestamp": "ISO-8601-timestamp",
  "phase": "phase-name",
  "status": "in_progress | completed | blocked | failed",
  "data": {
    // 에이전트별 데이터
  }
}
```

### 표준 필드

| 필드 | 타입 | 필수 | 설명 |
|-------|------|------|------|
| `handoff_version` | string | 예 | 형식 버전 (기본값: "1.0") |
| `task_id` | string | 예 | 고유 작업 식별자 |
| `from_agent` | string | 예 | 보내는 에이전트 이름 |
| `to_agent` | string | 예 | 받는 에이전트 이름 |
| `timestamp` | string | 예 | ISO-8601 타임스탬프 |
| `phase` | string | 예 | 현재 워크플로우 단계 |
| `status` | string | 예 | 작업 상태 |
| `data` | object | 예 | 에이전트별 페이로드 |

## 에이전트별 핸드오프 형식

순차 핸드오프 체인은 `pm → architect → (designer, 선택) → code-writer → test-runner → security-monitor → pm` 입니다. 단계 이름은 `docs/phase-definitions.md`를 따릅니다.

### PM → 아키텍트

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "pm",
  "to_agent": "architect",
  "timestamp": "2025-01-15T10:30:00Z",
  "phase": "analysis",
  "status": "in_progress",
  "data": {
    "request": "사용자 요청 설명",
    "acceptance_criteria": [
      {
        "id": "AC-001",
        "description": "인수 기준 설명",
        "priority": "must-have"
      }
    ],
    "context": {
      "user": "username",
      "priority": "high"
    },
    "expected_output": {
      "implementation_plan": true,
      "adr": true
    }
  }
}
```

### 아키텍트 → 디자이너 (선택, 3단계만)

UI/UX 요소가 범위에 있을 때만 디스패치되며, 그렇지 않으면 생략됩니다.

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "architect",
  "to_agent": "designer",
  "timestamp": "2025-01-15T11:00:00Z",
  "phase": "ui-ux-design",
  "status": "in_progress",
  "data": {
    "implementation_plan": {
      "title": "기능 제목",
      "requirements": ["요구사항 1", "요구사항 2"],
      "design_scope": ["회원 가입 플로우", "대시보드 레이아웃"],
      "adr": "docs/adr/0001-feature-title.md"
    },
    "expected_output": {
      "design_specification": true,
      "wireframes": true,
      "design_tokens": true
    }
  }
}
```

### 디자이너 → 코드 작성자

디자이너가 생략된 경우(UI/UX 요소가 범위 밖) 아키텍트가 이 형식을 사용해 디자인 명세 대신 구현 계획을 담아 코드 작성자에게 직접 핸드오프합니다.

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "designer",
  "to_agent": "code-writer",
  "timestamp": "2025-01-15T11:30:00Z",
  "phase": "implementation",
  "status": "in_progress",
  "data": {
    "design_specification": "docs/specs/0001-feature-title-ui-spec.md",
    "implementation_plan_ref": "docs/specs/0001-feature-title-design.md",
    "constraints": {
      "surgical_changes_only": true,
      "no_scope_creep": true,
      "require_tests": true
    }
  }
}
```

### 코드 작성자 → 테스트 실행자

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "code-writer",
  "to_agent": "test-runner",
  "timestamp": "2025-01-15T12:00:00Z",
  "phase": "implementation",
  "status": "in_progress",
  "data": {
    "implemented_changes": [
      {
        "file": "src/routes/auth.py",
        "action": "create | modify | delete",
        "summary": "/register 및 /login 엔드포인트 추가"
      }
    ],
    "acceptance_criteria": [
      {
        "id": "AC-001",
        "description": "인수 기준 설명",
        "verification_method": "unit_test | integration_test | manual"
      }
    ],
    "test_instructions": {
      "test_command": "bun test",
      "colocated_tests": ["src/routes/auth.test.py"]
    }
  }
}
```

### 테스트 실행자 → 보안 모니터

QA 게이트가 통과했고 변경 사항이 인증, 시크릿 또는 인프라에 손대는 경우에 디스패치합니다(해당 변경에는 PR 전 권고 점검이 필수입니다 — `docs/co-learning.context.md § Domain Rules` 참고).

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "test-runner",
  "to_agent": "security-monitor",
  "timestamp": "2025-01-15T12:15:00Z",
  "phase": "security-review",
  "status": "in_progress",
  "data": {
    "qa_verdict": "READY_FOR_PR | BLOCKED",
    "test_results": {
      "total": 10,
      "passed": 10,
      "failed": 0
    },
    "acceptance_criteria_met": true,
    "change_summary": "시크릿 처리를 다루는 인증 엔드포인트 — 권고 점검 필요"
  }
}
```

### 보안 모니터 → PM

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "security-monitor",
  "to_agent": "pm",
  "timestamp": "2025-01-15T12:30:00Z",
  "phase": "finalization",
  "status": "completed",
  "data": {
    "security_report": {
      "critical": 0,
      "high": 0,
      "medium": 2,
      "low": 5
    },
    "advisory_verdict": "clear | findings_attached",
    "blockers": [],
    "recommendations": [
      "중간 심각도 발견 항목은 후속 작업으로 처리"
    ]
  }
}
```

## 오류 상태 핸드오프

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "code-writer",
  "to_agent": "pm",
  "timestamp": "2025-01-15T11:45:00Z",
  "phase": "implementation",
  "status": "blocked",
  "data": {
    "error": {
      "type": "test_failure | build_error | runtime_error | dependency_error",
      "message": "오류 설명",
      "file": "path/to/file.ext",
      "line_number": 123
    },
    "recovery_attempts": 1,
    "escalation_required": true
  }
}
```

## 핸드오프 규칙

1. **버전 관리**: 항상 `handoff_version`을 포함하세요
2. **작업 연속성**: 전체 워크플로우에서 동일한 `task_id`를 사용하세요
3. **타임스탬프**: 모든 타임스탬프에 ISO-8601 형식을 사용하세요
4. **상태 갱신**: 각 핸드오프 시 `status` 필드를 갱신하세요
5. **오류 처리**: 에스컬레이션이 필요한 문제의 경우 `status: blocked`를 사용하세요
6. **완료**: PM에 대한 최종 핸드오프는 `status: completed`여야 합니다

## 검증

핸드오프를 받을 때 에이전트는 다음을 수행해야 합니다:

1. 지원되는 `handoff_version`인지 확인
2. `task_id`가 예상된 워크플로우와 일치하는지 확인
3. 필수 필드가 있는지 검증
4. 추적 가능성을 위해 핸드오프 기록
5. 성공적인 수신 시 승인 반환

---

*핸드오프 명세서 v1.0 - 워크플로우 발전에 따라 변경될 수 있음*
