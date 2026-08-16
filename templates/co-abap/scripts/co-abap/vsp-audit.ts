// @version 1.0.0
#!/usr/bin/env bun
// vsp-audit.ts - Legacy wrapper — delegates to audit.ts
// Usage: bun scripts/vsp-audit.ts

import path from "node:path";
import { $ } from "bun";

const scriptDir = path.dirname(import.meta.path);

async function main() {
  const auditScript = path.join(scriptDir, "audit.ts");
  const result = await $`bun ${auditScript}`.nothrow();
  process.exit(result.exitCode);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`vsp-audit: ${e}`);
    process.exit(1);
  });
}

export { main };
