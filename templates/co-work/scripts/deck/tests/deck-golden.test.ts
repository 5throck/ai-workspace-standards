import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { unzipSync } from "fflate";
import { XMLValidator } from "fast-xml-parser";
import { runCheck, fingerprintFiles, decodeXmlEntities } from "../svg-check.ts";
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

  test("v1.5.0 T1: XML entities decode in run extraction — escaped page matches plain-text contract", () => {
    // Bare & (P&L, Q&A) aborts resvg preview rendering, so pages must be able to
    // carry the escaped spelling — the gate decodes the five XML built-ins before
    // diffing so &amp; matches the plain-text SSOT (spec 2026-11-06-deck-pipeline-hardening-design R1).
    const ESCAPED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="120" font-size="24" fill="#202020">P&amp;L review ahead</text>
    <text x="80" y="180" font-size="18" fill="#202020">Plan for the &quot;scale&quot; phase</text>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-entities"), [
      { name: "01-entities.svg", body: ESCAPED },
    ], "P&L review ahead\nPlan for the \"scale\" phase\n");
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);
    // text_runs report the decoded spelling (what the renderer draws)
    expect(report.pages[0].text_runs).toContain("P&L review ahead");
    expect(report.pages[0].text_runs).toContain("Plan for the \"scale\" phase");
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.5.0 T2: SSOT-only run warns W-CONTENT-UNRENDERED and counts in unrendered_runs; gate still passes", () => {
    // Reverse diff (spec 2026-11-06-deck-pipeline-hardening-design R2): the one-directional
    // check passed decks whose page run was a stale substring of a longer updated SSOT run.
    // A contract run no page renders now warns per page — advisory only (punchlines/hints
    // may legitimately lag), counted additively in content_diff.unrendered_runs.
    const PAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="120" font-size="24" fill="#202020">Rendered headline lands on the page</text>
  </g>
