---
name: abap-code-review
description: Use when reviewing ABAP source for Clean ABAP conformance before object activation, transport release, or after importing foreign code. Covers the three ABAP-specific dimensions that general-purpose review skills do not - naming conventions, pretty-printer formatting, and anti-pattern compliance - against docs/clean-abap-checklist.md. Trigger on "review the ABAP code", "Clean ABAP check", "naming convention review", "pretty printer check", "anti-pattern scan".
version: 1.0.0
last_reviewed: 2026-08-25
status: active
scope: co-abap
owner: code-writer
prerequisites: vsp MCP server
metadata:
  type: core
  triggers:
    - abap-code-review
    - code review
    - Clean ABAP
    - naming convention
    - pretty printer
    - anti-pattern
---

# ABAP Code Review

## Context

co-develop's general-purpose `code-review` skill covers language-agnostic review practice - it does not cover ABAP-specific compliance. This skill operationalizes the [Clean ABAP Conformance Checklist](../../docs/clean-abap-checklist.md) (`docs/clean-abap-checklist.md`) as a structured review pass over ABAP source. The checklist is the review standard: this skill walks its rule families and cites section numbers - it does not restate or duplicate the rules themselves.

## When to Use

- **Before object activation** - author self-review by `code-writer` immediately after `WriteSource`/`EditSource`, ahead of the post-write chain (SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck)
- **Before the transport release gate** - verification by `test-runner` during the Phase 4 QA pass, and pre-release confirmation by `devops-admin` alongside `docs/transport-release-checklist.md`
- **After receiving foreign code** - legacy imports, repair imports, or code copied from other systems that never passed this variant's gates
- Not for non-ABAP artifacts - general-purpose code review stays with the co-develop `code-review` skill

## Review Dimensions

Walk exactly three dimensions. Each cites the checklist sections that define it.

| Dimension | Checklist sections | What is checked |
|-----------|-------------------|-----------------|
| (a) Naming | §1 | snake_case, no type/Hungarian encoding, plural collections, nouns for classes and verbs for methods, no noise words, consistent terms |
| (b) Pretty-printer & formatting | §10 | ABAP Formatter run before activation, one statement per line, line length, blank-line and bracket placement conventions, alignment and indentation |
| (c) Anti-patterns | §2, §4, §6, §7, §8 | Obsolete language elements (§2), table and string anti-patterns such as DEFAULT KEY (§4), control-flow anti-patterns such as empty IF branches (§6), class/method anti-patterns such as CHECK in the method body or mixed export mechanisms (§7), error-handling anti-patterns such as non-class-based exceptions or silent failures (§8) |

## Execution Steps

1. **Load the review standard** - read `docs/clean-abap-checklist.md` before reviewing. Review against the checklist as written, never from memory.
2. **Walk dimension (a) Naming** - evaluate the object against every rule in checklist §1, recording findings with the section number.
3. **Walk dimension (b) Pretty-printer & formatting** - evaluate against checklist §10, including whether the ABAP Formatter conventions were applied before activation.
4. **Walk dimension (c) Anti-patterns** - sweep checklist §2 (obsolete language elements), §4 (tables & strings), §6 (control flow), §7 (classes & methods), and §8 (error handling) for anti-pattern matches.
5. **Classify each finding**:
   - **blocker** - violates a checklist blocker-severity rule, or matches a check gated `blocker` in the ATC rule pack
   - **should** - SHOULD-level guidance; fix unless a business-justified exception is documented
   - **note** - style preference (the checklist's `nice-to-have` level); no blocking effect
6. **Cross-reference the ATC rule pack** - for every blocker finding, check `scripts/co-abap/atc-rulepack.json` for a matching check and record its `id` where one exists. The rule pack is the system-side execution of the same standard - a finding that maps to a rule-pack blocker check must fail review.
7. **Emit the review table and verdict** - produce the Output Format table below and an overall verdict. Any blocker finding means the review FAILS and the object must not be activated or released until fixed.

## Output Format

| Object | Dimension | Checklist § | Finding | Severity | ATC check (if mapped) |
|--------|-----------|-------------|---------|----------|-----------------------|
| ZCL_EXAMPLE | Naming | §1 | Hungarian prefix `lv_customer` on local variable | blocker | - |
| ZCL_EXAMPLE | Anti-patterns | §2 | Obsolete `MOVE` statement | blocker | obsolete-language-elements |
| ZCL_EXAMPLE | Pretty-printer & formatting | §10 | Chained statements on one line | should | - |

Severity values: `blocker` / `should` / `note`. End with a verdict line: `Review verdict: PASS` or `Review verdict: FAIL (N blocker findings)`.

## Relationship to ATC

This skill is the agent-side review pass over source before activation or release. `scripts/co-abap/atc-rulepack.json` plus VSP's `RunATCCheck` (selection printed by `scripts/co-abap/vsp-audit.ts --change-type <type>`) is the system-side execution of the same checklist. Both derive from `docs/clean-abap-checklist.md`, so:

- **Agreement expected** - a blocker this skill finds that maps to a rule-pack check should also surface as a Priority-1 ATC finding
- **Disagreement means investigate** - ATC passing while this skill fails usually indicates a prose-only rule (naming clarity, comment quality, abstraction level) that ATC cannot check; this skill failing while ATC passes on a mapped check suggests the wrong change-type selection or a suppressed finding

## Out of Scope

- **Performance tuning** - use the `performance-tuning` and `dump-monitor` skills
- **Functional or requirements review** - acceptance-criteria verification belongs to `test-runner` QA reports and the module analysts
- **Transport logistics** - request creation, object assignment, and release mechanics belong to `devops-admin` with `docs/transport-release-checklist.md`

## Related Skills

- [abap-dev](../abap-dev/SKILL.md) - Core ABAP development workflow (BAPI, transport, unit test, performance, impact analysis)
- [post-write-chain](../post-write-chain/SKILL.md) - Mandatory QA gate after every ABAP write operation
- [desktop-app-fallback](../desktop-app-fallback/SKILL.md) - Manual QA chain for Claude Code Desktop App sessions
