// Pure helpers for the co-workspace web app — no DOM, no fetch (T-20260928-012).
// Served at /app-helpers.js and imported by the index.html module script;
// unit-tested by tests/unit/co-workspace-helpers.test.ts.

/** Recency bucket label for a session timestamp (ChatGPT-style sidebar grouping). */
export function recencyGroupLabel(dateLike, now = Date.now()) {
  const d = new Date(dateLike);
  const days = Math.floor((now - d.getTime()) / 86400000);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : days <= 7 ? "Previous 7 days" : "Older";
}

/** Fixed display order of the recency buckets. */
export const RECENCY_GROUP_ORDER = ["Today", "Yesterday", "Previous 7 days", "Older"];

/**
 * Donut slice preparation (R5): drop zero/negative values, sort descending,
 * keep the top 7, and bucket the remainder into "others".
 * Returns { top, total } — the pct/dasharray math in the page derives from these.
 */
export function prepareDonutSlices(slices) {
  const sorted = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 7);
  const rest = sorted.slice(7).reduce((a, s) => a + s.value, 0);
  if (rest > 0) top.push({ label: "others", value: rest });
  const total = top.reduce((a, s) => a + s.value, 0);
  return { top, total };
}

/**
 * Markdown → speakable plain text for the TTS surface (ADR-0098 voice conversation).
 * Deterministic reductions only: code fences and inline code drop or demote, links
 * keep their text, tables/headings/list markers/blocksquotes flatten, HTML tags and
 * control characters go, whitespace collapses. Plain prose passes through unchanged.
 */
export function speakableText(md) {
  return String(md ?? "")
    .replace(/```[\s\S]*?(```|$)/g, " (code block omitted) ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, (row) => row.replace(/\|/g, " ").replace(/\s+/g, " ").trim())
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/[*_~]{1,3}([^*_~]*)[*_~]{1,3}/g, "$1")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    // TTS speaks one continuous stream — all whitespace collapses to single spaces.
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the browser exposes the Web Speech recognition surface (STT). */
export function speechRecognitionSupported(globalThis) {
  const w = globalThis ?? (typeof window !== "undefined" ? window : {});
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** True when the browser exposes the speech-synthesis surface (TTS). */
export function speechSynthesisSupported(globalThis) {
  const w = globalThis ?? (typeof window !== "undefined" ? window : {});
  return Boolean(w.speechSynthesis);
}
