// The inline scripts of a built page, in document order: every <script> element with no src.
// Two build steps need exactly this, the budget check and the headers writer, and they must
// agree, since one measures what the other hashes into the content security policy, so the
// parsing lives here once.
//
// Tag names in HTML are case-insensitive, so the match is too: CodeQL's js/bad-tag-filter
// caught the earlier expressions missing <SCRIPT> (alerts 1 and 2, 4 September 2026). An
// attribute value may hold a > inside quotes, so the attribute part reads quoted strings
// rather than stopping at the first bracket.
//
// It reads our own build output, never untrusted HTML, and the callers assert what they expect
// to find, so this is a parser for a known shape, not a sanitiser.

const SCRIPT = /<script\b((?:"[^"]*"|'[^']*'|[^>])*)>([\s\S]*?)<\/script\s*>/gi;
const HAS_SRC = /\bsrc\s*=/i;

/**
 * @param {string} html the page's markup
 * @returns {string[]} the body of each inline script, in document order
 */
export function inlineScripts(html) {
  const bodies = [];
  for (const [, attributes, body] of html.matchAll(SCRIPT)) {
    if (!HAS_SRC.test(attributes)) bodies.push(body);
  }
  return bodies;
}
