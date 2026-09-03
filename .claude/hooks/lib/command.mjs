// One reading of a shell command line, shared by the guards, so both hooks split a command into
// the same segments and read the same tokens. A segment is what a shell would run as one step:
// the pieces between newlines, `&&`, `||`, `;` and `|`. Tokens are the whitespace-separated words
// of a segment with their surrounding quotes stripped.
export const segments = (command) =>
  String(command)
    .split(/\r?\n|&&|\|\||;|\|/)
    .map((segment) => segment.trim())
    .filter(Boolean);

export const stripQuotes = (token) => token.replace(/^["']+|["']+$/g, '');

export const tokens = (segment) => segment.split(/\s+/).filter(Boolean).map(stripQuotes);

/** The first word of a segment that is a command, skipping leading VAR=value assignments. */
export const commandWord = (words) => words.find((w) => !/^[A-Za-z_]\w*=/.test(w)) ?? '';
