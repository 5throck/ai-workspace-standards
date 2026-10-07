# XSS Assertions for No-Exports Browser Deliverables

From co-learning's LMS delivery tests (T-20261007-021; source: PR #13 D2+D3,
`tests/lms-delivery.test.mjs` test 10, `app.js` ~1683). Browser deliverables
that inline their renderer (no exports, single HTML file) cannot be unit-tested
through imports — but the renderer itself is still the XSS boundary.

## Source-slice + structural inertness

1. **Regex-slice the verbatim source** of `esc()` + `renderMarkdown()` between
   two stable markers (function declaration lines). The slice is the test
   fixture — the exact shipped code, not a reimplementation.
2. **`eval` via `new Function`** to materialize the functions inside the test.
3. **Structural inertness assertions** over rendered output for hostile input:
   - every emitted tag belongs to the renderer's TAGS allowlist;
   - anchor attribute keys are allowlisted (`href`/`target`/`rel`);
   - every `href` matches the scheme allowlist (`https?://`, site-relative).

## The protocol-relative trap

Scheme allowlists MUST be `/^(https?:\/\/|\/(?!\/))/` — a bare `\/`
prefix permits `//evil.example` protocol-relative URLs, i.e. arbitrary
external-host redirects through an allowlist that "looks" closed. This exact
shape is why the assertion exists rather than a regex eyeball.

## Pollination

Applies to any inline-JS web deliverable — co-deck lecture HTML is the named
next target (T-20261007-021).
