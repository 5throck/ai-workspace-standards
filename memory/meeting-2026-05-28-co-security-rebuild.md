# Meeting Transcript
**Date**: 2026-05-28
**Topic**: co-security variant full rebuild and variant lifecycle management
**Participants**: pm, architect, security-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[Facilitator — PM]**: The meeting has two goals: (1) diagnose the structural incompatibility of the current co-security variant and decide on a full rebuild direction; (2) design a variant lifecycle management system for future variants.

---

**Architect** (Round 1):

The current co-security template is structurally divergent from co-develop and co-work. Items present in other variants but missing from co-security:
- `CLAUDE.md` — entirely absent (no Claude Code behavior config)
- `GEMINI.md` — entirely absent (no Antigravity/Gemini CLI support)
- `.claude/settings.json` — absent (no hooks, permissions)
- `.claude/commands/` — only `meeting.md` exists; changelog, memlog, new-task, sync, security-check are missing
- `.gemini/commands/` and `.gemini/settings.json` — completely absent
- `agents/README.md` and `agents/README_ko.md` — absent

Items unique to co-security that must be preserved: `ansible/`, `scripts/patch-apply.*`, `scripts/inventory-check.*`, and the domain skills under `skills/`.

Structural concern: `skills/` sits flat at the root, while co-develop places them under `.claude/skills/`. The correct placement depends on whether these skills are Claude Code-only or platform-neutral.

Proposed solution: document a **Variant Contract** in `templates/common/` specifying required files per variant, then extend `scripts/validate-templates.sh` to enforce it.

Question to Security-Expert: are the ansible playbooks and security scripts reusable as-is, or do they need redesign?

Question to Auditor: does `validate-templates.sh` currently enforce a cross-variant file contract?

---

**Security-Expert** (Round 1):

Structural analysis from Architect is accurate. Priority concern: the absence of `CLAUDE.md` and `.claude/settings.json` in co-security is not just a gap — it is a **Critical security risk**. A security engagement variant with no Git hook configuration means no `.gitleaks` secret scanning and no pre-commit or pre-push protection on a project type that handles sensitive credentials by design.

On ansible content: the playbook logic in `patch-linux.yml`, `patch-windows.yml`, `patch-macos.yml` is reusable. However `ansible/inventory.yml` needs stronger authorization guidance comments.

On skill placement: security skills (threat-modeling, recon-surface, pentest-report) must not be Claude Code-only. They are platform-neutral procedures applicable across Claude Code, Gemini CLI, and Antigravity. Proposal: keep `skills/` at the root for platform-neutral skills, but clean up workspace-root-level skill duplicates (meeting-facilitation, agent-lifecycle-manager).

Request to Auditor: verify whether `scripts/validate-templates.sh` enforces cross-variant contracts.

---

**Auditor** (Round 1):

Cross-validation findings:
1. `scripts/validate-templates.ts` and `validate-templates.sh` exist but do NOT enforce a variant file contract. They only check variant.json syntax, README links, and basic file existence.
2. `new-project.sh` lines 33/50/106 list co-security nowhere in valid variants. Running `--variant co-security` currently fails the script. This is a **functional defect**, not just a documentation gap.
3. Architect and Security-Expert's positions on `skills/` placement are compatible: `.claude/skills/` for Claude Code-specific skills, root `skills/` for platform-neutral skills — but this rule must be written into `templates/common/`.
4. `variant.json` has a `"status"` field but no documented criteria for state transitions. `stable` has no defined test gate, which is why co-security shows `"status": "stable"` despite its incomplete state.

Proposal: Variant Contract enforcement should be the gating condition for `stable` status.

---

**Architect** (Round 2):

Proposed **Variant Contract** (minimum required file structure):

```
templates/<variant>/
├── variant.json
├── CLAUDE.md
├── GEMINI.md
├── AGENTS.md
├── README.md
├── README_ko.md
├── agents/
│   ├── pm.md             (required in all variants)
│   └── README.md
├── docs/
│   └── <variant>.context.md
├── .claude/
│   ├── settings.json
│   └── commands/         (minimum: changelog, memlog, new-task, sync)
└── .gemini/
    ├── settings.json
    └── commands/
```

Variant-specific items (ansible/, skills/, etc.) are optional extensions beyond the contract.

Proposed **status lifecycle** for variant.json:

| Status | Conditions |
|--------|------------|
| `draft` | Files being created; Variant Contract not yet satisfied |
| `beta` | Variant Contract satisfied + registered in new-project.sh; not yet real-world tested |
| `stable` | beta conditions + all validate-templates checks pass + used in at least one real project |
| `deprecated` | No new project creation allowed; existing usage maintained |

