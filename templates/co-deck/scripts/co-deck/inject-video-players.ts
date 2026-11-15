#!/usr/bin/env bun
// @version 1.3.1
// v1.3.1 (U-20261115-001): deck-relative local video bindings
//          ("videoLocal": "../assets/videos/yt-<id>.mp4", the asset-pool
//          convention) no longer double-navigate — they resolve against the
//          DECK dir instead of being joined onto --assets-dir (the old code
//          produced <deck>/../assets/videos/../assets/videos/… and missed the
//          pool). Resolution order: absolute as-is; "../"-forms → deck dir
//          first, --assets-dir second; bare/other-relative forms → --assets-dir
//          first, deck dir second; the first EXISTING candidate wins (the
//          primary is kept when nothing exists, so the warning names it).
//          The default (no videoLocal) and the subs discovery are unchanged.
// v1.3.0 (subtitle-selection regression restore): if sidecar subtitles exist at
// <assets-dir>/subs/yt-<videoId>.<lang>.vtt (lang = ko|en) for a slide's video,
// they are inlined into the payload (lang/label/vtt map — the pattern proven in
// the 2026-10-ai-era-business-majors deck's project-local inject-project-ui.ts)
// and a CC selector pill (.cc-lang-selector, z-index 8 — rides above the
// ppt-engine .video-frame z-7 and both stage buttons z-5) is wired per slide:
// click cycles 한국어 → English → OFF (default OFF), tracks attach as blob URLs
// (file:// blocks external VTT fetches) and exactly ONE track is "showing" (or
// zero when OFF), re-asserted at every stable point (addtrack / track load /
// playing / seeked / loadeddata) because Chromium registers TextTracks
// asynchronously. Switching languages or toggling OFF never touches video.src,
// so playback position is preserved by construction. Subtitles apply to the
// local-mp4 mode only — native ppt-engine VideoSlide <video.video-frame>
// elements AND injector-created <video.cdk-video-frame> elements are both
// wired (a childList observer); the YouTube iframe and new-tab fallbacks are
// untouched. No subs files → payload omits the map and the deck behaves
// exactly as v1.2.0.
// v1.2.0 (T-20261110-005, design docs/designs/2026-11-10-co-deck-root-tooling-design.md):
// --slidedata now defaults to <deck dir>/slidedata.json (anchored beside the deck
// HTML instead of the CWD — manual re-runs from the repo root no longer ENOENT);
// a missing slidedata file exits 1 with a named-path error naming the --slidedata
// remedy before any write; and a warn-only stderr warning fires when the deck
// directory contains a project-local injector (inject_*.py|js|mjs|ts) — the
// generic injector does not reproduce project video-slide styling, follow the
// project's documented rebuild order there.
// v1.1.0 (U-20261029-005): the binding loop skips slides the template rendered
// natively as chrome-free video slides (marked data-video="1" by the shared
// ppt-engine VideoSlide component), so the documented re-run-after-every-rebuild
// procedure cannot double-stage a player on decks built from template 0.24.0+.
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
//     --slidedata   slidedata SSOT (default: <deck dir>/slidedata.json — beside the deck
//                   HTML, independent of the CWD; an explicit value keeps CWD semantics)
//     --assets-dir  local video root; videos resolved as <assets-dir>/yt-<videoId>.mp4,
//                   subtitles as <assets-dir>/subs/yt-<videoId>.<lang>.vtt
//                   (default: <deck dir>/../assets/videos)
// Exit codes: 0 = injected (or nothing to do); 1 = fatal (missing input, no video slides).
// A project-local injector in the deck directory (inject_*.py|js|mjs|ts) triggers a
// warn-only stderr WARNING — exit code and output are unchanged.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

interface SlideEntry { videoId?: string; videoLocal?: string }
interface Vid { i: number; id: string; local?: string }
interface SubTrack { lang: string; label: string; vtt: string }

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const htmlPath = process.argv[2];
if (!htmlPath || htmlPath.startsWith('--')) {
  console.error('Usage: bun scripts/co-deck/inject-video-players.ts <deck.html> [--slidedata <path>] [--assets-dir <dir>]');
  process.exit(1);
}
const deckDir = dirname(resolve(htmlPath));
// v1.2.0: the default is anchored to the deck HTML's own directory (the deck
// project dir — slidedata.json is a sibling of lecture_vN.html), matching the
// --assets-dir precedent below. An explicit --slidedata keeps CWD semantics.
const slidedataPath = argValue('--slidedata') ?? join(deckDir, 'slidedata.json');
const assetsDir = argValue('--assets-dir') ?? normalize(join(deckDir, '..', 'assets', 'videos'));

