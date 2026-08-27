# VERSION_MANIFEST.md

**Generated**: 2026-08-26T16:59:25.255Z
**Manifest Version**: 1.0
**Location**: docs\VERSION_MANIFEST.md

---

## Summary

- **Agents**: 40
- **Skills**: 78
- **Scripts**: 61
- **Commands**: 7

---

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| _core/pm | agents/_core/pm.md | high | opus | 2026-08-23 |
| _core/safety-governance-manager | agents/_core/safety-governance-manager.md | high | opus | 2026-08-24 |
| _core/safety-workflow-manager | agents/_core/safety-workflow-manager.md | high | opus | 2026-08-19 |
| _shared/asset-integrity-agent | agents/_shared/asset-integrity-agent.md | medium | sonnet | 2026-08-23 |
| _shared/audit-agent | agents/_shared/audit-agent.md | medium | sonnet | 2026-08-23 |
| _shared/compliance-agent | agents/_shared/compliance-agent.md | medium | sonnet | 2026-08-23 |
| _shared/contractor-safety-agent | agents/_shared/contractor-safety-agent.md | medium | sonnet | 2026-08-23 |
| _shared/disaster-response-agent | agents/_shared/disaster-response-agent.md | high | opus | 2026-08-23 |
| _shared/docs-writer | agents/_shared/docs-writer.md | medium | sonnet | 2026-08-19 |
| _shared/emergency-agent | agents/_shared/emergency-agent.md | high | opus | 2026-08-24 |
| _shared/incident-investigation-agent | agents/_shared/incident-investigation-agent.md | medium | sonnet | 2026-08-23 |
| _shared/legal-agent | agents/_shared/legal-agent.md | medium | sonnet | 2026-08-23 |
| _shared/occupational-health-agent | agents/_shared/occupational-health-agent.md | medium | sonnet | 2026-08-23 |
| _shared/reporting-agent | agents/_shared/reporting-agent.md | medium | sonnet | 2026-08-19 |
| _shared/risk-assessment-agent | agents/_shared/risk-assessment-agent.md | medium | sonnet | 2026-08-23 |
| domains/functional/msds/msds-agent | agents/domains/functional/msds/msds-agent.md | medium | sonnet | 2026-08-24 |
| domains/functional/psm/psm-agent | agents/domains/functional/psm/psm-agent.md | medium | sonnet | 2026-08-24 |
| domains/functional/training/training-agent | agents/domains/functional/training/training-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/battery/battery-agent | agents/domains/industry/battery/battery-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/biotech/biotech-agent | agents/domains/industry/biotech/biotech-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/cosmetics/cosmetics-agent | agents/domains/industry/cosmetics/cosmetics-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/datacenter/datacenter-agent | agents/domains/industry/datacenter/datacenter-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/defense/defense-agent | agents/domains/industry/defense/defense-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/ehschem/ehschem-agent | agents/domains/industry/ehschem/ehschem-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/ehsconst/ehsconst-agent | agents/domains/industry/ehsconst/ehsconst-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/food/food-agent | agents/domains/industry/food/food-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/gasterm/gasterm-agent | agents/domains/industry/gasterm/gasterm-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/gcp/gcp-agent | agents/domains/industry/gcp/gcp-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/gdp/gdp-agent | agents/domains/industry/gdp/gdp-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/glp/glp-agent | agents/domains/industry/glp/glp-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/gmp/gmp-agent | agents/domains/industry/gmp/gmp-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/gvp/gvp-agent | agents/domains/industry/gvp/gvp-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/logistics/logistics-agent | agents/domains/industry/logistics/logistics-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/meddevice/meddevice-agent | agents/domains/industry/meddevice/meddevice-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/powergen/powergen-agent | agents/domains/industry/powergen/powergen-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/railway/railway-agent | agents/domains/industry/railway/railway-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/semicon/semicon-agent | agents/domains/industry/semicon/semicon-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/shipbuilding/shipbuilding-agent | agents/domains/industry/shipbuilding/shipbuilding-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/steelmaking/steelmaking-agent | agents/domains/industry/steelmaking/steelmaking-agent.md | medium | sonnet | 2026-08-24 |
| domains/industry/waste/waste-agent | agents/domains/industry/waste/waste-agent.md | medium | sonnet | 2026-08-24 |

