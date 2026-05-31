import os
import json

def process_dir(directory):
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
        
        for file in files:
            if file == 'settings.json' and ('.claude' in root or '.gemini' in root):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    modified = False
                    
                    if 'hooks' in data:
                        if 'PreToolUse' in data['hooks']:
                            old_len = len(data['hooks']['PreToolUse'])
                            new_ptu = []
                            for p in data['hooks']['PreToolUse']:
                                if 'hooks' in p:
                                    p['hooks'] = [h for h in p['hooks'] if 'check-pm-approval.ts' not in str(h)]
                                    if len(p['hooks']) > 0:
                                        new_ptu.append(p)
                                else:
                                    if 'check-pm-approval.ts' not in str(p):
                                        new_ptu.append(p)
                            data['hooks']['PreToolUse'] = new_ptu
                            if len(data['hooks']['PreToolUse']) == 0:
                                del data['hooks']['PreToolUse']
                            modified = True
                        
                        if 'SessionStart' in data['hooks']:
                            new_ss = []
                            for p in data['hooks']['SessionStart']:
                                if 'hooks' in p:
                                    p['hooks'] = [h for h in p['hooks'] if 'clear-pm-approval.ts' not in str(h)]
                                    if len(p['hooks']) > 0:
                                        new_ss.append(p)
                                else:
                                    if 'clear-pm-approval.ts' not in str(p):
                                        new_ss.append(p)
                            data['hooks']['SessionStart'] = new_ss
                            if len(data['hooks']['SessionStart']) == 0:
                                del data['hooks']['SessionStart']
                            modified = True
                        
                        if len(data['hooks']) == 0:
                            del data['hooks']
                    
                    if modified:
                        with open(path, 'w', encoding='utf-8') as f:
                            json.dump(data, f, indent=2)
                        print(f"Cleaned {path}")
                except Exception as e:
                    print(f"Failed {path}: {e}")

process_dir('.')
