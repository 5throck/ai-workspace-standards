// @version 1.0.0 — markdown inline-run helpers for the PDF renderer
// (U-20261105-005 item 6b).
//
// HTML decks render `**word**` in titles/bullets as <strong> via the shared
// appendInline() (ppt-engine.js); the PDF renderer stripped the markers and
// drew plain text with no weight or accent colour. These pure helpers split
// markdown runs and wrap them word-by-word so the Renderer can draw each run
// with its own font weight / colour.

export interface MdRun { text: string; bold: boolean }

/** Split text on **bold** markers into runs (marker-free). */
export function splitMarkdownRuns(text: string): MdRun[] {
  const parts = String(text ?? '').split(/\*\*(.*?)\*\*/g);
  const runs: MdRun[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    runs.push({ text: parts[i], bold: i % 2 === 1 });
  }
  return runs;
}

/** Strip ** markers only (marker-free text, same as the old strip() ** removal). */
export function markdownPlain(text: string): string {
  return String(text ?? '').replace(/\*\*/g, '');
}

/**
 * Greedy word-wrap over markdown runs. `measure(wordText, bold)` returns the
 * word width (plus any suffix) in the layout unit. Words inherit the bold
 * flag of the run they came from; explicit \n in the source forces a break.
 * Returns lines, each an array of {word, bold} tokens.
 */
export function wrapMarkdownWords(
  text: string,
  measure: (word: string, bold: boolean) => number,
  maxWidth: number,
): Array<Array<{ word: string; bold: boolean }>> {
  const lines: Array<Array<{ word: string; bold: boolean }>> = [];
  let line: Array<{ word: string; bold: boolean }> = [];
  let lineW = 0;

  const flush = () => { lines.push(line); line = []; lineW = 0; };

  // Split on \n FIRST so each paragraph keeps its **bold** markers.
  const paragraphs = String(text ?? '').split('\n');
  paragraphs.forEach((para, pIdx) => {
    for (const run of splitMarkdownRuns(para)) {
      const words = run.text.split(' ');
      for (let w = 0; w < words.length; w++) {
        const src = words[w];
        const suffix = w < words.length - 1 ? ' ' : '';
        if (src === '') {
          // Empty word at a **marker** boundary — its separating space joins
          // the previous token so "aa **BB** cc" tokenizes as "aa ", "BB ".
          if (suffix && line.length > 0) line[line.length - 1].word += suffix;
          continue;
        }
        const word = src + suffix;
        const ww = measure(word, run.bold);
        if (lineW > 0 && lineW + ww > maxWidth) {
          flush();
          line = [{ word, bold: run.bold }];
          lineW = ww;
        } else {
          line.push({ word, bold: run.bold });
          lineW += ww;
        }
      }
    }
    if (pIdx < paragraphs.length - 1) flush(); // explicit \n forces a break
  });
  flush(); // final line
  return lines;
}
