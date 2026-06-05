# Antigravity Safe Auto-Mode Configuration

**Date**: 2026-06-05
**User Decision**: Auto-approve Agent Spawns + File Edits, but keep MCP Tools manual
**Rationale**: Balance automation with security

---

## User Requirements

**Auto-Approve**:
- ✅ Agent Spawns (Agent Manager 승인 우회)
- ✅ File Edits (diff review 우회)

**Manual Approve**:
- ❌ MCP Tools (보안 유지)

---

## Safe Configuration

### Recommended settings.json

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "npx",
      "args": [
        "@colbymchenry/codegraph@0.9.7",
        "serve"
      ]
    }
  },
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "git config core.hooksPath .githooks",
        "statusMessage": "Configuring git hooks..."
      }
    ]
  },
  "terminal.executionPolicy": "Auto",
  "artifact.reviewPolicy": "Auto-Accept",
  "mcp.toolApproval": "Manual",
  "terminal.denyList": [
    "rm -rf",
    "rm -r /",
    "chmod -R 777",
    "git push --force",
    "git reset --hard",
    "reboot",
    "shutdown",
    "format",
    "fdisk",
    "mkfs"
  ]
}
```

---

## Setting Explanations

### 1. `terminal.executionPolicy: "Auto"`

**Purpose**: Agent Spawn 및 명령어 실행 자동 승인

**Behavior**:
- Agent가 "안전하다고 판단"하는 명령어 자동 실행
- 위험한 명령어만 승인 요청

**Trade-off**:
- ✅ Agent Spawn 승인 프롬프트 제거
- ⚠️ Prompt injection 위험 (완화: denyList로 최소화)

### 2. `artifact.reviewPolicy: "Auto-Accept"`

**Purpose**: 파일 수정 자동 수락

**Behavior**:
- Agent가 파일을 수정할 때 diff 확인 없이 즉시 적용

**Trade-off**:
- ✅ 파일 수정 승인 프롬프트 제거
- ⚠️ 잘못된 수정 즉시 적용 위험 (완화: Git으로 롤백 가능)

### 3. `mcp.toolApproval: "Manual"` ✅ SAFEST

**Purpose**: MCP Tool 수동 승인 (사용자 요청)

**Behavior**:
- MCP server tool 호출 시마다 사용자 승인 필요

**Security Rationale**:
- MCP servers는 외부 써드 파티 코드
- Compromised MCP server가 data exfiltration 가능
- Security Guide에서 manual approval 권장

**Benefit**:
- ✅ 보안 유지
- ✅ 알 수 없는 MCP tool 실행 방지

### 4. `terminal.denyList`

**Purpose**: 절대 자동 실행하면 안 되는 위험 명령어

**Added Security**:
- `rm -rf` - 전체 삭제 방지
- `git push --force` - 원격 강제 푸시 방지
- `git reset --hard` - 하드 리셋 방지
- `format`, `fdisk`, `mkfs` - 디스크 포맷 방지

---

## Security Analysis

### Risks Mitigated ✅

**MCP Tool Compromise**:
- ❌ Auto-approval 제거
- ✅ 수동 승인으로 외부 MCP 실행 제어
- ✅ Data exfiltration 방지

### Remaining Risks ⚠️

**Prompt Injection (Terminal)**:
- Agent가 "안전한" 명령어로 속일 수 있음
- 완화: denyList로 최악의 명령어 차단

**File Edits (Auto-Accept)**:
- Agent가 실수로 파일 수정 가능
- 완화: Git으로 롤백 가능

### Risk Assessment

| 설정 | 위험도 | 완화 |
|------|-------|------|
| `terminal.executionPolicy: "Auto"` | Medium | denyList |
| `artifact.reviewPolicy: "Auto-Accept"` | Low | Git rollback |
| `mcp.toolApproval: "Manual"` | ✅ Safe | N/A |

**Total Risk**: **Acceptable** (MCP만 수동으로 유지)

---

## Template Propagation (L0→L1→L2)

### Implementation Plan

**Phase 1: L0 Configuration**
- 파일: `.gemini/settings.json`
- 작업: 위 설정 추가
- 검증: Antigravity 실행 테스트

**Phase 2: L1 Propagation**
- 스크립트: `dev-sync.ts`
- 자동: `.gemini/settings.json` → `templates/common/.gemini/settings.json`

**Phase 3: L2 Propagation**
- 스크립트: `create-l2-scaffold.ts`
- 자동: L1 설정 → `templates/co-{variant}/.gemini/settings.json`

---

## Documentation Requirements

### GEMINI.md Additions

```markdown
## Antigravity Auto-Mode Configuration

### Safe Auto-Mode Settings

Antigravity에서 자동 실행을 위해 다음 설정을 `.gemini/settings.json`에 추가:

```json
{
  "terminal.executionPolicy": "Auto",
  "artifact.reviewPolicy": "Auto-Accept",
  "mcp.toolApproval": "Manual",
  "terminal.denyList": [...]
}
```

**Security Notes**:
- ✅ Agent Spawn 및 파일 수정 자동 승인
- ✅ MCP Tools는 수동 승인 (보안)
- ⚠️ Terminal Auto 모드는 prompt injection 취약 가능성 있음
- ⚠️ Git을 사용한 주기적 커밋 권장 (롤백 대비)
```

---

## Testing Checklist

### Before Propagation

- [ ] L0 `.gemini/settings.json`에 설정 추가
- [ ] Antigravity 실행 테스트
- [ ] Agent spawn 자동 승인 확인
- [ ] 파일 수정 자동 수락 확인
- [ ] MCP tool 수동 승인 확인
- [ ] denyList 동작 확인 (위험 명령어 차단)

### After Propagation

- [ ] `templates/common/.gemini/settings.json`에 설정 전파 확인
- [ ] `dev-sync.ts` 실행 테스트
- [ ] 신규 L2 variant 생성 테스트 (`create-l2-scaffold.ts`)

---

## Alternative: Conservative Mode (더 안전)

**If even higher security needed**:

```json
{
  "terminal.executionPolicy": "Off",
  "artifact.reviewPolicy": "Request Review",
  "mcp.toolApproval": "Manual"
}
```

**Trade-off**:
- ✅ 최고 수준 보안
- ❌ 자동화 제한 (각 승인 필요)

---

## Recommendation

**즉시 구현**: Safe Auto-Mode (제안된 설정)

**이유**:
- 사용자 요구 충족 (Agent Spawn + 파일 수정 자동화)
- MCP 보안 유지
- 위험 관리 (denyList + Git rollback)
- L0/L1/L2 자동 전파 가능

**구현 시간**: 10분 (settings.json 수정 + 문서화)

**구현 순서**:
1. L0 `.gemini/settings.json` 수정
2. GEMINI.md 문서화
3. 테스트
4. L1/L2 자동 전파 (dev-sync.ts)
