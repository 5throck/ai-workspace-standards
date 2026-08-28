# Inference-Derived Graph Strategy — Recognizing the co-newbiz Precedent

| Field | Value |
|-------|-------|
| Date | 2026-08-29 |
| Status | accepted (documentation-only, user-approved through iterative plan review) |
| Spec ID | `skillgraph` |
| Governing anchor | [ADR-0060](../adr/0060-skill-relationship-graph-generated-projection.md) + Amendment 4 (this document) |
| Related | `docs/designs/2026-08-28-skill-graph-typed-relations-design.md` (Amendment 3); `docs/designs/2026-08-25-skill-graph-document-layer-design.md`; `Projects/co-newbiz/docs/designs/2026-08-24-multi-element-skill-graph-pilot-design.md` (separate repo, cited not copied) |

## Problem

After Amendment 3 shipped the declarative typed-relation vocabulary
(`relates_to`/`composes_with`/`follows`/`enables` in `SKILL.md` frontmatter),
the natural next step proposed was a "Phase 1.5" experiment: apply that
schema to 2–3 real workflows before building any Phase 2 governance, to see
how the schema actually gets used in practice. The chosen target was
`Projects/co-newbiz`.

Investigation found the premise didn't fit that project. `co-newbiz` does not
use the parent's frontmatter-declared `relates_to` schema at all — it has its
own independently designed, already-complete, and more richly-typed graph
system: `scripts/co-newbiz/graph.ts` (v0.4.0), built per
`docs/designs/2026-08-24-multi-element-skill-graph-pilot-design.md`
(status: COMPLETE). It:

- Derives **7 node types** (skill, agent, procedure, step, artifact, rule,
  decision/adr) and **12 edge types** (`owns`, `member_of`, `executes_agent`,
  `executes_skill`, `produces`, `consumes`, `evaluates`, `anchored_by`,
  `supersedes`, `amends`, `activates_reverses`, `step_of`) purely from
  existing structured SSOTs: `SKILL.md` `metadata.procedure_keys[]`,
  `procedures/_shared/<key>/schema.yaml` step tables,
  `procedures/_kill-criteria/*.json` rule predicates, `docs/adr/`,
  `docs/decisions/`.
- Declares **zero new frontmatter fields** on `SKILL.md`. Every edge is
  inferred by re-reading data that already exists for other reasons.
- Ships a `--check` drift gate (`checkGraphDrift()`) and `context --skill
  <name>` / `context --gate <Name>` commands that print a session-time
  contextual bundle over the derived graph.
- Directly matures what the parent's own 2026-08-25 "Document Layer"
  amendment explicitly deferred: "procedure/artifact/rule/evidence-var node
  types remain project-local strengths (co-newbiz); L0 has no generic
  registries behind them and the amendment refuses to fabricate empty
  structure. Revisit on first generic registry." That pilot is now complete.

This document records the resulting decision: recognize co-newbiz's approach
as a second, equally valid graph-construction strategy within the ADR-0060
family, rather than force-fitting the declarative schema onto a project that
already solved the same problem a different, better-suited way.

## User-Confirmed Decisions

1. **ADR-0060 does not prescribe a graph-construction mechanism.** It
   prescribes a principle — a relationship graph generated as a projection of
   existing SSOTs, never a hand-maintained master store. Two strategies can
   both satisfy that principle.
2. Formally name and recognize the **Inferential** strategy (co-newbiz
   `graph.ts`) alongside the **Declarative** strategy (Amendment 3's
   `relates_to` frontmatter) as ADR-0060 Amendment 4.
3. **Documentation only** — no code changes to co-newbiz (already shipped,
   working, out of scope for this counter-proposal by the user's own
   direction) and no code changes to the parent's `generate-skill-graph.ts`
   (co-newbiz's SSOTs don't exist in the parent workspace or in most other
   `co-*` variants — there is nothing generic to port with only one example).
4. Neither strategy is promoted to L0 default status. co-newbiz is recorded
   as **recognized precedent, not promoted standard**.

## Change Design

### The two strategies

| Strategy | SSOT of the relationship | Right fit when |
|----------|---------------------------|-----------------|
| **Declarative** (Amendment 3) | `SKILL.md` frontmatter (`relates_to`, `prerequisites`) | No other structured data describes execution order/relations — the frontmatter declaration *is* the SSOT |
| **Inferential** (Amendment 4, co-newbiz precedent) | Existing structured data (procedure schemas, rule predicates, decision docs) | The project already has rich structured execution-order/rule data — declaring `relates_to` by hand on top of it would duplicate facts already stated authoritatively elsewhere |

### D1 — The normative rule (load-bearing line of this amendment)

> **An inferential graph MUST NOT introduce a second hand-maintained
> declaration of facts already authoritative elsewhere.**

This is the same anti-pattern ADR-0060's original "generated projection, not
hand-maintained master graph" principle was written to avoid. co-newbiz
simply applies that principle one level deeper: instead of introducing a new
declared field (`relates_to`) as its SSOT, it infers relations from data that
was already authoritative for other reasons (procedure step order, kill-
criteria predicates). Declaring `relates_to` by hand in a project that already
has this structured data would itself be the violation this rule guards
against — a second, drift-prone copy of facts the procedure schema already
states.

