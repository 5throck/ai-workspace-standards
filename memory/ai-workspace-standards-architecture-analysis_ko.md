# AI Workspace Standards 아키텍처 분석 보고서

**문서 분류**: 전문 아키텍처 분석 보고서  
**분석 대상**: https://github.com/5throck/ai-workspace-standards  
**작성 기준일**: 2026-06-14  
**작성자**: Senior Architecture Analyst  
**문서 버전**: v1.0

---

## 목차

1. [Executive Summary](#executive-summary)
2. [저장소 개요 및 설계 목적](#저장소-개요-및-설계-목적)
3. [핵심 설계 철학 및 원칙](#핵심-설계-철학-및-원칙)
4. [계층적 아키텍처 구조 분석](#계층적-아키텍처-구조-분석)
5. [멀티 에이전트 시스템 아키텍처](#멀티-에이전트-시스템-아키텍처)
6. [생애주기(Lifecycle) 관점 아키텍처](#생애주기lifecycle-관점-아키텍처)
7. [거버넌스 및 품질 통제 메커니즘](#거버넌스-및-품질-통제-메커니즘)
8. [보안 아키텍처](#보안-아키텍처)
9. [플랫폼 상호운용성 및 교차 플랫폼 전략](#플랫폼-상호운용성-및-교차-플랫폼-전략)
10. [운영 워크플로우 분석](#운영-워크플로우-분석)
11. [템플릿 시스템 및 프로젝트 스캐폴딩](#템플릿-시스템-및-프로젝트-스캐폴딩)
12. [메모리 및 지식 관리 시스템](#메모리-및-지식-관리-시스템)
13. [실무 활용 가이드 및 적용 시나리오](#실무-활용-가이드-및-적용-시나리오)
14. [아키텍처 강점 및 한계 분석](#아키텍처-강점-및-한계-분석)
15. [결론 및 전략적 시사점](#결론-및-전략적-시사점)

---

## Executive Summary

`ai-workspace-standards`는 AI 보조 소프트웨어 개발 환경에서 **일관된 행동 계약(Behavioral Contract)**을 모든 AI 도구에 강제 적용하기 위해 설계된 마스터 워크스페이스 표준 저장소다. Claude Code, Gemini CLI 등 복수의 AI 코딩 도구를 대상으로 단일 워크스페이스 루트 기반의 계층적 거버넌스 구조를 구현하며, "Vibe Coding"과 "Harness Engineering"이라는 두 가지 상호보완적 개발 철학을 통합한다.

아키텍처 관점에서 이 시스템의 핵심 혁신은 세 가지다. 첫째, **L0 → L1 → L2 3계층 SSOT(Single Source of Truth) 아키텍처**로 구성 정보의 단일 권위 원천을 보장하며, 둘째, **PM Gateway 패턴**을 통해 멀티 에이전트 시스템에서 통제된 dispatch 흐름을 강제한다. 셋째, 에이전트·스킬·스크립트 각각에 대한 **독립적인 생애주기 관리 체계**를 갖추어 구성 요소의 신뢰성과 감사 가능성을 확보한다.

이 저장소는 단순한 설정 파일 모음이 아니라, AI 네이티브 개발 환경을 위한 **운영 체계(Operating System)** 수준의 아키텍처를 표방한다. 212개의 커밋 이력이 보여주듯 지속적으로 진화하며, AGPL-3.0 라이선스 하에 공개 기여가 가능하다.

---

## 저장소 개요 및 설계 목적

### 2.1 설계 배경

현대 AI 보조 개발에서 개발자는 다수의 AI 도구(Claude Code, Gemini CLI, Antigravity 등)를 동시에 활용한다. 그러나 각 도구가 독립적인 설정 체계를 갖고 있어 다음과 같은 문제가 발생한다.

- **행동 불일치**: 동일 작업에 대해 도구별로 다른 결과를 생성하는 비결정성
- **표준 부재**: 코딩 컨벤션, PR 워크플로우, 보안 정책의 도구 간 불일치
- **감사 불가능성**: AI가 수행한 변경사항에 대한 추적과 책임 소재 불명확
- **스케일 문제**: 프로젝트가 늘어날수록 개별 설정 관리의 복잡성 폭발적 증가

`ai-workspace-standards`는 이 문제에 대해 "워크스페이스 루트를 공유 거버넌스 계층으로 만든다"는 근본적 접근으로 해답을 제시한다.

### 2.2 저장소 위치 전략

이 저장소는 통상적인 프로젝트 저장소와 다른 방식으로 배치된다.

```
# Windows
C:\git\  ← 이 저장소를 워크스페이스 루트로 클론

# macOS/Linux
~/git/  ← 이 저장소를 워크스페이스 루트로 클론
```

워크스페이스 루트에 위치함으로써, 그 하위에 생성되는 모든 프로젝트 디렉토리가 상위 수준의 `CONSTITUTION.md`, `CLAUDE.md`, `GEMINI.md`를 자동으로 상속받게 된다. 이는 **인프라스트럭처 as 폴더 계층(Infrastructure as Folder Hierarchy)** 패턴의 구현이다.

### 2.3 핵심 파일 역할 매핑

| 파일/디렉토리 | 대상 | 역할 |
|---|---|---|
| `CONSTITUTION.md` | 모든 AI 도구 | 마스터 표준 — 모든 세션에서 최우선 로딩 |
| `CLAUDE.md` | Claude Code | Claude 전용 행동 규칙 및 플랫폼 특화 설정 |
| `GEMINI.md` | Gemini CLI / Antigravity | Gemini 계열 도구 전용 행동 규칙 |
| `AGENTS.md` | 멀티 에이전트 시스템 | 에이전트 생태계 SSOT — 역할 정의 및 dispatch 규칙 |
| `docs/constitution/` | 참조 문서 | 각 섹션의 전체 상세 명세 |
| `agents/` | 에이전트 정의 | 역할별 에이전트 마크다운 파일 |
| `templates/` | 프로젝트 스캐폴딩 | 버전 관리 프로젝트 템플릿 (co-develop, co-design, co-work) |
| `scripts/` | 자동화 | 감사, 동기화, 프로젝트 생성 스크립트 |
| `memory/` | 세션 기록 | 워크스페이스 수준 메모리 로그 |
| `.claude/` & `.gemini/` | 플랫폼 설정 | AI 도구 전역 설정 및 커스텀 슬래시 커맨드 |
| `.githooks/` | Git 자동화 | PR 정책 및 규칙 강제 적용 훅 |

---

## 핵심 설계 철학 및 원칙

### 3.1 두 개의 보완적 개발 철학

#### Vibe Coding: 자율 실행 모드

Vibe Coding은 AI가 주도권을 갖는 개발 방식이다. 개발자는 의도(Intent)를 기술하고, AI 에이전트 팀(PM → Architect → Designer → Code Writer → Test Runner)이 전체 워크플로우를 자율적으로 실행한다. 이 방식에서 본 표준의 역할은 자율 실행을 **안전하고 감사 가능하게** 유지하는 가드레일을 제공하는 것이다.

적합한 상황:
- 명확한 요구사항이 정의된 그린필드 프로젝트
- 반복적이고 정형화된 스캐폴딩 작업
- 대규모 문서 생성 및 코드 보일러플레이트

#### Harness Engineering: 정밀 제어 모드

Harness Engineering은 개발자가 루프 안에 머무는 방식이다. AI 도구는 정밀 도구로 기능하며, 외과적 편집(Surgical Edit), 명시적 계획(Explicit Plan), 필수 검토 게이트(Mandatory Review Gate)를 통해 예측 가능하고 검토 가능한 출력을 보장한다.

적합한 상황:
- 레거시 코드베이스 수정
- 보안에 민감한 시스템 변경
- 복잡한 리팩토링 작업

### 3.2 7대 설계 원칙

**원칙 1: SSOT (Single Source of Truth)**  
`docs/context.md`는 모든 프로젝트의 단일 권위 원천이다. 모든 AI 도구는 이 파일을 공유한다. 정보의 중복은 `<!-- intentional-duplicate -->` 어노테이션으로만 허용되며, 그 경우에도 원천 동기화 의무가 명시된다.

**원칙 2: PR-Only 워크플로우**  
`main` 브랜치에 대한 직접 Push는 `.githooks/pre-push` 훅에 의해 차단된다. 모든 변경은 Pull Request를 통해서만 병합된다. 이는 AI가 생성한 코드도 인간의 검토를 거치도록 강제하는 핵심 안전장치다.

**원칙 3: Conventional Commits**  
`feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` / `perf:` / `ci:` / `style:` / `revert:` 접두사를 통한 커밋 메시지 표준화로 변경 이력의 자동 분류와 CHANGELOG 자동 생성을 가능하게 한다.

**원칙 4: 교차 플랫폼 스크립트 패리티**  
모든 `.sh` 스크립트는 `.ps1`(Windows PowerShell) 쌍을 가진다. 단, ADR-0036에 의해 운영 스크립트는 TypeScript(Bun)로 단일화하고 `.sh`/`.ps1` 이중 관리를 폐지했다.

**원칙 5: 코딩 가이드라인 감사 강제**  
`audit.ts`는 `docs/context.md`에 `## Coding Guidelines` 섹션이 없으면 빌드를 실패시킨다. 코딩 표준은 선언이 아닌 실행 시점 검증으로 강제된다. (`audit.sh`는 ADR-0036에 의해 폐기됨)

**원칙 6: Security-First 스캐폴딩**  
모든 신규 프로젝트는 자동으로 `.gitleaks.toml`(크리덴셜 탐지), `SECURITY.md`(취약점 보고 정책), 보안 pre-commit 훅을 갖추고 시작한다.

**원칙 7: 계층적 설정 상속**  
워크스페이스 루트의 설정이 가장 높은 우선순위를 가지며, 프로젝트별 파일은 플랫폼 특화 오버라이드만 포함한다. 이는 중앙집중적 거버넌스와 프로젝트 유연성의 균형을 이룬다.

---

## 계층적 아키텍처 구조 분석

### 4.1 레이어 구조 (Layer Architecture)

이 시스템은 CONSTITUTION.md에서 명시적으로 정의한 3-레이어 + L0 소스 구조를 갖는다.

```
┌─────────────────────────────────────────────────────────┐
│  L0: Workspace Root (ai-workspace-standards)             │
│  ─ scripts/, agents/ 의 원본 소스                         │
│  ─ CONSTITUTION.md, CLAUDE.md, GEMINI.md                 │
│  ─ 핵심 거버넌스 도구의 정의 계층                            │
└───────────────────────┬─────────────────────────────────┘
                        │ 배포 (dev-sync)
┌───────────────────────▼─────────────────────────────────┐
│  L1: templates/common/                                   │
│  ─ 공통 인프라 계층                                        │
│  ─ 모든 변형 템플릿이 공유하는 에이전트·스킬·스크립트           │
│  ─ common-contract.json 으로 계약 명세                    │
└───────────────────────┬─────────────────────────────────┘
                        │ 배포 (variant overlay)
┌───────────────────────▼─────────────────────────────────┐
│  L2: templates/co-*/                                     │
│  ─ 변형 특화 계층                                          │
│  ─ co-develop / co-design / co-work / co-security        │
│  ─ variant.json 으로 오버라이드 선언                        │
└───────────────────────┬─────────────────────────────────┘
                        │ 스캐폴딩 (new-project)
┌───────────────────────▼─────────────────────────────────┐
│  L3: Projects/*/                                         │
│  ─ 실제 프로젝트 계층                                       │
│  ─ 독립 Git 저장소                                         │
│  ─ 프로젝트별 docs/context.md                             │
└─────────────────────────────────────────────────────────┘
```

### 4.2 레이어별 책임과 경계

**L0 (워크스페이스 루트)**는 전체 시스템의 헌법(Constitution)을 정의한다. 이 계층의 파일을 수정하면 그 영향이 L1 → L2 → L3 전체로 전파된다. `dev-sync.ts` 스크립트가 L0 → L1 동기화를 자동 수행하며, L1 → L2 동기화는 명시적 요청 시에만 수행된다.

**L1 (templates/common)**은 공통 계약을 정의한다. `common-contract.json`에 나열된 파일은 모든 변형 프로젝트에 반드시 존재하도록 보장된다. L1의 주요 에이전트는 `pm.md`, `automation-engineer.md` 등 모든 변형에서 동일하게 동작하는 것들이다.

**L2 (templates/co-*)**는 변형별 특화 로직을 담는다. `variant.json`의 `agent_overrides`와 `skill_overrides`로 L1 파일에 대한 Additive(추가) 또는 Replacement(대체) 오버라이드를 선언한다. Anti-Swelling Rule이 적용된다: 50% 이상의 변형이 동일 파일에 오버라이드를 선언하면, 해당 내용을 L1 공통 정의로 승격해야 한다.

**L3 (Projects)**는 실제 개발이 이루어지는 계층이다. 스캐폴딩 시점(L2 → L3)에 내용이 복사되며, 이후 독립적으로 발전한다. 업그레이드는 `upgrade-project.ts`를 통해 LOCKED / MERGE / PRESERVE 티어에 따라 선택적으로 적용된다.

### 4.3 파일 업그레이드 티어 시스템

| 티어 | 동작 | 예시 파일 |
|---|---|---|
| **LOCKED** | 항상 덮어씀; 덮어쓰기 전 diff 표시 | `.githooks/*`, `.gitattributes`, `.gitleaks.toml` |
| **MERGE** | `WORKSPACE-MANAGED` 섹션만 교체; 나머지 보존 | `CLAUDE.md`, `GEMINI.md`, `CONSTITUTION.md`, `agents/*.md` |
| **PRESERVE** | 절대 수정 안 함; 업그레이드 보고서에만 나열 | `README.md`, `src/`, `docs/context.md` |

이 티어 시스템은 템플릿 업그레이드 시 사용자 커스터마이징 손실 없이 거버넌스 규칙만 선택적으로 업데이트할 수 있게 한다.

### 4.4 디렉토리 구조 상세

```
ai-workspace-standards/
├── CONSTITUTION.md          # 마스터 표준 — 모든 세션 최우선 로딩
├── CLAUDE.md                # Claude Code 워크스페이스 행동 규칙
├── GEMINI.md                # Gemini CLI/Antigravity 워크스페이스 행동 규칙
├── AGENTS.md                # 에이전트 생태계 SSOT (v2.0.0, 2026-06-09)
├── SECURITY.md              # GitHub 표준 취약점 보고 정책
├── CHANGELOG.md             # 워크스페이스 수준 변경 이력
├── CONSTITUTION.md          # 전체 워크스페이스 헌법
├── memory/                  # 워크스페이스 수준 세션 메모리 로그
├── scripts/                 # 핵심 자동화 및 감사 스크립트
│   ├── audit.ts             # 구조 감사 (PostToolUse 훅으로 자동 실행)
│   ├── dev-sync.ts          # L0→L1 동기화
│   ├── new-project.ts       # 프로젝트 스캐폴딩
│   ├── validate-templates.ts # 템플릿 검증
│   └── generate-version-manifest.ts  # VERSION_MANIFEST 생성
├── agents/                  # 에이전트 역할 정의 파일
│   ├── pm.md                # PM 오케스트레이터 (L0 기반)
│   ├── architect.md         # 템플릿 아키텍트
│   ├── automation-engineer.md # 자동화 엔지니어
│   ├── docs-writer.md       # 문서 작성자
│   ├── auditor.md           # 일관성 감사자
│   ├── lifecycle-manager.md # 라이프사이클 매니저 (L0 전용)
│   ├── security-expert.md   # 보안 전문가
│   └── scaffolding-expert.md # 스캐폴딩 전문가
├── docs/
│   ├── constitution/        # CONSTITUTION.md 각 섹션 상세 명세
│   │   ├── 00-ssot-architecture.md
│   │   ├── 05-multi-agent-architecture.md
│   │   ├── 05.6-agent-lifecycle.md
│   │   ├── 06-skill-lifecycle.md
│   │   └── ...
│   ├── adr/                 # Architecture Decision Records
│   │   ├── 0012-version-manifest-schema.md
│   │   ├── 0031-l1-l2-fork-model.md
│   │   └── 0039-l0-l1-l2-hierarchy-and-extends.md
│   └── VERSION_MANIFEST.md  # 버전 현황 SSOT (자동 생성)
├── skills/                  # 재사용 가능한 워크플로우 스킬
├── templates/               # 버전 관리 프로젝트 템플릿
│   ├── common/              # L1: 공통 공유 컴포넌트
│   ├── co-develop/          # L2: 소프트웨어 개발 변형
│   ├── co-design/           # L2: UI/UX 디자인 변형
│   └── co-work/             # L2: 일반 협업 변형
├── .claude/                 # Claude Code 전역 설정 및 커맨드
│   ├── settings.json        # 훅 설정 (SessionStart, PostToolUse 등)
│   └── commands/            # 슬래시 커맨드 정의
│       ├── sync.md          # /sync
│       ├── memlog.md        # /memlog
│       └── new-project.md   # /new-project
├── .gemini/                 # Gemini CLI 전역 설정 및 커맨드
├── .githooks/               # Git 훅 (pre-commit, pre-push)
├── .gitleaks.toml           # 시크릿 탐지 규칙
└── package.json             # Bun 스크립트 진입점
```

---

## 멀티 에이전트 시스템 아키텍처

### 5.1 PM Gateway 패턴

PM Gateway는 이 시스템에서 가장 핵심적인 아키텍처 패턴이다. 모든 전문 에이전트에 대한 dispatch는 반드시 PM(Project Manager) 에이전트를 통해야 한다. 이는 마이크로서비스 아키텍처의 API Gateway 패턴과 유사하게, 중앙화된 제어와 가시성을 확보한다.

```
사용자 요청
    │
    ▼
PM 에이전트 (단일 진입점)
    │
    ├── Level 1: 단일 단계 · 단일 파일 작업 → PM이 직접 실행
    │
    ├── Level 2: 다중 단계 (2+파일) 또는 다중 에이전트 작업
    │   → 실행 계획 테이블 표시 → 전문 에이전트 dispatch
    │
    ├── Level 3: 사용자가 전문 에이전트를 직접 호출 시도
    │   → PM이 거부 후 PM을 통한 재호출 요청
    │
    └── Level 4: 긴급 수정 (프로덕션 장애)
        → PM이 직접 실행 후 사후 기록
```

**PM의 직접 실행 제약**:  
PM은 오케스트레이터이지 실행자가 아니다. PM은 `memory/*.md`와 `CHANGELOG.md`에만 직접 Write를 수행할 수 있다. 다른 모든 파일 수정은 전문 에이전트에게 위임해야 한다. 이 분리는 거버넌스 관심사 분리(Separation of Concerns)의 구현이다.

### 5.2 에이전트 생태계 구성

#### 오케스트레이션 & 감사 그룹

| 에이전트 | 티어 | 역할 | 활성 레이어 |
|---|---|---|---|
| PM (Project Manager) | High | 팀 어셈블리, 설계 검증, 생애주기 완료 | L0, L1, L2 (변형별 상속) |
| Consistency Auditor | Medium | 교차 도메인 일관성 감사 | L0 전용 |
| Lifecycle Manager | Medium | 라이프사이클 상태 모니터링 및 거버넌스 기록 | L0 전용 |

#### 설계 그룹

| 에이전트 | 티어 | 역할 |
|---|---|---|
| Template Architect | High | 전체 프로젝트 구조 설계, ADR 작성 |

#### 실행 그룹

| 에이전트 | 티어 | 역할 |
|---|---|---|
| Automation Engineer | Low | TypeScript 자동화 스크립트 구현 |
| Documentation Writer | Medium | 문서 표준화 및 업데이트 |
| Scaffolding Expert | Low | 신규 프로젝트 템플릿 인스턴스화 |

#### 보안 그룹

| 에이전트 | 티어 | 역할 |
|---|---|---|
| Security & Git Expert | Medium | Git 훅 강제, .gitleaks 관리, 크리덴셜 관리 |

### 5.3 3-티어 비용 최적화 모델

AI 모델 비용을 최적화하기 위해 3-티어 모델 배정 전략을 사용한다.

| 티어 | Claude 모델 | Gemini 모델 | 역할 | 예시 에이전트 |
|---|---|---|---|---|
| **High** | claude-opus-4-7 | gemini-3.1-pro | 복잡한 추론, 아키텍처 설계, PM 오케스트레이션 | PM, Architect |
| **Medium** | claude-sonnet-4-6 | gemini-3.5-flash | 코드 리뷰, 테스팅, 품질 게이트 | Auditor, Security Expert, Docs-writer |
| **Low** | claude-haiku-4-5 | gemini-3.5-flash | 빠른 코딩, 보일러플레이트, 범위 제한 작업 | Automation Engineer, Scaffolding Expert |

**티어 천장 규칙(Tier Ceiling Rule)**: 에이전트의 티어는 정의된 티어를 초과해서 높일 수 없다. `automation-engineer`는 항상 Low 티어이며, High로 배정하는 것은 거버넌스 위반이다. 반면 단순 작업에 대해서는 PM이 재량으로 티어를 낮출 수 있으며, 낮춘 작업이 실패하면 기본 티어로 복원해야 한다.

### 5.4 L0→L1→L2 PM 에이전트 상속 아키텍처

PM 에이전트는 3계층 상속 아키텍처를 사용한다.

```
L0: agents/pm.md
├── 기본 골격 구조만 제공
├── 전체 내용 중복 없음
└── 공통 거버넌스 규칙 정의

L1: templates/common/agents/pm.md
├── L0의 순수 extends 선언
├── 공통 템플릿 기반 정의
└── VARIANT-INJECT 마커 포함

L2: templates/co-*/agents/pm.md
├── YAML frontmatter 및 추가 섹션만 포함
├── 변형 특화 에이전트 로스터 및 거버넌스 워크플로우
├── L0 에이전트 이름 포함 불가 (AC-01)
└── 목표 크기: ~50-100 라인 (L0의 384라인 대비)
```

**Layout Reconstruction 아키텍처**: L2 생성 시점에 "레이아웃 재구성" 프로세스가 실행된다. 6개 컴포넌트(에이전트 타입 추출, 그룹→타입 매핑, 에이전트 로스터 테이블 생성, 페이즈 결정 테이블 생성, L0 전용 콘텐츠 제거, 필수 dispatch 목록 생성)가 순서대로 실행되어 변형 특화 PM 에이전트를 구성한다.

### 5.5 에이전트 dispatch 흐름 상세

```
사용자 요청 수신
      │
      ▼
PM: 요청 분류 (읽기 전용 vs 쓰기)
      │
  읽기 전용 ──────────── 쓰기
      │                    │
      ▼                    ▼
 병렬 dispatch         직렬 dispatch
 (단일 메시지로         (에이전트 완료 후
  복수 에이전트)         다음 dispatch)
      │                    │
      ▼                    ▼
 Phase 2: 설계 검증 → 사용자 승인 게이트
                           │
                     Phase 4: 실행
                           │
                     Phase 5: 생애주기 완료
                     (lifecycle-manager, N-1 단계)
                           │
                     Phase 6: 품질 감사
                     (auditor, N 단계)
                           │
                     /sync → PR 생성
```

### 5.6 Permission Denial Protocol

전문 에이전트의 필요 도구가 사용자에 의해 거부되면, PM은 대체 실행을 하지 않는다. 대신:

1. 거부 타입 분류 (A/B/C/D — `agents/pm.md`의 분류 체계 참조)
2. 에스컬레이션 템플릿 출력
3. `memory/YYYY-MM-DD.md`에 거부 사실 기록
4. 차단된 작업 중단 — 필요 도구 없이 진행 불가

이 프로토콜은 AI가 권한 없이 민감한 작업을 대신 처리하는 것을 방지하는 안전장치다.

---

## 생애주기(Lifecycle) 관점 아키텍처

생애주기 관리는 이 시스템의 가장 정교한 부분으로, 에이전트·스킬·스크립트·템플릿 각각에 대해 독립적이면서도 연동된 생애주기 체계를 구현한다.

### 6.1 에이전트 생애주기

에이전트는 세 가지 상태를 갖는다.

```
draft ──→ active ──→ deprecated ──→ retired
                          │              │
                      (30일 내             (90일 후
                       스킬 재배정)         삭제 및
                                          아카이브)
```

**active**: 프로덕션 사용 중인 에이전트. 버전 관리 대상.

**deprecated**: 단계적 폐기 중. 30일 내 해당 에이전트의 스킬을 다른 에이전트에 재배정해야 한다. `agents/pm.md`가 모든 에이전트의 지정 소유자(Owner)다.

**retired**: `agents/_archive/`로 이동. 90일 후 삭제. 에이전트 프롬프트에 취약점이 발견되면 즉시 `deprecated` 상태로 전환 후 PR 오픈.

**관리 도구**: `agent-create.ts`, `agent-delete.ts`, `agent-verify.ts`

에이전트 변경 후 필수 업데이트 대상:
- `AGENTS.md` (정식 로스터)
- `CONSTITUTION.md §5` (아키텍처 참조)

### 6.2 스킬 생애주기

스킬은 `skills/<name>/SKILL.md` 또는 `.claude/skills/<name>/SKILL.md`로 정의되는 재사용 가능한 워크플로우다.

**4가지 상태**: `draft` → `active` → `deprecated` (30일 후 아카이브) → `archived` (90일 후 삭제)

**버전 범프 규칙**:
- **Patch** (1.0.x): 표현 수정, 예시 추가 등 동작 불변 변경
- **Minor** (1.x.0): 새로운 단계 추가, 동작 확장
- **Major** (x.0.0): 전면 재작성, 하위 호환 불가 변경

**공유 스킬**: `owner: [agent1, agent2]` 형태로 복수 소유자 지정 가능. 수정 시 모든 소유자 승인 필요.

**스킬 우선순위 해소 규칙**:

| 우선순위 | 소스 | 위치 |
|---|---|---|
| 1 (최고) | 로컬 프로젝트 스킬 | `skills/<name>/SKILL.md` (현재 작업 디렉토리) |
| 2 | 플랫폼 설정 스킬 | `.gemini/skills/` 또는 `.claude/skills/` |
| 3 (최저) | 전역 플러그인 스킬 | `superpowers/brainstorming` 등 |

동일 트리거에 대해 상위 우선순위 스킬이 있으면 하위 스킬로 폴스루하지 않는다.

### 6.3 스크립트 생애주기

**배포 경로**:

```
L0: workspace root/scripts/ (원본 소스)
    ↓ dev-sync 자동 동기화
L1: templates/common/scripts/
    ↓ 변형 특화
L2: templates/co-*/scripts/
    ↓ 스캐폴딩 시 복사
L3: Projects/*/scripts/
```

**3가지 상태**:
- **active**: 버전 변경 시 필수 버전 범프
- **deprecated**: 최소 90일 사전 공지 + `removal-date` 필드 포함
- **experimental**: 전파 불가 (L0에서만 사용)

**의존성 추적**: `SCRIPTS.md`의 `depends_on:` 속성으로 스크립트 간 의존성 선언. `verify-scripts.ts`가 순환 의존성 및 누락 의존성을 검사. PM은 Phase 2에서 의존성을 확인하고 영향받는 모든 스크립트를 실행 계획에 포함해야 한다.

### 6.4 VERSION_MANIFEST 시스템

`docs/VERSION_MANIFEST.md`는 워크스페이스 전체 라이프사이클 아티팩트 버전의 SSOT다. `/sync` 파이프라인 실행 시만 재생성되며, 다음 섹션을 포함한다.

**자동 생성 섹션** (`generate-version-manifest.ts` 실행):
- 에이전트 목록 (티어, 모델, 최종 수정 타임스탬프)
- 스킬 목록 (버전, 플랫폼 범위, 트리거 구문, 소유자)
- 스크립트 목록 (버전, 의존성)
- 커맨드 목록 (플랫폼 패리티, 스킬 통합)
- 플랫폼 패리티 상태 (Claude ↔ Gemini 동기화 상태)
- 드리프트 탐지 (라이프사이클 동기화 드리프트, 플랫폼 패리티 위반, 문서 버전 드리프트)

**수동 어노테이션 섹션** (인간이 관리, 재생성 시 유지):
- 릴리즈 노트
- 마이그레이션 가이드
- 폐기 경고
- 알려진 이슈

**다른 시스템과의 관계**:

| 시스템 | 목적 | VERSION_MANIFEST 역할 |
|---|---|---|
| CHANGELOG.md | 사용자 대면 릴리즈 이력 | 모든 버전의 현재 상태 스냅샷 제공 |
| memory/YYYY-MM-DD.md | 개발자 대면 세션 로그 | 릴리즈 노트 섹션에서 히스토리 컨텍스트 제공 |
| AGENTS.md | 정식 에이전트 로스터 | 스킬 버전 추적 위임 참조 |
| SCRIPTS.md | 스크립트 레지스트리 | 집계된 버전 표시 |

### 6.5 템플릿 생애주기 (Phase A-B-C 모델)

신규 프로젝트는 3단계 생애주기를 통과한다.

**Phase A: Scaffold** — `/new-project` 커맨드가 선택한 L2 템플릿에서 프로젝트를 생성. `[Project Name]` 플레이스홀더 치환, `_examples/` 제거, Git 초기화.

**Phase B: Refinement** — `docs/context.md`의 10개 섹션 작성, 에이전트 팀 구성, PM Kick-off 미팅 실행.

**Phase C: Promotion** — 프로덕션 준비 완료. 독립 Git 저장소로 발전.

### 6.6 운영 주기별 유지보수

| 주기 | 담당 | 작업 내용 |
|---|---|---|
| **주간 (매 금요일)** | PM | 라이프사이클 감사 실행 (`agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts`), 폐기 항목 검토 |
| **월간 (첫 금요일)** | PM + Architect | 30일 이상 폐기 항목 검토, 아카이브 정리 (30일 → 아카이브, 90일 → 삭제), 템플릿 동기화 계획 |
| **분기 (분기 시작)** | Architect + PM | 템플릿 검증, L0 변경사항 변형 전파, `templates/VERSION` 업데이트 |
| **온디맨드** | PM | `bun scripts/sync-agent-status.ts` / `sync-skill-status.ts` 실행 |

**운영 지표 (목표)**:
- 에이전트/스킬 건강도: 100%
- 폐기 백로그: 5개 미만
- 아카이브 연령: 90일 미만
- 템플릿 동기화 지연: 7일 미만

---

## 거버넌스 및 품질 통제 메커니즘

### 7.1 Session Start Checklist (필수 실행 순서)

모든 AI 세션은 아래 순서대로 컨텍스트를 로딩해야 한다.

```
0. git config core.hooksPath .githooks  (Git 훅 강제 활성화)
1. CONSTITUTION.md 읽기 (워크스페이스 표준)
2. docs/context.md 읽기 (프로젝트 컨텍스트)
3. AGENTS.md 읽기 (에이전트 로스터)
4. memory/MEMORY.md 읽기 (최근 세션 이력)
5. docs/context.md ## Session Start Skills 의 스킬 로딩
```

이 체크리스트의 핵심은 **0번 단계**다. `git config core.hooksPath .githooks`를 매 세션마다 실행함으로써, AI가 시작 시점에 반드시 Git 훅이 활성화되도록 강제한다. 이 명령이 실행되지 않으면 pre-commit, pre-push 훅이 동작하지 않아 품질 게이트가 우회될 수 있다.

### 7.2 Git 훅 기반 품질 게이트

**pre-commit 훅**: 커밋 시점에 다음을 검사한다.
- `docs/context.md`에 `## Coding Guidelines` 섹션 존재 여부
- 한국어 콘텐츠가 `ko/`, `locales/ko/` 외부에 있는지 여부
- `CHANGELOG.md` 변경사항 스테이징 여부 (`/sync` 파이프라인 통한 커밋 시)

**pre-push 훅**: Push 시점에 `main` 브랜치에 대한 직접 Push를 차단한다.

**PostToolUse 훅** (Claude Code CLI): AI가 파일을 Write/Edit할 때마다 비동기로 `bun scripts/audit.ts`를 실행한다. 실시간 품질 피드백을 제공하는 핵심 메커니즘이다.

**TeammateIdle 훅** (Claude Code CLI): Agent Teams에서 팀메이트가 유휴 상태가 되면 `post-write-lifecycle-check.ts`를 실행해 라이프사이클 상태를 검증한다.

**TaskCompleted 훅** (Claude Code CLI): 작업이 완료로 표시될 때 `audit.ts`를 실행해 최종 QA 게이트를 통과한다.

### 7.3 /sync 파이프라인

`/sync "feat: description"` 커맨드는 완전한 커밋-PR 파이프라인을 실행한다.

```
memlog 작성
    ↓
MEMORY.md 업데이트
    ↓
CHANGELOG 업데이트
    ↓
audit.ts 실행
    ↓
브랜치 생성 (pr/YYYYMMDD-HHmmss-slug)
    ↓
커밋 (Conventional Commits 형식)
    ↓
Push
    ↓
PR 생성
```

**SYNC_ACTIVE 보호**: `$env:SYNC_ACTIVE=1; git commit` 등의 환경변수 조작으로 `/sync`를 우회하는 것은 금지된다. `--no-verify` 플래그도 금지된다. 모든 커밋은 반드시 `/sync` 파이프라인 또는 `dev-sync.ts`를 통해야 한다.

### 7.4 Mandatory Execution Plan (필수 실행 계획)

Level 2 이상 작업에서 PM은 전문 에이전트 dispatch 전에 반드시 실행 계획 테이블을 출력해야 한다.

```
| #   | 작업                              | 에이전트              | 티어            | 모델              |
| --- | --------------------------------- | --------------------- | --------------- | ----------------- |
| 1   | [작업 설명]                        | [에이전트명]          | High/Medium/Low | [모델명]          |
| N-1 | Lifecycle Update (버전, 타임스탬프) | lifecycle-manager     | Medium          | claude-sonnet-4-6 |
| N   | Final QA Audit (audit.ts)         | auditor               | Medium          | claude-sonnet-4-6 |
```

**규칙**: Agent 도구는 이 테이블이 사용자에게 보일 때까지 호출되지 않는다. 마지막 두 단계(Lifecycle Update, Final QA Audit)는 항상 포함되어야 한다.

### 7.5 감사 시스템 (Audit System)

`audit.ts`는 다음 항목을 검사한다.

- `docs/context.md`에 `## Coding Guidelines` 섹션 존재
- `WORKSPACE-MANAGED` 마커의 올바른 배치
- 에이전트 frontmatter 완전성 (name, tier, model, color, description, examples 필드)
- 스크립트 패리티 어노테이션 일관성 (`# [parity:<tag>]`)
- 공통 계약 파일의 존재 (`common-contract.json` 기준)

### 7.6 Anti-Swelling Rule (팽창 방지 규칙)

변형 템플릿이 동일 파일에 대한 오버라이드를 과도하게 축적하는 것을 방지하기 위해, 50% 이상의 변형이 동일 에이전트/스킬에 오버라이드를 선언하면 `validate-templates.ts`가 실패하며, 해당 정의를 L1 공통 계층으로 승격할 것을 요구한다.

---

## 보안 아키텍처

### 8.1 Security-First 스캐폴딩

모든 신규 프로젝트는 다음 보안 컴포넌트를 자동으로 포함한다.

- `.gitleaks.toml`: Gitleaks 기반 크리덴셜 탐지 규칙 (API 키, 토큰, 비밀번호 패턴)
- `SECURITY.md`: 취약점 보고 표준 정책 (GitHub 표준 준수)
- 보안 pre-commit 훅: 커밋 전 크리덴셜 노출 방지

### 8.2 시크릿 관리 원칙

코딩 가이드라인에 명시된 시크릿 관리 규칙:

- 크리덴셜 하드코딩 절대 금지
- `.env.sample`을 템플릿으로 제공하고 실제 값은 환경변수로 주입
- `agent-prompt`에 API 키 등 민감 정보 포함 금지
- Gitleaks가 탐지하지 못한 패턴은 `.gitleaks.toml`에 커스텀 규칙 추가

### 8.3 보안 에이전트 역할

Security & Git Expert 에이전트는 Phase 6(QA & Finalization)에서 dispatch된다.
- Git 훅 설정 검증
- `.gitleaks.toml` 설정 관리
- 크리덴셜 관리 절차 준수 감사
- 의존성 보안 감사 (OSI-approved 라이선스 선호: MIT, Apache-2.0, BSD)

### 8.4 보안 취약점 발견 시 절차

에이전트 프롬프트에서 취약점이 발견된 경우:
1. 즉시 해당 에이전트를 `status: deprecated`로 전환
2. PR 오픈 (패치 적용)
3. `security-expert` 에이전트 dispatch
4. `memory/YYYY-MM-DD.md`에 보안 사건 기록

---

## 플랫폼 상호운용성 및 교차 플랫폼 전략

### 9.1 Platform Documentation Parity

`CLAUDE.md`와 `GEMINI.md`는 동등한 섹션 커버리지를 유지해야 한다. `CLAUDE.md`에 보안 설정이 있으면 동등한 항목이 `GEMINI.md`에도 존재해야 한다. `validate-templates.ts`가 이를 검증한다.

### 9.2 Platform Profile

프로젝트 생성 시 세 가지 플랫폼 프로파일 중 하나를 선택한다.

| 프로파일 | 포함 파일 | 설명 |
|---|---|---|
| `claude` | CLAUDE.md만 포함 | Claude Code 전용 환경 |
| `antigravity` | GEMINI.md만 포함 | Gemini CLI/Antigravity 전용 환경 |
| `both` | 두 파일 모두 포함 | 기본값 (모든 신규 프로젝트) |

### 9.3 슬래시 커맨드 패리티

`.claude/commands/`의 모든 커맨드 파일은 `.gemini/commands/`에 대응하는 파일을 가져야 한다. 의도적인 Claude 전용 예외는 frontmatter의 `gemini-parity: skip` 필드로 선언한다.

### 9.4 스크립트 패리티 어노테이션

TypeScript 스크립트에 `# [parity:<tag>]` 형태의 어노테이션을 추가해 동일 책임을 공유하는 스크립트 간 패리티를 선언한다. `validate-templates.ts`가 선언된 패리티 태그의 일관성을 검사한다.

### 9.5 Agent Teams (실험적)

Claude Code CLI에서만 지원되는 실험적 기능으로, 복수의 Claude Code 인스턴스가 공유 태스크 목록과 직접 에이전트 간 메시지를 통해 병렬로 작업한다.

| 설정 | 값 | 설명 |
|---|---|---|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `"1"` | 기능 활성화 (v2.1.32 이상 필요) |
| `teammateMode` | `"auto"` | tmux 내부면 split-pane, 아니면 in-process |

Desktop App에서는 in-process 모드만 지원되며 훅이 동작하지 않는다.

---

## 운영 워크플로우 분석

### 10.1 새 프로젝트 생성 워크플로우

```bash
# 1. 워크스페이스 루트에서 실행
bash scripts/new-project.sh "my-project-name" --variant co-develop --version 0.5.0

# 또는 Claude Code에서:
/new-project "my-project-name"

# 2. 프로젝트 디렉토리로 이동
cd my-project-name

# 3. 새 AI 세션 시작 (필수 — 새 세션이어야 프로젝트 설정 로딩)
claude
```

**생성되는 파일**:
- `docs/context.md` (10개 섹션 작성 필요)
- `AGENTS.md` (준비 완료)
- `agents/pm.md` + 변형별 에이전트 파일들
- `CLAUDE.md` / `GEMINI.md` (플랫폼 특화 설정 추가 필요)
- `scripts/` (audit, dev-sync, sync-md)
- `.githooks/`, `CHANGELOG.md`, `README.md`, `.env.sample`, `.gitignore`, `memory/MEMORY.md`

### 10.2 PM Kick-off 미팅 실행

프로젝트 컨텍스트와 함께 PM에게 킥오프를 요청한다.

```
> "TypeScript로 Tetris 게임을 만들어줘. 전문 에이전트 팀(게임 디자인용 game-design, 
충돌 감지용 game-logic, 렌더링용 graphics, 테스팅용 qa)을 구성하고 킥오프 미팅을 
시작해서 구현 계획을 만들어줘."
```

PM이 분석할 내용: 프로젝트 요구사항 → 에이전트 팀 구성 → 킥오프 어젠다 → 승인 요청 계획

### 10.3 일상적인 개발 사이클

```
1. 세션 시작 → Session Start Checklist 자동 실행
2. 작업 수행 → PostToolUse 훅이 변경마다 audit.ts 실행
3. 작업 완료 → /memlog "summary" 로 세션 로그 작성
4. PR 준비 → /sync "feat: feature description" 실행
   (memlog → MEMORY.md → CHANGELOG → audit → branch → commit → push → PR)
5. PR 검토 → 최소 1명 승인 후 merge
```

### 10.4 템플릿 수정 작업 경계 정책

워크스페이스 루트 파일과 템플릿 파일을 동일 작업 또는 세션에서 수정하는 것이 금지된다. 이 두 변경은 완전히 격리된 세션에서 독립적으로 수행되어야 한다. CWD를 특정 템플릿 폴더로 제한해서 작업한다.

---

## 템플릿 시스템 및 프로젝트 스캐폴딩

### 11.1 템플릿 변형 (Variant)

| 변형 | 상태 | 에이전트 팀 | 워크플로우 |
|---|---|---|---|
| `co-develop` | ✅ Stable | PM, Architect, Designer, Code Writer, Test Runner, Security Monitor | 소프트웨어 개발 6단계 선형 거버넌스 파이프라인 |
| `co-design` | ✅ Stable | PM, Design Lead, UX Researcher, Visual Designer, Prototype Engineer, Storyteller, Service Designer, Typography Expert | UI/UX 디자인 5단계 반복적 워크플로우 |
| `co-work` | ✅ Stable | PM, Analyst, Technical Writer, Content Writer, Project Coordinator, Storyteller, MS365 Expert | 일반 협업 6단계 비동기 워크플로우 |
| `co-security` | 🔵 Beta | (보안 특화 팀) | 보안 감사 워크플로우 |

### 11.2 템플릿 버전 관리

템플릿은 Git 태그로 버전을 관리한다 (`template-vX.Y.Z`). 생성된 프로젝트의 `.claude/template-version.txt`에 버전과 변형이 기록된다.

```
# .claude/template-version.txt 예시
version=0.5.0
variant=co-develop
platform=both
```

### 11.3 common-contract.json

L1 계층의 계약 명세 파일이다. 이 파일에 나열된 파일은 모든 변형 프로젝트에 반드시 존재해야 한다. `validate-templates.ts`가 이를 검증한다.

### 11.4 variant.json 오버라이드 메커니즘

```json
// templates/co-design/variant.json 예시
{
  "agent_overrides": [
    {
      "file": "agents/pm.md",
      "type": "additive",
      "reason": "co-design 특화 PM 의식 추가",
      "since": "2026-05-30"
    }
  ],
  "skill_overrides": [
    {
      "file": "skills/meeting-facilitation/SKILL.md",
      "type": "replacement",
      "reason": "디자인 리뷰 특화 미팅 퍼실리테이션",
      "since": "2026-06-01"
    }
  ]
}
```

Additive 오버라이드는 자동 승인되고 공통 파일에 내용이 추가(concatenate)된다. Replacement 오버라이드는 PR 검토가 필요하고 공통 파일을 전면 대체한다.

### 11.5 템플릿 검증

```bash
bun scripts/validate-templates.ts
```

검사 항목:
- 에이전트 frontmatter 완전성
- `## Meeting Participation`, `## Dispatch Protocol` 섹션 존재
- AGENTS.md 로스터 패리티
- `.sh`/`.ps1` 스크립트 패리티
- 공통 파일 동기화 경고
- Anti-Swelling Rule 위반

pre-commit 훅으로 `templates/` 파일 스테이징 시 자동 실행된다.

---

## 메모리 및 지식 관리 시스템

### 12.1 2계층 메모리 아키텍처

**CHANGELOG.md** (제품 대면 변경 이력):
- "무엇이 바뀌었나"
- 사용자가 읽는 릴리즈 노트
- Conventional Commits 기반 자동 생성 보조

**memory/YYYY-MM-DD.md** (개발자 대면 세션 로그):
- "어떻게, 왜 바뀌었나"
- 의사결정의 맥락과 근거
- 미해결 이슈 추적

### 12.2 세션 로그 필수 4섹션 형식

```markdown
## Session Summary
[세션의 목표와 달성 내용]

## Changes
[실제로 변경된 파일 목록과 내용]

## Decisions
[세션에서 내린 기술적 결정과 근거]

## Open Issues
[해결되지 않은 이슈 및 다음 세션 과제]
```

모든 메모리 로그는 영어로 작성해야 한다.

### 12.3 아카이브 전략

`MEMORY.md`가 ~50행을 초과하면:
1. 오래된 내용을 `docs/history.md`로 이동
2. 세부 기록은 `memory/archive/`로 이동
3. `MEMORY.md`는 최근 활동 요약만 유지

### 12.4 미팅 기록

`/meeting "topic" [--agents a,b] [--rounds N] [--dialogue]` 커맨드로 멀티 에이전트 구조화 토론을 진행하고, 결과를 `memory/meeting-YYYY-MM-DD-[slug].md`에 기록한다.

---

## 실무 활용 가이드 및 적용 시나리오

### 13.1 소규모 개발팀 적용 시나리오

**상황**: 2-3인 스타트업 팀, Claude Code + Gemini CLI 혼용

**적용 방법**:
1. 이 저장소를 팀 공유 디렉토리 (`~/git`)에 클론
2. `platform=both`로 신규 프로젝트 생성
3. `docs/context.md`에 팀 코딩 컨벤션 정의
4. `Coding Guidelines` 섹션에 팀 합의 내용 작성

**기대 효과**: AI 도구가 다르더라도 동일한 코딩 스타일, PR 워크플로우, 보안 정책 자동 준수

### 13.2 엔터프라이즈 적용 시나리오

**상황**: 대기업, 다수 프로젝트, 컴플라이언스 요구사항

**적용 방법**:
1. L0 CONSTITUTION.md에 기업 보안 정책 추가
2. `.gitleaks.toml`에 기업 특화 시크릿 패턴 추가
3. `co-security` 변형 활용해 보안 중심 프로젝트 생성
4. 분기별 `validate-templates.ts` 실행으로 거버넌스 드리프트 감지

**기대 효과**: AI가 생성한 코드에 대한 감사 추적, 일관된 보안 정책 자동 강제

### 13.3 AI 코딩 연구/실험 환경

**상황**: AI 멀티 에이전트 연구, 다양한 모델 실험

**적용 방법**:
1. `co-develop` 변형으로 프로젝트 생성
2. `agents/` 폴더에 실험용 에이전트 정의 추가
3. `agent-create.ts`로 라이프사이클 관리
4. `VERSION_MANIFEST.md`로 에이전트 버전 현황 추적

**기대 효과**: 에이전트 실험의 체계적 추적, 성공 패턴의 스킬 추출 및 재사용

### 13.4 Mark의 환경에서의 활용 (bizknights.org)

현재 M4 Mac mini 기반 환경에 이 시스템을 적용한다면:

- **워크스페이스 루트**: `~/git/`에 클론 (macOS 표준 경로)
- **Claude Code + Gemini CLI**: `platform=both`로 모든 프로젝트 생성
- **SAP ABAP vibe coding**: `co-develop` 변형으로 `vsp` MCP 프로젝트 관리
- **n8n 자동화**: `co-work` 변형으로 워크플로우 문서화 및 에이전트 팀 활용
- **Project OWN VDT**: `co-design` 또는 `co-work` 변형으로 KPI 오너십 구조 문서화

특히 현재 설정된 `~/.claude/agents/gemini-coder` 에이전트를 이 표준의 `automation-engineer` 역할과 통합하면, PM Gateway를 통한 일관된 오케스트레이션이 가능해진다.

### 13.5 커스텀 에이전트 추가 방법

```markdown
---
name: my-domain-expert
tier:
  claude: medium
  antigravity: medium
  gemini-cli: medium
model: inherit
color: cyan
description: 'Domain expert for [specific area]. Use when: "domain-specific task", "domain knowledge needed"'
examples:
  - user: "Analyze this domain document"
    assistant: "I'll analyze the domain-specific context..."
---

# My Domain Expert

[에이전트 역할 정의]
```

생성 후 `AGENTS.md`의 에이전트 로스터에 추가하고 `agent-create.ts`로 라이프사이클 등록.

---

## 아키텍처 강점 및 한계 분석

### 14.1 핵심 강점

**1. 행동 계약의 코드화**  
AI 도구의 행동을 "그냥 프롬프트"가 아닌 Git으로 관리되고 감사되는 버전 관리 아티팩트로 취급한다. 212개 커밋이 이 진화의 증거다. AI 행동의 드리프트를 버전 diff로 파악 가능하다.

**2. 계층적 SSOT 아키텍처의 엄격성**  
L0 → L1 → L2 → L3의 명확한 흐름은 설정 중복을 구조적으로 방지한다. `intentional-duplicate` 어노테이션은 불가피한 중복도 명시적으로 관리한다.

**3. 생애주기 관리의 완전성**  
에이전트·스킬·스크립트 각각에 상태 기계(State Machine)를 정의하고, 주간/월간/분기 운영 리듬과 연결했다. AI 네이티브 시스템의 거버넌스 공백을 체계적으로 메운다.

**4. 비용 최적화 내재화**  
3-티어 모델 배정이 아키텍처 수준에서 강제되어, 개별 엔지니어가 비용 최적화를 고민하지 않아도 된다. High-tier 모델은 설계와 오케스트레이션에만 사용된다.

**5. 교차 플랫폼 패리티 강제**  
Claude와 Gemini 설정이 동등성을 유지하도록 자동 검증하는 구조는, 특정 AI 도구에 락인되지 않는 유연성을 보장한다.

**6. 보안 기본 내재화 (Security by Default)**  
신규 프로젝트가 보안 설정을 "나중에 추가"하는 것이 아니라, 스캐폴딩 시점부터 자동으로 포함되는 구조다.

### 14.2 한계 및 개선 고려사항

**1. 학습 곡선의 가파름**  
CONSTITUTION.md (29.8KB, 497라인), AGENTS.md (33.4KB, 583라인), CLAUDE.md (17.1KB, 298라인)를 포함해 핵심 문서만 수만 줄에 달한다. 신규 팀원이 이 시스템을 완전히 이해하고 활용하기까지 상당한 학습 시간이 필요하다.

**2. 로컬 파일 시스템 의존성**  
워크스페이스 루트가 로컬 파일 시스템 구조에 강하게 결합되어 있다. 클라우드 기반 개발 환경(GitHub Codespaces, Gitpod)이나 컨테이너 환경에서의 적용에는 추가 설정이 필요하다.

**3. Git 훅의 플랫폼 제한**  
Claude Code Desktop App에서는 PostToolUse, TeammateIdle, TaskCompleted 훅이 동작하지 않는다. Desktop App 사용자는 수동으로 `audit.ts`를 실행해야 하는 절차적 부담이 있다.

**4. 단일 워크스페이스 가정**  
이 시스템은 개발자가 단일 워크스페이스 루트를 사용한다고 가정한다. 복수의 워크스페이스 루트(예: 회사 프로젝트와 개인 프로젝트를 분리하는 경우)를 관리하는 시나리오에 대한 지원이 명시적으로 정의되어 있지 않다.

**5. 실험적 기능의 안정성**  
Agent Teams(`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`)는 명시적으로 실험적 기능으로 표시되어 있으며, v2.1.32 이상이 필요하다. 프로덕션 환경에서 사용하기 전 충분한 검증이 필요하다.

**6. Antigravity 에코시스템 의존성**  
GEMINI.md는 Antigravity CLI를 상당 부분 참조한다. Antigravity가 공개 접근 가능한 도구가 아니라면, Gemini CLI만 사용하는 환경에서는 일부 기능이 동작하지 않을 수 있다.

---

## 결론 및 전략적 시사점

### 15.1 아키텍처의 본질적 혁신

`ai-workspace-standards`는 AI 코딩 도구를 "단순한 자동완성 도구"에서 "거버넌스 체계를 갖춘 팀 구성원"으로 격상시키는 아키텍처 패러다임을 제시한다. 핵심 혁신은 다음 세 가지로 요약된다.

**행동 계약의 버전 관리**: AI의 행동 규칙을 Git으로 관리함으로써, AI 행동의 변화를 코드 변화처럼 추적하고 롤백할 수 있게 된다. 이는 AI 시스템의 감사 가능성(Auditability) 문제에 대한 실용적 해답이다.

**이중 철학의 공존**: Vibe Coding과 Harness Engineering은 상충하는 것처럼 보이지만, 이 시스템은 두 철학이 동일한 거버넌스 인프라 위에서 공존할 수 있음을 보여준다. 개발자는 작업의 성격에 따라 적합한 모드를 선택하면 된다.

**생애주기 기반 지속 가능성**: 에이전트와 스킬을 일회성 설정이 아닌 생애주기를 갖는 소프트웨어 컴포넌트로 관리함으로써, 시스템이 성장해도 거버넌스 복잡성이 통제 가능한 수준에 머물게 된다.

### 15.2 AI 네이티브 개발 환경의 미래

이 저장소가 제시하는 패턴은 AI 네이티브 개발 환경의 향후 발전 방향을 시사한다. 전통적인 소프트웨어 공학에서 "Infrastructure as Code"가 인프라 관리를 코드화한 것처럼, 이 저장소는 "AI Behavior as Code"를 구현한다. 단순한 프롬프트 저장소를 넘어, AI 에이전트 팀의 거버넌스·역할·생애주기·비용 최적화를 코드로 표현하고 자동화한다.

### 15.3 도입 전략 권고

이 시스템을 도입하고자 한다면 다음 단계를 권장한다.

**1단계 (1주차)**: 워크스페이스 루트 클론 후 `CONSTITUTION.md`, `CLAUDE.md`, `AGENTS.md`의 핵심 개념 파악. Session Start Checklist 숙지.

**2단계 (2-3주차)**: `co-develop` 변형으로 소규모 파일럿 프로젝트 생성. PM 에이전트와 실제 상호작용 경험. `/sync` 파이프라인과 Git 훅 동작 방식 체험.

**3단계 (4주차 이후)**: 팀 특화 에이전트 추가, `docs/context.md`에 팀 코딩 가이드라인 작성, 분기별 라이프사이클 검토 루틴 수립.

### 15.4 최종 평가

이 저장소는 현재 공개 AI 코딩 도구 표준화 분야에서 가장 체계적이고 완성도 높은 오픈소스 구현 중 하나다. 212개의 커밋 이력과 지속적인 ADR(Architecture Decision Records) 기반 의사결정은 이 시스템이 단발성 아이디어가 아닌 장기적 진화를 목표로 설계되었음을 보여준다. 특히 생애주기 관리, PM Gateway 패턴, L0→L1→L2 계층 구조의 조합은 기업 수준의 AI 거버넌스 요구사항을 충족시킬 수 있는 잠재력을 갖추고 있다.

---

## 부록: 핵심 용어 사전

| 용어 | 정의 |
|---|---|
| **SSOT** | Single Source of Truth. 특정 정보의 단일 권위 원천. 중복 정의를 방지하고 일관성을 보장. |
| **Vibe Coding** | AI가 의도를 받아 전체 워크플로우를 자율 실행하는 개발 방식. |
| **Harness Engineering** | 개발자가 루프 안에 머물며 AI를 정밀 도구로 활용하는 개발 방식. |
| **PM Gateway** | 모든 에이전트 dispatch가 PM을 통하도록 강제하는 중앙화 패턴. |
| **Tier Ceiling Rule** | 에이전트의 티어는 정의된 기준을 초과해 높일 수 없다는 규칙. |
| **Anti-Swelling Rule** | 50% 이상의 변형이 동일 파일에 오버라이드하면 L1으로 승격해야 한다는 규칙. |
| **Layout Reconstruction** | L2 생성 시 6단계 재구성으로 변형 특화 PM 에이전트를 생성하는 아키텍처. |
| **WORKSPACE-MANAGED** | 업그레이드 스크립트가 자동 관리하는 파일 섹션을 표시하는 HTML 코멘트 마커. |
| **Intentional Duplicate** | 의도적 중복임을 명시하는 어노테이션. 원천 변경 시 동기화 의무 포함. |
| **Session Start Checklist** | 모든 AI 세션 시작 시 반드시 실행해야 하는 컨텍스트 로딩 순서. |
| **VERSION_MANIFEST** | 워크스페이스 전체 라이프사이클 아티팩트 버전의 SSOT. /sync 시 자동 재생성. |
| **Platform Parity** | CLAUDE.md와 GEMINI.md가 동등한 섹션 커버리지를 유지해야 하는 요구사항. |
| **Additive Override** | L2 변형이 L1 공통 파일에 내용을 추가하는 방식의 오버라이드. 자동 승인. |
| **Replacement Override** | L2 변형이 L1 공통 파일을 전면 대체하는 오버라이드. PR 검토 필요. |
| **Conventional Commits** | feat:/fix:/docs: 등 표준 접두사를 사용하는 커밋 메시지 규약. |
| **SYNC_ACTIVE** | /sync 파이프라인을 우회하는 직접 커밋을 방지하는 보호 메커니즘. |

---

*본 보고서는 GitHub 저장소 https://github.com/5throck/ai-workspace-standards 의 공개 소스를 기반으로 작성되었으며, 분석 기준일은 2026-06-14입니다. 저장소의 지속적인 발전에 따라 일부 내용이 변경될 수 있습니다.*

*문서 버전: v1.0 | 페이지 수: 약 18페이지 (A4 기준)*
