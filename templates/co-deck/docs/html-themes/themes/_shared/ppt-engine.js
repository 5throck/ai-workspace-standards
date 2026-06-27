/*
  ppt-engine.js — PPT-style common runtime engine
  ================================================
  Shared JavaScript for all PPT-transformed themes. Inlined into each template.html.
  Provides:
    - TransitionEngine: fade / push / zoom transitions with direction awareness
    - PresenterTools: speaker script panel + presentation timer
    - TOCBuilder: slide-out TOC drawer with headline navigation
    - NarrationEngine v2.1: Web Speech API TTS narration with auto-advance

  Usage in template.html:
    1. Include this script block after slideData injection
    2. Call initPPT(slideData, containerId, options) from DOMContentLoaded
    3. Options: { transition: 'fade'|'push'|'zoom', timer: true|false,
                  showTOC: true|false, verticalMode: false }
*/

// ── DOM helpers (shared with theme renderers) ──────────────────────────────
function escapeText(s) {
  return String(s == null ? '' : s).replace(/<\/?[^>]+(>|$)/g, '');
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function imgEl(src, alt) {
  const node = document.createElement('img');
  node.src = src || '';
  node.alt = alt || '';
  node.onerror = function() {
    this.style.opacity = '0.2';
    this.classList.add('img-fallback');
  };
  return node;
}

function appendInline(parent, s) {
  const parts = String(s == null ? '' : s).split(/\*\*(.*?)\*\*/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) parent.appendChild(document.createTextNode(parts[i]));
    else parent.appendChild(el('strong', null, parts[i]));
  }
}

// ── Visual display structured renderer ──────────────────────────────
// Converts plain-text visualDisplay content into structured DOM elements.
// Patterns:
//   [Title]           → .visual-heading (bold, accented)
//   [Title] + single marker line (no blank) → .visual-heading-inline (one line)
//   ✓ / ✗ / → / •    → .visual-item (marker preserved in text, no CSS ::before)
//   (empty line)      → <br>
//   (default)         → .visual-paragraph (normal text)
// Called by theme template renderers when data.visualDisplay is present.

var MARKER_RE = /^[✓✗✔✘→►•▪▫▸❯]/;

function renderVisualDisplay(parent, text) {
  if (!text) return;
  var lines = String(text).split('\n');
  var i = 0;
  while (i < lines.length) {
    var trimmed = lines[i].trim();
    if (!trimmed) { parent.appendChild(document.createElement('br')); i++; continue; }

    // [Box Title] — check if next non-empty line is a single marker line (inline collapse)
    if (/^\[.+\]$/.test(trimmed)) {
      var label = trimmed.replace(/^\[|\]$/g, '');
      var next = i + 1 < lines.length ? lines[i + 1].trim() : '';
      var afterNext = i + 2 < lines.length ? lines[i + 2].trim() : null;
      // Collapse: [Title] immediately followed by one marker line, then blank or end
      if (next && MARKER_RE.test(next) && (afterNext === null || afterNext === '')) {
        var combined = el('div', 'visual-item');
        combined.textContent = label + ' ' + next;
        parent.appendChild(combined);
        i += 2; // consume heading + marker line
        continue;
      }
      parent.appendChild(el('div', 'visual-heading', label));
      i++;
      continue;
    }

    // Marker items — render text as-is, no CSS ::before bullet
    if (MARKER_RE.test(trimmed)) {
      parent.appendChild(el('div', 'visual-item', trimmed));
      i++;
      continue;
    }

    // Default paragraph
    parent.appendChild(el('div', 'visual-paragraph', trimmed));
    i++;
  }
}

// ── TOCBuilder ────────────────────────────────────────────────────────
// Builds and manages the TOC drawer with slide headline navigation.
// Ported from pitch v1.0.0 TOC drawer, adapted for glass-morphism style.

