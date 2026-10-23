// Shared helpers for the configuration tests: spawning a hook the way Claude Code does (the
// payload on stdin, the project directory in the environment, the verdict in the exit code) and
// reading the files the tests check. No test framework state lives here.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** A repository file as text, with LF line endings whatever the checkout wrote. */
export const read = (rel) => readFileSync(resolve(root, rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Runs a hook under .claude/hooks with a payload on stdin. RELEASE_APPROVAL is cleared from the
 * inherited environment so a developer's shell cannot change a verdict;
 * `env` adds what a case needs. Returns the exit status and both streams.
 */
export function runHook(hook, payload, { env = {}, projectDir = root } = {}) {
  const base = { ...process.env };
  // Windows environment names are case-insensitive, so every spelling is cleared.
  for (const name of Object.keys(base)) {
    if (/^release_approval$/i.test(name)) delete base[name];
  }
  const result = spawnSync(process.execPath, [resolve(root, ".claude/hooks", hook)], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    env: { ...base, CLAUDE_PROJECT_DIR: projectDir, ...env },
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  return { status: result.status, stderr: result.stderr ?? "", stdout: result.stdout ?? "" };
}

/** The payload Claude Code sends for a shell tool call. */
export const shell = (command, tool = "Bash") => ({ tool_name: tool, tool_input: { command } });

/** The frontmatter of a Markdown file as a flat object of strings, or null when there is none. */
export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

/** Every backticked token in a Markdown text, line breaks inside a token collapsed to a space. */
export const backticked = (text) =>
  [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\s*\n\s*/g, " "));
