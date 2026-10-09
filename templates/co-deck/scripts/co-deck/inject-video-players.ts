#!/usr/bin/env bun
// @version 1.0.0
// inject-video-players.ts — post-build video player injection for built lecture decks.
//
// Generalized from the 2026-10-ai-industry-research engagement's inject_video_players.py
// (T-20261007-008, design docs/designs/2026-10-09-co-deck-injector-promotion-design.md):
// the pattern is template-grade, the engagement copy is not (theme-hardcoded CSS,
// deck-specific selectors, per-deck extras). ADR-0036: template tooling is TypeScript.
//
// Contract (lecture-deck-production procedure, ADR-0002):
//   1. IDEMPOTENT — a previous injection (marker block) is stripped before re-injection;
//      rebuild + re-run is always safe. Re-run after every build-theme-deck.ts rebuild.
//   2. Triple play-mode fallback per video: local mp4 -> inline YouTube iframe (http/s)
//      -> new-tab watch URL (file:// dodges YouTube embed error 153).
//   3. Stop-on-slide-change — a MutationObserver removes playing frames when the active
//      slide moves (the v4 stale-index defect class). Re-run + `node --check` on injected
//      script blocks is the procedure gate.
//
// Usage:
//   bun scripts/co-deck/inject-video-players.ts <deck.html> [--slidedata <path>] [--assets-dir <dir>]
//     --slidedata   slidedata SSOT (default: ./slidedata.json)
//     --assets-dir  local video root; videos resolved as <assets-dir>/yt-<videoId>.mp4
//                   (default: <deck dir>/../assets/videos)
// Exit codes: 0 = injected (or nothing to do); 1 = fatal (missing input, no video slides).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

interface SlideEntry { videoId?: string; videoLocal?: string }
interface Vid { i: number; id: string; local?: string }

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const htmlPath = process.argv[2];
if (!htmlPath || htmlPath.startsWith('--')) {
  console.error('Usage: bun scripts/co-deck/inject-video-players.ts <deck.html> [--slidedata <path>] [--assets-dir <dir>]');
  process.exit(1);
}
const slidedataPath = argValue('--slidedata') ?? 'slidedata.json';
const deckDir = dirname(resolve(htmlPath));
const assetsDir = argValue('--assets-dir') ?? normalize(join(deckDir, '..', 'assets', 'videos'));

const html = readFileSync(htmlPath, 'utf8');
const slides: SlideEntry[] = JSON.parse(readFileSync(slidedataPath, 'utf8'));

const vids: Vid[] = [];
for (let i = 0; i < slides.length; i++) {
  const d = slides[i];
  if (!d?.videoId) continue;
  const local = d.videoLocal ?? join('yt-' + d.videoId + '.mp4');
  const localAbs = isAbsolute(local) ? local : join(assetsDir, local);
  // Deck-relative posix path — the built deck must stay portable across machines.
  const relLocal = existsSync(localAbs) ? relative(deckDir, localAbs).split('\\').join('/') : undefined;
  vids.push({ i, id: d.videoId, local: relLocal });
}
if (vids.length === 0) {
  console.error('inject-video-players: no slides carry videoId — nothing to inject');
  process.exit(1);
}

// Idempotent strip: remove any previous injection block (style marker .. </body>).
const MARKER = '<style id="cdk-video-players">';
let clean = html;
if (clean.includes(MARKER)) {
  clean = clean.replace(/<style id="cdk-video-players">[\s\S]*?<\/script>\s*<\/body>/, '</body>');
}
if (!clean.includes('</body>')) {
  console.error('inject-video-players: input has no </body> — not a built deck HTML');
  process.exit(1);
}

const injection = `<style id="cdk-video-players">
.cdk-video-stage { position: absolute; inset: 0; z-index: 5; background: transparent; border: 0; cursor: pointer; }
.cdk-video-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: none; background: #000; }
.cdk-video-slide.playing .cdk-video-frame { display: block; }
.cdk-video-slide.playing .cdk-video-stage { display: none; }
</style>
<script id="cdk-video-players-js">
(function () {
  var vids = ${JSON.stringify(vids.map((v) => ({ i: v.i, id: v.id, local: v.local ?? undefined })))};
  function init() {
    vids.forEach(function (v) {
      var el = document.getElementById("slide-" + v.i);
      if (!el || el.dataset.videoBound) return;
      el.dataset.videoBound = "1";
      el.classList.add("cdk-video-slide");
      var btn = document.createElement("button");
      btn.className = "cdk-video-stage";
      btn.setAttribute("aria-label", "Play video");
      btn.addEventListener("click", function () {
        if (v.local) {
          var vEl = document.createElement("video");
          vEl.className = "cdk-video-frame";
          vEl.src = v.local;
          vEl.controls = true;
          vEl.autoplay = true;
          vEl.setAttribute("playsinline", "");
          el.appendChild(vEl);
          el.classList.add("playing");
          vEl.play().catch(function () {});
          return;
        }
        var src = "https://www.youtube.com/embed/" + v.id + "?autoplay=1&rel=0&playsinline=1";
        if (location.protocol === "http:" || location.protocol === "https:") {
          src += "&origin=" + location.origin;
          var f = document.createElement("iframe");
          f.className = "cdk-video-frame";
          f.src = src;
          f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
          f.allowFullscreen = true;
          f.setAttribute("allowfullscreen", "");
          el.appendChild(f);
          el.classList.add("playing");
        } else {
          window.open("https://www.youtube.com/watch?v=" + v.id, "_blank");
        }
      });
      el.appendChild(btn);
    });
    var target = document.getElementById("presentation") || document.body;
    new MutationObserver(function () {
      document.querySelectorAll(".cdk-video-slide.playing").forEach(function (el) {
        if (!el.classList.contains("active")) {
          el.querySelector("iframe.cdk-video-frame")?.remove();
          var v = el.querySelector("video.cdk-video-frame");
          if (v) { try { v.pause(); } catch (e) {} v.removeAttribute("src"); v.load(); v.remove(); }
          el.classList.remove("playing");
        }
      });
    }).observe(target, { attributes: true, attributeFilter: ["class"], subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
</script>
</body>`;

const outDir = dirname(htmlPath);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(htmlPath, clean.replace('</body>', injection));
console.log(`inject-video-players: injected ${vids.length} video slide(s) (${vids.filter((v) => v.local).length} local, rest YouTube fallback) — re-run after every deck rebuild`);
