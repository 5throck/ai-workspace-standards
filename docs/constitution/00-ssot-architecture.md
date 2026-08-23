> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §0 SSOT Architecture
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 0. SSOT Architecture (3-Layer Structure) {#ssot-architecture}

**Principle: The Source of Truth always flows top-down.**

┌─────────────────────────────────────────────────────────────┐
│              SSOT Hierarchy (Top = Authoritative)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tier 1 (= L0) ── Workspace Root  (repo root, e.g. the      │
│            top-level directory returned by `git rev-parse   │
│            --show-toplevel`). The true source. Edit ONLY    │
│            here.                                            │
│                                                             │
│  Tier 2 (= L1 + L2) ── templates/common/ (L1)  +             │
│            templates/co-*/ (L2)                             │
│            Copies of Workspace Root + variant overrides     │
│                                                             │
│  Tier 3 (= L3) ── New Projects  (Projects/<name>/)           │
│            Creation-time snapshot. Independent evolution.   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

> **Tier vs. L-number**: This section's "Tier 1/2/3" is a coarser, 3-bucket grouping predating the finer-grained L0/L1/L2/L3 layer numbering in [CONSTITUTION.md §Terminology Definition](../../CONSTITUTION.md#terminology-definition) — Tier 2 spans both L1 (`templates/common/`) and L2 (`templates/co-*/`). Prefer the L-number terminology when precision between the common and variant template layers matters.

#### SSOT Locations per File

| File | SSOT | Derived Location | Sync Method |
|---|---|---|---|
| `CLAUDE.md` / `GEMINI.md` | Workspace Root | `templates/*/CLAUDE.md` | Manual propagation + `validate-templates.ts` |
| `scripts/*.ts` | Workspace Root `scripts/` | `templates/common/scripts/` | Manual copy + version bump |
| `agents/*.md` | Workspace Root `agents/` | `templates/co-*/agents/` | `bun run agent:verify` |
| `AGENTS.md` | Workspace Root | `templates/co-*/AGENTS.md` | `bun run agent:verify` |
| `.claude/commands/*.md` | Workspace Root | `templates/common/.claude/commands/` + `.gemini/commands/` | Manual propagation |
| `variant.json` | `templates/co-*/` | (None) | Variant itself is the source |
| `docs/context.md` | `templates/common/docs/context.md` | `docs/context.md` in every L3 project (copied verbatim) | `new-project.ts` copy + `validate-templates.ts` WS-07 |
| `README.md` / `README_ko.md` | `templates/common/docs/README.template.md` (+KO) | `templates/co-*/README.md` + `Projects/<name>/README.md` | `generate-variant.ts` `applyTemplate()` + `validate-templates.ts` WS-08 + `verify-readme-sync.ts` |
| `docs/<variant>.context.md` structure (not content) | No file SSOT — a slot schema (`WS09_STRUCTURE_SCHEMA` in `validate-templates.ts`) | Every `templates/co-*/docs/<variant>.context.md`'s heading skeleton | `validate-templates.ts` WS-09 (presence + relative order only, via alias matching) |

> **README enforcement scope**: Phase A `Projects/<name>/` READMEs are generated **self-service** via `scripts/generate-l3-readme.ts` (and at scaffold time by `create-l3-scaffold.ts`) — no CI gate, consistent with the L3 Design Gate exemption (granted under the script's pre-rename name `generate-l2-readme.ts`; both scripts renamed 2026-08-15, exemption unchanged). Phase B `templates/co-*/` READMEs are **hard-enforced** by `validate-templates.ts` Check WS-08 (unchanged). Both paths share the same renderer (`helpers/generate-variant.ts`), so Phase A and Phase B READMEs are structurally identical.

> **`docs/<variant>.context.md` structure vs. content**: unlike the rows above, WS-09 has no single SSOT file to derive from — each variant's *content* stays genuinely variant-specific (Skills/Agents tables, Agent Dispatch Order, Guidelines body), only the *slot skeleton* (Stack → Agents → Skills → [Environment Setup] → Development Workflow → Guidelines → File Organization Policy → Domain Rules) is enforced, matched via alias/regex so domain-flavored heading text (`Tool Stack` vs `Design Stack`) is unaffected. `co-abap` is exempted (structurally distinct SAP/ABAP domain). See `docs/governance/variant-contract.md` § Context.md Structure Standard.

#### Three Types of Flows

**1. Propagation Flow (Workspace → Templates)**
```text
Workspace Root Edit
    │
    ▼ (Mandatory)
templates/common/ sync   ←── Affects all new projects
templates/co-*/ sync     ←── Selective propagation to variants (e.g., pm)
    │
    ▼
bun scripts/audit.ts     ←── Detects missing syncs
```

**2. Override Flow (templates/co-* layer)**
```text
templates/common/   ←── Default (Common SSOT)
        ↑
templates/co-develop/variant.json
        │  agent_overrides: "additive"
        └─→ Overwrites specific sections of pm.md (roster / governance / dispatch)
```

**3. Snapshot Flow (New Project Creation)**
```text
/new-project "name"
    │
    ├── templates/common/  ──→ Copied (Creation-time snapshot)
    └── templates/co-*/    ──→ Copied after variant selection
    │
    ▼
Projects/<name>/   ←── Disconnected from Workspace Root thereafter (No automatic sync)
```

> **Doc-section propagation (ADR-0062)**: beyond whole-file flows, whitelisted marker-based propagation domains (`constitution-context`, `variant-context`) extend the downward Propagation Flow for designated doc sections — marked zones in template docs are rewritten from scrubbed source slices instead of copying whole files.

#### Critical SSOT Violation Patterns (What NOT to do)

| Violation | Reason |
|---|---|
| Editing `agents/` directly in a new project without back-propagating to Workspace | Workspace Root is the SSOT — Reverse flow does not exist |
| Editing Workspace Root and Template simultaneously in the same session | Violates CWD isolation principle (CLAUDE.md §9) |
| Editing `CLAUDE.md` without syncing `GEMINI.md` | Violates platform parity — both files are joint SSOTs |
| Modifying a template without running `validate-templates.ts` | Fails to detect inconsistencies in derived locations |
| A variant (`templates/co-*/`) carrying its own `docs/context.md` | Clobbers common's immutable copy at scaffold time (the variant overlay overwrites it); variant content belongs in `docs/<variant>.context.md` |

**TL;DR**: The Workspace Root is the ONLY editing source. Templates are its copies, and new projects are creation-time snapshots. The flow is strictly one-way: Top-Down.
