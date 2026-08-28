# Findings — SKILL-layer HPGSCA stale-citation remediation (PR #96)

**Date**: 2026-08-07
**Agent**: compliance-agent
**Scope**: SKILL source files + 3 named gasterm construction-family workflow files
**Status**: COMPLETE — both audits exit 0

---

## §0 — Verification source

All HPGSCA article mappings were verified via **`legalize_kr.parse_law_structure`** (live law.go.kr full text). Statute resolved by **short name** `고압가스안전관리법` (legalize_kr MST **283919**, lawIdCode 001850). The long-name form `고압가스 안전 관리 및 사업법` returns "Law not found" in legalize_kr — this is a known lookup-key gotcha, NOT an unverified statute.

Canonical in-force article mapping (verified 2026-08-07):

| Article | Title (verified) | Status |
|---------|------------------|--------|
| Art 11 | 안전관리규정 (Safety management regulations) | IN FORCE |
| Art 13 | 시설·용기의 안전유지 (Facility & container safety maintenance) | IN FORCE |
| Art 14 | — | **DELETED 1999.2.8** — never cite |
| Art 15 | 안전관리자 (Safety Manager) | IN FORCE |
| Art 17 | 용기등의 검사 (Container/receptacle inspection) | IN FORCE — topically correct for gas cylinders (용기) |
| Art 22-2 | 상세기준 (Detailed standards delegation to KGS Code) | IN FORCE |
| Art 24 | 허가관청 등의 조치 (Licensing-authority corrective measures) | IN FORCE |
| Art 26 | 사고의 통보 등 (Accident notification: death/injury/poisoning, leak-explosion/fire, facility damage) | IN FORCE |
| Art 28 | 한국가스안전공사의 설립 (KGS establishment) | IN FORCE — **institutional, NOT 응급조치** |

Note: `kr_safety` catalog is STALE for HPGSCA (still indexes deleted Art 14) — legalize_kr is authoritative.

Canonical statute-name form (citations) = **long form**: `고압가스 안전 관리 및 사업법 (HPGSCA)`. Short form `고압가스안전관리법` is acceptable only as a legalize_kr lookup key.

---

## §1 — Per-defect remediation (old → new)

### Tier 1 — Deleted Art 14 citations

#### Defect #1 — `skills/daily/tool-box-meeting/SKILL.md` (semicon TBM row, line ~104)
- **Context**: semicon "Special gas cylinder" TBM. Gas cylinders ARE 용기, so Art 17 (용기등의 검사) is topically correct.
- **Old**: `HPGSCA Art.14/17, CCA Art.20`
- **New**: `HPGSCA Art.17 (용기등의 검사), CCA Art.20`
- **Rationale**: Dropped deleted Art 14; retained Art 17 (verified in-force, container inspection — topically precise for gas-cylinder handling). Consistent with compact 1–2 article per-row table style.

#### Defect #2 — `skills/domains/industry/shipbuilding/painting-coating-fire-toxic-planner/SKILL.md` (line ~386)
- **Context**: Non-Duplication Justification contrasting the sister welding WF. `HPGSCA Art 14/28` (Art 14 deleted; Art 28 institutional) described the welding WF's citations.
- **Old**: `(HPGSCA Art 14/28 + OSHA Art 101)`
- **New**: `(고압가스 안전 관리 및 사업법 (HPGSCA) Art 11/13/15/24/26 + OSHA Art 101)`
- **Rationale**: Aligned to the painting workflow's own authoritative remediated set (`workflows/.../shipbuilding-painting-coating-fire-toxic/README.md` §6 = HPGSCA Art 11/13/15/24/26), which the welding WF shares as the shipbuilding gas-intensive canonical set. Long statute name applied.

#### Defect #3 — `skills/domains/industry/logistics/dangerous-cargo-handling-planner/SKILL.md` (line ~304)
- **Context**: Non-Duplication contrast with cold-storage ammonia refrigerant. Art 14 deleted; short statute name.
- **Old**: `(고압가스안전관리법 Art 14 + OSHA-KR Art 39 confined-space)`
- **New**: `(고압가스 안전 관리 및 사업법 (HPGSCA) Art 13 + OSHA-KR Art 39 confined-space)`
- **Rationale**: Art 13 (시설·용기의 안전유지) is the topical in-force article for closed-loop ammonia refrigerant facility safety; long statute name applied.

### Tier 2 — In-force Art 17/28 with wrong topic label or mismatch

