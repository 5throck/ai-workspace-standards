# skills/ — co-price Skill Definitions

This directory holds the variant-specific skill set. Each skill is one folder with an
authoritative `SKILL.md` definition carrying schema-compliant frontmatter (`status`,
`owner`, `metadata.type`, `metadata.triggers`) per the workspace `skill.schema.json`.

## Layout

| Path | Purpose |
|---|---|
| `SKILLS.md` | Human-readable catalog: per-skill purpose, key applications, activation criteria |
| `<skill-name>/SKILL.md` | The authoritative definition and procedure for a single skill |

## Skill Index (22 active)

| Skill | Owner agent | Type |
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
| [`van-westendorp-psm`](van-westendorp-psm/SKILL.md) | market-intelligence-analyst | process |
| [`gabor-granger`](gabor-granger/SKILL.md) | market-intelligence-analyst | process |
| [`pricing-playbook`](pricing-playbook/SKILL.md) | pricing-strategist | process |
| [`competitive-intelligence`](competitive-intelligence/SKILL.md) | market-intelligence-analyst | process |
| [`scenario-comparison`](scenario-comparison/SKILL.md) | engagement-director | quality |
| [`insight-synthesis`](insight-synthesis/SKILL.md) | engagement-director | process |
| [`executive-presentation`](executive-presentation/SKILL.md) | ux-specialist | process |
| [`trade-promotion-roi`](trade-promotion-roi/SKILL.md) | market-intelligence-analyst | process |
| [`cost-shock-analysis`](cost-shock-analysis/SKILL.md) | cost-asset-mgmt | process |
| [`price-waterfall-analysis`](price-waterfall-analysis/SKILL.md) | finance-strategy-lead | process |
| [`pricing-governance`](pricing-governance/SKILL.md) | pricing-strategist | process |
| [`map-channel-enforcement`](map-channel-enforcement/SKILL.md) | pricing-strategist | process |

Planned v10.1 skills (created alongside their feature phases): `pricing-diagnostic`,
`copilot-onrails-audit`.

## Rules

- Workspace-common skills are never copied here — they run from the workspace root
  (`ai_workspace/skills/`). See `_ORIGIN.md`.
- New skills must register schema-compliant frontmatter, then be added to this index
  and to `variant.json → skill_manifest`.
- Korean mirror: [`README_ko.md`](README_ko.md).
