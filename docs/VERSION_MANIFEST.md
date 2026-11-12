# VERSION_MANIFEST.md

**Generated**: 2026-11-12T04:59:20.424Z
**Manifest Version**: 1.0
**Location**: docs/VERSION_MANIFEST.md

---

## Summary

- **Agents**: 9
- **Skills**: 60
- **Scripts**: 136 *(top-level CLI scripts; library/helper modules under `scripts/lib/`, `scripts/helpers/`, `scripts/hooks/`, and `scripts/validators/` plus experiment files under `scripts/experiments/` are excluded here — `scripts/SCRIPTS.md` is the full registry)*
- **Commands**: 7

---

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| architect | agents/architect.md | high | claude-opus-5-5 | 2026-11-10 |
| auditor | agents/auditor.md | medium | claude-sonnet-5-5 | 2026-11-10 |
| automation-engineer | agents/automation-engineer.md | medium | claude-sonnet-5-5 | 2026-11-12 |
| docs-writer | agents/docs-writer.md | medium | claude-sonnet-5-5 | 2026-11-10 |
| lifecycle-manager | agents/lifecycle-manager.md | medium | claude-sonnet-5-5 | 2026-10-30 |
| pm | agents/pm.md | medium | claude-sonnet-5-5 | 2026-11-12 |
| scaffolding-expert | agents/scaffolding-expert.md | low | claude-haiku-5-5 | 2026-11-10 |
| security-expert | agents/security-expert.md | medium | claude-sonnet-5-5 | 2026-11-10 |
| skill-graph-analyst | agents/skill-graph-analyst.md | low | claude-haiku-5-5 | 2026-10-30 |

---

<!-- validate-md-language:allowlist-begin reason="Triggers column embeds verbatim Korean search keywords copied from k-* SKILL.md frontmatter (proper-noun data values, not prose). Generated region — a whole-file lang: ko exception would be dishonest and would un-validate the rest of the manifest, so scripts/validate-md-language.ts exempts only this marked section (T-20260912-015)." -->
## Skills

