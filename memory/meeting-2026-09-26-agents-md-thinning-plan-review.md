# Meeting Transcript — AGENTS.md 경량화 계획 검토 (포인터/참조 모델 D1 + 플릿 배포 D9)

- **Date**: 2026-09-26
- **Facilitator**: PM (meeting-facilitation skill v1.4.3)
- **Participants**: architect(High), automation-engineer(Low), docs-writer(Medium), auditor(Medium), security-expert(Medium), red-team(dissent seat)
- **Invariants upheld**: dissent seat assigned (red-team) / outcome is PROPOSAL, not decision / dissent preserved verbatim

## Agenda

1. 계획 재확인: AGENTS.md thin-dispatcher(≤15k 전 계층) — 인라인 집합/이동 집합, COMMON-AGENTS-GOVERNANCE 신규 존 + MERGE 전파, W1(L0)→W2(검증자)→W3(13판본 스윕)→W4(12프로젝트 전환+Hermes 실물 검증)
2. 역할별 검토 (구조/구현/문서/거버넌스/보안/반대)
3. 종합 → 사용자 제안

## Contributions

### architect (structural)

1. **신규 존 대신 COMMON-AGENTS 재사용**: COMMON-AGENTS-GOVERNANCE 추가는 이득이 없음 — COMMON-AGENTS 라벨이 ~10개 소비자(markers.ts, scaffold-markers.ts, managed-block-parity.ts, validate-templates.ts, upgrade-project.ts, create-l3-scaffold.ts, l3-to-variant-pipeline.ts, propagation-map.json, 테스트 3종)에 하드코딩. 두 존은 같은 MERGE 패스를 타므로 포인터 테이블을 COMMON-AGENTS 존 안에 넣는 것이 코드 변경 0.
2. **§3을 CONSTITUTION §5.5로 흡수 금지 — 화살표가 반대**: CONSTITUTION.md:169가 이미 "[AGENTS.md §3.9]"로 위임 중. 운영 상세의 올바른 처소는 `docs/governance/pm-gateway-workflow.md`(선례: pm-orchestrator-parameters.md, github-first-execution.md). CONSTITUTION §5.5는 MUST 수준 정책만 유지.
3. **미러 갭**: CLAUDE.md 26.7k / GEMINI.md 26.2k / CODEX.md 15.4k가 동일 PM Gateway 콘텐츠를 MERGE 존으로 보유 — AGENTS만 슬림하면 Claude Code는 자동 로딩에서 §3을 잃고, Platform Documentation Parity가 롤아웃을 막거나 W4에 강제 재구조화를 만듦. 미러 존 동시 슬림 또는 동일 포인터 블록 주입 필요.
4. **웨이브 순서 반전**: 검증자가 W2라면 W1의 57k→15k가 무겸증 착지. size-budget+pointer-integrity를 먼저(또는 동일 PR) 착지. pointer-integrity는 CONSTITUTION/ADR 백링크까지 스캔(CONSTITUTION:169의 `[AGENTS.md §3.9]` 앵커는 §3.9 이동 즉시 사망).
5. **생성 로스터의 집행 경로 지정** — 아니면 context.md ## Agents의 13/13 미이행 실패를 재현. 생성기·트리거·드리프트 게이트를 W2에 명시.
6. **프로젝트당 전환 PR에 게이트 없음**: check-upgrade-coverage --strict + 신규 검증자를 PR 게이트로. 관재는 기계 검증 가능한 보존 단언을 산출해야 함(리뷰어 판단 아님).
- 소유권 매트릭스(목표): CONSTITUTION=규칙 SSOT, docs/governance/*.md=운영 절차, VERSION_MANIFEST=스킬/버전 표, AGENTS.md=디스패치 헤더+포인터 테이블+로스터 요약+§7, L2 `<variant>.context.md`=variant 오버라이드+컨텍스트.
- **최대 우려**: AGENTS.md만 얇게 정의 — 나머지 4하네스가 실제 로드하는 CLAUDE/GEMINI/CODEX.md는 여전히 fat. Hermes는 고치지만 포인터 계약이 5중 4하네스에 보이지 않는 플릿이 됨.

### automation-engineer (implementation, code-verified)

- 존 등록은 MANAGED_PATTERNS 1항목(선례: COMMON-CODEX v1.2.0) — MERGE 패스는 제네릭. 단, 존 없는 프로젝트 파일에는 EOF에 append됨(의미적 위치 아님).
- **AGENTS.md는 DOCS_MERGE_FILES(upgrade-project.ts:1336)** — mergeManagedBlocks는 존 외부 콘텐츠를 그대로 보존 → **재구조화된 템플릿이 기존 프로젝트의 legacy §3/§4/§5 본문을 못 지움. W4가 MERGE만으론 안 됨.** 1회 전환 스텝 패턴 존재(CONTEXT_COMMONIZATION :1381, IDENTITY SEED :2475 + isLocallyModified 가드).
- **투사(fighter) 확인**: audit.ts:2239-2240이 §1/§3/§5 헤딩 결측을 hard-Fail(스켈레톤 계획이 이 게이트를 먼저 죽임); Phase B-AGENTS(:1236-1350)가 §헤딩 앵커 정규식 ~18개 — AGENTS.md die-guard 없음(CLAUDE/GEMINI/CODEX만 B-8 :1225); propagate Phase A(:1134)가 CONSTITUTION 스크럽(포인터 문구 "CONSTITUTION §5.5" 재기록 — 무해하나 인지 필요); COMMON-AGENTS-GOVERNANCE 존은 PM-02/03 요구대로 자체 marker-inject 도메인 필요.
- regenerate-agents-md.ts가 VARIANT-* 블록 + frontmatter 생성을 이미 수행 — W3 전면 재사용 가능(VARIANT-* 마커 생존 전제).
- **웨이브 판정**: W1 YELLOW(§헤딩 유지 또는 Phase B/audit 동시 수정), W2 GREEN, W3 YELLOW(PM-02/03·audit 게이트 선착), W4 YELLOW→RED(전용 AGENTS_RESTRUCTURE 스텝 필요 — snapshots 기재 재사용).
- 리스크 3: (1) §1/§2 이동 후 Phase B-AGENTS 무음 no-op → B-8식 die() 추가, (2) audit:2239 §구조 Fail → W1에 §1/§3 스켈레톤 포함+W2에서 체크 갱신, (3) W4 stale-body 중복 → 전용 스텝 + .bak 스냅샷.
- 미발견 재사용: COMMON-CODEX 커밋=존 추가 플레이북, `--auto-fix-agents-md`, checkRosterTierConsistency, pre-reconcile 스냅샷.

### docs-writer (consistency)

- **로드 계약 초안**(~105 words): "Load contract — binding. This file is an index only; it does not contain the rules. Before any planning, dispatch, review, or governance work, Read the owning file for your task, in full: [표: PM Gateway→pm-gateway-workflow.md / Execution plans→execution-plan-templates.md / Workspace rules→CONSTITUTION.md→docs/constitution/*.md / Skill resolution→§6+VERSION_MANIFEST.md] Citing a rule you did not Read from its owning file is a process violation. If a referenced file is missing, stop and report. Do not reconstruct policy from memory." — 집행력 요소: 명령형+차단 동사, 위반 가능 진술, fail-closed 결측 동작.
- **갱신 체크리스트**: CONSTITUTION.md 앵커 10곳(L150/167/169/171/208/512/514/681/738) + 용어 등록(§Terminology L65, §10 L535); CLAUDE.md 5곳/GEMINI.md 5곳/CODEX.md 4곳의 AGENTS 앵커; 스킬 4중 사본 each(sync §5.1.1, agent-lifecycle-manager §1/§4.1/§10, project-review §10, skill-graph-analytics); 스크립트 하드코딩(propagate-to-templates:1422, validate-model-registry:5/207, l3-pipeline:88/717, validate-templates:1196/2171, lifecycle-sync-audit:622, dev-sync:526, generate-version-manifest:268, hooks/agent-model-gate:5/133); README/README_ko 서술 수정; docs/index.md에 신규 파일 등록; getting-started 불요.
- **i18n**: AGENTS.md 본문의 ko 미러 없음(확인) — README_ko만 서술 갱신.
- **용어**: "load contract"/"pointer table"을 CONSTITUTION Terminology에 등록, "thin dispatcher"는 등록 용어로 대체 또는 정식 명명(STE 리스크).
- 리스크: 검증자들의 §맵 하드코딩(model-registry 4파일 패리티, l3 Phase 3.5)이 같은 PR에서 갱신되지 않으면 오탐/오통과; 4중 사본 드리프트; 로드 계약이 게이트 없으면 권고에 머무름.

### auditor (governance)

- **누락 산출물**: ADR-0090 필요(SSOT 재배치 = ADR-0035/0048 트리거 클래스); 스펙 상태 전이(proposed→implemented 웨이브별) — 설계 문서 미등록; SCRIPTS.md 행 2건(신규 검증자)+managed-block-merge 버전 bump; VERSION_MANIFEST 동일 PR 재생성(안 하면 audit 29(b) Fail); variant-contract.json 구조 절 부재(스캔폴이 fat AGENTS.md 재생산); common-contract.json L601/605/609의 "AGENTS.md §6" 인용 스테일.
- **신규 드리프트 클래스→상시 체크**: Variant Overrides가 캐노니컬과 모순 금지(교차파일 정규화 diff); 생성 로스터 regen-diff; 로드 계약 문구 14사본 해시 일치; 이동 섹션의 재출현 토큰 스캔(nightly, ADR-0071); 앵커 로트 교차파일 해소.
- **규칙 개정 목록(file:line)**: CONSTITUTION:167(§5.1 SSOT 재지향), :169/171/512(§3.9/3.11/3.10 앵커→pm-gateway-workflow.md), :514(Language Policy 홈), 01-folder-structure.md:60(로스터 SSOT=생성기로 규칙 개정), audit.ts:3001(정규식 — L0 다이어트와 같은 PR에서), audit.ts:1910-1945(포인터 §6 전제 변경).
- **최대 우려**: W1→W2 무집행 창 — 관재 없는 부분 상태(L0 얇음+L1/L2 fat+로스터 미생성)가 audit을 조용히 통과. 웨이브별 기계 검증 수용 기준 필요. **relocation-only가 리뷰 검증뿐** — 정규화 텍스트-커버리지 diff(원본 대비) 기계 게이트를 W1 머지 전에 추가해야 롤백 스토리가 성립.

### security-expert

- **F1 HIGH**: 온디맨드 거버넌스 참조 파일에 무결성 검사 없음 — PM-04b는 common→variant 패리티만(Projects/* 미스캔), audit/dev-sync는 docs/governance 체크 0. **완화: 거버넌스 해시 매니페스트(SHA-256, upgrade+audit 검증 — VERSION_FOOTER 동기 선례) + PM-04b를 Projects/*/AGENTS.md로 확장.**
- **F2 MED**: 존 탬퍼링이 조용히 교정됨(카운트 일치 시 WARN 없이 MERGED) — 변조 가시성 없음. **완화: 덮어쓰기 전 해시 비교 WARN/인시던트 로그 + 얇은 AGENTS.md에 비-오버라이드 보안 플로어(쓰기 제한, §7 보안 경계) 상시 유지** — 오염된 참조 파일로 로드 계약이 리다이렉트될 수 없게.
- **F3 MED**: 로스터 보간 미이스케이프(regenerate-agents-md.ts 템플릿 리터럴 raw) — `|`/마크업/`<!--` 흐름. **완화: 생성 시 sanitize + agent-verify 검증.**
- 스팟체크: §3/§4/§5/§5.5/docs/governance에 시크릿·내부 경로 없음 — 플릿 배포 안전. **단 결함 1: §3.7.5(Governance Backlog)는 명시적 L0-only(ticket.ts, never propagated) — §3 통째 이동 시 L0-only 콘텐츠가 플릿에 배포되거나 SSOT가 포크됨. W1 전 파티셔닝 필수.**
- 판정: **W1 전 보안 추가 필요** — (1) 해시 매니페스트, (2) MERGE 다이버전스 WARN, (3) 로스터 sanitize, (4) §3.7.5 파티션, (5) 인라인 보안 플로어. 온디맨드 로딩은 인젝션 포함에 중립~긍정이나 탬퍼 가시성이 전제.

