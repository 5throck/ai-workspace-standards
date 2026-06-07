# [Project Name] ??co-security Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE ??all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md              ??immutable project identity (architecture, standards)
>   2. docs/co-security.context.md  ??THIS FILE ??engagement scope, agents, workflow, tool stack

## Scripts

<!-- Source Layer: L0 = templates/common (SSOT) | L1 = workspace root | L2 = project-local -->
<!-- Status: active | deprecated | experimental -->

| Script | Type | Entrypoint | Source Layer | Status |
|--------|------|------------|-------------|--------|
| `audit` | Tier 2 | `package.json` (`bun run audit`) | L0 | active |
| `dev-sync` | Tier 2 | `package.json` (`bun run dev-sync`) | L0 | active |
| `sync-md` | Tier 2 | `package.json` (`bun run sync-md`) | L0 | active |

> See SCRIPTS.md in templates/common/scripts/ for full lifecycle registry.

### Hybrid Scripting
Tier 1 (Bootstrap) in Native Shell, Tier 2 (Ops/Automation) in Bun/TS + package.json

---

## Agents

<!-- Status: active | deprecated | experimental -->

| Agent | File | Role | Status |
|-------|------|------|--------|
| Security PM (Orchestrator) | `agents/pm.md` | Scope, authorization, risk management, dispatch | active |
| Red Team Lead | `agents/red-team-lead.md` | Attack methodology, kill chain design, PoC review | active |
| Pentester | `agents/pentester.md` | Vulnerability discovery, PoC development | active |
| Threat Modeler | `agents/threat-modeler.md` | STRIDE analysis, MITRE ATT&CK mapping | active |
| Patch Engineer | `agents/patch-engineer.md` | Ansible playbooks, cross-platform patch deployment | active |
| Report Writer | `agents/report-writer.md` | Pentest reports, executive summaries | active |

> All specialist agents are dispatched by PM only. Direct invocation is refused.

---

## Key Files

| File / Directory | Purpose |
|-----------------|---------|
| `ansible/inventory.yml` | YAML static inventory of authorized target hosts (Linux, macOS, Windows) |
| `ansible/patch-all.yml` | Master playbook ??imports all OS-specific patch playbooks |
| `ansible/patch-linux.yml` | Linux patching (apt security upgrades + yum security updates) |
| `ansible/patch-macos.yml` | macOS patching (softwareupdate + homebrew) |
| `ansible/patch-windows.yml` | Windows patching (PSWindowsUpdate / winget via SSH + PowerShell) |
| `PATCH_LOG.md` | Audit log of all applied patches: date, CVE, group, hosts, outcome |
| `memory/` | Session logs, engagement logs (`engagement-YYYY-MM-DD.md`), patch run logs |
| `docs/findings/` | Finding tickets (`FIND-NNNN.md`), threat models, pentest reports |
| `scripts/patch-apply.sh` | Bash wrapper: dry-run or apply Ansible patches with group filtering |
| `scripts/patch-apply.ps1` | PowerShell equivalent of patch-apply.sh |
| `scripts/inventory-check.sh` | Verify SSH connectivity to all inventory hosts before patching |
| `scripts/inventory-check.ps1` | PowerShell equivalent of inventory-check.sh |

---

## Engagement Workflow (Phases 0??)

| Phase | Name | Key Agents | Output |
|-------|------|-----------|--------|
| 0 | Scoping | PM | Authorization checklist, scope doc, RoE |
| 1-2 | Recon & Threat Modeling | Red Team Lead, Threat Modeler | Recon findings, STRIDE table, DFD, attack trees, MITRE mapping |
| 3 | Exploitation | Red Team Lead ??Pentester | Finding tickets (`FIND-NNNN.md`) with CVSS scores |
| 4 | Remediation | Patch Engineer | Ansible playbooks, PATCH_LOG.md entries |
| 5 | Reporting | Report Writer | Pentest report, executive summary |
| 6 | Verification | Pentester (re-test) | Re-test results confirming fix effectiveness |

