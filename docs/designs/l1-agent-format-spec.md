# L1 Agent Format Specification

> **Status**: Active — Wave 2a
> **Created**: 2026-06-19
> **Authors**: architect (design), automation-engineer (TypeScript interface), auditor (governance)
> **Related**: ADR-0043, `scripts/helpers/agent-similarity-analyzer.ts`, `scripts/helpers/agent-promote.ts`

---

## 1. Agent Layer Overview

The workspace uses a three-tier agent architecture:

| Layer | Location | Owner | Purpose |
|-------|----------|-------|---------|
| **L0** | `agents/` (workspace root) | workspace maintainer | Cross-variant governance agents (pm, architect, auditor, etc.) |
| **L1** | `templates/common/agents/` | workspace maintainer | Shared specialist agents promoted from 3+ variants |
| **L2** | `templates/co-*/agents/` | variant team | Variant-specific specialists; may extend L1 agents |

**L1 is the new layer** introduced by ADR-0043. It holds agents whose `## Role` + `## Responsibilities` sections are ≥ 80% identical across 3 or more variants, as determined by `agent-similarity-analyzer.ts`.

---

## 2. L2 Agent That Extends L1

### 2.1 File Structure

An L2 agent that extends an L1 agent MUST follow this exact structure:

```markdown
# @extends: l1/<name>@<version>
---
name: <agent-name>
role: "<Display Name>"
status: active
tier:
  claude: high|medium|low
  gemini: high|medium|low
  antigravity: high|medium|low
  gemini-cli: high|medium|low
model: inherit
color: "#XXXXXX"
description: "<variant-specific description>"
examples: [...]
phases: [...]
handoff_to: [...]
handoff_from: [...]
required_skills: [...]
agent_overrides:
  source: l1/<name>
  version: "<semver>"
  sections:
    <section-key>:
      op: append | replace | remove
      items: [...]        # for append / remove
      content: |          # for replace
        ...
---

[Only variant-specific sections not covered by L1 go here.
Sections inherited from L1 without override are omitted.]
```

### 2.2 First-Line Comment (Mandatory)

The file MUST begin with exactly:

```
# @extends: l1/<name>@<version>
```

- `<name>` — kebab-case slug matching the L1 agent file name (without `.md`)
- `<version>` — semver matching `version:` in the L1 agent's frontmatter

This comment enables grep-based discovery without a YAML parser:

```bash
grep -r "# @extends:" templates/co-*/agents/
```

### 2.3 `agent_overrides:` Block

The `agent_overrides:` YAML block specifies the delta between the L1 base and this L2 variant. It lives inside the frontmatter.

**Required fields:**

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | `l1/<name>` — must match an existing file in `templates/common/agents/` |
| `version` | string | semver — must match the L1 agent's current `version:` in AGENTS.md registry |
| `sections` | object | Map of section-key → SectionOverride (see §3) |

**Section keys** map to L1 body section names with `##` stripped and spaces replaced by underscores:

| Section header | Key |
|----------------|-----|
| `## Role` | `role` |
| `## Responsibilities` | `responsibilities` |
| `## Output Format` | `output_format` |
| `## Constraints` | `constraints` |
| `## Meeting Participation` | `meeting_participation` |
| `## Dispatch Protocol` | `dispatch_protocol` |

> `## ⚠️ PM-ONLY INVOCATION` cannot be overridden — it is always inherited verbatim from L1.

---

## 3. TypeScript Interface

```typescript
/**
 * Operator for a section-level override in an L2 agent.
 * - append: add items to the end of the L1 section
 * - replace: replace the entire L1 section with new content
 * - remove: remove specific items from the L1 section (triggers Hard Warning in audit)
 */
export type OverrideOp = 'append' | 'replace' | 'remove';

/**
 * Override specification for a single agent body section.
 * Use `items` for append/remove (bullet-list sections).
 * Use `content` for replace (prose or structured sections).
 */
export interface SectionOverride {
  op: OverrideOp;
  items?: string[];   // required when op is 'append' or 'remove'
  content?: string;   // required when op is 'replace'
}

/**
 * Full agent_overrides block in L2 agent frontmatter.
 */
export interface AgentOverrides {
  source: string;     // e.g., "l1/analyst"
  version: string;    // semver, must match L1 AGENTS.md registry entry
  sections: Partial<Record<string, SectionOverride>>;
}

/**
 * Parsed L2 agent file with override metadata.
 */
export interface L2AgentWithOverrides {
  filePath: string;
  extendsRef: string;         // e.g., "l1/analyst@1.0.0"
  l1Name: string;             // e.g., "analyst"
  l1Version: string;          // e.g., "1.0.0"
  overrides: AgentOverrides | null;
}

/**
 * Result of comparing an L2 agent override against the current L1 version.
 */
export interface VersionDriftResult {
  filePath: string;
  declaredVersion: string;    // version in # @extends: comment
  registryVersion: string;    // current version in AGENTS.md
  isDrift: boolean;
}
```

