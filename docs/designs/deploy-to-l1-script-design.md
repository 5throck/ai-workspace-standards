# deploy-to-l1.ts Script Design

## Metadata

- **Status**: Updated - Ready for Implementation (Manual deployment completed 2026-06-10)
- **Type**: Technical Design
- **Created**: 2026-06-09
- **Last Updated**: 2026-06-10
- **Author**: architect
- **Related**: ADR-0034 (L0→L1 Deployment Strategy)
- **Implementation Target**: scripts/deploy-to-l1.ts
- **Version**: 1.1.0

---

## Implementation Status

**2026-06-10 Manual Deployment Completed**:
- `templates/common/CLAUDE.md` — CONSTITUTION.md references replaced with `docs/context.md`
- `templates/common/AGENTS.md` — CONSTITUTION.md references replaced with `docs/context.md`
- `templates/common/GEMINI.md` — Synced from L0 (2026-06-08 version) + CONSTITUTION.md → `docs/context.md`
- `templates/common/agents/pm.md` — Already properly adapted for L1 (no changes needed)

The automated `deploy-to-l1.ts` script described below has not yet been implemented. The above changes were applied manually.

---

## 1. Script Architecture

### 1.1 Overview

The `deploy-to-l1.ts` script automates the deployment of L0 configuration files to L1 templates while ensuring L0-specific content is removed and references are properly transformed.

### 1.2 Core Responsibilities

1. **Section Filtering**: Remove L0-specific sections from source files
2. **Reference Transformation**: Update internal references (CONSTITUTION.md → templates/common/docs/context.md)
3. **File Permission Preservation**: Maintain executable permissions on scripts
4. **Backup Creation**: Timestamped backups before deployment
5. **Verification Integration**: Pre/post-deployment audit.ts execution
6. **L0 Leakage Detection**: Verify no L0 content remains in deployed files
7. **Rollback Capability**: Restore from backup if deployment fails

### 1.3 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│   L0     │───→│  Section     │───→│ Reference   │───→│   L1     │
│ Files    │    │  Filtering    │    │ Transform   │    │  Files   │
└──────────┘    └──────────────┘    └─────────────┘    └──────────┘
     │                  │                   │                  │
     v                  v                   v                  v
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ Backup   │    │ Dry-Run      │    │ Perms       │    │ Audit    │
│ Creation │    │ Preview      │    │ Preserved   │    │ Check    │
└──────────┘    └──────────────┘    └─────────────┘    └──────────┘
     │                  │                   │                  │
     └──────────────────┴───────────────────┴──────────────────┘
                           │
                           v
                  ┌──────────────┐
                  │  Deployment   │
                  │  Verification│
                  └──────────────┘
```

---

## 2. Input Parameters and CLI Interface

### 2.1 CLI Interface Specification

```bash
bun scripts/deploy-to-l1.ts [options]
```

### 2.2 Command Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--dry-run` | flag | false | Preview changes without writing files |
| `--execute` | flag | false | Execute actual deployment (required for file changes) |
| `--force` | flag | false | Skip pre-deployment confirmation prompts |
| `--backup-path` | string | `.deploy-backups/` | Custom backup directory path |
| `--verbose` | flag | false | Enable detailed logging |
| `--verify-only` | flag | false | Run verification without deployment |
| `--rollback` | string | null | Rollback to specific backup timestamp |
| `--no-backup` | flag | false | Skip backup creation (not recommended) |
| `--skip-audit` | flag | false | Skip audit.ts execution (for testing only) |

### 2.3 Exit Codes

| Code | Meaning | Action Required |
|------|---------|-----------------|
| 0 | Success | Deployment completed successfully |
| 1 | Verification Failed | Pre/post-deployment audit failed |
| 2 | Section Filtering Error | Failed to remove L0 sections |
| 3 | Reference Transform Error | Failed to update references |
| 4 | File Permission Error | Failed to preserve permissions |
| 5 | Backup Error | Failed to create/restore backup |
| 6 | L0 Leakage Detected | L0 content found in deployed files |
| 7 | Invalid Arguments | CLI options are invalid |
| 8 | Deployment Cancelled | User cancelled during confirmation |

---

## 3. Section Filtering Logic

### 3.1 CLAUDE.md Section Removal Rules

**Sections to completely remove:**

