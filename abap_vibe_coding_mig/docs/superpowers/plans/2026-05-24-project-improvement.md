# VSP Project Improvement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1 (Foundation Layer) of the VSP Harness Engineering project improvement, establishing Bun-based single-source scripts, MCP configuration synchronization, and documentation reorganization.

**Architecture:** Migrate from dual `.sh`/`.ps1` scripts to single-source `.ts` files powered by Bun runtime. Create `.mcp.json` as Single Source of Truth for MCP server configuration, with automatic synchronization to tool-specific settings files. Reorganize documentation to eliminate overlap between `context.md` and `AGENTS.md`.

**Tech Stack:** Bun (JavaScript/TypeScript runtime), TypeScript 5.0+, Node.js types, existing shell scripts (for legacy compatibility)

---

## Scope

This plan covers **Phase 1: Foundation Layer** only:

| Component | Priority | Status |
|-----------|:--------:|:------:|
| 1C. MCP Config + Sync Script | P0 | In Scope |
| 1B. Bun Runtime Setup | P0 | In Scope |
| 1B. Core .ts Scripts | P0 | In Scope |
| 1A. Documentation Reorganization | P1 | In Scope |
| 2A. Agent Coordination | P0 | Phase 2 |
| 2B. Skill System | P1 | Phase 2 |
| 3A. QA Automation | P1 | Phase 3 |
| 3B. Status Monitoring | P2 | Phase 3 |

---

## File Structure

### New Files to Create

```
.mcp.json                           # MCP server configuration (SSoT)
scripts/package.json                # Bun package manifest
scripts/tsconfig.json               # TypeScript configuration
scripts/dev-sync.ts                 # Dev sync pipeline
scripts/audit.ts                    # Documentation audit
scripts/sync-mcp.ts                 # MCP config sync
scripts/health-check.ts             # System health check
scripts/post-write.ts               # Post-write QA chain (P1)
scripts/verify-skills.ts            # Skill verification (P1)
scripts/install-bun.sh              # Bun installer (Unix)
scripts/install-bun.ps1             # Bun installer (Windows)
scripts/dev-sync.sh                 # Legacy wrapper (backward compat)
scripts/audit.sh                    # Legacy wrapper
scripts/sync-mcp.sh                 # Legacy wrapper
scripts/health-check.sh             # Legacy wrapper
scripts/README.md                   # Scripts documentation
templates/dispatch-parallel.md      # Parallel dispatch template
templates/dispatch-serial.md        # Serial dispatch template
agents/handoff-spec.md              # Handoff format spec
skills/desktop-app-fallback/SKILL.md # Desktop App fallback
skills/SKILLS.md                    # Auto-generated skill index
scripts/update-memory-index.ts      # Memory index updater
docs/superpowers/specs/2026-05-24-project-improvement-design.md # Already created
```

### Files to Modify

```
.gitignore                         # Add *.cmd rule
docs/context.md                     # Remove agent workflow sections
AGENTS.md                           # Add error recovery section
CLAUDE.md                           # Update MCP workflow
GEMINI.md                           # Update MCP workflow
.githooks/pre-commit                # Add drift checks
memory/MEMORY.md                    # Will be auto-updated
```

---

## Task 1: Create .mcp.json Configuration

**Files:**
- Create: `.mcp.json`

**Purpose:** Establish Single Source of Truth for MCP server configuration

- [ ] **Step 1: Create .mcp.json with MCP server definitions**

```json
{
  "mcpServers": {
    "abap": {
      "command": "./vsp",
      "args": ["--mode", "hyperfocused"],
      "env": {
        "SAP_MODE": "hyperfocused",
        "SAP_ALLOWED_PACKAGES": "Z*,,$TMP,$ZADT_VSP,$VSP_ADT",
        "SAP_FEATURE_ABAPGIT": "on",
        "SAP_FEATURE_TRANSPORT": "on",
        "SAP_FEATURE_UI5": "on",
        "SAP_FEATURE_RAP": "on"
      }
    },
    "abap-docs": {
      "type": "http",
      "url": "https://mcp-abap.marianzeis.de/mcp"
    },
    "sap-docs": {
      "type": "http",
      "url": "https://mcp-sap-docs.marianzeis.de/mcp"
    },
    "codegraph": {
      "command": "npx",
      "args": ["-y", "@colbymchenry/codegraph", "serve"]
    }
  }
}
```

- [ ] **Step 2: Test .mcp.json is valid JSON**

Run: `cat .mcp.json | jq empty`
Expected: No output (valid JSON)

- [ ] **Step 3: Commit .mcp.json**

```bash
git add .mcp.json
git commit -m "feat: add .mcp.json as MCP SSoT

Add .mcp.json as Single Source of Truth for MCP server configuration.
Will be synced to .claude/settings.json and .gemini/settings.json.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 1A: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Purpose:** Prevent creation of .cmd files (deprecated format)

- [ ] **Step 1: Check if .gitignore exists**

Run: `ls -la .gitignore`

- [ ] **Step 2: Add *.cmd rule to .gitignore**

Run: `echo "*.cmd" >> .gitignore`

Or edit `.gitignore` and add:
```gitignore
# Prevent .cmd files (use .sh/.ts or .ps1 instead)
*.cmd
```

- [ ] **Step 3: Verify .gitignore was updated**

Run: `tail -5 .gitignore`
Expected: Should show `*.cmd` rule

- [ ] **Step 4: Commit .gitignore update**

```bash
git add .gitignore
git commit -m "chore: prevent .cmd files via .gitignore