co-security must be immediately reclassified to `draft`.

Question to Auditor: is it appropriate to retroactively verify existing co-develop/co-work stable status against the new 4-stage criteria?

---

**Security-Expert** (Round 2):

Content audit for co-security rebuild:

**Preserve (keep as-is or minor refinement):**
- All 6 agent files (pm, red-team-lead, pentester, threat-modeler, patch-engineer, report-writer) — content quality is good
- 6 domain skills: threat-modeling, recon-surface, pentest-report, finding-tracker, engagement-scoping, patch-automation — keep content, fix placement
- ansible/ playbooks — reuse logic, strengthen inventory authorization comments
- docs/co-security.context.md — good structure, retain

**Create fresh:**
- `CLAUDE.md` — base on co-develop/CLAUDE.md; add security-specific items: .gitleaks activation, mandatory pre-commit secret scanning, engagement authorization check procedure
- `GEMINI.md` — base on co-develop/GEMINI.md
- `.claude/settings.json` — default hook config + security scan hook
- `.claude/commands/` — changelog, memlog, new-task, sync, security-check (security-hardened version)
- `.gemini/settings.json` + `.gemini/commands/`
- `agents/README.md` + `agents/README_ko.md`

**Critical gap**: `skills/verify-authorization/SKILL.md` is referenced in AGENTS.md but does not exist. This is a mandatory gate before any offensive activity — its absence is Critical.

`new-project.sh` and `new-project.ps1` must both register co-security as a valid variant.

---

**Auditor** (Synthesis):

**Points of agreement:**

1. **co-security full rebuild required**: CLAUDE.md, GEMINI.md, .claude/settings.json, 4+ .claude/commands/, .gemini/ directory, agents/README.md all missing — correctly classified as `draft` under the new criteria.
2. **Preserved content**: 6 agent files (strong quality), ansible playbooks (logic reuse), 6 domain skills (placement fix only), docs/co-security.context.md.
3. **Skill placement policy confirmed**: `.claude/skills/` = Claude Code-only; root `skills/` = platform-neutral. co-security security domain skills stay at root `skills/`.
4. **4-stage status lifecycle adopted**: draft → beta → stable → deprecated. co-security immediately reclassified to `draft`.
5. **Variant Contract formalized**: new file `templates/common/VARIANT_CONTRACT.md`; `validate-templates.ts` extended to enforce it automatically.
6. **new-project.sh/ps1 co-security registration**: functional defect confirmed, immediate fix required.

**Open questions / unresolved:**

- `skills/verify-authorization/SKILL.md` — referenced in AGENTS.md but file does not exist. Critical severity per Security-Expert. Must be created before co-security reaches `beta`.
- Retroactive validation of co-develop and co-work against new 4-stage criteria — scope decision pending.
- `security-check.md` in `.claude/commands/` — co-develop has a generic version; co-security needs a hardened version. Whether to diverge or share via common skills is undecided.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Architect + Automation-Engineer | Create `templates/common/VARIANT_CONTRACT.md`; extend `validate-templates.ts` to enforce contract file checks | Design → Implementation |
| A-02 | Security-Expert + Automation-Engineer | Full co-security rebuild: create CLAUDE.md, GEMINI.md, .claude/, .gemini/, agents/README.md; migrate existing content to correct locations | Implementation |
| A-03 | Automation-Engineer | Register co-security in `new-project.sh` and `new-project.ps1`; update variant.json status to `draft` | Implementation (hotfix) |
| A-04 | Security-Expert | Create `skills/verify-authorization/SKILL.md` — currently referenced but missing (Critical) | Implementation (blocking) |
| A-05 | Architect | Apply 4-stage status criteria: reclassify co-security to draft; retroactive verification of co-develop/co-work stable status | Design |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `validate-templates.ts` fails when a variant is missing any Variant Contract file | Run validate-templates against an intentionally incomplete variant |
| AC-02 | `new-project.sh --variant co-security` succeeds and creates a fully-structured project | Execute the command and verify output structure |
| AC-03 | Rebuilt co-security passes all validate-templates checks | CI run of validate-templates.sh |
| AC-04 | `skills/verify-authorization/SKILL.md` exists and is referenced correctly in AGENTS.md | File check + link validation |
| AC-05 | co-security variant.json status is `draft`; transition to `beta` is documented with clear gate | Read variant.json; read VARIANT_CONTRACT.md |