| Name | Version | Status | Location | Platform | Triggers | Owner |
|------|---------|--------|----------|----------|----------|-------|
| accessibility-audit | 1.1.0 | active | skills/accessibility-audit/SKILL.md | workspace | accessibility-audit, /accessibility-audit, axe-core audit, wcag accessibility check, wcag 2.1 aa | pm |
| adopt-project | 1.1.1 | active | skills/adopt-project/SKILL.md | workspace | adopt external project, adopt project to standard, convert external project to workspace standard, onboard existing project | scaffolding-expert |
| agent-lifecycle-manager | 1.4.0 | active | skills/agent-lifecycle-manager/SKILL.md | workspace | create agent, new agent, validate agents, agent lifecycle, manage agents, hire agent, fire agent, deprecate agent | pm |
| api-documentation | 1.0.2 | active | skills/api-documentation/SKILL.md | workspace | api documentation, document api, api reference, developer documentation, rest api docs, graphql docs, sdk documentation | pm |
| ci-triage | 0.2.0 | active | skills/ci-triage/SKILL.md | workspace | ci failure, triage failure, audit gate failed, scaffold failed, fix the pipeline | pm |
| context-commonization-review | 1.1.0 | active | skills/context-commonization-review/SKILL.md | workspace | context commonization review, variant context duplication, commonization review, context.md duplication review, context.md commonization | architect |
| create-variant | 1.4.3 | active | skills/create-variant/SKILL.md | workspace | create variant, new variant, variant creation, scaffold new variant, new co- project | pm |
| decision-record | 1.1.0 | active | templates/common/skills/decision-record/SKILL.md | common | decision record, gate ruling, go/no-go decision, escalation decision, record a decision | pm |
| decision-write-integrity | 1.0.0 | active | skills/decision-write-integrity/SKILL.md | workspace | decision write integrity, gate integrity, approval gate, hard block, maker checker, countersign, snapshot hash, decision audit | pm |
| delegate-to-hub | 1.0.1 | active | skills/delegate-to-hub/SKILL.md | workspace | delegate to hub, delegation ticket, hub delegation, escalate to hub, file delegation | pm |
| design-foundation | 1.1.0 | active | skills/design-foundation/SKILL.md | workspace | design foundation, design principles, design guide, design tokens setup, design decision record | architect |
| design-token-adoption | 1.0.0 | active | skills/design-token-adoption/SKILL.md | workspace | token retrofit, design token adoption, allowlist reduction, adopt design tokens in existing UI, brownfield design tokens | pm |
| documentation-writing | 1.0.3 | active | skills/documentation-writing/SKILL.md | workspace | write documentation, create guide, draft communication, write manual, create tutorial, documentation, technical writing | pm |
| evidence-ledger | 1.1.0 | active | templates/common/skills/evidence-ledger/SKILL.md | common | evidence ledger, citation ledger, claim verification, source verification, evidence tracking | pm |
| explain-me | 1.0.0 | experimental | skills/explain-me/SKILL.md | workspace | /explain-me, /reportme, make a report, create report, explain this topic | pm |
| finishing-a-development-branch | 1.0.1 | active | skills/finishing-a-development-branch/SKILL.md | workspace | finish branch, complete work, wrap up, finishing a development branch, merge branch, create PR, push and PR | pm |
| gateguard | 1.0.2 | active | skills/gateguard/SKILL.md | workspace | gateguard, /gateguard, investigate file, check before edit, pre-edit check | pm |
| handbook | 0.6.0 | active | templates/common/skills/handbook/SKILL.md | common | make handbook, create handbook, build course site, companion handbook, update handbook, handbook sync, handbook maintenance | pm |
| handbook-sync-audit | 1.0.5 | active | templates/common/skills/handbook-sync-audit/SKILL.md | common | audit handbook, handbook parity check, handbook sync audit, textbook drift check | pm |
| i18n-audit | 1.0.0 | active | templates/common/skills/i18n-audit/SKILL.md | common | i18n audit, locale parity, translation parity, glossary audit, L10N parity | pm |
| i18n-formatting | 1.0.0 | active | templates/common/skills/i18n-formatting/SKILL.md | common | date format, number format, currency format, unit conversion, paper size, korean numerals | pm |
| i18n-layout | 1.1.0 | active | templates/common/skills/i18n-layout/SKILL.md | common | character encoding, RTL, bidi, font selection, CRLF, BOM | pm |
| i18n-locale-config | 1.0.0 | active | templates/common/skills/i18n-locale-config/SKILL.md | common | locale config, locale code, BCP 47, collation, collation order, timezone | pm |
| k-dart | 2.1.2 | active | templates/common/skills/k-dart/SKILL.md | common | k-dart, /k-dart, DART, DART OpenAPI, `DART 공시`, `공시검색`, `기업개황`, `재무제표`, `재무정보`, `재무제표 조회`, financial statement, corporate disclosure | strategy-analyst |
| k-ecos | 1.0.0 | active | templates/common/skills/k-ecos/SKILL.md | common | k-ecos, /k-ecos, ECOS, `한국은행`, `한국은행 Open API`, `경제통계시스템`, `기준금리`, `환율`, `본원통화`, `100대 통계지표`, Bank of Korea statistics, Korean monetary statistics | financial-analyst |
| k-kosis | 1.0.2 | active | templates/common/skills/k-kosis/SKILL.md | common | k-kosis, /k-kosis, KOSIS, `통계청`, `국가통계포털`, `인구통계`, `물가지수`, `경제통계`, `국가통계`, Korean national statistics | financial-analyst |
| k-krx | 1.0.2 | active | templates/common/skills/k-krx/SKILL.md | common | k-krx, /k-krx, KRX, `한국거래소`, `KRX Open API`, `정보데이터시스템`, `주식 시세`, `코스피`, `코스닥`, `코넥스`, `일별매매정보`, `종목기본정보`, Korean stock market data, KOSPI market data, KOSDAQ market data | financial-analyst |
| k-law | 1.0.2 | active | templates/common/skills/k-law/SKILL.md | common | k-law, /k-law, `법령`, `법률`, `법령정보`, `법령검색`, `판례`, law, statute, legal search, Korea law | strategy-analyst |
| k-opendata | 1.2.2 | active | templates/common/skills/k-opendata/SKILL.md | common | k-opendata, /k-opendata, 공공데이터포털, data.go.kr, `관세청`, `수출입무역통계`, `품목별 국가별 수출입실적`, Korea Customs Service trade statistics, HS code trade data | hs-classification-specialist |
| meeting-facilitation | 1.5.0 | active | skills/meeting-facilitation/SKILL.md | workspace | meeting, agent discussion, collaborative decision, multi-agent coordination, facilitate meeting | pm |
| migrate-project | 1.0.0 | active | skills/migrate-project/SKILL.md | workspace | migrate project, adopt and verify migration, run project migration, full project migration flow | scaffolding-expert |
| model-migration | 1.0.0 | active | skills/model-migration/SKILL.md | workspace | model-migration, change model, model bump, `모델 변경` | lifecycle-manager |
| new-project | 1.0.0 | active | skills/new-project/SKILL.md | workspace | new project, create project, scaffold project, project from template, start a new engagement | scaffolding-expert |
| platform-command-lifecycle-manager | 1.0.3 | active | skills/platform-command-lifecycle-manager/SKILL.md | workspace | create platform command, new .claude command, new .gemini command, platform command lifecycle, command parity, propagate command | pm |
| platform-skill-lifecycle-manager | 1.0.2 | active | skills/platform-skill-lifecycle-manager/SKILL.md | workspace | create platform skill, new .claude skill, new .gemini skill, platform skill version, platform skill lifecycle, update platform skill | pm |
| project-resync | 1.8.0 | active | skills/project-resync/SKILL.md | workspace | project-resync, resync projects, sync project cycle | pm |
| project-review | 1.3.2 | active | skills/project-review/SKILL.md | workspace | project review, review project, audit project, quality review | pm |
| project-to-variant | 1.3.0 | active | skills/project-to-variant/SKILL.md | workspace | convert project to variant, create variant from project, project to template, promote project to variant | scaffolding-expert |
| promote-variant | 1.4.0 | active | skills/promote-variant/SKILL.md | workspace | promote variant, Phase B, variant promotion, promote to template, create template from prototype | pm |
| release-template | 1.0.0 | active | skills/release-template/SKILL.md | workspace | release template, template release, bump templates version, tag template, publish template version | pm |
| research-analysis | 1.0.2 | active | skills/research-analysis/SKILL.md | workspace | research, analyze, investigate, synthesize, evidence gathering, data analysis, literature review | pm |
| script-lifecycle-manager | 1.2.2 | active | skills/script-lifecycle-manager/SKILL.md | workspace | create script, update script, deprecate script, script lifecycle, manage scripts | pm |
| security-scan | 1.3.0 | active | skills/security-scan/SKILL.md | workspace | security scan, scan for vulnerabilities, security check, run security | pm |
| service-design | 1.1.0 | active | skills/service-design/SKILL.md | workspace | service design, customer journey, service blueprint, touchpoint design, customer experience, service innovation, operational alignment | pm |
| simulate-pipeline | 1.0.2 | active | skills/simulate-pipeline/SKILL.md | workspace | simulate pipeline, simulate project, test scaffolding, dry run project creation, simulate l3 promotion, test l3 pipeline, dry run variant promotion | automation-engineer |
| skill-graph-analytics | 1.4.0 | active | skills/skill-graph-analytics/SKILL.md | workspace | skill-graph analytics, fleet skill graph, skill graph report, skill graph fleet report, skill convergence triage, orphan agent check, orphan skill check | pm |
| skill-lifecycle-manager | 1.5.0 | active | skills/skill-lifecycle-manager/SKILL.md | workspace | create skill, new skill, validate skills, skill lifecycle, manage skills, skill request, deprecate skill, remove skill | pm |
| source-command-commit-push-pr | 1.0.3 | active | skills/source-command-commit-push-pr/SKILL.md | workspace | commit-push-pr, commit and push, create PR | pm |
| standup-synthesizer | 1.1.0 | active | skills/standup-synthesizer/SKILL.md | workspace | standup digest, daily standup, synthesize standup, work summary | pm |
| sync | 1.9.0 | active | skills/sync/SKILL.md | workspace | sync, /sync, commit and push, create PR | pm |
| team-builder | 1.2.0 | active | skills/team-builder/SKILL.md | workspace | build new agent team, create agent team, agent team setup, team builder | pm |
| ticket-run | 1.0.0 | active | skills/ticket-run/SKILL.md | workspace | ticket-run, process ticket queue, run next ticket | automation-engineer |
| token-usage-lint | 1.1.0 | active | skills/token-usage-lint/SKILL.md | workspace | token lint, hardcoded color, design token compliance, raw hex values, hardcoded spacing | pm |
| trail | 1.2.0 | active | skills/trail/SKILL.md | workspace | trail, graft, repo context graph, find where code lives, what calls this symbol, blast radius | pm |
| translate | 1.0.3 | active | skills/translate/SKILL.md | workspace | translate, translation, Korean translation | pm |
| ui-ux-design-intelligence | 1.0.1 | active | skills/ui-ux-design-intelligence/SKILL.md | workspace | design system, ui design, ux design, component design, visual design, design tokens, interface design | pm |
| update-bun-packages | 1.3.1 | active | skills/update-bun-packages/SKILL.md | workspace | update bun packages, upgrade bun packages, bun update, update dependencies, upgrade dependencies | pm |
| upgrade-project | 1.6.2 | active | skills/upgrade-project/SKILL.md | workspace | upgrade project, upgrade template, sync project with template, refresh project, update project infrastructure | pm |
| variant-feature | 1.0.0 | active | skills/variant-feature/SKILL.md | workspace | add feature to variant, extend variant, variant feature, add agent to variant, add skill to variant | scaffolding-expert |
| zod-contract-gate | 1.0.2 | active | skills/zod-contract-gate/SKILL.md | workspace | zod-contract-gate, /zod-contract-gate, zod contract validation, schema contract gate, runtime schema validation | architect |

