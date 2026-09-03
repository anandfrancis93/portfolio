// PreToolUse hook on Edit, Write, Bash and PowerShell. During a fix task the agent may not weaken
// the check on the code it is fixing. Fix mode is on when the marker file .claude/FIX_TASK exists
// in the project (create it at the start of a bug-fix task) or when the environment sets
// CLAUDE_TASK_MODE=fix. An Edit or Write is judged by its path. A shell command is judged segment
// by segment: a segment is refused when it names a protected path and also carries a form that
// writes, moves or deletes (sed -i, a redirect onto the path, tee, cp, mv, rm, truncate, git
// restore and friends, node -e with a file write, the PowerShell file cmdlets). Reading a
// protected file, or redirecting elsewhere, stays allowed. The marker itself is protected and may
// be removed only once a pull request exists for the current branch, so fix mode ends after the
// PR is opened. See the playbook's "Give Claude a feedback loop" and spec 002 section 6.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { commandWord, segments, stripQuotes, tokens } from './lib/command.mjs';

// Always drain stdin first so the hook runner never sees a closed pipe.
let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, ''));
} catch {
  process.exit(0);
}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const fixMode =
  process.env.CLAUDE_TASK_MODE === 'fix' || existsSync(resolve(root, '.claude', 'FIX_TASK'));
if (!fixMode) process.exit(0);

// Tests; every file that decides what the tests and gates check; and the files that decide what
// this hook, the definition of done and the review policy are.
const PROTECTED = [
  /(^|\/)tests\//,
  /\.(spec|test)\.[cm]?[jt]sx?$/,
  /(^|\/)playwright\.config\.[cm]?[jt]s$/,
  /(^|\/)stylelint\.config\.[cm]?js$/,
  /(^|\/)\.htmlvalidate\.json$/,
  /(^|\/)lighthouserc[^/]*\.[cm]?js$/,
  /(^|\/)\.github\/workflows\//,
  /(^|\/)\.github\/expiry\.json$/,
  /(^|\/)scripts\/check-[^/]+\.mjs$/,
  /(^|\/)src\/config\/pairings\.mjs$/,
  /(^|\/)package\.json$/,
  /(^|\/)\.claude\/hooks\//,
  /(^|\/)\.claude\/settings\.json$/,
  /(^|\/)REVIEW\.md$/,
  /(^|\/)\.claude\/FIX_TASK$/,
];
const MARKER = /(^|\/)\.claude\/FIX_TASK$/;

const normalise = (path) => String(path).replace(/\\/g, '/');
const isProtected = (path) => PROTECTED.some((re) => re.test(normalise(path)));

function refuse(what) {
  process.stderr.write(
    `Blocked: ${what} and this is a fix task. Fix the code, not the check. If the check itself ` +
      'is wrong, say so and stop; a human changes it in a separate change. Fix mode ends when ' +
      '.claude/FIX_TASK is deleted, which is allowed once a pull request exists for the branch.\n',
  );
  process.exit(2);
}

/** True when an open pull request exists for the current branch of the project. */
function branchHasPullRequest() {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const list = execFileSync(
      'gh',
      ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number'],
      { cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return JSON.parse(list).length > 0;
  } catch {
    return false;
  }
}

const WRITING_COMMANDS =
  /^(tee|cp|mv|rm|del|rmdir|truncate|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|Clear-Content)$/i;

/** The forms in a segment that write, move or delete, and whether they aim at a protected path. */
function segmentWrites(segment, protectedPieces) {
  const words = tokens(segment);
  const command = commandWord(words);
  let writes = false;
  if (command === 'sed' && words.some((w) => /^(-i|--in-place)/.test(w))) writes = true;
  if (WRITING_COMMANDS.test(command)) writes = true;
  if (command === 'git' && /^(restore|rm|clean)$/.test(words[1] ?? '')) writes = true;
  if (command === 'git' && words[1] === 'checkout' && words.includes('--')) writes = true;
  if (
    command === 'node' &&
    words.some((w) => /^(-e|--eval|-p|--print)$/.test(w)) &&
    /writeFile|appendFile|rmSync|unlink|rename|copyFile|truncate/.test(segment)
  ) {
    writes = true;
  }
  // A redirect writes only where it points, so reading a protected file into /tmp stays allowed.
  for (const m of segment.matchAll(/(?:^|\s)\d?>{1,2}\s*("[^"]*"|'[^']*'|\S+)/g)) {
    if (isProtected(stripQuotes(m[1]))) return true;
  }
  return writes && protectedPieces.length > 0;
}

function inspectCommand(command) {
  for (const segment of segments(command)) {
    // Path-like pieces: split on whitespace and on the characters that wrap a path in a script,
    // so a path inside quotes or a function call is seen too.
    const pieces = segment.split(/[\s"'`(),;=]+/).filter(Boolean);
    const protectedPieces = pieces.filter(isProtected);
    if (!segmentWrites(segment, protectedPieces)) continue;
    const target = protectedPieces.find((p) => p) ?? 'a protected path';
    if (MARKER.test(normalise(target)) && branchHasPullRequest()) continue;
    refuse(`"${segment}" writes to ${target}, a test or gate file`);
  }
}

const tool = String(input?.tool_name ?? '');
if (tool === 'Bash' || tool === 'PowerShell') {
  inspectCommand(String(input?.tool_input?.command ?? ''));
} else {
  const filePath = normalise(input?.tool_input?.file_path ?? '');
  if (filePath && isProtected(filePath)) refuse(`${filePath} is a test or gate file`);
}

process.exit(0);
