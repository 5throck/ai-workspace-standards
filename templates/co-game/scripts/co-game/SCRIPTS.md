# SCRIPTS.md — co-game Variant Scripts

> Lifecycle registry for co-game variant-specific scripts in `scripts/co-game/`.

## Registry

| Script | Version | Status | Description | Usage |
|--------|---------|--------|-------------|-------|
| `bundle-html.ts` | 1.0.0 | active | Single-file HTML game bundler — inlines a built game directory's local scripts, stylesheets (with CSS `@import`/`url()` chains), and media assets (base64 data URIs) into one distributable HTML file. Remote URLs and data URIs are left untouched and reported; circular references are guarded; idempotent with already-bundled detection. | `bun scripts/co-game/bundle-html.ts --input <built-dir> [--output <file.html>] [--check]` |
| `validate-asset-manifest.ts` | 1.0.0 | active | Asset-manifest validator (mirrors co-deck's `validate-image-manifest.ts` pattern, zero dependencies): re-reads every file in `projects/<game>/asset-manifest.json` and checks — ERROR: missing/unreadable file, duplicate content (same SHA-256 under two ids), path escaping the project dir, unknown asset type, spritesheet frame-math mismatch vs actual PNG IHDR dimensions; WARN: missing `content_hash`, audio in a browser-unplayable format. Exit 0 pass / 1 errors (warnings never fail). | `bun scripts/co-game/validate-asset-manifest.ts --workspace projects/<game> [--root <path>]` |