Add *.cmd rule to prevent creation of deprecated batch files.
Projects should use .sh/.ts (Unix) or .ps1 (Windows) instead.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 2: Create Bun Package Configuration

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/tsconfig.json`

**Purpose:** Set up Bun runtime environment

- [ ] **Step 1: Create scripts/package.json**

```json
{
  "name": "vsp-scripts",
  "version": "1.0.0",
  "description": "VSP Harness Engineering Scripts - Bun-based single-source",
  "scripts": {
    "dev-sync": "bun scripts/dev-sync.ts",
    "audit": "bun scripts/audit.ts",
    "sync-mcp": "bun scripts/sync-mcp.ts",
    "health": "bun scripts/health-check.ts",
    "post-write": "bun scripts/post-write.ts",
    "verify-skills": "bun scripts/verify-skills.ts",
    "update-memory-index": "bun scripts/update-memory-index.ts"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

- [ ] **Step 2: Create scripts/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["scripts/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Validate package.json**

Run: `cat scripts/package.json | jq empty`
Expected: No output (valid JSON)

- [ ] **Step 4: Commit package configuration**

```bash
git add scripts/package.json scripts/tsconfig.json
git commit -m "feat: add Bun package configuration

Add package.json and tsconfig.json for Bun-based scripts.
Defines all script commands and TypeScript configuration.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 3: Create MCP Sync Script

**Files:**
- Create: `scripts/sync-mcp.ts`
- Modify: `.claude/settings.json`
- Modify: `.gemini/settings.json`

**Purpose:** Synchronize .mcp.json to tool-specific settings

- [ ] **Step 1: Create scripts/sync-mcp.ts**

```typescript
#!/usr/bin/env bun

/**
 * MCP Configuration Sync Script
 * Reads .mcp.json and syncs to .claude/settings.json and .gemini/settings.json
 */

interface MCPServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
  url?: string;
}

interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

async function main(): Promise<void> {
  console.log("🔄 MCP Configuration Sync\n");

  // Read source .mcp.json
  const mcpConfig = await readMCPConfig();
  if (!mcpConfig) {
    console.error("❌ Failed to read .mcp.json");
    process.exit(1);
  }

  // Sync to Claude settings
  console.log("1️⃣  Syncing to .claude/settings.json");
  await syncToClaude(mcpConfig);

  // Sync to Gemini settings
  console.log("\n2️⃣  Syncing to .gemini/settings.json");
  await syncToGemini(mcpConfig);

  console.log("\n✅ MCP configuration synced successfully");
}

async function readMCPConfig(): Promise<MCPConfig | null> {
  try {
    const content = await Bun.file(".mcp.json").text();
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading .mcp.json:", error);
    return null;
  }
}

async function syncToClaude(mcpConfig: MCPConfig): Promise<void> {
  const settingsPath = ".claude/settings.json";
  const existingSettings = await readSettings(settingsPath);

  const newSettings = {
    ...existingSettings,
    mcpServers: mcpConfig.mcpServers
  };

  await writeSettings(settingsPath, newSettings);
  console.log("   ✅ .claude/settings.json updated");
}

async function syncToGemini(mcpConfig: MCPConfig): Promise<void> {
  const settingsPath = ".gemini/settings.json";
  const existingSettings = await readSettings(settingsPath);

  const newSettings = {
    ...existingSettings,
    mcpServers: mcpConfig.mcpServers
  };

  await writeSettings(settingsPath, newSettings);
  console.log("   ✅ .gemini/settings.json updated");
}

async function readSettings(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await Bun.file(path).text();
    return JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
}

async function writeSettings(path: string, settings: Record<string, unknown>): Promise<void> {
  const content = JSON.stringify(settings, null, 2);
  await Bun.write(path, content);
}

main();
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x scripts/sync-mcp.ts` (Unix only)

- [ ] **Step 3: Test sync-mcp.ts**

Run: `bun scripts/sync-mcp.ts`
Expected Output:
```
🔄 MCP Configuration Sync

1️⃣  Syncing to .claude/settings.json
   ✅ .claude/settings.json updated

2️⃣  Syncing to .gemini/settings.json
   ✅ .gemini/settings.json updated

✅ MCP configuration synced successfully
```

- [ ] **Step 4: Verify synced files**

Run: `cat .claude/settings.json | jq .mcpServers`
Run: `cat .gemini/settings.json | jq .mcpServers`
Expected: Both should show the same MCP servers as .mcp.json

- [ ] **Step 5: Commit sync script**

```bash
git add scripts/sync-mcp.ts .claude/settings.json .gemini/settings.json
git commit -m "feat: add MCP config sync script

Add sync-mcp.ts to synchronize .mcp.json to tool-specific settings.
Updates .claude/settings.json and .gemini/settings.json automatically.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 4: Create Dev Sync Script

**Files:**
- Create: `scripts/dev-sync.ts`

**Purpose:** Implement full development sync pipeline in TypeScript

- [ ] **Step 1: Create scripts/dev-sync.ts**

```typescript
#!/usr/bin/env bun

/**
 * VSP Development Sync Pipeline
 * Single-source cross-platform implementation
 *
 * Usage: bun scripts/dev-sync.ts "commit message"
 */

interface SyncResult {
  success: boolean;
  steps: Array<{ name: string; status: string; output?: string }>;
}

async function main(): Promise<void> {
  const commitMessage = process.argv[2] || "chore: sync development session";

  console.log("🔄 VSP Dev Sync Pipeline\n");
  console.log(`Commit message: "${commitMessage}"\n`);

  const results: SyncResult = {
    success: false,
    steps: []
  };

  // Step 1: Check CHANGELOG
  console.log("1️⃣  Checking CHANGELOG.md");
  const changelogResult = await checkChangelog();
  results.steps.push({ name: "Changelog Check", status: changelogResult ? "✅" : "⚠️" });

  // Step 2: Run audit
  console.log("\n2️⃣  Running documentation audit");
  const auditResult = await runAudit();
  results.steps.push({ name: "Audit", status: auditResult ? "✅" : "❌" });

  // Step 3: Stage and commit
  console.log("\n3️⃣  Committing changes");
  const commitResult = await gitCommit(commitMessage);
  results.steps.push({ name: "Commit", status: commitResult ? "✅" : "❌" });

  results.success = results.steps.every(s => s.status.includes("✅") || s.status.includes("⚠️"));

  console.log("\n" + "=".repeat(50));
  if (results.success) {
    console.log("✅ Sync complete");
  } else {
    console.log("❌ Sync failed - check errors above");
  }

  process.exit(results.success ? 0 : 1);
}

async function checkChangelog(): Promise<boolean> {
  try {
    const changelog = await Bun.file("CHANGELOG.md").text();
    if (!changelog.includes("## [Unreleased]")) {
      console.log("   ⚠️  No [Unreleased] section in CHANGELOG.md");
      return false;
    }
    console.log("   ✅ CHANGELOG.md has [Unreleased] section");
    return true;
  } catch (error) {
    console.log(`   ❌ Error reading CHANGELOG.md: ${error}`);
    return false;
  }
}

async function runAudit(): Promise<boolean> {
  try {
    // Call the TypeScript audit script directly
    const proc = Bun.spawn(["bun", "scripts/audit.ts"], {
      stdout: "inherit",
      stderr: "inherit"
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch (error) {
    console.log(`   ❌ Audit failed: ${error}`);
    return false;
  }
}

async function gitCommit(message: string): Promise<boolean> {
  try {
    // Stage all changes
    const addProc = Bun.spawn(["git", "add", "-A"], {
      stdout: "inherit",
      stderr: "inherit"
    });
    await addProc.exited;

    // Check if there's anything to commit
    const statusProc = Bun.spawn(["git", "status", "--porcelain"], {
      stdout: "pipe"
    });
    await statusProc.exited;

    if (statusProc.exitCode !== 0) {
      console.log("   ⚠️  No changes to commit");
      return true;
    }

    // Commit with co-authors
    const fullMessage = `${message}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>`;

    const commitProc = Bun.spawn(["git", "commit", "-m", fullMessage], {
      stdout: "inherit",
      stderr: "inherit"
    });
    await commitProc.exited;

    return commitProc.exitCode === 0;
  } catch (error) {
    console.log(`   ❌ Commit failed: ${error}`);
    return false;
  }
}

main();
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x scripts/dev-sync.ts` (Unix only)

- [ ] **Step 3: Test dev-sync.ts with dry run**

Run: `bun scripts/dev-sync.ts "test: validate dev-sync script"`
Expected: Script executes through all steps

- [ ] **Step 4: Commit dev-sync script**

```bash
git add scripts/dev-sync.ts
git commit -m "feat: add Bun-based dev-sync script

Implement single-source dev-sync pipeline in TypeScript.
Replaces dual .sh/.ps1 maintenance with cross-platform .ts file.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 5: Create Audit Script

**Files:**
- Create: `scripts/audit.ts`

**Purpose:** Documentation and path integrity audit in TypeScript

- [ ] **Step 1: Create scripts/audit.ts**

```typescript
#!/usr/bin/env bun

/**
 * Documentation Audit Script
 * Checks workspace standards and documentation integrity
 */

interface AuditCheck {
  name: string;
  status: "PASS" | "FAIL";
  message?: string;
}

const checks: AuditCheck[] = [];

async function main(): Promise<void> {
  console.log("=== audit.ts — workspace standards check ===\n");

  // Required files check
  await checkRequiredFiles();

  // Script parity check
  await checkScriptParity();

  // Summary
  printSummary();
}

async function checkRequiredFiles(): Promise<void> {
  const requiredFiles = [
    "CHANGELOG.md",
    "CONSTITUTION.md",
    "docs/context.md",
    "AGENTS.md",
    ".env.sample"
  ];

  for (const file of requiredFiles) {
    const exists = await fileExists(file);
    checks.push({
      name: `${file} exists`,
      status: exists ? "PASS" : "FAIL",
      message: exists ? undefined : "File not found"
    });
  }

  // CHANGELOG has [Unreleased]
  const changelog = await Bun.file("CHANGELOG.md").text();
  checks.push({
    name: "CHANGELOG.md has [Unreleased]",
    status: changelog.includes("## [Unreleased]") ? "PASS" : "FAIL"
  });
}

async function checkScriptParity(): Promise<void> {
  const scriptBases = [
    "audit", "dev-sync", "gen-pr-body", "git-sync",
    "install-vsp", "setup", "sync-md", "vsp-audit",
    "vsp-publish", "vsp-sync", "vsp-task"
  ];

  for (const base of scriptBases) {
    const shExists = await fileExists(`scripts/${base}.sh`);
    const ps1Exists = await fileExists(`scripts/${base}.ps1`);

    if (shExists && ps1Exists) {
      checks.push({
        name: `script parity: ${base}.sh / ${base}.ps1`,
        status: "PASS"
      });
    } else if (!shExists && !ps1Exists) {
      // Neither exists - might be .ts now
      checks.push({
        name: `script parity: ${base} (.ts)`,
        status: "PASS"
      });
    } else {
      checks.push({
        name: `script parity: ${base}`,
        status: "FAIL",
        message: "Only one platform version exists"
      });
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Bun.file(path).text();
    return true;
  } catch {
    return false;
  }
}

function printSummary(): void {
  const passed = checks.filter(c => c.status === "PASS").length;
  const failed = checks.filter(c => c.status === "FAIL").length;

  for (const check of checks) {
    const icon = check.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} [${check.status}] ${check.name}`);
    if (check.message) {
      console.log(`   ${check.message}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\n❌ Some checks failed");
    process.exit(1);
  } else {
    console.log("\n✅ All checks passed");
  }
}

main();
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x scripts/audit.ts` (Unix only)

- [ ] **Step 3: Test audit.ts**

Run: `bun scripts/audit.ts`
Expected: All checks pass

- [ ] **Step 4: Commit audit script**

```bash
git add scripts/audit.ts
git commit -m "feat: add Bun-based audit script

Implement documentation audit in TypeScript.
Checks required files, script parity, and workspace standards.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 6: Create Health Check Script

**Files:**
- Create: `scripts/health-check.ts`

**Purpose:** System health monitoring (SAP, MCP, git, memory)

- [ ] **Step 1: Create scripts/health-check.ts**

```typescript
#!/usr/bin/env bun

/**
 * System Health Check Script
 * Monitors SAP connectivity, MCP servers, git status, and memory logs
 */

interface HealthCheck {
  name: string;
  status: "OK" | "WARN" | "FAIL";
  details?: string;
}

async function main(): Promise<void> {
  console.log("🏥 VSP System Health Check\n");

  const checks: HealthCheck[] = [];

  // Check vsp binary
  checks.push(await checkVSPBinary());

  // Check MCP servers
  checks.push(await checkMCPConfig());

  // Check git status
  checks.push(await checkGitStatus());

  // Check memory log
  checks.push(await checkMemoryLog());

  // Print results
  printResults(checks);

  // Generate status file
  await generateStatusFile(checks);
}

async function checkVSPBinary(): Promise<HealthCheck> {
  try {
    const proc = Bun.spawn(["./vsp", "health"], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await proc.exited;

    if (proc.exitCode === 0) {
      return { name: "VSP Binary", status: "OK" };
    } else {
      return {
        name: "VSP Binary",
        status: "FAIL",
        details: "vsp health check failed"
      };
    }
  } catch {
    return {
      name: "VSP Binary",
      status: "FAIL",
      details: "vsp binary not found or not executable"
    };
  }
}

async function checkMCPConfig(): Promise<HealthCheck> {
  try {
    const mcpConfig = await Bun.file(".mcp.json").text();
    const config = JSON.parse(mcpConfig);

    if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
      const servers = Object.keys(config.mcpServers).join(", ");
      return {
        name: "MCP Config",
        status: "OK",
        details: `Servers: ${servers}`
      };
    } else {
      return {
        name: "MCP Config",
        status: "WARN",
        details: "No MCP servers configured"
      };
    }
  } catch {
    return {
      name: "MCP Config",
      status: "FAIL",
      details: ".mcp.json not found or invalid"
    };
  }
}

async function checkGitStatus(): Promise<HealthCheck> {
  try {
    const proc = Bun.spawn(["git", "status", "--porcelain"], {
      stdout: "pipe"
    });
    const output = await proc.stdout.text();
    await proc.exited;

    if (output.trim().length > 0) {
      const lines = output.trim().split("\n").length;
      return {
        name: "Git Status",
        status: "WARN",
        details: `${lines} uncommitted changes`
      };
    } else {
      return { name: "Git Status", status: "OK" };
    }
  } catch {
    return {
      name: "Git Status",
      status: "FAIL",
      details: "git command failed"
    };
  }
}

async function checkMemoryLog(): Promise<HealthCheck> {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const memoryPath = `memory/${today}.md`;

  try {
    await Bun.file(memoryPath).text();
    return {
      name: "Memory Log",
      status: "OK",
      details: `Today's log exists: ${memoryPath}`
    };
  } catch {
    return {
      name: "Memory Log",
      status: "WARN",
      details: `Today's log not found: ${memoryPath}`
    };
  }
}