### red-team (dissent seat — verbatim)

**1. The problem is already solved by config; the restructure solves a problem nobody has. (Severity: highest — cost/benefit fails)**
Your own evidence defeats the plan. ADR-0088 D7 (CONSTITUTION.md:695, AGENTS.md:593, CHANGELOG 2026-09-25) already makes `hermes config set context_file_max_chars 100000` a **REQUIRED onboarding step**. The truncation incident is closed. What remains? "An agent might not set config." But an agent that ignores a one-line documented onboarding step will equally ignore your 15-line "load contract." Meanwhile the restructure costs: 14 file rewrites, a new marker zone, an adjudication sweep, a new validator arm, wave-gated PRs across 12 repos. **Failure scenario:** two weeks of governance churn to fix a condition that a config line already fixed — and every hour spent adjudicating §3 forks is an hour not spent on the 27 WARNs sitting in validate-templates. Who is this for? Not Hermes users — they're covered. Answer honestly: it's for the token bill, which was never stated as a requirement.

**2. Pointers don't read themselves — Claude Code is the net loser. (Severity: high — silent governance regression)**
Today Claude Code, Codex, Gemini, and Antigravity auto-load the FULL 57k and see the PM Gateway, Design Gate, and STE100. Post-restructure they auto-load a ≤15k skeleton; §3's authority rules live in `docs/governance/pm-gateway-workflow.md`, which **no harness auto-loads**. Hermes gains (20k→deep rules via Read). Every other harness loses context and only regains it if the model spontaneously honors a prose contract — the same class of "the agent will do it" optimism this ecosystem's own PM Gateway exists to distrust. **Failure scenario:** a co-develop agent proposes an execution plan without PM approval because §3's body wasn't in context, and the reviewer can't even prove which rule was skipped, since it was never loaded. That's a governance regression laundered as a size fix.

