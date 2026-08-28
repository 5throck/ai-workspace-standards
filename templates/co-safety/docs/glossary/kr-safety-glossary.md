---
lang: ko
lang_reason: legal
---

# KR Safety Glossary — 한국어 라우팅 키워드 및 법령 레지스트리

> **Language Policy exception declared** (`lang: ko`, `lang_reason: legal`): official
> Korean statute names and KO routing keywords are proper nouns whose Korean form is the
> authoritative form (k-law Open API queries require the Korean official names).
> English-only governance text lives in [AGENTS.md](../../AGENTS.md); this file is the
> KO companion referenced from it. 관리 주체: co-safety 프로젝트 팀.

## 1. KO Routing Keywords (Overlap Table)

| KO Keyword(s) | EN Keyword(s) | Primary Owner |
|---------------|---------------|---------------|
| `규제` | compliance | compliance-agent |
| `위험성평가` | risk assessment | risk-assessment-agent (`risk-assessment` skill) |
| `사고`, `화재` | emergency, incident | emergency-agent (`emergency-response` skill) |
| `화학물질` | MSDS, hazardous chemicals | msds-agent (`msds-parser`, `ghs-classifier` skills) |
| `교육` | training | training-agent |
| `검사` | audit, inspection readiness | audit-agent (`audit-preparation` skill) |
| `하도급` | contractor | contractor-safety-agent (`contractor-onboarding` skill) |
| `추락` | fall hazard | ehsconst-agent (`fall-hazard-assessor` skill) |
| `법령 조회`, `판례`, `법령해석례`, `별표서식` | law lookup | legal-agent (`k-law`) |

## 2. KO Domain Descriptors (Agent Roster)

| Agent | KO Descriptor |
|-------|---------------|
| EHSChem Agent | `정유/석유화학/정밀화학` |
| EHSConst Agent | `도급·하도급 안전보건확보의무` (SAPA Article 5) |
| GasTerm Agent | `LNG/LPG/수소 기지 및 충전소` |
| PowerGen Agent | `화력/신재생 발전설비` (`원자력 제외`) |

## 3. KO Trigger Keywords per Agent

| Agent | Phase | KO Trigger Keywords |
|-------|-------|---------------------|
| ehschem-agent | 4 | `화학공장`, `정유`, `석유화학`, `정밀화학` |
| ehsconst-agent | 4 | `건설안전`, `안전보건관리계획`, `추락 방지`, `붕괴 방지`, `건설 PTW`, `안전감리`, `안전관리비`, `하도급 안전`, `건설 중대재해` |
| gasterm-agent | 4 | `가스터미널`, `수소 충전소`, `가스 저장탱크`, `가스 누출`, `KGS 검사`, `고압가스` |
| powergen-agent | 4 | `발전소`, `발전설비`, `터빈`, `보일러`, `고압 전기`, `송전`, `변전`, `풍력`, `태양광`, `에너지저장` |
| glp-agent | 4 | `비임상시험`, `독성시험` |
| gdp-agent | 4 | `의약품 유통`, `냉장 유통`, `추적관리` |
| gcp-agent | 4 | `임상시험`, `생명윤리` |
| gvp-agent | 4 | `약물감시`, `이상반응`, `재평가` |
| meddevice-agent | 4 | `의료기기`, `설계관리`, `멸균 밸리데이션`, `의료기기 회수` |
| food-agent | 4 | `식품`, `식품위생법` |
| cosmetics-agent | 4 | `화장품`, `화장품법` |
| semicon-agent | 4 | `반도체`, `디스플레이`, `클린룸`, `특수가스`, `불산` |
| battery-agent | 4 | `이차전지`, `배터리`, `열폭주`, `폐배터리`, `리사이클링` |
| shipbuilding-agent | 4 | `조선`, `해양플랜트`, `선박 탱크`, `밀폐공간 질식`, `골리앗 크레인` |
| steelmaking-agent | 4 | `철강`, `제련`, `용광로`, `전기로`, `용융물`, `부생가스`, `CO가스` |
| datacenter-agent | 4 | `데이터센터`, `수전설비`, `고전압` |
| logistics-agent | 4 | `항만물류`, `물류센터`, `냉동창고`, `항만안전특별법` |
| railway-agent | 4 | `철도`, `전차선`, `선로 정비`, `철도안전법` |
| waste-agent | 4 | `폐기물`, `하수처리장`, `황화수소`, `소각로`, `폐기물관리법`, `하수도법` |
| defense-agent | 4 | `방위산업`, `화약`, `추진제`, `유도무기`, `방위사업법` |
| biotech-agent | 4 | `바이오 CDMO`, `배양기`, `생물안전` |