#### Defect #4 — `skills/daily/tool-box-meeting/SKILL.md` (gasterm TBM row, line ~98)
- **Context**: gasterm "Gas pipe opening" TBM. Art 17 (용기검사) is container inspection — wrong topic for pipe/facility operation.
- **Old**: `HPGSCA Art.17, KGS Code`
- **New**: `HPGSCA Art.13 (시설·용기 안전유지), KGS Code`
- **Rationale**: Art 13 (시설·용기의 안전유지) covers facility safety maintenance — the correct topical article for gas-pipe opening/operation.

#### Defect #5 — `skills/domains/industry/steelmaking/coke-oven-pah-heat-stress-planner/SKILL.md` (lines ~60, ~393)
- **Context**: Coke-oven gas facility (byproduct gas). Art 17 (용기검사) mislabeled as "gas facility" — wrong topic. Process-gas piping leak detection = facility safety.
- **Old (line 60, table)**: `HPGSCA Art 17 (gas facility)`
- **New (line 60)**: `HPGSCA Art 13 (시설·용기의 안전유지)`
- **Old (line 393)**: `(HPGSCA Art 17 + OSHA Art 36/38)`
- **New (line 393)**: `(HPGSCA Art 13 + OSHA Art 36/38)`
- **Rationale**: Option (b) from the task — the byproduct-gas-leak-prevent WF addresses facility/piping integrity, which is Art 13 (facility & container safety maintenance), not Art 17 (container inspection). Label corrected to prevent misinformation.

#### Defect #6 — `skills/domains/industry/semicon/pyrophoric-gas-emergency-responder/SKILL.md` (7 occurrences)
- **Context**: Pyrophoric-gas emergency responder. Art 28 = 한국가스안전공사의 설립 (KGS establishment), NOT 응급조치. The accident article is Art 26 (사고의 통보 등).
- **Edits** (all `Article 28 (고압가스 사고 응급조치)` → `Article 26 (사고의 통보 등)`):
  | Line | Old | New |
  |------|-----|-----|
  | 20 (trigger) | `HPGSCA Article 28` | `HPGSCA Article 26` |
  | 42 (anchor cite) | `Article 28 (고압가스 사고 응급조치)` | `Article 26 (사고의 통보 등)` |
  | 126 (notification tree) | `per HPGSCA Art 28` | `per HPGSCA Art 26` |
  | 206 (regulatory_basis JSON) | `Article 28 — 고압가스 사고 응급조치` | `Article 26 — 사고의 통보 등` |
  | 219 (Korean-Specific Standards) | `Article 28 — 고압가스 사고 응급조치 [UNVERIFIED-via-legalize-kr]` | `Article 26 — 사고의 통보 등 [VERIFIED via legalize_kr — MST 283919, 2026-08-07; Art 28 is KGS 설립]` |
  | 253 (non-duplication vs gas-dispersion) | `HPGSCA Art 28 emergency-response protocol` | `HPGSCA Art 26 accident-notification protocol` |
  | 269-272 (Legal Disclaimer) | `Article 28 ... [UNVERIFIED] ... should be re-verified` | `Article 26 ... VERIFIED via legalize_kr (MST 283919) on 2026-08-07` |
- **Rationale**: Art 26 (사고의 통보 등) is the verified accident-notification article (death/injury/poisoning, gas-leak explosion/fire, facility damage) — the correct citation for a pyrophoric-gas emergency-responder skill. The Korean trigger phrase `고압가스 사고 응급조치` (line 19) was RETAINED because it is a generic search hook and DSSMA Art 27 (응급조치) is also cited by this skill. UNVERIFIED disclaimers cleared (verification now complete).