**3. "Relocate, never edit" is fiction — adjudication is a one-way door. (Severity: high)**
D3 (design doc, line 37) explicitly *edits*: drift "adopts canonical," prose is "shortened," "stale duplicates drop." So the 13 zero-byte-identical forks get rewritten during migration. After 12 project PRs land, reverting means re-materializing 14 files from fragments that were **altered in transit** — there is no pristine source to restore. **Failure scenario:** W3 stalls at sub-wave 2 of 3 (the plan itself wave-gates 4–5 variants), leaving 7 files thin, 6 files fat, and the validator FAIL arm live against the un-migrated 6. That mixed state is strictly worse than today's uniform fat: now drift is structural, not textual.

**4. A fail-closed 15k budget manufactures content deletion. (Severity: medium-high)**
D6 makes >15k a FAIL. When governance legitimately grows — a new gate, a new platform — the cheapest way to pass the validator is deleting a rule, not authoring a new reference file and rewiring pointers. Precedent: this repo already needed "identity residue" WARN amnesty for exactly this class of mechanical-pressure artifact. You are building a ratchet that rewards thinning law to fit an arbitrary number derived from one vendor's default.

**What I'd push instead**: Ship **config-only** (already done — declare victory), plus **targeted dedup**: adjudicate §3/§4 fork-drift into the canonical copies *in place*, keeping AGENTS.md fat, intact, and auto-loaded. Add the size analysis as documentation, the budget as a WARN-only metric. Revisit restructuring only if a second harness exhibits real truncation harm. This fixes every observed failure with zero one-way doors.

