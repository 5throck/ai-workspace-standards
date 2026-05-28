# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Team Composition Review and Project Improvement Roadmap (Current & New Projects)
**Participants**: pm, architect, automation-engineer, security-expert, scaffolding-expert, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Facilitator Opening (PM)

Two agenda items:
1. How effectively the current agent team composition works in real workflows — reviewing role boundaries, tier allocation, and phase ownership.
2. Based on the actual state of the `C:\git` workspace (3 template types: co-design, co-develop, co-work; 20+ sub-projects), what improvements are needed for both existing project maintenance and new project creation flows.

---

### Round 1

**Architect**:

Two structural problems to address first.

*Team composition:* The three low-tier agents (automation-engineer, docs-writer, scaffolding-expert) handle the most file changes but are all blocked by PM-only invocation. Even simple repetitive tasks (e.g., adding a CHANGELOG entry, updating a script header comment) require PM routing. This is a bottleneck. Proposal: introduce a "pre-approved task class" concept — tasks of PM-pre-approved types can be processed with only post-hoc auditor verification, widening the delegation scope.

*New project flow:* The `templates/` folder has three types: co-design, co-develop, co-work. But the existing projects under `Projects/` have no record of which template version they were based on. `templates/VERSION` exists but is not written into individual projects. Proposal: add a **version watermark** mechanism — write a `template-version.txt` into each project's `.claude/` folder during `new-project.sh/.ps1`, and have `validate-templates.ts` detect drift from this.

Question to ScaffoldingExpert: Is the absence of version info in `new-project.sh` intentional or an oversight?

---

**SecurityExpert**:

Conditionally agree with Architect's "pre-approved task class" — but the approval scope must be tightly bounded to avoid opening hook bypass paths.

Key vulnerability: the `.sh`/`.ps1` script pairs have no automated cross-check for behavioral equivalence. `audit.sh` exists but does not verify that the `.ps1` version implements the same security controls. `publish-to-template.sh` does secret scanning, but whether the `.ps1` equivalent does the same is opaque.

More serious in the new project creation flow: `new-project.sh` copies `.githooks/` but the executable bit is not preserved on Windows. This silently disables pre-commit hooks. The workspace has a history of `NativeCommandError` and PowerShell pipe failures (see CHANGELOG), which are directly linked to hook execution environment instability.

Question to AutomationEngineer: Does `new-project.ps1` verify hook file executability after copying `.githooks/`? If so, how?

---

**AutomationEngineer**:

SecurityExpert is correct. Hook executability verification after `.githooks/` copy is **not implemented** in `new-project.ps1`. This was intentionally omitted because the executable bit concept differs on Windows, but the result is that hooks may not run. Whether `git config core.hooksPath .githooks` is correctly applied in each new project also needs verification.

Architect's version watermark is **immediately implementable** — one line near line ~80 of `new-project.sh` (right after project directory creation): `cat templates/VERSION > "$PROJECT_DIR/.claude/template-version.txt"`. The `.ps1` equivalent needs the same change, plus a migration script to retroactively mark existing projects.

Larger concern: the `scripts/` directory has grown to 35+ files. The TypeScript scripts (`dispatch-parallel.ts`, `dispatch-serial.ts`, `dispatch.ts`, `retry-handler.ts`, `sync-agent-status.ts`, `sync-skill-status.ts`, etc.) have no dependency map in `SCRIPTS.md`. New project onboarding has no clear script execution order.

Proposal to ScaffoldingExpert: Can you produce a **dependency mapping** of which scripts a new project actually needs, vs. which are workspace-root-only tools?

---

**ScaffoldingExpert**:

Answering Architect: The missing version info is an **oversight, not intentional design**. The original `new-project.sh` was designed when there was only one template version. Now with three types and a VERSION file, the omission is a blind spot for drift detection.

The more serious issue: the synchronization state of the `templates/` folder itself. `co-design/`, `co-develop/`, `co-work/` should each have their own `CLAUDE.md`, `CONSTITUTION.md`, and `agents/` folder, but there is no way to tell when these were last synchronized with the workspace root. `publish-to-template.sh` should handle this, but whether it applies selectively per template type is unclear.

