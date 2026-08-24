import { describe, test, expect, afterAll } from "bun:test";
import { existsSync, unlinkSync, writeFileSync, readFileSync } from "fs";
import { resolve } from "path";
import { $ } from "bun";

const SCRIPT = resolve(import.meta.dir, "../scripts/md-to-ooxml.ts");
const TEST_MD = resolve(import.meta.dir, "pptx-test-sample.md");
const TEST_PPTX = resolve(import.meta.dir, "pptx-test-output.pptx");
const TEST_PPTX_INFERRED = resolve(import.meta.dir, "pptx-test-inferred.pptx");
const TEST_PPTX_EXPLICIT = resolve(import.meta.dir, "pptx-test-explicit.out");

const FIXTURE = `# Quarterly Review
## Highlights
- Revenue up 12%
  - Driven by enterprise
Plain summary line.

| Metric | Value |
|---|---|
| ARR | 1.2M |

# Roadmap
Ship the pptx writer

# Thanks
Questions?
`;

describe("scripts/md-to-ooxml.ts PresentationML (.pptx) Tests", () => {
  afterAll(() => {
    for (const f of [TEST_MD, TEST_PPTX, TEST_PPTX_INFERRED, TEST_PPTX_EXPLICIT]) {
      if (existsSync(f)) unlinkSync(f);
    }
  });

  test("compiles Markdown to a PresentationML package containing all required OOXML parts", async () => {
    writeFileSync(TEST_MD, FIXTURE, "utf-8");
    const { exitCode } =
      await $`bun ${SCRIPT} --input ${TEST_MD} --output ${TEST_PPTX} --type pptx`.nothrow();
    expect(exitCode).toBe(0);
    expect(existsSync(TEST_PPTX)).toBe(true);

    const pkg = readFileSync(TEST_PPTX, "utf-8");

    // (a) All required package parts are present (Flat OPC single-file form).
    const requiredParts = [
      "/[Content_Types].xml",
      "/_rels/.rels",
      "/ppt/presentation.xml",
      "/ppt/_rels/presentation.xml.rels",
      "/ppt/slideMasters/slideMaster1.xml",
      "/ppt/slideMasters/_rels/slideMaster1.xml.rels",
      "/ppt/slideLayouts/slideLayout1.xml",
      "/ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      "/ppt/theme/theme1.xml",
      "/ppt/slides/slide1.xml",
      "/ppt/slides/_rels/slide1.xml.rels",
    ];
    for (const part of requiredParts) {
      expect(pkg).toContain(`pkg:name="${part}"`);
    }

    // (b) Slide count matches the H1 count (3 H1 headings → 3 slides).
    expect((pkg.match(/<p:sldId /g) || []).length).toBe(3);
    expect(pkg).toContain('pkg:name="/ppt/slides/slide3.xml"');
    expect(pkg).not.toContain('pkg:name="/ppt/slides/slide4.xml"');

    // (c) H1 titles land in the slide title placeholders.
    expect(pkg).toContain("<a:t>Quarterly Review</a:t>");
    expect(pkg).toContain("<a:t>Roadmap</a:t>");
    expect(pkg).toContain("<a:t>Thanks</a:t>");

    // (d) Content types declare the slide parts.
    expect(pkg).toContain('PartName="/ppt/slides/slide1.xml"');
    expect(pkg).toContain("application/vnd.openxmlformats-officedocument.presentationml.slide+xml");

    // Body mapping: nested bullets → lvl, H2 → bold lead-in, plain text → buNone.
    expect(pkg).toContain('<a:pPr lvl="1"/>');
    expect(pkg).toContain('<a:rPr b="1" lang="en-US"/>');
    expect(pkg).toContain("<a:buNone/>");
    expect(pkg).toContain("<a:t>Driven by enterprise</a:t>");
    // Table separator rows are skipped; data rows are simplified to plain text.
    expect(pkg).not.toContain("|---|---|");
    expect(pkg).toContain("<a:t>| ARR | 1.2M |</a:t>");
  });

  test("--type pptx works without a .pptx output extension", async () => {
    writeFileSync(TEST_MD, "# Explicit Type\n\nBody text.", "utf-8");
    const { exitCode, stdout } =
      await $`bun ${SCRIPT} --input ${TEST_MD} --output ${TEST_PPTX_EXPLICIT} --type pptx`.nothrow();
    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain("PPTX");
    expect(readFileSync(TEST_PPTX_EXPLICIT, "utf-8")).toContain("<a:t>Explicit Type</a:t>");
  });

  test("output extension .pptx infers the pptx target type without --type", async () => {
    writeFileSync(TEST_MD, "# Inferred Type\n\nBody text.", "utf-8");
    const { exitCode, stdout } =
      await $`bun ${SCRIPT} --input ${TEST_MD} --output ${TEST_PPTX_INFERRED}`.nothrow();
    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain("PPTX");
    expect(readFileSync(TEST_PPTX_INFERRED, "utf-8")).toContain("<a:t>Inferred Type</a:t>");
  });

  test("--check dry-run succeeds for pptx without writing files", async () => {
    writeFileSync(TEST_MD, FIXTURE, "utf-8");
    const { exitCode, stdout } =
      await $`bun ${SCRIPT} --input ${TEST_MD} --type pptx --check`.nothrow();
    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain("dry-run");
  });
});