function printResults(checks: HealthCheck[]): void {
  for (const check of checks) {
    const icon = check.status === "OK" ? "✅" : check.status === "WARN" ? "⚠️" : "❌";
    console.log(`${icon} ${check.name}: ${check.status}`);
    if (check.details) {
      console.log(`   ${check.details}`);
    }
  }

  const failed = checks.filter(c => c.status === "FAIL").length;
  if (failed > 0) {
    console.log(`\n❌ ${failed} check(s) failed`);
    process.exit(1);
  }
}

async function generateStatusFile(checks: HealthCheck[]): Promise<void> {
  const timestamp = new Date().toISOString();
  const content = `# VSP System Status

Generated: ${timestamp}

| Check | Status | Details |
|-------|--------|---------|
${checks.map(c => {
  const icon = c.status === "OK" ? "✅" : c.status === "WARN" ? "⚠️" : "❌";
  return `| ${c.name} | ${icon} ${c.status} | ${c.details || ""} |`;
}).join("\n")}

`;

  await Bun.write("scratch/status.md", content);
  console.log("\n📄 Status saved to scratch/status.md");
}

main();
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x scripts/health-check.ts` (Unix only)

- [ ] **Step 3: Create scratch directory**

Run: `mkdir -p scratch`

- [ ] **Step 4: Test health-check.ts**

Run: `bun scripts/health-check.ts`
Expected: Health status displayed and saved to scratch/status.md

- [ ] **Step 5: Commit health-check script**

```bash
git add scripts/health-check.ts scratch/status.md
git commit -m "feat: add Bun-based health check script

