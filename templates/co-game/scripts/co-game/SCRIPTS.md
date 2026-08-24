# SCRIPTS.md — co-game Variant Scripts

> Lifecycle registry for co-game variant-specific scripts in `scripts/co-game/`.

## Registry

| Script | Version | Status | Description | Usage |
|--------|---------|--------|-------------|-------|
| `bundle-html.ts` | 1.0.0 | active | Single-file HTML game bundler — inlines a built game directory's local scripts, stylesheets (with CSS `@import`/`url()` chains), and media assets (base64 data URIs) into one distributable HTML file. Remote URLs and data URIs are left untouched and reported; circular references are guarded; idempotent with already-bundled detection. | `bun scripts/co-game/bundle-html.ts --input <built-dir> [--output <file.html>] [--check]` |
