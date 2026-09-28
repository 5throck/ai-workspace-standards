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