Implement system health monitoring in TypeScript.
Checks VSP binary, MCP config, git status, and memory logs.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 7: Create Bun Installer Scripts

**Files:**
- Create: `scripts/install-bun.sh`
- Create: `scripts/install-bun.ps1`

**Purpose:** Provide automated Bun installation for all platforms

- [ ] **Step 1: Create scripts/install-bun.sh**

```bash
#!/usr/bin/env bash
# Bun installer for Unix/macOS

set -e

echo "📦 Installing Bun..."

if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    echo "✅ Bun is already installed: $BUN_VERSION"
    echo ""
    echo "To upgrade, run: bun upgrade"
    exit 0
fi

# Install Bun using official installer
curl -fsSL https://bun.sh/install | bash

# Set up environment
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo ""
echo "✅ Bun installed successfully!"
echo "   Version: $(bun --version)"
echo ""
echo "⚠️  Add this to your shell profile (~/.bashrc, ~/.zshrc, or ~/.config/fish/config.fish):"
echo ""
echo "   # Bun"
echo '   export BUN_INSTALL="$HOME/.bun"'
echo '   export PATH="$BUN_INSTALL/bin:$PATH"'
echo ""
echo "Then restart your shell or run: source ~/.bashrc (or ~/.zshrc)"
```

- [ ] **Step 2: Create scripts/install-bun.ps1**

```powershell
# Bun installer for Windows

Write-Host "📦 Installing Bun..." -ForegroundColor Cyan

# Check if bun is already installed
if (Get-Command bun -ErrorAction SilentlyContinue) {
    $version = bun --version
    Write-Host "✅ Bun is already installed: $version" -ForegroundColor Green
    Write-Host ""
    Write-Host "To upgrade, run: bun upgrade" -ForegroundColor Yellow
    exit 0
}

# Install Bun using official installer
powershell -c "irm bun.sh/install.ps1 | iex"

Write-Host ""
Write-Host "✅ Bun installed successfully!" -ForegroundColor Green
Write-Host "   Version: $(bun --version)"
Write-Host ""
Write-Host "⚠️  Restart your terminal to use Bun" -ForegroundColor Yellow
```

- [ ] **Step 3: Make install-bun.sh executable**

Run: `chmod +x scripts/install-bun.sh`

- [ ] **Step 4: Test installers on respective platforms**

Run (Unix): `bash scripts/install-bun.sh` (on Unix/macOS)
Run (Windows): `powershell -ExecutionPolicy Bypass -File scripts/install-bun.ps1` (on Windows)

- [ ] **Step 5: Commit installer scripts**

```bash
git add scripts/install-bun.sh scripts/install-bun.ps1
git commit -m "feat: add Bun installer scripts

Add automated Bun installation for Unix/macOS and Windows.
Provides one-time setup for Bun runtime environment.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 7A: Create Post-Write QA Script

**Files:**
- Create: `scripts/post-write.ts`

**Purpose:** Automated Post-Write QA chain (SyntaxCheck → RunUnitTests → RunATCCheck)

- [ ] **Step 1: Create scripts/post-write.ts**

```typescript
#!/usr/bin/env bun

/**
 * Post-Write QA Chain
 * Runs SyntaxCheck → RunUnitTests → RunATCCheck for a given ABAP object
 *
 * Usage: bun scripts/post-write.ts "<object_url>"
 */

interface QAResult {
  step: string;
  status: "PASS" | "FAIL" | "WARN";
  exitCode: number;
  output?: string;
}

async function main(): Promise<void> {
  const objectUrl = process.argv[2];

  if (!objectUrl) {
    console.error("❌ Error: Object URL required");
    console.error("Usage: bun scripts/post-write.ts \"<object_url>\"");
    process.exit(1);
  }

  console.log("🔍 Post-Write QA Chain");
  console.log(`Object: ${objectUrl}\n`);

  const results: QAResult[] = [];

  // Step 1: Syntax Check
  console.log("1️⃣  Syntax Check");
  const syntaxResult = await runSyntaxCheck(objectUrl);
  results.push(syntaxResult);

  if (syntaxResult.status !== "PASS") {
    console.log(`   ❌ Syntax check failed - aborting QA chain`);
    printResults(results);
    process.exit(1);
  }

  // Step 2: Unit Tests
  console.log("\n2️⃣  Unit Tests");
  const testResult = await runUnitTests(objectUrl);
  results.push(testResult);

  // Step 3: ATC Check
  console.log("\n3️⃣  ATC Check");
  const atcResult = await runATCCheck(objectUrl);
  results.push(atcResult);

  // Print summary
  printResults(results);

  // Exit with appropriate code
  const hasP1Failures = atcResult.output?.includes("P1") || atcResult.exitCode !== 0;
  process.exit(hasP1Failures ? 1 : 0);
}

