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
 * paragraph → the opening text. The result is markdown-stripped, then assembled
 * from WHOLE SENTENCES up to 200 chars (user review: the spoken cut must never
 * break mid-sentence — the first sentence is always spoken in full, even when it
 * alone exceeds the cap).
 */
export function spokenSummary(md, cap = 200) {
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
  const sentences = spoken.match(/[^.!?:\n]+[.!?]*\s*/g) ?? [spoken];
  let out = "";
  for (const sentence of sentences) {
    if (out && out.length + sentence.length > cap) break;
    out += sentence;
  }
  out = out.trim();
  return out.length < spoken.trim().length ? out + " …" : out;
}

/**
 * Turn activity label (user review 2026-10-04: show progress between query and
 * answer — benchmark: labeled activity stream + elapsed time is the dominant
 * pattern in ChatGPT/Claude/Perplexity). Pure formatting: seconds + the last
 * known tool/activity name.
 */
export function formatTurnActivity(elapsedSec, lastActivity) {
  const secs = Math.max(0, Math.floor(elapsedSec));
  const base = secs >= 90 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
  return lastActivity ? `${base} · ${lastActivity}` : base;
}

// ── Tenant loop (design 2026-11-08-gw-tenant-loop-and-hardening-design §4, admin UI):
// pure client-side mirrors of the gateway's write-time validation (src/tenant-loop.ts) so
// the register form rejects malformed input before a round trip, and a dry-run → confirm
// gate for the upgrade flow (the Confirm call must not fire without a prior plan render).
// Unit-tested by tests/unit/co-workspace-admin-ui.test.ts. ──

/** Same shape the gateway's TENANT_ID_RE enforces (src/tenant-loop.ts) — a different
 * namespace from fleet ids (`co-*`). */
export const TENANT_ID_RE = /^gw-[0-9a-f]{12}$/;

/** Exact scope keys the gateway accepts in `scopes` (validateLoopScopes). */
export const LOOP_SCOPE_KEYS = ["upgrade", "upstreamFile", "backportReview", "nightlyFleet"];

const LOOP_GROUP_RE = /^[\w-]{1,64}$/;
const LOOP_HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** null when `value` is a well-formed tenant id, else the error message for the form. */
export function validateTenantId(value) {
  return typeof value === "string" && TENANT_ID_RE.test(value)
    ? null
    : "tenant id must be gw- followed by 12 hex chars (e.g. gw-0123456789ab)";
}

/** Client mirror of validateLoopWindows: {tz valid IANA, days non-empty ints 0-6,
 * start/end HH:MM, start !== end}. Returns null when valid, else the error message. */
export function validateLoopWindowsClient(windows) {
  if (typeof windows !== "object" || windows === null || Array.isArray(windows)) {
    return "windows must be a JSON object {tz, days, start, end}";
  }
  const tz = typeof windows.tz === "string" ? windows.tz : "";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return `windows.tz must be a valid IANA time zone, got ${JSON.stringify(windows.tz)}`;
  }
  const days = windows.days;
  if (!Array.isArray(days) || days.length === 0 || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    return "windows.days must be a non-empty array of integers 0-6 (0 = Sunday)";
  }
  for (const [label, val] of [["start", windows.start], ["end", windows.end]]) {
    if (typeof val !== "string" || !LOOP_HHMM_RE.test(val)) return `windows.${label} must be HH:MM (00:00-23:59)`;
  }
  if (windows.start === windows.end) return "windows.start and windows.end must differ";
  return null;
}

/** Pre-flight parse+validate of the config editor's JSON (a client mirror of the PUT
 * /admin/tenant-loop/config rules — the server stays authoritative and re-validates).
 * Returns { ok: true, value } with the parsed body, or { ok: false, error }. */
export function validateLoopConfigJson(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "config must be valid JSON" };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "config must be a JSON object" };
  }
  if (raw.group !== undefined && (typeof raw.group !== "string" || !LOOP_GROUP_RE.test(raw.group))) {
    return { ok: false, error: `group must match ${LOOP_GROUP_RE.source}` };
  }
  if (raw.designatedUsers !== undefined) {
    const du = raw.designatedUsers;
    if (!Array.isArray(du) || !du.every((u) => typeof u === "string" && u.trim().length > 0 && u.trim().length <= 128)) {
      return { ok: false, error: "designatedUsers must be an array of principal strings" };
    }
  }
  if (raw.scopes !== undefined) {
    const sc = raw.scopes;
    if (typeof sc !== "object" || sc === null || Array.isArray(sc)) {
      return { ok: false, error: "scopes must be a JSON object" };
    }
    for (const [k, v] of Object.entries(sc)) {
      if (!LOOP_SCOPE_KEYS.includes(k)) return { ok: false, error: `unknown scope key "${k}" (allowed: ${LOOP_SCOPE_KEYS.join(", ")})` };
      if (typeof v !== "boolean") return { ok: false, error: `scope "${k}" must be a boolean` };
    }
  }
  if (raw.windows !== undefined) {
    const err = validateLoopWindowsClient(raw.windows);
    if (err) return { ok: false, error: err };
  }
  return { ok: true, value: raw };
}

/**
 * Dry-run → confirm upgrade gate (§4.4). The Confirm call must never fire without a
 * prior dry-run plan RENDER for the same tenant: offerPlan only accepts a payload with
 * `dryRun: true` (what POST …/upgrade without confirm returns), confirmAllowed is
 * tenant-scoped, and consume clears the pending plan after a successful confirm.
 */
export function createUpgradeFlow() {
  let planned = null; // { tenantId, plan } once a dry-run plan has been rendered
  return {
    pendingTenantId() {
      return planned ? planned.tenantId : null;
    },
    /** Record a rendered dry-run plan; refuses payloads that are not a dry-run plan. */
    offerPlan(tenantId, plan) {
      planned = plan && plan.dryRun === true ? { tenantId, plan } : null;
      return planned !== null;
    },
    /** May the Confirm call fire for this tenant right now? */
    confirmAllowed(tenantId) {
      return planned !== null && planned.tenantId === tenantId;
    },
    /** Clear the pending plan after the confirm went through (or refuse a stray one). */
    consume(tenantId) {
      if (planned !== null && planned.tenantId === tenantId) {
        planned = null;
        return true;
      }
      return false;
    },
  };
}