---

## Skills

| Name | Version | Location | Platform | Triggers | Owner |
|------|---------|----------|----------|----------|-------|
| agent-lifecycle-manager | 1.0.0 | skills/agent-lifecycle-manager/SKILL.md | workspace | create agent, new agent, validate agents, agent lifecycle, manage agents | pm |
| agent-lifecycle-manager | 1.0.0 | .claude/skills/agent-lifecycle-manager/SKILL.md | both | create agent, new agent, validate agents, agent lifecycle, manage agents | pm |
| api-documentation | 1.0.0 | .claude/skills/api-documentation/SKILL.md | both | api documentation, document api, api reference, developer documentation, rest api docs, graphql docs, sdk documentation | N/A |
| arc-flash-analyzer | 1.0 | .claude/skills/arc-flash-analyzer/SKILL.md | both | 아크 플래시, arc flash, IEEE 1584, 고압 전기 작업, PPE category, incident energy, NFPA 70E, 활선 작업 허가 | powergen-agent |
| asset-integrity-check | 1.0.0 | .claude/skills/asset-integrity-check/SKILL.md | both | 설비무결성, asset integrity, 정기점검 일정, preventive maintenance, 압력용기 검사, NDT 검사, 배관 건전성, mechanical integrity | asset-integrity-agent |
| audit-preparation | 1.0.0 | .claude/skills/audit-preparation/SKILL.md | both | 감사 준비, audit preparation, 규제 감사, OSHA-KR 감사, 중대재해처벌법 감사 대응, 증적자료 취합, regulatory inspection readiness | audit-agent |
| benefit-risk-assessor | 1.0 | .claude/skills/benefit-risk-assessor/SKILL.md | both | 편익위해평가, benefit-risk assessment, PrOACT-URL, BRAT, MCDA, 위해편익 균형, PBRER 재평가, RMP 재평가 | gvp-agent |
| bsl-lab-aerosol-control-planner | 1.0 | .claude/skills/bsl-lab-aerosol-control-planner/SKILL.md | both | BSL-2 BSL-3 실험실 에어로졸, bsl lab bioaerosol control, 생물안전캐비닛 BSC 작업, biological safety cabinet certification, 원심분리 에어로졸 밀폐, centrifuge sealed cup aerosol, 샤프스 재해 예방, sharps injury prevention needlestick, BSA Article 13 IRB 심의, LMO법 Article 22 밀폐관리, 생물유해인자 취급 작업, biohazard agent lab practice | biotech-agent |
| chemical-risk-assessment | 1.1 | .claude/skills/chemical-risk-assessment/SKILL.md | both | 화학물질 위험성평가, chemical risk assessment, 노출평가, exposure assessment, RCR, 허용기준 초과, OEL DNEL, 신규화학물질 도입승인 | msds-agent |
| coke-oven-pah-heat-stress-planner | 1.0 | .claude/skills/coke-oven-pah-heat-stress-planner/SKILL.md | both | 코크스로 작업 PAH 발암물질, coke oven PAH carcinogen, 코올타르피치 휘발성 유기화합물, coal tar pitch volatile CTPV, 노정 극고온 열스트레스, oven top heat stress steelmaking, 코크스로 가스 누출, coke oven gas leak, IARC Group 1 코크스 배출물, IARC Group 1 coke oven emissions, OSHA-KR Article 125 작업환경측정, OSHA-KR Article 130 특수건강진단, DSSMA Article 5 코크스 위험물, 특수건강진단 코크스로 작업자 | steelmaking-agent |
| completion-inspection | 1.0.0 | .claude/skills/completion-inspection/SKILL.md | both | completion inspection, final inspection, permit issuance, 완성검사, 최종검사, 사용전검사 | gasterm-agent |
| compliance-gap | 1.0.0 | .claude/skills/compliance-gap/SKILL.md | both | 컴플라이언스 갭, compliance gap, 준법 감시, 법률 검토, regulatory compliance, 규제 준수, 법적 요건, legal requirement review | compliance-agent |
| construction-permit-overview | 1.0.0 | .claude/skills/construction-permit-overview/SKILL.md | both | construction permit, permit lifecycle, gas terminal construction, KGS inspection, 가스시설 공사, 공사허가, 검사일정, 건설인허가 | gasterm-agent |
| contractor-onboarding | 1.0.0 | .claude/skills/contractor-onboarding/SKILL.md | both | 협력업체 온보딩, contractor onboarding, 도급업체 안전교육, 협력업체 자격심사, site access approval, 안전교육 이수확인, 도급 안전관리 | contractor-safety-agent |
| cosmetics-solvent-exposure-monitor | 1.0 | .claude/skills/cosmetics-solvent-exposure-monitor/SKILL.md | both | 화장품 용제 노출, cosmetics solvent exposure, ethanol IPA inhalation, 에탄올 이소프로판올 흡입 노출, volatile raw material monitoring, OEL exposure assessment cosmetics, ventilation verification 향료 솔벤트, biological monitoring cosmetics, respirator selection 유기용제, OSHA-KR Article 110 (MSDS 작성·제출) | cosmetics-agent |
| dangerous-cargo-handling-planner | 1.0 | .claude/skills/dangerous-cargo-handling-planner/SKILL.md | both | 항만 위험물 하역 안전, IMDG dangerous cargo handling, 위험물 컨테이너 적치, dangerous goods container stowage, IMDG 클래스 분류, IMDG class segregation, 유독가스 흡입 노출 항만, toxic gas inhalation port, 항만하역 위험물 누출 대응, PSSA Article 8 위험물 하역, DSSMA Article 20 위험물 운반, IMDG EmS MFAG response | logistics-agent |
| documentation-writing | 1.0.0 | .claude/skills/documentation-writing/SKILL.md | both | write documentation, create guide, draft communication, write manual, create tutorial, documentation, technical writing | N/A |
| dts-verification | 1.0 | .claude/skills/dts-verification/SKILL.md | both | DTS 바코드 검증, DTS verification, 의약품 유통관리, RFID 검증, MFDS DTS센터, 위변조 의약품 조사, GS1 데이터매트릭스 | gdp-agent |
| emergency-response | 1.0.1 | .claude/skills/emergency-response/SKILL.md | both | 비상사태, emergency, 사고 발생, 화재, 폭발, 누출, 중대재해, serious accident, explosion | emergency-agent |
| environmental-compliance-checker | 1.0 | .claude/skills/environmental-compliance-checker/SKILL.md | both | 환경 배출 기준, 대기오염물질 배출허용기준, SOx NOx VOC, 수질오염물질, BOD COD, 환경보전법 준수, 배출 규제 준수, environmental discharge compliance | ehschem-agent |
| ess-fire-risk-assessor | 1.0 | .claude/skills/ess-fire-risk-assessor/SKILL.md | both | ESS 화재, 리튬이온 배터리 화재, thermal runaway, 열폭주, BMS 안전, energy storage system fire, MPSL 인증, 에너지저장장치 화재위험 | powergen-agent |
| fall-hazard-assessor | 1.0 | .claude/skills/fall-hazard-assessor/SKILL.md | both | 추락 위해평가, fall hazard, leading edge, 안전대 활동제한장치, 방호 계층, fall protection hierarchy, 추락방지망, rescue plan 구조 계획 | ehsconst-agent |
| finishing-a-development-branch | 1.0.0 | .claude/skills/finishing-a-development-branch/SKILL.md | both | finish branch, complete work, wrap up, finishing a development branch, merge branch, create PR, push and PR | N/A |
| gas-dispersion-analyzer | 1.0 | .claude/skills/gas-dispersion-analyzer/SKILL.md | both | 가스 확산 모델, gas dispersion, 가스 누출 시나리오, LNG LPG 누출, 수소 누출 확산, BLEVE, 대피 반경 산정, Gaussian dispersion model | gasterm-agent |
| ghs-classifier | 1.0 | .claude/skills/ghs-classifier/SKILL.md | both | GHS 분류, GHS classification, 유해성 분류, H-Statement, 위험문구, 예방조치문구, P-Statement, GHS Rev 9 | msds-agent |
| glp-data-integrity-checker | 1.0 | .claude/skills/glp-data-integrity-checker/SKILL.md | both | ALCOA+, data integrity, 데이터 무결성, GLP 원시자료, raw data, OECD GLP Section 9, 감사증적, audit trail | glp-agent |
| glp-study-protocol-validator | 1.0 | .claude/skills/glp-study-protocol-validator/SKILL.md | both | 시험계획서 검증, study protocol validation, GLP protocol, OECD GLP Section 8, 시험책임자, Study Director, 시험물질 특성, 보존기간 3년 | glp-agent |
| gmp-change-control | 1.0 | .claude/skills/gmp-change-control/SKILL.md | both | gmp change control, change control, 변경관리, 품질변경, gmp change | gmp-agent |
| gmp-deviation-capa | 1.0 | .claude/skills/gmp-deviation-capa/SKILL.md | both | gmp deviation, gmp capa, deviation, 이상관리, 시정예방조치, oos, out of specification | gmp-agent |
| gmp-qrm | 1.0 | .claude/skills/gmp-qrm/SKILL.md | both | quality risk management, qrm, fmea, risk assessment, 품질위해관리, 위해관리 | gmp-agent |
| hazop-analysis | 1.1.0 | .claude/skills/hazop-analysis/SKILL.md | both | HAZOP 분석, HAZOP analysis, 공정위험성평가, guideword 분석, process hazard analysis, PHA, 이상 시나리오 도출 | psm-agent |
| hv-cell-formation-electrical-safety-planner | 1.0 | .claude/skills/hv-cell-formation-electrical-safety-planner/SKILL.md | both | 배터리 셀 화성 고전압 안전, cell formation electrical safety, 이차전지 충전 에이징 감전, ESS charge discharge arc flash, formation charger grounding, 배터리 busbar LOTO, 전기안전관리자 선임 배터리, ESCA Article 16 전기재해 예방, ESCA Article 22 battery safety manager, 산업안전보건법 Article 38 안전조치 + 안전보건기준에관한규칙 전기 기준, aging room thermal interlock, DC arc flash battery | battery-agent |
| iso14971-risk-scorer | 1.1 | .claude/skills/iso14971-risk-scorer/SKILL.md | both | ISO 14971, 위해 추정, risk estimation, 심각도 발생확률 매트릭스, severity probability matrix, 잔여위험, residual risk, ALARP | meddevice-agent |
| k-law | 1.0.0 | skills/k-law/SKILL.md | workspace | k-law, /k-law, `법령`, `법률`, `법령정보`, `법령검색`, `판례`, law, statute, legal search, Korea law | strategy-analyst |
| k-law | 1.0.0 | .claude/skills/k-law/SKILL.md | both | k-law, /k-law, `법령`, `법률`, `법령정보`, `법령검색`, `판례`, law, statute, legal search, Korea law | strategy-analyst |
| landfill-methane-anaerobic-explosion-planner | 1.0 | .claude/skills/landfill-methane-anaerobic-explosion-planner/SKILL.md | both | 매립지 메탄 가스 폭발, landfill methane CH4 explosion, 혐기소화 소화조 biogas, anaerobic digestion biogas, 침출수 화학적 위해, leachate chemical hazard landfill, 사면 붕괴 매립지, landfill slope collapse, 매립지 깊은 화재 소방, deep seated landfill fire, 가스 추출정 LEL 모니터링, gas extraction well LEL monitoring, WCA Article 25 폐기물처리업 허가, BFS Article 16 소방활동, Sudokwon Landfill safety | waste-agent |
| meeting | 1.5.0 | .claude/skills/meeting/SKILL.md | both | meeting, agent discussion, collaborative decision, multi-agent coordination, facilitate meeting | pm |
| meeting-facilitation | 1.5.0 | skills/meeting-facilitation/SKILL.md | workspace | meeting, agent discussion, collaborative decision, multi-agent coordination, facilitate meeting | pm |
| meeting-facilitation | 1.5.0 | .claude/skills/meeting-facilitation/SKILL.md | both | meeting, agent discussion, collaborative decision, multi-agent coordination, facilitate meeting | pm |
| mid-construction-inspection | 1.0.0 | .claude/skills/mid-construction-inspection/SKILL.md | both | mid-construction inspection, construction inspection, 중간검사, 공사검사, 현장검사 | gasterm-agent |
| msds-parser | 1.0 | .claude/skills/msds-parser/SKILL.md | both | MSDS 파싱, MSDS parser, SDS 16항목, 물질안전보건자료, GHS 16-section, msds-record.json, 공급자 MSDS 양식 | msds-agent |
| munitions-magazine-storage-safety-planner | 1.0 | .claude/skills/munitions-magazine-storage-safety-planner/SKILL.md | both | 탄약 마가진 저장 안전, munitions magazine storage safety, 화약류 안전거리 Q-D, quantity-distance siting explosives, 호환성 그룹 분리 저장, compatibility group segregation, UN hazard division 1.1 1.2 1.3, sympathetic detonation prevention, 화약류안전관리자 선임, FSESA Article 23 explosives safety manager, 마가진 낙뢰 정전기 대책, magazine lightning protection | defense-agent |
| painting-coating-fire-toxic-planner | 1.0 | .claude/skills/painting-coating-fire-toxic-planner/SKILL.md | both | 조선 도장 작업 화재 폭발, ship painting coating fire, 선박 도료 가연성 증기 LEL, paint vapor LEL explosion shipyard, 유기용제 흡입 노출 도장, solvent vapor inhalation painting, 도장 베이 화재 대응, paint bay fire response, 밀폐구역 도장 산소결핍, confined area painting O2 deficiency, DSSMA Article 5 도장 위험물, DSSMA Article 27 응급조치, OSHA-KR Article 110 물질안전보건자료(MSDS) 작성·제출, SAPA Article 5 도급 사업주 | shipbuilding-agent |
| permit-to-work | 1.0.1 | .claude/skills/permit-to-work/SKILL.md | both | 작업허가서, permit to work, PTW, hot work permit, 화기작업, 밀폐공간작업, confined space | safety-workflow-manager |
| platform-command-lifecycle-manager | 1.0.0 | .claude/skills/platform-command-lifecycle-manager/SKILL.md | both | create platform command, new .claude command, new .gemini command, platform command lifecycle, command parity, propagate command | pm |
| platform-skill-lifecycle-manager | 1.0.0 | .claude/skills/platform-skill-lifecycle-manager/SKILL.md | both | create platform skill, new .claude skill, new .gemini skill, platform skill version, platform skill lifecycle, update platform skill | pm |
| pre-construction-technical-review | 1.0.0 | .claude/skills/pre-construction-technical-review/SKILL.md | both | pre-construction review, technical review, design review, 시설기준 검토, 기술검토, 설계검토, 사전기술검토 | gasterm-agent |
| process-hazard-screening | 1.0 | .claude/skills/process-hazard-screening/SKILL.md | both | PSM 적용대상, process hazard screening, 위해물질 보유량, 공정안전관리, PHA 대상 여부, 사고대비물질, 화학공장 초기 위해평가 | ehschem-agent |
| project-review | 1.1.0 | skills/project-review/SKILL.md | workspace | project review, review project, audit project, quality review | pm |
| project-review | 1.1.0 | .claude/skills/project-review/SKILL.md | both | project review, review project, audit project, quality review | pm |
| protocol-deviation-analyzer | 1.0 | .claude/skills/protocol-deviation-analyzer/SKILL.md | both | 프로토콜 이탈, protocol deviation, ICH E6(R3), important deviation, CAPA, IRB 보고, KGCP, 임상시험 이탈 | gcp-agent |
| psm-loto | 1.0.0 | .claude/skills/psm-loto/SKILL.md | both | loto, lockout, tagout, lock out, tag out, energy isolation, 에너지 차단, 로크아웃, 태그아웃 | psm-agent |
| psm-moc | 1.0 | .claude/skills/psm-moc/SKILL.md | both | management of change, moc, change management, process change, 변경관리, 공정변경 | psm-agent |
| pyrophoric-gas-emergency-responder | 1.0 | .claude/skills/pyrophoric-gas-emergency-responder/SKILL.md | both | 실란 가스 누출, silane gas leak, pyrophoric gas emergency, 발화성 가스 사고, arsine phosphine diborane leak, special gas cabinet emergency, gas alarm response fab, 고압가스 사고 응급조치, HPGSCA Article 26, sub-fab evacuation | semicon-agent |
| rack-fall-protection-planner | 1.0 | .claude/skills/rack-fall-protection-planner/SKILL.md | both | 데이터센터 추락 방지, 서버 랙 설치 작업, rack install fall protection, overhead cabling work-at-height, top-of-rack 작업, 제상플로어 접근, raised-floor tile handling, datacenter work-at-height plan, 랙 설치 사다리 선택, rack anchor point rating | datacenter-agent |
| research-analysis | 1.0.0 | .claude/skills/research-analysis/SKILL.md | both | research, analyze, investigate, synthesize, evidence gathering, data analysis, literature review | N/A |
| risk-assessment | 1.0.0 | .claude/skills/risk-assessment/SKILL.md | both | 위험성평가, risk assessment, hazard identification, 위험 평가, 작업위험성분석 | risk-assessment-agent |
| rolling-stock-maintenance-loto-planner | 1.0 | .claude/skills/rolling-stock-maintenance-loto-planner/SKILL.md | both | 철도 차량사업소 차량 정비 LOTO, rolling stock depot maintenance, EMU 객차 정비 차량 이동 잠금, rolling stock vehicle movement lockout, bogey 대차 리프팅 크레인, bogey heavy lift rigging, 밑바닥 pit 작업 차량 압사, undercarriage pit work crush, 차량 지붕 추락 방지, roof fall prevention rolling stock, 철도 안전관리자 정비 허가, RSA Article 48 철도 보호, OSHA-KR Article 38 추락 방지 포함 안전조치 (전차선), wheel chock derail brake scotch | railway-agent |
| root-cause-analysis | 1.0.0 | .claude/skills/root-cause-analysis/SKILL.md | both | 근본원인분석, root cause analysis, RCA, 5 whys, fishbone diagram, 사고조사, CAPA 수립 | incident-investigation-agent |
| sae-causality-assessor | 1.0 | .claude/skills/sae-causality-assessor/SKILL.md | both | SAE 인과성 평가, causality assessment, ImPACT, WHO-UMC, Naranjo algorithm, ICH E2A, 중대이상반응 인과관계, 이상반응 인과성 | gcp-agent |
| safety-inspection-validator | 1.0 | .claude/skills/safety-inspection-validator/SKILL.md | both | 안전점검 결과 검증, safety inspection findings, 지적사항 분류, CAPA, 시정조치, Critical Major Minor 분류, 건설 안전점검 | ehsconst-agent |
| script-lifecycle-manager | 1.2.0 | skills/script-lifecycle-manager/SKILL.md | workspace | create script, update script, deprecate script, script lifecycle, manage scripts | pm |
| script-lifecycle-manager | 1.2.0 | .claude/skills/script-lifecycle-manager/SKILL.md | both | create script, update script, deprecate script, script lifecycle, manage scripts | pm |
| signal-detector | 1.0 | .claude/skills/signal-detector/SKILL.md | both | 시그널 탐지, signal detection, PRR, ROR, BCPNN, EBGM, 부작용 신호, disproportionality analysis | gvp-agent |
| simulate-project-creation | 1.0.0 | .claude/skills/simulate-project-creation/SKILL.md | both | simulate project, test scaffolding, dry run project creation | scaffolding-expert |
| skill-lifecycle-manager | 1.2.0 | skills/skill-lifecycle-manager/SKILL.md | workspace | create skill, new skill, validate skills, skill lifecycle, manage skills | pm |
| skill-lifecycle-manager | 1.2.0 | .claude/skills/skill-lifecycle-manager/SKILL.md | both | create skill, new skill, validate skills, skill lifecycle, manage skills | pm |
| sync | 1.1.0 | skills/sync/SKILL.md | workspace | sync, commit and push, create PR, push changes | pm |
| sync | 1.1.0 | .claude/skills/sync/SKILL.md | both | sync, commit and push, create PR, push changes | pm |
| tank-integrity-validator | 1.0 | .claude/skills/tank-integrity-validator/SKILL.md | both | 저장탱크 건전성, tank integrity, LNG 탱크 검사, 수소 취성, hydrogen embrittlement, KGS 코드, 압력용기 검사, 부식 피로 검증 | gasterm-agent |
| tar-planning | 1.1.0 | .claude/skills/tar-planning/SKILL.md | both | turnaround, tar, tar planning, shutdown planning, 정기보수, 가동중지, 보수정비, 대정비 | ehschem-agent |
| team-builder | 1.1.0 | skills/team-builder/SKILL.md | workspace | 새 팀 구성, 에이전트팀 변경, 신규 도메인 팀 빌딩, build new agent team, agent team benchmarking, team proposal generation, consulting team design | pm |
| team-builder | 1.1.0 | .claude/skills/team-builder/SKILL.md | both | 새 팀 구성, 에이전트팀 변경, 신규 도메인 팀 빌딩, build new agent team, agent team benchmarking, team proposal generation, consulting team design | pm |
| temperature-excursion-analyzer | 1.0 | .claude/skills/temperature-excursion-analyzer/SKILL.md | both | 온도이탈, temperature excursion, 콜드체인, cold chain, GDP 온도관리, 냉장유통, excursion event, 안정성 데이터 검토 | gdp-agent |
| thermal-burn-prevention-planner | 1.0 | .claude/skills/thermal-burn-prevention-planner/SKILL.md | both | 식품공장 화상 예방, 튀김기 화재 위험, cooking-oil fire risk, industrial fryer safety, thermal burn prevention food, steam line LOTO, 조리유 과열 방지, hot surface PPE, Class F Class K fire, 식품 제조 열 설비 | food-agent |
| tool-box-meeting | 1.0.0 | .claude/skills/tool-box-meeting/SKILL.md | both | TBM, Tool Box Meeting, Toolbox Meeting, 안전점검회의, 작업 전 안전회의, 작업전 안전회의, 오늘 TBM, 작업 전 안전점검, pre-work briefing, daily safety briefing | safety-workflow-manager |
| translate | 1.0.0 | skills/translate/SKILL.md | workspace | translate, translation, localize, Korean translation | pm |
| translate | 1.0.0 | .claude/skills/translate/SKILL.md | both | translate, translation, localize, Korean translation | pm |