async function runSyntaxCheck(objectUrl: string): Promise<QAResult> {
  try {
    const proc = Bun.spawn(["vsp", "syntax", "check", "--object", objectUrl], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await proc.exited;

    return {
      step: "Syntax Check",
      status: proc.exitCode === 0 ? "PASS" : "FAIL",
      exitCode: proc.exitCode
    };
  } catch (error) {
    return {
      step: "Syntax Check",
      status: "FAIL",
      exitCode: 1,
      output: String(error)
    };
  }
}

async function runUnitTests(objectUrl: string): Promise<QAResult> {
  try {
    const proc = Bun.spawn(["vsp", "test", "run", "--object", objectUrl], {
      stdout: "pipe",
      stderr: "pipe"
    });
    const output = await proc.stdout.text();
    await proc.exited;

    return {
      step: "Unit Tests",
      status: proc.exitCode === 0 ? "PASS" : "WARN",
      exitCode: proc.exitCode,
      output: output.substring(0, 200)
    };
  } catch (error) {
    return {
      step: "Unit Tests",
      status: "WARN",
      exitCode: 1,
      output: String(error)
    };
  }
}

async function runATCCheck(objectUrl: string): Promise<QAResult> {
  try {
    const proc = Bun.spawn(["vsp", "atc", "run", "--object", objectUrl], {
      stdout: "pipe",
      stderr: "pipe"
    });
    const output = await proc.stdout.text();
    await proc.exited;

    // Check for P1 findings
    const hasP1 = output.includes("P1");

    return {
      step: "ATC Check",
      status: hasP1 ? "FAIL" : proc.exitCode === 0 ? "PASS" : "WARN",
      exitCode: proc.exitCode,
      output: hasP1 ? "P1 findings detected" : output.substring(0, 200)
    };
  } catch (error) {
    return {
      step: "ATC Check",
      status: "FAIL",
      exitCode: 1,
      output: String(error)
    };
  }
}

function printResults(results: QAResult[]): void {
  console.log("\n" + "=".repeat(50));
  console.log("QA Results:");

  for (const result of results) {
    const icon = result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️" : "❌";
    console.log(`${icon} ${result.step}: ${result.status}`);
    if (result.output) {
      console.log(`   ${result.output}`);
    }
  }

  const failed = results.filter(r => r.status === "FAIL").length;
  if (failed > 0) {
    console.log(`\n❌ ${failed} critical failure(s) - must fix before committing`);
  } else {
    console.log("\n✅ QA passed - safe to commit");
  }
}

main();
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x scripts/post-write.ts` (Unix only)

- [ ] **Step 3: Test post-write.ts**

Run: `bun scripts/post-write.ts "/sap/bc/adt/vit/test/object"`
Expected: QA chain executes through all steps

- [ ] **Step 4: Commit post-write script**

```bash
git add scripts/post-write.ts
git commit -m "feat: add Post-Write QA automation script

Implement automated QA chain (SyntaxCheck → UnitTests → ATC).
Blocks commit on P1 findings or syntax errors.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 8: Create Legacy Wrapper Scripts

**Files:**
- Create: `scripts/dev-sync.sh`
- Create: `scripts/audit.sh`
- Create: `scripts/sync-mcp.sh`
- Create: `scripts/health-check.sh`

**Purpose:** Provide backward compatibility for existing workflows

**Note:** Wrappers are created at `scripts/` root level (not `scripts/legacy/`) to maintain existing workflow compatibility.

- [ ] **Step 1: Create legacy wrapper template (same for all)**

For `scripts/dev-sync.sh`:
```bash
#!/usr/bin/env bash
# Legacy wrapper for backward compatibility
# Delegates to Bun-based implementation

# Check if bun is available
if command -v bun &> /dev/null; then
    exec bun scripts/dev-sync.ts "$@"
else
    echo "❌ Bun is required. Run: bash scripts/install-bun.sh"
    exit 1
fi
```

For `scripts/audit.sh`:
```bash
#!/usr/bin/env bash
# Legacy wrapper for backward compatibility
# Delegates to Bun-based implementation

if command -v bun &> /dev/null; then
    exec bun scripts/audit.ts "$@"
else
    echo "❌ Bun is required. Run: bash scripts/install-bun.sh"
    exit 1
fi
```

For `scripts/sync-mcp.sh`:
```bash
#!/usr/bin/env bash
# Legacy wrapper for backward compatibility

if command -v bun &> /dev/null; then
    exec bun scripts/sync-mcp.ts "$@"
else
    echo "❌ Bun is required. Run: bash scripts/install-bun.sh"
    exit 1
fi
```

For `scripts/health-check.sh`:
```bash
#!/usr/bin/env bash
# Legacy wrapper for backward compatibility

if command -v bun &> /dev/null; then
    exec bun scripts/health-check.ts "$@"
else
    echo "❌ Bun is required. Run: bash scripts/install-bun.sh"
    exit 1
fi
```

- [ ] **Step 2: Make all wrappers executable**

Run: `chmod +x scripts/*.sh`

- [ ] **Step 3: Test wrappers**

Run: `bash scripts/dev-sync.sh "test: wrapper validation"`
Expected: Executes via Bun successfully

- [ ] **Step 4: Commit legacy wrappers**

```bash
git add scripts/dev-sync.sh scripts/audit.sh scripts/sync-mcp.sh scripts/health-check.sh
git commit -m "feat: add legacy wrapper scripts for backward compatibility

Provide .sh wrappers at scripts/ root that delegate to Bun-based .ts scripts.
Ensures existing workflows continue to work during migration.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 8A: Create Verify Skills Script

**Files:**
- Create: `scripts/verify-skills.ts`

**Purpose:** Verify all skills are loadable and properly formatted

- [ ] **Step 1: Create scripts/verify-skills.ts**

```typescript
#!/usr/bin/env bun

/**
 * Skill Verification Script
 * Verifies all skills in skills/ directory are loadable and properly formatted
 */

interface SkillCheck {
  name: string;
  path: string;
  status: "PASS" | "FAIL" | "WARN";
  issues: string[];
}

async function main(): Promise<void> {
  console.log("🔍 Verifying Skills\n");

  const checks = await scanSkills();

  for (const check of checks) {
    const icon = check.status === "PASS" ? "✅" : check.status === "WARN" ? "⚠️" : "❌";
    console.log(`${icon} ${check.name}`);
    for (const issue of check.issues) {
      console.log(`   ${issue}`);
    }
  }

  const failed = checks.filter(c => c.status === "FAIL").length;
  const warned = checks.filter(c => c.status === "WARN").length;

  console.log(`\n${checks.length} skills checked`);
  if (failed > 0) {
    console.log(`❌ ${failed} failed`);
    process.exit(1);
  } else if (warned > 0) {
    console.log(`⚠️  ${warned} warnings`);
  } else {
    console.log("✅ All skills verified");
  }
}

async function scanSkills(): Promise<SkillCheck[]> {
  const checks: SkillCheck[] = [];

  // Use native filesystem API for cross-platform compatibility
  async function scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await Array.fromAsync(await Bun.dir(dir));

    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory && !entry.name.startsWith(".")) {
        // Recurse into subdirectories
        const subFiles = await scanDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile && entry.name === "SKILL.md") {
        files.push(fullPath);
      }
    }
    return files;
  }

  const skillFiles = await scanDirectory("skills");

  for (const skillFile of skillFiles) {
    const check = await verifySkill(skillFile);
    checks.push(check);
  }

  return checks;
}

