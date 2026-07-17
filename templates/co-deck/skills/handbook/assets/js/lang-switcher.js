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
 *   LANG_CONFIG.available  — optional function(page, lang) → boolean
 *     to restrict which language variants actually exist for a page.
 *     Defaults to assuming all variants exist.
 */

(function () {
  'use strict';

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
     * Replace this function with a real check (e.g., fetch probe, index lookup)
     * if you want to hide unavailable variants.
     *
     * @param {string} pageUrl  — base URL of the current page (no lang suffix)
     * @param {string} langCode — language code suffix (empty string for default)
     * @returns {boolean}
     */
    available: function (pageUrl, langCode) {
      // Default: assume all variants exist
      return true;
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
  (function init() {
    var pageInfo   = parseCurrentPage();
    var currentLang = detectCurrentLang();

    // Populate <option> elements
    LANG_CONFIG.languages.forEach(function (lang) {
      var pageUrl = buildVariantUrl(pageInfo.base, pageInfo.dir, lang.code);

      // Optionally skip unavailable variants
      if (!LANG_CONFIG.available(pageUrl, lang.code)) return;

      var option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.label;

      // Pre-select the current language
      if (lang.code === currentLang) {
        option.selected = true;
      }

      selectEl.appendChild(option);
    });

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
