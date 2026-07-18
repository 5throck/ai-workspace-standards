/**
 * site-search.js — Client-side site search for the Co-Deck Handbook
 *
 * Features:
 * - Lazy DOMParser-based live indexing: fetches and parses all DOCS on first
 *   search focus, extracting h2[id] sections, h3 items, and .scenario-card
 *   scenarios. Always stays in sync with the actual page content.
 * - Scored search with exact-match, starts-with, contains, and
 *   section-contains ranking (capped at SEARCH_CONFIG.maxResults).
 * - Renders clickable result links with <mark> highlighting and context
 *   snippets; each link carries ?q= so the target page auto-applies the query.
 * - Keyboard shortcut: Ctrl+K (Windows/Linux) or Cmd+K (macOS) focuses input.
 * - Focus-based arrow keyboard navigation within results.
 * - DOM injection fallback: if #site-search-input is absent, injects the
 *   search bar before the first element matching SEARCH_CONFIG.fallbackContainer.
 *
 * HTML contract (preferred — when present the script uses these elements):
 *   <div class="search-bar">
 *     <span class="search-icon">&#128269;</span>
 *     <input id="site-search-input" type="text" placeholder="Search handbook..." autocomplete="off" />
 *     <span class="search-shortcut">Ctrl+K</span>
 *     <div id="site-search-results" class="search-results"></div>
 *   </div>
 */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Configuration — tune these without touching the logic below.
     ----------------------------------------------------------------------- */
  var SEARCH_CONFIG = {
    selectors: ['h2[id]', 'h3', '.scenario-card[id]'],
    maxResults: 12,
    buildingMessage: 'Building index\u2026',
    fallbackContainer: '.group'
  };

  /* -----------------------------------------------------------------------
     Document index — populate this array with your chapter metadata.
     Each entry must have at least `title` and `url`.  On first focus the
     script fetches each URL, parses it with DOMParser, and builds a flat
     searchable index of headings and scenario cards.
     ----------------------------------------------------------------------- */
  const DOCS = []; // Populate with chapter paths, e.g.:
  // { title: 'Chapter 1 — Getting Started', url: 'chapter_01.html' },
  // { title: 'Chapter 2 — Core Concepts',   url: 'chapter_02.html' },

  /* -----------------------------------------------------------------------
     UI labels — shown in the injected search bar and result messages.
     ----------------------------------------------------------------------- */
  var LABELS = {
    placeholder: 'Search handbook\u2026',
    section: 'Section',
    scenario: 'Scenario',
    item: 'Item',
    noResult: 'No results found.',
    building: SEARCH_CONFIG.buildingMessage,
    hint: function (n) { return n + ' documents searched \u2014 navigates to exact position.'; }
  };

  /* -----------------------------------------------------------------------
     Helpers
     ----------------------------------------------------------------------- */
  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  function strip(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  /** DOM-based HTML entity escaping (safe against injection). */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Build a plain-text snippet around the first occurrence of `query`.
   */
  function buildSnippet(text, query, maxLen) {
    var lower = text.toLowerCase();
    var idx   = lower.indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '...' : '');

    var start = Math.max(0, idx - 40);
    var end   = Math.min(text.length, idx + query.length + 80);
    var snippet = '';
    if (start > 0) snippet += '...';
    snippet += text.slice(start, end);
    if (end < text.length) snippet += '...';
    return snippet;
  }

  /**
   * Wrap matched portion of text in a <mark> tag for visual emphasis.
   */
  function highlightMatch(text, query) {
    var regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
  }

  /* -----------------------------------------------------------------------
     DOM references — try to find existing markup; fall back to injection.
     ----------------------------------------------------------------------- */
  var inputEl   = document.getElementById('site-search-input');
  var resultsEl = document.getElementById('site-search-results');
  var wrapEl    = document.querySelector('.search-bar') || null;
  var injected  = false;

  if (!inputEl || !resultsEl) {
    // Fallback: inject search bar before the first matching container
    var container = document.querySelector(SEARCH_CONFIG.fallbackContainer);
    if (container) {
      // Inline styles for the injected bar (co-deck CSS classes where possible)
      var style = document.createElement('style');
      style.textContent =
        '.search-bar{margin:0 0 40px;position:relative;display:flex;align-items:center;gap:8px;}' +
        '.search-bar .search-icon{font-size:16px;color:var(--text-dim,#636c76);flex-shrink:0;}' +
        '.search-bar input{flex:1;padding:10px 14px;font-size:15px;border:1px solid var(--border,#d0d7de);border-radius:10px;background:var(--bg,#fff);color:var(--text,#1f2328);outline:none;}' +
        '.search-bar input:focus{border-color:var(--accent,#0969da);box-shadow:0 0 0 3px rgba(9,105,218,.12);}' +
        '.search-bar .search-shortcut{font-size:12px;color:var(--text-dim,#636c76);flex-shrink:0;}' +
        '.search-results{position:absolute;left:0;right:0;top:calc(100% + 6px);background:var(--bg,#fff);border:1px solid var(--border,#d0d7de);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.12);max-height:62vh;overflow-y:auto;z-index:30;display:none;}' +
        '.search-results.show{display:block;}';
      document.head.appendChild(style);

      var wrap = document.createElement('div');
      wrap.className = 'search-bar';
      wrap.innerHTML =
        '<span class="search-icon">\u{1F50D}</span>' +
        '<input id="site-search-input" type="text" placeholder="' + LABELS.placeholder + '" autocomplete="off" aria-label="' + LABELS.placeholder + '" />' +
        '<span class="search-shortcut">Ctrl+K</span>' +
        '<div id="site-search-results" class="search-results"></div>';
      container.parentNode.insertBefore(wrap, container);

      inputEl   = document.getElementById('site-search-input');
      resultsEl = document.getElementById('site-search-results');
      wrapEl    = wrap;
      injected  = true;
    }
  }

  // Graceful exit if we still have no elements after injection attempt
  if (!inputEl || !resultsEl) return;

  /* -----------------------------------------------------------------------
     DOMParser-based indexing — fetches and parses each document on first
     focus to build a flat searchable array.
     ----------------------------------------------------------------------- */
  var index    = null;   // flat array of index entries once built
  var building = false;  // guard against concurrent builds

  /**
   * Parse a single document's HTML into an array of index entries.
   * Uses SEARCH_CONFIG.selectors for configurability.
   */
  function parseDoc(doc, html) {
    var d    = new DOMParser().parseFromString(html, 'text/html');
    var main = d.querySelector('main') || d.body;
    var out  = [], curId = '', curTitle = '';
    var nodes = main.querySelectorAll(SEARCH_CONFIG.selectors.join(', '));

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.tagName === 'H2') {
        curId    = el.id;
        curTitle = strip(el.textContent);
        out.push({ doc: doc, id: curId, heading: curTitle, section: curTitle, type: LABELS.section });
      } else if (el.classList && el.classList.contains('scenario-card')) {
        var ti = el.querySelector('strong');
        var lv = el.querySelector('span');
        out.push({
          doc: doc, id: el.id,
          heading: ti ? strip(ti.textContent) : el.id,
          section: lv ? strip(lv.textContent) : '',
          type: el.getAttribute('data-kind') || LABELS.scenario
        });
      } else {
        // h3 — prefer <code> text if present (e.g. command names)
        var code = el.querySelector('code');
        out.push({
          doc: doc, id: curId,
          heading: code ? strip(code.textContent) : strip(el.textContent),
          section: curTitle, type: LABELS.item
        });
      }
    }
    return out;
  }

  /**
   * Lazy index builder — fetches ALL DOCS, parses them, and flattens
   * into a single scored-ready index.  Called on first search focus.
   */
  function buildIndex() {
    if (index || building) return;
    building = true;
    resultsEl.innerHTML = '<div style="padding:12px 16px;color:var(--text-dim,#636c76);font-size:14px;">' + LABELS.building + '</div>';
    resultsEl.classList.add('show');

    Promise.all(DOCS.map(function (doc) {
      return fetch(doc.url)
        .then(function (r) { return r.text(); })
        .then(function (html) { return parseDoc(doc, html); })
        .catch(function () { return []; });
    })).then(function (all) {
      index = Array.prototype.concat.apply([], all);
      building = false;
      // Re-run search if user already typed something
      if (inputEl.value.trim()) search(inputEl.value);
      else resultsEl.classList.remove('show');
    });
  }

  /* -----------------------------------------------------------------------
     Scoring system — ranks results by match quality.
       0 = exact heading match (best)
       1 = heading starts with query
       2 = heading contains query
       3 = section title contains query
      -1 = no match (filtered out)
     ----------------------------------------------------------------------- */
  function score(entry, q) {
    var h = entry.heading.toLowerCase();
    if (h === q)                        return 0;
    if (h.indexOf(q) === 0)              return 1;
    if (h.indexOf(q) >= 0)               return 2;
    if (entry.section.toLowerCase().indexOf(q) >= 0) return 3;
    return -1;
  }

  /* -----------------------------------------------------------------------
     Search logic — case-insensitive scored search against the live index
     ----------------------------------------------------------------------- */
  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) {
      resultsEl.innerHTML = '';
      resultsEl.classList.remove('show');
      return;
    }
    if (!index) { buildIndex(); return; }

    var scored = [];
    for (var i = 0; i < index.length; i++) {
      var s = score(index[i], q);
      if (s >= 0) scored.push({ entry: index[i], s: s, order: i });
    }
    scored.sort(function (a, b) { return a.s - b.s || a.order - b.order; });

    var results = scored.slice(0, SEARCH_CONFIG.maxResults);
    renderResults(results, q, query.trim());
  }

  /* -----------------------------------------------------------------------
     Render results as clickable links with highlighting and ?q= param
     ----------------------------------------------------------------------- */
  function renderResults(scoredResults, q, rawQuery) {
    if (scoredResults.length === 0) {
      resultsEl.innerHTML = '<div style="padding:12px 16px;color:var(--text-dim,#636c76);font-size:14px;">' + LABELS.noResult + '</div>';
      resultsEl.classList.add('show');
      return;
    }

    var html = scoredResults.map(function (item) {
      var e    = item.entry;
      var href = e.doc.url + '?q=' + encodeURIComponent(rawQuery) + (e.id ? '#' + e.id : '');
      // Build a context snippet from the section or heading
      var snippetText = e.section || e.heading;
      var snippet = buildSnippet(snippetText, q, 120);
      return (
        '<a href="' + escapeHtml(href) + '">' +
          '<div class="result-title">' + highlightMatch(e.heading, q) + '</div>' +
          '<div class="result-snippet">' + escapeHtml(e.doc.title) +
            (e.section ? ' \u203A ' + escapeHtml(e.section) : '') +
            ' \xB7 ' + escapeHtml(e.type) + '</div>' +
        '</a>'
      );
    }).join('');

    resultsEl.innerHTML = html;
    resultsEl.classList.add('show');
  }

  /* -----------------------------------------------------------------------
     Event listeners
     ----------------------------------------------------------------------- */

  // Build index on first focus
  inputEl.addEventListener('focus', buildIndex);

  // Debounced search on each keystroke
  inputEl.addEventListener('input', debounce(function () {
    search(inputEl.value);
  }, 200));

  // Keyboard handling on the input
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      inputEl.value = '';
      resultsEl.innerHTML = '';
      resultsEl.classList.remove('show');
      inputEl.blur();
    }
    // Arrow-down moves focus into the first result link
    if (e.key === 'ArrowDown' && resultsEl.firstElementChild) {
      e.preventDefault();
      var firstLink = resultsEl.querySelector('a');
      if (firstLink) firstLink.focus();
    }
  });

  // Close results when clicking outside the search bar
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-bar')) {
      resultsEl.innerHTML = '';
      resultsEl.classList.remove('show');
    }
  });

  // Allow navigation within results with arrow keys (focus-based, co-deck style)
  resultsEl.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var links   = Array.from(resultsEl.querySelectorAll('a'));
      var current = links.indexOf(document.activeElement);
      var next;
      if (e.key === 'ArrowDown') {
        next = current < links.length - 1 ? current + 1 : 0;
      } else {
        next = current > 0 ? current - 1 : links.length - 1;
      }
      links[next].focus();
    }
    if (e.key === 'Escape') {
      inputEl.focus();
    }
  });

  /* -----------------------------------------------------------------------
     Keyboard shortcut: Ctrl+K / Cmd+K focuses the search input
     ----------------------------------------------------------------------- */
  document.addEventListener('keydown', function (e) {
    var modifier = e.ctrlKey || e.metaKey;
    if (modifier && e.key === 'k') {
      e.preventDefault();
      inputEl.focus();
      inputEl.select();
    }
  });

})();
