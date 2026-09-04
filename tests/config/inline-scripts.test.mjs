// scripts/lib/inline-scripts.mjs: the parser the budget check and the headers writer share.
// The headers writer hashes what it returns into the content security policy, so a script it
// misses is a policy that blocks the page, and a script it invents is a hash for nothing.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inlineScripts } from "../../scripts/lib/inline-scripts.mjs";

describe("inlineScripts", () => {
  it("finds a lower case inline script", () => {
    assert.deepEqual(inlineScripts("<script>ok()</script>"), ["ok()"]);
  });

  it("finds an upper case one, since HTML tag names are case-insensitive", () => {
    assert.deepEqual(inlineScripts("<SCRIPT>ok()</SCRIPT>"), ["ok()"]);
  });

  it("finds a mixed case one, opening and closing tags apart", () => {
    assert.deepEqual(inlineScripts("<Script>ok()</script >"), ["ok()"]);
  });

  it("skips a script with a src, whatever the case of the attribute", () => {
    assert.deepEqual(inlineScripts('<script src="/a.js"></script>'), []);
    assert.deepEqual(inlineScripts('<SCRIPT SRC="/a.js"></SCRIPT>'), []);
    assert.deepEqual(inlineScripts("<script\n  SrC = '/a.js'></script>"), []);
  });

  it("keeps a script whose other attributes only look like src", () => {
    assert.deepEqual(inlineScripts('<script data-nosrc="1">ok()</script>'), ["ok()"]);
    assert.deepEqual(inlineScripts('<script type="module">ok()</script>'), ["ok()"]);
  });

  it("keeps a script carrying src inside an attribute value, not as an attribute", () => {
    assert.deepEqual(inlineScripts(`<script data-x="src=1">ok()</script>`), ["ok()"]);
    assert.deepEqual(inlineScripts(`<script data-x='SRC = 1'>ok()</script>`), ["ok()"]);
    const two = `<script>boot()</script><script data-x="src=1">second()</script>`;
    assert.deepEqual(inlineScripts(two), ["boot()", "second()"]);
  });

  it("closes on the end tags a browser honours, not only the bare one", () => {
    assert.deepEqual(inlineScripts("<script>ok()</script foo>"), ["ok()"]);
    assert.deepEqual(inlineScripts("<script>ok()</SCRIPT >"), ["ok()"]);
    assert.deepEqual(inlineScripts("<script>ok()</script/>"), ["ok()"]);
  });

  it("skips an element whose attribute quote never closes, rather than guessing", () => {
    assert.deepEqual(inlineScripts(`<script data-x="unclosed>ok()</script>`), []);
  });

  it("stays linear on an attribute list that never closes", () => {
    const input = `<script ${'"a"'.repeat(2000)}`;
    const start = process.hrtime.bigint();
    assert.deepEqual(inlineScripts(input), []);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.ok(ms < 1000, `took ${ms} ms; the alternation is backtracking again`);
  });

  it("gives the same answer when called twice, holding no state between calls", () => {
    const html = "<script>one</script><script>two</script>";
    assert.deepEqual(inlineScripts(html), inlineScripts(html));
  });

  it("reads an attribute value holding a closing bracket", () => {
    assert.deepEqual(inlineScripts(`<script data-x="a>b">ok()</script>`), ["ok()"]);
    assert.deepEqual(inlineScripts(`<script data-x='a>b'>ok()</script>`), ["ok()"]);
  });

  it("returns every inline script in document order and no external one", () => {
    const html = `<script>one</script><script src="/a.js"></script><SCRIPT>two</SCRIPT>`;
    assert.deepEqual(inlineScripts(html), ["one", "two"]);
  });

  it("keeps the body byte for byte, since the hash is taken over it", () => {
    const body = "\n  const a = '<b>';\n  document.title = a;\n";
    assert.deepEqual(inlineScripts(`<script>${body}</script>`), [body]);
  });

  it("finds nothing in a page with no script", () => {
    assert.deepEqual(inlineScripts("<html><body><p>hello</p></body></html>"), []);
  });

  it("does not match a tag that only starts like script", () => {
    assert.deepEqual(inlineScripts("<scripting>x</scripting>"), []);
  });
});
