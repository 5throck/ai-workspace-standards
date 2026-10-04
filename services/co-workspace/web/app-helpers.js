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

/**
 * Voice Conversation Mode state machine (spec
 * 2026-10-04-coworkspace-voice-conversation-design). Pure reducer: the DOM wiring
 * dispatches events, this decides the next state. Benchmark grounding: explicit
 * named states with defined transitions (WebRTC.ventures 2026-09), half-duplex
 * turn-taking (recognition never runs while TTS speaks), barge-in as a first-class
 * event. Unknown events are no-ops that keep the current state.
 *
 * States: idle | listening | thinking | speaking
 * Events: modeOn, modeOff, listenStart, finalTranscript, sendStart, turnDone,
 *         ttsStart, ttsEnd, bargeIn, error
 */
export const VOICE_STATES = ["idle", "listening", "thinking", "speaking"];

/** Should a final transcript be submitted automatically in this state+settings? */
export function shouldAutoSend(state, opts = {}) {
  if (state !== "listening") return false;
  return opts.autoSend === true;
}

export function voiceTransition(state, event, opts = {}) {
  switch (event) {
    case "modeOn":
      return "listening";
    case "modeOff":
    case "error":
      return "idle";
    case "listenStart":
      return state === "idle" || state === "listening" ? "listening" : state;
    case "finalTranscript":
      // Half-duplex + benchmark: auto-send chains straight into the turn; manual
      // mode hands the transcript to the composer and stands down to idle.
      if (state === "listening") return shouldAutoSend(state, opts) ? "thinking" : "idle";
      return state;
    case "sendStart":
      return state === "listening" || state === "idle" ? "thinking" : state;
    case "turnDone":
      // The reply is ready to be spoken; if TTS is unavailable the wiring goes
      // straight back to listening (voiceMode) or idle.
      return "speaking";
    case "ttsStart":
      return state === "thinking" || state === "speaking" ? "speaking" : state;
    case "ttsEnd":
      // Hands-free loop: re-arm listening; when voice mode was turned off mid-answer
      // (opts.voiceMode false) stand down instead.
      return opts.voiceMode === false ? "idle" : "listening";
    case "bargeIn":
      // Barge-in: from speaking OR listening, drop to a fresh listening turn.
      return state === "speaking" || state === "listening" ? "listening" : state;
    default:
      return state;
  }
}

/**
 * Voice language selection (user review 2026-10-04: per-country language support).
 * Web Speech API recognizes ONE configured language per session — true spoken-language
 * auto-detection is not available — so the UI offers a picker and this helper picks the
 * smart default: the first browser language whose primary subtag matches a supported
 * voice language, else the fallback.
 */
export const VOICE_LANGUAGES = ["ko-KR", "en-US", "ja-JP", "es-ES"];

export function detectVoiceLang(browserLangs, supported = VOICE_LANGUAGES, fallback = "ko-KR") {
  const langs = Array.isArray(browserLangs) ? browserLangs : [browserLangs];
  for (const raw of langs) {
    if (typeof raw !== "string") continue;
    const primary = raw.replace("_", "-").split("-")[0].toLowerCase();
    const hit = supported.find((s) => s.toLowerCase() === raw.replace("_", "-").toLowerCase())
      ?? supported.find((s) => s.toLowerCase().startsWith(primary + "-"));
    if (hit) return hit;
  }
  return fallback;
}

/**
 * Spoken summary for voice mode (user review 2026-10-04): long agent answers must
 * NOT be read in full — speak the gist (3Blue1Brown: conclusion/intuition first),
 * leave the detail on screen. Extraction order: an explicit "Short Answer" section
 * (LLM Interaction Standard §5 Explanation Pattern) → the first non-heading
 * paragraph → the opening text. Result is markdown-stripped and capped at a
 * sentence boundary near 320 chars.
 */
export function spokenSummary(md, cap = 320) {
  const text = speakableText(md);
  if (text.length <= cap) return text;
  let source = text;
  const shortMatch = md && /##\s*Short Answer\s*\n+([\s\S]*?)(\n##|\n*$)/i.exec(String(md));
  if (shortMatch && shortMatch[1].trim()) source = shortMatch[1];
  else {
    const firstPara = String(md).split(/\n{2,}/).find((b) => {
      const t = b.trim();
      return t && !t.startsWith("#") && !t.startsWith("```") && !t.startsWith("|") && !t.startsWith("-");
    });
    if (firstPara) source = firstPara;
  }
  const spoken = speakableText(source);
  if (spoken.length <= cap) return spoken;
  const cut = spoken.lastIndexOf(".", cap);
  return (cut > cap * 0.5 ? spoken.slice(0, cut + 1) : spoken.slice(0, cap).trim()) + " …";
}
