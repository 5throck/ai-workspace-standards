# Design: co-work deck emitter rebase onto ppt-master — adopt-as-is conversion engine behind an adapter boundary

- **Spec ID**: 2026-11-06-deck-emitter-ppt-master-rebase-design
- **Date**: 2026-11-06
- **Status**: Accepted — compatibility spike complete (verdict: feasible with a small adapter; spike report §3 filled) and user gate passed (probe PPTX opened in real PowerPoint without repair prompts, 2026-11-07); decision record DEC-20261106-04 filed; Phase 1 (adapter + emit via their chain) implemented 2026-11-07 (registry status flip `draft → implemented` at the landing commit)
- **Decision record**: docs/decisions/DEC-20261106-04.md — clean-room reversal + MIT adoption posture; to be filed at the user gate (next number after DEC-20261106-03)
- **Supersedes (partial)**: the compile/export tier of docs/designs/2026-11-03-co-work-native-pptx-deck-design.md (§5 compiler, §13 native-object emission, notes subsystem). That spec's authoring + gate tiers remain in force; its Status header is amended, not deleted (D4)
- **Related upstream ticket**: U-20261106-003 (L1: external-dependency manifest + scaffold/upgrade support; status waiting, triage ready)
- **Owner**: architect (PM Gateway dispatch)
- **Tiers**: L0 (workspace manifest + scaffold/upgrade scripts, via U-20261106-003) · L2 (templates/co-work skills + scripts) · project-local (venv, manifest instance, probes)

## 1. Problem and goal

### 1.1 Failure record — the hand compiler cannot reach PowerPoint validity

The hand-rolled DrawingML compiler (templates/co-work/scripts/deck/svg-to-pptx.ts,
v1.6.0) produced **eight classes of PowerPoint-invalid output across three
days** (2026-11-04 → 2026-11-06), each fixed only after PowerPoint-side
repair prompts surfaced it:

| # | Defect class | Fixed in |
|---|---|---|
| 1 | Connector: malformed DrawingML (unclosed `p:cNvPr` + stray quote) — repair prompt on every deck with line shapes | v1.4.1 |
| 2 | notesSlide slide-number `a:fld/@id` GUID leak (literal `{GET-NUM}` is not `ST_Guid`) | v1.5.0 |
| 3 | Structured-layout placeholder `cNvPr id="0"` (illegal zero id) | v1.5.0 |
| 4 | Duplicate shape ids colliding with the spTree group | v1.5.0 |
| 5 | `p:notesMasterIdLst` missing from presentation.xml (CT_Presentation sequence) | v1.5.0 |
| 6 | notesSlide rels incomplete (no notesMaster relationship) | v1.5.0 |
| 7 | Theme part in the wrong namespace (`p:theme` — DrawingML declares `theme` only as `a:theme`) | v1.5.1 |
| 8 | `p:notesMasterId` carrying an illegal `id` attribute (colliding with sldLayoutId space) | v1.5.1 |
| — | Terminal round: notesMaster empty `spTree` + unpaired notesSlide placeholder idx scheme — repaired only by rebuilding the notes subsystem to a python-pptx reference model (v1.6.0) | v1.6.0 |

Every intermediate state passed the pipeline's own gates: ECMA-376 XSD-clean
(`xmllint --schema` against the official transitional schemas), structural
verifier 0/0 findings, python-pptx open, and 100/100 visual acceptance of
rendered previews — yet PowerPoint still showed repair prompts.

### 1.2 Root condition

**No PowerPoint-validation oracle exists in this environment** (Office
automation is TCC-blocked, and the 2026-11-03 no-Office-tooling ruling §11.6
keeps it out by policy). Hand-authoring OOXML therefore keeps re-introducing
PowerPoint-specific gaps that no locally available verifier predicts:
schemas, structural checks, python-pptx, and SVG-rendered previews all
validate *less* than PowerPoint's own open-time reconciliation does. The
v1.6.0 differential diagnosis states it plainly: python-pptx opens
PowerPoint-authored decks; our invented schemes opened broken.

### 1.3 User directive and goal

Per user directive 2026-11-06: **abandon the hand compiler; adopt
[ppt-master](https://github.com/hugohe3/ppt-master) (MIT, Python 3.10–3.14,
74.2k stars) as the conversion engine, consumed AS-IS behind an adapter
boundary** so upstream updates stay cheap. ppt-master shares our architecture
(AI-authored SVG pages → native DrawingML) and is battle-tested at scale —
it carries the PowerPoint-compatibility knowledge our environment cannot
generate.

