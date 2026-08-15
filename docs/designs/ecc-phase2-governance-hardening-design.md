# ECC Phase 2 (P1) — Governance Hardening & Validation

**Status**: Approved 2026-08-01
**Predecessor**: [ECC Phase 1 Design](ecc-phase1-governance-design.md)
**ADR Reference**: [ADR-0021 Platform Settings Parity Policy](../adr/0021-platform-settings-parity-policy.md)

---

## 1. Overview

Phase 2 hardens and validates the governance infrastructure built in Phase 1. Five deliverables:

1. Command frontmatter JSON schema + validator (lenient)
2. GateGuard `--mode ask|deny` configurable flag
3. `post-write-lifecycle-check.ts` Gemini AfterTool integration
4. Hook reliability unit tests (subprocess-based)
5. ADR-0021 formal amendment + documentation updates

---

## 2. Design Decisions

### 2.1 GateGuard Mode: Configurable Flag

Phase 1 used Claude `ask` mode (non-blocking) and Gemini `deny` mode (blocking).
Phase 2 adds a `--mode ask|deny` CLI flag.

| Mode | Claude Exit | Claude stdout | Gemini Exit | Gemini stdout |
|------|:-----------:|:-------------:|:-----------:|:-------------:|
| `ask` (default) | 0 | `{"decision":"ask","reason":"..."}` | — | — (Gemini ignores flag, always deny) |
| `deny` | 2 | `{"decision":"deny","reason":"..."}` | 2 | `{"decision":"deny","reason":"..."}` |

**Rationale**: Backward compatible — existing `.claude/settings.json` continues to work without changes. Users can opt into `deny` mode when false-positive rates are acceptable.

### 2.2 Command Schema: Lenient (All Optional)

6 of 8 current command files have no frontmatter. Schema validates **only when present**.

| Field | Type | Required? | Validation |
|-------|------|:---------:|------------|
| `description` | string | No | minLength: 10 |
| `gemini-parity` | enum | No | `"full" \| "partial" \| "skip"` |
| `version` | string | No | semver pattern |
| `scope` | enum | No | `"common" \| "claude-only" \| "gemini-only"` |

**Rationale**: Commands are lightweight instruction files. Forcing frontmatter on all 8 files creates noise. Validation only catches malformed existing data.

### 2.3 Gemini AfterTool Integration

`post-write-lifecycle-check.ts` gains `--platform gemini` support, reading AfterTool stdin JSON (`tool_input.path`). Non-blocking — same as Claude PostToolUse.

### 2.4 Hook Tests: Subprocess Only

No E2E testing (Claude/Gemini CLI not in CI). Tests spawn hook scripts directly with mocked stdin JSON and assert on stdout + exit codes.

### 2.5 State Persistence: Deferred

Per-session in-memory Map is sufficient. 3-layer enforcement (Hook → Prompt → Skill) provides full coverage without cross-session state.

---

## 3. File Change Manifest

### New Files (4)

| File | Description |
|------|-------------|
| `schemas/command.schema.json` | JSON Schema draft-07 for command frontmatter (lenient) |
| `tests/unit/hook-gateguard.test.ts` | GateGuard subprocess unit tests (7 cases) |
| `tests/unit/hook-post-write-lifecycle.test.ts` | Post-write lifecycle subprocess unit tests |

### Modified Files (16)

| File | Change |
|------|--------|
| `scripts/validators/schema-validator.ts` | Add `validateCommandFrontmatter()` + command file iteration |
| `scripts/hooks/gateguard-fact-force.ts` | Add `--mode ask\|deny` flag parsing |
| `scripts/hooks/post-write-lifecycle-check.ts` | Add `--platform gemini` stdin parsing + platform routing |
| `.claude/settings.json` | Add `--mode ask` to GateGuard command |
| `templates/common/.claude/settings.json` | Mirror L0 settings change |
| `.gemini/settings.json` | Add AfterTool hook block |
| `templates/common/.gemini/settings.json` | Mirror L0 settings change |
| `scripts/SCRIPTS.md` | Version bump post-write-lifecycle-check.ts |
| `templates/common/scripts/SCRIPTS.md` | Mirror L0 SCRIPTS.md |
| `docs/adr/0021-platform-settings-parity-policy.md` | Formal amendment section |
| `CONSTITUTION.md` | §11.2 GateGuard mode doc, §11.4 command schema |
| `CLAUDE.md` | Hook table AfterTool reference |
| `templates/common/CLAUDE.md` | Mirror L0 |
| `GEMINI.md` | AfterTool hook active, Pre-Edit Quality Gate section |
| `templates/common/GEMINI.md` | Mirror L0 |
| `templates/common/docs/context.md` | AfterTool + GateGuard mode updates |

---

## 4. Platform Coverage After Phase 2

| Component | Claude CLI | Claude Desktop App | Gemini CLI | Antigravity |
|-----------|:----------:|:----------:|:----------:|:-----------:|
| GateGuard Hook | ✅ configurable | ✅* | ✅ deny | ❌ |
| GateGuard Prompt | ✅ | ✅ | ✅ | ✅ |
| Post-Write Lifecycle | ✅ PostToolUse | ✅* | ✅ AfterTool NEW | ❌ |
| Command Schema | ✅ | ✅ | ✅ | ✅ |
| Hook Unit Tests | ✅ subprocess | — | ✅ subprocess | — |

\* Claude Desktop App: conditionally supported (bundled CLI)

---

## 5. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|:----------:|------------|
| GateGuard deny mode false-positive | Low | `ask` default; deny opt-in |
| Gemini AfterTool stdout format mismatch | Medium | Non-blocking WARN only; gate pattern validated by GateGuard |
| Command schema false-positive on old files | Low | All optional; no frontmatter = no validation |

---

## 6. Phase Boundary (Deferred to Phase 3)

| Item | Rationale |
|------|-----------|
| GateGuard state persistence | Per-session sufficient; 3-layer backstop |
| GateGuard non-code file scope | Different risk profile for markdown/config |
| GateGuard CI pre-merge integration | Requires Phase 2 stability |
| Encoding vigilance automation | Phase 1 prompt-level sufficient |
| E2E hook reliability tests | Requires CLI in CI |
| Claude Desktop App hook re-verification | Next Claude Code release |