---

## 4. Override Operator Rules

### 4.1 `append`

Adds items to the **end** of the L1 section. The L1 content remains intact.

```yaml
sections:
  constraints:
    op: append
    items:
      - "All analyses must include CVE reference numbers (format: CVE-YYYY-NNNNN)"
      - "Output must be reviewed by security-expert before delivery"
```

**Result**: L1 constraints + two new items appended.

### 4.2 `replace`

Replaces the **entire** L1 section body. Use when the variant's section is fundamentally different.

```yaml
sections:
  output_format:
    op: replace
    content: |
      Deliverables for co-security engagements:
      - `findings/FINDINGS.md` — structured vulnerability report
      - `findings/CVSS_SCORES.md` — CVSS v3.1 scoring table
      - `findings/REMEDIATION_PLAN.md` — prioritized fix list
```

### 4.3 `remove` ⚠️

Removes specific items from a bullet-list section. **Triggers Hard Warning in audit.ts** because it invalidates constraints or responsibilities defined by L1.

```yaml
sections:
  constraints:
    op: remove
    items:
      - "Never access external APIs without user confirmation"
```

**audit.ts output:**
```
[WARN] agent_overrides 'remove' op detected: templates/co-deck/agents/analyst.md
       → constraints section — removing L1-defined constraint
       → Reason required: add 'remove_reason:' field to the override block
```

When using `remove`, a `remove_reason:` field MUST accompany the item:

```yaml
sections:
  constraints:
    op: remove
    items:
      - "Never access external APIs without user confirmation"
    remove_reason: "co-deck operates in offline-only environments; external API access is architecturally impossible"
```

---

## 5. L1 Agent File Format

L1 agents in `templates/common/agents/` follow the standard 7-section variant specialist format (see `docs/designs/variant-specialist-agent-structure.md`) with two additions:

1. **VARIANT-SECTION markers** on overridable sections:

```markdown
<!-- VARIANT-SECTION: constraints -->
## Constraints

- Constraint A
- Constraint B

<!-- END VARIANT-SECTION: constraints -->
```

2. **`source: L1` in frontmatter** (no `# @extends:` comment — L1 agents do not extend anything):

```yaml
---
name: analyst
source: L1
version: "1.0.0"
promoted-from: co-consult   # variant where this pattern was first identified
...
---
```

---

## 6. Governance Rules

### Freeze Policy

L1 agents are **frozen** for variant teams. Only workspace maintainers may edit files in `templates/common/agents/`.

Changes to L1 agents require:
1. Version bump in L1 frontmatter
2. AGENTS.md registry update (`version` column)
3. All L2 agents referencing the old version emit a drift warning from audit.ts

### Promotion Gate

An L2 agent is eligible for L1 promotion when:
- Its `## Role` + `## Responsibilities` sections achieve Jaccard ≥ 80% similarity in **3 or more variants**
- The similarity is confirmed by `agent-similarity-analyzer.ts` Mode 1 report
- A workspace maintainer approves the promotion

Promotion is executed by `agent-promote.ts` (Wave 2b).

### Audit Checks (Wave 2c)

| Check | Severity | Trigger |
|-------|----------|---------|
| `# @extends:` comment exists but `agent_overrides.source` is missing | FAIL | L2 agent file |
| `agent_overrides.version` ≠ L1 registry version | WARN | L2 agent file |
| `agent_overrides.sections.*.op` not in `append\|replace\|remove` | FAIL | L2 agent file |
| `remove` op present without `remove_reason:` | WARN | L2 agent file |
| `source: l1/<name>` file does not exist in `templates/common/agents/` | FAIL | L2 agent file |

---

## 7. Examples

### Full L2 Agent (co-security/agents/analyst.md)

```markdown
# @extends: l1/analyst@1.0.0
---
name: analyst
role: "Security Analyst"
source: L2
version: "1.0.0"
promoted-from: ~
status: active
tier:
  claude: medium
  gemini: medium
  antigravity: medium
  gemini-cli: medium
model: inherit
color: "#E74C3C"
description: "Variant-specific security data analyst with CVE tracking"
agent_overrides:
  source: l1/analyst
  version: "1.0.0"
  sections:
    constraints:
      op: append
      items:
        - "All analyses must include CVE reference numbers"
        - "CVSS v3.1 scoring required for all findings"
---

## Phase Handoff Protocol

[co-security specific handoff rules — not present in L1]
```

---

## 8. Related Documents

- [`variant-specialist-agent-structure.md`](variant-specialist-agent-structure.md) — base agent format (L2 standalone)
- `docs/adr/0043-l1-agent-layer-hybrid-override.md` — decision record
- `scripts/helpers/agent-similarity-analyzer.ts` — similarity scoring (Wave 2a)
- `scripts/helpers/agent-promote.ts` — promotion execution (Wave 2b)
- `scripts/audit.ts` — override validation checks (Wave 2c)
