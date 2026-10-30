# Backport Cycle Judgment Report — User-Directed Cycle 2026-10-30 (co-deck, co-abap, co-safety)

- **Date**: 2026-10-30
- **Cycle type**: user-directed backport review (three projects: co-deck, co-abap, co-safety)
- **Gate ruling**: DEC-20261030-01 (the cycle's governing adjudication — both the port-backlog dispositions below and the parallel co-safety evidence-plane promotion were adjudicated under it)
- **Procedure**: project-resync Step 2/2b via `scripts/backport-diff.ts` v1.1.0 (region-aware verdict columns per the hardening design)
- **Author**: docs-writer (dispatched by PM; judgment tables reproduce the auditor's findings)

## 1. Governing specs

| Spec | Role in this cycle |
|------|--------------------|
| `docs/designs/2026-08-28-project-template-backport-design.md` (with its 2026-10-30 addendum) | Base backport procedure: delta source, window construction, promote / stays-project / discarded-stale vocabulary |
| `docs/designs/2026-09-19-actor-model-and-evidence-backport-design.md` (with its 2026-10-30 addendum) | Evidence-plane treatment (schemas, skills, provenance records as promotable class) |
| `docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md` | Verdict columns (PORT_CANDIDATE / REDELIVER / ADJUDICATE / NO_ACTION) feeding the judgment |
| `docs/designs/2026-10-27-sync-overwrite-policy-design.md` §6 | Adjudicated-port procedure governing the co-deck promotion unit executed this cycle |

## 2. Method and bases

Per Step 2b, the delta source for each project is the union of (a) Step-1 LOCAL-WORK landings and (b) merged PRs in the review window that are non-mechanical. Mechanical = the PR is a template-delivery/workspace-sync landing whose changed files are limited to `template-version.txt`, `.claude/last-upgrade-*`, `docs/VERSION_MANIFEST.md`, `memory/`, and generated registries (per `.agents/skills/project-resync/SKILL.md:99-104`).

| Project | Diff base (verbatim) | Window PRs | Non-mechanical note |
|---------|----------------------|------------|---------------------|
| co-deck | `6e6f799..b3402aa` | #191–#195 | The differ's "workspace sync" subjects are non-mechanical because the changed files fall outside the mechanical whitelist — per SKILL.md:99-104, they MUST enter the judgment |
| co-abap | `64fe01e..5dabe14` | #229–#232 | Includes the 0.24.0 template absorption |
| co-safety | `c77110b..19754e6` | #223–#224 | Numbers are PRE-promotion — see the note below |

**co-safety pre-promotion note**: the row counts above reflect the project tree as of the diff base. A parallel task landed the evidence-plane pair into `templates/co-safety/` the same day — schema `_shared/hot-work-permit-record.json` + skill `evidence-collection-hot-work-permit` + provenance README (six paths total; gate evidence M1–M6 PASS, with M2/M4 via git-log fallback, 94.2-day span) — adjudicated under DEC-20261030-01. That promotion is recorded in §6; it is NOT counted in the co-safety judgment table below, which adjudicates only the in-window project deltas.

## 3. Per-project judgment

### 3.1 co-deck — 69 rows (63 PORT_CANDIDATE / 6 ADJUDICATE / 0 NO_ACTION)

Verdict distribution: 63 PORT_CANDIDATE, 6 ADJUDICATE, 0 NO_ACTION. Dispositions (condensed to essential rows; verdict + disposition + one-line rationale):

| Rows | Verdict | Disposition | Rationale |
|------|---------|-------------|-----------|
| 1 promotion unit (context.md structural slide rules subset + ADR-0002 amendments) | PORT_CANDIDATE / ADJUDICATE | **promote** (executed this cycle) | The only uncovered, template-grade policy content; ported MERGE-style into the template's VARIANT-INJECT block and ADR-0002 as generalized rules (see §6). Rules already delivered template-side by batch 4e0b72b1 (U-20261029-005/-006/-007) and rule 8 (external Humanize engine dependency) were excluded from the port |
| 4 design docs + 4 spec entries | PORT_CANDIDATE | stays-project | Engagement design records — project-side history, not template policy |
| 38 presentation assets | PORT_CANDIDATE | stays-project | Engagement output per Safety Rule 6 (per-project deliverables never port) |
| 17 test scripts | PORT_CANDIDATE | stays-project | Engagement QA tooling (deck-specific verification scripts) |
| 4 record/registry rows | ADJUDICATE | stays-project | Manifest/registry state records; ownership is project-state, census-only |
| 3 deleted-in-range engagement bg images | ADJUDICATE | discarded-stale | Deleted within the window; sanctioned cleanup of engagement background images |

Net: 1 promote, 66 stays-project, 3 discarded-stale.

### 3.2 co-abap — 46 rows (15 PORT_CANDIDATE / 14 ADJUDICATE / 17 NO_ACTION)

Net: 0 promotes. The nightly 0-candidate finding holds, strengthened by the 0.24.0 absorption moving the delivered tree in-sync.

| Rows | Verdict | Disposition | Rationale |
|------|---------|-------------|-----------|
| `secret-patterns.ts` deletion | ADJUDICATE | stays-project (deletion stands) | Sanctioned supersession by `.gitleaks.toml` rules — the pattern set moved config-side |
| Commit `346c743` (validate-agents/validate-skills dynamic-import guard) — special check | ADJUDICATE | NO_ACTION | Byte-identical across project / L0 root / templates-common (`cmp`-verified 4/4) — no delta to adjudicate |
| `.gitleaks.toml` co-abap-* rules | ADJUDICATE | stays-project | Project-specific secret rules; preservation is now automatic via gitleaks-merge 1.1.0 (U-20261029-008 closed) |
| Remaining rows | PORT_CANDIDATE / NO_ACTION mix | stays-project / NO_ACTION | Template-delivered content converged by the 0.24.0 absorption; the rest is project-state or mechanical-window residue |

### 3.3 co-safety — 18 rows (5 PORT_CANDIDATE / 8 ADJUDICATE / 5 NO_ACTION)

Net: 0 promotes from this table. (The evidence-plane PROMOTABLE class was handled by the parallel promotion — see §2 note and §6; not adjudicated here.)

| Rows | Verdict | Disposition | Rationale |
|------|---------|-------------|-----------|
| `safety-audit.yml` CI hardening | ADJUDICATE | stays-project | Deliberate stays-project — project-local L3 CI per its own design doc |
| Remaining rows | PORT_CANDIDATE / ADJUDICATE / NO_ACTION mix | stays-project / NO_ACTION | Project-state records, engagement evidence content, and in-sync delivered rows |

## 4. Fleet echo check

- **co-deck candidate tokens**: absent in all 15 sibling projects and all templates — no echo exposure; the promotion carries no fleet-wide drift risk.
- **Machine-enforceable subset**: already delivered template-side via U-20261029-005/-006/-007 (landing batch 4e0b72b1 — video-slide render branch, minimum content lint, background manifest rules). This cycle's port covers only the judgment-grade (non-mechanically-enforced) remainder.
- **co-safety CI patterns**: absent fleet-wide — `safety-audit.yml` hardening has no echo in sibling projects.

## 5. Cycle summary

| Project | Window | Rows (PC/ADJ/NA) | Promotes | Stays-project | Discarded-stale |
|---------|--------|------------------|----------|---------------|-----------------|
| co-deck | `6e6f799..b3402aa` (#191–#195) | 69 (63/6/0) | 1 (executed) | 66 | 3 |
| co-abap | `64fe01e..5dabe14` (#229–#232) | 46 (15/14/17) | 0 | — | — |
| co-safety | `c77110b..19754e6` (#223–#224, pre-promotion) | 18 (5/8/5) | 0 (evidence plane via parallel promotion) | — | — |
| **Total** | — | **133** | **1 (+ 1 parallel promotion)** | — | — |

## 6. Actions landed this cycle

1. **co-deck structural slide rules port (this task, Part A)**:
   - `templates/co-deck/docs/co-deck.context.md` — generalized "Structural Slide Rules" section added inside the domain-rules VARIANT-INJECT block (after rule 17, before the END marker); version note bumped v4.5 → v4.6 (backport lineage DEC-20261030-01).
   - `templates/co-deck/docs/adr/0002-deck-video-asset-verification-and-injector-binding.md` — four generalized amendments appended (2026-10-29 quality gate + injector chain; round-3 Gate 5 Captions; round-6 original-audio forcing; round-7 caption-off + resolution-independent cue sizing).
2. **co-safety evidence-plane pair (parallel task, same day, DEC-20261030-01)** — six paths: schema `templates/co-safety/schemas/_shared/hot-work-permit-record.json`, skill `templates/co-safety/skills/evidence-collection-hot-work-permit/`, provenance README (plus their engine twins/publish rows per the delivery contract).
3. **Standing validation outcome**: see validation section of the landing PR; Row 4 of the execution plan runs the gates (validate-templates, verify-scripts drift check, unit battery).

## References

- Procedure: `docs/designs/2026-10-27-sync-overwrite-policy-design.md` §6 (adjudicated-port procedure)
- Verdict columns: `docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md` (D5)
- Backport design + addendum: `docs/designs/2026-08-28-project-template-backport-design.md`; evidence-backport design + addendum: `docs/designs/2026-09-19-actor-model-and-evidence-backport-design.md`
- Differ: `scripts/backport-diff.ts` v1.1.0; consumer: `.agents/skills/project-resync/SKILL.md` Step 2/2b (mechanical whitelist at :99-104)
- Prior template-side delivery: batch 4e0b72b1 (U-20261029-005/-006/-007; CHANGELOG [2026-10-30] fix(co-deck) entry)