<!-- validate-md-language:allowlist-end -->

---

## Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
| adopt-project.ts | 1.6.0 | scripts/adopt-project.ts | child_process, crypto, fs, path |
| agent-create.ts | 1.0.1 | scripts/agent-create.ts | fs, path |
| agent-delete.ts | 1.0.1 | scripts/agent-delete.ts | fs, path |
| agent-lifecycle-audit.ts | 1.9.0 | scripts/agent-lifecycle-audit.ts | child_process, fs, path, process |
| agent-list.ts | 1.1.0 | scripts/agent-list.ts | fs, path |
| agent-verify.ts | 1.0.2 | scripts/agent-verify.ts | fs, path |
| analyze-git-history.ts | 1.0.2 | scripts/analyze-git-history.ts | child_process |
| archive-memory.ts | 1.1.0 | scripts/archive-memory.ts | fs, path |
| audit.ts | 2.66.1 | scripts/audit.ts | bun, child_process, crypto, fs, os, path, url |
| auto-release-template.ts | 1.0.0 | scripts/auto-release-template.ts | child_process, fs, path |
| automation-lock.ts | 1.0.0 | scripts/automation-lock.ts | fs, os, path, url |
| backport-diff.ts | 1.3.0 | scripts/backport-diff.ts | child_process, fs, path |
| bootstrap-stages.ts | 1.1.0 | scripts/bootstrap-stages.ts | fs, js-yaml, path |
| changelog-normalize.ts | 1.0.0 | scripts/changelog-normalize.ts | fs |
| check-handbook-archmap-drift.ts | 1.0.0 | scripts/check-handbook-archmap-drift.ts | crypto, fs, path |
| check-upgrade-coverage.ts | 1.0.0 | scripts/check-upgrade-coverage.ts | fs, path |
| check-workspace-hygiene.ts | 1.0.1 | scripts/check-workspace-hygiene.ts | bun |
| cleanup-completed-md.ts | 1.1.0 | scripts/cleanup-completed-md.ts | fs, path |
| clear-pm-approval.ts | 1.0.0 | scripts/clear-pm-approval.ts | fs |
| compile-tokens.ts | 1.3.0 | scripts/compile-tokens.ts | fs, path |
| create-l3-scaffold.ts | 1.20.0 | scripts/create-l3-scaffold.ts | child_process, fs, path, url |
| dependency-audit.ts | 1.1.0 | scripts/dependency-audit.ts | fs, path |
| design-gate-coverage.ts | 1.1.0 | scripts/design-gate-coverage.ts | fs, path |
| design-lint.ts | 2.5.0 | scripts/design-lint.ts | fs, js-yaml, path |
| dev-sync.ts | 1.46.2 | scripts/dev-sync.ts | bun, crypto, fs, path |
| dispatch-parallel.ts | 1.1.1 | scripts/dispatch-parallel.ts | N/A |
| dispatch-serial.ts | 1.1.2 | scripts/dispatch-serial.ts | url |
| dispatch.ts | 1.1.1 | scripts/dispatch.ts | path |
| ensure-github-repo.ts | 1.0.0 | scripts/ensure-github-repo.ts | child_process, fs, path |
| evidence-backport-scan.ts | 1.4.0 | scripts/evidence-backport-scan.ts | child_process, fs, path |
| external-deps.ts | 1.0.0 | scripts/external-deps.ts | fs, path |
| fix-script-versions.ts | 1.1.1 | scripts/fix-script-versions.ts | fs, path |
| fleet-list.ts | 1.0.0 | scripts/fleet-list.ts | path |
| fleet-script-parity.ts | 1.2.0 | scripts/fleet-script-parity.ts | crypto, fs, path |
| gen-pr-body.ts | 1.2.0 | scripts/gen-pr-body.ts | bun, fs |
| generate-ide-rules.ts | 1.0.0 | scripts/generate-ide-rules.ts | fs, path |
| generate-l3-readme.ts | 1.0.3 | scripts/generate-l3-readme.ts | fs, path |
| generate-raci.ts | 1.2.0 | scripts/generate-raci.ts | fs, js-yaml, path |
| generate-scripts-mirror.ts | 1.1.0 | scripts/generate-scripts-mirror.ts | fs, path, url |
| generate-scripts-readme.ts | 1.0.4 | scripts/generate-scripts-readme.ts | fs, path, process |
| generate-skill-graph.ts | 2.0.1 | scripts/generate-skill-graph.ts | child_process, fs, js-yaml, path, url |
| generate-skill-lifecycle-records.ts | 1.1.0 | scripts/generate-skill-lifecycle-records.ts | fs, js-yaml, path, url |
| generate-version-manifest.ts | 1.12.1 | scripts/generate-version-manifest.ts | bun, child_process, fs, js-yaml, module, path |
| graph-delta-log.ts | 1.1.0 | scripts/graph-delta-log.ts | child_process, fs, path, url |
| hub-bootstrap.ts | 1.6.0 | scripts/hub-bootstrap.ts | child_process, crypto, fs, path |
| hub-probe.ts | 1.3.0 | scripts/hub-probe.ts | fs, path |
| hub-promotion.ts | 1.0.1 | scripts/hub-promotion.ts | child_process, fs, os, path, url |
| ingest-external-skills.ts | 1.1.0 | scripts/ingest-external-skills.ts | fs, path |
| ingest-security-frameworks.ts | 1.1.0 | scripts/ingest-security-frameworks.ts | fs, path |
| install-upstream-mcp.ts | 2.2.1 | scripts/install-upstream-mcp.ts | child_process, fs, os, path, url |
| l3-to-variant-pipeline.ts | 1.23.1 | scripts/l3-to-variant-pipeline.ts | child_process, fs, path, process, url |
| lifecycle-sync-audit.ts | 1.21.0 | scripts/lifecycle-sync-audit.ts | crypto, fs, js-yaml, path, process |
| lint-instructions.ts | 1.0.0 | scripts/lint-instructions.ts | fs, path |
| list-template-versions.ts | 1.1.0 | scripts/list-template-versions.ts | bun, path |
| mcp-governance-server.ts | 1.1.0 | scripts/mcp-governance-server.ts | child_process, fs, path, readline, url |
| mcp-upstream-server.ts | 1.15.1 | scripts/mcp-upstream-server.ts | crypto, fs, js-yaml, path, readline, url |
| md-to-ooxml.ts | 1.2.0 | scripts/md-to-ooxml.ts | fs, path |
| migrate-project.ts | 1.1.0 | scripts/migrate-project.ts | child_process, fs, path |
| migrate-quality-gates.ts | 1.1.0 | scripts/migrate-quality-gates.ts | fs, js-yaml, path |
| new-project.ts | 1.44.0 | scripts/new-project.ts | child_process, crypto, fs, os, path |
| normalize-registry-provenance.ts | 1.1.0 | scripts/normalize-registry-provenance.ts | fs, path |
| procedure-coverage.ts | 1.0.0 | scripts/procedure-coverage.ts | fs, js-yaml, path, url |
| project-to-variant.ts | 1.5.0 | scripts/project-to-variant.ts | child_process, fs, path |
| promote-context-section.ts | 1.1.0 | scripts/promote-context-section.ts | fs, path, url |
| propagate-to-templates.ts | 2.23.0 | scripts/propagate-to-templates.ts | child_process, crypto, fs, js-yaml, path |
| qa-gate.ts | 1.3.0 | scripts/qa-gate.ts | bun, crypto |
| readme-lifecycle-audit.ts | 1.1.0 | scripts/readme-lifecycle-audit.ts | fs, path, process |
| regenerate-agents-md.ts | 1.5.0 | scripts/regenerate-agents-md.ts | fs, path |
| release-template.ts | 1.0.0 | scripts/release-template.ts | child_process, fs, path |
| remove-project.ts | 1.0.1 | scripts/remove-project.ts | child_process, fs, path, readline |
| render-commands.ts | 1.1.0 | scripts/render-commands.ts | fs, path |
| render-pdf-deck.ts | 1.0.1 | scripts/render-pdf-deck.ts | fs, path, url |
| resolve-variants.ts | 1.0.3 | scripts/resolve-variants.ts | fs, js-yaml, path |
| resync-audit.ts | 1.9.0 | scripts/resync-audit.ts | child_process, fs, path |
| retry-handler.ts | 1.1.0 | scripts/retry-handler.ts | path |
| review-baseline.ts | 1.6.0 | scripts/review-baseline.ts | N/A |
| route-audit-scan.ts | 1.0.1 | scripts/route-audit-scan.ts | fs, path |
| setup-github-branch-protection.ts | 1.0.1 | scripts/setup-github-branch-protection.ts | bun, fs, os, path |
| skill-dependency-analysis.ts | 1.0.2 | scripts/skill-dependency-analysis.ts | fs, path, process |
| skill-graph-fleet-report.ts | 2.4.0 | scripts/skill-graph-fleet-report.ts | fs, path |
| skill-lifecycle-audit.ts | 1.13.0 | scripts/skill-lifecycle-audit.ts | fs, path, process |
| skill-session-review.ts | 1.3.0 | scripts/skill-session-review.ts | bun, fs, path |
| spec-backfill.ts | 1.0.0 | scripts/spec-backfill.ts | child_process, fs, path |
| spec-hygiene-sweep.ts | 1.0.0 | scripts/spec-hygiene-sweep.ts | fs, path |
| spec-register.ts | 1.6.0 | scripts/spec-register.ts | fs, path |
| sync-agent-mirrors.ts | 1.3.0 | scripts/sync-agent-mirrors.ts | fs, js-yaml, path, url |
| sync-md.ts | 1.4.0 | scripts/sync-md.ts | N/A |
| sync-model-registry.ts | 1.3.0 | scripts/sync-model-registry.ts | fs, path |
| sync-skill-registries.ts | 1.0.0 | scripts/sync-skill-registries.ts | fs, path |
| sync-skill-status.ts | 1.1.0 | scripts/sync-skill-status.ts | child_process, fs, path, process |
| sync-skills-to-l2.ts | 1.0.1 | scripts/sync-skills-to-l2.ts | crypto, fs, path |
| sync-skills.ts | 1.11.0 | scripts/sync-skills.ts | fs, path |
| sync-template-deps.ts | 1.0.1 | scripts/sync-template-deps.ts | fs, path |
| sync-variant-settings.ts | 1.5.0 | scripts/sync-variant-settings.ts | fs, path, url |
| tag-template.ts | 1.2.0 | scripts/tag-template.ts | bun, fs, path |
| team-builder.ts | 1.5.0 | scripts/team-builder.ts | fs, path |
| test-adopt-project.ts | 1.0.0 | scripts/test-adopt-project.ts | child_process, fs, path |
| test-extends-validator.ts | 1.0.1 | scripts/test-extends-validator.ts | fs, path |
| test-l3-to-variant-promotion.ts | 1.7.0 | scripts/test-l3-to-variant-promotion.ts | bun, child_process, fs, path, url |
| test-new-project.ts | 1.11.1 | scripts/test-new-project.ts | bun, fs, js-yaml, path, process |
| test-platform-parity.ts | 0.5.0 | scripts/test-platform-parity.ts | fs, path |
| test-runner.ts | 1.15.0 | scripts/test-runner.ts | fs, os, path |
| test-scaffold-delivery-parity.ts | 1.0.0 | scripts/test-scaffold-delivery-parity.ts | path, url |
| test-variant-readiness.ts | 1.0.0 | scripts/test-variant-readiness.ts | child_process, fs, os, path |
| ticket.ts | 1.16.0 | scripts/ticket.ts | js-yaml, path |
| translate-readme.ts | 1.0.0 | scripts/translate-readme.ts | bun, crypto, fs, path, url |
| typecheck.ts | 1.2.0 | scripts/typecheck.ts | fs, path |
| upgrade-project.ts | 1.103.0 | scripts/upgrade-project.ts | child_process, crypto, fs, path |
| validate-agents.ts | 1.4.1 | scripts/validate-agents.ts | fs, path, process |
| validate-decisions.ts | 1.1.0 | scripts/validate-decisions.ts | fs, js-yaml, path, process |
| validate-doc-folder.ts | 1.3.0 | scripts/validate-doc-folder.ts | fs, path |
| validate-docs-links.ts | 1.6.0 | scripts/validate-docs-links.ts | fs, path |
| validate-md-language.ts | 1.16.1 | scripts/validate-md-language.ts | child_process, fs, path |
| validate-model-registry.ts | 2.3.0 | scripts/validate-model-registry.ts | fs, path, url |
| validate-pm-extends.ts | 0.3.1 | scripts/validate-pm-extends.ts | child_process, fs, path |
| validate-procedures.ts | 1.1.0 | scripts/validate-procedures.ts | fs, js-yaml, path |
| validate-process.ts | 1.0.0 | scripts/validate-process.ts | fs, js-yaml, path |
| validate-raci.ts | 1.2.0 | scripts/validate-raci.ts | fs, js-yaml, path |
| validate-skills.ts | 1.5.2 | scripts/validate-skills.ts | fs, path, process |
| validate-surface-registry.ts | 1.1.2 | scripts/validate-surface-registry.ts | fs, path |
| validate-templates.ts | 1.79.1 | scripts/validate-templates.ts | child_process, fs, js-yaml, path, url |
| validate-ticket-doc-commands.ts | 1.0.1 | scripts/validate-ticket-doc-commands.ts | fs, path, url |
| validate-variant-claims.ts | 1.7.0 | scripts/validate-variant-claims.ts | fs, js-yaml, path, url |
| validate-variant-readiness.ts | 1.1.0 | scripts/validate-variant-readiness.ts | fs, path |
| variant-feature.ts | 1.1.0 | scripts/variant-feature.ts | child_process, fs, path |
| verify-adr-governance.ts | 1.7.0 | scripts/verify-adr-governance.ts | crypto, fs, path, url |
| verify-agent-deliverables.ts | 1.0.1 | scripts/verify-agent-deliverables.ts | fs |
| verify-country-prune.ts | 1.2.0 | scripts/verify-country-prune.ts | child_process, fs, os, path, url |
| verify-memory.ts | 1.2.0 | scripts/verify-memory.ts | fs, path |
| verify-new-project-tests.ts | 1.0.3 | scripts/verify-new-project-tests.ts | fs |
| verify-platform-lifecycle.ts | 1.6.1 | scripts/verify-platform-lifecycle.ts | fs, path |
| verify-readme-sync.ts | 1.5.0 | scripts/verify-readme-sync.ts | bun, crypto, fs, path |
| verify-scripts.ts | 1.14.0 | scripts/verify-scripts.ts | crypto, fs, path |
| verify-skill-graph.ts | 2.0.0 | scripts/verify-skill-graph.ts | fs, path, url |
| verify-skills.ts | 1.5.2 | scripts/verify-skills.ts | fs, path |
| verify-template-integrity.ts | 1.0.0 | scripts/verify-template-integrity.ts | crypto, fs, path |

---

## Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
| changelog | .claude/commands/changelog.md | claude | N/A |
| commit-push-pr | .claude/commands/commit-push-pr.md | claude | N/A |
| gateguard | .claude/commands/gateguard.md | claude | N/A |
| memlog | .claude/commands/memlog.md | claude | N/A |
| new-task | .claude/commands/new-task.md | claude | N/A |
| project-review | .claude/commands/project-review.md | claude | N/A |
| sync | .claude/commands/sync.md | claude | N/A |

---

## Platform Parity Status

**Checked**: Claude (.claude/), Gemini (.gemini/), Antigravity (.agents/), Codex (.codex/ prompts mapping)

- **Commands with parity (gemini mirror)**: 0 / 7
- **Commands with codex prompts mapping**: 0 / 7
- **Skills in all four mirrors**: 0 / 46
- **Skills in claude+gemini only (both)**: 0 / 46 (common-template skills are parity-exempt)

---

## Drift Detection

✅ No drift detected. All components are properly versioned and integrated.
