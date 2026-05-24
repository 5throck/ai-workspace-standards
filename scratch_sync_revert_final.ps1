$projects = @("abap_vibe_coding", "abap_vibe_coding_plugin", "Pricing-Mgmt-Simulation", "quickdl")
$branchName = "pr/revert-mcp-migration-final2"

foreach ($proj in $projects) {
    Write-Host "Syncing final revert to $proj..."
    cd "C:\git\$proj"
    
    git checkout main
    git fetch origin main
    git reset --hard origin/main
    git checkout -B $branchName

    # Revert settings.json
    Set-Content -Path ".claude\settings.json" -Value "{}" -Encoding UTF8
    Set-Content -Path ".gemini\settings.json" -Value "{}" -Encoding UTF8
    
    # Recreate .mcp.json safely
$mcpContent = @"
{
  "mcpServers": {
    "codegraph": {
      "command": "npx",
      "args": ["-y", "@colbymchenry/codegraph", "serve"]
    }
  }
}
"@
    Set-Content -Path ".\.mcp.json" -Value $mcpContent -Encoding UTF8

    git add .claude/settings.json .gemini/settings.json .mcp.json
    git commit -m "revert: restore codegraph MCP config to global .mcp.json"
    git push -u origin $branchName --force
    
    gh pr create --title "revert: restore MCP config to .mcp.json" --body "Reverts the client-specific settings migration and restores the global \`.mcp.json\` for CodeGraph." --fill
    gh pr merge --squash --delete-branch
    
    git checkout main
    git pull
    cd "C:\git"
}
