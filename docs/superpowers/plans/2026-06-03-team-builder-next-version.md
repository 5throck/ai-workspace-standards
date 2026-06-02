# team-builder Next Version Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement A-04~A-09 improvements to `scripts/team-builder.ts` and `skills/team-builder/SKILL.md` confirmed in the 2026-06-03 quality review meetings.

**Architecture:** Two PRs. PR-1 fixes script internals (phases type, tier multi-platform, runtime validation). PR-2 fixes storage paths and SKILL.md documentation. Each PR is independently testable and deployable.

**Tech Stack:** Bun (TypeScript), YAML frontmatter, Markdown

---

## Files Touched

| File | Change | PR |
|------|--------|----|
| `scripts/team-builder.ts` | A-04 validator, A-05 tier fix, A-07 path constants | PR-1 + PR-2 |
| `skills/team-builder/SKILL.md` | A-06 phases schema, A-08 Step 5 text, A-09 Step 2 criteria | PR-1 + PR-2 |
| `templates/common/scripts/team-builder.ts` | Mirror all script changes | PR-1 + PR-2 |
| `templates/common/skills/team-builder/SKILL.md` | Mirror all skill changes | PR-1 + PR-2 |

---

## PR-1: Script Schema & Validation (A-06 → A-05 → A-04)

### Task 1: A-06 — Fix phases type in SKILL.md JSON schema

**Files:**
- Modify: `skills/team-builder/SKILL.md` (§Proposal JSON Schema, `agentsToCreate.phases`)
- Mirror: `templates/common/skills/team-builder/SKILL.md`

- [ ] **Step 1: Locate the schema block**

  In `skills/team-builder/SKILL.md`, find the `agentsToCreate` example under `## Proposal JSON Schema`:
  ```json
  "phases": [1, 2],
  ```

- [ ] **Step 2: Change phases to string array**

  Replace:
  ```json
  "phases": [1, 2],
  ```
  With:
  ```json
  "phases": ["1", "2"],
  ```

- [ ] **Step 3: Mirror to template**

  Apply the identical change to `templates/common/skills/team-builder/SKILL.md`.

- [ ] **Step 4: Verify no other numeric phase references in SKILL.md**

  Search `skills/team-builder/SKILL.md` for `"phases": [` — should show only the string version now.

---

### Task 2: A-05 — Per-platform tier values in `generateAgentMd()`

**Files:**
- Modify: `scripts/team-builder.ts` (`generateAgentMd` function, lines ~191–252)
- Mirror: `templates/common/scripts/team-builder.ts`

- [ ] **Step 1: Update `AgentToCreate.tier` interface**

  Current interface (line ~26):
  ```typescript
  tier: { claude: string; gemini?: string; antigravity?: string };
  ```
  Add `"gemini-cli"` optional field:
  ```typescript
  tier: { claude: string; gemini?: string; antigravity?: string; "gemini-cli"?: string };
  ```

- [ ] **Step 2: Update `generateAgentMd()` to use per-platform tiers**

  Replace the single `tierVal` constant at the top of `generateAgentMd()`:
  ```typescript
  // Before
  const tierVal = a.tier.claude;
  ```
  With:
  ```typescript
  const claudeTier      = a.tier.claude;
  const geminiTier      = a.tier.gemini       ?? a.tier.claude;
  const antigravityTier = a.tier.antigravity  ?? a.tier.claude;
  const geminiCliTier   = a.tier["gemini-cli"] ?? a.tier.claude;
  ```

- [ ] **Step 3: Update the frontmatter template in `generateAgentMd()`**

  Replace the tier section in the template literal:
  ```typescript
  // Before
  tier:
    claude: ${tierVal}
    gemini: ${tierVal}
    antigravity: ${tierVal}
    gemini-cli: ${tierVal}
  ```
  With:
  ```typescript
  tier:
    claude: ${claudeTier}
    gemini: ${geminiTier}
    antigravity: ${antigravityTier}
    gemini-cli: ${geminiCliTier}
  ```