```typescript
const CLAUDE_MD_REMOVE_PATTERNS = [
  // L0→L1→L2 deployment strategy sections (use ### pattern for CLAUDE.md)
  {
    pattern: /###\s*5\s+Agent Dispatch Rules[\s\S]*?(?=###\s+\d|\Z)/,
    description: "Agent Dispatch Rules section (### 5)"
  },
  {
    pattern: /###\s*6\s+Native Sub-agents \(`Agent`\ Tool\)[\s\S]*?(?=###\s+\d|\Z)/,
    description: "Native Sub-agents section (### 6)"
  },
  {
    pattern: /###\s*7\s+Native Plan Mode \(`EnterPlanMode`\)[\s\S]*?(?=###\s+\d|\Z)/,
    description: "Native Plan Mode section (### 7)"
  },
  {
    pattern: /###\s*8\s+Task Tracking \(`TaskCreate` \/ `TaskUpdate`\)[\s\S]*?(?=###\s+\d|\Z)/,
    description: "Task Tracking section (### 8)"
  },
  {
    pattern: /###\s*9\s+Workspace & Template Boundary Policy[\s\S]*?(?=###\s+\d|\Z)/,
    description: "Workspace & Template Boundary Policy section (### 9)"
  },
  {
    pattern: /###\s*10\s+Custom Command Error Recovery[\s\S]*?(?=###\s+\d|\Z)/,
    description: "Custom Command Error Recovery section (### 10)"
  },
  // L0→L1→L2 deployment strategy references
  {
    pattern: /L0→L1→L2 deployment strategy[\s\S]*?(?=\n\n|\Z)/,
    description: "Deployment strategy references"
  },
  // Lifecycle Management Rules details
  {
    pattern: /Lifecycle Management Rules[\s\S]*?(?=\n\n|\Z)/,
    description: "Lifecycle Management Rules details"
  },
  // Execution Plan Boilerplate detailed content
  {
    pattern: /Execution Plan Boilerplate[\s\S]*?(?=\n\n|\Z)/,
    description: "Execution Plan Boilerplate content"
  }
];
```

### 3.2 GEMINI.md Section Removal Rules

**Sections to completely remove:**

```typescript
const GEMINI_MD_REMOVE_PATTERNS = [
  // Parallel sections to CLAUDE.md where applicable (use ### pattern for GEMINI.md)
  {
    pattern: /###\s*5\s+Agent Dispatch Rules[\s\S]*?(?=###\s+\d|\Z)/,
    description: "Agent Dispatch Rules section (### 5)"
  },
  // L0-specific hook implementations
  {
    pattern: /L0-specific hook implementations[\s\S]*?(?=\n\n|\Z)/,
    description: "L0-specific hook implementations"
  },
  // Workspace-root-specific git configurations
  {
    pattern: /Workspace-root-specific git configurations[\s\S]*?(?=\n\n|\Z)/,
    description: "Workspace-root-specific git configurations"
  }
];
```

### 3.3 agents/pm.md Section Removal Rules

**Sections to completely remove:**

```typescript
const PM_MD_REMOVE_PATTERNS = [
  // L0→L1→L2 deployment orchestration logic
  {
    pattern: /L0→L1→L2 deployment orchestration[\s\S]*?(?=\n\n|\Z)/,
    description: "Deployment orchestration logic"
  },
  // Workspace lifecycle management responsibilities
  {
    pattern: /Workspace lifecycle management[\s\S]*?(?=\n\n|\Z)/,
    description: "Workspace lifecycle management responsibilities"
  },
  // Template boundary enforcement mechanisms
  {
    pattern: /Template boundary enforcement[\s\S]*?(?=\n\n|\Z)/,
    description: "Template boundary enforcement mechanisms"
  }
];
```

**Note**: AGENTS.md section structure has been updated (2026-06-10):
- AGENTS.md now uses §1, §2, §3 (integrated PM Gateway Workflow)
- Section filtering patterns should match current AGENTS.md structure
- Reference transformation rules apply equally to AGENTS.md (9 references total)

### 3.4 Reference Transformation Rules

**CONSTITUTION.md → docs/context.md:**

```typescript
const REFERENCE_TRANSFORMS = [
  {
    pattern: /CONSTITUTION\.md/g,
    replacement: "docs/context.md",
    description: "CONSTITUTION.md → docs/context.md (L1/L2 reference)",
    files: ["CLAUDE.md", "GEMINI.md", "AGENTS.md"]
  },
  {
    pattern: /\[CONSTITUTION\.md/g,
    replacement: "[docs/context.md",
    description: "Markdown link reference transformation",
    files: ["CLAUDE.md", "GEMINI.md", "AGENTS.md"]
  },
  {
    pattern: /See\s+\[CONSTITUTION\.md/g,
    replacement: "See [docs/context.md",
    description: "Cross-reference text transformation",
    files: ["CLAUDE.md", "GEMINI.md", "AGENTS.md"]
  }
];
```

**Application Scope:**
- **CLAUDE.md**: 9 references to transform
- **GEMINI.md**: 8 references to transform  
- **AGENTS.md**: 9 references to transform

**Transformation Logic:**
1. Direct references: `CONSTITUTION.md` → `docs/context.md`
2. Markdown links: `[CONSTITUTION.md` → `[docs/context.md`
3. Cross-references: `See [CONSTITUTION.md` → `See [docs/context.md`

### 3.5 Preservation Rules

**Content to preserve in L1:**

1. **Agent-specific platform behaviors** (CLAUDE.md §1, GEMINI.md §1)
   - Platform-specific hook implementations
   - Native command registrations
   - Tool mappings and platform-specific features

