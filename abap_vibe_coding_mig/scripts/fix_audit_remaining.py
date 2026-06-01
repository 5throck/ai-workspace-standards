#!/usr/bin/env python3
"""
Fix remaining lifecycle audit sections in audit.ts with smart skip logic
"""
import re

audit_path = 'scripts/audit.ts'

with open(audit_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace verify-memory section
verify_memory_pattern = r'    // Skip in incremental mode: verify-memory \(non-critical\)\n    if \(!INCREMENTAL_MODE\) \{[^}]+\n        \}[^}]+\n    \}'
verify_memory_replacement = '''    // Skip in incremental mode: verify-memory (non-critical)
    const shouldRunVerifyMemory = !INCREMENTAL_MODE || !workspaceDiff ||
        checkRequiresExpensiveValidation('verify-memory', workspaceDiff.changedFiles, workspaceDiff.addedFiles, workspaceDiff.removedFiles);

    if (shouldRunVerifyMemory) {
        if (INCREMENTAL_MODE && workspaceDiff) {
            const changedMemory = [
                ...workspaceDiff.changedFiles.filter(f => f.startsWith('memory/') && f.endsWith('.md')),
                ...workspaceDiff.addedFiles.filter(f => f.startsWith('memory/') && f.endsWith('.md')),
            ];
            console.log(`${CYAN}Running verify-memory - files changed: ${changedMemory.length} memory file(s)${RESET}`);
        }

        if (fs.existsSync(path.join('scripts', 'verify-memory.ts')) && fs.existsSync('CONSTITUTION.md')) {
            // explicitly skip any files located in memory/archive/
            const memoryFiles = fs.readdirSync('memory')
                .filter(f => f.endsWith('.md') && fs.statSync(path.join('memory', f)).isFile())
                .map(f => path.join('memory', f));

        // We do not pass explicit files to verify-memory.ts to avoid triggering its pre-commit mode (which only checks the last entry),
        // but verify-memory.ts natively only reads files in memory/ directly.
        const out = await $`bun ${path.join('scripts', 'verify-memory.ts')}`.quiet().nothrow();
            if (out.exitCode !== 0)
                Warn("Memory log format issues detected (run 'bun scripts/verify-memory.ts' to see details)");
            else
                Pass("Memory logs: format valid");
        }
    } else {
        console.log(`${CYAN}Skipping verify-memory - no memory files changed${RESET}`);
    }'''

# Use a more targeted approach with exact line matching
lines = content.split('\n')
new_lines = []
i = 0

while i < len(lines):
    line = lines[i]

    # Detect verify-memory section start
    if '// Skip in incremental mode: verify-memory (non-critical)' in line and i + 1 < len(lines):
        # Skip the old implementation
        if 'if (!INCREMENTAL_MODE)' in lines[i + 1]:
            # Add new implementation
            new_lines.extend(verify_memory_replacement.split('\n'))
            # Skip old lines until we find the closing brace
            while i < len(lines) and not lines[i].strip().endswith('}'):
                i += 1
            i += 1  # Move past the closing brace
            continue

    # Detect lifecycle-sync-audit section start
    if '// Skip in incremental mode: lifecycle-sync-audit (non-critical)' in line and i + 1 < len(lines):
        if 'if (!INCREMENTAL_MODE)' in lines[i + 1]:
            # Add new implementation for lifecycle-sync-audit
            new_lines.append('    // Skip in incremental mode: lifecycle-sync-audit (non-critical)')
            new_lines.append('    const shouldRunLifecycleSync = !INCREMENTAL_MODE || !workspaceDiff ||')
            new_lines.append('        checkRequiresExpensiveValidation(\'lifecycle-sync-audit\', workspaceDiff.changedFiles, workspaceDiff.addedFiles, workspaceDiff.removedFiles);')
            new_lines.append('')
            new_lines.append('    if (shouldRunLifecycleSync) {')
            new_lines.append('        if (INCREMENTAL_MODE && workspaceDiff) {')
            new_lines.append('            const changedLifecycle = [')
            new_lines.append('                ...workspaceDiff.changedFiles.filter(f => f === \'CLAUDE.md\' || f === \'GEMINI.md\' || f.startsWith(\'templates/\')),')
            new_lines.append('                ...workspaceDiff.addedFiles.filter(f => f === \'CLAUDE.md\' || f === \'GEMINI.md\' || f.startsWith(\'templates/\')),')
            new_lines.append('            ];')
            new_lines.append('            console.log(`${CYAN}Running lifecycle-sync-audit - files changed: ${changedLifecycle.length} lifecycle file(s)${RESET}`);')
            new_lines.append('        }')
            new_lines.append('')
            new_lines.append('        if (fs.existsSync(path.join(\'scripts\', \'lifecycle-sync-audit.ts\'))) {')
            new_lines.append('        const out = await $`bun ${path.join(\'scripts\', \'lifecycle-sync-audit.ts\')} --json`.quiet().nothrow();')
            new_lines.append('            if (out.exitCode !== 0)')
            new_lines.append('                Fail("Lifecycle sync audit detected issues (run \'bun scripts/lifecycle-sync-audit.ts\' to see details)");')
            new_lines.append('            else')
            new_lines.append('                Pass("Lifecycle sync audit: all artifacts in sync");')
            new_lines.append('        }')
            new_lines.append('    } else {')
            new_lines.append('        console.log(`${CYAN}Skipping lifecycle-sync-audit - no relevant files changed${RESET}`);')
            new_lines.append('    }')

            # Skip old lines
            while i < len(lines) and '// end INCREMENTAL_MODE skip block' not in lines[i]:
                i += 1
            i += 1  # Move past the comment
            continue

    # Detect verify-platform-lifecycle section start
    if '// Skip in incremental mode: verify-platform-lifecycle (non-critical)' in line and i + 1 < len(lines):
        if 'if (!INCREMENTAL_MODE)' in lines[i + 1]:
            # Add new implementation
            new_lines.append('    // Skip in incremental mode: verify-platform-lifecycle (non-critical)')
            new_lines.append('    const shouldRunPlatformLifecycle = !INCREMENTAL_MODE || !workspaceDiff ||')
            new_lines.append('        checkRequiresExpensiveValidation(\'verify-platform-lifecycle\', workspaceDiff.changedFiles, workspaceDiff.addedFiles, workspaceDiff.removedFiles);')
            new_lines.append('')
            new_lines.append('    if (shouldRunPlatformLifecycle) {')
            new_lines.append('        if (INCREMENTAL_MODE && workspaceDiff) {')
            new_lines.append('            const changedPlatform = [')
            new_lines.append('                ...workspaceDiff.changedFiles.filter(f =>')
            new_lines.append('                    f.startsWith(\'.claude/commands/\') ||')
            new_lines.append('                    f.startsWith(\'.gemini/commands/\') ||')
            new_lines.append('                    f.startsWith(\'.claude/skills/\') ||')
            new_lines.append('                    f.startsWith(\'.gemini/skills/\')')
            new_lines.append('                ),')
            new_lines.append('                ...workspaceDiff.addedFiles.filter(f =>')
            new_lines.append('                    f.startsWith(\'.claude/commands/\') ||')
            new_lines.append('                    f.startsWith(\'.gemini/commands/\') ||')
            new_lines.append('                    f.startsWith(\'.claude/skills/\') ||')
            new_lines.append('                    f.startsWith(\'.gemini/skills/\')')
            new_lines.append('                ),')
            new_lines.append('            ];')
            new_lines.append('            console.log(`${CYAN}Running verify-platform-lifecycle - files changed: ${changedPlatform.length} platform file(s)${RESET}`);')
            new_lines.append('        }')
            new_lines.append('')
            new_lines.append('        // Platform lifecycle verification (Check E/F/G/H)')
            new_lines.append('        if (fs.existsSync(path.join(\'scripts\', \'verify-platform-lifecycle.ts\'))) {')
            new_lines.append('            try {')
            new_lines.append('                await $`bun ${path.join(\'scripts\', \'verify-platform-lifecycle.ts\')}`.nothrow();')
            new_lines.append('            } catch { /* non-blocking */ }')
            new_lines.append('        }')
            new_lines.append('    } else {')
            new_lines.append('        console.log(`${CYAN}Skipping verify-platform-lifecycle - no relevant files changed${RESET}`);')
            new_lines.append('    }')

            # Skip old lines
            while i < len(lines) and '// end INCREMENTAL_MODE skip block' not in lines[i]:
                i += 1
            i += 1  # Move past the comment
            continue

    # Keep all other lines as-is
    new_lines.append(line)
    i += 1

# Write the updated content
with open(audit_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print('✅ Updated remaining lifecycle audit sections with smart skip logic')
