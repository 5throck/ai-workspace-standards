> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §0 SSOT Architecture
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 0. SSOT Architecture (3-Layer Structure) {#ssot-architecture}

**Principle: The Source of Truth always flows top-down.**

┌─────────────────────────────────────────────────────────────┐
│              SSOT Hierarchy (Top = Authoritative)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tier 1 ── Workspace Root  (repo root, e.g. the top-level   │
│            directory returned by `git rev-parse --show-     │
│            toplevel`). The true source. Edit ONLY here.     │
│                                                             │
│  Tier 2 ── templates/common/  +  templates/co-*/            │
│            Copies of Workspace Root + variant overrides     │
│                                                             │
│  Tier 3 ── New Projects  (Projects/<name>/)                 │
│            Creation-time snapshot. Independent evolution.   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

#### SSOT Locations per File

| File | SSOT | Derived Location | Sync Method |
|---|---|---|---|
| `CLAUDE.md` / `GEMINI.md` | Workspace Root | `templates/*/CLAUDE.md` | Manual propagation + `validate-templates.ts` |
| `scripts/*.ts` | Workspace Root `scripts/` | `templates/common/scripts/` | Manual copy + version bump |
| `agents/*.md` | Workspace Root `agents/` | `templates/co-*/agents/` | `bun run agent:verify` |
| `AGENTS.md` | Workspace Root | `templates/co-*/AGENTS.md` | `bun run agent:verify` |
| `.claude/commands/*.md` | Workspace Root | `templates/common/.claude/commands/` + `.gemini/commands/` | Manual propagation |
| `variant.json` | `templates/co-*/` | (None) | Variant itself is the source |

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

#### Critical SSOT Violation Patterns (What NOT to do)

| Violation | Reason |
|---|---|
| Editing `agents/` directly in a new project without back-propagating to Workspace | Workspace Root is the SSOT — Reverse flow does not exist |
| Editing Workspace Root and Template simultaneously in the same session | Violates CWD isolation principle (CLAUDE.md §9) |
| Editing `CLAUDE.md` without syncing `GEMINI.md` | Violates platform parity — both files are joint SSOTs |
| Modifying a template without running `validate-templates.ts` | Fails to detect inconsistencies in derived locations |

**TL;DR**: The Workspace Root is the ONLY editing source. Templates are its copies, and new projects are creation-time snapshots. The flow is strictly one-way: Top-Down.
