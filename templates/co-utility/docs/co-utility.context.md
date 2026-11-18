# co-utility — Variant Context

> Variant doctrine for standalone utility/tool applications. This file is the
> specialization overlay on top of the common context delivered from
> `templates/common` at project creation. Principles distilled from the QuickDL
> engagement (the founding co-utility project, 2026-11).

## Tech Stack

A utility ships one core service through several interfaces. The typical shape:

| Layer | Convention |
|-------|------------|
| Core service | one module owning the domain logic (e.g. `src/download_service.py`) |
| Web UI | thin adapter (Flask/HTTP or equivalent) + templates + static assets |
| Desktop shell | pywebview/tray-style adapter hosting the web UI |
| CLI | argparse-style adapter for terminal use |
| i18n | flat JSON locale files beside the loader (e.g. `src/locales/`) |
| Tests | `tests/` — the acceptance bar for every change |

Adapters never re-implement core behavior — a behavior change lands in the
service first, then propagates.

## Agents

Roster (see `AGENTS.md` for the dispatch contract): `pm` orchestrates; `backend`
owns the core service, HTTP API, and CLI; `frontend` owns the web UI and desktop
shell; `i18n-specialist` (common extends-stub) handles locale deliverables; `qa`
owns the test suite; `security` audits external-input surfaces and monitors
dependencies/secrets. Serial write order: backend → frontend → i18n-specialist,
then qa.

## Skills

Variant-exclusive: `post-write-check` — the mandatory post-write quality gate
(workspace audit + project test suite) after any Write or Edit. Common-layer
skills (sync, i18n-audit, security-scan, lifecycle managers) resolve via
`inherits_common` at scaffold time — see the workspace `VERSION_MANIFEST.md`.

## Environment Setup

- Language runtime per the project's declared minimum version.
- Virtual environment (e.g. `.venv/`) at the repo root — gitignored, never
  committed, never mutated by agent work.
- One-time installer (e.g. `src/install.py`) sets up the environment; launchers
  (`.sh`/`.ps1` pairs) wrap daily use.
- Runtime output (e.g. `downloads/`) is repo-level and gitignored.

## Development Workflow

User → PM triage → Design Gate (unless exempt) → specialist dispatch (serial
writes) → QA gate → `/sync` PR. Utility-specific gates:

- **External-input double audit** — URL, path, and subprocess sinks are reviewed
  by `security` at triage (Phase 1) and re-audited before merge (Phase 4).
- **Runtime-output isolation** — output-path changes must keep generated
  artifacts repo-level and gitignored.
- **Atomic locale changes** — locale file + loader registry + language selector
  + test expectations move together.

## Coding Guidelines

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
### Core Rules

1. **Think before coding** —state assumptions; if uncertain, ask.
2. **Simplicity first** —minimum code that solves the problem.
3. **Surgical changes** —touch only what is necessary.
4. **No hardcoded secrets** —always use env vars / the environment sample.
5. **PR required** —all changes via `/sync`; never direct push to the default branch.

### Utility-Specific Rules

- **Minimum runtime version is a contract** — code targets the documented floor
  (e.g. Python 3.8+ means `Optional[str]`, not `X | None`).
- **One core service** — interface adapters call the service module; duplicated
  logic across interfaces is a defect.
- **Runtime output never lands in source** — output directories are repo-level,
  gitignored, and never mutated by agent work.
- **Locale changes are atomic** — file + loader registry + selector + tests move
  together; the parity audit fails loudly otherwise.
- **External-input surfaces are double-audited** — URL, path, and subprocess sinks
  are reviewed at triage and re-audited before merge.
- **Script pairs move together** — a launcher behavior change lands in both the
  `.sh` and `.ps1` halves in the same change.
- **UTF-8 without BOM** everywhere; file I/O states the encoding explicitly.
- **No bare `except:`** — catch specific exceptions; imports ordered
  stdlib → third-party → local.
<!-- END VARIANT-INJECT -->

## File Organization Policy

