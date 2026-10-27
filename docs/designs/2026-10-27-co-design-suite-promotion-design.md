# Design: co-design design-system suite promotion + bilingual user-guide parity to variant template

- **Spec ID**: 2026-10-27-co-design-suite-promotion
- **Date**: 2026-10-27
- **Status**: implemented
- **Tickets**: T-20261027-011 (design-system consistency bundle), T-20261027-012 (bilingual user-guide parity + citation-qualifier convention)
- **Source evidence**: co-design PRs #59 (ba53ecc), #60 (fe90eb9), #62 (loud-skip fix, coordinated not clobbered); cycle 2026-10-27 Step 2 judgment report; project designs `2026-10-27-review-backlog-remediation-design.md` (Ruling 5 citation convention) and `2026-10-27-deferred-items-design.md` (bundle content)

## 1. Problem

The co-design project repo landed a richer design-system suite (PRs #59/#60), but the
2026-10-27 template-delivery upgrade wave (project PR #61) delivered the older template
copies back over them — regressing the project working tree to thin versions
(no per-primitive a11y contract, no field-contract table, 6-phase user-guide instead of
7-phase). Root cause: the richer content was never promoted template-side, so the
template (delivery SSOT) kept overwriting it. The human-triage tickets ask whether the
bundle is template-grade and how its project-only citations can resolve at template level.

## 2. Adjudication frame (ratified)

Governed multi-doc suites are a recognized alternative instantiation shape; co-design is
the DESIGN-specialist variant, so carrying design-system suite assets at the
variant-template level is domain-appropriate IF: (a) the project copy is genuinely
newer/richer (measured both directions), (b) citations resolve at template level or carry
a scope qualifier, (c) the backport gate holds (template-grade reusable; engagement-
specific content stays project).

## 3. Decisions

| # | Candidate | Measure (both directions) | Decision | Citation resolution |
|---|-----------|---------------------------|----------|---------------------|
| 1 | `docs/component-primitives.md` | Project fe90eb9 (329 ln) strictly richer than template/current (255 ln): target/motion token rows, naming-convention block, Accessibility-verification block, 10+ per-primitive a11y blocks (4.5:1 / 3:1), Alert/Badge AA status-triplet rebindings. Template has nothing project lacks. | PROMOTE | `design.md §4/§8`, Ruling 2 E2, spec `2026-10-27-deferred-items-design` → qualified "(project instantiation)" per Ruling 5 style |
| 2 | `docs/screen-patterns.md` field-contract | Project fe90eb9 (50 ln) carries the full field-contract table (trigger / layout skeleton / primary action / empty-loading-error, registry-seeded triggers); current (44 ln) is the thinned regression. | PROMOTE | `docs/design.md` → qualified; `screen-patterns.template.md` → "(L1 common — delivered to projects)"; `2026-09-27` design doc → qualified; 2026-09-06 doc keeps its existing "(L0, workspace root)" qualifier |
| 3 | `docs/design/patterns.registry.yaml` | No template counterpart. Machine-readable mirror of the promoted inventory (declared in its own header); the promoted doc cites it; the smoke test validates it. Not engagement output. | PROMOTE (new path `docs/design/`) | `design.md §6` + spec id → qualified in header comment |
| 4 | `docs/design/components.registry.yaml` | Same rationale; mirrors the promoted primitives contract. | PROMOTE (new path `docs/design/`) | `design.md §6` + spec id + `[DESIGN-R1]` → qualified in header comment |
| 5 | `tests/unit/playground-smoke.test.ts` | No template counterpart. Dependency-free bun:test; all path deps resolve at template level (`playground/src/patterns.ts`, `docs/screen-patterns.md`, promoted registries, `tokens.json` — template == project verified byte-identical for the two). Promoted verbatim from project HEAD = post-PR-#62 loud-skip version (coordinated with T-20261027-013, not clobbered). | PROMOTE (verbatim) | None needed (no out-of-checkout path citations) |
| 6 | `docs/user-guide.md` (7-phase) | Project fe90eb9 7-phase (Phase 0–6) vs template 6-phase (Phase 0–5). 7th phase (QA & Finalization: `bun scripts/audit.ts` gate + `/sync` → PR) is substantive, not padding; §2 task table renumbering consistent. | PROMOTE (verbatim) | All citations are local truths (`phase-definitions.md`, `co-design.context.md`, scripts) — resolve at template level |
| 7 | `docs/user-guide_ko.md` | fe90eb9 KO twin carries full 7-phase parity; `translated_from_hash` == sha256(fe90eb9 EN) — pair internally consistent. verify-readme-sync.ts audits template pairs; pair promoted together to preserve discipline. | PROMOTE (verbatim, as pair with #6) | None needed |
| 8 | `docs/design.md` | §2 Decision Record / §10 Decision Log are engagement output — backport gate (c) fails. | STAYS PROJECT | Citations into it are qualified "(project instantiation)" in promoted docs |
| 9 | docs/design/icon-vocabulary.yaml | Not a ticket candidate; consumed only by project-side design.md §5. | STAYS PROJECT | — |
| 10 | Bilingual-parity validator leg + phase-definitions i18n frontmatter (T-012 "also flagged") | Validator/script hardening + agent frontmatter — outside docs-writer scope; verify-readme-sync v1.5.0 already covers template user-guide pairs. | ROUTED: separate automation-engineer / agent-file dispatch | — |

**Citation-qualifier convention (T-012)**: promoted docs citing project-only targets carry
an explicit scope qualifier in the same breath — "(project instantiation)" for per-checkout
project docs/specs, "(L1 common — delivered to projects)" for L1 assets — following
Ruling 5 of `2026-10-27-review-backlog-remediation-design.md` (qualify, never copy, to
avoid second SSOTs). Qualifiers read truthfully in both template and project context.

## 4. Convergence behavior

After promotion, `upgrade-project.ts Projects/co-design --dry-run --prune-removed` shows:
verbatim copies (user-guide pair, smoke test) template-identical/no-op; the qualifier-
stamped docs and registries as `UPDATE (content changed)` — the next real upgrade delivers
the rich suite into the project, healing the PR #61 regression. Future waves can no longer
clobber the suite because the template now carries it.

## 5. Validation

- `bun run test:unit` exit 0 (194 tests)
- `bun scripts/audit.ts` exit 0, all checks passed (after deterministic skill-graph regeneration: +1 doc node, +2 cites_skill edges from the promoted content)
- `bun scripts/validate-templates.ts` 0 errors, 33 warnings (baseline 33 — none new)
- `bun scripts/verify-scripts.ts --verify` exit 0 (240 scripts)
- `bun scripts/verify-readme-sync.ts` clean (14/14 user-guide pairs incl. templates/co-design at hash 56f60d6e…)
- Smoke test against template root: 4 pass / 1 loud skip (dist absent, by design) / 0 fail, 292 assertions
- Upgrade dry-run: decision log 71 entries, 0 ERROR; no prunes

## 6. Risks

- Qualifier-stamped template copies differ comment-level from project copies until the
  next upgrade wave converges them — accepted; qualifiers are truthful in both contexts.
- The skill-graph gate requires the regenerated `docs/skill-graph.json` / `.md` to land in
  the same commit — included.
