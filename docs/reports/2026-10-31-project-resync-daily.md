# Daily Project Resync — 2026-10-31

Fleet: 16 projects (`Projects/co-*` glob). Standalone-track: co-architect, co-newbiz. Template at cycle start: 0.24.0 → released **0.25.0** this cycle (MINOR, co-deck render batch; tag `template-v0.25.0`, PR #1762; #1761 closed as superseded-conflict). **Tonight's wave delivers 0.24.0+0.25.0 together** (0.24.0 was undelivered — halted at yesterday's canary).

## Step 0 — Resync audit

All 16 projects: **0 verdict rows** — the manifest-based TOMBSTONE-VIOLATION scan ran fleet-clean (consistent with T-20261029-007's cleared tombstone state). Local dirt: co-newbiz (17, main — session residue) and co-price (2 — ops override + session log) → Step 1.

## Step 1 — Local work

| Project | PR | Content | Path |
|---|---|---|---|
| co-newbiz | #779 | settings/skill-graph/memory residue (17 files) | billing-wall exception (4× 0 steps) → **merged** |
| co-price | #170 | ops session log only (2026-10-30: tunnel diagnosis, credential reset — user table had 0 rows) | billing-wall exception → **merged** |

**co-price `docker-compose.override.yml` deliberately NOT landed**: the file's own header declares it "LOCAL OPS OVERRIDE (untracked)" — it re-binds the pricing-app from 127.0.0.1 to 0.0.0.0:9981 for a Cloudflare tunnel replica, and instructs removal only after the tunnel origin moves. Landing it would change the deployment security posture in-repo. The session log landing references it.

## Step 2 — Backport review (5-surface, verdict columns)

Window deltas: 4 projects (co-deck 69, co-abap 35, co-safety 10, co-price 12); 12 zero-delta.

- **co-deck**: PORT_CANDIDATE = 4 project-only design docs (annotation-cleanup, caption-off-default, caption-sizing-language, individual-backgrounds — session records, no port) + baseline PNGs project-ahead. ADJUDICATE = ADR-0002/context/records mirrors — no port.
- **co-price**: PORT_CANDIDATE includes `docker-compose.override.yml` (human note: deliberately untracked, see Step 1), DEC-20261030-01/-02 + migration/ci-drift design docs (records). **ADJUDICATE `.github/workflows/ci.yml` (+34/… vs template): the project migrated its CI (2026-10-30-ci-migration-drift-gate-design) — a genuinely evolved CI surface, port decision belongs to the human review** (the template's CI form vs the migrated one diverge materially).
- **co-abap**: `.gitleaksignore` project-only (local scan config — no port); ADJUDICATE = records + pm/context mirrors.
- **co-safety**: PORT_CANDIDATE = safety-audit CI hardening design + `.github/workflows/safety-audit.yml` (project-side CI — same class as co-price's ci.yml: project-migrated CI surface, human triage).

### Step 2 PORT-CANDIDATES (design D6, report-only)

| Project | conflict-bound | tombstone | stub-composed | adapted-span |
|---|---|---|---|---|
| co-abap | 0 | 0 | 0 | 87 |
| co-deck | 0 | 0 | 0 | 76 |
| co-price | — (run ABORTED: `.github/workflows/ci.yml` merge failed validation in dry-run — nothing written; the summary never printed) | — | — | — |
| co-safety | 0 | 0 | 0 | 79 |

**Standing workspace-schema conflict class**: NOT flagged tonight for any project (co-architect/co-newbiz/co-price rows absent — the 0.24.0/0.25.0 template carried no further workspace-schema delta; the three projects' evolved schemas are currently in-sync with the template's). The NEW conflict surface is **project-migrated CI workflows** (co-price ci.yml validation abort; co-safety safety-audit.yml PORT_CANDIDATE): projects that own their CI now diverge from the template's CI tree every wave. Human-triage suggestion: add CI workflow paths to the delivery exclude map (like `workflows.md`'s D4 precedent) so project-migrated CI stops colliding — a template-side policy decision.

## Step 2d — Domain Operating Model (read-only diff)

No DOM surface changed in any project this window. (co-newbiz's flow.spec +2/−2 landed pre-window.)

## Step 2e — Upstream request ledger

Open U-tickets: **7** — U-20261029-004 (co-newbiz, backlog: variant-declared generators — cited by #776's drift-gate review as the owning ticket), -005/-006/-007 (co-deck: **delivered** template-side via 4e0b72b1a, project-side delivery rides tonight's wave), -008/-009/-010 (co-abap: **resolved** — gitleaks-merge 1.1.0 preserves project rules; reorder landed; states closed in ca83f51e8). Done/rejected: 46. LOCAL-PATCH pending fleet-wide: **92**.

**Fix→request pairing (this cycle's wave = 0.25.0)**: U-20261029-005/-006/-007 (co-deck) → the wave carries the render/validation batch (estimate-layout v1.4.0, validate-image-manifest v1.1.0, inject-video-players v1.1.0) to the co-deck project — pairing completes on the co-deck merge. No other open request is paired with 0.25.0.

## Step 2f — Learning extraction (FIFO: co-newbiz #772, #776, co-safety #223)

| Landing | Verdict |
|---|---|
| co-newbiz #772 (admin console review, capability-table MISSING_MESSAGE fix) | **reviewed, nothing to extract** — the i18n-namespace-keys scan is a genuinely novel bug-class guard but single-consumer (no second scoped-translator consumer in the fleet); admin UX is domain work. Revisit if a second next-intl consumer appears (T-20261030-004 deferral precedent) |
| co-newbiz #776 (admin console improvements, governance-registry drift gate) | **reviewed, nothing to extract** — the generated-manifest+`--check` pattern is already the established fleet pattern (skill-graph/spec-registry precedents); the actual gap (variants can't declare generators) is already owned by **U-20261029-004** |
| co-safety #223 (U-016/-022 project-side application) | **reviewed, nothing to extract** — byte-identical application of already-extracted template gates; "the delivery application, not a redesign" (its own design doc) |

**0 `learning:` tickets filed (3 clean verdicts — the two near-misses are recorded above). Carried FIFO to next window**: co-abap #229, co-deck #190 lineage, co-price #163, then any new non-mechanical landings.

NO-SILENCE: mechanical landings (Step-1 residue syncs #779/#170, prior-wave deliveries) — reviewed, nothing to extract.

## Step 2b — Evidence backport scan

co-safety **PROMOTABLE** — **ADJUDICATED & DELIVERED**: the user-directed backport cycle (DEC-20261030-01) landed the co-safety evidence pair + co-deck slide rules template-side; PR #1758 carries the remaining variant.json skill_manifest + SKILLS.md + registry pin updates — **blocked only by T-20261031-001** (checklist numeric staleness + rebase). co-newbiz/co-security NOT_YET; 13 NEEDS_TRIAGE (standing no-op class).

## SECRETS GATE

Git-mode gitleaks (full config) over the four delta ranges: **all CLEAN** (co-abap, co-deck, co-price, co-safety — zero findings; the adjudicated allowlist set holds). No project content enters root/templates tonight except the tagged template (full root CI).

## Step 3 — This PR

Report-only landing (judgment report; zero new tickets — 2f clean verdicts and existing routed items only). Design Gate: standing specs 2026-09-25-daily-fleet-review-resync-design (ADR-0089) + 2026-10-07-daily-fleet-learning-extraction-design + 2026-10-28-instruction-ownership-backport-hardening-design.

## Steps 4–5 — v0.25.0 upgrade wave (delivers 0.24.0 + 0.25.0)

Appended after the wave (canary-first; T-20261030-006's fix verified by Phase I slot C — language-gate parent-verbatim tolerance live; tombstone guard per project post-merge).

## Step 6 — Final state

Appended after the wave.
