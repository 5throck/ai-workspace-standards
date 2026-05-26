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
- Run a license audit after `npm install` / `pip install` and review any flagged packages before committing.
- If a proprietary alternative exists alongside a viable OSS equivalent, default to the OSS option.
- Document any intentional non-OSS dependency with a comment in `docs/context.md` explaining the justification.

#### 8.6 Response Language

**Default to Korean unless explicitly instructed otherwise.**

- All conversational interactions with the user **MUST** be written in **Korean** (한국어), unless the user initiates or explicitly requests the conversation in English.
- This rule applies only to conversational text; actual codebase modifications, configuration scripts, Git messages, and PR documents must follow their respective English-only conventions.

#### 8.7 File Encoding Rule (Markdown & Scripts)
- All text files, including Markdown (`.md`) and scripts (`.ps1`, `.sh`, `.py`, `.js`, etc.), must be saved as **UTF-8 (without BOM)**.
- When generating files programmatically (e.g. PowerShell scripts), explicitly use `-Encoding UTF8` (or `[System.Text.UTF8Encoding]::new($false)`) to prevent fallback to localized ANSI (CP949) encodings.
- Git configuration (`core.quotepath false` and `i18n.commitencoding utf-8`) helps, but the source files themselves must be strictly UTF-8 encoded to prevent character corruption.

#### 8.8 Hybrid Scripting & Cross-Platform Rule
- **Hybrid Approach**: The project uses a hybrid scripting model. Complex multi-agent orchestration (e.g., `dispatch.ts`, `retry-handler.ts`, `verify-skills.ts`) is implemented in **Bun (.ts)**. Everyday development utilities (e.g., `dev-sync`, `audit`) use native shell scripts.
- **Utility Script Pairing**: All utility shell scripts must be cross-platform compatible. Any creation, modification, or deletion of a PowerShell utility script (`.ps1`) MUST be accompanied by the exact same operation on its corresponding Bash script counterpart (`.sh`), and vice versa. They must always be kept in sync as a pair (e.g., `dev-sync.ps1` and `dev-sync.sh`).

#### 8.9 Bilingual Documentation Rule
- **README Pairing Requirement**: For any `README.md` file created in the `templates/` directory, a corresponding Korean version `README_ko.md` MUST also be created and maintained.
- **Synchronization**: When a `README.md` is modified, the corresponding `README_ko.md` MUST be updated to reflect the same changes. The Korean version should be a faithful translation, maintaining the same structure and content coverage.
- **Directory Structure**: Both files MUST reside in the same directory:
  ```
  templates/<directory>/
  ├── README.md      # English version
  └── README_ko.md   # Korean version (translation of README.md)
  ```
- **Verification**: The `audit.sh` / `audit.ps1` script will check for orphaned `README.md` files without corresponding `README_ko.md` in the `templates/` directory and report them as documentation violations.
