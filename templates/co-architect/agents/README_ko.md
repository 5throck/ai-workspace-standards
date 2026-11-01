---
lang: ko
---

# 에이전트 디렉토리

이 디렉토리에는 **co-architect** 팀 워크플로우에서 사용되는 24개 전문 에이전트 정의 파일이 포함되어 있습니다.

## 사용 가능한 에이전트 (24개 에이전트, 6개 전문 팀)

### 🛠️ 오케스트레이션 (Orchestration)
| 에이전트 | 파일 | 역할 설명 |
|---------|------|----------|
| 협업 PM | `pm.md` | 크로스 팀 오케스트레이터 및 워크플로우 게이트웨이 |

### 🎨 디자인 팀 (Design Team — 리드: design-lead)
| 에이전트 | 파일 | 역할 설명 |
|---------|------|----------|
| 디자인 리드 | `design-lead.md` | 디자인 시스템 아키텍처 및 비주얼 방향성 총괄 |
| UX 리서처 | `ux-researcher.md` | 사용자 연구, 사용성 분석 및 인사이트 수집 |
| 비주얼 디자이너 | `visual-designer.md` | 비주얼 디자인, 디자인 토큰 및 컴포넌트 명세 |
| 프로토타입 엔지니어 | `prototype-engineer.md` | 인터랙티브 프로토타입 및 핸드오프 아티팩트 제작 |
| 서비스 디자이너 | `service-designer.md` | 엔드투엔드 서비스 경험 및 여정 맵 설계 |
| 타이포그래피 전문가 | `typography-expert.md` | 서체 선정, 타입 계층 구조 및 가독성 최적화 |
| 디자인 스토리텔러 | `design-storyteller.md` | 디자인 철학, 브랜드 내러티브 및 의미 통합 |
| 조감도/렌더링 전문가 | `visualization-expert.md` | 포토리얼리스틱 3D 조감도, 투시도, 야경 렌더링 |
| 인테리어 디자이너 | `interior-designer.md` | 실내 공간 계획, 가구 배치, 마감재 스케줄 |

### 📊 리서치 팀 (Research Team — 리드: analyst)
| 에이전트 | 파일 | 역할 설명 |
|---------|------|----------|
| 분석가 | `analyst.md` | 체계적 리서치, 데이터 종합, 근거 수집 |
| 스토리텔러 | `storyteller.md` | 조직 문화, 변화 관리 내러티브 작성 |
| 콘텐츠 라이터 | `content-writer.md` | 리서치 결과 기반 문서 및 커뮤니케이션 작성 |
| 건축 법규 전문가 | `bylaw-expert.md` | 건축법, 건폐율(BCR), 용적률(FAR), 일조권 검토 |

### 📅 프로젝트 팀 (Project Team — 리드: project-coordinator)
| 에이전트 | 파일 | 역할 설명 |
|---------|------|----------|
| 프로젝트 코디네이터 | `project-coordinator.md` | 일정 관리, 이해관계자 커뮤니케이션, RFP 관리 |
| 테크니컬 라이터 | `technical-writer.md` | 기술 문서, API 레퍼런스, 아키텍처 가이드 |
| MS365 전문가 | `ms365-expert.md` | Microsoft 365, SharePoint, Teams 연동 |

### 🏗️ 엔지니어링 팀 (Engineering Team — 리드: sketchup-modeler)
| 에이전트 | 파일 | 역할 설명 |
|---------|------|----------|
| 스케치업 모형가 | `sketchup-modeler.md` | 3D 스케치업 매스 및 공간 볼륨 모형 제작 |
| ZWCAD 제도사 | `zwcad-drafter.md` | ZWCAD 2D 기술 도면(평면도, 입면도, 단면도) 작성 |
| 건축 도면 전문가 | `drafting-architect.md` | 건축 제도 표준 lead, 상세 단면도, 도면 집합 감사 |
| 구조 엔지니어 | `structural-engineer.md` | 구조 타당성, 내력벽/비내력벽 분류, 기둥 그리드 |
| MEP 설비 엔지니어 | `mep-engineer.md` | 기계/전기/배관, 덕트 경로, 천장 RCP 간섭 검토 |

### ⚙️ 플랫폼 엔지니어링 팀 (Platform Engineering Team — 리드: architect)
| 에이전트 | 파일 | 역할 설명 |
|---------|------|----------|
| 아키텍트 | `architect.md` | CAD 자동화 백엔드 및 MCP 서버 설계 총괄 |
| 자동화 엔지니어 | `automation-engineer.md` | MCP 툴, COM 핸들러, Python 데이터 모델 구현 |

## 에이전트 생성

```bash
bun run agent:create <name> --role "표시 이름" --group <그룹>
```

에이전트 생성 후 `AGENTS.md`와 `docs/co-architect.context.md § Agents`를 업데이트하세요.

전체 6개 워크플로우와 상세 디스패치 규칙은 `AGENTS.md`를 참고하세요.