**Goal**: co-work decks reach a PowerPoint-open deliverable with no repair
prompts, while keeping everything upstream of the emitter ours: content
SSOT, authoring doctrine, quality gates, previews, visual acceptance, and
delivery verification.

## 2. Decisions

### D1 — Adopt ppt-master as-is; the adapter is the ONLY coupling point

ppt-master's conversion chain is consumed **verbatim, never modified**:

```text
total_md_split.py   notes master md → per-page notes
  → finalize_svg.py mandatory preprocessing → svg_final/
  → svg_to_pptx.py  their SVG → DrawingML emitter
  → pptx_opc_validation.py
  → pptx_delivery_check.py
```

A single adapter (our code, Bun/TS) transforms OUR artifacts into their
project format, then runs their scripts inside a project venv. All coupling
is one-directional through the adapter; upgrading ppt-master means moving a
pin, not diffing patches.

| Our artifact | Adapter translation |
|---|---|
| 100 authored SVG pages | their page naming/roster convention |
| `notes/*.md` per-page speaker notes | their notes markdown format |
| native-table `<desc>` JSON payload convention | their `native_payloads.py` convention |

We consume **only their deterministic scripts** — never their LLM/agent
stages (their authoring workflow is agent-oriented; ours is already
superior-gated and stays).

**Alternatives rejected**: (a) keep patching svg-to-pptx.ts — three days of
evidence says each fix round discovers a new PowerPoint-only gap the local
gates cannot see; (b) vendor-and-patch their scripts — breaks cheap upstream
tracking and turns every upstream commit into a merge conflict; (c) rebuild
the emitter on python-pptx directly — re-enters the same hand-authoring trap
one abstraction level down.

### D2 — Generic external-dependency manifest (upstream U-20261106-003)