**Workflow Entry Point:**
The real workflow entry gate is **verify-authorization**, not code editing. No Phase 1+ work begins until `verify-authorization` skill confirms a signed authorization document exists.

**Quality Gates:**
- Phase 1 cannot start without authorization checklist complete (PM gate via verify-authorization).
- Phase 3 cannot start without PoC reviewed by Red Team Lead.
- Phase 4 always runs `--check` (dry-run) before applying any patch.

**`/sync` Commit Timing (Multi-Commit Pattern):**
Unlike co-develop's single final commit, co-security runs `/sync` at **5 phase boundaries**:
1. Phase 0 complete: authorization and scope established
2. Phase 1-2 complete: threat model approved
3. Phase 3 complete: findings documented (CRITICAL for chain of evidence)
4. Phase 4 complete: patches applied
5. Phase 5 complete: final report ready

Each commit captures the engagement state at that phase. **Phase 3 /sync is mandatory** ??without committing findings to git history, the chain of evidence from finding to patch to report is broken.

Suggested commit message format: `"security: phase3 complete ??N findings documented"`

### Agent Dispatch Order

```
Security PM
  ??[Phase 0] Scoping (PM only)
  ??[Phase 1-2] Recon & Threat Modeling (Red Team Lead + Threat Modeler, parallel)
  ??[Phase 3] Exploitation (Red Team Lead ??Pentester, sequential)
  ??[Phase 4] Remediation (Patch Engineer)
  ??[Phase 5] Reporting (Report Writer)
  ??[Phase 6] Verification (Pentester, re-test loop)
```

All specialist agents are dispatched by PM only. Direct invocation is refused.

---

## Security Engagement Rules

These rules are automatically enforced by the PostToolUse hook in `.claude/settings.json` (see CLAUDE.md).

1. **Authorization first** ??No offensive work (recon, exploitation, PoC) begins without a signed authorization document.
2. **Scope compliance** ??All agents must refuse work targeting out-of-scope hosts without PM re-authorization.
3. **Secret hygiene** ??Credentials, API keys, and passwords discovered during engagements must NEVER be committed. Store in `docs/findings/FIND-NNNN.md` with values redacted.
4. **Dry-run mandatory** ??All Ansible playbooks must pass `--check` (dry-run) before live apply.
5. **Engagement log** ??All agent actions are logged to `memory/engagement-YYYY-MM-DD.md`.

### Beta Usage Scope

**Current Status**: co-security is in **beta** status.

**Allowed Activities** (Beta Phase):
- ??Test environment engagements only (sandbox, isolated lab, staging)
- ??Learning and evaluation of co-security template workflow
- ??Practice engagements with synthetic targets
- ??Testing verify-authorization skill and security features

**Prohibited Activities** (Beta Phase):
- ??Actual customer environment engagements
- ??Production data access or processing
- ??Real-world credential handling
- ??Live penetration testing on customer infrastructure

**Beta Exit Criteria**:
co-security will be promoted to **stable** status when:
1. Three successful sandbox test engagements are completed
2. Zero critical bugs are reported in workflow or skills
3. All A-04 verification items pass (full validation suite)
4. Minimum 3 months of beta testing elapsed

Until stable status is achieved, co-security should only be used for learning and testing purposes, not for actual customer security engagements.

---

## Skills

<!-- Add/remove rows as skills are introduced or retired via lifecycle management. -->

<!-- DYNAMIC_SKILLS_START -->
<!-- DYNAMIC_SKILLS_END -->

### Skill Lifecycle Management

For managing skills (create, modify, deprecate), run:
```bash
bun scripts/skill-lifecycle-audit.ts
```

See `skills/skill-lifecycle-manager/SKILL.md` for the full workflow.

For managing agents, see `skills/agent-lifecycle-manager/SKILL.md`.

---

## Tool Stack

> **Purple Team model**: Red Team (offense ??pentest, threat modeling, PoC) +
> Blue Team (defense ??cross-platform patch automation via Ansible + SSH).
> All offensive activity requires signed authorization before Phase 1.