</svg>`;
    const contract = "## Page 1 (content)\nRendered headline lands on the page\nUnrendered contract line lives only in the SSOT\n";
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-unrendered"), [
      { name: "01-only.svg", body: PAGE },
    ], contract);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0); // warnings pass — gate verdict unchanged
    const warns = report.pages[0].warnings.filter((w) => w.rule === "W-CONTENT-UNRENDERED");
    expect(warns.length).toBe(1);
    expect(warns[0].message).toContain("Unrendered contract line");
    expect(report.content_diff.unrendered_runs).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.5.0 T3: bare & page still passes the diff (backward compat)", () => {
    const BARE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="120" font-size="24" fill="#202020">P&L review ahead</text>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-bare-amp"), [
      { name: "01-bare.svg", body: BARE },
    ], "P&L review ahead\n");
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);
    expect(report.content_diff.unmatched_runs.length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.5.1 U1: decodeXmlEntities is single-pass per XML semantics (&amp;lt; → literal '&lt;')", () => {
    // One replacement sweep — decoded output is never re-scanned. A loop-until-stable
    // decoder would collapse `&amp;lt;` to `<`, corrupting authored text that
    // legitimately spells out an entity. svg-to-pptx v1.4.2 reuses this exact
    // function on the export leg, so both sides share one semantics (U-20261106-002).
    expect(decodeXmlEntities("P&amp;L")).toBe("P&L");
    expect(decodeXmlEntities("a&lt;b&gt;c&quot;d&apos;e&amp;f")).toBe("a<b>c\"d'e&f");
    expect(decodeXmlEntities("&amp;lt;")).toBe("&lt;");       // second & survives the single pass
    expect(decodeXmlEntities("&amp;amp;")).toBe("&amp;");     // not "&"
    expect(decodeXmlEntities("P&L")).toBe("P&L");             // bare & passes through
    expect(decodeXmlEntities("no entities here")).toBe("no entities here");
    expect(decodeXmlEntities("&unknown;")).toBe("&unknown;"); // non-built-in left verbatim
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

  test("P2 slice 3: native table + chart with embedded workbook compile; fallback kept by default", () => {
    const NATIVE_PAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="data" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="100" font-size="28" font-weight="bold" fill="#1F3864">Revenue beat plan for the third straight quarter</text>
    <g data-block-id="b2" data-native="chart" data-frame="80,160,560,360">
      <desc>{"kind":"bar","categories":["Jul","Aug","Sep"],"series":[{"name":"Revenue","values":[4.2,4.6,5.1]}]}</desc>
      <rect x="180" y="350" width="90" height="210" fill="#1F3864"/>
    </g>
    <g data-block-id="b3" data-native="table" data-frame="700,160,500,360">
      <desc>{"headers":["Metric","Q2","Q3"],"rows":[["Revenue","4.5M","5.1M"],["Churn","2.1%","2.1%"]]}</desc>
      <rect x="700" y="160" width="500" height="360" fill="#FFFFFF"/>
    </g>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-native"), [
      { name: "01-native.svg", body: NATIVE_PAGE },
    ], "Revenue beat plan for the third straight quarter\n");

    // default mode: fallback shapes only, no chart parts
    const def = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    const defPkg = unzipSync(def.zip);
    expect(Object.keys(defPkg).some((k) => k.startsWith("ppt/charts/"))).toBe(false);

    // native mode: chart part + workbook + graphicFrame + a:tbl
    const { zip, receipt } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report", nativeCharts: true });
    const pkg = unzipSync(zip);
    expect(pkg["ppt/charts/chart1.xml"]).toBeDefined();
    expect(pkg["ppt/charts/_rels/chart1.xml.rels"]).toBeDefined();
    expect(pkg["ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx"]).toBeDefined();
    const chartXml = new TextDecoder().decode(pkg["ppt/charts/chart1.xml"]!);
    expect(chartXml).toContain("<c:barChart>");
    expect(chartXml).toContain("<c:v>Revenue</c:v>");
    expect(chartXml).toContain("<c:v>4.6</c:v>");
    expect(chartXml).toContain("externalData");
    // xlsx is a valid zip with a worksheet containing the data
    const wbZip = unzipSync(pkg["ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx"]!);
    const sheet = new TextDecoder().decode(wbZip["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain("Revenue") && expect(sheet).toContain("4.6");
    const s1 = new TextDecoder().decode(pkg["ppt/slides/slide1.xml"]!);
    expect(s1).toContain("graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/chart\"");
    expect(s1).toContain("graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/table\"");
    expect(s1).toContain("<a:tbl>");
    expect(s1).toContain("<a:gridCol");
    expect(s1).toContain("4.5M");
    const ct = new TextDecoder().decode(pkg["[Content_Types].xml"]!);
    expect(ct).toContain('Default Extension="xlsx"');
    expect(ct).toContain("drawingml.chart+xml");
    expect((receipt as { native_objects?: number }).native_objects).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  test("P2 slice 3: structured layouts emit role layouts and bind slides; gate blocks bad native payloads", () => {
    const PAGES = [
      { name: "01-title.svg", body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="title" data-page-number="1"><g data-block-id="b1"><rect x="0" y="0" width="1280" height="720" fill="#1F3864"/><text x="640" y="360" font-size="48" font-weight="bold" fill="#FFFFFF">Q3 2026 Business Review</text></g></svg>` },
      { name: "02-data.svg", body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="data" data-page-number="2"><g data-block-id="b1"><text x="80" y="100" font-size="28" font-weight="bold" fill="#1F3864">Revenue beat plan for the third straight quarter</text></g></svg>` },
    ];
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-struct"), PAGES, CONTENT_MD);
    const { zip, receipt } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report", structuredLayouts: true });
    expect((receipt as { mode?: string }).mode).toBe("structured");
    const pkg = unzipSync(zip);
    expect(pkg["ppt/slideLayouts/slideLayout1.xml"]).toBeDefined();
    expect(pkg["ppt/slideLayouts/slideLayout2.xml"]).toBeDefined();
    const lay1 = new TextDecoder().decode(pkg["ppt/slideLayouts/slideLayout1.xml"]!);
    expect(lay1).toContain('name="title"');
    const lay2 = new TextDecoder().decode(pkg["ppt/slideLayouts/slideLayout2.xml"]!);
    expect(lay2).toContain('name="data"');
    const master = new TextDecoder().decode(pkg["ppt/slideMasters/slideMaster1.xml"]!);
    expect(master).toContain("sldLayoutId id=\"2147483650\""); // two layouts registered
    const rels2 = new TextDecoder().decode(pkg["ppt/slides/_rels/slide2.xml.rels"]!);
    expect(rels2).toContain('Target="../slideLayouts/slideLayout2.xml"'); // data slide bound to its role layout

    // gate: malformed desc JSON + missing data-frame block
    const BAD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1"><g data-block-id="b1"><g data-block-id="b2" data-native="chart"><desc>{broken}</desc></g><g data-block-id="b3" data-native="table"><desc>{"headers":["A"],"rows":[["1"]]}</desc></g></g></svg>`;
    const dir2 = makeDeck(join(import.meta.dir, ".tmp-deck-badnative"), [{ name: "01-bad.svg", body: BAD }], CONTENT_MD);
    const report = runCheck({ deckDir: dir2, contentPath: join(dir2, "deck_content.md"), stage: "final" });
    const rules = report.pages.flatMap((p) => p.errors.map((e) => e.rule));
    expect(rules).toContain("E-NATIVE-DATA");
    expect(rules).toContain("E-NATIVE-FRAME");
    rmSync(dir, { recursive: true, force: true });
    rmSync(dir2, { recursive: true, force: true });
  });

  test("P3: line/pie chart kinds compile; data-ph binds placeholders in structured mode", () => {
    const CHART_PAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="data" data-page-number="1">
  <g data-block-id="b1">
    <g data-block-id="b2" data-native="chart" data-frame="80,160,560,360">
      <desc>{"kind":"line","categories":["Jul","Aug","Sep"],"series":[{"name":"Revenue","values":[4.2,4.6,5.1]}]}</desc>
    </g>
    <g data-block-id="b3" data-native="chart" data-frame="700,160,500,360">
      <desc>{"kind":"pie","categories":["Jul","Aug","Sep"],"series":[{"name":"Share","values":[4.2,4.6,5.1]}],"colors":["1F3864","C00000","6B6B6B"]}</desc>
    </g>
    <text x="80" y="600" font-size="24" font-weight="bold" fill="#1F3864" data-ph="title">Revenue beat plan for the third straight quarter</text>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-p3"), [
      { name: "01-charts.svg", body: CHART_PAGE },
    ], "Revenue beat plan for the third straight quarter\n");
    const { zip, receipt } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report", nativeCharts: true, structuredLayouts: true });
    expect((receipt as { native_objects?: number }).native_objects).toBe(2);
    const pkg = unzipSync(zip);
    const s1 = new TextDecoder().decode(pkg["ppt/slides/slide1.xml"]!);
    // line + pie chart frames
    // graphicData uri + inner c:chart xmlns each match once per frame → 2 frames x 2
    expect(s1.match(/drawingml\/2006\/chart/g)?.length).toBe(4);
    expect(s1.match(/<a:graphicData uri="http:\/\/schemas.openxmlformats.org\/drawingml\/2006\/chart"/g)?.length).toBe(2);
    // data-ph text bound to title placeholder while keeping authored xfrm
    expect(s1).toContain('<p:ph type="title" idx="0"/>');
    expect(s1).toContain('sz="2400"'); // authored size preserved (binding does not restyle)

    // chart part kinds: find both charts and verify plot kinds
    const chartFiles = Object.keys(pkg).filter((k) => /^ppt\/charts\/chart\d+\.xml$/.test(k)).sort();
    expect(chartFiles.length).toBe(2);
    const kinds = chartFiles.map((f) => {
      const x = new TextDecoder().decode(pkg[f]!);
      if (x.includes("<c:lineChart>")) return "line";
      if (x.includes("<c:pieChart>")) return "pie";
      return "bar";
    }).sort();
    expect(kinds).toEqual(["line", "pie"]);
    const pieXml = new TextDecoder().decode(pkg[chartFiles.find((f) => new TextDecoder().decode(pkg[f]!).includes("<c:pieChart>"))!]!);
    expect(pieXml).toContain('<c:dPt><c:idx val="1"/>'); // per-point colors
    expect(pieXml).not.toContain("catAx"); // pie has no axes
    // workbook for pie also present (Edit Data)
    const wb = Object.keys(pkg).filter((k) => k.startsWith("ppt/embeddings/") && k.endsWith(".xlsx"));
    expect(wb.length).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  });

  test("P3: invalid data-ph value blocks at the gate; flat export leaves ph unbound", () => {
    const BAD_PH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1"><g data-block-id="b1"><text x="80" y="100" font-size="24" fill="#202020" data-ph="kicker">Outlook remains positive</text></g></svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-ph"), [{ name: "01.svg", body: BAD_PH }], CONTENT_MD);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    const rules = report.pages.flatMap((p) => p.errors.map((e) => e.rule));
    expect(rules).toContain("E-PH");
    // flat mode: valid marker accepted but inert (no ph in output)
    const GOOD = BAD_PH.replace('data-ph="kicker"', 'data-ph="title"');
    writeFileSync(join(dir, "01.svg"), GOOD);
    const report2 = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report2.summary.errors).toBe(0);
    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    const s1 = new TextDecoder().decode(unzipSync(zip)["ppt/slides/slide1.xml"]!);
    expect(s1).not.toContain("<p:ph");
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.4.1 regression pin: every generated slide XML part is well-formed (connector cNvPr close tag)", () => {
    // v1.4.0 emitted `<p:cNvPr id=".." name="line-N">"<p:cNvCxnSpPr/>` for line shapes —
    // an unclosed <p:cNvPr> plus a stray quote, i.e. malformed DrawingML that made
    // PowerPoint raise a repair prompt on every deck containing line shapes.
    // This pin compiles the golden fixture deck (agenda + data pages carry <line>) and
    // strict-parses every generated slide part with fast-xml-parser's XMLValidator.
    const dir = join(import.meta.dir, "fixtures/sample-business-report");
    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    const pkg = unzipSync(zip);

    const slideParts = Object.keys(pkg).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k));
    expect(slideParts.length).toBeGreaterThanOrEqual(6);

    const connectorSlides = slideParts.filter((k) => new TextDecoder().decode(pkg[k]!).includes("straightConnector1"));
    expect(connectorSlides.length).toBeGreaterThanOrEqual(1); // regression target is exercised

    for (const part of slideParts) {
      const xml = new TextDecoder().decode(pkg[part]!);
      const validation = XMLValidator.validate(xml);
      if (validation !== true) {
        const err = validation as { msg?: string };
        throw new Error(`${part} is not well-formed: ${err.msg ?? "validation failed"}`);
      }
    }
  });

  test("v1.4.2 pin: authored &amp; compiles to exactly ONE escape level in slide XML (no double escape)", () => {
    // svg-to-pptx v1.4.1 extracted raw parser node.text (entities undecoded) and then
    // esc()'d it for DrawingML — an authored `P&amp;L` compiled to the double-escaped
    // `P&amp;amp;L`, so PowerPoint displayed "P&amp;L" (U-20261106-002). v1.4.2 decodes
    // the five XML built-ins before escaping — export-leg parity with svg-check
    // v1.5.0 R1. Covers the direct-text, tspan, and native-table desc-payload paths.
    const ESCAPED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="120" font-size="24" fill="#202020">P&amp;L review ahead</text>
    <text x="80" y="180" font-size="18" fill="#202020">Plan the &quot;scale&quot; phase</text>
    <text x="80" y="240" font-size="18" fill="#202020">a &lt; b and c &gt; d</text>
    <text x="80" y="300" font-size="18" fill="#202020">It&apos;s Q&amp;A time</text>
    <text x="80" y="360" font-size="18" fill="#202020"><tspan x="80" dy="0">Line one &amp; more</tspan><tspan x="80" dy="24">It&apos;s &quot;quoted&quot; &lt;here&gt;</tspan></text>
  </g>
  <g data-block-id="b2" data-native="table" data-frame="80,420,520,160">
    <desc>{"headers":["R&amp;D spend"],"rows":[["FY25","12.4"]]}</desc>
    <rect x="80" y="420" width="520" height="160" fill="#EEF2F8"/>
  </g>
</svg>`;
    const contract = [
      "# Entity parity deck content",
      "",
      "## Page 1 (content)",
      "P&L review ahead",
      'Plan the "scale" phase',
      "a < b and c > d",
      "It's Q&A time",
      'Line one & more It\'s "quoted" <here>',
      "",
    ].join("\n");
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-export-entities"), [
      { name: "01-entities.svg", body: ESCAPED },
    ], contract);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0); // the gate decodes runs, so the escaped page matches the plain contract

    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report", nativeCharts: true });
    const s1 = new TextDecoder().decode(unzipSync(zip)["ppt/slides/slide1.xml"]!);

    // exactly ONE escape level: raw slide XML carries the single-escaped spelling,
    // which decodes exactly once to the authored text ("P&L", not "P&amp;L")
    expect(s1).toContain("<a:t>P&amp;L review ahead</a:t>");
    expect(s1).toContain("<a:t>Plan the &quot;scale&quot; phase</a:t>");
    expect(s1).toContain("<a:t>a &lt; b and c &gt; d</a:t>");
    expect(s1).toContain("<a:t>It&apos;s Q&amp;A time</a:t>");
    expect(s1).toContain("<a:t>Line one &amp; more</a:t>");
    expect(s1).toContain("<a:t>It&apos;s &quot;quoted&quot; &lt;here&gt;</a:t>");
    expect(s1).toContain("<a:tbl>"); // native table compiled (nativeCharts: true)
    expect(s1).toContain("<a:t>R&amp;D spend</a:t>"); // desc payload decoded before JSON.parse

    // the v1.4.1 artifact — a second escape level — must not appear anywhere in the part
    expect(s1).not.toMatch(/&amp;(amp|lt|gt|quot|apos);/);

    // decode-once semantics over every text body in the part
    const decoded = [...s1.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1]));
    expect(decoded).toContain("P&L review ahead");
    expect(decoded).toContain("R&D spend");
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.4.2 pin: bare & compiles exactly like the escaped spelling (decode is a no-op, esc runs once)", () => {
    // The plain-text contract admits bare `&` pages (svg-check T3); the export leg
    // must land them on the identical slide XML as the `&amp;` spelling — decode
    // no-op + a single esc() pass (U-20261106-002: "both match the plain-text
    // contract" applies to the exporter too, not just the gate).
    const BARE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="120" font-size="24" fill="#202020">P&L review ahead</text>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-export-bare"), [
      { name: "01-bare.svg", body: BARE },
    ], "P&L review ahead\n");
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);

    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    const s1 = new TextDecoder().decode(unzipSync(zip)["ppt/slides/slide1.xml"]!);
    expect(s1).toContain("<a:t>P&amp;L review ahead</a:t>"); // single escape level
    expect(s1).not.toMatch(/&amp;(amp|lt|gt|quot|apos);/);    // no double escape
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.4.2 pin: nested-tspan fallback decodes entities (nodeTextOf parity with gate nodeText)", () => {
    // When a tspan has no own text, the exporter falls back to nodeTextOf over its
    // children — that fallback must decode entities too, mirroring svg-check's
    // nodeText, or a nested run would double-escape while its siblings do not.
    const NESTED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="110" y="360" font-size="20" fill="#1F3864">M&amp;A highlights<tspan x="110" dy="32"><tspan>deals closed in Q&amp;A season</tspan></tspan></text>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-export-nested"), [
      { name: "01-nested.svg", body: NESTED },
    ], "M&A highlights deals closed in Q&A season\n");
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0); // gate nodeText joins the nested subtree decoded

    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    const s1 = new TextDecoder().decode(unzipSync(zip)["ppt/slides/slide1.xml"]!);
    expect(s1).toContain("<a:t>M&amp;A highlights</a:t>");                       // direct text path
    expect(s1).toContain("<a:t>deals closed in Q&amp;A season</a:t>");          // fallback path (outer tspan has no own text)
    expect(s1).not.toMatch(/&amp;(amp|lt|gt|quot|apos);/);
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.4.2 pin: text-box width is measured from decoded text (entity overhead excluded)", () => {
    // estTextWidth sized boxes from the raw 20-char entity spelling, over-estimating
    // by the 4-char `&amp;` overhead; v1.4.2 measures the decoded run, so the
    // authored-entity and bare-& pages get IDENTICAL box geometry.
    const entity = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="120" font-size="24" fill="#202020">${body}</text>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-export-measure"), [
      { name: "01-escaped.svg", body: entity("P&amp;L review ahead") },
      { name: "02-bare.svg", body: entity("P&L review ahead") },
    ], "P&L review ahead\n");
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);

    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    const pkg = unzipSync(zip);
    const extOf = (n: number) => {
      const s = new TextDecoder().decode(pkg[`ppt/slides/slide${n}.xml`]!);
      const m = s.match(/name="text-\d+"[\s\S]*?<a:ext cx="(\d+)"/);
      expect(m).toBeDefined();
      return parseInt(m![1], 10);
    };
    const cxEscaped = extOf(1);
    const cxBare = extOf(2);
    expect(cxBare).toBe(cxEscaped); // geometry is entity-spelling independent

    // expected width from the DECODED 16-char run: 16 × 0.58em × 24px → 223px
    const ems = [..."P&L review ahead"].reduce((a, ch) => a + (ch.codePointAt(0)! > 0x2e80 ? 1.0 : 0.58), 0);
    const expectedDecoded = Math.ceil(Math.ceil(ems * 24) * 9525);
    expect(cxEscaped).toBe(expectedDecoded);
    // the raw-entity spelling (20 chars) would size the box differently — the
    // assertion above can actually detect a regression to raw-text measurement
    const emsRaw = [..."P&amp;L review ahead"].reduce((a, ch) => a + (ch.codePointAt(0)! > 0x2e80 ? 1.0 : 0.58), 0);
    expect(expectedDecoded).not.toBe(Math.ceil(Math.ceil(emsRaw * 24) * 9525));
    rmSync(dir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // v1.5.0 pins — ECMA-376 SCHEMA validity (xmllint passes on all of these
  // defects; PowerPoint enforces the schema, not just well-formedness).
  // -------------------------------------------------------------------------

  const ST_GUID = /^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$/;

  test("v1.5.0 pin: notesSlide a:fld/@id is a ST_Guid — the {GET-NUM} placeholder must never leak", () => {
    // v1.4.2 emitted `<a:fld id="{GET-NUM}" type="slidenum">` — a template
    // placeholder never replaced. a:fld/@id is typed ST_Guid ({8-4-4-4-12 hex});
    // PowerPoint rejects the part (repair), LibreOffice/xmllint tolerate it.
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-v150-fld"), [
      { name: "01-title.svg", body: PAGE_TITLE },
    ], CONTENT_MD);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    const notesDir = join(dir, "notes");
    mkdirSync(notesDir, { recursive: true });
    writeFileSync(join(notesDir, "01-speaker.md"), "Welcome the leadership team.\n");
    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report", notesDir });
    const pkg = unzipSync(zip);
    const notes1 = new TextDecoder().decode(pkg["ppt/notesSlides/notesSlide1.xml"]!);
    expect(notes1).toContain('type="slidenum"'); // field actually emitted
    for (const m of notes1.matchAll(/<a:fld id="([^"]*)"/g)) {
      expect(m[1]).toMatch(ST_GUID);
    }
    for (const [part, bytes] of Object.entries(pkg)) {
      if (part.endsWith(".xlsx")) continue; // embedded workbook zip, opaque here
      expect(new TextDecoder().decode(bytes)).not.toContain("GET-NUM");
    }
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.5.0 pin: graphicFrame carries p:xfrm (not a:xfrm) and table grid/cells satisfy CT_Table", () => {
    const NATIVE_PAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="data" data-page-number="1">
  <g data-block-id="b1">
    <g data-block-id="b2" data-native="table" data-frame="700,160,500,360">
      <desc>{"headers":["Metric","Q2","Q3"],"rows":[["Revenue","4.5M","5.1M"],["Churn","2.1%","2.1%"]]}</desc>
      <rect x="700" y="160" width="500" height="360" fill="#FFFFFF"/>
    </g>
  </g>
</svg>`;
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-v150-frame"), [
      { name: "01-native.svg", body: NATIVE_PAGE },
    ], "Revenue beat plan\n");
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    expect(report.summary.errors).toBe(0);
    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report", nativeCharts: true });
    const s1 = new TextDecoder().decode(unzipSync(zip)["ppt/slides/slide1.xml"]!);
    for (const m of s1.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)) {
      const g = m[0];
      expect(g).toContain("<p:xfrm>"); // CT_GraphicalObjectFrame: transform is p:xfrm
      const afterNv = g.split("</p:nvGraphicFramePr>")[1] ?? "";
      expect(afterNv).not.toContain("<a:xfrm>"); // a:xfrm inside graphicFrame is schema-invalid
    }
    const tbl = s1.match(/<a:tbl>[\s\S]*?<\/a:tbl>/)![0];
    const gridCols = tbl.match(/<a:gridCol w="\d+"\/>/g) ?? [];
    expect(gridCols.length).toBe(3); // three headers
    for (const row of tbl.matchAll(/<a:tr[^>]*>([\s\S]*?)<\/a:tr>/g)) {
      const cells = row[1].match(/<a:tc>/g) ?? [];
      expect(cells.length).toBe(3);
    }
    for (const tc of tbl.matchAll(/<a:tc>([\s\S]*?)<\/a:tc>/g)) {
      expect(tc[1]).toContain("<a:txBody>"); // CT_TableCell: txBody required
      expect(tc[1].indexOf("<a:txBody>")).toBeLessThan(tc[1].indexOf("<a:tcPr>")); // sequence order
    }
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.5.0 pin: notes wire-up is complete — presentation notesMasterIdLst + notesSlide→{slide,notesMaster} round-trip", () => {
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-v150-notes"), [
      { name: "01-title.svg", body: PAGE_TITLE },
    ], CONTENT_MD);
    const report = runCheck({ deckDir: dir, contentPath: join(dir, "deck_content.md"), stage: "final" });
    const notesDir = join(dir, "notes");
    mkdirSync(notesDir, { recursive: true });
    writeFileSync(join(notesDir, "01-speaker.md"), "Welcome the leadership team.\n");
    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report", notesDir });
    const pkg = unzipSync(zip);
    const pres = new TextDecoder().decode(pkg["ppt/presentation.xml"]!);
    // CT_Presentation sequence: sldMasterIdLst, notesMasterIdLst, (handoutMasterIdLst), sldIdLst
    const order = pres.match(/<p:(sldMasterIdLst|notesMasterIdLst|sldIdLst)/g) ?? [];
    expect(order).toEqual(["<p:sldMasterIdLst", "<p:notesMasterIdLst", "<p:sldIdLst"]);
    expect(pres).toContain('<p:notesMasterId id="2147483649" r:id="rIdNotesMaster"/>');
    const presRels = new TextDecoder().decode(pkg["ppt/_rels/presentation.xml.rels"]!);
    expect(presRels).toContain('Id="rIdNotesMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"');
    const notesRels = new TextDecoder().decode(pkg["ppt/notesSlides/_rels/notesSlide1.xml.rels"]!);
    expect(notesRels).toContain('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide1.xml"');
    expect(notesRels).toContain('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"');
    const slideRels = new TextDecoder().decode(pkg["ppt/slides/_rels/slide1.xml.rels"]!);
    expect(slideRels).toContain('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"');
    rmSync(dir, { recursive: true, force: true });
  });

  test("v1.5.0 pin: [Content_Types].xml covers every part; every Override targets a packaged part", () => {
    // Compile the richest fixture (many pages, notes-free) and assert package-wide
    // CT completeness — v1.4.2 was correct here; the pin guards regressions.
    const dir = join(import.meta.dir, "fixtures/sample-business-report");
    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report" });
    const pkg = unzipSync(zip);
    const ct = new TextDecoder().decode(pkg["[Content_Types].xml"]!);
    const defaults = new Set([...ct.matchAll(/<Default Extension="([^"]+)"/g)].map((m) => m[1].toLowerCase()));
    const overrideParts = [...ct.matchAll(/<Override PartName="([^"]+)"[^>]*ContentType="([^"]+)"/g)];
    const covered = new Set<string>();
    for (const [, pn, contentType] of overrideParts) {
      const part = pn.replace(/^\//, "");
      expect(pkg[part]).toBeDefined(); // no dangling Override
      covered.add(part);
      if (contentType.includes("presentationml.presentation.main+xml")) {
        expect(part).toBe("ppt/presentation.xml");
      }
    }
    expect(overrideParts.some(([, , ct2]) => ct2.includes("presentationml.presentation.main+xml"))).toBe(true);
    for (const part of Object.keys(pkg)) {
      if (part.endsWith(".rels")) {
        expect(defaults.has("rels")).toBe(true);
        continue;
      }
      const ext = part.split(".").pop()!.toLowerCase();
      if (!defaults.has(ext)) expect(covered.has(part)).toBe(true); // Override fallback
    }
    // (committed fixture — nothing to clean up)
  });

  test("v1.5.0 pin: every layout/master/notesMaster shape id is unique and non-zero within its part", () => {
    // v1.4.2 structured layouts emitted placeholder cNvPr id="0" (invalid: ids are
    // positive unique ST_DrawingElementId within the shape tree) and a body
    // placeholder id="1" duplicating the spTree group id — PowerPoint repair trigger.
    const PAGES = [
      { name: "01-title.svg", body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="title" data-page-number="1"><g data-block-id="b1"><rect x="0" y="0" width="1280" height="720" fill="#1F3864"/><text x="640" y="360" font-size="48" font-weight="bold" fill="#FFFFFF">Q3 2026 Business Review</text></g></svg>` },
      { name: "02-data.svg", body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="data" data-page-number="2"><g data-block-id="b1"><text x="80" y="100" font-size="28" font-weight="bold" fill="#1F3864">Revenue beat plan for the third straight quarter</text></g></svg>` },
    ];
    const dir = makeDeck(join(import.meta.dir, ".tmp-deck-v150-ids"), PAGES, CONTENT_MD);
    const { zip } = compileDeck({ deckDir: dir, registryPath: REGISTRY, deckType: "business-report", structuredLayouts: true });
    const pkg = unzipSync(zip);
    const shapeTreeParts = Object.keys(pkg).filter((k) =>
      /^ppt\/(slides\/slide\d+|slideLayouts\/slideLayout\d+|slideMasters\/slideMaster\d+|notesSlides\/notesSlide\d+|notesMasters\/notesMaster\d+)\.xml$/.test(k));
    expect(shapeTreeParts.length).toBeGreaterThanOrEqual(4);
    for (const part of shapeTreeParts) {
      const xml = new TextDecoder().decode(pkg[part]!);
      const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => parseInt(m[1], 10));
      expect(ids.length).toBeGreaterThan(0);
      expect(Math.min(...ids)).toBeGreaterThan(0); // no id="0"
      expect(new Set(ids).size).toBe(ids.length);  // no duplicates
    }
    rmSync(dir, { recursive: true, force: true });
  });
});

