# ECC Phase 3 (P2) — Governance Maturation Design

**Status**: Approved  
**Created**: 2026-08-01  
**Phase**: P2 (Post-Phase 2 Hardening)

---

## Scope

Phase 3 resolves pre-existing drift issues and matures the governance infrastructure introduced in Phases 1-2. Focus areas: state persistence, encoding vigilance automation, non-code file scope, and CI integration.

---

## Decisions

### D1: GateGuard State Persistence — PID-Keyed File

**Problem**: `_firstEditSeen` Map is in-memory only; each hook spawn starts fresh.

**Decision**: Use `.gateguard-state/<pid>.json` for per-process state persistence.

- State directory: `.gateguard-state/` (auto-created, in `.gitignore`)
- File format: `Record<string, boolean>` (normalized path → seen flag)
- Lifecycle: `process.on('exit')` cleans up state file
- PID key ensures isolation between concurrent sessions
- Graceful fallback: read failure → empty Map (current behavior)

**Pattern reference**: `scripts/lib/pipeline-state.ts` (simplified).

### D2: Encoding Vigilance — Three Audit Sections

**Problem**: AGENTS.md §7 mandates encoding vigilance but audit.ts only checks UTF-8 BOM.

**Decision**: Add three new audit sections:

| Section | Check | Scope | Severity |
|---------|-------|-------|----------|
| 3.6 CRLF | `detectEncoding()` line endings | `.md`, `.ts`, `.json` | FAIL (source) / WARN (templates) |
| 3.7 Homoglyphs | Cyrillic/Greek/fullwidth regex | `.md`, `.ts` | FAIL |
| 3.8 Zero-Width | U+200B-200F, U+2028-202E, U+2060, U+FEFF | `.md`, `.ts`, `.json`, `.yaml` | FAIL |

**Implementation**: New functions in `encoding-utils.ts`, new sections in `audit.ts`.

### D3: GateGuard Non-Code File Scope — GOVERNED_CONFIG_PATHS

**Problem**: Markdown/config files are de facto un-gated (git grep uses JS/TS globs only).

**Decision**: New `GOVERNED_CONFIG_PATHS` constant with lighter reference-based gating.

- Default paths: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `CONSTITUTION.md`, `package.json`
- Gating logic: `git grep -l '<filename>'` for reference search
- References found → ask/deny (same as code files)
- No references → allow

### D4: Test Fixture Drift — Strip L0 Headers

**Problem**: `_test-consumer.ts` / `_test-module.ts` have shebang + JSDoc in L0 but not L1.

**Decision**: Strip L0 headers to match L1 (bare code). Test fixtures don't need executable headers.

### D5: CI Hook Test Visibility

**Decision**: Add explicit "Hook reliability tests" step in CI between integration tests and Tier 3 Auditor. Tests already run via `bun run test` glob — explicit step adds visibility.

---

## File Manifest

| File | Action | Complexity |
|------|--------|:----------:|
| `scripts/hooks/_test-consumer.ts` | Modify (strip headers) | Trivial |
| `scripts/hooks/_test-module.ts` | Modify (strip headers) | Trivial |
| `scripts/hooks/gateguard-fact-force.ts` | Modify (state persistence + config gating) | Medium |
| `scripts/lib/encoding-utils.ts` | Modify (homoglyph + zero-width detection) | Medium |
| `scripts/audit.ts` | Modify (sections 3.6-3.8) | Medium |
| `.gitignore` | Modify (add `.gateguard-state/`) | Trivial |
| `.github/workflows/test.yml` | Modify (hook test step) | Low |
| `CONSTITUTION.md` | Modify (§11 updates) | Low |
| `docs/adr/0021-platform-settings-parity-policy.md` | Modify (Amendment 2) | Low |
| `scripts/SCRIPTS.md` | Modify (version bumps) | Low |

---

## Explicitly Deferred

| Item | Reason |
|------|--------|
| Claude Desktop App re-verification | No new Anthropic docs; advisory remains accurate |
| E2E hook tests in CI | Requires CLI binaries in CI — environment limitation |
| GateGuard CI pre-merge gate | Already covered by existing audit pipeline |

---

## Platform Coverage

| Component | Claude CLI | Claude Desktop App | Gemini CLI | Antigravity |
|-----------|:----------:|:----------:|:----------:|:-----------:|
| GateGuard State Persistence | ✅ | ✅* | ✅ | ❌ |
| GateGuard Config Gating | ✅ | ✅* | ✅ | ❌ |
| Encoding Vigilance Audit | ✅ | — | — | — |
| CI Hook Test Step | ✅ | — | — | — |

\* Claude Desktop App: conditionally supported (bundled CLI)
