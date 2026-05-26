# Meeting Transcript
**Date**: 2026-05-26
**Topic**: Pacman 게임 개발 — 기술 스택, 아키텍처, UX 방향, 테스트·보안 전략
**Participants**: Architect, Designer, Code-Writer, Test-Runner, Security-Monitor
**Rounds**: 2 + Synthesis
**Status**: Complete

---

## Transcript

### Round 1

**Architect** (Round 1): Canvas 직접 구현 제안. Entity-Component 없이 GameState/Maze/Pacman/Ghost 4개 도메인 클래스 + GameLoop 단방향 흐름. src/entities/, src/engine/, src/ui/ 3레이어. Ghost AI는 전략 패턴으로 캡슐화, MVP는 Blinky만. Designer에게 메뉴 UI Canvas vs DOM 분리 여부 질문.

**Designer** (Round 1): DOM 레이어 분리 확정 — 접근성(스크린리더, aria-live) 필수. 고스트 색각이상 문제 제기 — 형태/실루엣으로 구분 제안. Code-Writer에게 Canvas-DOM 동기화 복잡도 확인 요청.

**Code-Writer** (Round 1): Canvas-DOM 동기화는 단일 GameState 객체 구독으로 해결 가능. IGhostStrategy 인터페이스는 MVP에서도 선제 정의 필요 강조. 충돌 감지 방식(픽셀 vs 타일) 결정을 Architect에게 요청.

**Test-Runner** (Round 1): IGhostStrategy 선행 정의에 동의. GameLoop에 시간 주입(tick(deltaTime)) 필요. 미로 외부 데이터 분리 제안(테스트용 소형 미로 주입 가능). 수락 기준 측정 가능 형태 요청. Security-Monitor에게 스코어보드 관련 위협 표면 질문.

**Security-Monitor** (Round 1): 스코어보드 추가 시 공격 표면 변화 경고. GameState.score setter 없는 구조 요청. 의존성 최소화(프레임워크 없음) 보안 관점에서 최선. localStorage 역직렬화 XSS 위험 경고. 프로젝트 생성 직후 post-scaffold npm audit 요청.

### Round 2

**Architect** (Round 2): 타일 그리드 충돌 확정(28×31, getTile()). GameState.score private + addScore() 화이트리스트 설계 확정. 미로 JSON 분리(classic.json + test-small.json) 반영. 고스트 실루엣 SVG Path 활용 제안.

**Designer** (Round 2): 고스트 4종 실루엣 스펙 제시(Blinky 뿔형, Pinky 곡선, Inky 비대칭, Clyde 납작). 취약 상태 flash 애니메이션 타이밍 측정 기준 제안. Phase 1에 3·2·1 카운트다운 포함 요청.

**Code-Writer** (Round 2): 상태 머신(countdown→playing→dying→gameover) 도입. 카운트다운 Phase 1 수용. 입력 버퍼(InputBuffer) 설계 필요성 제기. GameLoop.tick(deltaTime) 주입 구조 약속.

**Test-Runner** (Round 2): AC-01~AC-09 수락 기준 초안 제시. 입력 버퍼 테스트 케이스 추가. GameLoop.tick 설계 환영.

**Security-Monitor** (Round 2): addScore() 화이트리스트 Medium 리스크 완화로 평가. localStorage XSS 방지 로직 src/storage/highScore.ts 격리 + AC-10 요청. Vite+Vitest CVE 없음 확인. Phase 2 서버 연동 전 Security-Monitor 리뷰 필수 강조.

---

## Action Items

| # | 담당 | 내용 | Phase |
|---|------|------|-------|
| A-01 | Architect | IGhostStrategy 인터페이스 + GameState 타입 정의 문서 | Phase 1 설계 |
| A-02 | Designer | 고스트 4종 실루엣 SVG Path 스펙 + flash 타이밍 스펙 | Phase 1 설계 |
| A-03 | Code-Writer | src/data/mazes/ 포함 파일 구조 초안 | Phase 1 구현 |
| A-04 | Security-Monitor | npm audit baseline → security/ 기록 | 착수 직후 |
| A-05 | Test-Runner | AC-01~AC-10 테스트 스켈레톤(tests/pacman.spec.ts) | Phase 1 병행 |

## Acceptance Criteria (AC)

| # | 기준 | 검증 방법 |
|---|------|-----------|
| AC-01 | 도트 획득 시 score +10 | GameState 단위 테스트 |
| AC-02 | 고스트 충돌 시 생명력 -1, dying 상태 전환 | 상태 머신 단위 테스트 |
| AC-03 | 파워펠릿 획득 후 고스트 frightened 전환 | Ghost 상태 단위 테스트 |
| AC-04 | 입력 버퍼 — 유효 지점에서 지연 입력 반영 | InputBuffer 단위 테스트 |
| AC-05 | 카운트다운 중 Pacman 이동 없음 | 상태 머신 통합 테스트 |
| AC-06 | 점수가 [data-score] DOM 속성에 실시간 반영 | DOM 통합 테스트 |
| AC-07 | 게임오버 시 role=dialog 포커스 획득 | 접근성 통합 테스트 |
| AC-08 | 취약 상태 종료 3초 전 flashing 클래스 토글 | DOM 통합 테스트 |
| AC-09 | addScore(999) 호출 시 에러 또는 무시 | GameState 단위 테스트 |
| AC-10 | localStorage 악성 값 시 숫자 기본값 폴백 | highScore.ts 단위 테스트 |

---
*Meeting closed: 2026-05-26*
