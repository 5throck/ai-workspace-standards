# Architecture Decision Records (ADR)

Project-level architecture decisions live in this directory.

## File Convention

- Name: `NNNN-<slug>.md` (e.g. `0001-use-sqlite-for-project-data.md`), numbered sequentially from `0001`.
- Frontmatter:

```yaml
---
status: proposed | accepted | superseded
date: YYYY-MM-DD
author: <agent or role>
---
```

## Rules

1. **One decision per file.** Context, Decision, Alternatives-rejected, Consequences.
2. **Immutable once accepted.** Reversal = a NEW record whose prose/frontmatter names its predecessor via `Supersedes:` — never delete or rewrite history.
3. **Link the evidence.** Reference the artifacts (findings, ledgers, profiles) the ruling rested on.
4. **Gate-moment rulings are dual-tracked**: gate approvals, escalations, and go/no-go calls additionally emit a decision record at `docs/decisions/DEC-YYYYMMDD-NN.md` — see the `decision-record` skill (workspace ADR-0061).

## Variant Anchor — co-game

Registered rule: **[GAME-R1]** — maze layout changes must validate against ROM-accurate reference data (`co-game.context.md`, Domain Rules).

Likely first records: ROM reference-data update policy; performance-profiling thresholds for rendering/collision; ghost-AI specification change control.
