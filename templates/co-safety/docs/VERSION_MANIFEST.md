# VERSION_MANIFEST.md

**Generated**: 2026-08-28T05:19:59.010Z
**Manifest Version**: 1.0
**Location**: docs\VERSION_MANIFEST.md

---

## Summary

- **Agents**: 4
- **Skills**: 67
- **Scripts**: 15
- **Commands**: 7

---

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| pm | agents/pm.md | N/A | N/A | 2026-08-28 |
| README_ko | agents/README_ko.md | N/A | N/A | 2026-08-28 |
| safety-governance-manager | agents/safety-governance-manager.md | high | opus | 2026-08-28 |
| safety-workflow-manager | agents/safety-workflow-manager.md | high | opus | 2026-08-28 |

---

## Skills

| Name | Version | Status | Location | Platform | Triggers | Owner |
|------|---------|--------|----------|----------|----------|-------|
| agent-lifecycle-manager | 1.0.0 | active | skills/agent-lifecycle-manager/SKILL.md | workspace | create agent, new agent, validate agents, agent lifecycle, manage agents | pm |
| api-documentation | 1.0.0 | active | skills/api-documentation/SKILL.md | workspace | api documentation, document api, api reference, developer documentation, rest api docs, graphql docs, sdk documentation | N/A |
| arc-flash-analyzer | 1.0 | active | .claude/skills/arc-flash-analyzer/SKILL.md | both | 아크 플래시, arc flash, IEEE 1584, 고압 전기 작업, PPE category, incident energy, NFPA 70E, 활선 작업 허가 | powergen-agent |
| asset-integrity-check | 1.0.0 | active | .claude/skills/asset-integrity-check/SKILL.md | both | 설비무결성, asset integrity, 정기점검 일정, preventive maintenance, 압력용기 검사, NDT 검사, 배관 건전성, mechanical integrity | asset-integrity-agent |
| audit-preparation | 1.0.0 | active | .claude/skills/audit-preparation/SKILL.md | both | 감사 준비, audit preparation, 규제 감사, OSHA-KR 감사, 중대재해처벌법 감사 대응, 증적자료 취합, regulatory inspection readiness | audit-agent |
| benefit-risk-assessor | 1.0 | active | .claude/skills/benefit-risk-assessor/SKILL.md | both | 편익위해평가, benefit-risk assessment, PrOACT-URL, BRAT, MCDA, 위해편익 균형, PBRER 재평가, RMP 재평가 | gvp-agent |
| bsl-lab-aerosol-control-planner | 1.0 | active | .claude/skills/bsl-lab-aerosol-control-planner/SKILL.md | both | BSL-2 BSL-3 실험실 에어로졸, bsl lab bioaerosol control, 생물안전캐비닛 BSC 작업, biological safety cabinet certification, 원심분리 에어로졸 밀폐, centrifuge sealed cup aerosol, 샤프스 재해 예방, sharps injury prevention needlestick, BSA Article 13 IRB 심의, LMO법 Article 22 밀폐관리, 생물유해인자 취급 작업, biohazard agent lab practice | biotech-agent |
| chemical-risk-assessment | 1.1 | active | .claude/skills/chemical-risk-assessment/SKILL.md | both | 화학물질 위험성평가, chemical risk assessment, 노출평가, exposure assessment, RCR, 허용기준 초과, OEL DNEL, 신규화학물질 도입승인 | msds-agent |
| coke-oven-pah-heat-stress-planner | 1.0 | active | .claude/skills/coke-oven-pah-heat-stress-planner/SKILL.md | both | 코크스로 작업 PAH 발암물질, coke oven PAH carcinogen, 코올타르피치 휘발성 유기화합물, coal tar pitch volatile CTPV, 노정 극고온 열스트레스, oven top heat stress steelmaking, 코크스로 가스 누출, coke oven gas leak, IARC Group 1 코크스 배출물, IARC Group 1 coke oven emissions, OSHA-KR Article 125 작업환경측정, OSHA-KR Article 130 특수건강진단, DSSMA Article 5 코크스 위험물, 특수건강진단 코크스로 작업자 | steelmaking-agent |
| completion-inspection | 1.0.0 | active | .claude/skills/completion-inspection/SKILL.md | both | completion inspection, final inspection, permit issuance, 완성검사, 최종검사, 사용전검사 | gasterm-agent |
| compliance-gap | 1.0.0 | active | .claude/skills/compliance-gap/SKILL.md | both | 컴플라이언스 갭, compliance gap, 준법 감시, 법률 검토, regulatory compliance, 규제 준수, 법적 요건, legal requirement review | compliance-agent |
| construction-permit-overview | 1.0.0 | active | .claude/skills/construction-permit-overview/SKILL.md | both | construction permit, permit lifecycle, gas terminal construction, KGS inspection, 가스시설 공사, 공사허가, 검사일정, 건설인허가 | gasterm-agent |
| contractor-onboarding | 1.0.0 | active | .claude/skills/contractor-onboarding/SKILL.md | both | 협력업체 온보딩, contractor onboarding, 도급업체 안전교육, 협력업체 자격심사, site access approval, 안전교육 이수확인, 도급 안전관리 | contractor-safety-agent |
| cosmetics-solvent-exposure-monitor | 1.0 | active | .claude/skills/cosmetics-solvent-exposure-monitor/SKILL.md | both | 화장품 용제 노출, cosmetics solvent exposure, ethanol IPA inhalation, 에탄올 이소프로판올 흡입 노출, volatile raw material monitoring, OEL exposure assessment cosmetics, ventilation verification 향료 솔벤트, biological monitoring cosmetics, respirator selection 유기용제, OSHA-KR Article 110 (MSDS 작성·제출) | cosmetics-agent |
| dangerous-cargo-handling-planner | 1.0 | active | .claude/skills/dangerous-cargo-handling-planner/SKILL.md | both | 항만 위험물 하역 안전, IMDG dangerous cargo handling, 위험물 컨테이너 적치, dangerous goods container stowage, IMDG 클래스 분류, IMDG class segregation, 유독가스 흡입 노출 항만, toxic gas inhalation port, 항만하역 위험물 누출 대응, PSSA Article 8 위험물 하역, DSSMA Article 20 위험물 운반, IMDG EmS MFAG response | logistics-agent |
| documentation-writing | 1.0.0 | active | skills/documentation-writing/SKILL.md | workspace | write documentation, create guide, draft communication, write manual, create tutorial, documentation, technical writing | N/A |
| dts-verification | 1.0 | active | .claude/skills/dts-verification/SKILL.md | both | DTS 바코드 검증, DTS verification, 의약품 유통관리, RFID 검증, MFDS DTS센터, 위변조 의약품 조사, GS1 데이터매트릭스 | gdp-agent |
| emergency-response | 1.0.1 | active | .claude/skills/emergency-response/SKILL.md | both | 비상사태, emergency, 사고 발생, 화재, 폭발, 누출, 중대재해, serious accident, explosion | emergency-agent |
| environmental-compliance-checker | 1.0 | active | .claude/skills/environmental-compliance-checker/SKILL.md | both | 환경 배출 기준, 대기오염물질 배출허용기준, SOx NOx VOC, 수질오염물질, BOD COD, 환경보전법 준수, 배출 규제 준수, environmental discharge compliance | ehschem-agent |
| ess-fire-risk-assessor | 1.0 | active | .claude/skills/ess-fire-risk-assessor/SKILL.md | both | ESS 화재, 리튬이온 배터리 화재, thermal runaway, 열폭주, BMS 안전, energy storage system fire, MPSL 인증, 에너지저장장치 화재위험 | powergen-agent |
| fall-hazard-assessor | 1.0 | active | .claude/skills/fall-hazard-assessor/SKILL.md | both | 추락 위해평가, fall hazard, leading edge, 안전대 활동제한장치, 방호 계층, fall protection hierarchy, 추락방지망, rescue plan 구조 계획 | ehsconst-agent |
| finishing-a-development-branch | 1.0.0 | active | skills/finishing-a-development-branch/SKILL.md | workspace | finish branch, complete work, wrap up, finishing a development branch, merge branch, create PR, push and PR | N/A |
| gas-dispersion-analyzer | 1.0 | active | .claude/skills/gas-dispersion-analyzer/SKILL.md | both | 가스 확산 모델, gas dispersion, 가스 누출 시나리오, LNG LPG 누출, 수소 누출 확산, BLEVE, 대피 반경 산정, Gaussian dispersion model | gasterm-agent |
| ghs-classifier | 1.0 | active | .claude/skills/ghs-classifier/SKILL.md | both | GHS 분류, GHS classification, 유해성 분류, H-Statement, 위험문구, 예방조치문구, P-Statement, GHS Rev 9 | msds-agent |
| glp-data-integrity-checker | 1.0 | active | .claude/skills/glp-data-integrity-checker/SKILL.md | both | ALCOA+, data integrity, 데이터 무결성, GLP 원시자료, raw data, OECD GLP Section 9, 감사증적, audit trail | glp-agent |
| glp-study-protocol-validator | 1.0 | active | .claude/skills/glp-study-protocol-validator/SKILL.md | both | 시험계획서 검증, study protocol validation, GLP protocol, OECD GLP Section 8, 시험책임자, Study Director, 시험물질 특성, 보존기간 3년 | glp-agent |
| gmp-change-control | 1.0 | active | .claude/skills/gmp-change-control/SKILL.md | both | gmp change control, change control, 변경관리, 품질변경, gmp change | gmp-agent |
| gmp-deviation-capa | 1.0 | active | .claude/skills/gmp-deviation-capa/SKILL.md | both | gmp deviation, gmp capa, deviation, 이상관리, 시정예방조치, oos, out of specification | gmp-agent |
| gmp-qrm | 1.0 | active | .claude/skills/gmp-qrm/SKILL.md | both | quality risk management, qrm, fmea, risk assessment, 품질위해관리, 위해관리 | gmp-agent |
| hazop-analysis | 1.1.0 | active | .claude/skills/hazop-analysis/SKILL.md | both | HAZOP 분석, HAZOP analysis, 공정위험성평가, guideword 분석, process hazard analysis, PHA, 이상 시나리오 도출 | psm-agent |
| hv-cell-formation-electrical-safety-planner | 1.0 | active | .claude/skills/hv-cell-formation-electrical-safety-planner/SKILL.md | both | 배터리 셀 화성 고전압 안전, cell formation electrical safety, 이차전지 충전 에이징 감전, ESS charge discharge arc flash, formation charger grounding, 배터리 busbar LOTO, 전기안전관리자 선임 배터리, ESCA Article 16 전기재해 예방, ESCA Article 22 battery safety manager, 산업안전보건법 Article 38 안전조치 + 안전보건기준에관한규칙 전기 기준, aging room thermal interlock, DC arc flash battery | battery-agent |
| iso14971-risk-scorer | 1.1 | active | .claude/skills/iso14971-risk-scorer/SKILL.md | both | ISO 14971, 위해 추정, risk estimation, 심각도 발생확률 매트릭스, severity probability matrix, 잔여위험, residual risk, ALARP | meddevice-agent |
| landfill-methane-anaerobic-explosion-planner | 1.0 | active | .claude/skills/landfill-methane-anaerobic-explosion-planner/SKILL.md | both | 매립지 메탄 가스 폭발, landfill methane CH4 explosion, 혐기소화 소화조 biogas, anaerobic digestion biogas, 침출수 화학적 위해, leachate chemical hazard landfill, 사면 붕괴 매립지, landfill slope collapse, 매립지 깊은 화재 소방, deep seated landfill fire, 가스 추출정 LEL 모니터링, gas extraction well LEL monitoring, WCA Article 25 폐기물처리업 허가, BFS Article 16 소방활동, Sudokwon Landfill safety | waste-agent |
| meeting-facilitation | 1.5.0 | active | skills/meeting-facilitation/SKILL.md | workspace | meeting, agent discussion, collaborative decision, multi-agent coordination, facilitate meeting | pm |
| mid-construction-inspection | 1.0.0 | active | .claude/skills/mid-construction-inspection/SKILL.md | both | mid-construction inspection, construction inspection, 중간검사, 공사검사, 현장검사 | gasterm-agent |
| msds-parser | 1.0 | active | .claude/skills/msds-parser/SKILL.md | both | MSDS 파싱, MSDS parser, SDS 16항목, 물질안전보건자료, GHS 16-section, msds-record.json, 공급자 MSDS 양식 | msds-agent |
| munitions-magazine-storage-safety-planner | 1.0 | active | .claude/skills/munitions-magazine-storage-safety-planner/SKILL.md | both | 탄약 마가진 저장 안전, munitions magazine storage safety, 화약류 안전거리 Q-D, quantity-distance siting explosives, 호환성 그룹 분리 저장, compatibility group segregation, UN hazard division 1.1 1.2 1.3, sympathetic detonation prevention, 화약류안전관리자 선임, FSESA Article 23 explosives safety manager, 마가진 낙뢰 정전기 대책, magazine lightning protection | defense-agent |
| painting-coating-fire-toxic-planner | 1.0 | active | .claude/skills/painting-coating-fire-toxic-planner/SKILL.md | both | 조선 도장 작업 화재 폭발, ship painting coating fire, 선박 도료 가연성 증기 LEL, paint vapor LEL explosion shipyard, 유기용제 흡입 노출 도장, solvent vapor inhalation painting, 도장 베이 화재 대응, paint bay fire response, 밀폐구역 도장 산소결핍, confined area painting O2 deficiency, DSSMA Article 5 도장 위험물, DSSMA Article 27 응급조치, OSHA-KR Article 110 물질안전보건자료(MSDS) 작성·제출, SAPA Article 5 도급 사업주 | shipbuilding-agent |
| permit-to-work | 1.0.1 | active | .claude/skills/permit-to-work/SKILL.md | both | 작업허가서, permit to work, PTW, hot work permit, 화기작업, 밀폐공간작업, confined space | safety-workflow-manager |
| platform-command-lifecycle-manager | 1.0.0 | active | skills/platform-command-lifecycle-manager/SKILL.md | workspace | create platform command, new .claude command, new .gemini command, platform command lifecycle, command parity, propagate command | pm |
| platform-skill-lifecycle-manager | 1.0.0 | active | skills/platform-skill-lifecycle-manager/SKILL.md | workspace | create platform skill, new .claude skill, new .gemini skill, platform skill version, platform skill lifecycle, update platform skill | pm |
| pre-construction-technical-review | 1.0.0 | active | .claude/skills/pre-construction-technical-review/SKILL.md | both | pre-construction review, technical review, design review, 시설기준 검토, 기술검토, 설계검토, 사전기술검토 | gasterm-agent |
| process-hazard-screening | 1.0 | active | .claude/skills/process-hazard-screening/SKILL.md | both | PSM 적용대상, process hazard screening, 위해물질 보유량, 공정안전관리, PHA 대상 여부, 사고대비물질, 화학공장 초기 위해평가 | ehschem-agent |
| project-review | 1.1.0 | active | skills/project-review/SKILL.md | workspace | project review, review project, audit project, quality review | pm |
| protocol-deviation-analyzer | 1.0 | active | .claude/skills/protocol-deviation-analyzer/SKILL.md | both | 프로토콜 이탈, protocol deviation, ICH E6(R3), important deviation, CAPA, IRB 보고, KGCP, 임상시험 이탈 | gcp-agent |
| psm-loto | 1.0.0 | active | .claude/skills/psm-loto/SKILL.md | both | loto, lockout, tagout, lock out, tag out, energy isolation, 에너지 차단, 로크아웃, 태그아웃 | psm-agent |
| psm-moc | 1.0 | active | .claude/skills/psm-moc/SKILL.md | both | management of change, moc, change management, process change, 변경관리, 공정변경 | psm-agent |
| pyrophoric-gas-emergency-responder | 1.0 | active | .claude/skills/pyrophoric-gas-emergency-responder/SKILL.md | both | 실란 가스 누출, silane gas leak, pyrophoric gas emergency, 발화성 가스 사고, arsine phosphine diborane leak, special gas cabinet emergency, gas alarm response fab, 고압가스 사고 응급조치, HPGSCA Article 26, sub-fab evacuation | semicon-agent |
| rack-fall-protection-planner | 1.0 | active | .claude/skills/rack-fall-protection-planner/SKILL.md | both | 데이터센터 추락 방지, 서버 랙 설치 작업, rack install fall protection, overhead cabling work-at-height, top-of-rack 작업, 제상플로어 접근, raised-floor tile handling, datacenter work-at-height plan, 랙 설치 사다리 선택, rack anchor point rating | datacenter-agent |
| research-analysis | 1.0.0 | active | skills/research-analysis/SKILL.md | workspace | research, analyze, investigate, synthesize, evidence gathering, data analysis, literature review | N/A |
| risk-assessment | 1.0.0 | active | .claude/skills/risk-assessment/SKILL.md | both | 위험성평가, risk assessment, hazard identification, 위험 평가, 작업위험성분석 | risk-assessment-agent |
| rolling-stock-maintenance-loto-planner | 1.0 | active | .claude/skills/rolling-stock-maintenance-loto-planner/SKILL.md | both | 철도 차량사업소 차량 정비 LOTO, rolling stock depot maintenance, EMU 객차 정비 차량 이동 잠금, rolling stock vehicle movement lockout, bogey 대차 리프팅 크레인, bogey heavy lift rigging, 밑바닥 pit 작업 차량 압사, undercarriage pit work crush, 차량 지붕 추락 방지, roof fall prevention rolling stock, 철도 안전관리자 정비 허가, RSA Article 48 철도 보호, OSHA-KR Article 38 추락 방지 포함 안전조치 (전차선), wheel chock derail brake scotch | railway-agent |
| root-cause-analysis | 1.0.0 | active | .claude/skills/root-cause-analysis/SKILL.md | both | 근본원인분석, root cause analysis, RCA, 5 whys, fishbone diagram, 사고조사, CAPA 수립 | incident-investigation-agent |
| sae-causality-assessor | 1.0 | active | .claude/skills/sae-causality-assessor/SKILL.md | both | SAE 인과성 평가, causality assessment, ImPACT, WHO-UMC, Naranjo algorithm, ICH E2A, 중대이상반응 인과관계, 이상반응 인과성 | gcp-agent |
| safety-inspection-validator | 1.0 | active | .claude/skills/safety-inspection-validator/SKILL.md | both | 안전점검 결과 검증, safety inspection findings, 지적사항 분류, CAPA, 시정조치, Critical Major Minor 분류, 건설 안전점검 | ehsconst-agent |
| script-lifecycle-manager | 1.2.0 | active | skills/script-lifecycle-manager/SKILL.md | workspace | create script, update script, deprecate script, script lifecycle, manage scripts | pm |
| signal-detector | 1.0 | active | .claude/skills/signal-detector/SKILL.md | both | 시그널 탐지, signal detection, PRR, ROR, BCPNN, EBGM, 부작용 신호, disproportionality analysis | gvp-agent |
| simulate-project-creation | 1.0.0 | active | skills/simulate-project-creation/SKILL.md | workspace | simulate project, test scaffolding, dry run project creation | scaffolding-expert |
| skill-lifecycle-manager | 1.2.0 | active | skills/skill-lifecycle-manager/SKILL.md | workspace | create skill, new skill, validate skills, skill lifecycle, manage skills | pm |
| sync | 1.1.0 | active | skills/sync/SKILL.md | workspace | sync, commit and push, create PR, push changes | pm |
| tank-integrity-validator | 1.0 | active | .claude/skills/tank-integrity-validator/SKILL.md | both | 저장탱크 건전성, tank integrity, LNG 탱크 검사, 수소 취성, hydrogen embrittlement, KGS 코드, 압력용기 검사, 부식 피로 검증 | gasterm-agent |
| tar-planning | 1.1.0 | active | .claude/skills/tar-planning/SKILL.md | both | turnaround, tar, tar planning, shutdown planning, 정기보수, 가동중지, 보수정비, 대정비 | ehschem-agent |
| team-builder | 1.1.0 | active | skills/team-builder/SKILL.md | workspace | 새 팀 구성, 에이전트팀 변경, 신규 도메인 팀 빌딩, build new agent team, agent team benchmarking, team proposal generation, consulting team design | pm |
| temperature-excursion-analyzer | 1.0 | active | .claude/skills/temperature-excursion-analyzer/SKILL.md | both | 온도이탈, temperature excursion, 콜드체인, cold chain, GDP 온도관리, 냉장유통, excursion event, 안정성 데이터 검토 | gdp-agent |
| thermal-burn-prevention-planner | 1.0 | active | .claude/skills/thermal-burn-prevention-planner/SKILL.md | both | 식품공장 화상 예방, 튀김기 화재 위험, cooking-oil fire risk, industrial fryer safety, thermal burn prevention food, steam line LOTO, 조리유 과열 방지, hot surface PPE, Class F Class K fire, 식품 제조 열 설비 | food-agent |
| tool-box-meeting | 1.0.0 | active | .claude/skills/tool-box-meeting/SKILL.md | both | TBM, Tool Box Meeting, Toolbox Meeting, 안전점검회의, 작업 전 안전회의, 작업전 안전회의, 오늘 TBM, 작업 전 안전점검, pre-work briefing, daily safety briefing | safety-workflow-manager |
| translate | 1.0.0 | active | skills/translate/SKILL.md | workspace | translate, translation, localize, Korean translation | pm |

