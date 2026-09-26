---
status: Accepted
date: 2026-09-21
author: PM
---

# ADR-0085: Delivery Semantics — Locale Axis, Platform Profiles, and Equal-Version Drift

## Context

The 2026-09-21 full project review surfaced three open design questions in
`new-project.ts` / `upgrade-project.ts` delivery semantics, filed as tickets
T-20260921-008 (H-2), -015 (M-17), and -017 (M-20). All three concern what a
scaffold or upgrade is supposed to deliver, and all three had drifted into
accidental behavior that no document owned.

1. **Locale (i18n) is not plumbed through creation.** `--country` (jurisdiction)
   is end-to-end automated, but the language axis exists only validator-side:
   `validate-md-language.ts` reads `i18n.locale_codes` from the delivered
   `docs/workspace-schema.json`, no creation flag seeds `locales/<code>.json`,
   and the per-variant exemption key `country_config.locales` is dead code.
   Question: automate a `--locale <code>` flag, or declare locale setup
   deliberately agent-driven?
2. **Platform profiles are asymmetric.** At scaffold time, `claude` removes
   `GEMINI.md` (keeping the `.gemini/` tree), `antigravity` removes `CLAUDE.md`
   (keeping `.claude/`), `codex` removes both `CODEX.md` and `.codex/`; and
   `upgrade-project` re-delivers `.claude/**`, `.gemini/**`, `.agents/**` with a
   plain SYNC claim regardless of the project's recorded `platform=`.
   Question: make claims platform-aware, or document mirrors-as-shared?
3. **Equal-version drift policy differs between passes.** The skills pass
   (v1.37.0) leaves same-version content differences untouched ("⚠️ DRIFT …
   left untouched"); the agents pass restores canonical content (lifecycle-
   stripped comparison). Question: unify the policy or the output?

## Decision

**D1 — Locale setup is agent-driven; no `--locale` flag (T-008).** The
workspace doctrine is that country (jurisdiction) and language are independent
axes, and language work is owned by the `i18n-specialist` agent plus the
`i18n-locale-config`/`i18n-formatting`/`i18n-layout`/`i18n-audit` skills
(ADR-0074 routes that work through the Design Gate; AGENTS.md §3.5 assigns it
Phase 4). A scaffold-time `--locale` flag would duplicate that responsibility
as unattended file-seeding with no glossary, terminology, or translation
memory — the expensive parts of locale setup. Scaffolds therefore deliver only
the **locale SSOT** (`docs/workspace-schema.json`, delivered on both the
new-project and L3 paths since 2026-09-21) and the language policy text; the
i18n-specialist creates `locales/<code>/` content per project on demand.
`country_config.locales` is retired as an undocumented dead key (the validator
reads `i18n.locale_codes` from the schema, not per-variant lists). Revisit
`--locale` only if fleet demand for unattended seeding materializes.

**D2 — Platform mirrors are shared fleet surface; profiles govern primary
instruction files (T-015).** The platform mirrors (`.claude`, `.gemini`,
`.agents`, `.codex` — joined by `.hermes` per ADR-0088, amendment 2026-09-26)
are one distributed skill surface by construction
(ADR-0077 W1; `sync-skills.ts` distributes the SSOT to all five on every run,
including the post-upgrade invocation). A platform profile (`--platform
claude|antigravity|codex|all`) selects which **primary instruction file**
(`CLAUDE.md`/`GEMINI.md`/`CODEX.md`) and which **per-project platform config
seed** the project carries — not which mirrors exist. Consequences, now
documented instead of accidental: single-platform legacy profiles keep the
other platforms' mirror trees (they are inert without their primary file);
`codex` is the only profile that removes a mirror tree, because `.codex/`
additionally carries per-project config (`config.toml`, MCP servers) that is
project-owned by nature (ADR-0076 D4); and upgrade re-delivery of `.claude/**`
et al. is deliberate redundancy that keeps mirrors fresh for an operator who
later switches profile. An operator who truly wants a platform's files gone
removes them project-side and records the opt-out in
`.claude/template-version.txt` `platform=` — upgrade output labels make the
re-delivery visible rather than hiding it.

**D3 — Equal-version drift stays pass-specific; output is labeled (T-017).**
The asymmetry is intentional and each half has a distinct rationale. Skills are
content portfolios with project-legitimate variation (translations, examples):
same-version differences are **preserved** and warned (`⚠️ DRIFT … left
untouched`, additive CATCH-UP for missing files). Agents are
lifecycle-governed registry entries whose canonical form is the template's:
same-version differences are **restored** to canonical (project lifecycle
frontmatter preserved by `writeAgentWithLifecycle`). Unifying either way
either silently loses project tweaks or ships forked agent content. The
implementation change is output honesty: both passes now print the policy
verb — `DRIFT (preserved)` / `DRIFT (restored to canonical)` — so an operator
reading an upgrade log can tell which policy touched the file.

## Consequences

- `validate-md-language.ts` remains the locale enforcement point, reading the
  schema SSOT; `country_config.locales` support is removed from documentation
  and may be removed from the validator in a later cleanup.
- `upgrade-project.ts` agents pass prints `DRIFT (restored to canonical)`;
  skills pass already printed `DRIFT … left untouched`, reworded to
  `DRIFT (preserved)`.
- Platform-profile behavior is unchanged; this ADR is the owning document for
  the semantics. A future platform-aware claim model must supersede this ADR.
- The locale decision is revisitable: a `--locale` flag ADR may supersede D1
  if unattended seeding becomes a fleet requirement.

## References

- Tickets T-20260921-008, -015, -017 (2026-09-21 review H-2/M-17/M-20)
- ADR-0077 (Codex platform parity), ADR-0076 (Codex config ownership),
  ADR-0073 (upgrade coverage policy), ADR-0031 (L1/L2 Fork Model)
- `docs/reports/2026-09-21-project-review-full.md` (H-2/M-17/M-20 findings)
