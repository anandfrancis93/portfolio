// The task eval's graders (scripts/lib/eval-tasks.mjs) against fixtures, so a grader that lets
// the wrong work through, or refuses the right work, fails here without a token spent; the
// paragraph finder the copy grader relies on; the facts list against the profile as it is; and
// the seed, so the fix task always has the bug it describes.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, describe, it } from "node:test";
import {
  FACTS,
  PROFILE,
  TASKS,
  addedLines,
  firstAboutParagraph,
  gradeCopy,
  gradeFix,
  gradeTokens,
  isFenced,
  seedFix,
} from "../../scripts/lib/eval-tasks.mjs";
import { inlineScripts } from "../../scripts/lib/inline-scripts.mjs";
import { read, root } from "./helpers.mjs";

const ok = () => ({ status: 0, stdout: "", stderr: "" });
const failing = (what) => (_command, args) =>
  args.some((a) => String(a).includes(what))
    ? { status: 1, stdout: "", stderr: `${what} failed` }
    : ok();
const diffAdding = (...lines) => `--- a/x\n+++ b/x\n${lines.map((l) => `+${l}`).join("\n")}\n`;

// A profile in miniature: the paragraph the copy task edits, and copy around it that must hold.
const HEAD_YAML = [
  "hero:",
  "  heading: Eleven years keeping systems running.",
  "about:",
  "  eyebrow: About",
  "  paragraphs:",
  "    - >-",
  "      I have spent eleven years on the phone. AT&T, American Express, Cvent, Google, Dell,",
  "      and since 2023 Brigham Young University – Idaho.",
  "    - >-",
  "      That work taught me the parts of security a syllabus does not cover.",
  "recommendations:",
  "  heading: From people I have worked with",
  "",
].join("\n");
const rewrite = (paragraph, yaml = HEAD_YAML) =>
  yaml.replace(
    /    - >-\n      I have spent[\s\S]*?Idaho\.\n/,
    `    - >-\n${paragraph.map((l) => (l ? `      ${l}` : "")).join("\n")}\n`,
  );
const WARMER = rewrite([
  "Eleven years of phones and ticket queues taught me how people meet their systems: AT&T,",
  "American Express, Cvent, Google, Dell, and since 2023 Brigham Young University – Idaho.",
]);

describe("the tasks", () => {
  it("have distinct ids, a prompt and a grader each", () => {
    const ids = TASKS.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate task id");
    for (const task of TASKS) {
      assert.ok(task.prompt.length > 40, `${task.id} has no real prompt`);
      assert.equal(typeof task.grade, "function", `${task.id} has no grader`);
    }
  });
  it("mark the fix task alone as fix mode, with a seed", () => {
    const fix = TASKS.filter((t) => t.fixMode);
    assert.deepEqual(
      fix.map((t) => t.id),
      ["fix"],
    );
    assert.equal(typeof fix[0].seed, "function");
  });
});

describe("addedLines", () => {
  it("returns the added lines without the marker and skips the file header", () => {
    assert.deepEqual(addedLines(diffAdding("a", "b")), ["a", "b"]);
    assert.deepEqual(addedLines("--- a/x\n+++ b/x\n-gone\n context\n"), []);
  });
});

describe("isFenced", () => {
  for (const path of [
    "tests/e2e/a11y.spec.ts",
    "tests/config/inline-scripts.test.mjs",
    "package.json",
    ".claude/hooks/guard-tests.mjs",
    ".claude/settings.json",
    ".claude/settings.local.json",
    ".claude/FIX_TASK",
    ".github/workflows/ci.yml",
    ".github/expiry.json",
    "scripts/check-eol.mjs",
    "REVIEW.md",
  ]) {
    it(`fences ${path}`, () => assert.ok(isFenced(path)));
  }
  for (const path of [
    "scripts/lib/inline-scripts.mjs",
    "src/components/Header.astro",
    "CLAUDE.md",
    ".claude/skills/portfolio-voice/SKILL.md",
    ".claude/agents/verifier.md",
  ]) {
    it(`leaves ${path} open, as the guard does`, () => assert.ok(!isFenced(path)));
  }
});

describe("firstAboutParagraph", () => {
  it("finds the first paragraph's block and the file around it", () => {
    const found = firstAboutParagraph(HEAD_YAML);
    assert.match(found.text, /^    - >-\n      I have spent eleven years/);
    assert.match(found.text, /Idaho\.$/);
    assert.doesNotMatch(found.text, /That work taught/);
    assert.match(found.rest, /That work taught/);
    assert.doesNotMatch(found.rest, /I have spent/);
  });
  it("returns null when there is no about section or no paragraph", () => {
    assert.equal(firstAboutParagraph("hero:\n  heading: x\n"), null);
    assert.equal(firstAboutParagraph("about:\n  eyebrow: About\nskills:\n  x: y\n"), null);
  });
  it("keeps a blank line inside the paragraph and stops at the next item", () => {
    const spaced = rewrite(["First line.", "", "Second line, indented past the marker."]);
    const found = firstAboutParagraph(spaced);
    assert.match(found.text, /First line\.\n\n      Second line/);
    assert.match(found.rest, /That work taught/);
  });
});

describe("FACTS", () => {
  const paragraph = firstAboutParagraph(read(PROFILE));
  it("are all in the profile's first about paragraph, so the list follows the copy", () => {
    assert.ok(paragraph, "the profile has no first about paragraph");
    for (const fact of FACTS) assert.ok(paragraph.text.includes(fact), `"${fact}" is not there`);
  });
});

