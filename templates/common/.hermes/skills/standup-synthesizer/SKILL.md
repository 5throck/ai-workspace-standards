---
name: standup-synthesizer
description: Automated daily standup digest synthesizer aggregating git commit logs, issue status updates, pull request reviews, and ticket queue events over a 24-hour window.
version: 1.0.0
last_reviewed: 2026-08-06
status: active
scope: common
owner: pm
prerequisites: Bun runtime, git
metadata:
  type: process
  triggers:
    - standup digest
    - daily standup
    - synthesize standup
    - work summary
---

# 🛠️ Skill: standup-synthesizer

## Context
Automates the creation of 24-hour team standup digests by aggregating commit logs, pull request activities, issue queue status, and ticket updates across the workspace.

## When to Use
- Daily standup meetings or async team check-ins.
- Summarizing 24-hour project progress for executive review.
- Automated daily digest dispatch in `co-work` variant templates.

## Execution Steps

1. **Collect 24-Hour Git Commit History**:
   ```bash
   git log --since="24 hours ago" --pretty=format:"* %s (%an, %h)"
   ```

2. **Inspect Issue & PR Activity**:
   - Query recently updated pull requests and open issues.
   - Extract tickets resolved within the last 24 hours.

3. **Synthesize Digest**:
   - Organize activities into 4 standard categories:
     - **Accomplished (Last 24 Hours)**
     - **In Progress**
     - **Blockers & Impediments**
     - **Planned Tasks (Next 24 Hours)**

4. **Output Digest Document**:
   - Generate `memory/standup-YYYY-MM-DD.md` or output directly to team communications.

## Output Format

```markdown
# 📅 Daily Standup Digest — YYYY-MM-DD

### ✅ Accomplished (Last 24 Hours)
- [feat] Brief summary of completed work (`commit-hash`)
- [fix] Resolved issue details

### 🔄 In Progress
- Active implementation tasks and responsible agents

### 🚧 Blockers & Impediments
- Open questions, unmerged branch dependencies, or environment blockers (or "None")

### 🎯 Planned Tasks (Next 24 Hours)
- Next sequential roadmap milestones
```

## Related Skills
- [sync](../sync/SKILL.md) — Main lifecycle commit & push pipeline
- [meeting-facilitation](../meeting-facilitation/SKILL.md) — Multi-agent meeting facilitation framework
