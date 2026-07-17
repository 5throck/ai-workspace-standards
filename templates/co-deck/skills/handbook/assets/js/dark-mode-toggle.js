/**
 * dark-mode-toggle.js — Dark mode toggle for the Co-Deck Handbook
 *
 * 3-layer strategy:
 *   1. :root          — CSS variables for light mode (default)
 *   2. @media         — Respects OS-level prefers-color-scheme: dark
 *   3. .dark class    — Manual toggle overrides everything
 *
 * Behaviour:
 * - On load: reads localStorage('theme') first, then falls back to
 *   window.matchMedia('(prefers-color-scheme: dark)').
 * - If localStorage contains 'dark', adds `.dark` class to <html>.
 * - Toggle button: click toggles `.dark` class on <html> and persists
 *   the choice to localStorage.
 * - Listens for system preference changes via matchMedia and updates
 *   accordingly (only when no manual preference is stored).
 *
 * HTML contract (injected automatically if not present):
 *   <button id="dark-mode-toggle" class="dark-mode-toggle" title="Toggle dark mode">
 *     <span id="dark-mode-icon">&#9728;&#65039;</span>
 *   </button>
 */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Constants
     ----------------------------------------------------------------------- */
  var STORAGE_KEY    = 'theme';
  var DARK_VALUE     = 'dark';
  var LIGHT_VALUE    = 'light';
  var TOGGLE_ID      = 'dark-mode-toggle';
  var ICON_ID        = 'dark-mode-icon';

  /* -----------------------------------------------------------------------
     DOM references
     ----------------------------------------------------------------------- */
  var htmlEl = document.documentElement;

  // Inject toggle button if it does not already exist
  var toggleBtn = document.getElementById(TOGGLE_ID);
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.id = TOGGLE_ID;
    toggleBtn.className = 'dark-mode-toggle';
    toggleBtn.title = 'Toggle dark mode';
    toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
    toggleBtn.innerHTML = '<span id="' + ICON_ID + '">&#9728;&#65039;</span>';
    document.body.appendChild(toggleBtn);
  }

  var iconEl = document.getElementById(ICON_ID);

  /* -----------------------------------------------------------------------
     Helpers
     ----------------------------------------------------------------------- */

  /**
   * Returns true if the page currently appears dark.
   */
  function isDark() {
    return htmlEl.classList.contains('dark');
  }

  /**
   * Returns the current OS dark preference.
   */
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Update the button icon based on current state.
   * Sun (light) = currently light mode (clicking will go dark)
   * Moon (dark) = currently dark mode (clicking will go light)
   */
  function updateIcon() {
    if (iconEl) {
      iconEl.textContent = isDark() ? '\uD83C\uDF19' : '\u2600\uFE0F'; // moon : sun
    }
  }

  /**
   * Apply a theme to the document.
   * @param {'dark'|'light'} theme
   * @param {boolean} persist  — whether to save to localStorage
   */
  function applyTheme(theme, persist) {
    if (theme === DARK_VALUE) {
      htmlEl.classList.add('dark');
    } else {
      htmlEl.classList.remove('dark');
    }
    updateIcon();

    if (persist !== false) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }

  /* -----------------------------------------------------------------------
     Initialisation — determine the starting theme
     ----------------------------------------------------------------------- */

  (function init() {
    var stored = localStorage.getItem(STORAGE_KEY);

    if (stored === DARK_VALUE) {
      // Manual preference: dark
      applyTheme(DARK_VALUE, false);
    } else if (stored === LIGHT_VALUE) {
      // Manual preference: light (even if OS is dark)
      applyTheme(LIGHT_VALUE, false);
    } else {
      // No manual preference — follow system
      var systemDark = systemPrefersDark();
      applyTheme(systemDark ? DARK_VALUE : LIGHT_VALUE, false);
    }
  })();

  /* -----------------------------------------------------------------------
     Toggle button click
     ----------------------------------------------------------------------- */

  toggleBtn.addEventListener('click', function () {
    var nextTheme = isDark() ? LIGHT_VALUE : DARK_VALUE;
    applyTheme(nextTheme, true);
  });

  /* -----------------------------------------------------------------------
     Listen for OS-level preference changes
     Only applies when no manual preference is stored in localStorage.
     ----------------------------------------------------------------------- */

  if (window.matchMedia) {
    var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Modern browsers (Chrome 121+, Firefox 126+, Safari 17.4+)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', function (e) {
        // Only follow system when user has not set a manual preference
        var stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          applyTheme(e.matches ? DARK_VALUE : LIGHT_VALUE, false);
        }
      });
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(function (e) {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          applyTheme(e.matches ? DARK_VALUE : LIGHT_VALUE, false);
        }
      });
    }
  }

})();
