# 에이전트 디렉토리

이 디렉토리에는 co-abap SAP ABAP 하네스 엔지니어링 워크플로우에서 사용되는 에이전트 정의 파일이 포함되어 있습니다.

## 사용 가능한 에이전트

| 에이전트 | 파일 | 역할 | Tier |
|---------|------|------|------|
| Project Manager (PM) | `pm.md` | 워크플로 오케스트레이션, 디스패치, 품질 게이트, 라이프사이클 관리 | High |
| SD 애널리스트 | `sd-analyst.md` | 판매 및 배포 모듈 분석 — SD 트리거 키워드에 따라 활성화 | Medium |
| MM 애널리스트 | `mm-analyst.md` | 자재 관리 모듈 분석 — MM 트리거 키워드에 따라 활성화 | Medium |
| FI 애널리스트 | `fi-analyst.md` | 재무 회계 모듈 분석 — FI 트리거 키워드에 따라 활성화 | Medium |
| CO 애널리스트 | `co-analyst.md` | 관리 회계 모듈 분석 — CO 트리거 키워드에 따라 활성화 | Medium |
| PP 애널리스트 | `pp-analyst.md` | 생산 계획 모듈 분석 — PP 트리거 키워드에 따라 활성화 | Medium |
| LE 애널리스트 | `le-analyst.md` | 물류 실행 모듈 분석 — LE 트리거 키워드에 따라 활성화 | Medium |
| 아키텍트 | `architect.md` | 기술 실행 리드 — 패턴 선택, 실행 시퀀싱, DBA 조율 | High |
| 코드 작성자 | `code-writer.md` | WriteSource/EditSource를 통한 ABAP 구현, 구문 검사 | Low |
| 테스트 실행자 | `test-runner.md` | QA 검증 — 단위 테스트, 코드 커버리지, ATC 체크 | Low |
| DBA | `dba.md` | 테이블/CDS/인덱스 설계, SQL 성능 튜닝, ERD 정규화 | Medium |
| DevOps 관리자 | `devops-admin.md` | 전송 관리, 인프라 설치, 시스템 감사 | Low |
| SAP 조사자 | `sap-investigator.md` | 코드베이스 패턴 스캔, 기존 설계 추출 (읽기 전용) | Medium |
| 읽기 전용 애널리스트 | `read-only-analyst.md` | 비즈니스 데이터 쿼리, 초안 AC를 포함한 AS-IS 분석 (읽기 전용) | Medium |
| 스키마 검사자 | `schema-inspector.md` | 테이블/CDS 구조 검사, 의존성 맵 (읽기 전용) | Medium |
| 인터페이스 전문가 | `interface-expert.md` | OData/RFC/IDoc 인터페이스 설계 및 연결 검증 | Medium |
| Fiori 개발자 | `fiori-developer.md` | UI5/Fiori 화면 설계 및 구현 | Medium |
| 폼 전문가 | `form-expert.md` | SAP Script, Smart Forms, Adobe Forms 설계 및 인쇄 프로그램 | Medium |
| 보안 모니터 | `security-monitor.md` | 보안 정책 시행 및 안전한 의존성 감사 | Low |
| GUI 스크립터 | `gui-scripter.md` | BDC / VBS 자동화 — BAPI/OData/RFC 대안이 없는 경우 최후 수단 | Low |

## 에이전트 생성

```bash
bun run agent:create <name> --role "표시 이름" --group <그룹>
```

에이전트 생성 후 `AGENTS.md`와 `docs/co-abap.context.md`를 업데이트하세요.

전체 워크플로우는 `AGENTS.md`를 참고하세요.
