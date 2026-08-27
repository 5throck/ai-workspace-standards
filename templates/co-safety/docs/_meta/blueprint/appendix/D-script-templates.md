# Appendix D: Script Templates

This appendix catalogs the standard Deno/Bun TypeScript scripts used for automation, auditing, and maintenance in Safety OS.

## 1. Audit Script Template

**File**: `scripts/templates/audit.ts`

```typescript
/**
 * @file audit.ts
 * @version 1.0.0
 * @description Standard template for validation scripts.
 */

import { validateFiles } from "./utils/validation-core.ts";

async function runAudit() {
  console.log("Starting Audit...");
  
  // 1. Gather files
  const files = await glob("docs/**/*.md");
  
  // 2. Execute validation rules
  let errors = 0;
  for (const file of files) {
    if (!checkLegalBasis(file)) {
      console.error(`[FAIL] Missing legal basis in ${file}`);
      errors++;
    }
  }
  
  // 3. Exit with appropriate code
  if (errors > 0) {
    console.error(`Audit failed with ${errors} errors.`);
    process.exit(1);
  }
  
  console.log("Audit passed successfully.");
  process.exit(0);
}

runAudit();
```

## 2. Migration Script Template

**File**: `scripts/templates/migration.ts`

Used when bumping the version of an `evidence-models` JSON schema.

## 3. Git Hook Template

**File**: `.githooks/pre-commit`

Ensures `SYNC_ACTIVE=1` is enforced.