---

## Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
| agent-create.ts | 1.0.0 | scripts/agent-create.ts | N/A |
| agent-delete.ts | 1.0.0 | scripts/agent-delete.ts | N/A |
| agent-lifecycle-audit.ts | 1.1.2 | scripts/agent-lifecycle-audit.ts | N/A |
| agent-list.ts | 1.0.0 | scripts/agent-list.ts | N/A |
| agent-verify.ts | 1.0.2 | scripts/agent-verify.ts | N/A |
| analyze-git-history.ts | 1.0.0 | scripts/analyze-git-history.ts | child_process |
| archive-memory.ts | 1.1.2 | scripts/archive-memory.ts | N/A |
| audit.ts | 2.24.0 | scripts/audit.ts | bun |
| auto-executor.ts | 1.0.0 | scripts/lib/auto-executor.ts | N/A |
| check-pm-approval.ts | 1.0.1 | scripts/check-pm-approval.ts | N/A |
| checkpoint-manager.ts | 1.0.0 | scripts/lib/checkpoint-manager.ts | N/A |
| clear-pm-approval.ts | 1.0.0 | scripts/clear-pm-approval.ts | N/A |
| dev-sync.ts | N/A | scripts/dev-sync.ts | bun |
| dispatch-parallel.ts | 1.0.1 | scripts/dispatch-parallel.ts | N/A |
| dispatch-serial.ts | 1.0.0 | scripts/dispatch-serial.ts | N/A |
| dispatch.ts | 1.0.0 | scripts/dispatch.ts | N/A |
| domain-config.ts | 1.5.0 | scripts/domain-config.ts | N/A |
| encoding-utils.ts | 1.0.0 | scripts/lib/encoding-utils.ts | fs, path |
| error-handling.ts | 1.1.0 | scripts/lib/error-handling.ts | N/A |
| evidence-validator.ts | 1.0.0 | scripts/lib/evidence-validator.ts | N/A |
| gen-pr-body.ts | 1.2.0 | scripts/gen-pr-body.ts | bun |
| generate-scripts-readme.ts | 1.1.0 | scripts/generate-scripts-readme.ts | N/A |
| generate-version-manifest.ts | 1.0.7 | scripts/generate-version-manifest.ts | bun |
| mcp-cache.ts | 1.0.0 | scripts/lib/mcp-cache.ts | N/A |
| migrate-registry-to-coordinates.ts | N/A | scripts/migrate-registry-to-coordinates.ts | js-yaml |
| new-domain.ts | 1.0.1 | scripts/new-domain.ts | N/A |
| pipeline-state.ts | 1.1.0 | scripts/lib/pipeline-state.ts | fs, path |
| plan-parser.ts | 1.0.0 | scripts/lib/plan-parser.ts | fs, js-yaml |
| platform-context.ts | 1.0.0 | scripts/lib/platform-context.ts | bun, os |
| platform-dispatcher.ts | 1.0.0 | scripts/lib/platform-dispatcher.ts | N/A |
| qa-gate.ts | N/A | scripts/qa-gate.ts | bun |
| readme-lifecycle-audit.ts | 1.0.2 | scripts/readme-lifecycle-audit.ts | N/A |
| retry-handler.ts | 1.0.2 | scripts/retry-handler.ts | N/A |
| risk-register-rollup.ts | 1.0.0 | scripts/risk-register-rollup.ts | N/A |
| safety-audit.ts | 4.10.1 | scripts/safety-audit.ts | js-yaml |
| scaffold-industry.ts | 0.1.1 | scripts/scaffold-industry.ts | js-yaml |
| skill-dependency-analysis.ts | 1.0.0 | scripts/skill-dependency-analysis.ts | N/A |
| skill-lifecycle-audit.ts | 1.1.4 | scripts/skill-lifecycle-audit.ts | N/A |
| start-mcp.ts | 1.0.0 | scripts/start-mcp.ts | child_process, path |
| sync-agent-status.ts | 1.0.0 | scripts/sync-agent-status.ts | N/A |
| sync-md.ts | 1.3.3 | scripts/sync-md.ts | N/A |
| sync-skill-status.ts | 1.0.0 | scripts/sync-skill-status.ts | N/A |
| sync-skills.ts | 1.4.0 | scripts/sync-skills.ts | N/A |
| team-builder.ts | 1.2.0 | scripts/team-builder.ts | fs, path |
| test-chemical-handling-profile.ts | 1.0.0 | scripts/test-chemical-handling-profile.ts | js-yaml |
| test-cross-domain-integration.ts | 1.0.0 | scripts/test-cross-domain-integration.ts | js-yaml |
| test-domain-scenarios.ts | 1.1.0 | scripts/test-domain-scenarios.ts | N/A |
| test-pharma-general-profile.ts | 1.0.0 | scripts/test-pharma-general-profile.ts | js-yaml |
| test-runner.ts | N/A | scripts/test-runner.ts | child_process, fs, path |
| test-runtime-tools.ts | 1.0.0 | scripts/test-runtime-tools.ts | N/A |
| training-ingest.ts | 1.0.0 | scripts/training-ingest.ts | N/A |
| translate-readme.ts | 1.0.0 | scripts/translate-readme.ts | bun, fs, path |
| validate-agents.ts | 1.1.0 | scripts/validate-agents.ts | N/A |
| validate-doc-folder.ts | 1.0.1 | scripts/validate-doc-folder.ts | fs, path |
| validate-md-language.ts | 1.4.1 | scripts/validate-md-language.ts | fs, js-yaml |
| validate-skills.ts | 1.1.0 | scripts/validate-skills.ts | N/A |
| verify-agent-deliverables.ts | 1.0.0 | scripts/verify-agent-deliverables.ts | fs |
| verify-memory.ts | 1.0.0 | scripts/verify-memory.ts | fs, path |
| verify-readme-sync.ts | 1.1.1 | scripts/verify-readme-sync.ts | bun, fs, path |
| verify-scripts.ts | 1.0.2 | scripts/verify-scripts.ts | fs, path |
| verify-skills.ts | 1.1.0 | scripts/verify-skills.ts | N/A |

---

## Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
| changelog | .claude/commands/changelog.md | both | auto (changelog) |
| commit-push-pr | .claude/commands/commit-push-pr.md | both | auto (commit-push-pr) |
| meeting | .claude/commands/meeting.md | both | auto (meeting) |
| memlog | .claude/commands/memlog.md | both | auto (memlog) |
| new-task | .claude/commands/new-task.md | both | auto (new-task) |
| project-review | .claude/commands/project-review.md | both | auto (project-review) |
| sync | .claude/commands/sync.md | both | auto (sync) |

---

## Platform Parity Status

**Checked**: Claude (.claude/) vs Gemini (.gemini/)

- **Commands with parity**: 7 / 7
- **Skills with parity**: 69 / 78

---

## Drift Detection

✅ No drift detected. All components are properly versioned and integrated.