// v1.2.0: named-path failure instead of a raw ENOENT stack — exits before any write.
if (!existsSync(slidedataPath)) {
  console.error(`inject-video-players: slidedata not found at ${slidedataPath} (default resolves beside the deck HTML; pass --slidedata <path> to override)`);
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');
const slides: SlideEntry[] = JSON.parse(readFileSync(slidedataPath, 'utf8'));

// v1.2.0: warn-only detection of project-local injectors (non-recursive scan of the
// deck directory). Glob over a known-name list on purpose — a false-positive warning
// on a like-named helper is harmless, a miss would be silent. Never changes the exit
// code or the output file.
const LOCAL_INJECTOR_RE = /^inject_.*players?\.(py|js|mjs|ts)$/i;
const localInjectors = readdirSync(deckDir).filter((name) => LOCAL_INJECTOR_RE.test(name)).sort();
if (localInjectors.length > 0) {
  console.error(
    `WARNING: project-local injector(s) found: ${localInjectors.join(', ')} — its video-slide styling is NOT reproduced by this generic injector; ` +
      `follow the project's documented rebuild order (local injector docstring REBUILD ORDER / project VERSIONS.md) instead. ` +
      `Double-marker hazard: project-video-players and cdk-video-players blocks can coexist on one rebuild.`,
  );
}

const vids: Vid[] = [];
for (let i = 0; i < slides.length; i++) {
  const d = slides[i];
  if (!d?.videoId) continue;
  const local = d.videoLocal ?? join('yt-' + d.videoId + '.mp4');
  // U-20261115-001: deck-relative bindings ("../assets/videos/…", the
  // asset-pool convention) resolve against the DECK dir — the old code joined
  // them onto --assets-dir, double-navigating and missing the pool.
  // Resolution order: absolute as-is; "../"-forms → deck dir first,
  // --assets-dir second; bare/other-relative forms → --assets-dir first, deck
  // dir second; the first EXISTING candidate wins (the primary is kept when
  // nothing exists, so the warning names it).
  const candidates: string[] = [];
  if (isAbsolute(local)) {
    candidates.push(local);
  } else {
    if (local.startsWith('..')) candidates.push(resolve(deckDir, local));
    candidates.push(resolve(assetsDir, local));
    if (!local.startsWith('..')) candidates.push(resolve(deckDir, local));
  }
  const localAbs = candidates.find((c) => existsSync(c)) ?? candidates[0];
  // Deck-relative posix path — the built deck must stay portable across machines.
  const relLocal = existsSync(localAbs) ? relative(deckDir, localAbs).split('\\').join('/') : undefined;
  vids.push({ i, id: d.videoId, local: relLocal });
}
if (vids.length === 0) {
  console.error('inject-video-players: no slides carry videoId — nothing to inject');
  process.exit(1);
}

// v1.3.0: sidecar subtitle discovery — <assets-dir>/subs/yt-<videoId>.<lang>.vtt,
// lang fixed to ko|en (labels 한국어/English; ko listed first when both exist —
// the deck's spoken language is ko and the selector cycle starts at OFF, so
// order only shapes the cycle, never the initial state). Raw VTT text is
// inlined verbatim: the runtime creates blob URLs because file:// pages cannot
// fetch external VTT resources.
const SUB_LANGS: Array<[string, string]> = [['ko', '한국어'], ['en', 'English']];
const subs: Record<number, SubTrack[]> = {};
let subCount = 0;
for (const v of vids) {
  const tracks: SubTrack[] = [];
  for (const [lang, label] of SUB_LANGS) {
    const p = join(assetsDir, 'subs', `yt-${v.id}.${lang}.vtt`);
    if (existsSync(p)) tracks.push({ lang, label, vtt: readFileSync(p, 'utf8') });
  }
  if (tracks.length > 0) {
    subs[v.i] = tracks;
    subCount += tracks.length;
  }
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

// v1.3.0 — the pill CSS is emitted only when at least one sidecar exists, so a
// subtitle-less deck keeps the exact v1.2.0 output shape (dead CSS would be
// harmless, but byte-identical behavior is the cheaper contract to pin).
const SUBS_CSS = subCount > 0
  ? `/* v1.3.0 — CC language selector pill, staged bottom-right over the video.
   z-index 8 rides above the ppt-engine .video-frame (z-7) and both full-slide
   stage buttons (z-5), so it is clickable before playback and stays clickable
   while playing (it lives on the slide element, not on any frame). Scoped to
   .slide (NOT .cdk-video-slide): native ppt-engine VideoSlide slides carry
   class video-slide, not cdk-video-slide, and they are the ones that play
   local mp4s. */
.slide .cc-lang-selector {
  position: absolute; bottom: 1.1rem; right: 1.4rem; z-index: 8;
  display: inline-block;
  background: rgba(11, 15, 25, 0.55);
  color: #fff; font-size: 0.95rem; font-weight: 600; line-height: 1.2;
  padding: 0.4rem 0.95rem; border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(2px);
  cursor: pointer; user-select: none; white-space: nowrap;
  font-family: inherit;
}
.slide .cc-lang-selector:hover { background: rgba(11, 15, 25, 0.75); }
`
  : '';

// v1.3.0 — subtitle runtime segments, emitted only when at least one sidecar
// exists (a subtitle-less deck then keeps the exact v1.2.0 output shape —
// no pill CSS, no subs payload, no wiring code at all).
const SUBS_JS_VARS = subCount > 0
  ? `  // v1.3.0 — slide index -> [{lang,label,vtt}]; absent keys have no sidecar
  // subs and get no pill (deck renders exactly as before).
  var subs = ${JSON.stringify(subs)};
  var OFF_LABEL = "CC: 끔";
  // Per-slide active caption state: a track index, or -1 = OFF. Default OFF
  // (client-confirmed captions-off default on the majors deck; captions come
  // on via the CC pill on demand).
  var activeIdx = {};
  var blobCache = {};
  function activeIdxOf(slideIdx) {
    var v = activeIdx[slideIdx];
    return typeof v === "number" ? v : -1;
  }
  // Exactly ONE track shows (the selected one) or ZERO when OFF. Chromium
  // registers TextTracks asynchronously after <track> insertion, so the
  // policy is re-asserted at every stable point: addtrack, track load,
  // playing, seeked, loadeddata.
  function enforceCaptionModes(video) {
    var want = activeIdxOf(parseInt(video.dataset.cdkSlide, 10));
    var tt = video.textTracks;
    for (var i = 0; i < tt.length; i++) {
      try { tt[i].mode = (want !== -1 && i === want) ? "showing" : "disabled"; } catch (e) {}
    }
  }
  // Set the active state for a slide: persists the index (-1 = OFF), updates
  // the pill label, and flips modes on any existing video element. Never
  // touches video.src — playback position is preserved on switch/toggle.
  function setActive(slideIdx, idx) {
    activeIdx[slideIdx] = idx;
    var el = document.getElementById("slide-" + slideIdx);
    var tracks = subs[slideIdx] || [];
    if (el) {
      var btn = el.querySelector(".cc-lang-selector");
      if (btn) {
        btn.textContent = (idx === -1 || !tracks[idx]) ? OFF_LABEL
          : "CC: " + tracks[idx].label + " \\u25BE";
      }
      el.querySelectorAll("video").forEach(function (v) {
        v.dataset.cdkActive = String(idx);
        enforceCaptionModes(v);
      });
    }
  }
  // Attach caption tracks (blob URLs) to a video element the first time it is
  // seen. Covers BOTH native ppt-engine VideoSlide <video.video-frame>
  // elements and injector-created <video.cdk-video-frame> elements.
  function ensureTracks(video, slideIdx) {
    if (!video || video.dataset.cdkCaptions) return;
    var tracks = subs[slideIdx];
    if (!tracks || !tracks.length) return;
    video.dataset.cdkCaptions = "1";
    video.dataset.cdkSlide = String(slideIdx);
    video.dataset.cdkActive = String(activeIdxOf(slideIdx));
    tracks.forEach(function (t, k) {
      var key = slideIdx + ":" + k;
      if (!blobCache[key]) {
        blobCache[key] = URL.createObjectURL(new Blob([t.vtt], { type: "text/vtt" }));
      }
      var tr = document.createElement("track");
      tr.kind = "captions";
      tr.label = t.label;
      tr.srclang = t.lang;
      tr.src = blobCache[key];
      tr.addEventListener("load", function () { enforceCaptionModes(video); });
      video.appendChild(tr);
    });
    enforceCaptionModes(video);
    if (video.textTracks.addEventListener) {
      video.textTracks.addEventListener("addtrack", function () {
        enforceCaptionModes(video);
      });
    }
    ["playing", "seeked", "loadeddata"].forEach(function (ev) {
      video.addEventListener(ev, function () { enforceCaptionModes(video); });
    });
  }
`
  : '';

const SUBS_JS_INIT = subCount > 0
  ? `    // v1.3.0 — CC pill per subtitle-carrying slide (native and injected slides
    // alike). Click cycles tracks then OFF: ko → en → 끔 → ko (payload order);
    // starting from -1, (+1) mod (n+1) lands on track 0, and OFF is always the
    // terminal state right after the last language. stopPropagation keeps the
    // full-slide play affordance from firing.
    Object.keys(subs).forEach(function (k) {
      var i = parseInt(k, 10);
      var el = document.getElementById("slide-" + i);
      if (!el || el.dataset.cdkSubsBound) return;
      el.dataset.cdkSubsBound = "1";
      activeIdx[i] = -1;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-lang-selector";
      btn.setAttribute("aria-label", "subtitle language");
      btn.textContent = OFF_LABEL;
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var n = subs[i].length + 1;
        var next = (activeIdxOf(i) + 1) % n;
        setActive(i, next === subs[i].length ? -1 : next);
      });
      el.appendChild(btn);
    });
    var subsTarget = document.getElementById("presentation") || document.body;
    // v1.3.0 — wire caption tracks onto any <video> that appears inside a
    // subtitle-carrying slide (VideoSlide.play / injector stage click create
    // it on demand; autoplay race is fine — cues load from the in-memory blob
    // within a frame or two).
    new MutationObserver(function () {
      Object.keys(subs).forEach(function (k) {
        var i = parseInt(k, 10);
        var el = document.getElementById("slide-" + i);
        if (!el) return;
        el.querySelectorAll("video").forEach(function (v) { ensureTracks(v, i); });
      });
    }).observe(subsTarget, { childList: true, subtree: true });
`
  : '';

const injection = `<style id="cdk-video-players">
.cdk-video-stage { position: absolute; inset: 0; z-index: 5; background: transparent; border: 0; cursor: pointer; }
.cdk-video-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: none; background: #000; }
.cdk-video-slide.playing .cdk-video-frame { display: block; }
.cdk-video-slide.playing .cdk-video-stage { display: none; }
${SUBS_CSS}</style>
<script id="cdk-video-players-js">
(function () {
  var vids = ${JSON.stringify(vids.map((v) => ({ i: v.i, id: v.id, local: v.local ?? undefined })))};
${SUBS_JS_VARS}  function init() {
    vids.forEach(function (v) {
      var el = document.getElementById("slide-" + v.i);
      if (!el || el.dataset.videoBound) return;
      // Native video slide (ppt-engine VideoSlide, data-video="1"): the
      // template already rendered the chrome-free stage — skip to avoid a
      // double player overlay.
      if (el.dataset.video) return;
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
${SUBS_JS_INIT}    var target = document.getElementById("presentation") || document.body;
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
const subNote = subCount > 0 ? `, ${subCount} subtitle track(s) on ${Object.keys(subs).length} slide(s)` : ', no subtitle sidecars found';
console.log(`inject-video-players: injected ${vids.length} video slide(s) (${vids.filter((v) => v.local).length} local, rest YouTube fallback)${subNote} — re-run after every deck rebuild`);