2. **Native commands and skills** (CLAUDE.md §2, GEMINI.md §2)
   - Slash command definitions
   - Skill resolution priority rules
   - MCP configurations

3. **Git & PR additions** (CLAUDE.md §13, GEMINI.md §13)
   - Platform-specific git workflow additions
   - PR language policies
   - Commit protection rules

---

## 4. TypeScript Implementation Details

### 4.1 Core Interfaces and Types

```typescript
/**
 * Deployment configuration interface
 */
interface DeploymentConfig {
  sourceFiles: SourceFile[];
  targetDir: string;
  dryRun: boolean;
  createBackup: boolean;
  backupPath: string;
  verifyAfterDeploy: boolean;
  skipAudit: boolean;
  verbose: boolean;
}

/**
 * Source file definition
 */
interface SourceFile {
  source: string;        // Absolute path to L0 file
  target: string;       // Absolute path to L1 file
  removePatterns: SectionPattern[];
  transformRules: ReferenceTransform[];
  preservePerms: boolean;
}

/**
 * Section removal pattern
 */
interface SectionPattern {
  pattern: RegExp;
  description: string;
  required: boolean;
}

/**
 * Reference transformation rule
 */
interface ReferenceTransform {
  pattern: RegExp;
  replacement: string;
  description: string;
}

/**
 * Deployment result
 */
interface DeploymentResult {
  success: boolean;
  filesProcessed: number;
  sectionsRemoved: number;
  referencesTransformed: number;
  backupPath?: string;
  errors: DeploymentError[];
  warnings: string[];
}

/**
 * Deployment error
 */
interface DeploymentError {
  file: string;
  phase: 'backup' | 'filter' | 'transform' | 'write' | 'verify';
  message: string;
  details?: any;
}

/**
 * Backup metadata
 */
interface BackupMetadata {
  timestamp: string;
  filesBackedUp: string[];
  sourceHashes: Map<string, string>;
  deploymentConfig: DeploymentConfig;
}
```

### 4.2 Core Functions

#### 4.2.1 Main Deployment Orchestrator

```typescript
/**
 * Main deployment orchestrator
 */
async function deployToL1(config: DeploymentConfig): Promise<DeploymentResult> {
  const result: DeploymentResult = {
    success: false,
    filesProcessed: 0,
    sectionsRemoved: 0,
    referencesTransformed: 0,
    errors: [],
    warnings: []
  };

  try {
    // Phase 1: Pre-deployment validation
    await validatePreDeployment(config);

    // Phase 2: Create backup
    const backupPath = await createBackup(config);
    result.backupPath = backupPath;

    // Phase 3: Process each source file
    for (const file of config.sourceFiles) {
      const fileResult = await processSourceFile(file, config);
      result.filesProcessed++;
      result.sectionsRemoved += fileResult.sectionsRemoved;
      result.referencesTransformed += fileResult.referencesTransformed;
      
      if (fileResult.errors.length > 0) {
        result.errors.push(...fileResult.errors);
      }
      result.warnings.push(...fileResult.warnings);
    }

    // Phase 4: Post-deployment verification
    if (config.verifyAfterDeploy && !config.skipAudit) {
      await verifyDeployment(config);
    }

    // Phase 5: L0 leakage check
    await checkL0Leakage(config);

    result.success = result.errors.length === 0;
    return result;

  } catch (error) {
    result.errors.push({
      file: 'global',
      phase: 'verify',
      message: 'Deployment failed',
      details: error
    });

    // Rollback on critical failure
    if (config.createBackup && result.backupPath) {
      await rollbackDeployment(result.backupPath);
    }

    return result;
  }
}
```

#### 4.2.2 Source File Processing

```typescript
/**
 * Process a single source file
 */
async function processSourceFile(
  file: SourceFile,
  config: DeploymentConfig
): Promise<DeploymentResult> {
  const result: DeploymentResult = {
    success: false,
    filesProcessed: 0,
    sectionsRemoved: 0,
    referencesTransformed: 0,
    errors: [],
    warnings: []
  };

  try {
    // Read source file
    let content = await fs.readFile(file.source, 'utf-8');
    const originalContent = content;

    // Phase 1: Section filtering
    for (const pattern of file.removePatterns) {
      const matches = content.match(pattern.pattern);
      if (matches) {
        content = content.replace(pattern.pattern, '');
        result.sectionsRemoved++;

        if (config.verbose) {
          console.log(`Removed section: ${pattern.description}`);
        }
      } else if (pattern.required) {
        result.warnings.push(`Required section not found: ${pattern.description}`);
      }
    }

    // Phase 2: Reference transformation
    for (const transform of file.transformRules) {
      const matches = content.match(transform.pattern);
      if (matches) {
        content = content.replace(transform.pattern, transform.replacement);
        result.referencesTransformed += matches.length;

        if (config.verbose) {
          console.log(`Transformed ${matches.length} references: ${transform.description}`);
        }
      }
    }

    // Phase 3: Write or preview
    if (config.dryRun) {
      await previewChanges(file.source, file.target, originalContent, content);
    } else {
      await writeFileWithPermissions(file.target, content, file.source, file.preservePerms);
    }

    result.success = true;
    return result;

  } catch (error) {
    result.errors.push({
      file: file.source,
      phase: 'write',
      message: 'Failed to process source file',
      details: error
    });
    return result;
  }
}
```