### D2 — Provenance by construction

Amendment 3's declarative edges needed `provenance: {file, field, index?}`
added as separate metadata, generated alongside — but distinct from — the
relation itself. co-newbiz's inferential edges don't need that bolt-on,
because the extraction event *is* the provenance: every edge in `graph.ts`'s
output carries `source_ref`, a literal file/line pointer into the SSOT that
produced it, generated as an inherent side effect of reading that SSOT rather
than as separately-declared metadata.

**Recorded observation**: the inferential strategy provides provenance by
construction — because each edge is derived from an authoritative SSOT
location, its provenance is inherent in the extraction event rather than
being separately declared alongside the relationship. Kept as an explicit
architectural observation for whatever Phase 4 ("Graph Intelligence")
eventually designs.

### D3 — Graph-to-agent consumption precedent (forward reference only)

co-newbiz's `context --skill <name>` / `context --gate <Name>` commands are a
real, working answer to "how does an Agent Team actually consume a generated
graph as session-time context" — exactly the direction the original Phase 1.5
proposal was reaching for. This amendment records the precedent for Phase 4 to
pull from later. It does not ask the parent workspace to build anything
resembling it now.

### D4 — Three-stage revisit criterion (not simply "a second project exists")

Per the 2026-08-25 amendment's own deferral language ("revisit on first
generic registry"), this is still co-newbiz's first implementation of the
inferential strategy — its extractors are hardcoded to co-newbiz-specific
directory conventions (`procedures/_shared/`, `procedures/_kill-criteria/`),
and there is no second implementation to compare against. "A second project
exists" is deliberately *not* treated as sufficient justification on its own
for a generic abstraction:

1. **One project** (today, co-newbiz): local precedent only — no action.
2. **A second independent `co-*` project** builds its own inferential
   extractor over its own procedure/rule/artifact-oriented SSOTs: compare the
   two implementations' extraction contracts (what SSOT shapes they read,
   what node/edge types they produce) — no action yet, just comparison.
3. **Only if that comparison confirms a sufficiently common extraction
   contract** between the two — not merely "both exist" — consider
   generalizing the *pattern* (inferential extraction over declared SSOTs)
   into the parent's `generate-skill-graph.ts` as an **opt-in** extraction
   mode. This does not make the inferential strategy a requirement for other
   projects; the declarative strategy stays the default for projects without
   rich procedure/rule SSOTs.

### Resulting ADR structure

```
ADR-0060 — Generated Projection principle
│
├── Amendment 3 — Declarative strategy
│   └── SKILL.md frontmatter (relates_to, prerequisites)
│
├── Amendment 4 — Inferential strategy
│   └── Existing structured SSOTs (procedure/rule/decision — co-newbiz precedent)
│
└── Future — Graph Intelligence
    └── Graph → Context → Routing → Agent (co-newbiz's context --skill/--gate as precedent)
```

## Registrations

| File | Change |
|------|--------|
| `docs/adr/0060-skill-relationship-graph-generated-projection.md` | Amendment 4 appended |
| `docs/designs/2026-08-29-inference-derived-graph-strategy-design.md` | this document |
| `CHANGELOG.md`, `memory/2026-08-29.md` | entries |

No `.ts` script files, no `SKILL.md` files, and no files inside
`Projects/co-newbiz` are touched — 0 code changes.

## Verification

| Check | Result |
|-------|--------|
| ADR-0060 Amendment 4 doesn't contradict any standing principle (generated-projection-only, advisory-only edges, no per-layer L0 graph files) | Confirmed — the amendment explicitly declines to promote anything to L0 |
| Registrations list contains no `.ts`/`SKILL.md` entries | Confirmed — 3 documentation files only |
| `bun scripts/audit.ts` / `bun scripts/validate-templates.ts` | Unaffected by design (no code/schema changes); run to confirm the new doc files don't trip a link-checker or doc-structure validator |
| No unintentional non-English text (English-only policy for ADRs/design docs, no `lang: ko` exception applicable here) | Confirmed by inspection |

## Out of Scope

- Porting `graph.ts`'s extraction logic into `generate-skill-graph.ts` — no
  generic registry exists yet (see D4's three-stage criterion).
- Any code change to `Projects/co-newbiz` — it is a separate, already-shipped
  repository; this document is *about* it, not a change *to* it.
- Building a `context --skill`/`--gate`-equivalent command at the parent
  level — recorded as a Phase 4 forward reference only.
- Skill/edge lifecycle, versioning, migration, or execution-snapshot work —
  unchanged from Amendment 3's Phase 2–5 roadmap.

## References

- ADR-0060 + Amendment 2 (2026-08-28) + Amendment 3 (2026-08-29) — the 3-tier
  declarative architecture this amendment sits alongside.
- `docs/designs/2026-08-25-skill-graph-document-layer-design.md` — the
  original deferral this amendment resolves ("revisit on first generic
  registry").
- `Projects/co-newbiz/scripts/co-newbiz/graph.ts` (v0.4.0) and
  `Projects/co-newbiz/docs/designs/2026-08-24-multi-element-skill-graph-pilot-design.md`
  — the working precedent this amendment recognizes (separate repository,
  cited by path, not copied).
