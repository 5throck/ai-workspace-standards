import { describe, expect, test } from "bun:test";
import { rewriteTemplateProvenanceVersion } from "../../scripts/lib/upgrade-policy.ts";

const footer = (v: string) =>
  `# Ctx\n\nIntro mentions **Template-Version**: 9.9.9 elsewhere.\n\n## Template Provenance\n\n- **Template-Version**: ${v}\n- **Template-Variant**: co-consult\n- **Target-Jurisdiction**: region-neutral\n`;

describe("rewriteTemplateProvenanceVersion (U-20261112-003)", () => {
  test("rewrites a stale footer version to the delivered version", () => {
    const r = rewriteTemplateProvenanceVersion(footer("0.5.3"), "0.30.0");
    expect(r.changed).toBe(true);
    expect(r.from).toBe("0.5.3");
    expect(r.content).toBe(footer("0.30.0"));
  });

  test("is idempotent when the version already matches", () => {
    const r = rewriteTemplateProvenanceVersion(footer("0.30.0"), "0.30.0");
    expect(r.changed).toBe(false);
    expect(r.content).toBe(footer("0.30.0"));
  });

  test("leaves files without a provenance footer or version line untouched", () => {
    expect(rewriteTemplateProvenanceVersion("# x\n- **Template-Version**: 1.0.0\n", "2.0.0").changed).toBe(false);
    const noLine = "## Template Provenance\n\n- **Template-Variant**: v\n";
    expect(rewriteTemplateProvenanceVersion(noLine, "2.0.0").changed).toBe(false);
  });

  test("does not touch a Template-Version line in a later section", () => {
    const text = "## Template Provenance\n\n- **Template-Variant**: v\n\n## Other\n\n- **Template-Version**: 1.0.0\n";
    expect(rewriteTemplateProvenanceVersion(text, "2.0.0").changed).toBe(false);
  });

  test("ignores an empty or unknown target version", () => {
    expect(rewriteTemplateProvenanceVersion(footer("0.5.3"), "unknown").changed).toBe(false);
    expect(rewriteTemplateProvenanceVersion(footer("0.5.3"), "").changed).toBe(false);
  });

  test("preserves CRLF line endings", () => {
    const crlf = footer("0.5.3").replace(/\n/g, "\r\n");
    const r = rewriteTemplateProvenanceVersion(crlf, "0.30.0");
    expect(r.changed).toBe(true);
    expect(r.content).toBe(footer("0.30.0").replace(/\n/g, "\r\n"));
  });
});
