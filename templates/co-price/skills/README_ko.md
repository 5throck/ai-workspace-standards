# skills/ — co-price 스킬 정의

이 디렉터리는 variant 전용 스킬 세트를 보유합니다. 각 스킬은 폴더 하나와 그 안의
`SKILL.md` 정의로 구성되며, 워크스페이스 `skill.schema.json`에 맞는 프론트매터
(`status`, `owner`, `metadata.type`, `metadata.triggers`)를 포함합니다.

## 구성

| 경로 | 역할 |
|---|---|
| `SKILLS.md` | 사람이 읽는 카탈로그: 스킬별 목적·핵심 적용·활성화 기준 |
| `<skill-name>/SKILL.md` | 스킬 하나의 권위 있는 정의와 실행 절차 |

## 스킬 인덱스 (활성 10종)

| 스킬 | 소유 에이전트 | 유형 |
|---|---|---|
| [`harness-verification`](harness-verification/SKILL.md) | cpa-auditor | quality |
| [`double-entry-reconciliation`](double-entry-reconciliation/SKILL.md) | cpa-auditor | quality |
| [`i18n-audit`](i18n-audit/SKILL.md) | l10n-auditor | quality |
| [`sheet-model`](sheet-model/SKILL.md) | cpa-auditor | quality |
| [`prisma-7`](prisma-7/SKILL.md) | lead-architect | lifecycle |
| [`excel-export`](excel-export/SKILL.md) | core-engine-dev | process |
| [`pdf-export`](pdf-export/SKILL.md) | core-engine-dev | process |
| [`math-function-plotter`](math-function-plotter/SKILL.md) | core-engine-dev | process |
| [`financial-statement-prep`](financial-statement-prep/SKILL.md) | finance-strategy-lead | process |
| [`ui-component-design`](ui-component-design/SKILL.md) | ux-specialist | process |

v10.1 예정 스킬(기능 단계와 함께 생성): `pricing-diagnostic`, `scenario-comparison`,
`competitive-intelligence`, `insight-synthesis`, `executive-presentation`,
`van-westendorp-psm`, `gabor-granger`, `cost-shock-analysis`, `copilot-onrails-audit`.

## 규칙

- 워크스페이스 공통 스킬은 이곳에 복사하지 않습니다 — 워크스페이스 루트
  (`ai_workspace/skills/`)에서 실행합니다. `_ORIGIN.md` 참조.
- 신규 스킬은 `schemas/skill.schema.json` 기준 프론트매터 등록 후 이 인덱스와
  `variant.json → skill_manifest`에 추가해야 합니다.
- 영문 원본: [`README.md`](README.md).
