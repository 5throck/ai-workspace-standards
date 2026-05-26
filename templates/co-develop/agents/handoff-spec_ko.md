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

### PM → 비즈니스 분석가

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "pm",
  "to_agent": "sd-analyst",
  "timestamp": "2025-01-15T10:30:00Z",
  "phase": "business-analysis",
  "status": "in_progress",
  "data": {
    "request": "사용자 요청 설명",
    "trigger_keywords": ["Sales Order", "Billing"],
    "context": {
      "user": "username",
      "priority": "high"
    },
    "expected_output": {
      "prd": true,
      "acceptance_criteria": true
    }
  }
}
```

### 비즈니스 분석가 → 아키텍트

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "sd-analyst",
  "to_agent": "architect",
  "timestamp": "2025-01-15T11:00:00Z",
  "phase": "technical-design",
  "status": "in_progress",
  "data": {
    "prd": {
      "title": "기능 제목",
      "requirements": ["요구사항 1", "요구사항 2"],
      "acceptance_criteria": [
        {
          "id": "AC-001",
          "description": "인수 기준 설명",
          "priority": "must-have"
        }
      ]
    },
    "business_context": {
      "module": "SD",
      "key_tables": ["VBAK", "VBAP"],
      "constraints": []
    }
  }
}
```

### 아키텍트 → 코드 작성자

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "architect",
  "to_agent": "code-writer",
  "timestamp": "2025-01-15T11:30:00Z",
  "phase": "implementation",
  "status": "in_progress",
  "data": {
    "implementation_plan": {
      "pattern": "A | B | C",
      "objects": [
        {
          "type": "PROG | CLASS | TABLE | CDS",
          "name": "object_name",
          "action": "create | modify | delete",
          "description": "오브젝트 설명"
        }
      ],
      "dependencies": []
    },
    "constraints": {
      "max_objects_per_iteration": 5,
      "require_syntax_check": true,
      "require_unit_test": true
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
  "phase": "verification",
  "status": "in_progress",
  "data": {
    "implemented_objects": [
      {
        "type": "PROG",
        "name": "ZPROG_SBOOK_QUERY",
        "url": "/sap/bc/adt/programs/programs/zprog_sbook_query"
      }
    ],
    "acceptance_criteria": [
      {
        "id": "AC-001",
        "description": "인수 기준 설명",
        "verification_method": "unit_test | manual | atc_check"
      }
    ],
    "test_instructions": {
      "unit_tests": ["test_class_1", "test_class_2"],
      "atc_priority": "P1 | P2 | P3"
    }
  }
}
```

### 테스트 실행자 → PM

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "test-runner",
  "to_agent": "pm",
  "timestamp": "2025-01-15T12:30:00Z",
  "phase": "finalization",
  "status": "completed",
  "data": {
    "test_results": {
      "unit_tests": {
        "total": 10,
        "passed": 10,
        "failed": 0
      },
      "atc_checks": {
        "priority_1": 0,
        "priority_2": 2,
        "priority_3": 5
      }
    },
    "acceptance_criteria_met": true,
    "blockers": [],
    "recommendations": [
      "병합 전 P2 문제 해결"
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
      "type": "syntax_error | compilation_error | runtime_error | dependency_error",
      "message": "오류 설명",
      "object": "object_name",
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
4. **상태 업데이트**: 각 핸드오프 시 `status` 필드를 업데이트하세요
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
