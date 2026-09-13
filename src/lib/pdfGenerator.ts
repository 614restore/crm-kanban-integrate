// Copied from QuoteMGR (quotes-customize-manage/src/lib/pdfGenerator.ts): only the
// WinAnsi text folding that WorkOrderPanel needs, not QuoteMGR's quote PDF builders.
import jsPDF from 'jspdf';

// ─── WinAnsi text folding ────────────────────────────────────────────────────
// jsPDF's built-in fonts are WinAnsi-only. A character outside that set is
// written as its raw low byte, so "≈" came out as `"H` and the minus sign in
// "1708 sqft deck − 306 sqft" collapsed into a stray quote. Embedding a Unicode
// font would add hundreds of KB to every emailed PDF, so fold the symbols we
// actually use down to characters WinAnsi can represent instead. The safe list
// and the failures below were both confirmed against jsPDF's own output.
const WINANSI_SAFE_ABOVE_LATIN1 = new Set([
  '\u2014', '\u2013', '\u2022', '\u2026', '\u2122', '\u2020', '\u2021',
  '\u2018', '\u2019', '\u201C', '\u201D', '\u20AC',
]);

const SYMBOL_FALLBACKS: Record<string, string> = {
  '\u2212': '-',        // minus sign
  '\u2248': '~',        // almost equal to
  '\u2260': '!=',
  '\u2264': '<=',
  '\u2265': '>=',
  '\u2192': '->',
  '\u2190': '<-',
  '\u2194': '<->',
  '\u2197': '^',
  '\u2713': '\u2022',   // check mark -> bullet
  '\u2714': '\u2022',
  '\u2717': '\u00D7',   // ballot X -> multiplication sign
  '\u2715': '\u00D7',
  '\u2605': '*',
  '\u2606': '*',
  '\u2726': '*',
  '\u26A0': '!',
  '\u2032': "'",        // prime -> apostrophe (feet)
  '\u2033': '"',        // double prime -> quote (inches)
  '\u25CF': '\u2022',
  '\u25CB': 'o',
  '\u25B2': '^',
  '\u25BC': 'v',
  '\u25BE': 'v',
  '\u22EE': ':',
  '\u2500': '-',        // box drawing, used in section rules
  '\u2550': '=',
  '\u00A0': ' ',        // non-breaking space
};

const toWinAnsi = (value: string): string => {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0xff || WINANSI_SAFE_ABOVE_LATIN1.has(ch)) {
      out += ch;
      continue;
    }
    // Anything still unmapped — emoji above all — would print as garbage bytes,
    // so drop it rather than let it reach the page.
    out += SYMBOL_FALLBACKS[ch] ?? '';
  }
  return out;
};

// Routes every string drawn on this document through the fold, including the
// ones jspdf-autotable writes into table cells.
export const foldDocumentText = (doc: jsPDF): void => {
  const drawText = doc.text.bind(doc);
  (doc as unknown as { text: unknown }).text = ((
    text: string | string[],
    x: number,
    y: number,
    ...rest: unknown[]
  ) => drawText(
    Array.isArray(text) ? text.map(toWinAnsi) : toWinAnsi(String(text)),
    x,
    y,
    ...(rest as []),
  )) as typeof doc.text;
};