var TOCBuilder = {
  visible: false,
  _scrollOnClick: false,  // set true by vertical theme to keep TOC open after item click

  init: function(slideData, listId) {
    var list = document.getElementById(listId);
    if (!list || typeof slideData === 'undefined') return;
    while (list.firstChild) list.removeChild(list.firstChild);

    var self = this;
    slideData.forEach(function(data, i) {
      var li = document.createElement('li');
      li.className = 'toc-item' + (i === 0 ? ' active' : '');
      li.dataset.index = i;
      li.onclick = function() {
        if (typeof scrollToSlide === 'function') { scrollToSlide(i); }
        else { showSlide(i); }
        if (!self._scrollOnClick) { closeTOC(); }
      };

      var num = document.createElement('span');
      num.className = 'toc-item-num';
      num.textContent = String(i + 1);
      li.appendChild(num);

      var headline = document.createElement('span');
      headline.className = 'toc-item-headline';
      headline.textContent = data.title || data.subtitle || ('Slide ' + (i + 1));
      li.appendChild(headline);

      list.appendChild(li);
    });
  },

  highlight: function(index) {
    var items = document.querySelectorAll('.toc-item');
    items.forEach(function(item, i) {
      item.classList.toggle('active', i === index);
    });
    // Scroll active item into view
    var activeItem = document.querySelector('.toc-item[data-index="' + index + '"]');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
};

// ── ThumbnailNav ──────────────────────────────────────────────────────────
// Manages the thumbnail-panel sidebar for PPT themes that use it
// (pitch-enhanced, etc.). Builds a slide title list on first open,
// highlights the active slide, and syncs with showSlide().

var ThumbnailNav = {
  visible: false,
  _built: false,

  init: function() {
    var panel = document.getElementById('thumbnail-panel');
    if (!panel) return;
    // Start hidden; user toggles via button
    panel.classList.add('hidden');
    this.visible = false;
    this._build(panel);
    this._built = true;
  },

  toggle: function() {
    var panel = document.getElementById('thumbnail-panel');
    var btn   = document.getElementById('thumb-toggle-btn');
    if (!panel) return;
    this.visible = !this.visible;
    panel.classList.toggle('hidden', !this.visible);
    if (btn) btn.classList.toggle('active', this.visible);
    if (this.visible) this.highlight(currentSlide);
  },

  _build: function(panel) {
    if (typeof slideData === 'undefined') return;
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    slideData.forEach(function(d, i) {
      var item = document.createElement('div');
      item.className = 'thumbnail-item' + (i === 0 ? ' active' : '');
      item.dataset.index = i;
      item.title = d.title || ('Slide ' + (i + 1));
      item.onclick = function() { showSlide(i); };

      var num = document.createElement('span');
      num.className = 'thumb-label';
      num.textContent = i + 1;

      var label = document.createElement('span');
      label.className = 'thumb-headline';
      label.textContent = d.title || d.subtitle || ('Slide ' + (i + 1));

      item.appendChild(num);
      item.appendChild(label);
      panel.appendChild(item);
    });
  },

  highlight: function(index) {
    var items = document.querySelectorAll('.thumbnail-item');
    items.forEach(function(item, i) {
      item.classList.toggle('active', i === index);
    });
    var active = document.querySelector('.thumbnail-item[data-index="' + index + '"]');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
};

// ── TransitionEngine ─────────────────────────────────────────────────────
// Manages slide transition effects: fade, push, zoom.
// Each slide gets exit/enter CSS classes based on direction.

var TransitionEngine = {
  mode: 'fade',    // current transition mode: 'fade' | 'push' | 'zoom'
  _body: null,

  init: function(mode) {
    this.mode = mode || 'fade';
    this._body = document.body;
    this._body.classList.remove('transition-fade', 'transition-push', 'transition-zoom');
    this._body.classList.add('transition-' + this.mode);
  },

  setMode: function(mode) {
    this.mode = mode || 'fade';
    this._body.classList.remove('transition-fade', 'transition-push', 'transition-zoom');
    this._body.classList.add('transition-' + this.mode);

    // Update button states
    document.querySelectorAll('.transition-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  },

  // Apply transition classes before showing the target slide.
  // direction: 1 = forward (next), -1 = backward (prev)
  applyTransition: function(fromIndex, toIndex) {
    if (this.mode === 'fade') return; // fade needs no extra classes

    var slides = document.querySelectorAll('.slide');
    var direction = toIndex > fromIndex ? 1 : -1;

    if (this.mode === 'push') {
      // Remove old transition classes from all slides
      slides.forEach(function(s) {
        s.classList.remove('exit-left', 'exit-right', 'enter-left', 'enter-right');
      });
      if (fromIndex >= 0 && fromIndex < slides.length) {
        slides[fromIndex].classList.add(direction > 0 ? 'exit-left' : 'exit-right');
      }
      if (toIndex >= 0 && toIndex < slides.length) {
        slides[toIndex].classList.add(direction > 0 ? 'enter-right' : 'enter-left');
      }
    }

    if (this.mode === 'zoom') {
      slides.forEach(function(s) {
        s.classList.remove('exit-zoom-out', 'exit-zoom-in');
      });
      if (fromIndex >= 0 && fromIndex < slides.length) {
        slides[fromIndex].classList.add(direction > 0 ? 'exit-zoom-in' : 'exit-zoom-out');
      }
    }
  },

  // Clean up transition classes after transition completes
  cleanup: function() {
    var slides = document.querySelectorAll('.slide');
    slides.forEach(function(s) {
      s.classList.remove('exit-left', 'exit-right', 'enter-left', 'enter-right',
                          'exit-zoom-out', 'exit-zoom-in');
    });
  }
};

// ── PresenterTools ───────────────────────────────────────────────────────
// Speaker script panel + presentation timer.

var PresenterTools = {
  scriptVisible: false,
  timerRunning: false,
  timerSeconds: 0,
  timerInterval: null,

  updateScript: function(index) {
    var panel = document.getElementById('script-panel');
    var textEl = document.getElementById('script-text');
    if (!panel || !textEl) return;
    var data = typeof slideData !== 'undefined' ? slideData[index] : null;
    var script = data && data.script ? data.script : '';
    textEl.textContent = script;
    if (!script && this.scriptVisible) {
      panel.classList.remove('show');
    } else if (this.scriptVisible && script) {
      panel.classList.add('show');
    }
  },

  toggleScript: function() {
    var panel = document.getElementById('script-panel');
    var btn = document.getElementById('script-btn');
    if (!panel) return;
    var data = typeof slideData !== 'undefined' ? slideData[currentSlide] : null;
    var hasScript = data && data.script;
    this.scriptVisible = !this.scriptVisible;
    panel.classList.toggle('show', this.scriptVisible && !!hasScript);
    if (btn) btn.classList.toggle('active', this.scriptVisible);
  },

  // Timer functions
  formatTime: function(totalSec) {
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  },

  updateTimerDisplay: function() {
    var el = document.getElementById('timer-display');
    if (el) el.textContent = this.formatTime(this.timerSeconds);
  },

  toggleTimer: function() {
    var btn = document.getElementById('timer-btn');
    if (this.timerRunning) {
      this.pauseTimer();
      if (btn) btn.classList.remove('active');
    } else {
      this.startTimer();
      if (btn) btn.classList.add('active');
    }
  },

  startTimer: function() {
    this.timerRunning = true;
    var display = document.getElementById('timer-display');
    if (display) display.classList.add('running');
    var self = this;
    this.timerInterval = setInterval(function() {
      self.timerSeconds++;
      self.updateTimerDisplay();
    }, 1000);
  },

  pauseTimer: function() {
    this.timerRunning = false;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    var display = document.getElementById('timer-display');
    if (display) display.classList.remove('running');
  },

  resetTimer: function() {
    this.pauseTimer();
    this.timerSeconds = 0;
    this.updateTimerDisplay();
    var btn = document.getElementById('timer-btn');
    if (btn) btn.classList.remove('active');
  }
};

// ── NarrationEngine v2.1 ───────────────────────────────────────────────
// Web Speech API TTS narration with independent auto-advance support.
// Reads slideData[i].script (or language-specific variant) aloud.
//
// State separation:
//   isPlaying / isPaused  →  narration (speech synthesis)
//   isAutoAdvance         →  auto-slide timer (independent from narration)
//
// 4 combinations:
//   Both ON  — narration drives slide timing (onend → next slide)
//   Narrator only — stops after each slide, waits for user
//   Auto-slide only — timer-driven slide advance (default 5s interval)
//   Both OFF — fully manual navigation (DEFAULT on load)
//
// IMPORTANT: Auto-advance is NEVER enabled by config. The user must
// explicitly toggle it via the "⏸ Manual" button or press 'A' key.
// narrationConfig.autoAdvance is ignored — only autoAdvanceInterval
// and language settings are respected from config.
//
// Config bridge: lecture-profile.md → html-build injects narrationConfig
//   → initPPT({ narration: narrationConfig }) → NarrationEngine.init(config)
//
// Voice selection: dropdown filtered by language, persisted in localStorage.

var NarrationEngine = {
  // Narration state
  isPlaying: false,
  isPaused: false,
  currentUtterance: null,

  // Auto-advance state (completely independent from narration)
  isAutoAdvance: false,
  _autoAdvanceTimer: null,
  _autoAdvanceInterval: 5000, // ms

  // Language & voice
  language: 'ko',

  // Hook: override how "advance to next slide" works.
  // Default = changeSlide(1). Vertical theme sets this to scrollToSlide.
  onSlideAdvance: function() { changeSlide(1); },

  // Internal
  _available: false,
  _voicesLoaded: false,
  _voiceCount: 0,
  _config: null,

  // Extensible language registry (add new languages here)
  LANGUAGES: {
    ko: { label: '한국어', shortLabel: 'KR', voicePrefix: 'ko' },
    en: { label: 'English', shortLabel: 'EN', voicePrefix: 'en' },
    ja: { label: '日本語', shortLabel: 'JA', voicePrefix: 'ja' }
  },

  init: function(config) {
    this._available = ('speechSynthesis' in window && typeof window.speechSynthesis !== 'undefined');
    this._config = config || {};

    // Apply config defaults (auto-advance is NEVER enabled by config — user must toggle manually)
    if (this._config.autoAdvanceInterval) {
      this._autoAdvanceInterval = this._config.autoAdvanceInterval * 1000;
    }
    if (this._config.defaultLanguage && this.LANGUAGES[this._config.defaultLanguage]) {
      this.language = this._config.defaultLanguage;
    }

    if (!this._available) {
      // Hide all narration UI
      var els = ['narration-play-btn', 'narration-auto-advance-btn', 'voice-lang-btn', 'voice-select-btn'];
      els.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      return;
    }

    var self = this;
    this._voiceCount = 0;

    // Load voices — some browsers load them asynchronously (Chrome may fire
    // onvoiceschanged multiple times as voices load incrementally).
    function loadVoices() {
      var voices = speechSynthesis.getVoices();
      if (voices.length > 0 && voices.length !== self._voiceCount) {
        self._voiceCount = voices.length;
        self._voicesLoaded = true;
        // Rebuild dropdowns only when the voice list actually changed
        self._buildLanguageDropdown();
        self._updateVoiceDropdown();
      }
    }

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Fallback: some browsers never fire onvoiceschanged.
    // Retry once after 500ms to catch late-loading voices.
    setTimeout(loadVoices, 500);

    // Chrome bug workaround: speechSynthesis can pause after ~15s of inactivity.
    // Keep it alive with a periodic no-op utterance.
    setInterval(function() {
      if (!self._available) return;
      if (!speechSynthesis.speaking && !speechSynthesis.paused) {
        var u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        u.rate = 10;
        speechSynthesis.speak(u);
      }
    }, 14000);

    // Bind click-outside handler (dropdowns are built by loadVoices callback)
    this._bindOutsideClick();

    // Start auto-advance timer if enabled
    if (this.isAutoAdvance) {
      this._startAutoAdvanceTimer();
    }

    this._updateButtonStates();
  },

  getScript: function(index) {
    var data = typeof slideData !== 'undefined' ? slideData[index] : null;
    if (!data) return '';

    if (this.language === 'en' && data.scriptEn) return data.scriptEn;
    if (this.language === 'ja' && data.scriptJa) return data.scriptJa;
    return data.script || '';
  },

  // ── Voice selection ───────────────────────────────────────────────

  _getVoicesForLanguage: function(lang) {
    var voices = speechSynthesis.getVoices();
    var prefix = this.LANGUAGES[lang] ? this.LANGUAGES[lang].voicePrefix : lang;
    return voices.filter(function(v) {
      return v.lang.indexOf(prefix) === 0;
    });
  },

  _findVoice: function(lang) {
    // Check localStorage first
    var savedVoice = localStorage.getItem('narration_voice_' + lang);
    if (savedVoice) {
      var voices = speechSynthesis.getVoices();
      for (var i = 0; i < voices.length; i++) {
        if (voices[i].name === savedVoice && voices[i].lang.indexOf(lang) === 0) {
          return voices[i];
        }
      }
    }

    // BCP47 candidate matching
    var prefix = this.LANGUAGES[lang] ? this.LANGUAGES[lang].voicePrefix : lang;
    var voices = speechSynthesis.getVoices();
    for (var v = 0; v < voices.length; v++) {
      if (voices[v].lang.indexOf(prefix) === 0) return voices[v];
    }
    return null; // use default
  },

  // ── Speech synthesis ──────────────────────────────────────────────

  _speak: function(index) {
    if (!this._available) return;
    var text = this.getScript(index);
    if (!text) {
      // No script for this slide
      if (this.isAutoAdvance) {
        var slides = document.querySelectorAll('.slide');
        if (index < slides.length - 1) {
          var self = this;
          setTimeout(function() { self.onSlideAdvance(); }, 200);
        } else {
          this.stop();
        }
      }
      return;
    }

    speechSynthesis.cancel();

    var self = this;
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    var voice = this._findVoice(this.language);
    if (voice) utterance.voice = voice;

    utterance.onstart = function() {
      self._updateButtonStates();
    };

    utterance.onend = function() {
      self._onSpeechEnd();
    };

    utterance.onerror = function(e) {
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      self.stop();
    };

    this.currentUtterance = utterance;
    speechSynthesis.speak(utterance);
  },

  _onSpeechEnd: function() {
    if (!this.isPlaying) return;
    var slides = document.querySelectorAll('.slide');

    if (this.isAutoAdvance && currentSlide < slides.length - 1) {
      // Both on: narration drives timing — advance after speech
      var self = this;
      setTimeout(function() { self.onSlideAdvance(); }, 800);
    } else if (!this.isAutoAdvance) {
      // Narrator only: stop after each slide, wait for user
      this.isPlaying = false;
      this._updateButtonStates();
    } else {
      // Last slide reached
      this.stop();
    }
  },

  _onSlideChanged: function(index) {
    // Called when slide changes during playback
    speechSynthesis.cancel();
    if (this.isPlaying && !this.isPaused) {
      var self = this;
      setTimeout(function() { self._speak(index); }, 50);
    }
    // Restart auto-advance timer on slide change
    if (this.isAutoAdvance) {
      this._restartAutoAdvanceTimer();
    }
  },

  // ── Playback controls ─────────────────────────────────────────────

  play: function() {
    if (!this._available) return;

    if (this.isPaused) {
      speechSynthesis.resume();
      this.isPaused = false;
      this._updateButtonStates();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this._speak(currentSlide);
  },

  pause: function() {
    if (!this._available || !this.isPlaying) return;
    speechSynthesis.pause();
    this.isPaused = true;
    this._updateButtonStates();
  },

  stop: function() {
    if (!this._available) return;
    speechSynthesis.cancel();
    this.isPlaying = false;
    this.isPaused = false;
    this._updateButtonStates();

    // Restart auto-advance timer if enabled (narration stopped)
    if (this.isAutoAdvance) {
      this._restartAutoAdvanceTimer();
    }
  },

  togglePlay: function() {
    if (!this._available) return;
    if (this.isPlaying && !this.isPaused) {
      this.pause();
    } else {
      this.play();
    }
  },

  // ── Auto-advance controls ──────────────────────────────────────────

  toggleAutoAdvance: function() {
    this.isAutoAdvance = !this.isAutoAdvance;
    if (this.isAutoAdvance) {
      this._startAutoAdvanceTimer();
    } else {
      this._stopAutoAdvanceTimer();
    }
    this._updateButtonStates();
  },

  _startAutoAdvanceTimer: function() {
    var self = this;
    this._stopAutoAdvanceTimer();
    this._autoAdvanceTimer = setInterval(function() {
      // Skip tick if narration is actively speaking (narration handles timing)
      if (self.isPlaying && !self.isPaused) return;
      var slides = document.querySelectorAll('.slide');
      if (currentSlide < slides.length - 1) {
        self.onSlideAdvance();
      } else {
        self._stopAutoAdvanceTimer();
      }
    }, this._autoAdvanceInterval);
  },

  _stopAutoAdvanceTimer: function() {
    if (this._autoAdvanceTimer) {
      clearInterval(this._autoAdvanceTimer);
      this._autoAdvanceTimer = null;
    }
  },

  _restartAutoAdvanceTimer: function() {
    if (this.isAutoAdvance && !(this.isPlaying && !this.isPaused)) {
      this._startAutoAdvanceTimer();
    }
  },

  // ── Language dropdown ──────────────────────────────────────────────

  _buildLanguageDropdown: function() {
    var dropdown = document.getElementById('voice-lang-dropdown');
    var btn = document.getElementById('voice-lang-btn');
    if (!dropdown || !btn) return;

    while (dropdown.firstChild) dropdown.removeChild(dropdown.firstChild);

    // Determine available languages from config or default to all
    var configLangs = (this._config && this._config.languages) || Object.keys(this.LANGUAGES);
    var self = this;

    configLangs.forEach(function(lang) {
      var langInfo = self.LANGUAGES[lang];
      if (!langInfo) return;

      // Check if any slide has script for this language
      var hasScript = false;
      if (typeof slideData !== 'undefined') {
        for (var i = 0; i < slideData.length; i++) {
          var s = slideData[i].script || '';
          if (lang === 'en') s = slideData[i].scriptEn || s;
          if (lang === 'ja') s = slideData[i].scriptJa || s;
          if (s) { hasScript = true; break; }
        }
      }

      var option = document.createElement('div');
      option.className = 'voice-lang-option' + (lang === self.language ? ' active' : '') + (!hasScript ? ' disabled' : '');
      option.textContent = langInfo.label + ' (' + langInfo.shortLabel + ')';
      option.dataset.lang = lang;

      if (hasScript) {
        option.onclick = function(e) {
          e.stopPropagation();
          self.setLanguage(lang);
          self._toggleLanguageDropdown();
        };
      }

      dropdown.appendChild(option);
    });

    // Update button label
    var currentLang = this.LANGUAGES[this.language];
    if (currentLang) {
      btn.textContent = currentLang.shortLabel + ' ▾';
    }
  },

  _toggleLanguageDropdown: function() {
    var dropdown = document.getElementById('voice-lang-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('show');
    // Close voice dropdown
    var voiceDd = document.getElementById('voice-select-dropdown');
    if (voiceDd) voiceDd.classList.remove('show');
  },

  setLanguage: function(lang) {
    if (!this.LANGUAGES[lang]) return;
    this.language = lang;

    // Update dropdown active state
    var options = document.querySelectorAll('.voice-lang-option');
    options.forEach(function(opt) {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });

    // Update button label
    var btn = document.getElementById('voice-lang-btn');
    if (btn) {
      var langInfo = this.LANGUAGES[lang];
      btn.textContent = langInfo.shortLabel + ' ▾';
    }

    // Rebuild voice dropdown for new language
    this._updateVoiceDropdown();

    // Restart speech with new language if playing
    if (this.isPlaying) {
      speechSynthesis.cancel();
      var self = this;
      setTimeout(function() { self._speak(currentSlide); }, 50);
    }
  },

  // ── Voice selector dropdown ───────────────────────────────────────

  _updateVoiceDropdown: function() {
    var dropdown = document.getElementById('voice-select-dropdown');
    var btn = document.getElementById('voice-select-btn');
    if (!dropdown || !btn) return;

    // Preserve open state across rebuilds
    var wasOpen = dropdown.classList.contains('show');
    while (dropdown.firstChild) dropdown.removeChild(dropdown.firstChild);

    var voices = this._getVoicesForLanguage(this.language);
    var currentVoice = this._findVoice(this.language);

    if (voices.length === 0) {
      btn.style.display = 'none';
      return;
    }

    btn.style.display = '';

    var self = this;
    voices.forEach(function(voice) {
      var option = document.createElement('div');
      option.className = 'voice-option' + (currentVoice && currentVoice.name === voice.name ? ' active' : '');

      var nameSpan = document.createElement('span');
      nameSpan.className = 'voice-name';
      nameSpan.textContent = voice.name;

      var badge = document.createElement('span');
      badge.className = 'voice-badge';
      badge.textContent = voice.lang + ' · ' + (voice.localService ? 'L' : 'N');

      option.appendChild(nameSpan);
      option.appendChild(badge);
      option.title = voice.name + ' — ' + voice.lang + ' (' + (voice.localService ? 'local' : 'network') + ')';
      option.onclick = function(e) {
        e.stopPropagation();
        self._selectVoiceInDropdown(voice.name, voice.lang, voice.localService);
        self._toggleVoiceDropdown();
      };
      dropdown.appendChild(option);
    });

    // Update button label with compact info
    if (currentVoice) {
      btn.textContent = '';
      btn.appendChild(document.createTextNode('🎤 ' + currentVoice.name + ' '));
      var badge = document.createElement('span');
      badge.className = 'voice-badge';
      badge.textContent = currentVoice.lang;
      btn.appendChild(badge);
    } else {
      btn.textContent = '🎤 Default';
    }

    // Restore open state if it was open before rebuild
    if (wasOpen) dropdown.classList.add('show');
  },

  _selectVoiceInDropdown: function(voiceName, voiceLang, isLocal) {
    // Persist to localStorage per language
    localStorage.setItem('narration_voice_' + this.language, voiceName);

    // Update dropdown active state
    var options = document.querySelectorAll('.voice-option');
    options.forEach(function(opt) {
      var nameEl = opt.querySelector('.voice-name');
      opt.classList.toggle('active', nameEl && nameEl.textContent === voiceName);
    });

    // Update button label with badge
    var btn = document.getElementById('voice-select-btn');
    if (btn) {
      btn.textContent = '';
      btn.appendChild(document.createTextNode('🎤 ' + voiceName + ' '));
      var voiceBadge = document.createElement('span');
      voiceBadge.className = 'voice-badge';
      voiceBadge.textContent = voiceLang || '';
      btn.appendChild(voiceBadge);
    }

    // Restart speech with new voice if playing
    if (this.isPlaying && !this.isPaused) {
      speechSynthesis.cancel();
      var self = this;
      setTimeout(function() { self._speak(currentSlide); }, 50);
    }
  },

  _toggleVoiceDropdown: function() {
    var dropdown = document.getElementById('voice-select-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('show');
    // Close language dropdown
    var langDd = document.getElementById('voice-lang-dropdown');
    if (langDd) langDd.classList.remove('show');
  },

  // ── Outside click handler ──────────────────────────────────────────

  _bindOutsideClick: function() {
    var self = this;
    document.addEventListener('click', function(e) {
      // Close language dropdown if click is outside
      var langWrap = e.target.closest('.narration-dropdown-wrap');
      if (!langWrap || !langWrap.querySelector('#voice-lang-dropdown')) {
        var langDd = document.getElementById('voice-lang-dropdown');
        if (langDd) langDd.classList.remove('show');
      }
      // Close voice dropdown if click is outside
      if (!langWrap || !langWrap.querySelector('#voice-select-dropdown')) {
        var voiceDd = document.getElementById('voice-select-dropdown');
        if (voiceDd) voiceDd.classList.remove('show');
      }
    });
  },

  // ── UI state ──────────────────────────────────────────────────────

  _updateButtonStates: function() {
    var playBtn = document.getElementById('narration-play-btn');
    var autoBtn = document.getElementById('narration-auto-advance-btn');

    if (playBtn) {
      if (this.isPlaying && !this.isPaused) {
        playBtn.textContent = '⏸ Pause';
        playBtn.classList.add('speaking');
        playBtn.classList.remove('paused');
      } else if (this.isPlaying && this.isPaused) {
        playBtn.textContent = '▶ Resume';
        playBtn.classList.add('paused');
        playBtn.classList.remove('speaking');
      } else {
        playBtn.textContent = '▶ Play';
        playBtn.classList.remove('speaking', 'paused');
      }
    }

    if (autoBtn) {
      autoBtn.textContent = this.isAutoAdvance ? '⏩ Auto' : '⏸ Manual';
      autoBtn.classList.toggle('active', this.isAutoAdvance);
    }
  }
};

// ── TOC toggle functions (used by all PPT themes) ──────────────────────

function toggleTOC() {
  var drawer = document.getElementById('toc-drawer');
  var overlay = document.getElementById('toc-overlay');
  var btn = document.getElementById('toc-btn');
  if (!drawer) return;
  TOCBuilder.visible = !TOCBuilder.visible;
  drawer.classList.toggle('open', TOCBuilder.visible);
  if (overlay) overlay.classList.toggle('show', TOCBuilder.visible);
  if (btn) btn.classList.toggle('active', TOCBuilder.visible);
}

function closeTOC() {
  var drawer = document.getElementById('toc-drawer');
  var overlay = document.getElementById('toc-overlay');
  var btn = document.getElementById('toc-btn');
  if (!drawer) return;
  TOCBuilder.visible = false;
  drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
  if (btn) btn.classList.remove('active');
}

// ── Shared navigation (used by all PPT themes) ─────────────────────────

var currentSlide = 0;

function showSlide(index) {
  var slides = document.querySelectorAll('.slide');
  if (index < 0 || index >= slides.length) return;

  // Apply transition before switching
  TransitionEngine.applyTransition(currentSlide, index);

  // Remove active from all
  slides.forEach(function(s) {
    s.classList.remove('active');
    // For fade mode, also ensure non-active slides are hidden
    if (TransitionEngine.mode === 'fade') {
      // opacity is handled by CSS .transition-fade .slide
    }
  });

  // Activate target
  slides[index].classList.add('active');
  var prevSlide = currentSlide;
  currentSlide = index;

  // Update UI elements
  var counter = document.getElementById('slide-counter');
  if (counter) counter.textContent = (index + 1) + ' / ' + slides.length;

  var bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = ((index + 1) / slides.length * 100) + '%';

  // Update presenter tools
  PresenterTools.updateScript(index);
  TOCBuilder.highlight(index);
  if (ThumbnailNav.visible) ThumbnailNav.highlight(index);

  // Notify NarrationEngine of slide change (for narration speech and/or auto-advance timer restart)
  if (NarrationEngine._available && (NarrationEngine.isPlaying || NarrationEngine.isAutoAdvance)) {
    NarrationEngine._onSlideChanged(index);
  }

  // Clean up transition classes after animation completes
  var dur = TransitionEngine.mode === 'fade' ? 550 : 550;
  setTimeout(function() { TransitionEngine.cleanup(); }, dur);
}

function changeSlide(delta) {
  showSlide(currentSlide + delta);
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  // Don't capture if user is typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault();
    changeSlide(1);
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    changeSlide(-1);
  }
  if (e.key === 'Escape') {
    // Stop narration first, then close overlays
    if (NarrationEngine._available && NarrationEngine.isPlaying) {
      NarrationEngine.stop();
    } else {
      var panel = document.getElementById('script-panel');
      if (panel && panel.classList.contains('show')) {
        PresenterTools.toggleScript();
      }
    }
  }
  if (e.key === 's' || e.key === 'S') PresenterTools.toggleScript();
  if (e.key === 't' || e.key === 'T') toggleTOC();
  if (e.key === 'p' || e.key === 'P') NarrationEngine.togglePlay();
  if (e.key === 'a' || e.key === 'A') NarrationEngine.toggleAutoAdvance();
});

// ── PPT Init (call from each theme's DOMContentLoaded) ──────────────────
// options: { transition: 'fade'|'push'|'zoom', showTimer: true|false,
//            showTOC: true|false, verticalMode: false,
//            narration: narrationConfig }
function initPPT(options) {
  options = options || {};
  TransitionEngine.init(options.transition || 'fade');

  // Set initial transition button state
  document.querySelectorAll('.transition-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === TransitionEngine.mode);
  });

  // Show/hide timer elements
  if (!options.showTimer) {
    var timerBtn = document.getElementById('timer-btn');
    var timerDisp = document.getElementById('timer-display');
    if (timerBtn) timerBtn.style.display = 'none';
    if (timerDisp) timerDisp.style.display = 'none';
  }

  // Initialize TOC drawer and thumbnail panel after slides are rendered
  requestAnimationFrame(function() {
    if (typeof slideData !== 'undefined') {
      TOCBuilder.init(slideData, 'toc-list');
    }
    ThumbnailNav.init();
  });

  // Initialize narration engine (pass config if available)
  NarrationEngine.init(options.narration);
}
