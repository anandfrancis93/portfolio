// The task eval's tasks and graders (the runbook, "Task evals"): three pieces of real work a
// session is asked for, each with a grader that reads the worktree the agent worked in and says
// pass or fail with reasons. A grader is pure over what the runner hands it: the changed paths,
// the unified diff, `run` to execute a command in the worktree, `read` for a file there and
// `original` for the same file at HEAD, so the configuration tests grade fixtures without
// spending a token. The two readings of git's status the runner needs live here for the same
// reason. scripts/eval-tasks.mjs runs them.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** What the test guard fences in a fix task: the tests, the gate files, the hook's own files. */
const FENCED = [
  /^tests\//,
  /\.(spec|test)\.[cm]?[jt]sx?$/,
  /^(playwright\.config\.[cm]?[jt]s|stylelint\.config\.[cm]?js|\.htmlvalidate\.json|tsconfig\.json|\.gitattributes|package\.json|REVIEW\.md)$/,
  /^lighthouserc[^/]*\.[cm]?js$/,
  /^\.github\/(workflows\/|expiry\.json$)/,
  /^scripts\/(check-[^/]+|lighthouse|postbuild)\.mjs$/,
  /^src\/config\/pairings\.mjs$/,
  /^\.claude\/(hooks\/|settings(\.local)?\.json$|FIX_TASK$)/,
];
export const isFenced = (path) => FENCED.some((re) => re.test(path));

/** Generated stylesheets: a change there is a change to the skill or the fallback script. */
const GENERATED = new Set(["src/styles/tokens.css", "src/styles/fonts.fallback.css"]);

export const PROFILE = "src/content/profile.yaml";
export const MARKER = ".claude/FIX_TASK";

/**
 * The facts the copy task must keep, as the paragraph carries them today. The configuration
 * tests check each is in the paragraph at HEAD, so this list follows the copy when it changes.
 */
export const FACTS = [
  "eleven years",
  "AT&T",
  "American Express",
  "Cvent",
  "Google",
  "Dell",
  "2023",
  "Brigham Young University – Idaho",
];

/** The lines a unified diff adds, without their leading +, file headers excluded. */
export const addedLines = (diff) =>
  diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));

/** The entries of `git status --porcelain=v1 -z`, as `[code, path]`, paths with forward slashes. */
export function parseStatus(text) {
  const fields = text.split("\0").filter(Boolean);
  const entries = [];
  for (let i = 0; i < fields.length; i += 1) {
    const code = fields[i].slice(0, 2);
    entries.push([code, fields[i].slice(3).replace(/\\/g, "/")]);
    // A rename or copy carries its source in the next field.
    if (/^[RC]/.test(code)) i += 1;
  }
  return entries;
}

/**
 * Every path the session changed or created, the fix-mode marker excluded. Git measures against
 * HEAD, so a seeded file is asked separately: it is the session's change when its content,
 * `read` now, moved from the seed, towards HEAD (the fix) or anywhere else, and not when it still
 * holds the seed.
 */
export function changedPaths(entries, seeded, read) {
  const changed = entries
    .map(([, path]) => path)
    .filter((path) => path !== MARKER && !Object.hasOwn(seeded, path));
  for (const [path, content] of Object.entries(seeded)) {
    if (read(path) !== content) changed.push(path);
  }
  return [...new Set(changed)].sort();
}

/**
 * The first paragraph under `about:` in the profile, as its block of lines (`text`) and the
 * file with that block taken out (`rest`), so a grader can ask whether anything else moved. Any
 * block style is accepted, folded or literal, since a rewrite may change it.
 */
export function firstAboutParagraph(yaml) {
  const lines = yaml.split("\n");
  const at = lines.findIndex((line) => /^about:/.test(line));
  if (at < 0) return null;
  let start = -1;
  let indent = 0;
  for (let i = at + 1; i < lines.length; i += 1) {
    if (/^\S/.test(lines[i])) break;
    const m = /^(\s+)- [>|]-?\s*$/.exec(lines[i]);
    if (m) {
      start = i;
      indent = m[1].length;
      break;
    }
  }
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") {
      const next = lines.slice(end + 1).find((l) => l.trim() !== "");
      if (next === undefined || /^\s*/.exec(next)[0].length <= indent) break;
    } else if (/^\s*/.exec(line)[0].length <= indent) {
      break;
    }
    end += 1;
  }
  return {
    text: lines.slice(start, end).join("\n"),
    rest: [...lines.slice(0, start), ...lines.slice(end)].join("\n"),
  };
}

/** A block's prose as YAML folds it: one line, one space per break, case apart. */
const folded = (block) =>
  block
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .join(" ")
    .toLowerCase();

const firstLine = (result) =>
  `${result.stderr || result.stdout || ""}`.trim().split(/\r?\n/)[0] ?? "";

/**
 * Copy: only the profile changes, and in it only the first about paragraph; the paragraph
 * differs from HEAD's and, folded as YAML reads it, still carries every fact in FACTS; the
 * content and voice checks pass, which is where the quote and the fixed facts elsewhere in the
 * file are held.
 */
export function gradeCopy({ changed, run, read, original }) {
  const reasons = [];
  if (changed.length === 0) return { pass: false, reasons: ["nothing changed"] };
  for (const path of changed) if (path !== PROFILE) reasons.push(`touched ${path}`);
  if (!changed.includes(PROFILE)) reasons.push("profile.yaml unchanged");
  const before = original(PROFILE);
  const after = read(PROFILE);
  const was = before === null ? null : firstAboutParagraph(before);
  const now = after === null ? null : firstAboutParagraph(after);
  if (!was || !now) {
    reasons.push("the first about paragraph could not be found");
  } else {
    if (now.text === was.text) reasons.push("the paragraph is as it was");
    if (now.rest !== was.rest) reasons.push("changed more than the first about paragraph");
    const text = folded(now.text);
    for (const fact of FACTS) {
      if (!text.includes(fact.toLowerCase())) reasons.push(`lost "${fact}"`);
    }
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
 * one test catches. Returns the paths it wrote, so the runner can tell the seed from the fix.
 * Throws if the line it expects is not there, so a rewrite of the parser is noticed here rather
 * than by a task that has nothing to fix.
 */
export function seedFix(root) {
  const path = "scripts/lib/inline-scripts.mjs";
  const file = resolve(root, path);
  const source = readFileSync(file, "utf8");
  const seeded = source.replace(
    "const HAS_SRC = /\\bsrc\\s*=/i;",
    "const HAS_SRC = /\\bsrc\\s*=/;",
  );
  if (seeded === source) throw new Error("the seed found nothing to break in inline-scripts.mjs");
  writeFileSync(file, seeded);
  return [path];
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