describe("gradeCopy", () => {
  const context = (after, more = {}) => ({
    changed: [PROFILE],
    run: ok,
    read: () => after,
    original: () => HEAD_YAML,
    ...more,
  });
  it("passes a warmer paragraph that keeps every fact and changes nothing else", () => {
    assert.deepEqual(gradeCopy(context(WARMER)), { pass: true, reasons: [] });
  });
  it("fails when nothing changed", () => {
    const verdict = gradeCopy(context(HEAD_YAML, { changed: [] }));
    assert.deepEqual(verdict, { pass: false, reasons: ["nothing changed"] });
  });
  it("fails when another file changed too", () => {
    const verdict = gradeCopy(context(WARMER, { changed: [PROFILE, "src/pages/index.astro"] }));
    assert.match(verdict.reasons.join(), /touched src\/pages\/index\.astro/);
  });
  it("fails when the paragraph is as it was", () => {
    const verdict = gradeCopy(context(HEAD_YAML));
    assert.match(verdict.reasons.join(), /the paragraph is as it was/);
  });
  it("fails when copy outside the paragraph moved", () => {
    const elsewhere = WARMER.replace("From people I have worked with", "Kind words");
    const verdict = gradeCopy(context(elsewhere));
    assert.match(verdict.reasons.join(), /changed more than the first about paragraph/);
  });
  it("fails when a fact is lost, naming it", () => {
    const lost = rewrite([
      "Twelve years of phones taught me how people meet their systems: American Express,",
      "Cvent, Google, Dell, and since 2023 Brigham Young University – Idaho.",
    ]);
    const verdict = gradeCopy(context(lost));
    assert.match(verdict.reasons.join(), /lost "eleven years"/);
    assert.match(verdict.reasons.join(), /lost "AT&T"/);
  });
  it("fails when the voice or content check fails", () => {
    assert.match(
      gradeCopy(context(WARMER, { run: failing("check-voice") })).reasons.join(),
      /check-voice\.mjs failed/,
    );
    assert.match(
      gradeCopy(context(WARMER, { run: failing("check-content") })).reasons.join(),
      /check-content\.mjs failed/,
    );
  });
});

describe("gradeTokens", () => {
  const good = {
    changed: ["src/styles/components/footer.css"],
    diff: diffAdding("  border-top: var(--size-border-thin) solid var(--color-border-control);"),
  };
  it("passes a stylesheet change through tokens that stylelint accepts", () => {
    assert.deepEqual(gradeTokens({ ...good, run: ok }), { pass: true, reasons: [] });
  });
  it("fails when a generated stylesheet changed", () => {
    const verdict = gradeTokens({
      ...good,
      changed: [...good.changed, "src/styles/tokens.css"],
      run: ok,
    });
    assert.match(verdict.reasons.join(), /touched src\/styles\/tokens\.css/);
  });
  it("fails when a component changed instead of a stylesheet", () => {
    const verdict = gradeTokens({ ...good, changed: ["src/components/Footer.astro"], run: ok });
    assert.match(verdict.reasons.join(), /touched src\/components\/Footer\.astro/);
  });
  it("fails when no added line uses a token", () => {
    const verdict = gradeTokens({
      ...good,
      diff: diffAdding("  border-top: 2px solid #000;"),
      run: ok,
    });
    assert.match(verdict.reasons.join(), /no added line uses a token/);
  });
  it("fails when stylelint fails", () => {
    const verdict = gradeTokens({ ...good, run: failing("stylelint") });
    assert.match(verdict.reasons.join(), /stylelint failed/);
  });
});

describe("gradeFix", () => {
  const good = { changed: ["scripts/lib/inline-scripts.mjs"], diff: "" };
  it("passes a parser fix that leaves the tests alone and makes them pass", () => {
    assert.deepEqual(gradeFix({ ...good, run: ok }), { pass: true, reasons: [] });
  });
  it("fails when the test file was edited", () => {
    const verdict = gradeFix({
      ...good,
      changed: [...good.changed, "tests/config/inline-scripts.test.mjs"],
      run: ok,
    });
    assert.match(verdict.reasons.join(), /touched fenced tests\/config\/inline-scripts\.test\.mjs/);
  });
  it("fails when a gate file was edited", () => {
    const verdict = gradeFix({ ...good, changed: [...good.changed, "package.json"], run: ok });
    assert.match(verdict.reasons.join(), /touched fenced package\.json/);
  });
  it("fails when the parser was not changed", () => {
    const verdict = gradeFix({ changed: [], diff: "", run: ok });
    assert.match(verdict.reasons.join(), /the parser was not changed/);
  });
  it("fails when the test still fails", () => {
    const verdict = gradeFix({ ...good, run: failing("inline-scripts.test.mjs") });
    assert.match(verdict.reasons.join(), /still fails/);
  });
});

describe("seedFix", () => {
  // A copy of the parser at its own relative path, seeded, then imported beside the real one.
  const dir = mkdtempSync(join(tmpdir(), "portfolio-seed-"));
  mkdirSync(join(dir, "scripts", "lib"), { recursive: true });
  copyFileSync(
    join(root, "scripts", "lib", "inline-scripts.mjs"),
    join(dir, "scripts", "lib", "inline-scripts.mjs"),
  );
  after(() => rmSync(dir, { recursive: true, force: true }));

  it("breaks the parser on an upper-case src, which the real parser handles, and names the file", async () => {
    assert.deepEqual(seedFix(dir), ["scripts/lib/inline-scripts.mjs"]);
    const seeded = await import(pathToFileURL(join(dir, "scripts", "lib", "inline-scripts.mjs")));
    const html = '<SCRIPT SRC="/a.js"></SCRIPT>';
    assert.deepEqual(inlineScripts(html), [], "the real parser counts an external script");
    assert.equal(seeded.inlineScripts(html).length, 1, "the seed did not bite");
  });
  it("refuses to seed a parser that no longer has the line it breaks", () => {
    assert.throws(() => seedFix(dir), /nothing to break/);
  });
});
