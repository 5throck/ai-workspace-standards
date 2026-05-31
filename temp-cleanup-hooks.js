const fs = require('fs');
const glob = new Bun.Glob('**/{.claude,.gemini}/settings.json');

for await (const file of glob.scan({ cwd: '.', absolute: true })) {
  if (file.includes('node_modules')) continue;
  
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let modified = false;

    if (data.hooks) {
      if (data.hooks.PreToolUse) {
        // filter out check-pm-approval
        const oldLen = data.hooks.PreToolUse.length;
        data.hooks.PreToolUse = data.hooks.PreToolUse.map(pt => {
          if (pt.hooks) {
            pt.hooks = pt.hooks.filter(h => !h.command || !h.command.includes('check-pm-approval.ts'));
          } else if (pt.command && pt.command.includes('check-pm-approval.ts')) {
            return null;
          }
          return pt;
        }).filter(Boolean);
        
        // if pt.hooks became empty, remove it
        data.hooks.PreToolUse = data.hooks.PreToolUse.filter(pt => {
            if (pt.hooks && pt.hooks.length === 0) return false;
            return true;
        });

        if (data.hooks.PreToolUse.length === 0) {
          delete data.hooks.PreToolUse;
        }
        modified = true;
      }

      if (data.hooks.SessionStart) {
        data.hooks.SessionStart = data.hooks.SessionStart.map(ss => {
          if (ss.hooks) {
            ss.hooks = ss.hooks.filter(h => !h.command || !h.command.includes('clear-pm-approval.ts'));
          } else if (ss.command && ss.command.includes('clear-pm-approval.ts')) {
            return null;
          }
          return ss;
        }).filter(Boolean);
        
        data.hooks.SessionStart = data.hooks.SessionStart.filter(ss => {
            if (ss.hooks && ss.hooks.length === 0) return false;
            return true;
        });

        if (data.hooks.SessionStart.length === 0) {
          delete data.hooks.SessionStart;
        }
        modified = true;
      }

      if (Object.keys(data.hooks).length === 0) {
        delete data.hooks;
      }
    }

    if (modified) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
      console.log('Cleaned up:', file);
    }
  } catch (e) {
    console.error('Error processing:', file, e);
  }
}