#### 4.2.3 File Permission Preservation

```typescript
/**
 * Write file while preserving permissions
 */
async function writeFileWithPermissions(
  targetPath: string,
  content: string,
  sourcePath: string,
  preservePerms: boolean
): Promise<void> {
  // Ensure target directory exists
  const targetDir = path.dirname(targetPath);
  await fs.mkdir(targetDir, { recursive: true });

  // Write content
  await fs.writeFile(targetPath, content, 'utf-8');

  // Preserve permissions if requested
  if (preservePerms) {
    const sourceStats = await fs.stat(sourcePath);
    const sourceMode = sourceStats.mode;
    
    await fs.chmod(targetPath, sourceMode);
  }
}
```

#### 4.2.4 Backup Management

```typescript
/**
 * Create timestamped backup
 */
async function createBackup(config: DeploymentConfig): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(config.backupPath, timestamp);
  
  await fs.mkdir(backupDir, { recursive: true });

  const backupMetadata: BackupMetadata = {
    timestamp,
    filesBackedUp: [],
    sourceHashes: new Map(),
    deploymentConfig: config
  };

  for (const file of config.sourceFiles) {
    const targetPath = file.target;
    const relativePath = path.relative(config.targetDir, targetPath);
    const backupPath = path.join(backupDir, relativePath);

    // Create backup directory structure
    await fs.mkdir(path.dirname(backupPath), { recursive: true });

    // Backup existing file if it exists
    if (await fileExists(targetPath)) {
      await fs.copyFile(targetPath, backupPath);
      
      // Calculate source hash for verification
      const hash = await calculateFileHash(targetPath);
      backupMetadata.sourceHashes.set(relativePath, hash);
      backupMetadata.filesBackedUp.push(relativePath);
    }
  }

  // Save backup metadata
  const metadataPath = path.join(backupDir, 'backup-metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(backupMetadata, null, 2));

  return backupDir;
}

/**
 * Rollback deployment from backup
 */
async function rollbackDeployment(backupPath: string): Promise<void> {
  const metadataPath = path.join(backupPath, 'backup-metadata.json');
  const metadataContent = await fs.readFile(metadataPath, 'utf-8');
  const metadata: BackupMetadata = JSON.parse(metadataContent);

  for (const relativePath of metadata.filesBackedUp) {
    const backupFile = path.join(backupPath, relativePath);
    const targetFile = path.join(metadata.deploymentConfig.targetDir, relativePath);

    if (await fileExists(backupFile)) {
      await fs.copyFile(backupFile, targetFile);
      
      // Restore permissions
      const backupStats = await fs.stat(backupFile);
      await fs.chmod(targetFile, backupStats.mode);
    }
  }

  console.log(`Rollback complete from: ${backupPath}`);
}
```

#### 4.2.5 Verification Integration

```typescript
/**
 * Verify deployment integrity
 */
async function verifyDeployment(config: DeploymentConfig): Promise<void> {
  console.log('Running post-deployment verification...');

  // Run audit.ts
  const auditResult = await runAudit();
  
  if (auditResult.exitCode !== 0) {
    throw new Error(`Post-deployment audit failed: ${auditResult.stderr}`);
  }

  console.log('Post-deployment audit passed');
}

/**
 * Check for L0 leakage
 */
async function checkL0Leakage(config: DeploymentConfig): Promise<void> {
  console.log('Checking for L0 content leakage...');

  const l0Indicators = [
    'CONSTITUTION.md',
    'L0→L1→L2',
    'Workspace lifecycle management',
    'Template boundary enforcement',
    '## 5 Agent Dispatch Rules',
    '## 20 Native Sub-agents',
    '## 7 Native Plan Mode',
    '## 8 Task Tracking',
    '## 9 Workspace & Template Boundary Policy'
  ];

  for (const file of config.sourceFiles) {
    if (!(await fileExists(file.target))) continue;

    const content = await fs.readFile(file.target, 'utf-8');
    
    for (const indicator of l0Indicators) {
      if (content.includes(indicator)) {
        throw new Error(`L0 leakage detected in ${file.target}: found "${indicator}"`);
      }
    }
  }

  console.log('L0 leakage check passed');
}

/**
 * Run audit.ts and return result
 */
async function runAudit(): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const auditPath = path.join(process.cwd(), 'scripts', 'audit.ts');
  const proc = Bun.spawn(['bun', auditPath], {
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
}
```

### 4.3 File I/O Strategy

#### 4.3.1 Path Resolution

