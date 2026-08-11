# 에이전트 디렉토리

이 디렉토리에는 co-consult 컨설팅 워크플로우에서 사용되는 에이전트 정의 파일이 포함되어 있습니다.

## 사용 가능한 에이전트

| 에이전트 | 파일 | 역할 | Tier |
|---------|------|------|------|
| Engagement Leader | `pm.md` | 인게이지먼트 오케스트레이션, 클라이언트 인터페이스, 최종 의사결정, QA | High |
| Change Management Partner | `change-management-partner.md` | 조직 변화 관리, 문화 전략, 이해관계자 정렬 | High |
| Strategy Analyst | `strategy-analyst.md` | 시장 분석, 경쟁 조사, 재무 모델링 | Medium |
| Industry Expert | `industry-expert.md` | 산업별 전문 지식, 경쟁 동향, 규제 환경 | High |
| Subject Matter Expert | `sme.md` | 기능별 전문가 (HR, Finance, Operations 등) | Medium |
| Communications Lead | `communications-lead.md` | 클라이언트 커뮤니케이션, 프레젠테이션, 전략 내러티브 | Medium |
| Solutions Architect | `solutions-architect.md` | 기술 솔루션 설계, 시스템 아키텍처, 구현 로드맵 | Medium |
| Workstream Lead | `workstream-lead.md` | 워크스트림 관리, 팀 조율, 진행 추적 | Medium |
| Delivery Manager | `delivery-manager.md` | 프로젝트 인도, 운영 조율, 일정 관리 | Low |
| Technology Specialist | `technology-specialist.md` | M365 플랫폼, 워크플로우 자동화, 디지털 전환 지원 | Low |
| Data Analyst | `data-analyst.md` | 통계 분석, 데이터 모델링, 시각화 | Low |

## 에이전트 생성

```bash
bun run agent:create <name> --role "표시 이름" --group <그룹>
```

에이전트 생성 후 `AGENTS.md`와 `docs/co-consult.context.md § Agents`를 업데이트하세요.

전체 워크플로우는 `AGENTS.md`를 참고하세요.
