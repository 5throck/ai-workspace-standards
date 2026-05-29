# VERSION_REGISTRY.json Schema Documentation

**Version:** 1.0  
**Last Updated:** 2026-05-28  
**Purpose:** Central version tracking for all template variants

## Schema Structure

```json
{
  "version": "string",
  "last_updated": "YYYY-MM-DD",
  "description": "string",
  "variants": {
    "variant-name": {
      "latest": "string",
      "released": "YYYY-MM-DD",
      "status": "enum",
      "security_advisories": "array",
      "migration_guides": "array"
    }
  },
  "schema_version": "string"
}
```

## Field Definitions

### Root Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Registry format version (SemVer) |
| `last_updated` | string | Yes | Last update date (ISO 8601) |
| `description` | string | Yes | Registry purpose description |
| `variants` | object | Yes | Variant-specific version data |
| `schema_version` | string | Yes | JSON schema version |

### Variant Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `latest` | string | Yes | Latest released version (SemVer) |
| `released` | string | Yes | Release date (ISO 8601) |
| `status` | enum | Yes | One of: draft, beta, stable, deprecated |
| `security_advisories` | array | Yes | List of security advisory IDs/URLs |
| `migration_guides` | array | Yes | Relative paths to migration guides |

## Status Values

The `status` field MUST be one of the following:

- **draft**: Initial development, not production-ready
- **beta**: Feature-complete, testing in progress
- **stable**: Production-ready, fully supported
- **deprecated**: No longer maintained, migrate away

## Migration Guide Paths

Migration guide paths are relative to `docs/governance/`:

```json
{
  "migration_guides": [
    "migrations/co-security/0.1.0-to-0.2.0.md",
    "migrations/co-security/0.2.0-to-0.3.0.md"
  ]
}
```

## Security Advisories

Security advisories can be:
- CVE IDs (e.g., "CVE-2026-12345")
- GitHub Security Advisory URLs
- Custom advisory IDs with documentation links

```json
{
  "security_advisories": [
    "CVE-2026-12345",
    "https://github.com/owner/repo/security/advisories/GHSA-1234"
  ]
}
```

## Validation

The registry MUST be validated after updates:

```bash
# Validate JSON syntax
python -c "import json; json.load(open('VERSION_REGISTRY.json'))"

# Check semantic versioning
# (validation script to be implemented)
```

## Update Process

When releasing a new template version:

1. Update the variant's `latest` version
2. Update `released` date
3. Update `status` if lifecycle stage changed
4. Add new migration guide to `migration_guides` array
5. Update `last_updated` at root level
6. Run validation checks
7. Commit with changelog reference

## Integration Points

- **CHANGELOG.md**: Cross-reference version releases
- **migrations/**: Directory containing referenced guides
- **.template-info.json**: Individual project version tracking
- **/template-status skill**: Reads this registry for version checks

## Example Complete Entry

```json
{
  "co-security": {
    "latest": "0.2.0",
    "released": "2026-05-28",
    "status": "beta",
    "security_advisories": [],
    "migration_guides": [
      "migrations/co-security/0.1.0-to-0.2.0.md"
    ]
  }
}
```

## Future Enhancements

Planned schema additions:
- `compatible_with`: Minimum compatible versions
- `dependencies`: Required tool/template versions
- `deprecated_in`: Version where deprecation announced
- `sunset_date`: End-of-life date for deprecated versions

## Maintenance

**Maintainer:** Template team  
**Update Frequency:** Per release  
**Backwards Compatibility:** Minor versions only (major versions require migration guide)