## 4. KO Terms in Skill Descriptions

| Skill | KO Term | EN |
|-------|---------|----|
| psm-loto | `안전보건기준규칙` | OSHA-KR Standards Regulation (Article 92) |
| gas-dispersion-analyzer | `수소` | hydrogen |
| tank-integrity-validator | `수소` | hydrogen |
| pre-construction-technical-review | `시설·기술 기준` | KGS facility & technical standards |
| gmp-change-control | `변경관리` | change control |
| gmp-deviation-capa | `이상관리`, `시정예방조치` | deviation management, CAPA |
| gmp-qrm | `품질 위해 관리` | quality risk management (ICH Q9) |
| k-law | `법제처` | Ministry of Government Legislation (Open API source) |

## 5. Official Statute Registry (Regulatory Scope)

> Law text is retrieved live via MCP — tiers define **which regulations are in scope**
> and their authority tier. Live queries: `k-law` skill (`법제처` Open API — sole live
> CONTENT source) and `kr_safety` MCP (OSHA-KR/SAPA index). legalize_kr and
> mcp_kr_legislation MCP servers were removed 2026-08-26 (k-law supersedes both);
> regulations/KR/*.yaml are coordinate registries.

### Tier 1 — Core Statutes

| Law | Abbreviation | Enforcement Agency |
|-----|-------------|-------------------|
| `산업안전보건법` (Occupational Safety and Health Act) | OSHA-KR | `고용노동부` |
| `중대재해처벌법` (Serious Accidents Punishment Act) | SAPA | `고용노동부` |

### Tier 2 — Presidential Decrees (`시행령`)

| Decree | Parent Statute |
|--------|---------------|
| `산업안전보건법` 시행령 | OSHA-KR |
| `산업안전보건법` 시행규칙 | OSHA-KR |
| `중대재해처벌법` 시행령 | SAPA |

### Tier 3 — Ministerial Ordinances & Notices (`시행규칙/고시`)

| Ordinance | Parent Statute |
|-----------|---------------|
| `산업안전보건기준에 관한 규칙` (안전보건규칙) | OSHA-KR |
| `공정안전관리 고시` (PSM고시) | OSHA-KR 제44조 |

### Tier 4 — Related Statutes

| Law | Domain |
|-----|--------|
| `화학물질관리법` (CCA) | Chemical Safety |
| `고압가스안전관리법` | High-Pressure Gas |
| `위험물안전관리법` | Hazardous Materials |
| `소방기본법` | Fire Safety |
| `건설산업기본법` | Construction |
| `근로기준법` | Labor Standards |
| `연구실안전법` | Lab Safety |
| `전기안전관리법` | Electrical Safety |
| `대기환경보전법` | Air Quality |
| `물환경보전법` | Water Quality |
| `폐기물관리법` | Waste Management |
| `토양환경보전법` | Soil Environment |
| `소음진동관리법` | Noise & Vibration |
| `자연환경보전법` | Nature Conservation |
| `해양환경보전법` | Marine Environment |
| `원자력안전법` | Nuclear Safety |
| `승강기안전관리법` | Elevator Safety |
| `건축법` | Building Code |