async function verifySkill(skillFile: string): Promise<SkillCheck> {
  const issues: string[] = [];
  let status: "PASS" | "FAIL" | "WARN" = "PASS";

  try {
    const content = await Bun.file(skillFile).text();

    // Check for frontmatter
    if (!content.startsWith("---")) {
      issues.push("Missing frontmatter");
      status = "FAIL";
    } else {
      // Extract frontmatter
      const frontmatterEnd = content.indexOf("---", 3);
      if (frontmatterEnd === -1) {
        issues.push("Invalid frontmatter (missing closing ---)");
        status = "FAIL";
      } else {
        const frontmatter = content.substring(3, frontmatterEnd);

        // Check required fields
        if (!frontmatter.includes("name:")) {
          issues.push("Missing 'name' field");
          status = "FAIL";
        }
        if (!frontmatter.includes("description:")) {
          issues.push("Missing 'description' field");
          status = "WARN";
        }
        if (!frontmatter.includes("metadata:")) {
          issues.push("Missing 'metadata' section");
          status = "WARN";
        }
      }
    }

    // Check for content after frontmatter
    const contentStart = content.indexOf("---", 3);
    if (contentStart !== -1) {
      const bodyContent = content.substring(contentStart + 3).trim();
      if (bodyContent.length < 50) {
        issues.push("Skill content seems too short");
        status = "WARN";
      }
    }

    const skillName = skillFile.match(/skills\/([^/]+)\//)?.[1] || skillFile;

    return {
      name: skillName,
      path: skillFile,
      status,
      issues
    };
  } catch (error) {
    return {
      name: skillFile,
      path: skillFile,
      status: "FAIL",
      issues: [`Failed to read: ${error}`]
    };
  }
}

main();
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x scripts/verify-skills.ts` (Unix only)

- [ ] **Step 3: Test verify-skills.ts**

Run: `bun scripts/verify-skills.ts`
Expected: All skills verified

- [ ] **Step 4: Commit verify-skills script**

```bash
git add scripts/verify-skills.ts
git commit -m "feat: add skill verification script

Implement automated skill verification.
Checks frontmatter, required fields, and content for all skills.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 9: Create Scripts README

**Files:**
- Create: `scripts/README.md`

**Purpose:** Document script usage and migration

- [ ] **Step 1: Create scripts/README.md**

```markdown
# VSP Scripts

## Bun-based Automation

All scripts are written in **TypeScript** and run via **Bun** for cross-platform compatibility.

## Prerequisites

```bash
# Install Bun (one-time)
bash scripts/install-bun.sh       # Unix/macOS
powershell -c "irm bun.sh/install.ps1"    # Windows
```

## Usage

### Direct Bun execution
```bash
bun scripts/dev-sync.ts "feat: add feature"
bun scripts/audit.ts
bun scripts/health-check.ts
```

### Via npm scripts
```bash
bun run dev-sync "feat: add feature"
bun run audit
bun run health
```

### Legacy wrappers (backward compatible)
```bash
bash scripts/dev-sync.sh "feat: add feature"
bash scripts/audit.sh
```

## Available Scripts

| Script | Purpose | Priority |
|--------|---------|:--------:|
| `dev-sync.ts` | Full dev sync pipeline (changelog → audit → commit) | P0 |
| `audit.ts` | Documentation and path integrity audit | P0 |
| `sync-mcp.ts` | Synchronize .mcp.json to tool-specific settings | P0 |
| `health-check.ts` | System health (SAP, MCP, git, memory) | P2 |
| `post-write.ts` | Post-write QA chain (SyntaxCheck → UnitTests → ATC) | P1 |
| `verify-skills.ts` | Verify all skills are loadable | P1 |

## Migration from .sh/.ps1

Legacy `.sh` wrappers are provided at `scripts/` root for backward compatibility.
These delegate to the Bun-based `.ts` implementations.
New development should use `.ts` files directly via `bun scripts/<name>.ts`.

## Troubleshooting

### Bun not found
```bash
bash scripts/install-bun.sh
```

### Permission denied on .ts files
```bash
chmod +x scripts/*.ts
```

### Script fails to run
1. Check Bun is installed: `bun --version`
2. Check file permissions: `ls -la scripts/*.ts`
3. Run with verbose output: `bun --verbose scripts/script.ts`
```

- [ ] **Step 2: Commit README**

```bash
git add scripts/README.md
git commit -m "docs: add scripts README

Document Bun-based script usage, migration path, and troubleshooting.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 10: Create Memory Index Updater

**Files:**
- Create: `scripts/update-memory-index.ts`

**Purpose:** Auto-update memory/MEMORY.md index

- [ ] **Step 1: Create scripts/update-memory-index.ts**

```typescript
#!/usr/bin/env bun

/**
 * Memory Index Updater
 * Automatically updates memory/MEMORY.md with entries from memory/YYYY-MM-DD.md
 */

interface MemoryEntry {
  date: string;
  file: string;
  summary: string;
}

async function main(): Promise<void> {
  console.log("📝 Updating memory index...\n");

  const entries = await scanMemoryFiles();

  if (entries.length === 0) {
    console.log("No memory files found");
    return;
  }

  const indexContent = generateIndexContent(entries);
  await Bun.write("memory/MEMORY.md", indexContent);

  console.log(`✅ Updated memory/MEMORY.md with ${entries.length} entries`);
}

async function scanMemoryFiles(): Promise<MemoryEntry[]> {
  const entries: MemoryEntry[] = [];

  // Use native filesystem API for cross-platform compatibility
  async function scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await Array.fromAsync(await Bun.dir(dir));

    for (const entry of entries) {
      if (entry.isFile && entry.name.endsWith(".md")) {
        files.push(`${dir}/${entry.name}`);
      }
    }
    return files;
  }

  const files = await scanDirectory("memory");

  for (const file of files) {
    if (file.endsWith("MEMORY.md")) continue;

    const content = await Bun.file(file).text();
    const summary = extractSummary(content);

    const match = file.match(/memory\/(\d{4}-\d{2}-\d{2})\.md/);
    if (match) {
      entries.push({
        date: match[1],
        file: file.replace("memory/", ""),
        summary
      });
    }
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function extractSummary(content: string): string {
  // Look for first heading or first substantial line
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.replace("# ", "");
    }
    if (trimmed.length > 10 && !trimmed.startsWith(">")) {
      return trimmed.substring(0, 60) + (trimmed.length > 60 ? "..." : "");
    }
  }

  return "No summary available";
}

function generateIndexContent(entries: MemoryEntry[]): string {
  let content = "# Memory Index\n\n";
  content += "| Date | Summary |\n";
  content += "|------|---------|\n";

  for (const entry of entries) {
    const link = `[${entry.date}](${entry.file})`;
    const summary = entry.summary.replace(/\|/g, "\\|");
    content += `| ${link} | ${summary} |\n`;
  }

  content += "\n<!-- Auto-generated by scripts/update-memory-index.ts -->\n";

  return content;
}

main();
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x scripts/update-memory-index.ts`

- [ ] **Step 3: Test memory index updater**

Run: `bun scripts/update-memory-index.ts`
Expected: memory/MEMORY.md updated with table of entries

- [ ] **Step 4: Commit memory index updater**

```bash
git add scripts/update-memory-index.ts memory/MEMORY.md
git commit -m "feat: add memory index updater

Auto-generate memory/MEMORY.md table from memory/YYYY-MM-DD.md files.
Provides searchable index of all development sessions.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 11: Reorganize Documentation

**Files:**
- Modify: `docs/context.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `GEMINI.md`

**Purpose:** Eliminate documentation overlap and clarify Single Source of Truth

- [ ] **Step 1: Read current docs to identify overlapping content**

Run: `grep -n "agent" docs/context.md | head -20`
Run: `grep -n "workflow" docs/context.md | head -20`

- [ ] **Step 2: Remove agent workflow sections from docs/context.md**

Delete sections from `docs/context.md` that duplicate `AGENTS.md`:
- Agent list and descriptions
- Agent coordination workflow
- Subagent dispatch protocol

Keep in `docs/context.md`:
- Project overview
- Tech stack
- Architecture
- Environment setup
- Directory reference
- Development workflow (high-level)
- Key files
- ABAP development rules
- Coding guidelines
- Project-wide rules

- [ ] **Step 3: Add reference to AGENTS.md in docs/context.md**

Add to `docs/context.md`:
```markdown
## Agent Roles and Orchestration

