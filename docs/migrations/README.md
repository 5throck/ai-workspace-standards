# Template Migration Guides

This directory contains migration guides for template version updates.

## Directory Structure

```
migrations/
├── README.md
├── co-security/
│   ├── 0.1.0-to-0.2.0.md
│   └── 0.2.0-to-0.3.0.md
├── co-develop/
│   └── 1.0.0-to-1.1.0.md
└── co-work/
    └── 1.0.0-to-1.1.0.md
```

## Naming Convention

Migration guides follow the pattern: `{variant}/{from-version}-to-{to-version}.md`

Example: `co-security/0.1.0-to-0.2.0.md`

## Migration Guide Template

Use this template for new migration guides:

```markdown
# Migration Guide: [VARIANT] [FROM_VERSION] → [TO_VERSION]

**Release Date:** YYYY-MM-DD  
**Mandatory:** Yes/No  
**Template:** [variant-name]  
**Status:** [draft/beta/stable/deprecated]

## Breaking Changes
List any breaking changes that require user action.

## New Features
List new features added in this version.

## Migration Steps
Step-by-step migration instructions.

## Rollback Guide
Instructions for rolling back if issues occur.

## Support
Contact information for migration support.

## Additional Resources
Links to relevant documentation.
```

## Creating New Migration Guides

When releasing a new template version:

1. Create the appropriate variant directory if it doesn't exist
2. Create a new migration guide file following the naming convention
3. Update `VERSION_REGISTRY.json` to reference the new guide
4. Test the migration steps in a clean environment
5. Update the main `CHANGELOG.md` with version release notes

## Mandatory Updates

Migration guides marked as **Mandatory: Yes** should include:
- Clear step-by-step instructions
- Rollback procedures
- Security implications (if applicable)
- Estimated time to complete
- Breaking changes highlight

## Version Registry Integration

Each migration guide should be referenced in the `VERSION_REGISTRY.json` file under the appropriate variant's `migration_guides` array.

Example:
```json
{
  "variants": {
    "co-security": {
      "latest": "0.2.0",
      "migration_guides": [
        "docs/migrations/co-security/0.1.0-to-0.2.0.md"
      ]
    }
  }
}
```

## Automation

The `/template-status` skill can check available migration guides for your current template version.

For more information, see:
- [Variant Lifecycle Management](../VARIANT_LIFECYCLE.md)
- [VERSION_REGISTRY.json](../VERSION_REGISTRY.json)
- [CHANGELOG.md](../CHANGELOG.md)
