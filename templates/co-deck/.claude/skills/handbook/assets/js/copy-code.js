// Localized copy feedback labels, keyed on the page's <html lang>
var COPY_LABELS = {
  en: ['Copied!', 'Failed'],
  ko: ['완료!', '실패!'],
  es: ['¡Copiado!', 'Error'],
  ja: ['コピーしました！', '失敗！']
};
var COPY_LABEL = COPY_LABELS[document.documentElement.lang] || COPY_LABELS.en;

function copyCode(btn) {
  var original = btn.textContent;
  var text;
  var codes = btn.parentElement.querySelectorAll(':scope > code');
  if (codes.length > 1) {
    text = Array.from(codes).map(function (c) { return c.textContent; }).join('\n');
  } else {
    var pre = btn.previousElementSibling || btn.parentElement.querySelector('pre');
    text = pre ? pre.textContent : '';
  }
  if (!text) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = COPY_LABEL[0];
      btn.classList.add('copied');
      btn.setAttribute('aria-live', 'polite');
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove('copied');
        btn.removeAttribute('aria-live');
      }, 1500);
    }).catch(function () {
      btn.textContent = COPY_LABEL[1];
      btn.classList.add('copied');
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    });
  } else {
    // Fallback for non-HTTPS contexts where clipboard API is unavailable
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      btn.textContent = COPY_LABEL[0];
      btn.classList.add('copied');
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    } catch (e) {
      btn.textContent = COPY_LABEL[1];
      btn.classList.add('copied');
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    }
    document.body.removeChild(ta);
  }
}

// CSP: script-src 'self' blocks inline onclick, so clicks are handled by delegation
document.addEventListener('click', function (e) {
  var btn = e.target && e.target.closest ? e.target.closest('.copy-btn') : null;
  if (btn) copyCode(btn);
});