- [ ] **Step 4: Update remaining `tierVal` references in `generateAgentMd()`**

  The `phasesInline` section and `**Tier**: ${tierVal}` line should use `claudeTier`:
  ```typescript
  **Tier**: ${claudeTier}
  ```
  Also update `updateAgentsMd()` line ~494 where `agent.tier.claude` is used for the roster table — keep as `agent.tier.claude` (roster always shows Claude tier label). No change needed there.

- [ ] **Step 5: Mirror to template**

  Apply identical changes to `templates/common/scripts/team-builder.ts`.

---

### Task 3: A-04 — Runtime proposal validation function

**Files:**
- Modify: `scripts/team-builder.ts` (add `validateProposal()` after interfaces, call it in `main()`)
- Mirror: `templates/common/scripts/team-builder.ts`

- [ ] **Step 1: Add `validateProposal()` function after the interfaces block (~line 93)**

  Insert after the `TeamBuilderProposal` interface closing brace:
  ```typescript
  function validateProposal(obj: unknown): { valid: true; proposal: TeamBuilderProposal } | { valid: false; errors: string[] } {
    const errors: string[] = [];
    if (typeof obj !== "object" || obj === null) {
      return { valid: false, errors: ["Root value must be an object"] };
    }
    const p = obj as Record<string, unknown>;

    if (typeof p.version !== "string")    errors.push("Missing or invalid field: version (string)");
    if (typeof p.timestamp !== "string")  errors.push("Missing or invalid field: timestamp (string)");
    if (typeof p.teamName !== "string")   errors.push("Missing or invalid field: teamName (string)");
    if (!Array.isArray(p.benchmarkSources)) errors.push("Missing or invalid field: benchmarkSources (array)");
    if (typeof p.approvedBy !== "string") errors.push("Missing or invalid field: approvedBy (string)");
    if (typeof p.approvedAt !== "string") errors.push("Missing or invalid field: approvedAt (string)");

    if (typeof p.changes !== "object" || p.changes === null) {
      errors.push("Missing or invalid field: changes (object)");
    } else {
      const c = p.changes as Record<string, unknown>;
      for (const key of [
        "agentsToCreate", "agentsToConvert", "agentsToDelete",
        "skillsToCreate", "skillsToModify", "skillsToReassign", "workflowPhases",
      ]) {
        if (!Array.isArray(c[key])) errors.push(`changes.${key} must be an array`);
      }
    }

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true, proposal: obj as TeamBuilderProposal };
  }
  ```

- [ ] **Step 2: Call `validateProposal()` in `main()` after JSON.parse**

  Locate in `main()` where proposal is currently loaded (look for `JSON.parse`). Replace the bare type assertion:
  ```typescript
  // Before (approximate)
  const proposal = JSON.parse(raw) as TeamBuilderProposal;
  ```
  With:
  ```typescript
  const parsed = JSON.parse(raw);
  const validation = validateProposal(parsed);
  if (!validation.valid) {
    console.error(`${R}[ERROR] Invalid proposal JSON:${Z}`);
    for (const err of validation.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  const proposal = validation.proposal;
  ```

- [ ] **Step 3: Mirror to template**

  Apply identical changes to `templates/common/scripts/team-builder.ts`.

- [ ] **Step 4: Verify script compiles**

  ```bash
  bun --eval "import('./scripts/team-builder.ts')" 2>&1 | head -5
  ```
  Expected: no TypeScript errors.

- [ ] **Step 5: Bump version to 1.1.0 in file header**

  Change `@version 1.0.0` → `@version 1.1.0` in both `scripts/team-builder.ts` and `templates/common/scripts/team-builder.ts`.

---

## PR-2: Path & Documentation (A-07 + A-08 + A-09)

### Task 4: A-07 — Move storage paths to `memory/`

**Files:**
- Modify: `scripts/team-builder.ts` (`CHECKPOINT_FILE` constant, ~line 105)
- Modify: `skills/team-builder/SKILL.md` (Step 5 path reference)
- Mirror both to templates