## Synthesis (Chair)

**수렴 개선점 (전 역할 합의 — 어느 경로든 적용):**
- A. 신규 존 생성 철회 → COMMON-AGENTS 존을 캐리어로 재사용(코드 변경 0, ~10 소비자 정합)
- B. §3 운영 상세 → docs/governance/pm-gateway-workflow.md (CONSTITUTION §5.5 흡수 철회 — CONSTITUTION은 MUST 정책만)
- C. **검증자/파이터 선행(W0)**: size-budget(WARN 시작)+pointer-integrity+audit §-게이트 정합+Phase B die-guard — 재구조화 이전 착지
- D. W4 전용 AGENTS_RESTRUCTURE 스텝(MERGE는 존 외부 보존 → legacy 본문 미삭제) + 스냅샷
- E. 미러 트윈(CLAUDE/GEMINI/CODEX)은 full 유지 + 포인터 테이블 추가(캡 없는 하네스 보호), 패리티 검사 갱신
- F. 보안: 해시 매니페스트 + MERGE 다이버전스 WARN + 로스터 sanitize + §3.7.5 L0-only 파티션 + 인라인 보안 플로어
- G. docs-writer의 로드 계약 초안 + 앵커 인벤토리(~10 스크립트, CONSTITUTION 10곳, 트윈 14곳, 스킬 4중 사본) 갱신 + 용어 등록
- H. 기계적 보존 게이트(정규화 커버리지 diff) — relocation-only를 리뷰가 아닌 기계로 검증

