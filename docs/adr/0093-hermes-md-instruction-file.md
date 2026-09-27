---
status: Accepted
date: 2026-09-27
author: PM
---

# ADR-0093: Hermes.md — a Hermes-Specific Behavioral Instruction File (Amends ADR-0088 D2)

## Context

ADR-0088 D2 (2026-09-25) rejected a `HERMES.md` instruction twin: Hermes' context chain is first-found-wins (`HERMES.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`, spike evidence F3), so a twin would shadow `AGENTS.md`, and a copy would fork the instruction SSOT. The same effort's Addendum 1 then found that Hermes caps context files at `context_file_max_chars` (default 20,000) and every `AGENTS.md` in the ecosystem exceeds it — so today Hermes sessions silently lose the governance body beyond the cap.

Requirement (user, 2026-09-27): create `Hermes.md` — an instruction file for the Hermes Agents platform — at L0, L1, and all 13 L2 variants, referencing `CLAUDE.md`/`GEMINI.md`/`CODEX.md`/`AGENTS.md`.

## Decision

1. **`Hermes.md` is a Hermes-specific behavioral instruction file, not an AGENTS.md copy** — it is the Hermes member of the `CLAUDE.md`/`GEMINI.md`/`CODEX.md` family: each platform reads its own file, and each is self-sufficient on behavioral essentials. This AMENDS ADR-0088 D2: the D2 anti-goal was a *copy-twin* that shadows AGENTS.md and forks the SSOT; a thin behavioral file in the sibling-family pattern avoids both (no registry content is duplicated — `AGENTS.md` is pointed at as the neutral SSOT registry).
2. **Hard size budget**: because Hermes loads exactly ONE context file, `Hermes.md` is kept under 19,000 characters at every layer (design margin below the 20,000 default cap). The truncation finding becomes the design constraint that justifies thin-plus-pointers.
3. **Family conventions apply in full**: one merge-managed `COMMON-HERMES` zone, English-only language-gate protection, governance-L1 propagation with the boundary-policy transform (Project Boundary Policy at L1/L2), MERGE-managed upgrade delivery on the `hermes`/`all` platform profiles, scaffold retention on the `hermes` profile, and L2 copies in all 13 variants.
4. **AGENTS.md pointer amended in one line**: the header note "Hermes Agent reads THIS file directly — no separate instruction file exists for it" is replaced by naming `Hermes.md (Hermes Agents)` alongside the sibling platform files; `AGENTS.md` remains the SSOT registry.

## Consequences

- **Positive**: Hermes sessions get a platform-owned instruction entry that fits the 20,000-char cap, carries the shared behavioral essentials, and routes everything else to `AGENTS.md` and the governance doc set; the five-platform instruction story is uniform (every surface has its own file).
- **Cost**: one more governance file in the propagation/gate/upgrade surface (delivery machinery wired once, then constant-driven); a sixth root `.md` file.
- **Neutral**: ADR-0088 D2's original decision record is preserved verbatim with a one-line amendment pointer; the AGENTS.md size-reduction effort (separate design) remains the remedy for AGENTS.md truncation itself.

## References

- Design: `docs/designs/2026-09-27-hermes-md-instruction-file-design.md` (background, requirements R1–R8, alternatives, verification)
- ADR-0088 (Hermes platform support — D2 as amended, F3 first-found-wins chain, Addendum 1 truncation finding), ADR-0077 (Codex twin delivery pattern), ADR-0035/ADR-0048 (AGENTS.md structure/SSOT)
