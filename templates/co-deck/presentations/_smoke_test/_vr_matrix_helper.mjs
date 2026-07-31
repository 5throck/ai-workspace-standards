
    import { loadThemePackage } from 'C:/git/ai_workspace/templates/co-deck/scripts/co-deck/lib/theme-contract.ts';
    import { listThemeDirs, listStyleDirs } from 'C:/git/ai_workspace/templates/co-deck/scripts/co-deck/lib/theme-utils.ts';
    const root = 'C:/git/ai_workspace/templates/co-deck';
    const themes = listThemeDirs(root).sort();
    const styles = listStyleDirs(root).sort();
    const matrix = [];
    for (const theme of themes) {
      const { pkg } = loadThemePackage(root, theme);
      if (!pkg) continue;
      const meta = pkg.metadata;
      for (const style of styles) {
        let status = 'compatible';
        let reason;
        if (Array.isArray(meta.incompatible_styles)) {
          const match = meta.incompatible_styles.find(e => (typeof e === 'string' ? e : e.name) === style);
          if (match) { status = 'incompatible'; reason = typeof match === 'object' && match.reason ? match.reason : undefined; }
        }
        if (status === 'compatible' && Array.isArray(meta.partial_styles)) {
          const match = meta.partial_styles.find(e => (typeof e === 'string' ? e : e.name) === style);
          if (match) { status = 'partial'; reason = typeof match === 'object' && match.reason ? match.reason : undefined; }
        }
        matrix.push({ theme, style, status, reason });
      }
    }
    console.log(JSON.stringify(matrix));
  