**미해결 쟁점 (사용자 결정 필요)**: red-team의 1·2번 반론 — (i) config가 이미 문제를 닫았는가, (ii) Claude Code 등 4하네스의 컨텍스트 순손실을 수용할 것인가. 이는 비용/편응 판단으로 의석이 아니라 사용자의 몫.

## Proposal (사용자 승인 대상 — 회의는 결정하지 않음)

| 옵션 | 내용 | trade-off |
|---|---|---|
| **옵션 1 — 전면 재구조화(수정안 반영)** | A–H 전부 적용한 D1 확정 + W0선행 검증자 → W1 L0 → W2 전파 → W3 스윕 → W4 전환 | Hermes 구조적 해결+중복 제거+일관성 / 최대 공수, 레드팀 3·4번 리스크 |
| **옵션 2 — 레드팀 대안** | config 선언 완료 유지 + F1/F2 표적 dedup(제자리), AGENTS.md fat 유지, 예산 WARN-only | 공수 최소·역방향 문 없음 / Hermes 외 구조 개선 없음, F3/F4 잔존 |
| **옵션 3 — 단계 접근** | W0 검증자/보존 게이트(WARN) + F1/F2 표적 dedup 먼저 → 포인터 추종 실태·타 하네스 절단 피해 관찰 후 thin 전환 재판정 | 리스크 최소, 의사결정 유예 / 즉효는 F1/F2뿐 |

## Decision (사용자, 2026-09-26)

**옵션 1 — 전면 재구조화 확정.** 레드팀 반론 3(일방문)·4(예산 압박)는 C(WARN 선행)·D(스냅샷)·H(기계 보존 게이트) 완화장치로 수용 기록. 반론 1·2(config 충분성, 4하네스 컨텍스트 순손실)는 사용자가 비용/편응 판단으로 수용 — E(미러 트윈 full 유지+포인터)로 순손실 최소화.

## Action Items (확정 경로)

- Step 0: 본 회의록 착지 + 설계 문서 Approved 재기술(A–H 반영) + ADR-0090 작성
- W0: 검증자(size-budget WARN, pointer-integrity)+die-guard+보존 게이트+SCRIPTS.md/용어
- W1: L0 리스턱트(§3.7.5 인라인 잔존, 보안 플로어, ≤15k, 보존 게이트 통과)
- W2: 전파 배선+미러 트윈 포인터+앵커 갱신 체크리스트 실행
- W3: L1/L2 스윕(서브웨이브, disposition Addendum)
- W4: 12프로젝트 전환(스냅샷)+Hermes 실물 재검증+스펙 implemented
