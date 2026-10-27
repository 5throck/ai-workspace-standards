// @version 1.0.0
// v1.0.0 (2026-10-27, U-20261027-005): DESIGN-R2 theme-invariance policy — the
// single key-classification shared by the two enforcement points so they cannot
// drift:
//   - scripts/compile-tokens.ts extractThemes: a theme preset carrying a
//     non-overridable group is a HARD compile error (the SSOT must not compile
//     rule violations).
//   - scripts/design-lint.ts "themes" sub-check: the same rule reported as
//     fail-level findings against the project token source.
//
// The documented rule (design-tokens.template.css + variant design docs):
// theme presets in tokens.json may override ONLY color and shadow tokens;
// typography / spacing / borderRadius / target-size are theme-invariant.

/** Group keys a theme preset may override (DESIGN-R2 theme-invariance rule). */
export const THEME_OVERRIDABLE_GROUPS: ReadonlySet<string> = new Set(["color", "shadow"]);

/** camelCase / PascalCase / snake_case → kebab-case (same shape compile-tokens' camelToKebab applies to key paths). */
function toKebab(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * True when a theme-preset top-level group key names an overridable token
 * family (color/shadow). The key is normalized to kebab-case first so
 * "borderRadius" style spellings cannot slip past the set membership.
 */
export function isThemeOverridableGroup(key: string): boolean {
  return THEME_OVERRIDABLE_GROUPS.has(toKebab(key));
}
