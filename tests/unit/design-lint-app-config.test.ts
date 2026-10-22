// T-20261022-045/046/047: the schema designLint block (docs/workspace-schema.json)
// feeds every check — scanRoots widen token-usage/components/icons beyond the
// playground/src + src defaults, tokenSources add explicit token files, app/
// styles.css is discovered by convention, allowlist entries exempt raw literals —
// and the new list-table check enforces the design-components.md row-action table
// standard (list-table modifier + sr-only actions header).
import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { $ } from "bun";

const LINT = resolve(import.meta.dir, "../../scripts/design-lint.ts");
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function makeProject(files: Record<string, string>): string {
  const proj = mkdtempSync(join(tmpdir(), "design-lint-appcfg-"));
  roots.push(proj);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(proj, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return proj;
}

interface Report {
  tool: string;
  version: string;
  exitCode?: number;
  checks: Array<{ name: string; status: string; findings: Array<{ pattern: string }> }>;
}

async function runJson(proj: string): Promise<{ exitCode: number; report: Report }> {
  const proc = await $`cd ${proj} && bun ${LINT} --json`.nothrow();
  return { exitCode: proc.exitCode, report: JSON.parse(proc.stdout.toString()) as Report };
}

const SCHEMA = JSON.stringify({
  designLint: {
    enabled: true,
    scanRoots: ["app/ui"],
    allowlist: ["#abc123"],
    tokenSources: ["app/token-source.css"],
  },
});

describe("design-lint schema designLint config (T-20261022-045/046)", () => {
  test("allowlisted literal is exempted; styles.css under app/ is a token source (fonts unskipped)", async () => {
    const proj = makeProject({
      "docs/workspace-schema.json": SCHEMA,
      "app/ui/page.tsx": "export const a = <div style={{ color: \"#abc123\" }} />;\n",
      // line-oriented custom-property extraction: each declaration on its own line
      "app/web-next/app/styles.css": ":root {\n  --font-sans: Inter, sans-serif;\n}\n",
    });
    const { exitCode, report } = await runJson(proj);
    const tokenUsage = report.checks.find((c) => c.name === "token-usage")!;
    expect(tokenUsage.status).toBe("pass"); // the only raw literal is allowlisted
    const fonts = report.checks.find((c) => c.name === "fonts")!;
    expect(fonts.status).toBe("pass"); // --font-sans discovered in app/ styles.css with a generic fallback
    expect(exitCode).toBe(0);
  });

  test("tokenSources adds an explicit token file; icons check scans schema scanRoots", async () => {
    const proj = makeProject({
      "docs/workspace-schema.json": SCHEMA,
      "app/token-source.css": ":root { --brand: #00aa00; }",
      "app/ui/icon.tsx": "export const i = <span data-icon=\"ghost\" />;\n",
      "docs/design/icon-vocabulary.yaml": "version: 1\nicons: []\n",
    });
    const { report } = await runJson(proj);
    // components registry absent -> components skips; icons registry present -> the
    // icons check now scans app/ui (previously blind: only playground/src + src).
    const icons = report.checks.find((c) => c.name === "icons")!;
    expect(icons.status).toBe("fail");
    expect(icons.findings[0]?.pattern).toBe("unregistered-icon");
  });
});

describe("design-lint list-table check (T-20261022-047)", () => {
  const TABLE_NO_HEADER = `export const t = (
    <table className="data-table">
      <tbody><tr><td className="sizing-actions-cell"><button>del</button></td></tr></tbody>
    </table>
  );\n`;
  const TABLE_COMPLIANT = `export const t = (
    <table className="data-table list-table">
      <thead><tr><th>name</th><th><span className="sr-only">actions</span></th></tr></thead>
      <tbody><tr><td>x</td><td className="sizing-actions-cell"><button>del</button></td></tr></tbody>
    </table>
  );\n`;
  const TABLE_HEADERLESS = `export const t = (
    <table className="data-table list-table">
      <thead><tr><th>name</th></tr></thead>
      <tbody><tr><td>x</td><td className="sizing-actions-cell"><button>del</button></td></tr></tbody>
    </table>
  );\n`;

  test("row-action data-table without list-table + without sr-only header fails both patterns", async () => {
    const { report } = await runJson(makeProject({
      "docs/workspace-schema.json": SCHEMA,
      "app/ui/table.tsx": TABLE_NO_HEADER,
    }));
    const lt = report.checks.find((c) => c.name === "list-table")!;
    expect(lt.status).toBe("fail");
    const patterns = lt.findings.map((f) => f.pattern).sort();
    expect(patterns).toEqual(["list-table-missing", "sr-only-actions-header-missing"]);
  });

  test("compliant table passes (sr-only allowed on an inline element inside the th)", async () => {
    const { report } = await runJson(makeProject({
      "docs/workspace-schema.json": SCHEMA,
      "app/ui/table.tsx": TABLE_COMPLIANT,
    }));
    const lt = report.checks.find((c) => c.name === "list-table")!;
    expect(lt.status).toBe("pass");
  });

  test("list-table modifier without the sr-only actions header fails the header pattern only", async () => {
    const { report } = await runJson(makeProject({
      "docs/workspace-schema.json": SCHEMA,
      "app/ui/table.tsx": TABLE_HEADERLESS,
    }));
    const lt = report.checks.find((c) => c.name === "list-table")!;
    expect(lt.findings.map((f) => f.pattern)).toEqual(["sr-only-actions-header-missing"]);
  });
});
