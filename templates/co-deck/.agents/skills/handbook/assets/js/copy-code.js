function copyCode(btn) {
  const codes = btn.parentElement.querySelectorAll(':scope > code');
  let text;
  if (codes.length > 1) {
    text = Array.from(codes).map(c => c.textContent).join('\n');
  } else {
    const pre = btn.previousElementSibling || btn.parentElement.querySelector('pre');
    text = pre.textContent;
  }
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
  });
}
