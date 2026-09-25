# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-safety skills (T-20260925-005). One row per skill directory; values come from each skill's SKILL.md frontmatter. The auto-generated index this file replaces was produced by verify-skills.ts — converting this file to a curated registry opts the variant out of legacy-index regeneration. Rows noted `inherited from common — customized fork (variant-maintained)` are variant-maintained forks of common skills; every other row is co-safety-exclusive.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `agent-lifecycle-manager` | 1.2.0 | active | pm | 2026-09-18 | — | inherited from common — customized fork (variant-maintained) |
| `arc-flash-analyzer` | 1.0.0 | active | powergen-agent | — | — | co-safety only — Arc flash hazard analysis per IEEE 1584 |
| `asset-integrity-check` | 1.0.0 | active | asset-integrity-agent | — | — | co-safety only — Coordinate mechanical integrity and preventative maintenance checks |
| `audit-preparation` | 1.0.0 | active | audit-agent | — | — | co-safety only — Prepare documentation and evidence for regulatory EHS audits |
| `benefit-risk-assessor` | 1.0.0 | active | gvp-agent | — | — | co-safety only — Integrated benefit-risk assessment per EU GVP Module 12 |
| `bsl-lab-aerosol-control-planner` | 1.0.0 | active | biotech-agent | — | — | co-safety only — Plan bioaerosol and sharps-injury control for BSL-2/3 laboratory handling of biohazardous agents —… |
| `chemical-risk-assessment` | 1.1.0 | active | msds-agent | — | — | co-safety only — Scenario-based chemical risk assessment combining hazard data (GHS classification) with exposure… |
| `coke-oven-pah-heat-stress-planner` | 1.0.0 | active | steelmaking-agent | — | — | co-safety only — Plan coke-oven battery worker safety — coal-tar-pitch-volatile PAH (IARC Group 1 carcinogen)… |
| `completion-inspection` | 1.0.0 | active | gasterm-agent | — | — | co-safety only — Execute KGS on-site completion inspection and permit issuance for gas terminal facilities… |
| `compliance-gap` | 1.0.0 | active | compliance-agent | — | — | co-safety only — Trigger compliance gap analysis against applicable EHS regulations |
| `construction-permit-overview` | 1.0.0 | active | gasterm-agent | — | — | co-safety only — Orchestrate full construction/permit lifecycle for gas terminal facilities (LNG/LPG/수소) under… |
| `contractor-onboarding` | 1.0.0 | active | contractor-safety-agent | — | — | co-safety only — Manage EHS onboarding and compliance verification for contractors |
| `cosmetics-solvent-exposure-monitor` | 1.0.0 | active | cosmetics-agent | — | — | co-safety only — Plan and assess worker inhalation-exposure monitoring for solvents (ethanol, isopropanol, methanol)… |
| `dangerous-cargo-handling-planner` | 1.0.0 | active | logistics-agent | — | — | co-safety only — Plan IMDG-classed dangerous-cargo port handling — class segregation, stowage assignment,… |
| `dts-verification` | 1.0.0 | active | gdp-agent | — | — | co-safety only — Verify DTS (Drug Tracking System) barcode/RFID scans against manufacturer and MFDS records per… |
| `emergency-response` | 1.0.1 | active | emergency-agent | — | — | co-safety only — Trigger emergency response protocol on incident, fire, spill, or injury report |
| `environmental-compliance-checker` | 1.0.0 | active | ehschem-agent | — | — | co-safety only — Check environmental discharge compliance for chemical plants |
| `ess-fire-risk-assessor` | 1.0.0 | active | powergen-agent | — | — | co-safety only — Lithium-ion ESS (Energy Storage System) fire risk assessment |
| `fall-hazard-assessor` | 1.0.0 | active | ehsconst-agent | — | — | co-safety only — Assess fall hazards at construction sites |
| `gas-dispersion-analyzer` | 1.0.0 | active | gasterm-agent | — | — | co-safety only — Model gas dispersion after leak for emergency response |
| `ghs-classifier` | 1.0.0 | active | msds-agent | — | — | co-safety only — Apply GHS Rev 9 (2021) classification rules to chemical substances and mixtures per OSHA-KR Article… |
| `glp-data-integrity-checker` | 1.0.0 | active | glp-agent | — | — | co-safety only — Validate ALCOA+ data integrity principles for GLP raw data per OECD GLP Section 9 |
| `glp-study-protocol-validator` | 1.0.0 | active | glp-agent | — | — | co-safety only — Validate study protocol compliance with OECD GLP Section 8 requirements |
| `gmp-change-control` | 1.0.0 | active | gmp-agent | — | — | co-safety only — Manage GMP Change Control (변경관리) workflows per 총리령 「의약품 등의 안전에 관한 규칙」 별표 1 제12호 (변경관리) + ICH Q10 |
| `gmp-deviation-capa` | 1.0.0 | active | gmp-agent | — | — | co-safety only — Manage GMP Deviation (이상관리) and CAPA (시정예방조치) workflows per 총리령 「의약품 등의 안전에 관한 규칙」 별표 1 제7.3호 + ICH… |
| `gmp-qrm` | 1.0.0 | active | gmp-agent | — | — | co-safety only — ICH Q9 Quality Risk Management (품질 위해 관리) skill for pharmaceutical manufacturing |
| `hazop-analysis` | 1.1.0 | active | psm-agent | — | — | co-safety only — Facilitate Hazard and Operability (HAZOP) analysis for process safety management |
| `hv-cell-formation-electrical-safety-planner` | 1.0.0 | active | battery-agent | — | — | co-safety only — Plan high-voltage DC electrical safety for lithium-ion cell formation, charging, aging, and large… |
| `iso14971-risk-scorer` | 1.1.0 | active | meddevice-agent | — | — | co-safety only — ISO 14971 risk estimation and scoring for medical devices |
| `landfill-methane-anaerobic-explosion-planner` | 1.0.0 | active | waste-agent | — | — | co-safety only — Plan landfill + anaerobic-digestion facility safety — methane (CH4) LEL explosion management,… |
| `meeting-facilitation` | 1.5.0 | active | pm | 2026-07-08 | — | inherited from common — customized fork (variant-maintained) |
| `mid-construction-inspection` | 1.0.0 | active | gasterm-agent | — | — | co-safety only — Execute KGS on-site mid-construction inspection for gas terminal facilities (LNG/LPG/수소) |
| `msds-parser` | 1.0.0 | active | msds-agent | — | — | co-safety only — Parse MSDS/SDS documents into structured GHS 16-section records |
| `munitions-magazine-storage-safety-planner` | 1.0.0 | active | defense-agent | — | — | co-safety only — Plan munitions magazine storage operations — quantity-distance (Q-D) siting, UN hazard-division (HD… |
| `painting-coating-fire-toxic-planner` | 1.0.0 | active | shipbuilding-agent | — | — | co-safety only — Plan shipyard painting/coating bay safety — combustible paint-vapor LEL explosion control,… |
| `permit-to-work` | 1.0.1 | active | safety-workflow-manager | — | — | co-safety only — Trigger permit-to-work (PTW) issuance workflow for high-risk or non-routine work |
| `pre-construction-technical-review` | 1.0.0 | active | gasterm-agent | — | — | co-safety only — Execute KGS Code pre-construction technical review (시설·기술 기준) for gas terminal facilities… |
| `process-hazard-screening` | 1.0.0 | active | ehschem-agent | — | — | co-safety only — Initial hazard screening for chemical plant processes |
| `project-review` | 1.2.0 | active | pm | 2026-09-08 | — | inherited from common — customized fork (variant-maintained) |
| `protocol-deviation-analyzer` | 1.0.0 | active | gcp-agent | — | — | co-safety only — Analyze clinical trial protocol deviations per ICH E6(R3) |
| `psm-loto` | 1.0.0 | active | psm-agent | — | — | co-safety only — Execute Lockout/Tagout (LOTO) procedure verification per KOSHA GUIDE Z-40-2022 and 안전보건기준규칙 Article… |
| `psm-moc` | 1.0.0 | active | psm-agent | — | — | co-safety only — Manage Process Safety Management (PSM) Management of Change (MOC) workflows |
| `pyrophoric-gas-emergency-responder` | 1.0.0 | active | semicon-agent | — | — | co-safety only — Plan and execute emergency response for pyrophoric and toxic special-gas leaks in semiconductor… |
| `rack-fall-protection-planner` | 1.0.0 | active | datacenter-agent | — | — | co-safety only — Plan fall protection for datacenter white-space work-at-height — 42U-52U server-rack install,… |
| `risk-assessment` | 1.0.0 | active | risk-assessment-agent | — | — | co-safety only — Trigger risk assessment workflow for hazard identification and scoring |
| `rolling-stock-maintenance-loto-planner` | 1.0.0 | active | railway-agent | — | — | co-safety only — Plan rolling-stock depot maintenance safety — EMU/coach/locomotive vehicle-movement lockout (wheel… |
| `root-cause-analysis` | 1.0.0 | active | incident-investigation-agent | — | — | co-safety only — Conduct Root Cause Analysis (RCA) for safety incidents |
| `sae-causality-assessor` | 1.0.0 | active | gcp-agent | — | — | co-safety only — Assess SAE causality using ImPACT criteria |
| `safety-inspection-validator` | 1.0.0 | active | ehsconst-agent | — | — | co-safety only — Validate construction safety inspections per OSHA-KR construction provisions |
| `script-lifecycle-manager` | 1.2.0 | active | pm | 2026-05-30 | — | inherited from common — customized fork (variant-maintained) |
| `signal-detector` | 1.0.0 | active | gvp-agent | — | — | co-safety only — Statistical signal detection in pharmacovigilance case database |
| `skill-lifecycle-manager` | 1.4.0 | active | pm | 2026-09-18 | — | inherited from common — customized fork (variant-maintained) |
| `sync` | 1.6.0 | active | pm | 2026-09-17 | — | inherited from common — customized fork (variant-maintained) |
| `tank-integrity-validator` | 1.0.0 | active | gasterm-agent | — | — | co-safety only — Validate LNG/LPG/수소 저장탱크 구조 건전성 |
| `tar-planning` | 1.1.0 | active | ehschem-agent | — | — | co-safety only — Chemical plant turnaround (TAR) shutdown planning — pre-TAR risk assessment, PSSR (Pre-Startup… |
| `team-builder` | 1.1.0 | active | pm | — | — | inherited from common — customized fork (variant-maintained) |
| `temperature-excursion-analyzer` | 1.0.0 | active | gdp-agent | — | — | co-safety only — Analyze temperature excursion events in cold chain pharmaceutical distribution |
| `thermal-burn-prevention-planner` | 1.0.0 | active | food-agent | — | — | co-safety only — Plan worker thermal-burn and cooking-oil fire-risk prevention for industrial fryers, cookers, steam… |
| `tool-box-meeting` | 1.0.0 | active | safety-workflow-manager | — | — | co-safety only — Trigger pre-work Tool Box Meeting (TBM) — cross-industry safety briefing with per-domain legal… |
| `translate` | 1.0.1 | active | pm | 2026-08-24 | — | inherited from common — customized fork (variant-maintained) |

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each `SKILL.md` file.

See [`agents/README.md`](../agents/README.md) for the full workflow and agent handoff chain.

---

*Maintained by: co-safety variant team*
