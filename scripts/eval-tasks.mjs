// The task eval (the runbook, "Task evals"), run by hand after a change under .claude/ or to
// the model: gives headless Claude Code three pieces of real work, each in a throwaway worktree
// of the current commit outside the repository, and grades what it did with the graders in
// scripts/lib/eval-tasks.mjs. The skill eval proves a skill loads; this proves the work that
// follows holds to the skills, the hooks and CLAUDE.md. Draws on the developer's own
// subscription; not part of check or verify, and an agent never launches it.
//   pnpm eval:tasks                  every task
//   pnpm eval:tasks --only fix       one task
//   pnpm eval:tasks --model sonnet   a different model
//   pnpm eval:tasks --keep           leave the worktrees in place, their paths printed
//   pnpm eval:tasks --dry-run        everything but the session: the worktrees, the seed, the
//                                    graders and the cleanup, so the plumbing is proven for free
// Prints the CLI version, the model and the commit, one line per task, then
// "Task eval: N tasks, N pass, N fail", and exits 1 on any fail.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TASKS } from "./lib/eval-tasks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : null;
};
const model = option("--model");
const only = option("--only");
const keep = args.includes("--keep");
const dryRun = args.includes("--dry-run");

const git = (cwd, ...rest) => spawnSync("git", rest, { cwd, encoding: "utf8", windowsHide: true });
const claude = (rest, options = {}) =>
  spawnSync("claude", rest, { encoding: "utf8", windowsHide: true, ...options });

// What the agent may do: read, edit, load a skill, run node and the checks, look at the diff.
// The hooks in the worktree's .claude/settings.json apply as they do in a session, the test
// guard included, so a fix task is refused the same edits.
const ALLOWED = [
  "Read",
  "Glob",
  "Grep",
  "Edit",
  "Write",
  "MultiEdit",
  "Skill",
  "Bash(node:*)",
  "Bash(pnpm test:config)",
  "Bash(pnpm check:*)",
  "Bash(pnpm exec stylelint:*)",
  "Bash(git diff:*)",
  "Bash(git status:*)",
].join(",");
const DISALLOWED = "WebFetch,WebSearch,Agent,NotebookEdit,PowerShell";

/** A worktree of HEAD outside the repository, sharing this checkout's node_modules by a link. */
function makeWorktree() {
  const dir = mkdtempSync(join(tmpdir(), "portfolio-eval-"));
  const tree = join(dir, "tree");
  const added = git(root, "worktree", "add", "--detach", tree, "HEAD");
  if (added.status !== 0) throw new Error(`git worktree add failed:\n${added.stderr}`);
  symlinkSync(resolve(root, "node_modules"), join(tree, "node_modules"), "junction");
  return { dir, tree };
}

function removeWorktree({ dir, tree }) {
  // The link first, on its own, so nothing under node_modules is ever walked.
  unlinkSync(join(tree, "node_modules"));
  git(root, "worktree", "remove", "--force", tree);
  rmSync(dir, { recursive: true, force: true });
}

/** Runs one task's prompt in its worktree and returns what the session reported about itself. */
function runTask(task, tree) {
  if (dryRun) return { model: "none (dry run)", turns: 0, cost: null, error: false };
  const cli = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
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
  if (result.error) {
    console.error(`Could not run claude for "${task.id}": ${result.error.message}`);
    process.exit(1);
  }
  const seen = { model: null, turns: null, cost: null, error: result.status !== 0 };
  for (const line of (result.stdout ?? "").split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event?.type === "system" && event?.subtype === "init") seen.model = event.model ?? null;
    if (event?.type === "result") {
      seen.turns = event.num_turns ?? null;
      seen.cost = event.total_cost_usd ?? null;
      if (event.is_error) seen.error = true;
    }
  }
  if (seen.error && seen.turns === null) {
    const tail = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim().split(/\r?\n/).slice(-5);
    console.error(`claude exited ${result.status} on "${task.id}":\n${tail.join("\n")}`);
  }
  return seen;
}

/** Every path the session changed or created, the fix-mode marker excluded. */
function changedPaths(tree) {
  const status = git(tree, "status", "--porcelain", "--untracked-files=all").stdout ?? "";
  return status
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) =>
      line
        .slice(3)
        .replace(/^.* -> /, "")
        .replace(/\\/g, "/"),
    )
    .filter((path) => path !== ".claude/FIX_TASK");
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
if ((git(root, "status", "--porcelain").stdout ?? "").trim()) {
  console.error(
    "The working tree has changes; commit or stash them, since the worktrees copy HEAD.",
  );
  process.exit(1);
}

let pass = 0;
let fail = 0;
let modelSeen = null;
for (const task of rows) {
  const worktree = makeWorktree();
  const { tree } = worktree;
  try {
    if (task.seed) task.seed(tree);
    if (task.fixMode) writeFileSync(join(tree, ".claude", "FIX_TASK"), "");
    const seen = runTask(task, tree);
    modelSeen ??= seen.model;
    const changed = changedPaths(tree);
    const diff = git(tree, "diff").stdout ?? "";
    const run = (command, commandArgs) =>
      spawnSync(command, commandArgs, {
        cwd: tree,
        encoding: "utf8",
        windowsHide: true,
        env: { ...process.env, CLAUDE_PROJECT_DIR: tree },
      });
    const verdict = task.grade({ changed, diff, run });
    if (verdict.pass) pass += 1;
    else fail += 1;
    const turns = seen.turns === null ? "" : `, ${seen.turns} turns`;
    const cost = seen.cost === null ? "" : `, $${seen.cost.toFixed(2)}`;
    const why = verdict.reasons.length ? `  ${verdict.reasons.join("; ")}` : "";
    console.log(
      `${verdict.pass ? "pass" : "fail"}  ${task.id.padEnd(7)}  ${changed.length} file(s)${turns}${cost}${why}`,
    );
    if (keep) console.log(`      kept ${tree}`);
  } finally {
    if (!keep) removeWorktree(worktree);
  }
}

console.log(
  `Task eval: ${rows.length} tasks, ${pass} pass, ${fail} fail (claude ${version}, model ${modelSeen ?? model ?? "default"}, commit ${head}, .claude and CLAUDE.md last changed in ${config})`,
);
process.exit(fail > 0 ? 1 : 0);
