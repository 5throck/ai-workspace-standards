# co-security 사용자 가이드

**Language**: [English](user-guide.md) · **한국어**

> 이 AI 에이전트 팀과 함께 보안 인게이지먼트를 진행하기 위한 실무 중심 가이드입니다.
> 팀 개요 및 미션은 [`../README_ko.md`](../README_ko.md)를, 에이전트 역할 정의는 [`../AGENTS.md`](../AGENTS.md)를 참고하세요.

---

## 1. 빠른 시작

모든 인게이지먼트는 **PM (Security PM)**을 통해 시작하고 마무리합니다 — 전문 에이전트를 직접 호출하지 마십시오.

1. **PM에게 요청하세요.** 필요한 작업을 설명합니다 ("결제 API에 대한 위협 모델이 필요합니다", "스테이징 환경에 대한 모의 해킹을 실행해주세요", "지난 인게이지먼트의 요약 보고서를 작성해주세요").
2. **PM이 승인 게이트를 확인합니다.** Phase 1 이상(정찰, 취약점 공격, 패치)의 모든 활동 전에 PM은 `verify-authorization` 스킬을 실행합니다. `docs/authorization.md` 또는 `docs/scope.md`가 없거나 불완전하면, PM이 작업을 차단하고 누락된 항목을 알려줍니다.
3. **PM은 전문 에이전트를 투입하기 전에 실행 계획 표를 표시합니다**:

   | # | 작업 | 에이전트 | 티어 | 모델 |
   |---|------|----------|------|------|
   | 1 | [작업 설명] | [전문가] | High/Medium/Low | [모델] |
   | N | `/sync "type(scope): message"` | pm | Medium | [모델] |

4. **사용자가 계획을 승인**(또는 수정을 요청)한 후에만 에이전트가 작업을 시작합니다.
5. **전문가들이 단계별 범위의 작업을 수행**합니다 (어떤 요청에 어떤 전문가가 배정되는지는 아래 §2 참고).
6. **`/sync "security: description"`**은 각 단계를 마무리합니다 — memlog → changelog → audit → commit → push → PR 순서로 실행됩니다. co-security는 최종 시점 한 번이 아니라 **5개의 단계 경계에서** 커밋을 수행합니다 (§3 참고).

---

## 2. 어떤 종류의 보안 작업이 필요하신가요?

아래 표를 참고하여 요청 내용에 따라 PM이 어떤 에이전트/스킬을 투입하는지 확인하세요.

| 시나리오 | 에이전트 | 스킬 / 트리거 키워드 | 단계 |
|----------|----------|----------------------|------|
| 테스트 시작 전 법적 승인 여부 확인 필요 | PM | `verify-authorization` (자동 실행 게이트) | 0 |
| "공격 표면을 매핑해주세요" / STRIDE 분석 / 데이터 흐름도 | Threat Modeler | "threat modeler", "research", "analyze", "investigate", "threat model" | 1-2 |
| "공격 방법론을 설계해주세요" / MITRE ATT&CK TTP 매핑 / 킬 체인 | Red Team Lead | "red team lead", "threat model", "stride", "attack surface", "red team" | 1-3 |
| "취약점을 찾아주세요" / PoC 구축 / 조치 재검증 | Pentester | "pentester", "security", "pentest", "vulnerability" | 3, 6 |
| "패치를 배포해주세요" / Ansible 플레이북 작성 / Linux·macOS·Windows 전반 CVE 패치 | Patch Engineer | "patch engineer", "patch", "remediate", "fix vulnerability" | 4, 6 |
| "보고서를 작성해주세요" / 요약 보고서 초안 / CVSS 점수 산정 | Report Writer | "report writer", "write", "document", "draft", "security" | 5, 6 |
| 교차 영역 의사 결정을 위한 구조화된 팀 논의 실행 | PM (진행) | `/meeting "topic"` | 전체 |

**기본 원칙**: 요청이 공격적 활동(정찰, 취약점 공격, 패치)을 포함하고 아직 승인 문서가 없다면, PM은 작업을 중단하고 먼저 인게이지먼트 범위 설정을 완료하도록 요청합니다 — 이는 선택 사항이 아닙니다.

---

## 3. 인게이지먼트 파이프라인 (Phase 0-6)

co-security는 고정된 순서의 파이프라인을 따릅니다. 각 단계마다 필수 산출물과 다음 단계로 넘어가기 전의 품질 게이트가 있습니다.

```
Phase 0  범위 설정                 → PM 전용
           산출물: 승인 체크리스트, docs/scope.md, Rules of Engagement
           게이트: Phase 1 진행 전 verify-authorization 스킬이 PASS를 반환해야 함

Phase 1-2  정찰 및 위협 모델링      → Red Team Lead + Threat Modeler (병렬)
           산출물: 정찰 결과, STRIDE 표, DFD, 공격 트리, MITRE 매핑

Phase 3  취약점 공격                → Red Team Lead → Pentester (순차)
           산출물: CVSS 점수가 포함된 FIND-NNNN.md 발견 티켓
           게이트: Phase 4 진행 전 Red Team Lead가 PoC를 검토해야 함

Phase 4  조치(Remediation)          → Patch Engineer
           산출물: Ansible 플레이북, PATCH_LOG.md 항목
           게이트: 모든 플레이북은 적용 전 `--check`(드라이런)를 실행해야 함

Phase 5  보고                        → Report Writer
           산출물: 모의 해킹 보고서, 요약 보고서

Phase 6  검증                        → Pentester (재검증 루프)
           산출물: 조치 효과를 확인하는 재검증 결과
```

