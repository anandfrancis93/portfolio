// One reading of a shell command line, shared by the guards, so both hooks split a command into
// the same segments and read the same tokens. A segment is what a shell would run as one step:
// the pieces between newlines, `&&`, `||`, `;` and `|` that sit outside quotes, with a heredoc
// body kept inside the segment that opens it. Tokens are the whitespace-separated words of a
// segment with their surrounding quotes stripped.

/** Splits outside single and double quotes; a heredoc body stays with its opening line. */
export function segments(command) {
  const text = String(command);
  const out = [];
  let current = '';
  let quote = null;
  let i = 0;
  const push = () => {
    const segment = current.trim();
    if (segment) out.push(segment);
    current = '';
  };
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === '<' && next === '<') {
      // A heredoc: everything up to the line that is the terminator belongs to this segment.
      const m = /^<<-?\s*(["']?)([A-Za-z_][\w-]*)\1/.exec(text.slice(i));
      if (m) {
        const end = text.indexOf(`\n${m[2]}`, i);
        const stop = end === -1 ? text.length : end + 1 + m[2].length;
        current += text.slice(i, stop);
        i = stop;
        continue;
      }
    }
    if (ch === '\n' || ch === ';') {
      push();
      i += 1;
      continue;
    }
    if ((ch === '&' && next === '&') || (ch === '|' && next === '|')) {
      push();
      i += 2;
      continue;
    }
    if (ch === '|') {
      push();
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  push();
  return out;
}

export const stripQuotes = (token) => token.replace(/^["']+|["']+$/g, '');

export const tokens = (segment) => segment.split(/\s+/).filter(Boolean).map(stripQuotes);

/** The first word of a segment that is a command, skipping leading VAR=value assignments. */
export const commandWord = (words) => words.find((w) => !/^[A-Za-z_]\w*=/.test(w)) ?? '';
