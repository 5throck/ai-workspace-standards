/**
 * site-search.js — Client-side site search for the Co-Deck Handbook
 *
 * Features:
 * - Searches the DOCS index by title and content snippet
 * - Renders clickable result links in a dropdown
 * - Keyboard shortcut: Ctrl+K (Windows/Linux) or Cmd+K (macOS) focuses the input
 * - Debounced input handling to avoid excessive filtering
 * - Escape clears and blurs the search
 *
 * HTML contract (must exist in the page):
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
     Document index — populate this array with your chapter metadata.
     Each entry must have at least `title` and `url`. Optional `content`
     provides a plain-text snippet for full-text matching.
     ----------------------------------------------------------------------- */
  const DOCS = []; // Populate with chapter paths, e.g.:
  // { title: 'Chapter 1 — Getting Started', url: 'chapter_01.html', content: 'Introduction to the co-deck handbook...' },
  // { title: 'Chapter 2 — Core Concepts',   url: 'chapter_02.html', content: 'Understanding agents, skills, and scripts...' },

  /* -----------------------------------------------------------------------
     DOM references
     ----------------------------------------------------------------------- */
  const inputEl    = document.getElementById('site-search-input');
  const resultsEl  = document.getElementById('site-search-results');

  // Graceful exit if the search bar markup is not present
  if (!inputEl || !resultsEl) return;

  /* -----------------------------------------------------------------------
     Debounce utility — waits `delay` ms after the last keystroke
     ----------------------------------------------------------------------- */
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /* -----------------------------------------------------------------------
     Search logic — case-insensitive match against title and content
     ----------------------------------------------------------------------- */
  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q || DOCS.length === 0) {
      resultsEl.innerHTML = '';
      return;
    }

    const results = DOCS.filter(function (doc) {
      const titleMatch   = doc.title.toLowerCase().includes(q);
      const contentMatch = doc.content && doc.content.toLowerCase().includes(q);
      return titleMatch || contentMatch;
    });

    renderResults(results, q);
  }

  /* -----------------------------------------------------------------------
     Render results as clickable links
     ----------------------------------------------------------------------- */
  function renderResults(results, query) {
    if (results.length === 0) {
      resultsEl.innerHTML = '<div style="padding:12px 16px;color:var(--text-dim);font-size:14px;">No results found.</div>';
      return;
    }

    const html = results.map(function (doc) {
      // Extract a short snippet around the first match
      const snippet = buildSnippet(doc.content || doc.title, query, 120);
      return (
        '<a href="' + escapeHtml(doc.url) + '">' +
          '<div class="result-title">' + highlightMatch(doc.title, query) + '</div>' +
          '<div class="result-snippet">' + escapeHtml(snippet) + '</div>' +
        '</a>'
      );
    }).join('');

    resultsEl.innerHTML = html;
  }

  /* -----------------------------------------------------------------------
     Helpers
     ----------------------------------------------------------------------- */

  /**
   * Build a plain-text snippet around the first occurrence of `query`.
   */
  function buildSnippet(text, query, maxLen) {
    const lower = text.toLowerCase();
    const idx   = lower.indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '...' : '');

    const start = Math.max(0, idx - 40);
    const end   = Math.min(text.length, idx + query.length + 80);
    let snippet = '';
    if (start > 0) snippet += '...';
    snippet += text.slice(start, end);
    if (end < text.length) snippet += '...';
    return snippet;
  }

  /**
   * Wrap matched portion of text in a <mark> tag for visual emphasis.
   */
  function highlightMatch(text, query) {
    const regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* -----------------------------------------------------------------------
     Event listeners
     ----------------------------------------------------------------------- */

  // Debounced search on each keystroke
  inputEl.addEventListener('input', debounce(function () {
    search(inputEl.value);
  }, 200));

  // Escape clears the search and blurs the input
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      inputEl.value = '';
      resultsEl.innerHTML = '';
      inputEl.blur();
    }
    // Arrow-down moves focus into the first result link
    if (e.key === 'ArrowDown' && resultsEl.firstElementChild) {
      e.preventDefault();
      const firstLink = resultsEl.querySelector('a');
      if (firstLink) firstLink.focus();
    }
  });

  // Close results when clicking outside the search bar
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-bar')) {
      resultsEl.innerHTML = '';
    }
  });

  // Allow navigation within results with arrow keys
  resultsEl.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const links    = Array.from(resultsEl.querySelectorAll('a'));
      const current  = links.indexOf(document.activeElement);
      let next;
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
    const modifier = e.ctrlKey || e.metaKey;
    if (modifier && e.key === 'k') {
      e.preventDefault();
      inputEl.focus();
      inputEl.select();
    }
  });

})();
