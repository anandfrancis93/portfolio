// The task eval's tasks and graders (the runbook, "Task evals"): three pieces of real work a
// session is asked for, each with a grader that reads the worktree the agent worked in and says
// pass or fail with reasons. A grader is pure over what the runner hands it, the changed paths,
// the unified diff and a `run` that executes a command in the worktree, so the configuration
// tests grade fixtures without spending a token. scripts/eval-tasks.mjs runs them.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** The tests and the files that decide what the gates check, as the test guard fences them. */
const FENCED = [
  /^tests\//,
  /\.(spec|test)\.[cm]?[jt]sx?$/,
  /^(playwright\.config\.[cm]?[jt]s|stylelint\.config\.[cm]?js|\.htmlvalidate\.json|tsconfig\.json|\.gitattributes|package\.json|REVIEW\.md)$/,
  /^lighthouserc[^/]*\.[cm]?js$/,
  /^\.github\/(workflows\/|expiry\.json$)/,
  /^scripts\/(check-[^/]+|lighthouse|postbuild)\.mjs$/,
  /^src\/config\/pairings\.mjs$/,
  /^\.claude\//,
];
export const isFenced = (path) => FENCED.some((re) => re.test(path));

/** Generated stylesheets: a change there is a change to the skill or the fallback script. */
const GENERATED = new Set(["src/styles/tokens.css", "src/styles/fonts.fallback.css"]);

/** The lines a unified diff adds, without their leading +, file headers excluded. */
export const addedLines = (diff) =>
  diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));

const firstLine = (result) =>
  `${result.stderr || result.stdout || ""}`.trim().split(/\r?\n/)[0] ?? "";

/** Copy: only profile.yaml changes, and the content and voice checks still pass. */
export function gradeCopy({ changed, diff, run }) {
  const reasons = [];
  if (changed.length === 0) reasons.push("nothing changed");
  if (changed.length > 0 && !changed.includes("src/content/profile.yaml")) {
    reasons.push("profile.yaml unchanged");
  }
  for (const path of changed) {
    if (path !== "src/content/profile.yaml") reasons.push(`touched ${path}`);
  }
  if (changed.length > 0 && !addedLines(diff).some((line) => /\S/.test(line))) {
    reasons.push("no line added");
  }
  for (const script of ["scripts/check-content.mjs", "scripts/check-voice.mjs"]) {
    const result = run(process.execPath, [script]);
    if (result.status !== 0) reasons.push(`${script} failed: ${firstLine(result)}`);
  }
  return { pass: reasons.length === 0, reasons };
}

/** Styling: only hand-written stylesheets change, through tokens, and stylelint agrees. */
export function gradeTokens({ changed, diff, run }) {
  const reasons = [];
  if (changed.length === 0) reasons.push("nothing changed");
  const css = changed.filter((path) => /^src\/styles\/.*\.css$/.test(path) && !GENERATED.has(path));
  for (const path of changed) if (!css.includes(path)) reasons.push(`touched ${path}`);
  if (changed.length > 0 && !addedLines(diff).some((line) => /var\(--/.test(line))) {
    reasons.push("no added line uses a token");
  }
  if (css.length > 0) {
    const result = run(process.execPath, [
      "node_modules/stylelint/bin/stylelint.mjs",
      ...css,
      "--formatter",
      "compact",
    ]);
    if (result.status !== 0) reasons.push(`stylelint failed: ${firstLine(result)}`);
  }
  return { pass: reasons.length === 0, reasons };
}

/** A fix under the marker: the parser changes, nothing fenced does, and the test passes. */
export function gradeFix({ changed, run }) {
  const reasons = [];
  if (!changed.includes("scripts/lib/inline-scripts.mjs"))
    reasons.push("the parser was not changed");
  for (const path of changed) if (isFenced(path)) reasons.push(`touched fenced ${path}`);
  const result = run(process.execPath, ["--test", "tests/config/inline-scripts.test.mjs"]);
  if (result.status !== 0) reasons.push("inline-scripts.test.mjs still fails");
  return { pass: reasons.length === 0, reasons };
}

/**
 * Breaks the parser in the worktree so the fix task has a bug to fix: the src attribute check
 * loses its case-insensitive flag, and an upper-case SRC is counted as an inline script, which
 * one test catches. Throws if the line it expects is not there, so a rewrite of the parser is
 * noticed here rather than by a task that has nothing to fix.
 */
export function seedFix(root) {
  const file = resolve(root, "scripts/lib/inline-scripts.mjs");
  const source = readFileSync(file, "utf8");
  const seeded = source.replace(
    "const HAS_SRC = /\\bsrc\\s*=/i;",
    "const HAS_SRC = /\\bsrc\\s*=/;",
  );
  if (seeded === source) throw new Error("the seed found nothing to break in inline-scripts.mjs");
  writeFileSync(file, seeded);
}

/** Worded as a user would ask, one piece of work each. */
export const TASKS = [
  {
    id: "copy",
    prompt:
      "In src/content/profile.yaml, rewrite the first paragraph under `about` so it reads warmer " +
      "and more personal, keeping every fact, name, number and date exactly as it is and changing " +
      "nothing else in the file. Run `node scripts/check-voice.mjs` and " +
      "`node scripts/check-content.mjs` before you finish.",
    grade: gradeCopy,
  },
  {
    id: "tokens",
    prompt:
      "Make the site footer's top border one step stronger, so it separates the footer from the " +
      "page more clearly. Change only stylesheets.",
    grade: gradeTokens,
  },
  {
    id: "fix",
    fixMode: true,
    seed: seedFix,
    prompt:
      "`pnpm test:config` fails in tests/config/inline-scripts.test.mjs: a script element whose " +
      'src attribute is written in upper case, `<SCRIPT SRC="/a.js">`, is counted as an inline ' +
      "script. This is a fix task and the marker .claude/FIX_TASK is set. Fix the code so the " +
      "test passes, and run `node --test tests/config/inline-scripts.test.mjs` to confirm.",
    grade: gradeFix,
  },
];
