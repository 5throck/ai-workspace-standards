---
lang: ko
lang_reason: source-material
---

# 에이전트 디렉토리 (agents/)

**co-export** 무역 컨설팅 팀의 에이전트 정의 파일입니다. 각 에이전트 파일은 3섹션 구조를 따릅니다:
1. **법적 근거 (Legal Basis)** — 역할의 권한/규제적 기반
2. **역할 (Role)** — 책임과 범위
3. **프로토콜 (Protocols)** — PM 전용 호출, 디스패치 프로토콜, 출력 형식/목적지, 제약 조건

## 에이전트 목록

| 에이전트 | 파일 | 티어 | 역할 |
|---------|------|------|------|
| 무역 실무 리더 (PM) | `pm.md` | High | 오케스트레이션, 게이트 관리, 라이프사이클 종료 |
| HS 분류 전문가 | `hs-classification-specialist.md` | High | HS 코드 분류, 세관 평가, 관세율 적용 |
| FTA/원산지 분석가 | `fta-origin-analyst.md` | High | FTA 원산지 규정, 원산지 증명서 요건 |
| 할랄 인증 전문가 | `halal-certification-specialist.md` | Medium | 할랄 인증 요건, 인증기관 인정 여부, 인증/갱신 일정 |
| 수출통제·제재 스크리닝 전문가 | `export-control-compliance-specialist.md` | High | 전략물자 수출통제, 제재/거래제한 당사자 스크리닝 |
| 해외 규제 인텔리전스 분석가 | `foreign-regulatory-intelligence-analyst.md` | Medium | 미국/중국/EU 수입 규제 및 관세 변동 모니터링 |
| 시장 진출 전략가 | `market-entry-strategist.md` | Medium | 시장 조사, 진출 채널 전략, 바이어 발굴 |
| 무역 서류 전문가 | `trade-documentation-specialist.md` | Medium | 신용장, 송장, 패킹리스트, B/L, 통관 서류 |
| 관세 환급 전문가 | `customs-duty-drawback-specialist.md` | High | 환급 자격 판정, 환급방법 선택, 사용률 산정 |
| 물류 코디네이터 | `logistics-coordinator.md` | Low | 인코텀즈, 화물/포워딩, 보세창고 물류 |

전체 로스터, 디스패치 트리거는 [`AGENTS.md`](../AGENTS.md)를,
페이즈 매핑 및 출력 목적지 테이블은 [`docs/co-export.context.md`](../docs/co-export.context.md)를 참조하세요.

## 새 에이전트 생성

```bash
bun scripts/agent-create.ts <name> --role "표시 이름" --group <group>
```

생성 후: `AGENTS.md` 및 `docs/co-export.context.md § Agent Roster & Phase Mapping`을 업데이트하세요.

## 에이전트 목록 조회 / 검증

```bash
bun scripts/agent-list.ts
bun scripts/agent-verify.ts
```

---

*co-export 프로젝트 템플릿 — 필요에 따라 사용자 정의하세요*