```typescript
/**
 * Resolve deployment paths
 */
function resolveDeploymentPaths(): SourceFile[] {
  const workspaceRoot = process.cwd();
  const targetDir = path.join(workspaceRoot, 'templates', 'common');

  return [
    {
      source: path.join(workspaceRoot, 'CLAUDE.md'),
      target: path.join(targetDir, 'CLAUDE.md'),
      removePatterns: CLAUDE_MD_REMOVE_PATTERNS,
      transformRules: REFERENCE_TRANSFORMS,
      preservePerms: false
    },
    {
      source: path.join(workspaceRoot, 'GEMINI.md'),
      target: path.join(targetDir, 'GEMINI.md'),
      removePatterns: GEMINI_MD_REMOVE_PATTERNS,
      transformRules: REFERENCE_TRANSFORMS,
      preservePerms: false
    },
    {
      source: path.join(workspaceRoot, 'agents', 'pm.md'),
      target: path.join(targetDir, 'agents', 'pm.md'),
      removePatterns: PM_MD_REMOVE_PATTERNS,
      transformRules: REFERENCE_TRANSFORMS,
      preservePerms: false
    }
  ];
}
```

#### 4.3.2 Utility Functions

```typescript
/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate file hash for verification
 */
async function calculateFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Preview changes (dry-run mode)
 */
async function previewChanges(
  sourcePath: string,
  targetPath: string,
  originalContent: string,
  newContent: string
): Promise<void> {
  console.log(`\n=== Dry-run Preview: ${path.basename(sourcePath)} ===`);
  console.log(`Source: ${sourcePath}`);
  console.log(`Target: ${targetPath}`);
  
  // Show diff summary
  const diff = generateDiffSummary(originalContent, newContent);
  console.log(diff);
}
```

---

## 5. Dry-Run Mode Design

### 5.1 Dry-Run Output Format

```
=== L0→L1 Deployment Dry-Run ===
Configuration:
  - Mode: dry-run (no files will be written)
  - Source: workspace root
  - Target: templates/common/
  - Backup path: .deploy-backups/
  - Verification: enabled

Processing CLAUDE.md...
  ✓ Section removed: Agent Dispatch Rules (324 lines)
  ✓ Section removed: Native Sub-agents (156 lines)
  ✓ Section removed: Native Plan Mode (89 lines)
  ✓ Reference transformed: 3 CONSTITUTION.md → templates/common/docs/context.md
  ⚠ Warning: Required section not found: Custom Command Error Recovery

Processing GEMINI.md...
  ✓ Section removed: Agent Dispatch Rules (298 lines)
  ✓ Reference transformed: 2 CONSTITUTION.md → templates/common/docs/context.md

Processing agents/pm.md...
  ✓ Section removed: Deployment orchestration logic (145 lines)
  ✓ Reference transformed: 1 CONSTITUTION.md → templates/common/docs/context.md

=== Summary ===
Total files: 3
Total sections removed: 6
Total references transformed: 6
Warnings: 1
Errors: 0

=== Next Steps ===
Review changes above, then run:
  bun scripts/deploy-to-l1.ts --execute

Or rollback if needed:
  bun scripts/deploy-to-l1.ts --rollback <timestamp>
```

### 5.2 Diff Summary Generation

```typescript
/**
 * Generate human-readable diff summary
 */
function generateDiffSummary(original: string, modified: string): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  const removedLines = originalLines.length - modifiedLines.length;
  const unchanged = modifiedLines.filter((line, i) => line === originalLines[i]).length;
  const added = modifiedLines.length - originalLines.length - removedLines;

  return `
  Lines removed: ${removedLines}
  Lines unchanged: ${unchanged}
  Lines added: ${added}
  Net change: ${added - removedLines} lines
  `;
}
```

---

## 6. Safety Features

### 6.1 Backup Creation Strategy

**Backup Location**: `.deploy-backups/YYYY-MM-DDTHH-MM-SS/`

**Backup Structure**:
```
.deploy-backups/
└── 2026-06-09T14-30-45/
    ├── backup-metadata.json
    ├── CLAUDE.md
    ├── GEMINI.md
    └── agents/
        └── pm.md
```

**Backup Metadata**:
```json
{
  "timestamp": "2026-06-09T14:30:45.123Z",
  "filesBackedUp": [
    "CLAUDE.md",
    "GEMINI.md",
    "agents/pm.md"
  ],
  "sourceHashes": {
    "CLAUDE.md": "abc123...",
    "GEMINI.md": "def456...",
    "agents/pm.md": "ghi789..."
  },
  "deploymentConfig": { ... }
}
```

### 6.2 Rollback Mechanism

```typescript
/**
 * Rollback command interface
 */
async function rollbackFromBackup(timestamp: string): Promise<void> {
  const backupPath = path.join('.deploy-backups', timestamp);
  
  if (!(await fileExists(backupPath))) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  console.log(`Rolling back deployment from ${timestamp}...`);
  await rollbackDeployment(backupPath);
  console.log('Rollback complete');
}
```

