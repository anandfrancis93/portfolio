// The task eval (the runbook, "Task evals"), run by hand after a change under .claude/ or to
// the model: gives headless Claude Code three pieces of real work, each in a throwaway worktree
// of the current commit outside the repository, and grades what it did with the graders in
// scripts/lib/eval-tasks.mjs. The skill eval proves a skill loads; this proves the work that
// follows holds to the skills, the hooks and CLAUDE.md. Draws on the developer's own
// subscription; not part of check or verify, and an agent never launches it, a dry run apart.
//   pnpm eval:tasks                  every task
//   pnpm eval:tasks --only fix       one task
//   pnpm eval:tasks --model sonnet   a different model
//   pnpm eval:tasks --keep           leave the worktrees in place, their paths printed
//   pnpm eval:tasks --dry-run        everything but the session: the worktrees, the seed, the
//                                    graders and the cleanup, so the plumbing is proven for free
//   pnpm eval:tasks --clean          only remove what an interrupted run left behind
// Prints the CLI version, the model and the commit, one line per task, then
// "Task eval: N tasks, N pass, N fail", and exits 1 on any fail.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TASKS } from "./lib/eval-tasks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  if (at < 0) return null;
  const value = args[at + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`${name} wants a value`);
    process.exit(1);
  }
  return value;
};
const model = option("--model");
const only = option("--only");
const keep = args.includes("--keep");
const dryRun = args.includes("--dry-run");
const cleanOnly = args.includes("--clean");

const git = (cwd, ...rest) => spawnSync("git", rest, { cwd, encoding: "utf8", windowsHide: true });
const claude = (rest, options = {}) =>
  spawnSync("claude", rest, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });

// The tools the session has and what it may not do with them. `--tools` decides which built-in
// tools exist at all, since `--allowedTools` only pre-approves and the developer's own settings
// would otherwise leave every tool they allow (the skill eval learned that on its first probe).
// The deny list is the mention workflow's, plus what a session on this machine could otherwise
// reach through Bash: pushing, gh, wrangler, a nested eval or CLI, and the checkout's own
// node_modules through the link. What a session can still reach is stated in the runbook; the
// run is trusted because the prompt and the tree are first-party, not because it is fenced.
const TOOLS = ["Read", "Glob", "Grep", "Edit", "Write", "MultiEdit", "Skill", "Bash"];
const ALLOWED = [
  ...TOOLS.filter((tool) => tool !== "Bash"),
  "Bash(node:*)",
  "Bash(pnpm test:config)",
  "Bash(pnpm check)",
  "Bash(pnpm exec stylelint:*)",
  "Bash(git diff:*)",
  "Bash(git status:*)",
].join(",");
const DISALLOWED = [
  "WebFetch",
  "WebSearch",
  "Agent",
  "NotebookEdit",
  "PowerShell",
  "Bash(git push:*)",
  "Bash(git commit:*)",
  "Bash(git worktree:*)",
  "Bash(gh:*)",
  "Bash(wrangler:*)",
  "Bash(pnpm exec wrangler:*)",
  "Bash(npx:*)",
  "Bash(node scripts/deploy.mjs:*)",
  "Bash(node scripts/rollback.mjs:*)",
  "Bash(pnpm run deploy:*)",
  "Bash(pnpm run rollback:*)",
  "Bash(pnpm eval:skills)",
  "Bash(pnpm eval:skills:*)",
  "Bash(pnpm eval:tasks)",
  "Bash(pnpm eval:tasks:*)",
  "Bash(node scripts/eval-skills.mjs:*)",
  "Bash(node scripts/eval-tasks.mjs:*)",
  "Bash(claude:*)",
  "Edit(node_modules/**)",
  "Write(node_modules/**)",
  "MultiEdit(node_modules/**)",
].join(",");

const PREFIX = "portfolio-eval-";

/**
 * Removes one eval worktree safely: the link first, on its own, since git sees a junction as a
 * directory and `worktree remove --force` would empty the checkout's own node_modules through
 * it; then the worktree, then the temp directory around it.
 */