Application source, templates, static assets, and locale files live under
`src/`; tests under `tests/`; project documentation under `docs/`; session logs
under `memory/`; runtime output in repo-level gitignored directories (never
`__file__`-relative). Root-level files are repo meta only (README, CHANGELOG,
launchers, requirements/lockfiles).

## Domain Rules

1. **Multi-interface surface matrix** — one core service; every interface is a
   thin adapter with a named owning agent. Duplicated logic across interfaces is
   a defect; fold it into the service layer.
2. **Runtime-output isolation** — generated artifacts (downloads, exports,
   caches) are runtime output, never source; they live repo-level, gitignored.
3. **Locale-matrix i18n** — the baseline locale defines the key tree; every
   locale matches it exactly; the runtime's supported-locale registry mirrors
   the on-disk locale directory (the common `i18n-audit` Runtime Loader Sync
   step verifies); detection follows env var → OS locale → default fallback.
4. **External-input security** — utilities that ingest external content audit
   exactly these sink classes: URL handling (schemes, redirects), filesystem
   path construction from external names (traversal), subprocess invocation
   (`shell=True` prohibition), user-controlled strings reaching HTML (escaping).
5. **Cross-platform script pairing** — user-facing launchers ship as `.sh`/`.ps1`
   pairs with identical behavior; both halves change together.

<!-- COMMON-CONTEXT:START -->
### Instruction Standard (LLM Interaction Standard, ADR-0098)

Human-to-LLM instructions and LLM-to-human answers follow the project-local standard `docs/standards/llm-interaction-standard.md` (ADR-0098, extending ADR-0079) — "Precision In, Intuition Out".

- **Input (§2)**: one primary action per instruction; explicit verbs; defined terms; structural rules in §2.8 — one instruction per sentence (≤ 20 words procedural / ≤ 25 descriptive), active voice with imperative steps, present tense, no idioms, positive phrasing preferred, minimal pronouns. Applies to requirement statements, task briefs, execution-plan task descriptions, agent dispatch prompts, design-doc requirement sections, API endpoint documentation, and how-to steps.
- **Output (§4–§9)**: conclusion and intuition before implementation detail; mental models before mechanics; facts, inferences, assumptions, and unknowns kept separate.
- **Enforcement**: advisory — PM conforms task briefs at triage; architect checks requirement sections at Design Gate review. Decisions: ADR-0079 and ADR-0098 (workspace root `docs/adr/`).

### PM Team-Management Authority (ADR-0080)

PM owns the composition of this project's agent team and rules on skill changes.

- **Hiring/firing (top-down, PM-decided)**: PM judges timing and target from workflow signals — recurring unmatched work types, role overload, absorbed roles, the periodic roster review — without a blocking user approval. Every decision emits a gate-moment decision record (ADR-0061) before dispatch. Default exit is `status: deprecated`; hard delete requires an explicit user request. Procedure: `agent-lifecycle-manager` skill.
- **Skill requests (bottom-up, agent-initiated, PM-approved)**: agents file structured request blocks (`create|attach|remove` + evidence) in their task reports and memory logs; PM triages and only approved requests are executed — agents never create, attach, or remove skills unilaterally. Procedure: `skill-lifecycle-manager` skill.
- **Enforcement**: governance, not code — decision records capture the judgment trail, and the change audits catch structural drift. Full decision: ADR-0080 in the workspace root `docs/adr/`.
<!-- COMMON-CONTEXT:END -->

<!-- COMMON-CONTEXT:START -->
This project follows the coding standards in the key-rules list below.

Key rules:
- All operational scripts must be TypeScript (`.ts`) — run via `bun scripts/<name>.ts` (ADR-0036; no `.sh`/`.ps1` pairs)
- Git hook scripts in `.githooks/` remain Unix shell (`.sh`) for git compatibility
- All text files saved as **UTF-8 (without BOM)**
- Commit messages and PR artifacts in **English only**
<!-- COMMON-CONTEXT:END -->