**파이프라인 진행 중 사용되는 명령어:**

```bash
# Phase 0 — 승인된 대상에 대한 연결성 확인
bash scripts/inventory-check.sh

# Phase 4 — 항상 먼저 드라이런한 후 적용
bash scripts/patch-apply.sh --check
bash scripts/patch-apply.sh --group linux --check
bash scripts/patch-apply.sh --group linux
bash scripts/patch-apply.sh    # 전체 그룹
```

**다중 커밋 `/sync` 패턴**: 단일 커밋 워크플로와 달리, co-security는 발견-패치-보고서 간의 증거 사슬을 git 이력에 보존하기 위해 **5개의 단계 경계에서** `/sync`를 실행합니다:

1. Phase 0 완료 — 승인 및 범위 확정
2. Phase 1-2 완료 — 위협 모델 승인
3. Phase 3 완료 — 발견 사항 문서화 (**필수** — 증거 사슬을 위한 커밋)
4. Phase 4 완료 — 패치 적용
5. Phase 5 완료 — 최종 보고서 완성

권장 커밋 메시지: `"security: phase3 complete — N findings documented"`

---

## 4. 인게이지먼트 / 프로젝트 단계 구조

위의 단계 번호는 `AGENTS.md`와 `docs/co-security.context.md` 전반에서 참조되는 표준 구조입니다. 빠른 참고:

| 단계 | 이름 | 담당 에이전트 |
|------|------|----------------|
| 0 | 범위 설정 | PM |
| 1-2 | 정찰 및 위협 모델링 | Red Team Lead, Threat Modeler |
| 3 | 취약점 공격 | Red Team Lead, Pentester |
| 4 | 조치 | Patch Engineer |
| 5 | 보고 | Report Writer |
| 6 | 검증 | Pentester (재검증) |

모든 전문 에이전트는 PM을 통해서만 투입되며 — 직접 호출은 도구, 프롬프트, QA 게이트 수준에서 모두 거부됩니다 (`AGENTS.md` §3.1.3 참고).

---

## 5. 산출물 / 결과물 위치

| 경로 | 내용 |
|------|------|
| `docs/scope.md`, `docs/authorization.md` | 서명된 승인 및 범위 문서 (Phase 0 게이트 입력값) |
| `docs/threat-models/` | STRIDE 표, 공격 트리, DFD, MITRE ATT&CK 매핑 |
| `docs/findings/` | CVSS 점수가 포함된 발견 티켓(`FIND-NNNN.md`); 민감 항목은 `.gitignore` 고려 |
| `docs/reports/` | 모의 해킹 보고서 및 요약 보고서 |
| `PATCH_LOG.md` | 적용된 모든 패치의 감사 로그: 날짜, CVE, 그룹, 호스트, 결과 |
| `ansible/inventory.yml` | 승인된 대상 호스트 인벤토리 (Linux, macOS, Windows) |
| `ansible/patch-*.yml` | OS별 패치 플레이북 |
| `memory/` | 세션 로그, 인게이지먼트 로그(`engagement-YYYY-MM-DD.md`), 패치 실행 로그 |

---

## 6. 승인된 사용 범위에 관한 고지

**이 도구는 양날의 검(dual-use) 보안 툴킷입니다.** 이 에이전트 팀이 수행하는 모든 공격적 활동(정찰, 취약점 공격, PoC 개발) 및 패치/조치 작업은 인게이지먼트의 정확한 대상 호스트와 기간을 명시한 서명된 승인 문서에 의해 뒷받침되어야 합니다.

- `verify-authorization` 스킬이 **PASS**를 반환하기 전까지 Phase 1 이상의 어떤 활동도 시작할 수 없습니다.
- 에이전트는 `docs/scope.md` / `ansible/inventory.yml`에 명시되지 않은 대상에 대한 작업을 거부해야 하며, 임의로 진행하는 대신 PM에게 재승인을 요청해야 합니다.
- 소유하지 않았거나 명시적인 서면 승인을 받지 않은 시스템에는 이 팀의 기능을 절대 사용하지 마십시오.
- 모든 발견 사항, 자격 증명, 패치 로그는 민감 정보로 취급하십시오 — 비밀 정보를 커밋하지 마십시오; `.gitleaks` 사전 커밋 스캔이 강제됩니다.

인게이지먼트가 적절히 승인되었는지 확신할 수 없다면, 전문 에이전트 투입을 요청하기 전에 먼저 PM과 함께 이를 해결하십시오.
