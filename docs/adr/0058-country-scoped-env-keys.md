---
status: Accepted
date: 2026-08-23
author: PM + Automation Engineer + Docs Writer
---

# ADR-0058: Country-Scoped Environment Variable Keys

## Context

ADR-0057 defined the `country_scoped_assets` registry criterion as **country-specific data-system access, never language** - but the registry modeled only two asset classes, `skills` and `scripts`. A third asset class was shipping to every project unpruned:

`templates/common/.env.sample` contains `DART_API_KEY` (credential for the DART open API at `opendart.fss.or.kr` - the data system behind the `k-dart` skill) and `LAW_API_OC` (credential for the National Law Information Center open API at `open.law.go.kr` - the data system behind the `k-law` skill). Because `prune-country-scoped-assets.ts` never touched `.env.sample`, every scaffolded project received both keys - complete with their Korean signup-instruction comments - regardless of `--country`.

By the registry's own criterion these env keys ARE country-scoped data-system access. The gap was an **asset-universe hole** (the registry had no way to express env keys), not a missed line of code - so the fix extends the registry's universe, not a special case in the prune helper.

## Decision

### 1. `env` section in the `country_scoped_assets` registry

The registry gains a third section mapping **environment-variable name → country**, alongside `skills`/`scripts`:

```json
"country_scoped_assets": {
  "skills": { "k-law": "KR", "k-dart": "KR", "k-kosis": "KR" },
  "scripts": {},
  "env": { "DART_API_KEY": "KR", "LAW_API_OC": "KR" }
}
```

### 2. Marker blocks in `templates/common/.env.sample`

Country-scoped key blocks are wrapped in marker comments:

```
# >>> country-scoped:KR
...key lines and their explanatory comments...
# <<< country-scoped:KR
```

One block may hold several keys scoped to the same code. Markers carry the block's country code so the prune rule never has to infer scope from key names.

### 3. Same prune rule, both scaffold entry points

`prune-country-scoped-assets.ts` deletes any marker block whose code differs from the target country (including `none` / region-neutral) - the same rule, the same registry, and the same two entry points (`new-project.ts`, `create-l3-scaffold.ts`) as skills and scripts. Non-KR projects receive an `.env.sample` with no Korean data-system credentials and no orphan signup instructions.

### 4. `validate-templates.ts` env-integrity checks

Four ERROR-level checks keep the marker blocks honest:

- A registered env key is absent from every marker block (registry drift)
- Unbalanced or nested markers
- A block's code disagrees with the registry for the keys it contains
- A marker block contains an env key that is not in the registry

### 5. Accepted risks (2026-08-23 country-profile design review)

- **Multi-jurisdiction engagements stay single-primary-jurisdiction** (one `ACTIVE.md`). Supporting per-engagement jurisdiction sets is YAGNI until a real engagement needs more than one primary jurisdiction.
- **Agent/skill prose references to country profiles are not machine-verified** and may drift. This is the accepted cost of advisory prose consumption; the profile files themselves are validated, the prose that cites them is not.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Leave `.env.sample` unpruned; document the keys as optional | Non-KR projects receive orphan Korean signup instructions - violates the region-neutral default posture ADR-0057 established |
| Per-country `.env` fragment files (e.g. `.env.kr.sample`) merged at scaffold time | A second mechanism to maintain; breaks the single-registry SSOT that already drives skills and scripts |
| Prune individual `KEY=` lines without markers | Fragile line-matching; cannot remove the explanatory comment lines above each key, leaving dangling prose |

## Consequences

**Positive:**

- The env-credential surface is governed by the same SSOT registry and the same prune rule as skills and scripts - one declarative source, no divergent flows
- Non-KR projects stop receiving Korean API signup instructions in their `.env.sample`

**Negative / Trade-offs:**

- Marker blocks must stay balanced; the env-integrity validator guards the drift
- `.env` files are invisible to the Markdown language guard, so comments inside them must stay English **by convention** - this PR English-izes the two Korean signup comment lines, and future `.env.sample` edits rely on review discipline rather than tooling

## Implementation

| File | Change |
|------|--------|
| `docs/workspace-schema.json` | `env` section in `country_scoped_assets` |
| `templates/common/docs/workspace-schema.json` | Same-commit mirror (per ADR-0053) |
| `scripts/helpers/prune-country-scoped-assets.ts` | Marker-block prune |
| `scripts/validate-templates.ts` | Env-integrity checks |
| `scripts/verify-country-prune.ts` | New fixture verifier |
| `templates/common/.env.sample` | Marker comments + English signup comments |
| `docs/constitution/06-skill-lifecycle.md` | Registry section wiring (env as a third asset class) |

**References:**

- ADR-0057 - country profile mechanism (`country_scoped_assets` registry, scope criterion, scaffold-time prune)
- ADR-0053 - docs propagation policy (same-commit mirror of `templates/common/docs/workspace-schema.json`)
- `country_scoped_assets` in `docs/workspace-schema.json` - the registry this ADR extends