For the complete agent registry, role definitions, and orchestration rules,
see [AGENTS.md](../AGENTS.md).
```

- [ ] **Step 4: Update AGENTS.md with error recovery section**

Add to `AGENTS.md`:
```markdown
### Error Recovery

When a subagent fails or returns unexpected results:

1. **Analyze the error**: Check if it's a tool error, context issue, or logic problem
2. **Retry with clarification**: Provide more specific instructions
3. **Escalate to human**: If 3 retries fail, surface the issue to the user
4. **Document the pattern**: Add to memory/ for future reference
```

- [ ] **Step 5: Update CLAUDE.md and GEMINI.md MCP workflow**

Add to both `CLAUDE.md` and `GEMINI.md`:
```markdown
## MCP Configuration

MCP servers are configured in `.mcp.json` (Single Source of Truth).
Use `bun scripts/sync-mcp.ts` to synchronize changes to tool-specific settings.

See `.mcp.json` for the complete server list.
```

- [ ] **Step 6: Commit documentation changes**

```bash
git add docs/context.md AGENTS.md CLAUDE.md GEMINI.md
git commit -m "docs: reorganize documentation structure

Remove agent workflow overlap from context.md.
Add error recovery section to AGENTS.md.
Update MCP workflow references in CLAUDE.md and GEMINI.md.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 12: Create Agent Dispatch Templates

**Files:**
- Create: `templates/dispatch-parallel.md`
- Create: `templates/dispatch-serial.md`
- Create: `agents/handoff-spec.md`

**Purpose:** Standardize agent dispatch and handoff formats

- [ ] **Step 1: Create templates directory**

Run: `mkdir -p templates`

- [ ] **Step 2: Create templates/dispatch-parallel.md**

```markdown
# Parallel Dispatch Template

Use this template when dispatching multiple read-only subagents simultaneously.

## When to Use

- Read-only research (codebase scan, schema inspection, business data queries)
- Independent analysis tasks that don't share state
- Phase 1 triage and investigation

## Template

```
Agent(
  description = "Brief description of subagent 1",
  prompt = """You are a [role]. Your task is to [specific task].

Context: [relevant context, file paths, expectations]

Output format: [expected output format]
""",
  subagent_type = "claude"
)

Agent(
  description = "Brief description of subagent 2",
  prompt = """You are a [role]. Your task is to [specific task].

Context: [relevant context, file paths, expectations]

Output format: [expected output format]
""",
  subagent_type = "claude"
)
```

## Important

- Dispatch all parallel agents in a single message (multiple tool calls)
- Wait for ALL to return before proceeding
- Merge results before next step
```

- [ ] **Step 3: Create templates/dispatch-serial.md**

```markdown
# Serial Dispatch Template

Use this template when dispatching subagents that must run sequentially.

## When to Use

- Write operations (EditSource, WriteSource)
- Tasks that depend on previous agent output
- Verification chains (code → test → review)

## Template

```
# Step 1: [Agent 1 task]
Agent(
  description = "Brief description",
  prompt = """You are a [role]. Task: [specific task].

Output: [what to produce]
""",
  subagent_type = "claude"
)

# Wait for result, then...

# Step 2: [Agent 2 task - depends on Step 1]
Agent(
  description = "Brief description",
  prompt = """You are a [role]. Task: [specific task].

Previous output: [paste result from Step 1]

Output: [what to produce]
""",
  subagent_type = "claude"
)
```

## Important

- Each agent waits for previous to complete
- Pass previous output as context
- One tool call per agent
```

- [ ] **Step 4: Create agents/handoff-spec.md**

```markdown
# Agent Handoff Specification

## Purpose

Define standard format for agent-to-agent handoffs to ensure context is preserved.

## Handoff Format

```json
{
  "from_agent": "agent-name",
  "to_agent": "agent-name",
  "timestamp": "ISO-8601",
  "task_id": "identifier",
  "context": {
    "user_request": "original user request",
    "previous_findings": ["key finding 1", "key finding 2"],
    "files_touched": ["path/to/file1", "path/to/file2"],
    "decisions_made": ["decision 1 with rationale"],
    "next_steps": ["step 1", "step 2"]
  },
  "artifacts": {
    "spec": "path/to/spec.md",
    "output": "path/to/output.json"
  }
}
```

## Handoff File Location

Save to: `scratch/handoff-<task-id>-<timestamp>.json`

## Usage

1. **Before handoff**: Complete context object with all relevant information
2. **Save**: Write to handoff file
3. **Pass reference**: Provide file path to next agent
4. **Verify**: Next agent confirms receipt and understanding
```

- [ ] **Step 5: Commit templates and spec**

```bash
git add templates/ agents/handoff-spec.md
git commit -m "feat: add agent dispatch templates and handoff spec

Standardize parallel and serial dispatch templates.
Define JSON handoff format for agent context passing.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 13: Create Desktop App Fallback Skill

**Files:**
- Create: `skills/desktop-app-fallback/SKILL.md`

**Purpose:** Provide manual workflow for Desktop App (hooks don't fire)

- [ ] **Step 1: Create skill directory**

Run: `mkdir -p skills/desktop-app-fallback`

- [ ] **Step 2: Create skills/desktop-app-fallback/SKILL.md`

```markdown
---
name: desktop-app-fallback
description: Manual Post-Write QA chain for Claude Code Desktop App (hooks don't fire)
metadata:
  type: task
---

# Desktop App Post-Write Fallback

## When to Use

Use this skill when working in the **Claude Code Desktop App**, where `PostToolUse` hooks do not fire automatically.

## Trigger

After any `WriteSource` or `EditSource` operation in the Desktop App.

## Manual QA Chain

Run the following commands manually after each write operation:

```bash
# 1. Syntax Check
vsp syntax check --object "<object_url>"

# 2. Run Unit Tests
vsp test run --object "<object_url>"

# 3. Run ATC Check
vsp atc run --object "<object_url>"
```

## Or Use the Combined Script

```bash
bun scripts/post-write.ts "<object_url>"
```

## Expected Results

| Step | Required | Action on Fail |
|------|:--------:|----------------|
| Syntax Check | ✅ Pass | Fix syntax errors, re-run |
| Unit Tests | ⚠️ Best effort | Fix bugs if critical |
| ATC Check | ✅ P1 must pass | Fix P1 findings, document P2/P3 |

## After QA Pass

1. Sync changes: `bun scripts/sync-mcp.ts`
2. Commit: `bun scripts/dev-sync.ts "description"`
```

- [ ] **Step 3: Commit fallback skill**

```bash
git add skills/desktop-app-fallback/
git commit -m "feat: add Desktop App fallback skill

Provide manual QA chain workflow for Claude Code Desktop App.
Automatic hooks don't fire in Desktop App - this fills the gap.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 14: Generate Skill Index

**Files:**
- Create: `skills/SKILLS.md`

**Purpose:** Auto-generated index of all available skills

- [ ] **Step 1: Create skills/SKILLS.md**

```markdown
# Skills Index

