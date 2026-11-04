import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { unzipSync } from "fflate";
import { runCheck, fingerprintFiles } from "../svg-check.ts";
import { compileDeck, renderPngs, verifyReportAgainstDeck } from "../svg-to-pptx.ts";

const REGISTRY = join(import.meta.dir, "../../../docs/document-style-registry.json");

const PAGE_TITLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="title" data-page-number="1">
  <g data-block-id="b1">
    <rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/>
    <rect x="80" y="248" width="520" height="14" fill="#C00000"/>
    <text x="80" y="220" font-size="48" font-weight="bold" fill="#1F3864">Quarterly Business Review</text>
  </g>
</svg>`;

const PAGE_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="2">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1F3864"/>
      <stop offset="1" stop-color="#C00000"/>
    </linearGradient>
  </defs>
  <g data-block-id="b1">
    <text x="80" y="140" font-size="32" font-weight="bold" fill="#1F3864">Revenue grew 12 percent 2026 outlook: solid</text>
    <circle cx="200" cy="320" r="60" fill="#1F3864" fill-opacity="0.85"/>
    <line x1="320" y1="380" x2="640" y2="300" stroke="#6B6B6B" stroke-width="2"/>
    <path d="M100 500 L300 500 C350 480 400 520 450 500 Z" fill="none" stroke="#1F3864" stroke-width="2"/>
    <rect x="700" y="260" width="420" height="180" rx="12" fill="url(#g1)"/>
    <text x="80" y="620" font-size="20" fill="#202020">Outlook remains positive</text>
  </g>
</svg>`;

const CONTENT_MD = `# Quarterly Business Review deck content

## Page 1 (title)
Quarterly Business Review

## Page 2 (content)
Revenue grew 12 percent 2026 outlook: solid
Outlook remains positive
`;

const PAGE_BAD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="3">
  <g>
    <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.5)"/>
    <text x="10" y="50" font-size="18" fill="#202020">This sentence is not in the contract</text>
  </g>
