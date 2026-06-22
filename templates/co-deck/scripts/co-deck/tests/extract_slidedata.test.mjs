import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { spawnSync } from "child_process";
import { readFileSync, existsSync, unlinkSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "../extract_slidedata.mjs");
const FIXTURES = resolve(__dirname, "fixtures");
const TMP = resolve(__dirname, "tmp");

beforeAll(() => { mkdirSync(TMP, { recursive: true }); });
afterAll(() => {
  for (const f of ["co-deck1.json", "co-deck2.json", "strict.json", "strict.html"]) {
    const p = resolve(TMP, f);
    if (existsSync(p)) unlinkSync(p);
  }
});

function runExtract(htmlPath, outPath) {
  const result = spawnSync("bun", [SCRIPT, htmlPath, outPath], { encoding: "utf-8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(readFileSync(outPath, "utf-8"));
}

describe("extract_slidedata", () => {
  // AC-01: co-deck2 multi-line bullets → 24 slides
  it("AC-01: recovers all 24 slides from co-deck2 (multi-line bullets)", () => {
    const slides = runExtract(
      resolve(FIXTURES, "co-deck2-multiline-bullets.html"),
      resolve(TMP, "co-deck2.json")
    );
    expect(slides.length).toBe(24);
  });

  // AC-02: co-deck1 inline bullets → 20 slides (regression)
  it("AC-02: co-deck1 (inline bullets) still recovers 20 slides", () => {
    const slides = runExtract(
      resolve(FIXTURES, "co-deck1-inline-bullets.html"),
      resolve(TMP, "co-deck1.json")
    );
    expect(slides.length).toBe(20);
  });

  // AC-03: strict-JSON input is parsed without error
  it("AC-03: strict-JSON slideData is extracted without error", () => {
    const strictHtml = '<script>\nconst slideData = [{"title":"S1"},{"title":"S2"}];\n</script>';
    const htmlPath = resolve(TMP, "strict.html");
    writeFileSync(htmlPath, strictHtml, "utf-8");
    const slides = runExtract(htmlPath, resolve(TMP, "strict.json"));
    expect(slides.length).toBe(2);
  });
});