| Category | Tool / Standard |
|----------|----------------|
| Vulnerability Scoring | CVSS v3.1 ([NVD Calculator](https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator)) |
| Threat Framework | MITRE ATT&CK Enterprise / Mobile / ICS |
| Threat Modeling | STRIDE methodology |
| Pentest Methodology | PTES (Penetration Testing Execution Standard) |
| Patch Automation | Ansible (playbooks in `ansible/`) |
| Target Connectivity | SSH (Linux, macOS, Windows) |
| Windows Patching | PSWindowsUpdate module / `winget upgrade --all --silent` |
| macOS Patching | `softwareupdate --install --recommended` + Homebrew |
| Linux Patching | `apt-get upgrade` (Debian/Ubuntu) + `yum update` (RHEL/CentOS) |

---

## Session Start Checklist

Run this checklist at the start of every session:

- [ ] **Git hooks installed**: Run `git config core.hooksPath .githooks` once per clone to enable pre-commit secret scanning. If this returns no output, hooks are not active ??security engagements require active `.gitleaks` scanning.
- [ ] **Scope doc exists**: Confirm `docs/findings/scope-*.md` or `docs/scope.md` is present and signed.
- [ ] **Authorization confirmed**: Written authorization document is on file and covers all hosts in `ansible/inventory.yml`.
- [ ] **Inventory reachability**: Run `bash scripts/inventory-check.sh` to confirm SSH connectivity to all target hosts.
- [ ] **Open findings review**: Check `docs/findings/` for any `FIND-NNNN.md` files with status `Open` or `In-Progress`.
- [ ] **PATCH_LOG status**: Review `PATCH_LOG.md` for any entries with `Partial` or `Failed` outcomes that need follow-up.
- [ ] **Engagement phase**: Confirm current phase (0??) with PM before dispatching any specialist agents.

---

## Patch Deployment Quick Reference

```bash
# Check connectivity to all hosts
bash scripts/inventory-check.sh

# Dry-run all platforms (always run first)
bash scripts/patch-apply.sh --check

# Dry-run a specific group
bash scripts/patch-apply.sh --group linux --check

# Apply patches (after successful dry-run)
bash scripts/patch-apply.sh --group linux
bash scripts/patch-apply.sh --group macos
bash scripts/patch-apply.sh --group windows
bash scripts/patch-apply.sh   # all groups
```

---

## Git / PR Workflow
<!-- intentional-duplicate: workspace standards §3 — maintained locally for security workflow context; update when source changes -->

```
/sync "security: description"
  ?? 1. memory log (memlog)
  ?? 2. MEMORY.md index update (sync-md)
  ?? 3. CHANGELOG.md [Unreleased] auto-add
  ?? 4. audit.sh  (must exit 0)
  ?? 5. git checkout -b pr/<date>-<slug>
  ?? 6. git commit + push
  ?? 7. gh pr create
```

> All PR titles, bodies, and review comments must be in **English**.

---

## File Organization Policy

### Recommended Folder Structure (co-security)
| Folder | Purpose |
|--------|---------|
| `docs/reports/` | Security assessment reports |
| `docs/threat-models/` | Threat modeling documents |
| `docs/findings/` | Vulnerability findings (consider .gitignore for sensitive items) |
| `memory/` | Session logs, engagement transcripts |

---

## Domain Rules

1. **Authorization first**: No offensive work (recon, exploitation, PoC) begins without a signed authorization document.
2. **Scope compliance**: All agents must refuse work targeting out-of-scope hosts without PM re-authorization.
3. **Dry-run mandatory**: Every new or modified Ansible playbook must pass `--check` before being applied.
4. **Finding traceability**: Every remediation in PATCH_LOG.md must reference a `FIND-NNNN` ticket or CVE.
5. **Executive summary**: Final reports must include a non-technical executive summary readable by C-level stakeholders.

---

*co-security.context.md version: 0.2.0 ??created by /new-project*
