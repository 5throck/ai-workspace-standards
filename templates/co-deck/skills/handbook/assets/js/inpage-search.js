/**
 * inpage-search.js — In-page Ctrl+F replacement for the Co-Deck Handbook
 *
 * Features:
 * - Highlights all matching text fragments within the current page content
 * - Next / Previous navigation through matches
 * - Match count display (e.g., "3 of 15")
 * - Clear all highlights on close or empty query
 *
 * HTML contract (injected automatically if not present):
 *   <div id="inpage-search-bar" class="inpage-search-bar" style="display:none;">
 *     <input id="inpage-search-input" type="text" placeholder="Find in page..." />
 *     <button class="inpage-btn" id="inpage-prev" title="Previous match">&#9650;</button>
 *     <button class="inpage-btn" id="inpage-next" title="Next match">&#9660;</button>
 *     <span class="match-count" id="inpage-match-count"></span>
 *     <button class="inpage-btn" id="inpage-close" title="Close">&times;</button>
 *   </div>
 *
 * Keyboard shortcut: Ctrl+F (custom override — prevents browser default)
 */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Configuration
     ----------------------------------------------------------------------- */
  const CONTENT_SELECTOR  = '.content';           // Scope search to this element
  const HIGHLIGHT_CLASS   = 'inpage-search-highlight';
  const ACTIVE_CLASS      = 'active';
  const DEBOUNCE_MS       = 150;

  /* -----------------------------------------------------------------------
     State
     ----------------------------------------------------------------------- */
  let matches        = [];    // NodeList of current highlight spans
  let activeIndex    = -1;    // Index of the currently active match
  let originalHTML   = null;  // Cache of original innerHTML for clean restore

  /* -----------------------------------------------------------------------
     DOM references
     ----------------------------------------------------------------------- */
  const contentEl = document.querySelector(CONTENT_SELECTOR);
  if (!contentEl) return; // Nothing to search

  // Inject toolbar if it does not already exist in the DOM
  let toolbar = document.getElementById('inpage-search-bar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'inpage-search-bar';
    toolbar.className = 'inpage-search-bar';
    toolbar.style.display = 'none';
    toolbar.innerHTML =
      '<input id="inpage-search-input" type="text" placeholder="Find in page..." />' +
      '<button class="inpage-btn" id="inpage-prev" title="Previous match">&#9650;</button>' +
      '<button class="inpage-btn" id="inpage-next" title="Next match">&#9660;</button>' +
      '<span class="match-count" id="inpage-match-count"></span>' +
      '<button class="inpage-btn" id="inpage-close" title="Close">&times;</button>';
    document.body.appendChild(toolbar);
  }

  const inputEl     = document.getElementById('inpage-search-input');
  const prevBtn     = document.getElementById('inpage-prev');
  const nextBtn     = document.getElementById('inpage-next');
  const countEl     = document.getElementById('inpage-match-count');
  const closeBtn    = document.getElementById('inpage-close');

  /* -----------------------------------------------------------------------
     Debounce utility
     ----------------------------------------------------------------------- */
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /* -----------------------------------------------------------------------
     Highlight engine — wraps text matches in <span> elements
     ----------------------------------------------------------------------- */

  /**
   * Walks text nodes inside `root` and wraps matching portions in
   * <span class="inpage-search-highlight">.
   */
  function highlightText(root, query) {
    clearHighlights(root); // Start from clean state

    if (!query) return 0;

    // Escape regex special characters in the query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escapedQuery + ')', 'gi');

    let count = 0;

    // TreeWalker finds only text nodes, rejecting SCRIPT/STYLE, already-highlighted
    // spans, and SVG-namespace nodes (wrapping matches would corrupt inline SVG
    // diagrams). Adapted from the multi-agent-harness-handbook inpage-search.js.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE')) return NodeFilter.FILTER_REJECT;
        // Reject already-highlighted nodes (target wraps matches in <span class="HIGHLIGHT_CLASS">)
        if (p && p.classList && p.classList.contains(HIGHLIGHT_CLASS)) return NodeFilter.FILTER_REJECT;
        // SVG protection: wrapping matches would corrupt inline SVG <text> elements
        if (p && p.namespaceURI === 'http://www.w3.org/2000/svg') return NodeFilter.FILTER_REJECT;
        regex.lastIndex = 0;
        return regex.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }, false);
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach(function (textNode) {
      const text = textNode.nodeValue;
      if (!regex.test(text)) return;
      regex.lastIndex = 0; // Reset after test

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        // Text before the match
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        // Highlighted match
        const span = document.createElement('span');
        span.className = HIGHLIGHT_CLASS;
        span.appendChild(document.createTextNode(match[1]));
        fragment.appendChild(span);
        count++;
        lastIndex = regex.lastIndex;
      }

      // Remaining text after the last match
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    return count;
  }

  /**
   * Remove all highlight spans and restore original text nodes.
   */
  function clearHighlights(root) {
    const highlights = root.querySelectorAll('.' + HIGHLIGHT_CLASS);
    highlights.forEach(function (span) {
      const parent = span.parentNode;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize(); // Merge adjacent text nodes
    });
  }

  /* -----------------------------------------------------------------------
     Match navigation
     ----------------------------------------------------------------------- */

  function refreshMatches() {
    matches = contentEl.querySelectorAll('.' + HIGHLIGHT_CLASS);
    activeIndex = -1;
    updateCountDisplay();
  }

  function goToMatch(index) {
    if (matches.length === 0) return;

    // Remove active from previous
    if (activeIndex >= 0 && activeIndex < matches.length) {
      matches[activeIndex].classList.remove(ACTIVE_CLASS);
    }

    // Wrap around
    if (index >= matches.length) index = 0;
    if (index < 0) index = matches.length - 1;

    activeIndex = index;
    matches[activeIndex].classList.add(ACTIVE_CLASS);
    matches[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });

    updateCountDisplay();
  }

  function updateCountDisplay() {
    if (matches.length === 0) {
      countEl.textContent = '0 results';
    } else {
      countEl.textContent = (activeIndex + 1) + ' of ' + matches.length;
    }
  }

  /* -----------------------------------------------------------------------
     Toolbar show / hide
     ----------------------------------------------------------------------- */

  function openToolbar() {
    toolbar.style.display = 'flex';
    inputEl.focus();
    inputEl.select();
  }

  function closeToolbar() {
    toolbar.style.display = 'none';
    clearHighlights(contentEl);
    matches = [];
    activeIndex = -1;
    inputEl.value = '';
    countEl.textContent = '';
  }

  /* -----------------------------------------------------------------------
     Event listeners
     ----------------------------------------------------------------------- */

  // Debounced highlight on input
  inputEl.addEventListener('input', debounce(function () {
    const query = inputEl.value.trim();
    if (!query) {
      clearHighlights(contentEl);
      matches = [];
      activeIndex = -1;
      countEl.textContent = '';
      return;
    }

    // Cache original HTML on first meaningful search for clean restore
    if (!originalHTML) {
      originalHTML = contentEl.innerHTML;
    }

    highlightText(contentEl, query);
    refreshMatches();

    // Auto-activate the first match
    if (matches.length > 0) {
      goToMatch(0);
    }
  }, DEBOUNCE_MS));

  // Next / Previous buttons
  nextBtn.addEventListener('click', function () {
    goToMatch(activeIndex + 1);
  });

  prevBtn.addEventListener('click', function () {
    goToMatch(activeIndex - 1);
  });

  // Close button
  closeBtn.addEventListener('click', closeToolbar);

  // Keyboard navigation inside the toolbar
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToMatch(activeIndex - 1);
      } else {
        goToMatch(activeIndex + 1);
      }
    }
    if (e.key === 'Escape') {
      closeToolbar();
    }
  });

  /* -----------------------------------------------------------------------
     Keyboard shortcut: Ctrl+F opens the in-page search bar
     Prevents the browser's native find dialog.
     ----------------------------------------------------------------------- */
  document.addEventListener('keydown', function (e) {
    const modifier = e.ctrlKey || e.metaKey;
    if (modifier && e.key === 'f') {
      e.preventDefault();
      openToolbar();
    }
  });

  /* -----------------------------------------------------------------------
     ?q= bridge — opened from site-search.js result links
     When the page is opened with ?q=<term> in the URL, open the toolbar,
     pre-fill the term, and trigger the debounced search. If the URL also
     has a hash, skip auto-search so the browser's hash scroll takes priority.
     ----------------------------------------------------------------------- */
  var initialQuery = new URLSearchParams(window.location.search).get('q');
  if (initialQuery) {
    openToolbar();
    inputEl.value = initialQuery;
    if (!window.location.hash) {
      inputEl.dispatchEvent(new Event('input'));
    }
  }

})();