function removeTree(tree) {
  const link = join(tree, "node_modules");
  if (existsSync(link) && lstatSync(link).isSymbolicLink()) unlinkSync(link);
  const removed = git(root, "worktree", "remove", "--force", tree);
  if (removed.status !== 0) {
    git(root, "worktree", "prune");
    rmSync(tree, { recursive: true, force: true });
  }
  const around = dirname(tree);
  if (basename(around).startsWith(PREFIX)) rmSync(around, { recursive: true, force: true });
}

/** Every worktree an interrupted run left under the temp directory, removed the same way. */
function cleanLeftovers() {
  const listed = git(root, "worktree", "list", "--porcelain").stdout ?? "";
  const trees = listed
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
    .filter((path) => path.includes(PREFIX));
  for (const tree of trees) {
    removeTree(tree);
    console.log(`Removed the leftover ${tree}`);
  }
  git(root, "worktree", "prune");
  return trees.length;
}

/** A worktree of HEAD outside the repository, sharing this checkout's node_modules by a link. */
function makeWorktree() {
  const dir = mkdtempSync(join(tmpdir(), PREFIX));
  const tree = join(dir, "tree");
  const added = git(root, "worktree", "add", "--detach", tree, "HEAD");
  if (added.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`git worktree add failed:\n${added.stderr}`);
  }
  symlinkSync(resolve(root, "node_modules"), join(tree, "node_modules"), "junction");
  return tree;
}

/** Runs one task's prompt in its worktree and returns what the session reported about itself. */
function runTask(task, tree) {
  if (dryRun) return { model: "none (dry run)", turns: 0, cost: null };
  const cli = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--tools",
    TOOLS.join(","),
    "--allowedTools",
    ALLOWED,
    "--disallowedTools",
    DISALLOWED,
    // No MCP servers: a server that waits for a browser or a login would stall a headless run.
    "--strict-mcp-config",
    // A ceiling on one task, where the CLI offers one, so a session that loops ends on its own.
    ...(maxTurns ? ["--max-turns", "40"] : []),
    ...(maxBudget ? ["--max-budget-usd", "3"] : []),
    ...(model ? ["--model", model] : []),
  ];
  // The prompt travels on stdin, so no shell and no quoting sit between this script and the CLI.
  const result = claude(cli, { input: task.prompt, cwd: tree, timeout: 20 * 60_000 });
  if (result.error)
    throw new Error(`Could not run claude for "${task.id}": ${result.error.message}`);
  const seen = { model: null, turns: null, cost: null };
  for (const line of (result.stdout ?? "").split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event?.type === "system" && event?.subtype === "init") {
      seen.model = event.model ?? null;
      // The session's first event lists the tools it had. Anything beyond the set means the
      // restriction did not take; the run is not a measurement of anything, so it stops.
      const extra = (event.tools ?? []).filter((tool) => !TOOLS.includes(tool));
      if (extra.length > 0) {
        throw new Error(`The headless session had tools beyond the set (${extra.join(", ")}).`);
      }
    }
    if (event?.type === "result") {
      seen.turns = event.num_turns ?? null;
      seen.cost = event.total_cost_usd ?? null;
    }
  }
  if (result.status !== 0 && seen.turns === null) {
    const tail = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim().split(/\r?\n/).slice(-5);
    throw new Error(`claude exited ${result.status} on "${task.id}":\n${tail.join("\n")}`);
  }
  return seen;
}

