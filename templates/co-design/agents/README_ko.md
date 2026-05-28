# 에이전트 디렉토리

이 디렉토리에는 co-design 워크플로우에서 사용되는 에이전트 정의 파일이 포함되어 있습니다.

## 사용 가능한 에이전트

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| 디자인 PM | `pm.md` | 디자인 워크플로우 총괄, 전문 에이전트 디스패치 |
| 디자인 리드 | `design-lead.md` | 디자인 시스템 권위자, 시각 일관성, 컴포넌트 표준 |
| 프로토타입 엔지니어 | `prototype-engineer.md` | 인터랙티브 프로토타입, 컴포넌트 구현 |
| 서비스 디자이너 | `service-designer.md` | 엔드-투-엔드 서비스 블루프린트, 여정 지도 |
| 스토리텔러 | `storyteller.md` | 디자인 내러티브, 발표 전략, 이해관계자 조율 |
| 타이포그래피 전문가 | `typography-expert.md` | 타입 시스템, 폰트 페어링, 가독성 기준 |
| UX 리서처 | `ux-researcher.md` | 사용자 리서치, 사용성 테스트, 인사이트 도출 |
| 비주얼 디자이너 | `visual-designer.md` | 비주얼 아이덴티티, 컬러 시스템, 레이아웃 구성 |

## 에이전트 생성

```bash
bun run agent:create <name> --role "표시 이름" --group <그룹>
```

에이전트 생성 후 `AGENTS.md`와 `docs/co-design.context.md § Agents`를 업데이트하세요.

전체 워크플로우는 `AGENTS.md`를 참고하세요.