Distribution uses a **generic external-dependency manifest** (working name
`external-deps.json`; exact format deferred to the upstream ticket's design)
declaring per dependency: repo URL, pinned release tag, install command
(`git clone --depth 1 --branch <pin>`), consumer, compatibility-test entry
point, and `propagation: never`.

Lifecycle:

| Moment | Behavior |
|---|---|
| Scaffold | clone per manifest at the pinned tag |
| Upgrade | check upstream → run compatibility tests → move pin on pass; hold + report on fail |
| Variant promotion / template sync | **NEVER** deliver or accept external-dep parts |

This is a **generic L0 facility for any co-\* variant**; ppt-master is its
first consumer. Filed upstream as **U-20261106-003** (L1 — scaffold fetch in
`scripts/new-project.ts`, update + compat-test in `scripts/upgrade-project.ts`,
manifest convention, propagate exclusion). Until it lands, the local interim
is: clone into a **gitignored project-local path** (e.g.
`presentations/ppt-master/` or a project-local vendor dir), and mark any
interim glue that assumes that path with
`LOCAL-PATCH(upstream-request: U-20261106-003)` so the upstream landing can
find and retire it.

### D3 — What stays ours / what is dropped

| Keep (ours, unchanged) | Drop (replaced by their chain) |
|---|---|
| `deck_content.md` content SSOT + storyline doctrine | `svg-to-pptx.ts` — deprecate after parity (D6) |
| content-diff quality gate (`svg-check.ts` — Bun initially, python port in Phase 2) | our notesMaster/notesSlide emission (their notes subsystem replaces it) |
| resvg previews + visual-judge acceptance | our `<desc>` native-payload convention (→ `native_payloads.py`) |
| delivery checklist, source-verification procedure, feedback cycle | our OOXML/OPC packaging code (fflate zip assembly) |

The authoring discipline (per-page hand-authored SVG, closed contract,
locked tokens) is untouched — the rebase swaps the emitter, not the author.

### D4 — Clean-room reversal, decision record, license posture

The original deck spec 2026-11-03-co-work-native-pptx-de-design was
clean-room ("no code copied") **by user ruling** (DEC-20261103-01, ruling 3).
This rebase **reverses** that ruling: consuming ppt-master as-is is vendored
execution, not concept adaptation. A new decision record
(**DEC-20261106-04**, next number per docs/decisions/) documents at the user
gate: (1) the reversal and its rationale (§1.2 — no local oracle); (2) MIT
license posture — the pinned clone keeps upstream LICENSE/copyright files
intact (never stripped), the template skill doc carries a provenance/
attribution section citing the repo and license, and the adoption is
CHANGELOG-recorded (decks built by an MIT tool are content, not software
redistribution — no per-deck notice); (3) **PyMuPDF/AGPL exclusion** —
ppt-master's optional PDF converter depends on PyMuPDF (AGPL); it is
**excluded from the install list** and from any shipped dependency surface;
(4) supersession mechanics: the original spec's Status header is amended
with a superseded-by pointer scoped to the export tier (its authoring + gate
tiers remain implemented and in force); the doc is **not deleted**, and its
registry entry stays `implemented` — a whole-spec `superseded` flip would be
inaccurate under the registry's single-status model.

### D5 — Compatibility spike gates the design (placeholder)

A spike is running in parallel: the live 100-page deck through their chain,
measuring per-page compatibility rate, Korean/Malgun Gothic fidelity, notes
presence, and native-table state; probe artifact at
Projects/co-work/deliverables/presentations/probes/ppt-master-spike.pptx.
The spike report lands as an appendix file:
Projects/co-work/deliverables/drafts/2026-11-05-gtms-startup-market-research/ppt-master-spike-report_ko.md
(reference only here — content arrives when the spike completes). See §3.

### D6 — Phased plan

- **Phase 1 — adapter + emit via their chain.** Unblocks the
  PowerPoint-open deliverable. The Bun content gate stays; the IR/compiler
  boundary of the old design is temporary glue. venv + interim clone per D2.
- **Phase 2 — retire the Bun deck runtime.** Port the svg-check content-diff
  gate to **python**, switched only after a **differential parity run** (old
  vs new gate over all 100 pages + golden fixtures, identical verdicts);
  evaluate resvg-py for previews; then retire svg-check.ts + svg-to-pptx.ts.
- **Separation rationale**: deliverable unblock must not wait on gate-port
  parity proof — Phase 1 ships value while Phase 2 is proven offline.

### D7 — Verification posture (details in §6)

The oracle hole (§1.2) is closed by substitution, not by local emulation:
their validators (pptx_opc_validation.py, pptx_delivery_check.py) run in-pipe;
a **contract test suite** pins adapter+chain behavior on every pin move;
the compatibility spike measures real-page fit; PowerPoint-side manual open
remains the final field test (user-side, per the standing no-Office-tooling
policy).

### D8 — Risks and mitigations

| Risk | Mitigation |
|---|---|
| Upstream evolution breaks our emit path | contract test suite (fixture project → adapter → their chain → asserted outputs) run on **every** upstream pin move; pin holds on failure (D2) |
| Authoring-contract gaps (our SVG constructs their whitelist does not cover) | adapter transforms uncovered constructs to covered ones; coverage measured in the spike (§3), not assumed |
| Their agent-workflow orientation leaks into our pipeline | we invoke only their deterministic scripts; their LLM stages are never wired (D1) |
| Korean text / Malgun Gothic fidelity | verified in the spike (Korean deck is the spike subject) before the user gate |
| PyMuPDF AGPL contamination | excluded from the install list and dependency surface (D4); their core chain does not require it |
| Interim gitignored clone drifts (unpinned local edits) | clone is read-only by convention; any glue marked `LOCAL-PATCH(upstream-request: U-20261106-003)`; manifest pins the tag once L0 lands |

## 3. Compatibility spike (placeholder — filled by spike report)

Status: **in progress, parallel to this design**. The table below is a
placeholder explicitly marked "filled by spike report — see memory + probe
artifacts". The report lands at
Projects/co-work/deliverables/drafts/2026-11-05-gtms-startup-market-research/ppt-master-spike-report_ko.md;
the probe PPTX is at
Projects/co-work/deliverables/presentations/probes/ppt-master-spike.pptx.

| Metric | Value |
|---|---|
| Pages through their chain | *filled by spike report* |
| Per-page compatibility rate | *filled by spike report* |
| Pages requiring adapter transforms | *filled by spike report* |
| Korean / Malgun Gothic rendering | *filled by spike report* |
| Speaker notes present per page | *filled by spike report* |
| Native-table state | *filled by spike report* |
| PowerPoint probe open result | *filled by spike report* |

Gate rule: the user gate on this design reads the spike report; a
compatibility rate materially below 100% pages-with-transforms feeds the D8
mitigation list before Phase 1 is approved.

## 4. Implementation map

| Tier | Item | File / location | Change |
|---|---|---|---|
| L0 (via U-20261106-003) | External-dep manifest convention | workspace root (`external-deps.json` format designed in that ticket) | new generic facility; scaffold clone / upgrade compat-test / propagate-exclusion wiring in `scripts/new-project.ts` + `scripts/upgrade-project.ts` |
| L2 | pptx-export skill rewrite | templates/co-work/skills/pptx-export/SKILL.md | procedure becomes: adapter → their five-script chain → delivery checklist; provenance/attribution section (D4); major version bump (1.4.0 → 2.0.0, engine swap) |
| L2 | Adapter script (new) | templates/co-work/scripts/deck/ppt-master-adapter.ts | Bun orchestrator: page/notes/payload transforms (D1 table), venv execution of their scripts; interim-path glue marked `LOCAL-PATCH(upstream-request: U-20261106-003)` |
| L2 | svg-to-pptx.ts deprecation path | templates/co-work/scripts/deck/svg-to-pptx.ts | retained through the Phase 1 parity window; header marked DEPRECATED after the Phase 2 switch; registry row status updated in scripts/co-work/SCRIPTS.md; removal in a later round |
| L2 | svg-check.ts | templates/co-work/scripts/deck/svg-check.ts | unchanged in Phase 1; Phase 2 ports the content-diff to python behind the parity gate (D6) |
| L2 | Registries + mirrors | scripts/co-work/SCRIPTS.md, skills/SKILLS.md (+ template mirrors) | re-pinned per house conventions at implementation |
| Project | Runtime environment | project-local venv (Python 3.10–3.14) + gitignored ppt-master clone + `external-deps.json` instance (interim hand-written until L0 lands) | per D2 |
| Project | Probe artifacts | deliverables/presentations/probes/ | spike probe + future pin-move probes |
| Docs | Original spec amendment | docs/designs/2026-11-03-co-work-native-pptx-deck-design.md | Status header gains the scoped superseded-by pointer (D4) — at implementation, after the user gate |

## 5. Out of scope

- **notesSub audio / TTS narration** — unchanged from the original spec's P3
  deferral; still pending an external-TTS provider decision.
- **Slide transitions / animations** — the old `data-slide-transition`
  emission dies with the compiler; re-introduction only as a mapped
  ppt-master capability, if needed, in a future design.
- **pptx_to_svg reverse import** (their edit-native PPTX → SVG path) — not
  adopted now; adopt later if a real round-trip need appears.
- PyMuPDF-backed PDF conversion (AGPL — excluded outright, D4).
- Template mining, MP4 export, and their LLM authoring stages (never wired).
- Any change to co-deck (DEC-20261103-01 placement ruling stands).

## 6. Verification plan

1. **Spike evidence** (pre-gate): spike report §3 complete; probe opens in
   PowerPoint without repair prompts (user-side manual open — the only real
   oracle in this environment).
2. **Contract test suite** (Phase 1 acceptance + every pin move): a fixture
   project passes through adapter + their full chain; assertions on OPC
   validation pass, delivery check pass, page count, notes presence, table
   emission; failure holds the pin (D2/D8).
3. **Differential gate parity** (Phase 2 switch criterion): python port vs
   Bun svg-check over all 100 pages + golden fixtures — identical verdicts,
   then and only then the Bun runtime retires (D6).
4. **Preview continuity**: resvg (Phase 1) / resvg-py evaluation (Phase 2)
   renders still feed the existing visual-judge acceptance.
5. **Governance gates**: `bun test` (deck golden tests updated for the
   deprecation pins), `bun scripts/validate-templates.ts`,
   `bun scripts/audit.ts` green at implementation; spec registry updated
   `draft → implemented` only after the user-approved round lands.

## 7. References

- docs/designs/2026-11-03-co-work-native-pptx-deck-design.md (superseded export tier; authoring/gate tiers in force)
- docs/decisions/DEC-20261103-01.md (original clean-room ruling, reversed here), docs/decisions/DEC-20261106-04.md (reversal — filed at user gate)
- U-20261106-003 (L1 external-dependency manifest ticket; status waiting/triage ready)
- https://github.com/hugohe3/ppt-master (MIT; Python 3.10–3.14) — consumed as-is per D1
- templates/co-work/scripts/deck/svg-to-pptx.ts v1.6.0 changelog (defect-class record, §1.1)
- Projects/co-work/deliverables/drafts/2026-11-05-gtms-startup-market-research/ppt-master-spike-report_ko.md (spike appendix — pending)
- Projects/co-work/deliverables/presentations/probes/ppt-master-spike.pptx (spike probe)
- docs/adr/0074 (Design Gate), docs/adr/0061 (decision records)
