// @version 1.0.0 — slide schema detection shared by the co-deck pipeline
// (U-20261105-001).
//
// Current co-deck slidedata.json identifies special slides with BOOLEAN FLAGS
// (isCover / isDivider / isPunchline / isContact / isProfile) rather than a
// `type` string, while the canonical html-build contract (skills/html-build/
// SKILL.md, zen template.html slideType()) uses the long forms
// (isTitleSlide / isDividerSlide / isPunchlineSlide / isProfileSlide /
// isContactSlide). estimate-layout.ts v1.4.0 read only `s.type ?? 'standard'`,
// so every special slide falsely ran the STANDARD min-content checks and
// failed the layout gate (U-20261105-001).
//
// Resolution order mirrors zen template.html slideType():
//   explicit `type` string (legacy decks) → punchline → cover/title →
//   divider → profile → contact → standard.

export interface SlideSchemaItem {
  type?: string;
  isTitleSlide?: boolean;
  isCover?: boolean;
  isDividerSlide?: boolean;
  isDivider?: boolean;
  isPunchlineSlide?: boolean;
  isPunchline?: boolean;
  isProfileSlide?: boolean;
  isProfile?: boolean;
  isContactSlide?: boolean;
  isContact?: boolean;
  [key: string]: unknown;
}

/** boolean flag → slide_types key, checked in zen slideType() order. */
const SLIDE_TYPE_FLAGS: Array<[keyof SlideSchemaItem & string, string]> = [
  ['isPunchlineSlide', 'punchline'],
  ['isPunchline',      'punchline'],
  ['isTitleSlide',     'title'],
  ['isCover',          'title'],
  ['isDividerSlide',   'divider'],
  ['isDivider',        'divider'],
  ['isProfileSlide',   'profile'],
  ['isProfile',        'profile'],
  ['isContactSlide',   'contact'],
  ['isContact',        'contact'],
];

/**
 * Resolve the slide_types key for a slidedata.json entry: legacy `type`
 * string first, then boolean flags (short + long forms), else `standard`.
 */
export function slideTypeOf(s: SlideSchemaItem): string {
  if (s.type) return s.type;
  for (const [flag, type] of SLIDE_TYPE_FLAGS) {
    if (s[flag]) return type;
  }
  return 'standard';
}
