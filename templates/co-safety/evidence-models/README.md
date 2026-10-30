# evidence-models/

JSON Schema evidence-record models bound by Safety OS workflows via the
`evidence_model:` field in each workflow's `schema.yaml`. Orphan detection
and disposition of unbound models is owned by the audit-agent.

## Layout

- `_shared/base/` — base schemas (`common.schema.json`, `finding.schema.json`,
  `corrective-action.schema.json`) extended by all record models
- `_shared/` — cross-industry records (LOTO, TBM, confined space, hot work permit)
- `domains/functional/` — functional-agent records (PSM, MSDS, training,
  incident investigation, risk assessment, occupational health, contractor
  safety, asset integrity)
- `domains/industry/` — industry-domain records
- `emergency/` — emergency-response records

## Unwired / Reserved Models

Models below are quality-complete (versioned; `legal_basis` minItems >= 3) but
are not referenced by any agent, workflow, skill, doc, or policy file as of the
2026-08-23 orphan re-scan (189 schemas total, 11 unbound). They are **reserved**:
wire only when a covering workflow is authored or an existing workflow's scope
is confirmed to match (additive single-field change to the workflow's
`evidence_model:` binding). Never edit these schemas to force a fit.

| Model | Domain | Intended Owner Agent | Disposition Rationale | Suggested Wiring Milestone |
|-------|--------|----------------------|----------------------|----------------------------|
| battery-electrolyte-nmp-exposure-record | battery | battery-agent | Candidate host `battery-thermal-runaway-prevent` binds its own thermal-runaway record and has no workflow body confirming NMP exposure-monitoring scope; electrolyte/filling/recovery IH monitoring may warrant a dedicated workflow | Dedicated electrolyte handling / NMP recovery exposure-control workflow |
| biotech-bsc-certification-record | biotech | biotech-agent | `biotech-bsl-lab-aerosol-control` already binds its own aerosol-control record; annual BSC field certification is equipment-level and host overlap is not explicit | Additive binding on BSL-lab workflow after specialist scope review |
| datacenter-clean-agent-suppression-record | datacenter | datacenter-agent | `datacenter-ups-fire-safety` covers UPS/ESS fire response but binds its own record; suppression-system function testing is a distinct fire-protection activity | IT-room fire-suppression system inspection workflow |
| defense-test-range-blastoverpressure-record | defense | defense-agent | No existing workflow covers live-fire / static detonation test-range operations | New test-range blast-overpressure & hearing-conservation workflow |
| food-foreign-material-detection-record | food | food-agent | `haccp-ccp-monitoring` binds its own CCP record; metal-detector / X-ray verification overlaps HACCP prerequisites but host coverage is unconfirmed | HACCP prerequisite-program extension or new foreign-material control workflow |
| logistics-yard-rack-collapse-prevention-record | logistics | logistics-agent | No existing workflow covers selective-pallet-rack structural integrity or stacking collapse prevention | New yard rack-collapse prevention workflow |
| railway-thermite-welding-hot-work-record | railway | railway-agent | Thermite rail welding hot work is not covered by catenary, confined-space, bridge-fall, or rolling-stock LOTO workflows | New rail-welding hot-work workflow with track possession closure |
| semicon-waste-neutralization-record | semicon | semicon-agent | `semicon-scrubber-maintenance` covers abatement equipment, not effluent neutralization / discharge-quality verification | New fab waste-neutralization inspection workflow |
| shipbuilding-pre-hot-work-gas-free-record | shipbuilding | shipbuilding-agent | Two plausible hosts (`shipbuilding-welding-fume-gas-safety`, `ship-tank-confined-space`) each already bind their own records; gas-free certificate legally precedes both activities | Resolve host during hot-work permit integration, then wire additively |
| steelmaking-continuous-casting-cooling-water-record | steelmaking | steelmaking-agent | No existing workflow covers continuous-casting machine mold/strand cooling-water integrity checks | New CCM pre-cast cooling-water integrity workflow |
| waste-designated-waste-manifest-record | waste | waste-agent | `waste-designated-hazardous-chemical-treatment` binds its own treatment record; e-manifest chain-of-custody spans generator/transporter/treatment roles beyond that scope | Manifest chain-of-custody workflow, or additive binding after scope confirmation |

## Backport provenance — `_shared/hot-work-permit-record.json` (project-resync Step 2b, 2026-10-30)

Promoted under the standing project→template evidence-backport procedure (design
`2026-09-19-actor-model-and-evidence-backport-design` §4.6/§4.8, 2026-10-30 addendum),
adjudicated PROMOTE by `DEC-20261030-01`. The pair contract is binary: the schema below
lands together with its companion procedure and this provenance record, in one change.