#### Defect #7 — `skills/domains/industry/gasterm/completion-inspection/SKILL.md` (lines ~23, ~46)
- **Context**: SKILL had drifted from its already-remediated workflow (PR #94). Art 28 (KGS 설립) mislabeled as "완성검사" (completion inspection); short statute name.
- **Reference**: `workflows/.../completion-inspection/schema.yaml` legal_basis (PR #94) = `고압가스 안전 관리 및 사업법 Article 22-2 + Article 13`.
- **Old (line 23, frontmatter)**: `고압가스안전관리법 제22조의2 (기술검토), 제28조 (완성검사)`
- **New (line 23)**: `고압가스 안전 관리 및 사업법 제22조의2 (기술검토), 제13조 (시설·용기의 안전유지)`
- **Old (line 46, table)**: `고압가스안전관리법 | Articles 22의2, 28 | 기술검토, 완성검사`
- **New (line 46)**: `고압가스 안전 관리 및 사업법 | Articles 22의2, 13 | 기술검토, 시설·용기의 안전유지`
- **Rationale**: Aligned SKILL to the PR #94 workflow canonical set (Art 22-2 + Art 13). Art 13 is the substantive facility-safety standard that completion inspection enforces. Long statute name applied.

### Tier 3 — Statute-name short → long form (article numbers already correct)

#### Defect #8 — gasterm construction-permit-overview family
- **Files edited (4)**:
  1. `skills/domains/industry/gasterm/construction-permit-overview/SKILL.md` (frontmatter lines 25–26 + table lines 49–50): `고압가스안전관리법` → `고압가스 안전 관리 및 사업법` (including 시행규칙 line)
  2. `workflows/domains/industry/gasterm/construction-permit-overview/schema.yaml` (line 9): `고압가스안전관리법 Article 22-2` → long form
  3. `workflows/domains/industry/gasterm/construction-permit-overview/README.md` (line 7): `고압가스안전관리법 제22조의2, 시행규칙 제7조` → long form
- **Rationale**: Pure statute-name consistency. Art 22-2 verified in-force (상세기준). 시행규칙 (Enforcement Rules) is a separate subordinate regulation; long-form parent name applied consistently per task instruction.

#### Defect #9 — gasterm pre-construction-technical-review family
- **Files edited (3)**:
  1. `skills/.../pre-construction-technical-review/SKILL.md` (frontmatter lines 24–25 + table lines 48–49 + body line 61): `고압가스안전관리법` → long form (3 edits)
  2. `workflows/.../pre-construction-technical-review/schema.yaml` (lines 9–10): both HPGSCA + HPGSCA 시행규칙 → long form
  3. `workflows/.../pre-construction-technical-review/README.md` (line 4): `고압가스안전관리법 (High-Pressure Gas Safety Control Act) 제22조의2 ... 시행규칙 제7조` → long form

#### Defect #10 — gasterm mid-construction-inspection family
- **Files edited (3)**:
  1. `skills/.../mid-construction-inspection/SKILL.md` (frontmatter line 22 + table line 46): `고압가스안전관리법` → long form
  2. `workflows/.../mid-construction-inspection/schema.yaml` (line 9): → long form
  3. `workflows/.../mid-construction-inspection/README.md` (line 4): `고압가스안전관리법 (High-Pressure Gas Safety Control Act) 제22조의2` → long form

---

## §2 — Audit results

| Script | Exit code | Result |
|--------|-----------|--------|
| `bun scripts/co-safety/safety-audit.ts` | **0** | 872 files checked, 0 errors |
| `bun scripts/audit.ts` | **0** | All checks passed (agent/skill/script/memory/language/parity) |

Post-edit verification grep: no residual `고압가스안전관리법` (short form) or deleted `Art 14`/`제14조` citations remain in any edited source file.

---

## §3 — UNVERIFIABLE items

**None.** All 12 defects were verified and remediated against live law.go.kr via legalize_kr (MST 283919). No fabrication.

---

## §4 — Source files edited (for PM sync-skills propagation)

### SKILL source files (10) — PM must run `bun scripts/sync-skills.ts` to propagate to `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`:

1. `skills/daily/tool-box-meeting/SKILL.md` (defects #1, #4)
2. `skills/domains/industry/shipbuilding/painting-coating-fire-toxic-planner/SKILL.md` (#2)
3. `skills/domains/industry/logistics/dangerous-cargo-handling-planner/SKILL.md` (#3)
4. `skills/domains/industry/steelmaking/coke-oven-pah-heat-stress-planner/SKILL.md` (#5)
5. `skills/domains/industry/semicon/pyrophoric-gas-emergency-responder/SKILL.md` (#6)
6. `skills/domains/industry/gasterm/completion-inspection/SKILL.md` (#7)
7. `skills/domains/industry/gasterm/construction-permit-overview/SKILL.md` (#8)
8. `skills/domains/industry/gasterm/pre-construction-technical-review/SKILL.md` (#9)
9. `skills/domains/industry/gasterm/mid-construction-inspection/SKILL.md` (#10)

### Workflow files (6) — Tier 3 named files (no mirror propagation needed):

10. `workflows/domains/industry/gasterm/construction-permit-overview/schema.yaml` (#8)
11. `workflows/domains/industry/gasterm/construction-permit-overview/README.md` (#8)
12. `workflows/domains/industry/gasterm/pre-construction-technical-review/schema.yaml` (#9)
13. `workflows/domains/industry/gasterm/pre-construction-technical-review/README.md` (#9)
14. `workflows/domains/industry/gasterm/mid-construction-inspection/schema.yaml` (#10)
15. `workflows/domains/industry/gasterm/mid-construction-inspection/README.md` (#10)

---

## §5 — Legal disclaimer

Regulatory interpretation is user responsibility. This remediation provides citation-accuracy workflow assistance only, not legal advice. All HPGSCA article mappings were verified against authoritative law.go.kr full text via legalize_kr on 2026-08-07; accuracy is current as of that date.
