Scaffold a new project under the workspace root.

Arguments: $ARGUMENTS

Execute the following bash command exactly as written:

```bash
bash scripts/new-project.sh "$ARGUMENTS"
```

The script will:
1. Copy `templates/` into a new `<workspace>/$ARGUMENTS/` directory
2. Remove `_examples/` (reference-only - not part of a real project)
3. Remove `.gitkeep` placeholders
4. Substitute `[Project Name]` placeholder with `$ARGUMENTS` in all text files
5. Set executable permissions on hooks and scripts
6. Initialize git with `core.hooksPath .githooks`

After scaffolding, follow the printed "Next steps" to fill in placeholders and run the audit.

> ⚠️ This command is workspace-level only. Run from the workspace root (`C:\git`).