Responding to AutomationEngineer's dependency mapping request: Feasible. The plan is to split scripts into a core set (`audit.sh/.ps1`, `dev-sync.sh/.ps1`, `new-project.sh/.ps1`) and optional scripts (`gen-pr-body`, `dispatch-*.ts`, etc.) and add this as a section in `SCRIPTS.md`, in collaboration with DocsWriter.

Question to SecurityExpert: For Windows hook executability, is `.gitattributes eol=lf` + `git config core.hooksPath` auto-set during project init sufficient, or is additional control needed?

---

**DocsWriter**:

Clarifying the `SCRIPTS.md` issue from a documentation perspective. The deeper problem is **terminology drift**. Architect says "version watermark," AutomationEngineer says "template-version.txt," ScaffoldingExpert says "template drift detection" — these are the same concept with three names. Without a canonical term in `CONSTITUTION.md`, future documentation will fragment.

On team composition: docs-writer is tier `low`, which suits simple writing tasks. But **terminology governance and document architecture decisions** cannot be handled by a low-tier model. Two options: raise docs-writer to `medium`, or clarify that document architecture decisions belong to Architect while docs-writer handles execution only.

Question to Architect: Should we add a `§ Terminology` section to `CONSTITUTION.md`, or create a separate `GLOSSARY.md`?

---

### Round 2

**Architect**:

Answering DocsWriter: **Add `§ Terminology` to `CONSTITUTION.md`**. A separate `GLOSSARY.md` creates another synchronization point. `CONSTITUTION.md` is already the single source of truth — appending a terminology section is structurally consistent.

Concrete proposal building on ScaffoldingExpert's template sync gap: `new-project.sh` should include an **interactive decision tree** for template selection ("Does this project have AI agents writing code autonomously? → co-develop / Will humans and AI design together? → co-design"). However, CI compatibility must be preserved — this should only trigger when no `--template` flag is passed.

On the `.sh`/`.ps1` security parity gap: propose a **"Platform Parity ADR"** (`docs/adr/NNNN-platform-parity.md`) formally requiring all script pairs to implement the same security checklist, validated by `validate-templates.ts` at CI level.

Question to AutomationEngineer: Is it realistic to extend `validate-templates.ts` to check both script pair existence and key security function call equivalence?

---

**SecurityExpert**:

Answering ScaffoldingExpert: `.gitattributes eol=lf` + `core.hooksPath` is **not sufficient alone**. Two reasons: (1) Some PowerShell-based Git clients in IDEs interpret `core.hooksPath` differently from Git Bash. (2) If hook files are already CRLF-corrupted, `eol=lf` does not auto-correct existing files.

Additional control required: add a **hook smoke test** step at the end of `new-project.sh/.ps1` — run `git hook run pre-commit` (Git 2.36+) to verify hooks actually execute. On failure, either roll back scaffolding or output manual setup instructions.

Strongly agree with Architect's Platform Parity ADR — this is a **Critical**-severity gap. `audit.sh` checks `.sh` files only; there is no equivalent audit for `.ps1`. I will contribute the security checklist section to that ADR.

Team composition note: security-expert is not a formal participant in Phase 0. When a new project is created, there is no checkpoint verifying that security defaults (`.gitleaks`, `.githooks`, `.gitattributes`) are correctly set. Proposal to PM: formally add security-expert to Phase 0.

---

**AutomationEngineer**:

Answering Architect: Extending `validate-templates.ts` for script pair existence is **immediately feasible**. Checking key security function call equivalence via static analysis is **only partially feasible** — a `.sh` `check_secrets()` call and a `.ps1` `Invoke-SecretScan` call cannot be equated by the compiler. Realistic approach: add **parity annotations** (`# [parity:secret-scan]`) to both files and have `validate-templates.ts` verify annotation tag matches.

On Architect's interactive prompt: adding it must not break non-interactive (CI) execution. Proposed behavior: if `--template` flag is provided, use it directly; if not, show the interactive decision tree. This way CI can use `./new-project.sh my-app --template co-develop` explicitly.

Additional concern: the TypeScript scripts (`dispatch*.ts`, `*-lifecycle-audit.ts`, `verify-*.ts`) need to be checked for entrypoints in `package.json`'s `scripts` section. If they are not registered there, they may be **dead code**.

---

**ScaffoldingExpert**:

