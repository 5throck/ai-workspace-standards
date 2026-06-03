#!/bin/bash
# Pin @colbymchenry/codegraph version and remove -y flag
# Wave 2 H-09: Supply-chain security fix

echo "=== Wave 2 H-09: Codegraph Version Pinning ==="
echo "Removing -y flag and pinning @colbymchenry/codegraph@0.9.7..."

# Use Python for reliable text replacement
python3 -c "
import json
import re
import os
import glob

updated = 0
total = 0

# Process .claude/settings.json files
print('Processing .claude/settings.json files...')
for file in glob.glob('**/.claude/settings.json', recursive=True):
    total += 1
    print(f'Processing: {file}')

    try:
        with open(file, 'r') as f:
            content = f.read()

        # Check if file contains codegraph reference
        if '@colbymchenry/codegraph' in content:
            # Check if it has -y flag
            if '\"-y\"' in content and '@colbymchenry/codegraph' in content:
                # Parse as JSON to safely modify
                with open(file, 'r') as f:
                    data = json.load(f)

                # Find and fix in mcpServers
                modified = False
                if 'mcpServers' in data:
                    for server_name, server_config in data['mcpServers'].items():
                        if isinstance(server_config, dict) and 'args' in server_config:
                            args = server_config['args']
                            if isinstance(args, list):
                                # Check for ['-y', '@colbymchenry/codegraph', 'serve']
                                if '-y' in args and '@colbymchenry/codegraph' in args:
                                    # Remove -y and pin version
                                    new_args = []
                                    for item in args:
                                        if item == '-y':
                                            continue
                                        elif item == '@colbymchenry/codegraph':
                                            new_args.append('@colbymchenry/codegraph@0.9.7')
                                        else:
                                            new_args.append(item)
                                    server_config['args'] = new_args
                                    modified = True

                if modified:
                    with open(file, 'w') as f:
                        json.dump(data, f, indent=2)
                    print(f'  ✅ Fixed (removed -y, pinned version): {file}')
                    updated += 1
                else:
                    print(f'  ⚠️  Skipped (no -y flag found): {file}')
            elif '@0.9.7' not in content:
                # Has codegraph but not pinned
                with open(file, 'r') as f:
                    data = json.load(f)

                modified = False
                if 'mcpServers' in data:
                    for server_name, server_config in data['mcpServers'].items():
                        if isinstance(server_config, dict) and 'args' in server_config:
                            args = server_config['args']
                            if isinstance(args, list):
                                for i, item in enumerate(args):
                                    if item == '@colbymchenry/codegraph':
                                        args[i] = '@colbymchenry/codegraph@0.9.7'
                                        modified = True

                if modified:
                    with open(file, 'w') as f:
                        json.dump(data, f, indent=2)
                    print(f'  ✅ Fixed (pinned unpinned version): {file}')
                    updated += 1
                else:
                    print(f'  ⚠️  Skipped (already pinned): {file}')
        else:
            print(f'  ⚠️  Skipped (no codegraph): {file}')
    except Exception as e:
        print(f'  ❌ Error processing {file}: {e}')

# Process setup scripts
print('\\nProcessing setup scripts...')
for pattern in ['**/setup.sh', '**/setup.ps1']:
    for file in glob.glob(pattern, recursive=True):
        if 'templates' not in file:
            continue
        total += 1
        print(f'Processing: {file}')

        try:
            with open(file, 'r', encoding='utf-8') as f:
                content = f.read()

            if 'npx' in content and '@colbymchenry/codegraph' in content:
                if 'npx -y @colbymchenry/codegraph' in content:
                    # Remove -y flag and pin version
                    new_content = re.sub(
                        r'npx\s+-y\s+@colbymchenry/codegraph@latest',
                        'npx @colbymchenry/codegraph@0.9.7',
                        content
                    )
                    if new_content != content:
                        with open(file, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f'  ✅ Fixed (removed -y, pinned version): {file}')
                        updated += 1
                    else:
                        print(f'  ⚠️  Skipped (already pinned): {file}')
                elif '@0.9.7' not in content:
                    # Has codegraph but not pinned
                    new_content = re.sub(
                        r'@colbymchenry/codegraph[^\d]*',
                        '@colbymchenry/codegraph@0.9.7',
                        content
                    )
                    if new_content != content:
                        with open(file, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f'  ✅ Fixed (pinned unpinned version): {file}')
                        updated += 1
                    else:
                        print(f'  ⚠️  Skipped (already pinned): {file}')
                else:
                    print(f'  ⚠️  Skipped (already pinned): {file}')
        except Exception as e:
            print(f'  ❌ Error processing {file}: {e}')

print(f'\\n=== Summary ===')
print(f'Total files processed: {total}')
print(f'Successfully updated: {updated}')
print(f'Skipped (already pinned or no codegraph): {total - updated}')

if updated > 0:
    print('\\n✅ Security fix applied successfully')
else:
    print('\\n⚠️  No files were updated - may already be pinned')
"
