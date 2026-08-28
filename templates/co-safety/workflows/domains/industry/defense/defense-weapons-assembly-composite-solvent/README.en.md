# Defense Industry — Weapons Assembly Composite Solvent Workflow

> **Status**: This README was finalized in Phase 2 Group B and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent). However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent inhalation exposure, fire, explosion, and dermal-absorption hazards from organic solvents (methylene chloride, styrene, MEK, acetone, etc.) and prepreg resins used in composite-component assembly, bonding, and coating of defense weapon systems (missiles, aircraft, launchers), by applying the hierarchy of controls. Solvent vapors in confined assembly zones and near autoclaves are simultaneously flammable and toxic (carcinogenic/neurotoxic), and composite dust behaves as a combustible dust. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a defense-industry-specific composite-and-solvent-safety procedure that does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Defense (code: `defense`, defense-industry manufacturing)
- **Work covered**: Composite layup and cure (autoclave, prepreg handling), bonding/coating/painting, solvent mixing and cleaning, confined-space work (tank/airframe interiors), machining/edge-trimming, spent-solvent recovery and storage
- **Trigger points**: Introduction of a new solvent or resin, confined-space entry, inspection of local exhaust ventilation (LEV) and explosion-proof equipment, solvent-leak or dust-release alarm

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads chemical/fire/confined-space risk assessment, operates the safe-work-permit system |
| Industrial Hygienist | Measures solvent-vapor and composite-dust concentrations, assesses respirator/glove adequacy, inspects LEV performance |
| Supervisor / Work Lead | Approves confined-space entry permits, pre-checks ventilation and explosion-proof equipment, halts work on anomaly |
| Worker | Wears respirator and chemical gloves, confirms LEV operation, complies with solvent-handling and static-control procedures |
| Facility Engineer | Inspects and maintains LEV, explosion-proof electrical, static grounding, and explosion-venting equipment; manages autoclave safety devices |
| Industrial Health & Safety Committee | Reviews chemical-exposure, fire, and near-miss events, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify solvent flash point, explosive limits (LEL/UEL), toxicity (carcinogenic/neurotoxic), and skin-absorption potential; composite-dust combustibility (MIE/Kst); confined-space status; and ignition sources (static, friction, flame). Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Substitute lower-toxicity/non-flammable solvents, switch to water-borne coatings, automate closed processes.
   2. **Passive protection**: Closed mixing/transfer, local exhaust ventilation (LEV), explosion-proof electrical and explosion venting, insulating mats.
   3. **Active protection**: Gas detection (25% LEL warning, 10% stop-work), continuous monitoring, automatic shutdown.
   4. **Administrative**: Confined-space permit, workplace-environment monitoring, shift-change TBM, respiratory-protection program.
   5. **PPE**: Organic-vapor respirator (organic-vapor cartridge/PAPR), chemical gloves, safety goggles, flame-resistant clothing (last resort).
3. **Confined-space control**: Before entry into airframe/tank interiors, measure gas concentrations (oxygen, LEL, toxic gases), set up ventilation and a standby rescue team, enforce access control, and operate an attendant-entrant-supervisor trio.
4. **Flammable vapor & dust control**: Handle solvents only under LEV; apply static grounding/bonding and explosion-proof electrical equipment; collect composite dust via HEVA/HEPA vacuuming and suppress fugitive emissions. Conforms with DSSMA and OSHA-KR hazardous-chemical standards.
5. **Toxic exposure control**: Comply with exposure limits for methylene chloride (probable carcinogen), styrene, and MEK. Aligns with 산업안전보건법 (OSHA-KR) Article 57 (workplace-environment measurement); assess glove adequacy (chemical-breakthrough time).
6. **Emergency response**: Pre-establish use of suitable extinguishing agents for solvent fire (foam/dry powder/CO2; water restricted), rescue/evacuation on confined-space incident, and skin/eye-exposure flushing and medical treatment.
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain workplace-environment measurement results, confined-space permits, solvent-usage logs, and dust-collector inspection records.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/defense/defense-defense-weapons-assembly-composite-solvent-record.json`](../../../../../evidence-models/domains/industry/defense/defense-defense-weapons-assembly-composite-solvent-record.json) (skeleton, `status: draft`)

- **Record ID format**: `DEFENSE-WEAPONS-ASSEMBLY-COMPOSITE-SOLVENT-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as solvent type/quantity, confined-space gas measurements, LEV performance, monitoring results, and respirator/glove fit.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 방위사업법 Article 28
- 방위사업법 Article 53
- 총포·도검·화약류 등 단속법 Article 9
- 총포·도검·화약류 등 단속법 Article 23

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 방위사업법 | DAA | Defense Acquisition Act |
| 총포·도검·화약류 등 단속법 | FSESA | Act on the Safety Control of Firearms, Swords, Explosives, etc. |

## 7. Regulatory Notes
Weapons-system assembly, composite, and solvent work is governed under the overarching obligations of explosives safety (총포·도검·화약류 등 단속법/FSESA) and defense-industry safety management (방위사업법/DAA). However, the organic-solvent and combustible-dust exposure/fire controls themselves are most directly tied to the 산업안전보건법 (OSHA-KR) standards on hazardous chemicals, confined spaces, and workplace-environment measurement. Note: DAA Article 18 was deleted on 2020.3.31 (confirmed in prior compliance remediation); the current safety-management anchor is Article 53. This workflow's `schema.yaml` legal_basis uses the defense composite auto-filled anchor set listed above, with OSHA-KR sub-regulations providing the detailed chemical-substance standards.

## 8. Outsourcing Note
Defense weapon systems involve a prime (system integrator) coordinating many subcontractors (composite parts, painting, assembly, facility maintenance), making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The prime must ensure this workflow's controls (confined-space entry, static control, toxic-solvent exposure control) are applied by composite, painting, and cleaning subcontractors down the contracting chain, and must specify security and safety requirements in the contract.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
