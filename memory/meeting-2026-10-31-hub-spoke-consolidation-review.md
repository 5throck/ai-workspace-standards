# Meeting Transcript — 2026-10-31 Hub-and-Spoke Consolidation Review

- **Topic**: Review the proposed Hub-and-Spoke domain consolidation plan (co-develop / co-design / co-security hubs) for gaps and improvements
- **Facilitator**: PM
- **Participants**: architect, security-expert, automation-engineer, docs-writer, auditor (designated red-team seat)
- **Rounds**: 2 (R1 positions → R2 rebuttal on the sharpest disagreement) + synthesis
- **Invariants upheld**: dissent seat occupied; outcome recorded as PROPOSAL (user approval required); dissents preserved verbatim

## Agenda

1. Assess the consolidation plan (hub topology, boundary decision table, delegation channel) against verified workspace facts
2. Identify missing/underspecified items per specialist lens
3. Red-team challenge: necessity, hub selection, governance precedent, proportionality, reversibility

## Round 1 — Positions

### architect (summary)

Position: staged topology sound; plan is a file-promotion plan wearing a topology plan's clothes — needs a machine-readable ownership layer and a reconciliation wave. Key gaps: (1) live collision with today's co-develop variant-asset-adoption (implemented same day) — absorbing co-security canonical would regress adapted copies (PR #61 clobber precedent); (2) boundary table as prose enforces nothing; (3) no hub-ownership declaration in variant.schema.json / workspace-schema.json; (4) non-hub straddling variants (co-safety, co-consult) lack arbitration rules; (5) roster target state unjudged (220 agents stay 220 without a liaison model); (6) versioning/flow policy unspecified; (7) template-less projects (co-architect, co-newbiz) have no upgrade path; (8) hub-unavailability and concurrent-adoption failure modes unaddressed; (9) Phase 1 scope contradicts the ≥3-project convergence rule it cites. Proposals: Phase 1.5 reconciliation wave; hub registry JSON + validator leg; `hub` block in variant schema; prefer L1 channel for generic assets, L2 hub for domain doctrine; roster decision rule applied in Phase 1; versioning policy in ADR + VERSION_MANIFEST; decide co-architect/co-newbiz in Phase 0; Phase 3 depends on the registry, not the skill.

### security-expert (summary)

Position: local-gate/hub-doctrine cut directionally right; two highest-consequence surfaces under-specified. Key verified findings: (1) the "frontmatter-only diffs" premise is FALSE — co-develop's 5-skill security suite copies carry substantive body changes (evaluator rewiring: security-monitor vs security-expert; phase-gate changes; engagement model swap); the adoption design doc says implemented but on-disk state diverges; (2) authorization chain has no cross-project mechanism and the current gate is weaker than assumed — co-security docs/authorization.md is single-engagement, window 2026-09-01→09-30 (EXPIRED 2026-10-31), with unresolved TODO rows; verify-authorization lacks a window-current check; (3) boundary table lacks an incident/escalation category with SLA tiers (SEV1 secret leak → immediate; SEV2 shared-infra vuln → same-day; SEV3 routine); (4) no data-handling rules for vulnerability data in delegation tickets (findings/evidence/reports are a fleet-wide weakness map); (5) PM→PM channel has no trust model — content-as-data mandate, identity verification via git remote/path not self-declaration, no capability escalation, 3-strike abuse rule. Proposals: semantic merge with parameterization (`{{PROJECT_ROLE}}`, `{{PHASE_GATES}}`); authorization-registry (user-only row addition); incident-escalation boundary category; ticket data-handling rules + gitleaks pre-send; ADR-0103 normative trust requirements.

### automation-engineer (summary)

Position: phases directionally sound and map to existing machinery; but Phase 1 cannot run l3-to-variant-pipeline.ts as-is (whole-project promotion only, no asset-level tool), and Phases 2–4 must ride existing fleet tools. Verified: sync-variant-settings.ts hardcodes 14 variants vs 16 projects (co-architect, co-newbiz missing — co-learning missed before, same drift class); agent-mirror parity will block mid-wave if rosters change without regeneration; script_manifest ordering is fail-unsafe one direction (file-first, declare-same-commit); no cross-repo script hash report exists (skill-graph-fleet-report covers skills/agents only); hook-version skew during Phase 3 rollout unaccounted; boundary table must be machine-readable (propagation-map.json pattern). Proposals: new scripts/hub-promotion.ts (atomic per-asset sequence, contract updates same-commit); fix VARIANTS derivation structurally first; run Phase 2 inside project-resync with per-repo dry-run gates; convergence as two stages (fleet report → WARN-soak → blocking); Phase 3 gate rollout order (L0 → propagate → mirrors → wave).

### docs-writer (summary)

Position: Phase 1 surface list materially incomplete — docs/workspace-schema.json v1.7.0 self-declares "SSOT for workspace-wide invariants... validated by validate-templates.ts at pre-commit" and is absent from the plan. Key points: (1) registry must be machine-readable and validator-enforced, not design-doc prose; (2) AGENTS.md pointer-integrity and COMMON-AGENTS parity gates will trip — templates/common/AGENTS.md must be edited whenever L2 AGENTS.md changes; (3) spec-registry projection is load-bearing (audit.ts --spec-check); (4) CONSTITUTION layer-model and anti-swelling rule are semi-load-bearing; (5) ADR-0097 supported-surfaces registration duty; (6) 2026-05-27 hub-and-spoke prior art is locally archived and unverifiable (⚠️ Unverified); (7) no terminology glossary exists anywhere — new vocabulary needs a mini-glossary, ADR-0098 defined-terms constrains phrasing; (8) no fleet-wide communication artifact; (9) same-day design collision (2026-10-31-variant-generators-design.md) needs explicit de-confliction. Proposals: boundary table as registry section; load-bearing vs prose fan-out buckets; glossary inside design doc; ADR compatibility section (ADR-0039/0040, 0048, 0090 size budget — pointer-style additions only, 0097); concrete communication plan (variant-roadmap marker, templates/CHANGELOG, per-repo memory entries via upgrade-project brief, VERSION_MANIFEST drift note).

### auditor — RED-TEAM (verbatim key claims)

Position: "The plan correctly diagnoses real drift but prescribes a topology change where the existing, already-ratified mechanisms — per-suite promotion (2026-10-27 design, status: implemented), the ≥50% L1 commonization gate, ≥3-convergence fleet report, and ordinary design-doc PRs like co-develop's variant-asset-adoption landed *today* — already fix the measured problem incrementally. Hub-and-spoke is 80% re-labeling of existing L2-SSOT behavior plus one genuinely new thing (a delegation channel) that is explicitly deferred to Phase 3 anyway; shipping the topology before the channel is shipping the label without the feature."

Strongest objections: (1) NECESSITY — Phase 1 re-proposes work existing mechanisms already do; net new capability of Phases 0–2 ≈ zero; (2) HUB SELECTION — justified by name-similarity intuition, not data (co-safety 93 skills, co-consult 59 are the largest asset holders yet not hubs); hard-coding three hubs institutionalizes today's accident map; (3) N2 PRECEDENT — ratifying the exception in Phase 0's ADR while deferring the feature burns the precedent on faith; (4) DISTRIBUTED-COMMIT RISK — 16-repo wave lacks partial-failure/version-skew story; PR #61 delivered older template copies over richer project copies; (5) PROPORTIONALITY — measured pain is ~5 drifted skills + ~10 agent clones; two or three ordinary per-suite promotion PRs fix it in a week; (6) NO KILL CRITERIA — no sunset trigger, no rollback story for unwinding doctrine from 16 repos; (7) GOVERNANCE — hub-doctrine/hub-escalation tiers quietly reintroduce a hierarchy the L3 architecture deliberately flattened; who adjudicates spoke-PM vs hub-PM disagreement?

What would change my mind: drift/convergence data table showing hub selection by measured convergence-candidate density; a worked example proving existing mechanisms fail; wave mechanics (hub-merge-before-spoke gating, per-repo dry-run + rollback, skew detector, atomic-per-suite rule); ADR scoped as enabling-not-authorizing (pilot success metric + auto-expiry); kill criteria with named rollback owner.

Minimum viable alternative: (a) three per-suite promotion PRs now using the ratified 2026-10-27 frame; (b) re-judge drifted skills via existing weekly fleet-report cadence; (c) pilot the delegation channel in ONE spoke first, write the N2-exception ADR after pilot results; (d) add a hub-asset skew check to the existing drift-check; (e) formalize hub-and-spoke only if the pilot succeeds AND the same suite needs re-promotion ≥3 times.

## Round 2 — architect rebuttal to red-team

Concessions (accepted): (1) necessity — Phase 0 approval gate, formal boundary-table exercise, topology framing of Phase 1 dropped; what survives is the machine-readable hub registry + skew check; (2) hub selection — becomes PROVISIONAL, determined by a measurable fan-in rule (shared assets consumed by ≥2 other variants; suite-internal depth never qualifies; co-safety/co-consult not hubs under the rule); (3) N2 exception ADR moves AFTER the pilot with pre-declared success metric and 90-day auto-expiry; (4) mitigation of clobber risk is ordering (template richer first), per-repo dry-run gates, never a batched push; (6) kill criteria adopted: sunset if pilot fails OR skew check finds new silent divergence post-registry OR ≥2 re-promotions of one suite in 6 months; rollback = delete registry block (one file); (7) "hub-doctrine/hub-escalation" TIERS DROPPED — a hub is a delivery responsibility, not an authority; adjudication stays with workspace-root PM.

Rebuttals (defended): (1) per-suite PR cadence detects the LAST drift cycle, does not prevent the next — PR #61 happened because nothing declared who owns the suite; the red-team's own skew-check proposal requires a declared expected state, which IS the registry; (2) "wait for ≥3 re-promotions" is the wrong trigger because silent divergence does not increment the counter — the co-develop/co-security fork went unnoticed until this audit; corrected trigger: formalize after pilot succeeds AND (≥1 recurrence OR skew check confirms ≥1 additional silent divergence).

## Synthesis (PROPOSAL — later approved by user with modifications)

| # | Improvement | Status |
|---|---|---|
| 1 | Phase 1 shrunk to 3 per-suite promotion PRs using the ratified 2026-10-27 frame; ADR/topology ceremony removed | Agreed |
| 2 | Machine-readable ownership registry in docs/workspace-schema.json `hub_topology` + validate-templates leg; unregistered cross-variant duplication FAILs | Agreed |
| 3 | Security suite fork is substantive body divergence → semantic merge with parameterization BEFORE any promotion (Phase 1.5 reconciliation) | Agreed |
| 4 | Hub selection by fan-in rule (≥2 consuming variants), not name similarity; co-safety/co-consult excluded unless data shows cross-suite consumption | Agreed |
| 5 | N2 exception ADR written only after pilot success (pre-declared metric + 90-day auto-expiry) | Agreed |
| 6 | Kill criteria explicit (pilot fail / new silent drift post-registry / ≥2 re-promotions in 6 months); rollback = registry block removal (1 file) | Agreed |
| 7 | Hub = delivery responsibility, not authority; adjudication stays at workspace-root PM | Agreed |
| 8 | Incident-escalation boundary category with SEV tiers, locally triggerable without pre-authorization | Agreed |
| 9 | Delegation authorization contract: authorization-registry (user-only rows) + verify-authorization hardening (expiry, project match, no-registry reject); current expired authorization.md cleaned up first | Agreed |
| 10 | Ticket data-handling rules: no PoC/exploit/scanner raw output (ID + severity + affected path only); gitleaks pre-send; git-tracked governance tickets never carry vuln data | Agreed |
| 11 | SSOT fan-out completeness: workspace-schema.json is the most load-bearing surface; load-bearing vs prose buckets; templates/common/AGENTS.md pointer parity; same-day design de-confliction | Agreed |
| 12 | Pipeline mechanics: asset-level promotion script (hub-promotion.ts); sync-variant-settings VARIANTS hardcode fix first; script_manifest file-before-declare; convergence gate WARN-soak → FAIL | Agreed |

PM adjudication on the registry-timing disagreement (architect vs red-team): registry ships WITH Phase 1 — one file + one validator leg is cheap prevention; the red-team's observation that its own skew-check proposal requires a declared expected state concedes the registry's necessity. Dissent preserved above.

## User decisions (post-meeting, via AskUserQuestion)

1. Registry timing: **Phase 1 concurrent** (recommended option accepted)
2. Template-less projects: **co-architect template creation proceeds; co-newbiz excluded** (manual-sync ticket)
3. Consumer roster slimming: **liaison model ratified in advance**

## Action items

- Feed all 12 synthesis items + user decisions into the plan (became v5 baseline)
- Write this transcript (done)
- Design doc + ADR preparation → next phase work (Phase 0)
