---
schemaVersion: 1.0.0
spec-id: korean-plain-language-policy
---

# Korean Plain-Language (`순우리말`-First) Policy Design

## 1. Overview and Objectives

This design establishes a workspace-wide writing policy: when producing Korean-language
content, prefer native Korean words and expressions (`순우리말`) over loanwords
(`외래어`) whenever a natural, widely-understood native equivalent exists.

The policy applies across the three governance levels:

- **L0 (workspace root)**: `CONSTITUTION.md`, root `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
- **L1 (common template)**: `templates/common/AGENTS.md`, `templates/common/CLAUDE.md`,
  `templates/common/GEMINI.md`, `templates/common/docs/context.md`
- **L2 (variants)**: variant `AGENTS.md` files receive the rule via the
  `COMMON-AGENTS` marker-inject propagation domain

## 2. Policy Statement

The canonical rule text (English, per the English-only documentation rule; Korean
examples in backticks so the `validate-md-language.ts` gate passes):

> **Korean Plain-Language Preference**: When writing Korean documentation or Korean
> translation output, prefer native Korean words (`순우리말`) over loanwords when a
> natural, widely-understood native equivalent exists — e.g. prefer `만들기` over
> `크리에이션`, `알림` over `노티피케이션`, `모음` over `컬렉션` in general prose.
> Loanwords that are effectively settled in Korean (`컴퓨터`, `데이터`, `소프트웨어`,
> `파일`, `사용자 인터페이스` terms) and established international technical terms
> remain permitted — clarity and standard terminology always take precedence over
> forced nativization.

### 2.1 Scope of Application

- **New content**: The rule applies immediately to any new Korean-language document,
  translation, or Korean prose added to existing documents (including `ko/`,
  `locales/ko/`, `*_ko.md` files, and `lang: ko` exception files).
- **Existing content**: No bulk rewrite. Existing Korean documents are nativized
  **incrementally** — whenever a document is edited for other reasons, the editor
  applies the plain-language preference to the touched sections. This is tracked as
  a `kind: manual` governance backlog ticket.

### 2.2 Non-Goals

- No change to the English-only documentation rule; the policy text itself is English.
- No change to `lang: ko` frontmatter exception semantics or `validate-md-language.ts`.
- No forced replacement of settled technical vocabulary where it would harm clarity.

## 3. Placement and Propagation

| Location | Level | Mechanism |
|----------|-------|-----------|
| `CONSTITUTION.md` Language Policy section | L0 | SSOT for the rule (hand edit) |
| Root `AGENTS.md` COMMON-AGENTS block | L0 | Hand-maintained mirror |
| `templates/common/AGENTS.md` COMMON-AGENTS block | L1 | Canonical source for injection |
| 12 variant `AGENTS.md` files | L2 | `bun scripts/propagate-to-templates.ts` (governance-agents domain) |
| `templates/co-safety/AGENTS.md` | L2 | Manual edit (not in `target_variants`) + evaluate map registration |
| Root + L1 `CLAUDE.md` / `GEMINI.md` §4 | L0/L1 | Hand-maintained mirrors |
| `agents/docs-writer.md` | L0 | Behavioral responsibility (terminology consistency owner) |
| `skills/translate/SKILL.md`, `skills/documentation-writing/SKILL.md` | L0 | Skill guidance; variants receive via Fork Model (no ongoing sync) |
| `templates/common/docs/context.md` COMMON-CONSTITUTION zone | L1 | Hand-maintained mirror (docs domain auto-propagation disabled per ADR-0069) |

## 4. Accessibility

Not applicable — pure governance documentation change with no user-facing UI.
No WCAG-relevant interaction surface is introduced or modified.

## 5. Trade-offs

- Incremental (not bulk) nativization of existing documents trades immediate full
  coverage for zero-risk adoption; the backlog ticket keeps the debt visible.
- `co-safety` is outside the propagation `target_variants`, so its block is edited
  manually this session; registering it in `propagation-map.json` is evaluated as
  part of this spec (only if consistent with its deliberate exclusion rationale).

## 6. Verification

1. `bun scripts/validate-md-language.ts` — policy text passes the English-only gate.
2. `bun scripts/propagate-to-templates.ts` — COMMON-AGENTS blocks identical across
   root, L1, and all 13 variant `AGENTS.md` files (including `co-safety`).
3. `bun scripts/audit.ts` — no structural regressions.
