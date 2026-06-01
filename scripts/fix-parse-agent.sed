/^function parseAgentFrontmatter/,/^}$/ {
  s|const tierMatch = /^tier:\s*(.+)$/m.exec(content);|const tierMatch = /^tier:\s*\n\s*claude:\s*(.+)$/m.exec(content);|
  s|tier: tierMatch ? tierMatch\[1\].trim() : undefined,|tier: tierMatch ? tierMatch[1].trim() : 'N/A',|
}