AutomationEngineer's CI compatibility concern is valid. The `--template` flag approach is correct.

Additional scaffolding gap: there is currently no **"bare" template** — a minimal project template for users who want a pure code project without AI agent scaffolding. The `common/` folder seems like it should serve this purpose, but it is unclear whether `common/` is a standalone runnable template or a shared-file store for the three main types.

For existing project improvement: there is no **`upgrade-project.sh`** script. `publish-to-template.sh` goes from workspace → template, but the reverse direction (propagating template updates to existing projects) is manual. This is the largest operational debt right now.

Question to DocsWriter: If `SCRIPTS.md` adds a core/optional classification, should the new project `README.md` template reflect the same? Or should `README.md` hide internal script classification since it's a user-facing document?

---

**DocsWriter**:

Answering ScaffoldingExpert: The new project `README.md` should expose scripts only from a **"Quick Start" perspective** — "These 3 scripts are all you need to know." The internal core/optional classification stays in `SCRIPTS.md`, referenced by link from `README.md`. Reason: `README.md` is for project consumers; `SCRIPTS.md` is for maintainers. Mixing the two audiences satisfies neither.

Documentation obligations identified in this meeting:
1. `CONSTITUTION.md §Terminology` — Architect leads, DocsWriter executes
2. `docs/adr/NNNN-platform-parity.md` — Architect + SecurityExpert contribute
3. `SCRIPTS.md` overhaul (core/optional + dependency graph) — DocsWriter + AutomationEngineer
4. Three template `README.md` Quick Start standardization — DocsWriter + ScaffoldingExpert

Team composition note: it is now clear that PM decides too many things alone in Phase 0. Architect, SecurityExpert, and ScaffoldingExpert should run their checklists **in parallel** during Phase 0 and report results to PM. This resolves the bottleneck.

---

### Synthesis (Auditor)

**Points of Agreement:**

1. **Version Watermark** — Write `.claude/template-version.txt` during `new-project.sh/.ps1` execution. All participants agreed.

2. **Platform Parity ADR** — Formalize `.sh`/`.ps1` security control equivalence as an ADR; `validate-templates.ts` enforces via parity annotations. Architect and SecurityExpert agreed.

3. **Hook Smoke Test** — Add `git hook run pre-commit` verification step at end of scaffolding. SecurityExpert proposed; AutomationEngineer confirmed implementable.

4. **`SCRIPTS.md` Overhaul** — core/optional classification + dependency mapping. AutomationEngineer + DocsWriter + ScaffoldingExpert collaborate. New project `README.md` exposes only Quick Start view.

5. **Security-Expert in Phase 0** — Add security defaults verification checkpoint to new project creation. SecurityExpert proposed; DocsWriter supported.

**Open Questions / Disagreements:**

- `common/` folder identity: standalone "bare" template or shared-file store? ScaffoldingExpert and Architect need separate discussion.
- docs-writer tier: raise to `medium` vs. keep `low` with clearer role split (Architect owns doc architecture, DocsWriter executes). PM decision required.
- Retroactive version marking for existing projects: build `upgrade-project.sh` or handle manually?

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | AutomationEngineer | Add `.claude/template-version.txt` write step to `new-project.sh/.ps1` | High |
| A-02 | Architect + SecurityExpert | Draft `docs/adr/NNNN-platform-parity.md` | High |
| A-03 | AutomationEngineer | Extend `validate-templates.ts` with `.sh`/`.ps1` parity annotation checks | Medium |
| A-04 | DocsWriter + AutomationEngineer | Overhaul `SCRIPTS.md` with core/optional classification and dependency map | Medium |
| A-05 | ScaffoldingExpert + Architect | Define `common/` template role; assess `upgrade-project.sh` need | Medium |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | New projects have `.claude/template-version.txt` with template type and version | Run `new-project.sh` and check file exists |
| C-02 | Platform Parity ADR approved and `validate-templates.ts` enforces annotation checks | ADR in `docs/adr/`; CI passes with parity annotations in script pairs |
| C-03 | `SCRIPTS.md` lists core vs. optional scripts with dependency notes | Manual review; confirmed by DocsWriter |
| C-04 | Security-expert checklist runs during Phase 0 scaffolding | New project creation logs show security validation step |