/** The status entries of the worktree as `[code, path]`, NUL-separated so any path survives. */
function statusEntries(tree) {
  const out = git(tree, "status", "--porcelain=v1", "-z", "--untracked-files=all").stdout ?? "";
  const fields = out.split("\0").filter(Boolean);
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
 * HEAD, so a seeded file is asked separately: it is the session's change when its content moved
 * from the seed, towards HEAD (the fix) or anywhere else, and not when it still holds the seed.
 */
function changedPaths(entries, seeded) {
  const changed = entries
    .map(([, path]) => path)
    .filter((path) => path !== ".claude/FIX_TASK" && !(path in seeded));
  return [...new Set(changed)].sort();
}

/** The tracked diff, with the content of every file the session created added as + lines. */
function fullDiff(tree, entries) {
  let diff = git(tree, "diff").stdout ?? "";
  for (const [code, path] of entries) {
    if (code !== "??" || path === ".claude/FIX_TASK") continue;
    const body = readFileSync(join(tree, path), "utf8");
    diff += `\n--- /dev/null\n+++ b/${path}\n${body
      .split(/\r?\n/)
      .map((line) => `+${line}`)
      .join("\n")}\n`;
  }
  return diff;
}

if (cleanOnly) {
  const count = cleanLeftovers();
  console.log(`Cleaned ${count} leftover worktree(s).`);
  process.exit(0);
}

const help = claude(["-p", "--help"]).stdout ?? "";
const maxTurns = /--max-turns/.test(help);
const maxBudget = /--max-budget-usd/.test(help);
const version = (claude(["--version"]).stdout ?? "").trim() || "unknown";
const head = (git(root, "rev-parse", "--short", "HEAD").stdout ?? "").trim();
const config = (
  git(root, "log", "-1", "--format=%h", "--", ".claude", "CLAUDE.md").stdout ?? ""
).trim();

const rows = only ? TASKS.filter((t) => t.id === only) : TASKS;
if (rows.length === 0) {
  console.error(`--only ${only} names no task; known: ${TASKS.map((t) => t.id).join(", ")}`);
  process.exit(1);
}
// The worktrees copy HEAD, so a tracked change, or an untracked file where the configuration
// lives, would make the run measure something other than the working tree.
const dirty = [
  git(root, "status", "--porcelain", "--untracked-files=no").stdout ?? "",
  git(root, "status", "--porcelain", "--untracked-files=all", "--", ".claude", "CLAUDE.md")
    .stdout ?? "",
].some((out) => out.trim());
if (dirty) {
  console.error(
    "The tree has changes to tracked files or under .claude/; commit or stash them first.",
  );
  process.exit(1);
}
cleanLeftovers();

let pass = 0;
let fail = 0;
let modelSeen = null;
let fatal = null;
for (const task of rows) {
  const tree = makeWorktree();
  try {
    const seeded = {};
    for (const path of task.seed ? task.seed(tree) : []) {
      seeded[path] = readFileSync(join(tree, path), "utf8");
    }
    if (task.fixMode) writeFileSync(join(tree, ".claude", "FIX_TASK"), "");
    const seen = runTask(task, tree);
    modelSeen ??= seen.model;
    const entries = statusEntries(tree);
    const changed = changedPaths(entries, seeded);
    for (const [path, content] of Object.entries(seeded)) {
      const file = join(tree, path);
      const now = existsSync(file) ? readFileSync(file, "utf8") : null;
      if (now !== content) changed.push(path);
    }
    changed.sort();
    const read = (path) =>
      existsSync(join(tree, path)) ? readFileSync(join(tree, path), "utf8") : null;
    const original = (path) => {
      const shown = git(tree, "show", `HEAD:${path}`);
      return shown.status === 0 ? shown.stdout : null;
    };
    const run = (command, commandArgs) =>
      spawnSync(command, commandArgs, {
        cwd: tree,
        encoding: "utf8",
        windowsHide: true,
        env: { ...process.env, CLAUDE_PROJECT_DIR: tree },
      });
    const verdict = task.grade({ changed, diff: fullDiff(tree, entries), run, read, original });
    if (verdict.pass) pass += 1;
    else fail += 1;
    const turns = seen.turns === null ? "" : `, ${seen.turns} turns`;
    const cost = seen.cost === null ? "" : `, $${seen.cost.toFixed(2)}`;
    const why = verdict.reasons.length ? `  ${verdict.reasons.join("; ")}` : "";
    console.log(
      `${verdict.pass ? "pass" : "fail"}  ${task.id.padEnd(7)}  ${changed.length} file(s)${turns}${cost}${why}`,
    );
    if (keep) console.log(`      kept ${tree}; remove it with: pnpm eval:tasks --clean`);
  } catch (error) {
    fatal = error;
  } finally {
    if (!keep) removeTree(tree);
  }
  if (fatal) break;
}
if (fatal) {
  console.error(fatal.message);
  process.exit(1);
}

console.log(
  `Task eval: ${rows.length} tasks, ${pass} pass, ${fail} fail (claude ${version}, model ${modelSeen ?? model ?? "default"}, commit ${head}, .claude and CLAUDE.md last changed in ${config})`,
);
process.exit(fail > 0 ? 1 : 0);
