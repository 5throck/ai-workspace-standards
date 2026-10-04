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
  voiceTransition,
  shouldAutoSend,
  detectVoiceLang,
  VOICE_LANGUAGES,
  spokenSummary,
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

describe("voiceTransition (2026-10-04 voice conversation design)", () => {
  test("happy hands-free loop: idle -> listening -> thinking -> speaking -> listening", () => {
    let st = "idle";
    st = voiceTransition(st, "modeOn");
    expect(st).toBe("listening");
    st = voiceTransition(st, "finalTranscript", { autoSend: true });
    expect(st).toBe("thinking");
    st = voiceTransition(st, "ttsStart");
    expect(st).toBe("speaking");
    st = voiceTransition(st, "ttsEnd", { voiceMode: true });
    expect(st).toBe("listening");
  });

  test("manual-send mode stands down after the transcript, then sendStart re-enters", () => {
    let st = voiceTransition("listening", "finalTranscript", { autoSend: false });
    expect(st).toBe("idle");
    st = voiceTransition(st, "sendStart");
    expect(st).toBe("thinking");
  });

  test("barge-in from speaking restarts listening; turnDone enters speaking", () => {
    expect(voiceTransition("speaking", "bargeIn")).toBe("listening");
    expect(voiceTransition("thinking", "turnDone")).toBe("speaking");
  });

  test("modeOff and error land on idle from every state", () => {
    for (const st of ["listening", "thinking", "speaking"]) {
      expect(voiceTransition(st, "modeOff")).toBe("idle");
      expect(voiceTransition(st, "error")).toBe("idle");
    }
  });

  test("ttsEnd with voiceMode off stands down; illegal transitions are no-ops", () => {
    expect(voiceTransition("speaking", "ttsEnd", { voiceMode: false })).toBe("idle");
    expect(voiceTransition("idle", "bargeIn")).toBe("idle");
    expect(voiceTransition("thinking", "finalTranscript", { autoSend: true })).toBe("thinking");
    expect(voiceTransition("speaking", "nonsense-event")).toBe("speaking");
  });

  test("shouldAutoSend requires listening state and the autoSend flag", () => {
    expect(shouldAutoSend("listening", { autoSend: true })).toBe(true);
    expect(shouldAutoSend("listening", {})).toBe(false);
    expect(shouldAutoSend("thinking", { autoSend: true })).toBe(false);
  });
});

describe("detectVoiceLang (voice language selection)", () => {
  test("exact match wins", () => {
    expect(detectVoiceLang(["en-US"])).toBe("en-US");
    expect(detectVoiceLang(["ko-KR"])).toBe("ko-KR");
  });

  test("primary-subtag match maps regional variants", () => {
    expect(detectVoiceLang(["en-GB", "ko-KR"])).toBe("en-US");
    expect(detectVoiceLang(["ja-JP"])).toBe("ja-JP");
    expect(detectVoiceLang(["es-MX"])).toBe("es-ES");
  });

  test("first supported browser language wins in order", () => {
    expect(detectVoiceLang(["fr-FR", "ko-KR", "en-US"])).toBe("ko-KR");
  });

  test("unsupported languages fall back", () => {
    expect(detectVoiceLang(["fr-FR", "de-DE"])).toBe("ko-KR");
    expect(detectVoiceLang(undefined)).toBe("ko-KR");
  });

  test("underscore variants (navigator edge) normalize", () => {
    expect(detectVoiceLang(["en_US"])).toBe("en-US");
  });

  test("supported set covers the four README languages", () => {
    expect(VOICE_LANGUAGES).toEqual(["ko-KR", "en-US", "ja-JP", "es-ES"]);
  });
});

describe("spokenSummary (voice speaks the gist, not the dump)", () => {
  test("short answers pass through whole", () => {
    expect(spokenSummary("Deploy is green.")).toBe("Deploy is green.");
  });

  test("prefers the Short Answer section of the Explanation Pattern", () => {
    const md = "## Short Answer\n\nMerge it — the gate is green.\n\n## Details\n\n" + "x".repeat(500);
    expect(spokenSummary(md)).toBe("Merge it — the gate is green.");
  });

  test("long text truncates at a sentence boundary with an ellipsis", () => {
    const md = "Sentence one is here. Sentence two follows. " + "y".repeat(400);
    const out = spokenSummary(md, 120);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan(160);
    expect(out).toContain("Sentence one is here.");
  });

  test("falls back to the first prose paragraph for long sectioned docs", () => {
    const md = "## Header\n\nFirst paragraph carries the conclusion.\n\n| table | data |\n";
    const out = spokenSummary(md, 40);
    expect(out.startsWith("First paragraph")).toBe(true);
  });
});

describe("spokenSummary whole-sentence contract (user review: 200 chars, never cut mid-sentence)", () => {
  test("assembles whole sentences up to the cap", () => {
    const md = "First complete sentence stays. Second sentence fits too. " + "Third sentence rambles well past the budget ".repeat(6) + "and keeps going.";
    const out = spokenSummary(md, 200);
    expect(out).toBe("First complete sentence stays. Second sentence fits too. …");
  });

  test("the FIRST sentence is always spoken in full, even when it alone exceeds the cap", () => {
    const md = "A single very long sentence without any terminator " + "keeps going and going ".repeat(10) + "and finally ends.";
    const out = spokenSummary(md, 100);
    expect(out.startsWith("A single very long sentence")).toBe(true);
    expect(out).not.toContain("…");
    expect(out.endsWith("ends.")).toBe(true);
  });

  test("truncation appends the ellipsis after a complete sentence", () => {
    const md = "One. Two. Three. Four. Five. Six. Seven.";
    const out = spokenSummary(md, 14);
    expect(out).toBe("One. Two. …");
  });
});
