// The task eval's graders (scripts/lib/eval-tasks.mjs) against fixtures, so a grader that lets
// the wrong work through, or refuses the right work, fails here without a token spent; and the
// seed, so the fix task always has the bug it describes.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, describe, it } from "node:test";
import {
  TASKS,
  addedLines,
  gradeCopy,
  gradeFix,
  gradeTokens,
  isFenced,
  seedFix,
} from "../../scripts/lib/eval-tasks.mjs";
import { inlineScripts } from "../../scripts/lib/inline-scripts.mjs";
import { root } from "./helpers.mjs";

const ok = () => ({ status: 0, stdout: "", stderr: "" });
const failing = (what) => (command, args) =>
  args.some((a) => String(a).includes(what))
    ? { status: 1, stdout: "", stderr: `${what} failed` }
    : ok();
const diffAdding = (...lines) => `--- a/x\n+++ b/x\n${lines.map((l) => `+${l}`).join("\n")}\n`;

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
  ]) {
    it(`leaves ${path} open`, () => assert.ok(!isFenced(path)));
  }
});

describe("gradeCopy", () => {
  const good = {
    changed: ["src/content/profile.yaml"],
    diff: diffAdding("      I have spent eleven warm years"),
  };
  it("passes a profile-only change that keeps the checks green", () => {
    assert.deepEqual(gradeCopy({ ...good, run: ok }), { pass: true, reasons: [] });
  });
  it("fails when nothing changed", () => {
    const verdict = gradeCopy({ changed: [], diff: "", run: ok });
    assert.equal(verdict.pass, false);
    assert.match(verdict.reasons.join(), /nothing changed/);
  });
  it("fails when another file changed too", () => {
    const verdict = gradeCopy({
      ...good,
      changed: [...good.changed, "src/pages/index.astro"],
      run: ok,
    });
    assert.match(verdict.reasons.join(), /touched src\/pages\/index\.astro/);
  });
  it("fails when the voice check fails", () => {
    const verdict = gradeCopy({ ...good, run: failing("check-voice") });
    assert.match(verdict.reasons.join(), /check-voice\.mjs failed/);
  });
  it("fails when the content check fails", () => {
    const verdict = gradeCopy({ ...good, run: failing("check-content") });
    assert.match(verdict.reasons.join(), /check-content\.mjs failed/);
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

  it("breaks the parser on an upper-case src, which the real parser handles", async () => {
    seedFix(dir);
    const seeded = await import(pathToFileURL(join(dir, "scripts", "lib", "inline-scripts.mjs")));
    const html = '<SCRIPT SRC="/a.js"></SCRIPT>';
    assert.deepEqual(inlineScripts(html), [], "the real parser counts an external script");
    assert.equal(seeded.inlineScripts(html).length, 1, "the seed did not bite");
  });
  it("refuses to seed a parser that no longer has the line it breaks", () => {
    assert.throws(() => seedFix(dir), /nothing to break/);
  });
});
