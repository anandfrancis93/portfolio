// The inline scripts of a built page, in document order: every <script> element with no src.
// Two build steps need exactly this, the budget check and the headers writer, and they must
// agree, since one measures what the other hashes into the content security policy, so the
// parsing lives here once.
//
// Tag names in HTML are case-insensitive, so the match is too: CodeQL's js/bad-tag-filter
// caught the earlier expressions missing <SCRIPT> (alerts 1 and 2, 4 September 2026). An
// attribute value may hold a > inside quotes, so the attribute part reads quoted strings
// rather than stopping at the first bracket; the unquoted alternative excludes both quote
// characters, which keeps the alternation unambiguous, and so keeps the expression linear.
// Whether an element is external is decided after the quoted values are removed, so a src
// inside a value, data-src="src=1", never disguises an inline script as an external one.
//
// It reads our own build output, never untrusted HTML, so this is a parser for a known shape,
// not a sanitiser. Two shapes it does not understand, neither of which the compiler emits: a
// script inside an HTML comment is counted, and an unbalanced quote in an attribute makes the
// element unreadable, so it is skipped. Either way the headers writer refuses to go on, since
// it asserts one inline script per page and one hash across them; the budget check asserts
// nothing of its own and is covered only because postbuild runs the headers writer first.

const SCRIPT = /<script\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/script(?:[\s/][^>]*)?>/gi;
const QUOTED = /"[^"]*"|'[^']*'/g;
const HAS_SRC = /\bsrc\s*=/i;

/**
 * @param {string} html the page's markup
 * @returns {string[]} the body of each inline script, in document order
 */
export function inlineScripts(html) {
  const bodies = [];
  for (const [, attributes, body] of html.matchAll(SCRIPT)) {
    if (!HAS_SRC.test(attributes.replace(QUOTED, ""))) bodies.push(body);
  }
  return bodies;
}
