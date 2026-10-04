/** Unit tests for the co-workspace web app's pure helpers (T-20260928-012):
 * recency sidebar grouping + donut slice preparation, extracted from web/index.html. */

import { describe, expect, test } from "bun:test";
import {
  RECENCY_GROUP_ORDER,
  prepareDonutSlices,
  recencyGroupLabel,
  speakableText,
  speechRecognitionSupported,
  speechSynthesisSupported,
} from "../../services/co-workspace/web/app-helpers.js";

describe("recencyGroupLabel", () => {
  const NOW = Date.UTC(2026, 8, 29, 12, 0, 0); // fixed "now" — no flaky midnight edges
  const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

  test("buckets by whole days since creation", () => {
    expect(recencyGroupLabel(hoursAgo(2), NOW)).toBe("Today"); // 2h ago
    expect(recencyGroupLabel(hoursAgo(23), NOW)).toBe("Today"); // < 24h
    expect(recencyGroupLabel(hoursAgo(30), NOW)).toBe("Yesterday"); // 1-2 days
    expect(recencyGroupLabel(hoursAgo(47), NOW)).toBe("Yesterday");
    expect(recencyGroupLabel(hoursAgo(72), NOW)).toBe("Previous 7 days");
    expect(recencyGroupLabel(hoursAgo(170), NOW)).toBe("Previous 7 days"); // 7 full days
    expect(recencyGroupLabel(hoursAgo(192), NOW)).toBe("Older"); // 8 days
  });

  test("defaults to the real clock (no now argument)", () => {
    expect(recencyGroupLabel(new Date().toISOString())).toBe("Today");
  });

  test("RECENCY_GROUP_ORDER is the display order", () => {
    expect(RECENCY_GROUP_ORDER).toEqual(["Today", "Yesterday", "Previous 7 days", "Older"]);
  });
});

describe("prepareDonutSlices", () => {
  test("drops zero values and sorts descending", () => {
    const { top, total } = prepareDonutSlices([
      { label: "b", value: 3 },
      { label: "a", value: 0 },
      { label: "c", value: 9 },
    ]);
    expect(top.map((s) => s.label)).toEqual(["c", "b"]);
    expect(total).toBe(12);
  });

  test("keeps the top 7 and buckets the remainder as others", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ label: `s${i}`, value: 10 - i }));
    const { top, total } = prepareDonutSlices(many);
    expect(top).toHaveLength(8); // 7 slices + others
    expect(top[7]).toEqual({ label: "others", value: 6 }); // 3+2+1
    expect(total).toBe(55);
  });

  test("empty and all-zero inputs produce an empty chart state", () => {
    expect(prepareDonutSlices([])).toEqual({ top: [], total: 0 });
    const { top, total } = prepareDonutSlices([{ label: "x", value: 0 }]);
    expect(top).toEqual([]);
    expect(total).toBe(0);
  });
});

describe("speakableText (ADR-0098 TTS surface)", () => {
  test("plain prose passes through unchanged", () => {
    const prose = "The gateway runs one turn at a time per tenant.";
    expect(speakableText(prose)).toBe(prose);
  });

  test("fenced code blocks are announced and omitted", () => {
    const md = "Before.\n```js\nconst x = 1;\nconsole.log(x);\n```\nAfter.";
    expect(speakableText(md)).toBe("Before. (code block omitted) After.");
  });

  test("links keep their text; inline code unwraps", () => {
    expect(speakableText("See [the README](https://example.com) for `runChat`.")).toBe(
      "See the README for runChat."
    );
  });

  test("table rows flatten to speakable words", () => {
    const md = "| name | value |\n| ---- | ----- |\n| runs | 300   |";
    const out = speakableText(md);
    expect(out).toContain("name value");
    expect(out).toContain("runs 300");
    expect(out).not.toContain("|");
  });

  test("headings, list markers, emphasis and HTML tags flatten", () => {
    const md = "## Title\n- item one\n1. item two\n**bold** and *soft* <br> text";
    const out = speakableText(md);
    expect(out).toBe("Title item one item two bold and soft text");
  });

  test("null/undefined input becomes an empty string", () => {
    expect(speakableText(null)).toBe("");
    expect(speakableText(undefined)).toBe("");
  });
});

describe("speech support probes (ADR-0098 voice surface)", () => {
  test("detect recognition and synthesis surfaces without a real browser", () => {
    expect(speechRecognitionSupported({ webkitSpeechRecognition: function () {} })).toBe(true);
    expect(speechRecognitionSupported({})).toBe(false);
    expect(speechSynthesisSupported({ speechSynthesis: {} })).toBe(true);
    expect(speechSynthesisSupported({})).toBe(false);
  });
});