### 6.3 Pre-deployment Validation Checks

```typescript
/**
 * Validate pre-deployment state
 */
async function validatePreDeployment(config: DeploymentConfig): Promise<void> {
  // Check 1: Source files exist
  for (const file of config.sourceFiles) {
    if (!(await fileExists(file.source))) {
      throw new Error(`Source file not found: ${file.source}`);
    }
  }

  // Check 2: Target directory is writable
  const testFile = path.join(config.targetDir, '.write-test');
  try {
    await fs.mkdir(config.targetDir, { recursive: true });
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
  } catch {
    throw new Error(`Target directory not writable: ${config.targetDir}`);
  }

  // Check 3: Backup directory is writable
  if (config.createBackup) {
    const testBackup = path.join(config.backupPath, '.write-test');
    try {
      await fs.mkdir(config.backupPath, { recursive: true });
      await fs.writeFile(testBackup, 'test');
      await fs.unlink(testBackup);
    } catch {
      throw new Error(`Backup directory not writable: ${config.backupPath}`);
    }
  }

  // Check 4: Run pre-deployment audit
  if (!config.skipAudit) {
    const auditResult = await runAudit();
    if (auditResult.exitCode !== 0) {
      throw new Error(`Pre-deployment audit failed - fix issues before deploying`);
    }
  }

  console.log('Pre-deployment validation passed');
}
```

### 6.4 File Permission Preservation

**Permission Handling Strategy**:

1. **Read Source Permissions**: Extract file mode from source file
2. **Write Target Content**: Create target file with content
3. **Apply Source Permissions**: Copy file mode to target file
4. **Verification**: Verify permissions were applied correctly

```typescript
/**
 * Verify file permissions
 */
async function verifyFilePermissions(filePath: string, expectedMode: number): Promise<boolean> {
  const stats = await fs.stat(filePath);
  return stats.mode === expectedMode;
}
```

---

## 7. Error Handling Strategy

### 7.1 Error Categories

| Category | Handling | Rollback | User Action |
|----------|----------|----------|-------------|
| **Pre-deployment validation** | Abort immediately | No backup created | Fix validation errors |
| **Backup creation** | Abort immediately | No backup to rollback | Fix backup directory permissions |
| **Section filtering** | Log warning, continue | If backup exists | Review filtering patterns |
| **Reference transformation** | Log warning, continue | If backup exists | Review transformation rules |
| **File writing** | Abort immediately | Yes, from backup | Check disk space, permissions |
| **Post-deployment verification** | Rollback immediately | Yes, from backup | Fix deployment content |
| **L0 leakage check** | Rollback immediately | Yes, from backup | Review filtering rules |

### 7.2 Error Recovery Patterns

```typescript
/**
 * Error recovery with rollback
 */
async function executeWithRollback<T>(
  operation: () => Promise<T>,
  backupPath: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Operation failed, rolling back from ${backupPath}...`);
    await rollbackDeployment(backupPath);
    throw error;
  }
}
```

---

## 8. Verification Integration

### 8.1 Audit.ts Integration

**Pre-deployment audit**: Ensure workspace is in clean state before deployment

**Post-deployment audit**: Verify deployment didn't break workspace integrity

```typescript
/**
 * Run audit with timeout
 */
