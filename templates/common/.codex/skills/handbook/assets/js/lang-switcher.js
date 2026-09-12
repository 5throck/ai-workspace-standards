/**
 * lang-switcher.js — Language switcher for the Co-Deck Handbook
 *
 * AI-friendly filename convention:
 *   Base file:     chapter_01.html          (default language)
 *   Korean:        chapter_01_ko.html
 *   English:       chapter_01_en.html
 *   Japanese:      chapter_01_ja.html
 *   ...etc.
 *
 * Behaviour:
 * - On load: reads localStorage('lang') for a saved preference.
 * - Parses the current filename to extract the base name.
 * - Renders a <select> dropdown with available language variants.
 *   If a variant file exists (detected or declared), navigating to it
 *   switches the language while staying on the same chapter.
 * - The selected language is persisted in localStorage for the
 *   next page load.
 *
 * HTML contract (injected automatically if not present):
 *   <div id="lang-switcher" class="lang-switcher">
 *     <label for="lang-select">Lang:</label>
 *     <select id="lang-select"></select>
 *   </div>
 *
 * Configuration:
 *   LANG_CONFIG.languages — ordered array of { code, label } objects.
 *   LANG_CONFIG.available  — function(pageUrl, langCode) → Promise<boolean>
 *     to check whether a language variant exists. Uses HEAD-request
 *     detection with caching by default.
 */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Availability cache — avoids repeated HEAD requests for the same URL
     ----------------------------------------------------------------------- */
  var availabilityCache = {};

  // file:// protocol guard: under file://, fetch HEAD fails (opaque-origin
  // CORS), so every variant probe rejects and every non-default option would
  // be disabled. Optimistically treat every variant as available to keep the
  // switcher usable during local file:// testing.
  var IS_FILE_PROTOCOL = window.location.protocol === 'file:';

  /* -----------------------------------------------------------------------
     Configuration
     ----------------------------------------------------------------------- */
  var LANG_CONFIG = {
    // Languages to offer in the dropdown. First entry is the "default"
    // (no suffix in the filename).
    languages: [
      { code: '',    label: 'Default' },
      { code: 'en',  label: 'English' },
      { code: 'ko',  label: '\uD55C\uAD6D\uC5B4' },          // Korean
      { code: 'ja',  label: '\u65E5\u672C\u8A9E' }           // Japanese
    ],

    /**
     * Determine whether a given language variant exists for the current page.
     * Uses HEAD-request detection with result caching. Returns a Promise
     * that resolves to true (available) or false (not available).
     *
     * The default language (empty langCode) is always available without a fetch.
     *
     * @param {string} pageUrl  — full URL of the variant page to check
     * @param {string} langCode — language code suffix (empty string for default)
     * @returns {Promise<boolean>}
     */
    available: function (pageUrl, langCode) {
      // Default language (no suffix) is always available
      if (langCode === '') {
        return Promise.resolve(true);
      }

      // Under file://, fetch HEAD always rejects (see IS_FILE_PROTOCOL above),
      // so treat every variant as available rather than disabling every
      // non-default option during local testing.
      if (IS_FILE_PROTOCOL) {
        return Promise.resolve(true);
      }

      // Return cached result if available
      if (availabilityCache.hasOwnProperty(pageUrl)) {
        return Promise.resolve(availabilityCache[pageUrl]);
      }

      // Issue HEAD request to check if the page exists
      return fetch(pageUrl, { method: 'HEAD' })
        .then(function (response) {
          var ok = response.ok;
          availabilityCache[pageUrl] = ok;
          return ok;
        })
        .catch(function () {
          availabilityCache[pageUrl] = false;
          return false;
        });
    }
  };

  /* -----------------------------------------------------------------------
     Constants
     ----------------------------------------------------------------------- */
  var STORAGE_KEY      = 'lang';
  var SWITCHER_ID      = 'lang-switcher';
  var SELECT_ID        = 'lang-select';
  var DEBOUNCE_MS      = 100;

  /* -----------------------------------------------------------------------
     Helpers
     ----------------------------------------------------------------------- */

  /**
   * Extract the current page's base filename and directory.
   *
   * Examples (input → output):
   *   chapter_01.html       → { dir: '/handbook/', base: 'chapter_01' }
   *   chapter_01_ko.html    → { dir: '/handbook/', base: 'chapter_01' }
   *   guides/setup_en.html  → { dir: '/handbook/guides/', base: 'setup' }
   *
   * @returns {{ dir: string, base: string }}
   */
  function parseCurrentPage() {
    var pathname = window.location.pathname;
    var filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    var dir      = pathname.substring(0, pathname.lastIndexOf('/') + 1);

    // Strip known language suffixes (_en, _ko, _ja, etc.) and the extension
    var base = filename.replace(/(?:_[a-z]{2})?\.html$/i, '');

    // Directory index (e.g. ".../"): no filename stem to anchor the language
    // suffix on, so switching language would build "<dir>_en.html" which 404s.
    // Treat an empty stem as 'index' so we form index_en.html / index_ko.html.
    if (!base) {
      base = 'index';
    }

    return { dir: dir, base: base };
  }

  /**
   * Build the URL for a language variant of the current page.
   *
   * @param {string} base    — base filename without extension or lang suffix
   * @param {string} dir     — directory path
   * @param {string} langCode — language code (empty string for default)
   * @returns {string}
   */
  function buildVariantUrl(base, dir, langCode) {
    var suffix = langCode ? '_' + langCode : '';
    return dir + base + suffix + '.html';
  }

  /**
   * Detect which language the current page is showing by inspecting
   * the filename for a known suffix.
   *
   * @returns {string} language code (empty string for default)
   */
  function detectCurrentLang() {
    var pathname = window.location.pathname;
    var filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    var match    = filename.match(/_([a-z]{2})\.html$/i);
    return match ? match[1].toLowerCase() : '';
  }

  /* -----------------------------------------------------------------------
     DOM — inject switcher if not present
     ----------------------------------------------------------------------- */
  var switcherEl = document.getElementById(SWITCHER_ID);
  if (!switcherEl) {
    switcherEl = document.createElement('div');
    switcherEl.id = SWITCHER_ID;
    switcherEl.className = 'lang-switcher';
    switcherEl.innerHTML =
      '<label for="' + SELECT_ID + '">Lang:</label>' +
      '<select id="' + SELECT_ID + '"></select>';
    document.body.appendChild(switcherEl);
  }

  var selectEl = document.getElementById(SELECT_ID);

  /* -----------------------------------------------------------------------
     Populate dropdown and bind events
     ----------------------------------------------------------------------- */
  /**
   * Asynchronously check each non-default language variant and disable
   * the corresponding <option> if the page does not exist.
   *
   * @param {HTMLSelectElement} selectEl — the <select> element
   * @param {HTMLOptionElement[]} options — all <option> elements
   */
  function updateAvailability(selectEl, options) {
    options.forEach(function (opt) {
      var langCode = opt.getAttribute('data-lang');
      if (langCode === '') return; // default always available
      LANG_CONFIG.available(opt.getAttribute('data-url'), langCode).then(function (ok) {
        if (!ok) opt.disabled = true;
      });
    });
  }

  (function init() {
    var pageInfo   = parseCurrentPage();
    var currentLang = detectCurrentLang();

    // Populate <option> elements — always render ALL options regardless
    // of availability; unavailable ones are disabled asynchronously.
    var allOptions = [];
    LANG_CONFIG.languages.forEach(function (lang) {
      var pageUrl = buildVariantUrl(pageInfo.base, pageInfo.dir, lang.code);

      var option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.label;
      option.setAttribute('data-lang', lang.code);
      option.setAttribute('data-url', pageUrl);

      // Pre-select the current language
      if (lang.code === currentLang) {
        option.selected = true;
      }

      selectEl.appendChild(option);
      allOptions.push(option);
    });

    // Asynchronously check which variants actually exist and disable
    // those that are unavailable.
    updateAvailability(selectEl, allOptions);

    // If the user has a stored preference that differs from the current
    // page suffix, we do NOT auto-redirect — the current page was likely
    // linked directly. But we do reflect the preference for future clicks.

    // Restore stored preference if available and matches an option
    var storedLang = localStorage.getItem(STORAGE_KEY);
    if (storedLang !== null) {
      // Only set if the option actually exists in the dropdown
      var optionExists = Array.from(selectEl.options).some(function (opt) {
        return opt.value === storedLang;
      });
      if (optionExists) {
        selectEl.value = storedLang;
      }
    }
  })();

  /* -----------------------------------------------------------------------
     On change — navigate to the variant and persist preference
     ----------------------------------------------------------------------- */

  // Debounce to prevent rapid re-navigation
  var changeTimer = null;

  selectEl.addEventListener('change', function () {
    var selectedLang = selectEl.value;
    localStorage.setItem(STORAGE_KEY, selectedLang);

    // Navigate only if the target language differs from the current page
    var currentLang = detectCurrentLang();
    if (selectedLang !== currentLang) {
      var pageInfo = parseCurrentPage();
      var targetUrl = buildVariantUrl(pageInfo.base, pageInfo.dir, selectedLang);

      // Small debounce to avoid double-triggers
      clearTimeout(changeTimer);
      changeTimer = setTimeout(function () {
        window.location.href = targetUrl;
      }, DEBOUNCE_MS);
    }
  });

})();
