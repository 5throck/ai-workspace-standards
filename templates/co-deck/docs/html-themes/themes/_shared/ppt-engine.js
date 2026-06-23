/*
  ppt-engine.js — PPT-style common runtime engine
  ===============================================
  Shared JavaScript for all PPT-transformed themes. Inlined into each template.html.
  Provides:
    - ThumbnailRenderer: CSS-transform based slide thumbnails (no library needed)
    - TransitionEngine: fade / push / zoom transitions with direction awareness
    - PresenterTools: speaker script panel + presentation timer
    - ThumbnailNav: left sidebar thumbnail panel with highlight + toggle

  Usage in template.html:
    1. Include this script block after slideData injection
    2. Call initPPT(slideData, containerId, options) from DOMContentLoaded
    3. Options: { transition: 'fade'|'push'|'zoom', timer: true|false }
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
  return node;
}

function appendInline(parent, s) {
  const parts = String(s == null ? '' : s).split(/\*\*(.*?)\*\*/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) parent.appendChild(document.createTextNode(parts[i]));
    else parent.appendChild(el('strong', null, parts[i]));
  }
}

// ── ThumbnailRenderer ────────────────────────────────────────────────────
// Creates CSS-transform-scaled clones of each slide in the thumbnail panel.
// No external library needed — pure DOM clone + CSS scale.

var ThumbnailRenderer = {
  init: function(slideData, panelId, renderFn) {
    var panel = document.getElementById(panelId);
    if (!panel || typeof slideData === 'undefined') return;
    while (panel.firstChild) panel.removeChild(panel.firstChild);

    // Create temporary container for measuring slide dimensions
    var tempContainer = document.getElementById('presentation');
    var slideW = 1280; // default reference
    var slideH = 720;

    slideData.forEach(function(data, i) {
      // Create thumbnail item wrapper
      var item = el('div', 'thumbnail-item' + (i === 0 ? ' active' : ''));
      item.dataset.index = i;
      item.onclick = function() { showSlide(i); };

      // Label (slide number)
      item.appendChild(el('div', 'thumb-label', String(i + 1)));

      // Clone the rendered slide into the thumbnail
      var slideNode = document.getElementById('slide-' + i);
      if (slideNode) {
        var clone = slideNode.cloneNode(true);
        clone.className = 'thumb-slide';
        clone.id = '';
        clone.removeAttribute('style');
        item.appendChild(clone);
      }

      panel.appendChild(item);
    });
  },

  highlight: function(index) {
    var items = document.querySelectorAll('.thumbnail-item');
    items.forEach(function(item, i) {
      item.classList.toggle('active', i === index);
    });

    // Scroll active thumbnail into view
    var activeItem = document.querySelector('.thumbnail-item[data-index="' + index + '"]');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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

// ── ThumbnailNav ───────────────────────────────────────────────────────
// Toggle the thumbnail panel visibility.

var ThumbnailNav = {
  visible: true,

  toggle: function() {
    var panel = document.getElementById('thumbnail-panel');
    var btn = document.getElementById('thumb-toggle-btn');
    if (!panel) return;
    this.visible = !this.visible;
    panel.classList.toggle('hidden', !this.visible);
    if (btn) btn.classList.toggle('active', this.visible);
  }
};

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
  ThumbnailRenderer.highlight(index);

  // Clean up transition classes after animation completes
  var dur = TransitionEngine.mode === 'fade' ? 550 : 550;
  setTimeout(function() { TransitionEngine.cleanup(); }, dur);
}

function changeSlide(delta) {
  showSlide(currentSlide + delta);
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault();
    changeSlide(1);
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    changeSlide(-1);
  }
  if (e.key === 'Escape') {
    // Close any open overlays
    var panel = document.getElementById('script-panel');
    if (panel && panel.classList.contains('show')) {
      PresenterTools.toggleScript();
    }
  }
  if (e.key === 's' || e.key === 'S') PresenterTools.toggleScript();
  if (e.key === 't' || e.key === 'T') ThumbnailNav.toggle();
});

// ── PPT Init (call from each theme's DOMContentLoaded) ──────────────────
// options: { transition: 'fade'|'push'|'zoom', showTimer: true|false, showThumbnails: true|false }
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

  // Show/hide thumbnail panel
  if (options.showThumbnails === false) {
    var panel = document.getElementById('thumbnail-panel');
    if (panel) panel.classList.add('hidden');
    ThumbnailNav.visible = false;
  }

  // Initialize thumbnails after slides are rendered
  // Use requestAnimationFrame to ensure slides are in DOM
  requestAnimationFrame(function() {
    if (typeof slideData !== 'undefined') {
      ThumbnailRenderer.init(slideData, 'thumbnail-panel');
    }
  });
}