async function runAuditWithTimeout(timeoutMs: number = 30000): Promise<any> {
  const startTime = Date.now();
  
  try {
    const result = await Promise.race([
      runAudit(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Audit timeout')), timeoutMs)
      )
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`Audit completed in ${duration}ms`);
    
    return result;
  } catch (error) {
    console.error(`Audit failed: ${error}`);
    throw error;
  }
}
```

### 8.2 L0 Leakage Check Integration

```typescript
/**
 * Comprehensive L0 leakage check
 */
async function comprehensiveL0LeakageCheck(config: DeploymentConfig): Promise<void> {
  console.log('Running comprehensive L0 leakage check...');

  const l0Indicators = [
    // Direct CONSTITUTION.md references (should be transformed)
    { pattern: /CONSTITUTION\.md/, message: 'Untransformed CONSTITUTION.md reference' },
    
    // L0-specific section headers
    { pattern: /##\s*5\s+Agent Dispatch Rules/, message: 'L0 Agent Dispatch Rules section' },
    { pattern: /##\s*20\s+Native Sub-agents/, message: 'L0 Native Sub-agents section' },
    
    // L0→L1→L2 deployment terminology
    { pattern: /L0→L1→L2/, message: 'L0→L1→L2 deployment terminology' },
    
    // Workspace lifecycle management references
    { pattern: /Workspace lifecycle management/, message: 'Workspace lifecycle management reference' },
    
    // Template boundary enforcement references
    { pattern: /Template boundary enforcement/, message: 'Template boundary enforcement reference' }
  ];

  let leakageFound = false;

  for (const file of config.sourceFiles) {
    if (!(await fileExists(file.target))) continue;

    const content = await fs.readFile(file.target, 'utf-8');
    const lines = content.split('\n');
    
    for (const indicator of l0Indicators) {
      const matches = content.match(indicator.pattern);
      if (matches) {
        leakageFound = true;
        
        // Find line numbers
        const lineNumbers = lines
          .map((line, i) => ({ line, num: i + 1 }))
          .filter(({ line }) => indicator.pattern.test(line))
          .map(({ num }) => num);

        console.error(`L0 leakage in ${file.target}:`);
        console.error(`  - ${indicator.message}`);
        console.error(`  - Found on lines: ${lineNumbers.join(', ')}`);
      }
    }
  }

  if (leakageFound) {
    throw new Error('L0 content leakage detected - deployment failed verification');
  }

  console.log('L0 leakage check passed - no L0 content found');
}
```

### 8.3 Success/Failure Criteria

**Success Criteria**:
- All source files processed without errors
- All required sections removed
- All references transformed
- Post-deployment audit passes (exit code 0)
- L0 leakage check passes (no L0 indicators found)
- File permissions preserved

**Failure Criteria**:
- Any critical error in processing phase
- Post-deployment audit fails
- L0 leakage detected
- File permission verification fails
- User cancellation during confirmation

---

## 9. Testing Strategy

### 9.1 Unit Test Approach

**Test Structure**:
```typescript
// test/deploy-to-l1.test.ts
import { describe, test, expect } from 'bun:test';
import { deployToL1, processSourceFile, checkL0Leakage } from '../deploy-to-l1';

describe('deploy-to-l1.ts', () => {
  describe('Section Filtering', () => {
    test('removes L0-specific sections from CLAUDE.md', async () => {
      // Test implementation
    });

    test('preserves platform-specific behaviors', async () => {
      // Test implementation
    });
  });

  describe('Reference Transformation', () => {
    test('transforms CONSTITUTION.md to templates/common/docs/context.md', async () => {
      // Test implementation
    });

    test('preserves AGENTS.md references', async () => {
      // Test implementation
    });
  });

  describe('L0 Leakage Detection', () => {
    test('detects untransformed CONSTITUTION.md references', async () => {
      // Test implementation
    });

    test('allows transformed references in templates', async () => {
      // Test implementation
    });
  });

  describe('Backup and Rollback', () => {
    test('creates timestamped backup before deployment', async () => {
      // Test implementation
    });

    test('restores files from backup on rollback', async () => {
      // Test implementation
    });
  });
});
```

### 9.2 Integration Test Scenarios

**Test Scenarios**:

1. **Full Deployment Workflow**
   - Input: Current L0 files
   - Action: Execute deployment
   - Expected: L1 files with L0 content removed
   - Verification: audit.ts passes, L0 leakage check passes

2. **Dry-Run Mode**
   - Input: Current L0 files
   - Action: Execute with --dry-run
   - Expected: No files written, preview shown
   - Verification: Original L1 files unchanged

3. **Rollback Scenario**
   - Input: Deployed L1 files
   - Action: Execute rollback
   - Expected: Files restored to pre-deployment state
   - Verification: File hashes match backup metadata

4. **Section Filtering Edge Cases**
   - Input: L0 files with missing required sections
   - Action: Execute deployment
   - Expected: Warning logged, deployment continues
   - Verification: Deployment completes despite warnings

5. **Reference Transformation Edge Cases**
   - Input: L0 files with malformed references
   - Action: Execute deployment
   - Expected: Best-effort transformation, warning logged
   - Verification: No crashes, clear warning messages

### 9.3 Edge Cases to Handle

**Missing Files**:
- Source file doesn't exist → Abort with clear error
- Target directory doesn't exist → Create automatically
- Backup directory doesn't exist → Create automatically

**Permission Issues**:
- Source file unreadable → Abort with permission error
- Target directory unwritable → Abort with permission error
- Backup directory unwritable → Abort with permission error

**Content Issues**:
- Empty source file → Warning logged, empty deployment
- Source file missing required sections → Warning logged
- Malformed YAML in agents/pm.md → Abort with parse error

**System Issues**:
- Disk space insufficient → Abort with space error
- Process interrupted → Cleanup partial deployment
- Audit.ts timeout → Abort with timeout error

---

## 10. Implementation Checklist

### Phase 1: Core Script Structure
- [ ] Create deploy-to-l1.ts with shebang and version header
- [ ] Define TypeScript interfaces (DeploymentConfig, SourceFile, etc.)
- [ ] Implement CLI argument parser
- [ ] Create main deployment orchestrator function

### Phase 2: Section Filtering
- [ ] Define CLAUDE_MD_REMOVE_PATTERNS
- [ ] Define GEMINI_MD_REMOVE_PATTERNS
- [ ] Define PM_MD_REMOVE_PATTERNS
- [ ] Implement section filtering function
- [ ] Add pattern matching and removal logic

### Phase 3: Reference Transformation
- [ ] Define REFERENCE_TRANSFORMS rules
- [ ] Implement reference transformation function
- [ ] Add pattern replacement logic
- [ ] Test transformation edge cases

### Phase 4: File I/O and Permissions
- [ ] Implement path resolution (workspace root vs templates/common)
- [ ] Create file writing with permission preservation
- [ ] Add file existence checking
- [ ] Implement file hash calculation

### Phase 5: Backup and Rollback
- [ ] Implement backup creation function
- [ ] Create backup metadata structure
- [ ] Implement rollback function
- [ ] Add backup cleanup mechanism

### Phase 6: Verification Integration
- [ ] Integrate audit.ts execution
- [ ] Implement L0 leakage check
- [ ] Add pre-deployment validation
- [ ] Create comprehensive verification function

### Phase 7: Dry-Run Mode
- [ ] Implement dry-run preview function
- [ ] Create diff summary generation
- [ ] Add user confirmation flow
- [ ] Design dry-run output format

### Phase 8: Error Handling
- [ ] Implement error categorization
- [ ] Add rollback-on-error logic
- [ ] Create error recovery patterns
- [ ] Design user-friendly error messages

### Phase 9: Testing
- [ ] Create unit test suite
- [ ] Implement integration tests
- [ ] Add edge case tests
- [ ] Create test fixtures

### Phase 10: Documentation
- [ ] Add inline code comments
- [ ] Create usage examples
- [ ] Document CLI options
- [ ] Write troubleshooting guide

---

## 11. Usage Examples

### 11.1 Basic Deployment

```bash
# Preview changes
bun scripts/deploy-to-l1.ts --dry-run

# Execute deployment
bun scripts/deploy-to-l1.ts --execute

# Execute with verbose output
bun scripts/deploy-to-l1.ts --execute --verbose
```

### 11.2 Advanced Scenarios

```bash
# Skip audit for testing
bun scripts/deploy-to-l1.ts --execute --skip-audit

# Custom backup location
bun scripts/deploy-to-l1.ts --execute --backup-path /tmp/backups

# Rollback failed deployment
bun scripts/deploy-to-l1.ts --rollback 2026-06-09T14-30-45

# Verification only (no deployment)
bun scripts/deploy-to-l1.ts --verify-only
```

### 11.3 CI/CD Integration

```bash
#!/bin/bash
# Example CI/CD script

set -e

echo "Deploying L0→L1 configuration..."

# Dry-run first
bun scripts/deploy-to-l1.ts --dry-run

# Execute deployment
bun scripts/deploy-to-l1.ts --execute --force

# Verify deployment
bun scripts/audit.ts

echo "Deployment successful"
```

---

## 12. Maintenance and Evolution

### 12.1 Filtering Rule Maintenance

**When to Update Filtering Rules**:
- New L0-specific sections added to source files
- L0 governance structure changes
- New platform-specific behaviors identified
- L0 leakage patterns discovered

**Update Process**:
1. Update ADR-0034 with new filtering rules
2. Update section pattern constants in deploy-to-l1.ts
3. Add tests for new filtering patterns
4. Update version number and changelog
5. Deploy updated script to workspace

### 12.2 Script Evolution

**Version 1.0 (Initial Release)**:
- Basic section filtering
- Reference transformation
- Backup and rollback
- Audit integration

**Future Enhancements**:
- Interactive filtering rule editor
- Automated filtering rule discovery
- Diff-based deployment optimization
- Multi-workspace support
- Web UI for deployment management

---

## 13. Troubleshooting Guide

### 13.1 Common Issues

**Issue**: "Source file not found"
- **Cause**: L0 file doesn't exist at expected path
- **Solution**: Verify workspace structure, check file paths

**Issue**: "L0 leakage detected"
- **Cause**: Filtering rules didn't catch all L0 content
- **Solution**: Update filtering patterns, review ADR-0034

**Issue**: "Post-deployment audit failed"
- **Cause**: Deployment broke workspace integrity
- **Solution**: Rollback deployment, investigate audit errors

**Issue**: "Permission denied when writing files"
- **Cause**: Insufficient permissions on target directory
- **Solution**: Check directory permissions, run with appropriate privileges

### 13.2 Debug Mode

```bash
# Enable debug logging
bun scripts/deploy-to-l1.ts --execute --verbose --debug

# Check backup contents
ls -la .deploy-backups/2026-06-09T14-30-45/

# Verify file permissions
stat templates/common/CLAUDE.md

# Manual audit check
bun scripts/audit.ts
```

---

## 14. References

- **ADR-0034**: L0→L1 Deployment Strategy
- **ADR-0033**: L0-L1-L2 Hierarchy and Extends
- **CONSTITUTION.md**: Workspace governance documentation
- **scripts/audit.ts**: Workspace compliance verification
- **templates/common/**: L1 template directory structure

---

**Document Version**: 1.1.0
**Last Updated**: 2026-06-10
**Status**: Updated - Ready for Implementation
