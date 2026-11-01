---
name: spdx-sbom
description: >
  SPDX 2.3 (ISO/IEC 5962) Software Bill of Materials generation from dependency
  manifests, producing standard JSON SBOMs for compliance and vulnerability analysis.
version: 1.1.0
last_reviewed: 2026-11-01
status: active
owner: pm
prerequisites: dependency manifests (package.json / lockfiles / dependency closures)
scope: co-security
metadata:
  type: process
  triggers:
    - spdx
    - sbom
    - sbom generation
    - software bill of materials
    - dependency inventory
---

# 📦 Skill: spdx-sbom

## Context

A Software Bill of Materials (SBOM) is a comprehensive inventory of all software components, libraries, and modules within a software artifact, along with their supply chain relationships. SBOMs enable vulnerability tracking (e.g., responding to CVEs like Log4j), license compliance verification, and transparency in software supply chains.

`spdx-sbom` standardizes SBOM generation using **SPDX 2.3** (ISO/IEC 5962:2021), the industry-standard exchange format for software package metadata. SPDX provides a structured JSON schema for capturing component identity, version, provenance, licenses, and dependency relationships (DESCRIBES, DEPENDS_ON, PATCH_FOR).

## When to Use

- Generating compliance deliverables for customer or regulatory requests (e.g., U.S. Executive Order on Improving the Nation's Cybersecurity, EU Cyber Resilience Act).
- Providing vulnerability intelligence by enumerating all direct and transitive dependencies for CVE impact analysis.
- Documenting component provenance for third-party risk assessments and vendor security reviews.
- Supporting license audits and open-source obligation tracking (attribution, copyleft, permissive vs. proprietary).
- Building inventory for software supply chain security (SSCS) programs and component renewal planning.

## Execution Steps

1. **Scope the Component**
   - Define component identity: `packageName` (e.g., `@scoped/name` or `name`), `versionInfo` (exact SemVer, commit hash, or release tag), and `supplier` (organization or author responsible for distribution).
   - Document component context: is this the entire project, a library/package, a CLI tool, or a microservice?

2. **Collect Dependency Evidence**
   - Identify and parse all dependency manifests present in the project:
     - **Node.js/Bun**: `package.json` (direct dependencies) + lockfile (`bun.lockb`, `package-lock.json`, `yarn.lock`) for transitive closure.
     - **Python**: `requirements.txt`, `pyproject.toml`, `Pipfile.lock` for pinned versions and transitive dependencies.
     - **Go**: `go.mod` (direct) + `go.sum` (transitive checksums).
     - **Rust**: `Cargo.toml` + `Cargo.lock`.
     - **Java**: `pom.xml` (Maven) or `build.gradle` + Gradle lockfiles.
     - **Ruby**: `Gemfile` + `Gemfile.lock`.
   - Extract for each dependency: package name, exact version, download location (registry URI or VCS URL), and declared license (if specified).

3. **Map to SPDX Fields**
   - **Top-level package**: The component being documented (project or library).
   - **Dependency packages**: One `Package` entry per direct AND transitive dependency.
   - **Required fields per package**:
     - `SPDXID`: Unique identifier (e.g., `SPDXRef-Package-[name]`).
     - `name`: Package name (e.g., `lodash`, `react`, `@scoped/package`).
     - `versionInfo`: Exact version string (e.g., `4.17.21`, `18.2.0`).
     - `downloadLocation`: Source or registry URL (e.g., `https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz`, `git+https://github.com/user/repo@v1.2.3`).
     - `filesAnalyzed`: `false` for pre-built dependencies (only set to `true` if you have full source and have analyzed each file).
     - `licenseConcluded`: License expression from SPDX License List (e.g., `MIT`, `Apache-2.0`, `(MIT OR Apache-2.0)` for dual-licensed, `NO_ASSERTION` if unknown).
     - `licenseDeclared`: Declared license from package metadata (or `NO_ASSERTION`).
     - `externalRefs`: Supplier references (e.g., `package-manager` with `Locator` pointing to registry URI).
   - **Relationships**:
     - Top-level `DESCRIBES` each dependency package.
     - Dependency `DEPENDS_ON` its transitive dependencies.
     - `PATCH_FOR` if documenting a patch or fix.
   - **Creation metadata**: `creationInfo.timestamp` (ISO 8601), `creationInfo.tool` (e.g., `ai-workspace-spdx-generator v1.0.0`), `creationInfo.licenseListVersion` (use SPDX License List version, e.g., `3.22`).

4. **Emit SPDX 2.3 JSON**
   - Construct valid SPDX 2.3 document skeleton:
     - `spdxVersion`: `"SPDX-2.3"`
     - `dataLicense`: `"CC0-1.0"` (SPDX spec requirement).
     - `SPDXID`: `"SPDXRef-DOCUMENT"`
     - `name`: Document name (e.g., `<component>-<version>-sbom`).
     - `documentNamespace`: Unique URI with UUID (e.g., `https://spdx.org/spdxdocs/ai-workspace-component-1.0.0-<uuid>`).
     - `creationInfo`: Timestamp, tool identifier, and license list version.
     - `packages[]`: Array of package objects (top-level component + all dependencies).
     - `relationships[]`: Array of relationship objects linking packages via SPDX IDs.
     - `documentDescribes`: Array of top-level package SPDX IDs.
   - **License expression syntax**:
     - Use SPDX License List identifiers (e.g., `MIT`, `Apache-2.0`, `GPL-3.0-or-later`, `LGPL-2.1-only`).
     - Combine with `AND`, `OR`, `WITH` (e.g., `(MIT OR Apache-2.0)`, `GPL-3.0-or-later WITH GCC-exception-3.1`).
     - For unknown licenses, use `NO_ASSERTION` and flag for manual review.
   - **Verification code** (optional but recommended for source packages): Include `verificationCode` array of excluded file hashes if `filesAnalyzed: true`.

5. **Validate and Save**
   - Validate document structure: required fields present, SPDX IDs are unique, relationships reference valid SPDX IDs, license expressions use valid SPDX License List identifiers.
   - Save to `docs/sbom/spdx-<component>-<version>-<YYYY-MM-DD>.json`.
   - Confirm JSON is valid (syntax, schema compliance) and file is written to expected location.

## Output Format

```json
{
  "spdxVersion": "SPDX-2.3",
  "dataLicense": "CC0-1.0",
  "SPDXID": "SPDXRef-DOCUMENT",
  "name": "ai-workspace-{{PROJECT_NAME}}-1.0.0-sbom",
  "documentNamespace": "https://spdx.org/spdxdocs/ai-workspace-{{PROJECT_NAME}}-1.0.0-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "creationInfo": {
    "created": "2026-08-24T12:34:56Z",
    "tool": "ai-workspace-spdx-generator v1.0.0",
    "licenseListVersion": "3.22"
  },
  "documentDescribes": ["SPDXRef-Package-ai-workspace-{{PROJECT_NAME}}"],
  "packages": [
    {
      "SPDXID": "SPDXRef-Package-ai-workspace-{{PROJECT_NAME}}",
      "name": "ai-workspace-{{PROJECT_NAME}}",
      "versionInfo": "1.0.0",
      "downloadLocation": "git+https://github.com/5throck/ai-workspace@v1.0.0",
      "filesAnalyzed": false,
      "licenseConcluded": "MIT",
      "licenseDeclared": "MIT",
      "supplier": "Organization: 5throck",
      "externalRefs": [
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "purl",
          "referenceLocator": "pkg:github/5throck/ai-workspace@v1.0.0"
        }
      ]
    },
    {
      "SPDXID": "SPDXRef-Package-lodash",
      "name": "lodash",
      "versionInfo": "4.17.21",
      "downloadLocation": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
      "filesAnalyzed": false,
      "licenseConcluded": "MIT",
      "licenseDeclared": "MIT",
      "externalRefs": [
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "purl",
          "referenceLocator": "pkg:npm/lodash@4.17.21"
        }
      ]
    }
  ],
  "relationships": [
    {
      "spdxElementId": "SPDXRef-DOCUMENT",
      "relationshipType": "DESCRIBES",
      "relatedSpdxElement": "SPDXRef-Package-ai-workspace-{{PROJECT_NAME}}"
    },
    {
      "spdxElementId": "SPDXRef-Package-ai-workspace-{{PROJECT_NAME}}",
      "relationshipType": "DEPENDS_ON",
      "relatedSpdxElement": "SPDXRef-Package-lodash"
    }
  ]
}
```

## Co-develop Integration Note

This file is the hub-doctrine canonical for the co-security assurance suite
(spec 2026-11-01-hub-consolidation-design, Phase 1 batch C). Co-security
engagements run it as written. A co-develop pipeline instance derives from this
doctrine by substituting the bindings below — the derivation never edits
frontmatter: `owner: pm` stays single-valued here, and the co-develop ownership
binding lives in this note only.

Parameterization — unfilled placeholders resolve to the co-security doctrine
defaults; a co-develop derivation substitutes the bindings (every instance in
the Output Format example: document `name`, `documentNamespace`,
`documentDescribes`, and the three top-level package `SPDXID`/`name`/
`relationship` references):

| Placeholder | Instance | Unfilled default (co-security) | Co-develop binding |
|---|---|---|---|
| {{PROJECT_NAME}} | Output Format example, all 7 occurrences | co-security | co-develop |

Co-develop bindings beyond placeholders:

- Ownership: co-develop renders this skill as owned by `security-monitor` (SBOM generation sits inside its Phase 0/5 scan gates). Frontmatter here stays `owner: pm`.
- Delivery: the co-develop fork carries `scope: common`; this canonical keeps `scope: co-security`.

## Related Skills

- `sarif-exporter` — companion standards-format export skill for security findings (vulnerabilities, threat assessments) vs. this skill's component inventory focus; both produce structured JSON deliverables for compliance and security toolchains.
- `security-scan` — provides dependency vulnerability context (CVEs, advisories) that informs supplier risk annotations and license compliance decisions when building SBOMs.
- `samm-maturity` — SBOMs feed Implementation (I1, I3) and Verification (V2) evidence streams by documenting dependency inventory practices and vulnerability tracking maturity.