| Field | Value |
|---|---|
| Source project | `Projects/co-safety` |
| Source form | F3 (schema-typed) |
| Promoted record type | `_shared/hot-work-permit-record.json` — the one record type in the project plane absent from the template plane (189/190 project files were byte-identical to the template at promotion time) |
| In-project provenance | Introduced by commit `13dac59` (2026-09-17) via the project's cross-cutting evidence promotion: ADR-0000 checklist 4/4 PASS, ratified by ADR-0012; derived from `psm-hot-work-permit-record.json` with common core fields from the railway thermite-welding, shipbuilding pre-hot-work gas-free, and ehsconst PTW (hot_work) models |
| Skill path that satisfied M6 (plane) | `skills/audit-preparation/SKILL.md` — the FIND/CA collection procedure behind the plane's 18 record instances — plus 55 distinct procedure-step references across the domain skills (`hazop-analysis`, `tar-planning`, `emergency-response`, `benefit-risk-assessor`, and others) |
| Companion procedure (this pair) | `skills/evidence-collection-hot-work-permit/SKILL.md` — a generalization of the project's `skills/permit-to-work/SKILL.md`: preserves the 5-step issuance sequence (classify → risk assessment → control verification → issuance → closure), the record-ID convention (`HWP-<DOMAIN>-YYYY-NNNN`, extending the PTW permit-number convention), and the expiry/closure discipline; drops the engagement language, Korean statutory prose (English anchors retained per the model's registered `legal_basis` base), and project-local tool paths |
| Commit range measured | `e361fc3` (2026-06-18T07:33:33+09:00, first establishing commit in the scanner's measured set) .. `be2b17e` (2026-09-20T13:11:09+09:00, most recent touching commit) = 94.2 days; 55 commits touch `evidence-models/` in total over the range |
| Generalization note | The template copy is an English-normalized port of the project schema: the structural contract (`record_id` pattern, `industry_profile` enum, required set, `$ref`s to `base/common.schema.json`, all field shapes and bounds) is verbatim; the description prose was normalized to English and project-governance references (ADR numbers, ratification state) were removed. The project copy remains the project instance's SSOT; this divergence is deliberate |

### M1–M6 results (scanner `evidence-backport-scan.ts` v1.2.0, run 2026-10-30)

| Test | Result | Evidence |
|---|---|---|
| M1 Decision uptake | PASS | 4 decision records with non-empty `evidence_refs` resolving inside the plane (need >= 3): `DEC-20261013-03`, `DEC-20261013-02`, `DEC-20261013-01`, `DEC-20260917-01` |
| M2 Age and survival | PASS (UNVERIFIED-BY-DELTA) | Span `e361fc3` 2026-06-18T07:33:33+09:00 .. `be2b17e` 2026-09-20T13:11:09+09:00 = 94.2 days (need >= 90) |
| M3 No open supersession dispute | PASS | `evidence-models/migrations/README.md` present (migrations completeness) |
| M4 Contract stability | PASS (UNVERIFIED-BY-DELTA) | Git-log fallback: zero commits touched the plane inside the trailing 30-day window (2026-09-30 .. 2026-10-30), so no breaking contract change is possible in the window |
| M5 Template-grade | PASS | No country-mark or client-identifier filenames (static scan; DEG-E-03 clean) |
| M6a Procedure exists | PASS | Collection-procedure step bodies name the plane's schema paths and record-ID patterns (55 distinct step references) |
| M6b Repeatedly used | PASS | 18 distinct record-id-matching files (9 `FIND-2026-NNNN` + 9 `CA-2026-NNNN`, need >= 3) and 55 distinct procedure-step references (need >= 2) |

Plane verdict at scan time: **PROMOTABLE** — third consecutive cycle, then adjudicated
PROMOTE (`DEC-20261030-01`). Scanner validity note, quoted as reported: 187/190
schema-typed evidence files validate against
`templates/common/schemas/evidence-model.schema.json` (the scanner special-cases the
`_shared/base/` meta-models and two logistics records; the promoted file validates).

**M2/M4 verification method this cycle.** Both marks rest on the §4.5 git-log fallback
over the measured commit range, because the project has no Graph Delta Log history yet:
(1) M2 — the span from the first establishing commit to the most recent touching commit
is 94.2 days, clearing the 90-day bar; (2) M4 — the trailing 30-day window
(2026-09-30 .. 2026-10-30) contains zero plane-touching commits, so no breaking contract
change can have landed inside it. The fallback cannot distinguish a removed edge from a
reformatted file, so the **UNVERIFIED-BY-DELTA marks stay visible in this README and in
the cycle report** until `Projects/co-safety`'s own Graph Delta Log (design §5.7) can
re-verify M2/M4 natively — review owns that check, not the scanner.

Binding introduced by this pair: the companion skill
`skills/evidence-collection-hot-work-permit/SKILL.md` references
`_shared/hot-work-permit-record.json` from its step body, so the promoted model is not
orphan (it postdates the 2026-08-23 orphan re-scan table above, which is retained as a
dated snapshot).
