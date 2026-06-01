// @version 1.0.0
import * as fs from 'node:fs';
import * as path from 'node:path';

// Color helpers
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function Pass(msg: string) {
    console.log(`${GREEN}✓ ${msg}${RESET}`);
}

function Fail(msg: string) {
    console.error(`${RED}✗ ${msg}${RESET}`);
}

function Warn(msg: string) {
    console.log(`${YELLOW}⚠ ${msg}${RESET}`);
}

console.log(`${CYAN}=== MCP Configuration Sync ===${RESET}\n`);

const workspaceRoot = process.cwd();
const sourceMcpPath = path.join(workspaceRoot, '.mcp.json');

// Check if source MCP config exists
if (!fs.existsSync(sourceMcpPath)) {
    Fail(`Source MCP config not found: ${sourceMcpPath}`);
    process.exit(1);
}

Pass(`Source MCP config found: ${sourceMcpPath}`);

// Variant project path
const variantProject = path.join(workspaceRoot, 'templates', 'co-abap');

if (!fs.existsSync(variantProject)) {
    Warn(`Variant project not found: ${variantProject}`);
    Warn('Skipping MCP sync (variant project may not be initialized yet)');
    process.exit(0);
}

Pass(`Variant project found: ${variantProject}`);

const targetMcpPath = path.join(variantProject, '.mcp.json');

try {
    // Read source MCP config
    const sourceConfig = fs.readFileSync(sourceMcpPath, 'utf-8');
    const sourceJson = JSON.parse(sourceConfig);

    // Check if target exists and needs update
    let needsUpdate = true;
    if (fs.existsSync(targetMcpPath)) {
        const targetConfig = fs.readFileSync(targetMcpPath, 'utf-8');
        const targetJson = JSON.parse(targetConfig);
        needsUpdate = JSON.stringify(sourceJson) !== JSON.stringify(targetJson);

        if (!needsUpdate) {
            Pass('MCP config already in sync (no changes detected)');
            process.exit(0);
        }
    }

    // Write config to variant project
    fs.writeFileSync(targetMcpPath, sourceConfig, 'utf-8');
    Pass(`MCP config synced to: ${targetMcpPath}`);

    console.log(`\n${GREEN}✅ MCP sync completed successfully${RESET}`);
    process.exit(0);

} catch (error) {
    Fail(`Failed to sync MCP config: ${error}`);
    process.exit(1);
}