---

## Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
| audit-variant.ts | 1.0.0 | scripts/co-safety/audit-variant.ts | bun |
| check-pm-approval.ts | 1.0.1 | scripts/co-safety/check-pm-approval.ts | N/A |
| domain-config.ts | 1.5.0 | scripts/co-safety/domain-config.ts | N/A |
| migrate-registry-to-coordinates.ts | N/A | scripts/co-safety/migrate-registry-to-coordinates.ts | js-yaml |
| new-domain.ts | 1.0.1 | scripts/co-safety/new-domain.ts | N/A |
| risk-register-rollup.ts | 1.0.0 | scripts/co-safety/risk-register-rollup.ts | N/A |
| safety-audit.ts | 4.10.1 | scripts/co-safety/safety-audit.ts | js-yaml |
| scaffold-industry.ts | 0.1.1 | scripts/co-safety/scaffold-industry.ts | js-yaml |
| start-mcp.ts | 1.0.0 | scripts/co-safety/start-mcp.ts | child_process, path |
| test-chemical-handling-profile.ts | 1.0.0 | scripts/co-safety/test-chemical-handling-profile.ts | js-yaml |
| test-cross-domain-integration.ts | 1.0.0 | scripts/co-safety/test-cross-domain-integration.ts | js-yaml |
| test-domain-scenarios.ts | 1.1.0 | scripts/co-safety/test-domain-scenarios.ts | N/A |
| test-pharma-general-profile.ts | 1.0.0 | scripts/co-safety/test-pharma-general-profile.ts | js-yaml |
| test-runtime-tools.ts | 1.0.0 | scripts/co-safety/test-runtime-tools.ts | N/A |
| training-ingest.ts | 1.0.0 | scripts/co-safety/training-ingest.ts | N/A |

---

## Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
| changelog | .claude/commands/changelog.md | both | N/A |
| commit-push-pr | .claude/commands/commit-push-pr.md | both | N/A |
| meeting | .claude/commands/meeting.md | both | N/A |
| memlog | .claude/commands/memlog.md | both | N/A |
| new-task | .claude/commands/new-task.md | both | N/A |
| project-review | .claude/commands/project-review.md | both | N/A |
| sync | .claude/commands/sync.md | both | N/A |

---

## Platform Parity Status

**Checked**: Claude (.claude/) vs Gemini (.gemini/)

- **Commands with parity**: 7 / 7
- **Skills with parity**: 52 / 67

---

## Drift Detection

⚠️ **Drift detected**:

- [WARNING] Agent pm missing tier or model metadata
- [WARNING] Agent README_ko missing tier or model metadata
- [WARNING] Command commit-push-pr has no matching skill of the same name
- [WARNING] Command meeting has no matching skill of the same name