Auto-generated index of all available skills in the `skills/` directory.

## Core Skills

| Skill | Description | Trigger |
|-------|-------------|---------|
| `abap-dev` | SAP ABAP development workflows and MCP tool optimization | Session start |
| `post-write-chain` | Mandatory QA chain after any WriteSource/EditSource | After write operations |
| `desktop-app-fallback` | Manual Post-Write QA for Desktop App | Desktop App usage |

## Module-Specific Skills

| Skill | Description | Trigger |
|-------|-------------|---------|
| `sap-sd` | Sales & Distribution module context | SD tasks (sales orders, billing) |
| `sap-mm` | Materials Management module context | MM tasks (purchasing, inventory) |
| `sap-fi` | Financial Accounting module context | FI tasks (journal entries, GL) |
| `sap-co` | Controlling module context | CO tasks (cost centers, CO-PA) |
| `sap-pp` | Production Planning module context | PP tasks (BOM, routing) |
| `sap-le` | Logistics Execution module context | LE tasks (shipping, warehouse) |

## Utility Skills

| Skill | Description | Trigger |
|-------|-------------|---------|
| `changelog` | Add entry to CHANGELOG.md [Unreleased] | After completing changes |
| `memlog` | Append session entry to memory/YYYY-MM-DD.md | During/after session |
| `new-task` | Create task file from template | New task start |
| `new-project` | Scaffold new project structure | New project start |
| `post-write` | Run Post-Write QA chain | After ABAP writes |
| `sync` | Full sync pipeline (memlog → changelog → audit → commit) | Session end |
| `transport` | Manage SAP Transport Requests | Transport operations |
| `triage` | Auto-classify and dispatch for SAP requests | New SAP task |
| `verify` | Verify code changes by running the app | Testing changes |

## Skill Loading

Skills are auto-discovered from the `skills/` directory at session start.

To add a new skill:
1. Create `skills/<skill-name>/SKILL.md`
2. Add frontmatter with `name`, `description`, `metadata.type`
3. Skill will be automatically discovered

---

*Generated: 2026-05-24*
*Source: `skills/` directory scan*
```

- [ ] **Step 2: Commit skill index**

```bash
git add skills/SKILLS.md
git commit -m "docs: add skills index

Auto-generated index of all available skills.
Provides quick reference for skill usage and triggers.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 15: Update Pre-commit Hook

**Files:**
- Modify: `.githooks/pre-commit`

**Purpose:** Add drift detection and QA checks to pre-commit

- [ ] **Step 1: Read current pre-commit hook**

Run: `cat .githooks/pre-commit`

- [ ] **Step 2: Add MCP drift check to pre-commit**

Add to `.githooks/pre-commit`:
```bash
# MCP configuration drift check
echo "🔍 Checking MCP configuration drift..."

if bash -c 'diff <(jq -S .mcpServers .mcp.json) <(jq -S .mcpServers .claude/settings.json)' 2>/dev/null | grep -q "^>"; then
    echo ""
    echo "❌ MCP config drift detected between .mcp.json and .claude/settings.json"
    echo "   Run: bun scripts/sync-mcp.ts"
    exit 1
fi

if bash -c 'diff <(jq -S .mcpServers .mcp.json) <(jq -S .mcpServers .gemini/settings.json)' 2>/dev/null | grep -q "^>"; then
    echo ""
    echo "❌ MCP config drift detected between .mcp.json and .gemini/settings.json"
    echo "   Run: bun scripts/sync-mcp.ts"
    exit 1
fi

echo "✅ MCP configuration in sync"
```

- [ ] **Step 3: Commit pre-commit update**

```bash
git add .githooks/pre-commit
git commit -m "feat: add MCP drift check to pre-commit hook

Detect MCP configuration drift before commit.
Prompt user to run sync-mcp.ts if drift detected.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Task 16: Final Verification

**Purpose:** Verify all Phase 1 components are working

- [ ] **Step 1: Run health check**

Run: `bun scripts/health-check.ts`
Expected: All checks pass

- [ ] **Step 2: Run audit**

Run: `bun scripts/audit.ts`
Expected: All checks pass

- [ ] **Step 3: Test MCP sync**

Run: `bun scripts/sync-mcp.ts`
Expected: Successful sync to both settings files

- [ ] **Step 4: Verify Bun installation**

Run: `bun --version`
Expected: Version 1.0.0+ displayed

- [ ] **Step 5: Test legacy wrappers**

Run: `bash scripts/dev-sync.sh "test: final verification"`
Expected: Executes successfully

- [ ] **Step 6: Update CHANGELOG.md**

Add entry to `CHANGELOG.md` under `[Unreleased]`:

```markdown
## [Unreleased]

### Added
- Bun-based single-source scripts (.ts) replacing dual .sh/.ps1
- .mcp.json as Single Source of Truth for MCP configuration
- MCP sync script (sync-mcp.ts) for automatic settings synchronization
- Health check script for system monitoring
- Memory index auto-updater
- Desktop App fallback skill for manual QA
- Agent dispatch templates and handoff specification
- Skills index (SKILLS.md)

### Changed
- Documentation reorganized: agent workflows moved to AGENTS.md
- MCP workflow references in CLAUDE.md and GEMINI.md
- Pre-commit hook now checks MCP configuration drift

### Deprecated
- Dual .sh/.ps1 script maintenance (use .ts instead)
```

- [ ] **Step 7: Final commit**

```bash
git add CHANGELOG.md
git commit -m "chore: Phase 1 Foundation Layer complete

Complete Phase 1 implementation:
- Bun runtime setup and core .ts scripts
- MCP configuration sync (SSoT approach)
- Documentation reorganization
- Agent dispatch templates
- Desktop App fallback skill

All P0 items completed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>"
```

---

## Success Criteria

Phase 1 is complete when:

- [ ] `.mcp.json` created and synced to both tool settings
- [ ] Bun runtime installed and verified
- [ ] Core .ts scripts implemented (dev-sync, audit, sync-mcp, health-check, post-write, verify-skills)
- [ ] Legacy wrappers created for backward compatibility (at scripts/ root)
- [ ] .gitignore updated to prevent .cmd files
- [ ] Documentation reorganization completed
- [ ] Agent dispatch templates created
- [ ] Skill index generated
- [ ] Desktop App fallback skill created
- [ ] Pre-commit hook updated with drift check

---

## Next Steps (Phase 2)

After Phase 1 completion:

1. **Agent Coordination Improvements** (P0)
   - Implement dispatch automation
   - Add error recovery mechanisms

2. **Skill System Enhancement** (P1)
   - Phase 2 skills as needed
   - Enhanced skill auto-discovery

3. **Documentation Updates**
   - Update AGENTS.md with Phase 2 patterns
   - Create Phase 2 design spec

---

*Plan Version: 1.2*
*Created: 2026-05-24*
*Revised: 2026-05-24 (Round 2: Fixed cross-platform violations)*
*Based on: docs/superpowers/specs/2026-05-24-project-improvement-design.md*
