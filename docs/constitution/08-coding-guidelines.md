> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §8 Coding Behavior Guidelines
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 8. Coding Behavior Guidelines {#coding-behavior-guidelines}

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

#### 8.1 Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- **Secrets Management Rule**: Plaintext secrets (passwords, API tokens, security keys) **MUST NEVER** be hardcoded into application source files or configurations. All credentials must be loaded dynamically from local environment variables, system keychains, or secure config files. Establish a `.env.sample` template for every repository.

#### 8.2 Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

#### 8.3 Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

#### 8.4 Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

#### 8.5 Open-Source Package Policy

**Prefer OSI-approved open-source packages. Audit licenses after every install.**

When adding or recommending dependencies:
- **Prefer** packages with OSI-approved licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, LGPL-2.1+, PSF-2.0.
- **Avoid** packages with proprietary, commercial-only, or copyleft licenses (GPL-3.0, AGPL-3.0, SSPL, BSL) unless the project's own license and legal context explicitly permit it.
- **Always check** license compatibility when mixing packages (e.g., GPL in an MIT project requires careful review).
- Run a license audit after `bun install` / `pip install` and review any flagged packages before committing.
- If a proprietary alternative exists alongside a viable OSS equivalent, default to the OSS option.
- Document any intentional non-OSS dependency with a comment in `docs/context.md` explaining the justification.

#### 8.6 Response Language

**Default to Korean unless explicitly instructed otherwise.**

- All conversational interactions with the user **MUST** be written in **Korean** (Korean language), unless the user initiates or explicitly requests the conversation in English.
- This rule applies only to conversational text; actual codebase modifications, configuration scripts, Git messages, and PR documents must follow their respective English-only conventions.

#### 8.7 File Encoding Rule (Markdown & Scripts)
- All text files, including Markdown (`.md`) and scripts (`.ps1`, `.sh`, `.py`, `.js`, etc.), must be saved as **UTF-8 (without BOM)**.
- When generating files programmatically (e.g. PowerShell scripts), explicitly use `-Encoding UTF8` (or `[System.Text.UTF8Encoding]::new($false)`) to prevent fallback to localized ANSI (CP949) encodings.
- Git configuration (`core.quotepath false` and `i18n.commitencoding utf-8`) helps, but the source files themselves must be strictly UTF-8 encoded to prevent character corruption.

#### 8.8 TypeScript-First Scripting Rule (ADR-0036)
- **Single implementation**: All operational scripts in `scripts/` are TypeScript (`.ts`) executed via Bun (`bun scripts/<name>.ts`). There are no `.sh` or `.ps1` operational script counterparts — ADR-0036 retired the dual-file model.
- **No pairing required**: Creating, modifying, or deleting a script requires changes to exactly one `.ts` file. Script parity checks between `.sh` and `.ps1` no longer apply.
- **Registry enforcement**: Every `.ts` script must have a matching entry in `scripts/SCRIPTS.md` with correct `@version`. Adding a new script without updating the registry is a governance violation caught by `bun scripts/audit.ts`.

#### 8.9 Bilingual Documentation Rule
- **README Pairing Requirement**: For any `README.md` file created in the `templates/` directory, a corresponding Korean version `README_ko.md` MUST also be created and maintained.
- **Synchronization**: When a `README.md` is modified, the corresponding `README_ko.md` MUST be updated to reflect the same changes. The Korean version should be a faithful translation, maintaining the same structure and content coverage.
- **Directory Structure**: Both files MUST reside in the same directory:
  ```
  templates/<directory>/
  ├── README.md      # English version
  └── README_ko.md   # Korean version (translation of README.md)
  ```
- **Verification**: The `audit.ts` script will check for orphaned `README.md` files without corresponding `README_ko.md` in the `templates/` directory and report them as documentation violations.
- **Standardized Structure (variant READMEs)**: Every variant `README.md` / `README_ko.md` MUST conform to the unified README Standard — the 7 required top-level sections (EN: `Overview · Quick Start · Team Mission · Meet the AI Team · Skills · How to Collaborate · Variant Type`; KO: `개요 · 빠른 시작 · 팀 미션 · AI 팀 소개 · 스킬 · 협업 방법 · 변형 유형`), a `> **Status**: (✅ Stable|⚠️ Beta) — vX.Y.Z` blockquote, the language-selector line, and the 4-column agent roster table. The structural SSOT is `templates/common/docs/README.template.md` (+KO); enforced by `validate-templates.ts` Check **WS-08** (see `docs/governance/variant-contract.md` "README Standard").

#### 8.10 Cross-Platform Shell Redirection & Windows Device Safeguard (`nul` Avoidance)
- **Unix/Git Bash (`.sh`, `.githooks`, `bash -c`)**: Output suppression MUST use `> /dev/null 2>&1`.
- **PowerShell (`.ps1`, `powershell -Command`)**: Output suppression MUST use `> $null` or `| Out-Null`.
- **Prohibition of `> nul`**: Writing `> nul` or `2> nul` inside Git Bash or Bun/Node child process calls on Windows creates a physical file named `nul` in the working directory because Bash interprets `nul` as a relative file path. Node.js/Bun `fs` APIs cannot delete physical `nul` files due to Win32 device mapping.
- **Git Ignore & Audit Protection**: All repository `.gitignore` templates MUST include `nul` and `NUL` (verified present in the root and all 11 template `.gitignore` files as of 2026-08-21). `scripts/audit.ts` enforces this rule on two fronts:
  - **Remediation** — recursively detects and removes physical `WINDOWS_DEVICE_NAMES` artifacts under untracked local project directories, regardless of tracking status. Depth matters: such a file at *any* depth blocks deleting every parent directory above it from PowerShell, because `Remove-Item` resolves the name to the Win32 device rather than to the file. (Git Bash's `rm -f -- <path>` deletes it correctly, and is what the sweep shells out to.)
  - **Prevention** — a static check fails the audit on any `> nul` / `2> nul` occurrence in `.ts`, `.js`, `.mjs`, `.sh`, `.ps1`, `.cmd`, `.bat`, or `.githooks/` files. `.md` is excluded, since the governance docs must quote the pattern in order to forbid it, and comment lines are stripped for the same reason. A line containing `nul-lint-ignore` is skipped — reserved for diagnostics that must quote what they forbid.

> **Note (root cause, resolved 2026-08-21)**: the recurring scaffold artifacts were traced to a physical `nul` file **inside `templates/co-deck/` itself** — a bundled script whose `bun build` output path resolved to `nul` on Windows. The template's own `.gitignore` (which lists `NUL`) hid it from `git status`, while `new-project.ts`'s `copyDir` — which ignores `.gitignore` — shipped it into every co-deck scaffold. Workspace source itself contains zero `> nul` redirects (the static check above enforces that), but a build tool's *output path* can produce the artifact without any redirect in source. Hence the layered defense: `new-project.ts` purges device-name files from the project at the variant-copy point, and `audit.ts` sweeps **all** top-level directories — tracked trees included, because a gitignored artifact in a template is invisible to review yet propagates to every scaffold.

#### 8.11 Error Handling Standard (ADR-0054)

**Use `scripts/lib/error-handling.ts` for error and exit paths in all workspace scripts.** ADR-0054 establishes the library as the standard; migration is incremental (opportunistic with functional changes).

- **Fatal conditions**: use `die(message, code)` from the library instead of raw `console.error(msg); process.exit(1)`.
- **Structured errors**: use `fatalError(ErrorPhase.X, code, message, details, remediation)` + `logError(err)` for complex failure points that need remediation hints.
- **Phase taxonomy**: pick the most specific `ErrorPhase` — generic (`SCRIPT_EXECUTION`, `FILE_IO`, `CLI_PARSING`, `AUDIT`, `LIFECYCLE`, `SECURITY`) or pipeline-specific (`VALIDATION`, `L3_SCAN`, etc.).
- **What NOT to do**: do not force normal output through the library; do not migrate scripts purely for consistency (migration rides along with functional changes per §8.3); do not remove existing structured errors from pipeline scripts.
- **L0+L1 scripts**: when migrating an L0+L1 script, sync the change to `templates/common/scripts/` in the same commit.

#### 8.12 Variant Script Inheritance (ADR-0050)

**Variant scripts inherit from `templates/common/`, never duplicate it.** ADR-0050 Part 1 codifies this: a script needed by more than one variant lives in `templates/common/scripts/` (or workspace-root `scripts/` for L0-only tooling); a `templates/co-*/scripts/` copy is only legitimate when genuinely variant-specific, and even then must compose common logic rather than re-implement it. `scripts/audit.ts`'s `checkVariantScriptDrift()` WARN check flags divergence from this rule.

#### 8.13 Computational Integrity

**Numeric outputs in deliverables must come from executed code, never from the model doing arithmetic.**

All numeric outputs in deliverables (aggregations, statistics, percentages, metric computations, counts and sums) must be computed by executed code (bun/TypeScript scripts or an equivalent validated tool) — never by the LLM performing arithmetic directly. AI-produced figures are estimates until script-verified, and must be labeled **approximate** where shown. For high-precision or safety-critical computation (aerospace, precision control, regulated finance), delegate to validated external tools per `docs/context.md` § Computational Integrity Standards.

#### 8.14 Accessibility (ADR-0065)

**Accessibility is a mandatory consideration for any user-facing software feature** (web apps, mobile apps, interactive CLIs, generated documents/templates) — not an optional enhancement. Backend/non-UI work is exempt only when the design doc or ADR states the exemption explicitly.

- **Baseline**: WCAG 2.1 AA, aligned with the Design Foundation contract and the `accessibility-audit` skill (axe-core, WCAG 2.1 AA; co-design).
- **Design docs MUST include an Accessibility section** (`docs/designs/<spec-id>-design.md` for user-facing features): target level (WCAG 2.1 AA), affected interaction areas (keyboard, screen reader, contrast, motion, touch), and the verification method.
- **ADRs MUST record accessibility impact** for features that affect user-facing interaction.
- **Baseline requirements**:
  - Keyboard operability — every interactive element reachable/operable by keyboard, no keyboard traps, visible focus indicator
  - Contrast — WCAG AA (4.5:1 normal text, 3:1 large text/UI components)
  - Semantic structure & ARIA — correct semantic HTML, accessible names for all controls (`aria-label`/`aria-labelledby` for icon-only controls)
  - Screen reader — meaningful reading order; names/roles/values exposed correctly
  - Status encoding — never color alone; always paired with icon and/or text (multi-encoded signals)
  - Motion — respect `prefers-reduced-motion`; no essential information lost when motion is disabled
  - Target size — adequate touch/target sizes where the platform warrants it
- **Verification**: use the `accessibility-audit` skill where available; otherwise a documented manual checklist covering the baseline items above.
- See [ADR-0065](../../docs/adr/0065-accessibility-standard.md) and `docs/context.md` § Accessibility Standards.
