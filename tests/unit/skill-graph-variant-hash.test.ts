// skill-graph-variant-hash.test.ts — S2 of design
// docs/designs/2026-11-26-skill-drift-structural-fixes-design.md §4.2/§9:
// variant-token hash compensation in normalizeForHash/contentHash — a
// scaffold-rendered skill hashes equal to its template source under the same
// variantName. The real template/project pair pins the AC end-to-end; no
// SKILL.md is modified.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contentHash, normalizeForHash } from "../../scripts/lib/skill-graph-compat.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const TEMPLATE_SKILL = join(REPO_ROOT, "templates/common/skills/script-lifecycle-manager/SKILL.md");
const RENDERED_SKILL = join(REPO_ROOT, "Projects/co-news/skills/script-lifecycle-manager/SKILL.md");

describe("normalizeForHash variant-token compensation (S2)", () => {
  test("a backtick span carrying the rendered slug rewrites to the <variant> token form", () => {
    const rendered = "Run `bun scripts/co-news/check.ts` under `scripts/co-news/` first.\n";
    const normalized = normalizeForHash(rendered, "co-news");
    expect(normalized).toContain("`scripts/<variant>/`");
    expect(normalized).toContain("`bun scripts/<variant>/check.ts`");
    expect(normalized).not.toContain("co-news");
  });

  test("text outside backticks is never rewritten", () => {
    const content = "The co-news project ships scripts under its own name: scripts/co-news/.\n";
    const normalized = normalizeForHash(content, "co-news");
    expect(normalized).toBe(normalizeForHash(content));
    expect(normalized).toContain("scripts/co-news/");
  });

  test("an exact-slug boundary: co-newsletter does not match variantName co-news", () => {
    const content = "See `scripts/co-newsletter/` for the newsletter variant.\n";
    const normalized = normalizeForHash(content, "co-news");
    expect(normalized).toContain("`scripts/co-newsletter/`");
    expect(normalized).not.toContain("<variant>");
  });

  test("no variantName parameter is a byte-identical no-op (template-side hashing)", () => {
    const content = "Keep `scripts/co-news/` verbatim.\n";
    expect(normalizeForHash(content)).toBe(normalizeForHash(content, undefined));
  });

  test("normalization is idempotent under the same variantName (token cannot re-trigger)", () => {
    const rendered = "Use `scripts/co-news/tools.md` and see co-news elsewhere.\n";
    const once = normalizeForHash(rendered, "co-news");
    expect(normalizeForHash(once, "co-news")).toBe(once);
  });
});

describe("contentHash variant compensation (S2 AC: the real pair collapses)", () => {
  test("template and rendered script-lifecycle-manager copies hash equal under the same variantName", () => {
    expect(existsSync(TEMPLATE_SKILL)).toBe(true);
    expect(existsSync(RENDERED_SKILL)).toBe(true);
    const tpl = readFileSync(TEMPLATE_SKILL, "utf8");
    const rendered = readFileSync(RENDERED_SKILL, "utf8");
    // The pair genuinely differed before S2 (the rendered copy carries
    // `scripts/co-news/` where the template carries `scripts/<variant>/`).
    expect(rendered).toContain("scripts/co-news/");
    expect(tpl).toContain("scripts/<variant>/");
    expect(contentHash(tpl)).not.toBe(contentHash(rendered)); // legacy behavior (pre-S2)
    expect(contentHash(tpl, "co-news")).toBe(contentHash(rendered, "co-news")); // S2 AC
  });

  test("an unrelated slug does not collapse the real pair", () => {
    const tpl = readFileSync(TEMPLATE_SKILL, "utf8");
    const rendered = readFileSync(RENDERED_SKILL, "utf8");
    expect(contentHash(tpl, "co-price")).not.toBe(contentHash(rendered, "co-price"));
  });
});