</svg>`;

function makeDeck(dir: string, pages: { name: string; body: string }[], content: string): string {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const p of pages) writeFileSync(join(dir, p.name), p.body);
  writeFileSync(join(dir, "deck_content.md"), content);
  return dir;
}

describe("svg-check (canonical gate)", () => {
  test("clean deck passes final gate with a fingerprint", () => {
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-ok"), [
      { name: "01-title.svg", body: PAGE_TITLE },
      { name: "02-content.svg", body: PAGE_CONTENT },
    ], CONTENT_MD);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);
    expect(report.summary.pages).toBe(2);
    expect(report.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    rmSync(dir, { recursive: true, force: true });
  });

  test("invalid color, missing block marker, and content drift all block", () => {
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-bad"), [
      { name: "01-title.svg", body: PAGE_TITLE },
      { name: "03-bad.svg", body: PAGE_BAD },
    ], CONTENT_MD);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    const rules = report.pages.flatMap((p) => p.errors.map((e) => e.rule));
    expect(rules).toContain("E-COLOR");
    expect(rules).toContain("E-MARKER");
    expect(rules).toContain("E-CONTENT-DIFF");
    expect(report.summary.errors).toBeGreaterThanOrEqual(3);
    rmSync(dir, { recursive: true, force: true });
  });

  test("compatible forms warn without blocking", () => {
    const lower = PAGE_TITLE.replace("#FFFFFF", "#ffffff");
    const relPath = PAGE_CONTENT.replace("M100 500 L300 500", "m100 500 l300 500");
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-warn"), [
      { name: "01-title.svg", body: lower },
      { name: "02-content.svg", body: relPath },
    ], CONTENT_MD);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);
    const warnings = report.pages.flatMap((p) => p.warnings.map((w) => w.rule));
    expect(warnings).toContain("W-COLOR-LOWER");
    expect(warnings).toContain("W-PATH-REL");
    rmSync(dir, { recursive: true, force: true });
  });

  test("fingerprint tracks deck bytes", () => {
    const a = fingerprintFiles([{ name: "a.svg", bytes: Buffer.from("x") }]);
    const b = fingerprintFiles([{ name: "a.svg", bytes: Buffer.from("y") }]);
    expect(a).not.toBe(b);
  });
});

describe("svg-to-pptx (DrawingML compiler)", () => {
  test("compiles a fingerprint-matched deck into an OOXML package", () => {
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-compile"), [
      { name: "01-title.svg", body: PAGE_TITLE },
      { name: "02-content.svg", body: PAGE_CONTENT },
    ], CONTENT_MD);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    const reportPath = join(dir, "report.json");
    writeFileSync(reportPath, JSON.stringify(report));

    verifyReportAgainstDeck(reportPath, dir); // matching fingerprint → passes

    const { zip, receipt } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    expect(receipt.slides).toBe(2);
    expect(receipt.mode).toBe("flat");
    expect(receipt.fingerprint_linked).toBe(true);

    const pkg = unzipSync(zip);
    expect(pkg["[Content_Types].xml"]).toBeDefined();
    expect(pkg["ppt/presentation.xml"]).toBeDefined();
    expect(pkg["ppt/slideMasters/slideMaster1.xml"]).toBeDefined();
    expect(pkg["ppt/slideLayouts/slideLayout1.xml"]).toBeDefined();
    expect(pkg["ppt/theme/theme1.xml"]).toBeDefined();
    expect(pkg["ppt/slides/slide1.xml"]).toBeDefined();
    expect(pkg["ppt/slides/slide2.xml"]).toBeDefined();
    expect(pkg["ppt/slides/_rels/slide1.xml.rels"]).toBeDefined();

    const slide1 = new TextDecoder().decode(pkg["ppt/slides/slide1.xml"]);
    expect(slide1).toContain('prst="rect"');
    expect(slide1).toContain("Quarterly Business Review");
    expect(slide1).toContain('val="1F3864"');

    const slide2 = new TextDecoder().decode(pkg["ppt/slides/slide2.xml"]);
    expect(slide2).toContain('prst="ellipse"');
    expect(slide2).toContain("straightConnector1"); // line
    expect(slide2).toContain("<a:custGeom>");      // path
    expect(slide2).toContain("gradFill");          // gradient rect
    expect(slide2).toContain("Revenue grew 12 percent");

    const theme = new TextDecoder().decode(pkg["ppt/theme/theme1.xml"]);
    expect(theme).toContain('val="1F3864"');       // accent1 from registry colors
    expect(theme).toContain('name="co-work"');

    // presentation sldSz: 1280×720 px → 12192000×6858000 EMU
    const pres = new TextDecoder().decode(pkg["ppt/presentation.xml"]);
    expect(pres).toContain('cx="12192000"');
    expect(pres).toContain('cy="6858000"');
    rmSync(dir, { recursive: true, force: true });
  });

  test("refuses to compile when the deck changed after the final gate", () => {
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-tamper"), [
      { name: "01-title.svg", body: PAGE_TITLE },
      { name: "02-content.svg", body: PAGE_CONTENT },
    ], CONTENT_MD);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    const reportPath = join(dir, "report.json");
    writeFileSync(reportPath, JSON.stringify(report));
    // tamper: edit a page after gating
    writeFileSync(join(dir, "01-title.svg"), PAGE_TITLE + "\n<!-- touch -->");
    expect(() => verifyReportAgainstDeck(reportPath, dir)).toThrow(/fingerprint/);
    rmSync(dir, { recursive: true, force: true });
  });

  test("refuses a report with blocking errors or wrong stage", () => {
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-refuse"), [
      { name: "01-title.svg", body: PAGE_BAD },
    ], CONTENT_MD);
    const bad = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, JSON.stringify(bad));
    expect(() => verifyReportAgainstDeck(badPath, dir)).toThrow(/blocking error/);

    const early = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "early" });
    const earlyPath = join(dir, "early.json");
    writeFileSync(earlyPath, JSON.stringify(early));
    expect(() => verifyReportAgainstDeck(earlyPath, dir)).toThrow(/"early", not "final"/);
    rmSync(dir, { recursive: true, force: true });
  });

  test("text model: anchor/spacing/decoration compile; unsupported baseline warns", () => {
    const TEXT_PAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="640" y="200" font-size="40" text-anchor="middle" letter-spacing="2" text-decoration="underline" fill="#1F3864">Centered Title</text>
    <text x="1200" y="300" font-size="20" text-anchor="end" fill="#202020">Right end</text>
    <text x="100" y="400" font-size="18" dominant-baseline="middle" fill="#202020">Baseline note</text>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-text"), [
      { name: "01-text.svg", body: TEXT_PAGE },
    ], "Centered Title\nRight end\nBaseline note\n");
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);
    const warnings = report.pages.flatMap((p) => p.warnings.map((w) => w.rule));
    expect(warnings).toContain("W-UNSUPPORTED-BASELINE");

    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    const s1 = new TextDecoder().decode(unzipSync(zip)["ppt/slides/slide1.xml"]!);
    expect(s1).toContain('algn="ctr"');
    expect(s1).toContain('algn="r"');
    expect(s1).toContain('spc="150"');   // letter-spacing 2px -> 2x75 = 150 (1/100 pt)
    expect(s1).toContain('u="sng"');
    expect(s1).not.toContain("dominant-baseline");
    // anchor=middle repositions the box so the anchor x (640) stays the box center
    // (match the first text shape's xfrm, not the spTree grpSpPr zero-origin frame)
    const offMatch = s1.match(/name="text-\d+"[\s\S]*?<a:off x="(\d+)" y="\d+"\/><a:ext cx="(\d+)"/);
    expect(offMatch).toBeDefined();
    const boxX = parseInt(offMatch![1], 10);
    const boxW = parseInt(offMatch![2], 10);
    expect(Math.abs(boxX + boxW / 2 - 640 * 9525)).toBeLessThanOrEqual(1);
    rmSync(dir, { recursive: true, force: true });
  });

  test("renderPngs produces resvg previews (no Office tooling)", async () => {
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-render"), [
      { name: "01-title.svg", body: PAGE_TITLE },
    ], CONTENT_MD);
    const pngDir = join(dir, "previews");
    const files = await renderPngs({ deckDir: dir, pngDir });
    expect(files.length).toBe(1);
    const bytes = readFileSync(files[0]);
    expect(bytes[0]).toBe(0x89); // PNG signature
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    rmSync(dir, { recursive: true, force: true });
  });

  test("tspan wrap pattern: same-x line starts are canonical; mixed-x warns", () => {
    const WRAP_PAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="110" y="360" font-size="20" font-weight="bold" fill="#1F3864">Enterprise tier launched<tspan x="110" dy="32">with 14 pilot accounts</tspan></text>
  </g>
</svg>`;
    const MIXED_PAGE = WRAP_PAGE.replace('tspan x="110" dy="32"', 'tspan x="130" dy="32"');
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-wrap"), [
      { name: "01-wrap.svg", body: WRAP_PAGE },
    ], "Enterprise tier launched with 14 pilot accounts\n");
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);
    expect(report.pages[0].warnings.filter((w) => w.rule === "W-TSPAN-X").length).toBe(0);
    writeFileSync(join(dir, "mixed.svg"), MIXED_PAGE);
    const mixed = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    const mixedWarnings = mixed.pages.flatMap((p) => p.warnings.map((w) => w.rule));
    expect(mixedWarnings).toContain("W-TSPAN-X");
    rmSync(dir, { recursive: true, force: true });
  });

  test("P2: hyperlinks compile to rels+hlinkClick; transitions to p:transition", () => {
    const LINK_PAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1" data-slide-transition="fade">
  <g data-block-id="b1">
    <a href="https://example.com/report"><text x="80" y="140" font-size="24" fill="#1F3864">Read the full report online</text></a>
    <a href="#slide-2"><rect x="80" y="200" width="300" height="60" fill="#1F3864"/></a>
    <a href="mailto:team@example.com"><rect x="80" y="300" width="300" height="60" fill="#C00000"/></a>
  </g>
</svg>`;
    const CONTENT_MD = "Read the full report online\n";
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-links"), [
      { name: "01-links.svg", body: LINK_PAGE },
      { name: "02-target.svg", body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="2"><g data-block-id="b1"><text x="80" y="100" font-size="24" fill="#202020">Read the full report online</text></g></svg>` },
    ], CONTENT_MD);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);
    const { zip, receipt } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    expect(receipt.slides).toBe(2);

    const s1 = new TextDecoder().decode(unzipSync(zip)["ppt/slides/slide1.xml"]!);
    // data-slide-transition is consumed at compile time — the attribute itself never appears in output:
    expect(s1).toContain("<p:transition spd=\"med\"><p:fade/></p:transition>");
    expect(s1.match(/a:hlinkClick/g)?.length).toBe(3);
    expect(s1).toContain('action="ppaction://hlinksldjump"');

    const rels1 = new TextDecoder().decode(unzipSync(zip)["ppt/slides/_rels/slide1.xml.rels"]!);
    expect(rels1).toContain('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/report" TargetMode="External"');
    expect(rels1).toContain('Target="mailto:team@example.com" TargetMode="External"');
    expect(rels1).toContain('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide2.xml"');
    rmSync(dir, { recursive: true, force: true });
  });

  test("P2: invalid href schemes block at the gate; notes round-trip compiles", () => {
    const BAD_LINK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <a href="javascript:alert(1)"><text x="80" y="100" font-size="24" fill="#202020">Suspicious link</text></a>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-badlink"), [
      { name: "01-bad.svg", body: BAD_LINK },
    ], "Suspicious link\n");
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    const rules = report.pages.flatMap((p) => p.errors.map((e) => e.rule));
    expect(rules).toContain("E-HREF");
    rmSync(dir, { recursive: true, force: true });

    // notes round-trip: notesDir file maps to notesSlideN with the text preserved
    const dir2 = makeDeck(join(import.meta.dir, ".tmp-deck-notes"), [
      { name: "01-title.svg", body: PAGE_TITLE },
    ], CONTENT_MD);
    const report2 = runCheck({ deckDir: dir2, contentPath: join(dir2, "deck_content.md"), stage: "final" });
    const reportPath = join(dir2, "report.json");
    writeFileSync(reportPath, JSON.stringify(report2));
    const notesDir = join(dir2, "notes");
    mkdirSync(notesDir, { recursive: true });
    writeFileSync(join(notesDir, "01-speaker.md"), "Welcome the leadership team.\n");
    const { zip, receipt } = compileDeck({ deckDir: dir2, registryPath: REGISTRY, deckType: "business-report", notesDir });
    const pkg = unzipSync(zip);
    expect(pkg["ppt/notesSlides/notesSlide1.xml"]).toBeDefined();
    const notes1 = new TextDecoder().decode(pkg["ppt/notesSlides/notesSlide1.xml"]!);
    expect(notes1).toContain("Welcome the leadership team.");
    expect(receipt.parts).toBeGreaterThan(13); // notes master + notesSlide parts added
    rmSync(dir2, { recursive: true, force: true });
  });
});



