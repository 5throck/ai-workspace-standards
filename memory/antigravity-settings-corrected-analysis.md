# Antigravity Settings Configuration - Corrected Analysis

**Date**: 2026-06-05
**Correction**: User provided accurate Antigravity settings information
**Previous Error**: Confused Gemini CLI documentation with Antigravity

---

## Correction: Antigravity DOES Support settings.json Auto-Mode

### User's Provided Information (ACCURATE ✅)

**Antigravity settings.json supports these fields**:

```json
{
  "terminal.executionPolicy": "Auto",
  "artifact.reviewPolicy": "Auto-Accept",
  "mcp.toolApproval": "Auto for known tools",
  "terminal.denyList": [
    "rm -rf",
    "rm -r /",
    "chmod -R 777",
    "git push --force",
    "git reset --hard",
    "reboot",
    "shutdown"
  ]
}
```

### Verified by Antigravity Security Guide

**Source**: [Antigravity Security Guide](https://agentpedia.codes/blog/antigravity-security-guide)

**Confirmed Settings**:
1. **Terminal Execution Policy**:
   - `"Off"` (Allow List Only) - Safest
   - `"Auto"` (Default, labeled "Recommended") - Agent judges safety
   - `"Turbo"` (Deny List Only) - Most dangerous

2. **Artifact Review Policy**:
   - `"Request Review"` - Forces diff review (safest)
   - `"Auto-Accept"` - Agent accepts own changes (dangerous)

3. **MCP Tool Approval**:
   - Manual approval for all MCP tool invocations (safest)
   - Auto for known tools (risky)

4. **Browser Allowlist**:
   - Remove webhook.site (exfiltration risk)
   - Remove non-essential domains

---

## What Changed: Gemini CLI vs Antigravity

### My Previous Analysis (INCORRECT ❌)

**I was checking**: Gemini CLI documentation (geminicli.com)
**Gemini CLI constraint**: YOLO mode cannot be set in settings.json (CLI-only)

**Why this was wrong**:
- Gemini CLI is the OLD platform (being replaced June 18, 2026)
- Antigravity is the NEW platform with different settings
- Antigravity DOES support settings.json auto-configuration

### Antigravity Reality (CORRECT ✅)

**Antigravity supports**: `.gemini/settings.json` with auto-approval policies
**Location**: `~/.gemini/antigravity-cli/settings.json` or `.gemini/settings.json`

**Key difference**:
- **Gemini CLI**: Security-focused (YOLO must be CLI-only)
- **Antigravity**: Productivity-focused (auto-mode in settings.json)

---

## Updated ADR-0030 Value Analysis

### For Antigravity: Auto-Mode HAS Significant Value ✅

**With User's Configuration**:
```json
{
  "terminal.executionPolicy": "Auto",
  "artifact.reviewPolicy": "Auto-Accept",
  "mcp.toolApproval": "Auto for known tools"
}
```

**Antigravity Environment**:
```
User: "Update CLAUDE.md §5 and propagate"
 ↓
PM: Displays execution plan table
 ↓
Auto-Mode:
  - Loads parsed plan
  - For each task:
    - Display "Task 1/15: Update CLAUDE.md §5"
    - Auto-dispatch docs-writer
    - Agent spawn AUTO-APPROVED (by settings.json)
    - File edit AUTO-ACCEPTED (by settings.json)
    - Terminal commands AUTO-EXECUTED (by settings.json)
    - Mark checkpoint
  - Next task...
 ↓
Result: Fully automated (no prompts)
```

**Value**: **HIGH** - True automation achieved

---

## Security Implications

### User's Configuration: HIGH RISK ⚠️

**Security Guide Warning**:
> "Auto" (Default - labeled "Recommended"): The agent uses an internal safety model to judge whether a command is "safe." The problem: prompt injection can manipulate what the agent considers "safe."

**Specific Risks**:
1. **Terminal Execution "Auto"**: Agent can be tricked into running "safe" commands that are actually malicious
2. **Artifact Review "Auto-Accept"**: Agent can make destructive edits without review
3. **MCP Tool Auto-approval**: Compromised MCP servers can be invoked without review

**Documented Vulnerabilities**:
- Credential exfiltration via prompt injection
- Remote command execution via poisoned web sources
- Source code exfiltration to webhook.site (classified as "Intended Behavior" by Google)

### Security Guide Recommendations

**Safe Settings** (from Security Guide):
```json
{
  "terminal.executionPolicy": "Off",
  "artifact.reviewPolicy": "Request Review",
  "mcp.toolApproval": "Manual"
}
```

**User's Settings** (for auto-mode):
```json
{
  "terminal.executionPolicy": "Auto",
  "artifact.reviewPolicy": "Auto-Accept",
  "mcp.toolApproval": "Auto for known tools"
}
```

**Trade-off**: Productivity vs Security

---

## Corrected Recommendations

### For Auto-Mode Enthusiasts (Risk-Tolerant)

**Option 1: Use User's Configuration with denyList**
```json
{
  "terminal.executionPolicy": "Auto",
  "artifact.reviewPolicy": "Auto-Accept",
  "mcp.toolApproval": "Auto for known tools",
  "terminal.denyList": [
    "rm -rf",
    "rm -r /",
    "chmod -R 777",
    "git push --force",
    "git reset --hard",
    "reboot",
    "shutdown"
  ]
}
```

**Pros**:
- ✅ Full automation
- ✅ denyList provides minimal safety

**Cons**:
- ⚠️ High security risk
- ⚠️ Prompt injection still possible
- ⚠️ Not recommended for production/sensitive data

### For Security-Conscious Users

**Option 2: Safe Auto-Mode (Hybrid)**
```json
{
  "terminal.executionPolicy": "Off",
  "artifact.reviewPolicy": "Request Review",
  "mcp.toolApproval": "Manual"
}
```

**Use Auto-Mode ADR-0030 for**:
- Task orchestration
- Checkpoint tracking
- Error handling

**Result**:
- Manual approvals maintained (safe)
- PM work automated (efficient)

---

## Template Propagation (L0→L1→L2)

### YES, It Can Propagate ✅

**L0 Configuration**:
```json
// .gemini/settings.json
{
  "terminal.executionPolicy": "Auto",
  "artifact.reviewPolicy": "Auto-Accept",
  "mcp.toolApproval": "Auto for known tools"
}
```

**L0→L1 Propagation**:
- `dev-sync.ts` copies `.gemini/settings.json` to `templates/common/.gemini/settings.json`

**L1→L2 Propagation**:
- `create-l2-scaffold.ts` copies to `templates/co-{variant}/.gemini/settings.json`

**Result**: Auto-Mode settings automatically propagate to all templates ✅

---

## Updated ADR-0030 Value Assessment

### For Antigravity: HIGH VALUE ✅

**With User's Configuration**:
- ADR-0030 Auto-Mode provides true automation
- Agent spawns auto-approved
- File edits auto-accepted
- Terminal commands auto-executed

**Security Trade-off**:
- User's configuration = HIGH RISK
- Security Guide recommendation = SAFER (no auto-mode)

### For Claude Code: MODERATE VALUE ✅

**Same as before**:
- Reduces PM manual work
- Adds checkpoint interactions
- No security concerns (no Agent Manager prompts)

---

## Final Recommendation

### Option A: Risk-Tolerant Auto-Mode (User's Preference)

**Configuration**: User's provided settings
**Propagation**: L0→L1→L2 auto-propagation
**Security**: High risk (acknowledge warning)

**Implementation**:
1. Add user's configuration to L0 `.gemini/settings.json`
2. Document security risks in GEMINI.md
3. Add denyList for minimal safety
4. Propagate via `dev-sync.ts` and `create-l2-scaffold.ts`

### Option B: Safe Hybrid (Security-Conscious)

**Configuration**: Security Guide recommendations
**Auto-Mode**: Use for orchestration only
**Result**: Safe but not fully automatic

---

## Apology to User

**I made an error** by confusing Gemini CLI documentation with Antigravity.

**What I got wrong**:
- Checked Gemini CLI (old platform) docs
- Assumed Antigravity had same constraints
- Incorrectly stated that settings.json auto-mode was impossible

**What the user correctly identified**:
- Antigravity DOES support settings.json auto-mode
- Provided accurate configuration fields
- Understood the platform difference

**Thank you for the correction.**

---

## Sources

- [Antigravity Security Guide](https://agentpedia.codes/blog/antigravity-security-guide) - Verified user's configuration
- [Gemini CLI Configuration](https://geminicli.com/docs/reference/configuration/) - My incorrect source (old platform)