- [ ] **Step 1: Update `CHECKPOINT_FILE` constant**

  In `scripts/team-builder.ts` (~line 105):
  ```typescript
  // Before
  const CHECKPOINT_FILE = join(CWD, "docs", ".team-builder-checkpoint.json");
  // After
  const CHECKPOINT_FILE = join(CWD, "memory", ".team-builder-checkpoint.json");
  ```

- [ ] **Step 2: Update SKILL.md Step 5 proposal save path**

  In `skills/team-builder/SKILL.md`, Step 5 `On approval:` block, line 1:
  ```
  // Before
  1. Save proposal as `docs/team-builder-proposal-YYYY-MM-DD.json`
  // After
  1. Save proposal as `memory/team-builder-proposal-YYYY-MM-DD.json`
  ```

  Also update the run instruction on line 2:
  ```
  // Before
  2. Instruct the user to run: `bun scripts/team-builder.ts docs/team-builder-proposal-YYYY-MM-DD.json`
  // After
  2. Instruct the user to run: `bun scripts/team-builder.ts memory/team-builder-proposal-YYYY-MM-DD.json`
  ```

- [ ] **Step 3: Mirror script change to template**

  Apply `CHECKPOINT_FILE` change to `templates/common/scripts/team-builder.ts`.

- [ ] **Step 4: Mirror SKILL.md change to template**

  Apply path changes to `templates/common/skills/team-builder/SKILL.md`.

---

### Task 5: A-08 — Remove AI-unilateral execution language from SKILL.md Step 5

**Files:**
- Modify: `skills/team-builder/SKILL.md` (Step 5, line 3 of `On approval:` block)
- Mirror: `templates/common/skills/team-builder/SKILL.md`

- [ ] **Step 1: Locate and replace the permissive sentence**

  In `skills/team-builder/SKILL.md`, Step 5 `On approval:` block:
  ```
  // Before — line 3:
  3. Or, if the Engagement Leader has Bash tool access, run the script directly after informing the user
  ```
  Replace with:
  ```
  3. Do NOT run the script directly. Always wait for the user to execute the command above explicitly.
  ```

- [ ] **Step 2: Mirror to template**

  Apply identical change to `templates/common/skills/team-builder/SKILL.md`.

---

### Task 6: A-09 — Add benchmark source validation checklist to Step 2

**Files:**
- Modify: `skills/team-builder/SKILL.md` (Step 2, after existing quality criteria)
- Mirror: `templates/common/skills/team-builder/SKILL.md`

- [ ] **Step 1: Add checklist after existing criteria**

  In `skills/team-builder/SKILL.md`, Step 2 `Benchmarking quality criteria:` block, after the existing bullet points, add:
  ```markdown
  **Source validation checklist (verify each before citing):**
  1. Publication date within 5 years of current date
  2. Official organizational domain (e.g., mckinsey.com, gartner.com) or peer-reviewed journal with DOI
  3. Primary source preferred — if only a secondary citation is available, note the original source explicitly
  ```

- [ ] **Step 2: Mirror to template**

  Apply identical change to `templates/common/skills/team-builder/SKILL.md`.

---

### Task 7: Bump version and run final audit

- [ ] **Step 1: Bump `@version` in `scripts/team-builder.ts` header to 1.2.0**

  (1.1.0 was set in PR-1 for A-04~A-06; 1.2.0 for PR-2 path/doc changes.)

- [ ] **Step 2: Update SCRIPTS.md version entries**

  In both `scripts/SCRIPTS.md` and `templates/common/scripts/SCRIPTS.md`, change:
  ```
  | `team-builder.ts` | L0 | 1.0.0 | active | ...
  ```
  To:
  ```
  | `team-builder.ts` | L0 | 1.2.0 | active | ...
  ```

- [ ] **Step 3: Run audit**

  ```bash
  bun scripts/audit.ts
  ```
  Expected: `✅ All checks passed.`

- [ ] **Step 4: Run skill lifecycle audit**

  ```bash
  bun scripts/skill-lifecycle-audit.ts
  ```
  Expected: no errors for `team-builder`.
