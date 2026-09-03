// PreToolUse hook on Edit, Write, Bash and PowerShell. During a fix task the agent may not weaken
// the check on the code it is fixing. Fix mode is on when the marker file .claude/FIX_TASK exists
// in the project (create it at the start of a bug-fix task) or when the environment sets
// CLAUDE_TASK_MODE=fix. An Edit or Write is judged by its path. A shell command is judged segment
// by segment: a segment is refused when it names a protected path (or the whole tree) and also
// carries a form that writes, moves or deletes (sed -i, a redirect onto the path, tee, cp, mv,
// rm, truncate, git checkout, restore, rm, clean, mv, reset --hard and stash, node -e with a file
// write, package.json rewrites through pnpm, prettier --write, the PowerShell file cmdlets and
// their aliases, and any of those wrapped in bash -c, eval, xargs, find or sudo). A `cd` earlier
// in the command line is carried into the later segments. Reading a protected file, or
// redirecting elsewhere, stays allowed. The marker itself is protected and may be removed, on its
// own, only once an open pull request exists for the current branch, so fix mode ends after the
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
// this hook, the definition of done and the review policy are. A directory matches with or
// without its trailing slash, and matching ignores case, since the Windows file system does.
const PROTECTED = [
  /(^|\/)tests(\/|$)/i,
  /\.(spec|test)\.[cm]?[jt]sx?$/i,
  /(^|\/)playwright\.config\.[cm]?[jt]s$/i,
  /(^|\/)stylelint\.config\.[cm]?js$/i,
  /(^|\/)\.htmlvalidate\.json$/i,
  /(^|\/)lighthouserc[^/]*\.[cm]?js$/i,
  /(^|\/)\.github(\/workflows(\/|$)|\/expiry\.json$|$)/i,
  /(^|\/)scripts\/check-[^/]+\.mjs$/i,
  /(^|\/)src\/config\/pairings\.mjs$/i,
  /(^|\/)package\.json$/i,
  /(^|\/)\.claude(\/hooks(\/|$)|\/settings\.json$|\/FIX_TASK$|$)/i,
  /(^|\/)REVIEW\.md$/i,
];
const MARKER = /(^|\/)\.claude\/FIX_TASK$/i;
// Targets that stand for the whole tree, so a destructive command on them reaches the fence.
const WHOLE_TREE = /^(\.|\.\/|\.\.|\*|\.\/\*|\/|~|\$PWD|\$\(pwd\))$/;

const normalise = (path) =>
  String(path)
    .replace(/\\/g, '/')
    .replace(/\/\.(?=\/)/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/^\.\//, '');
const isProtected = (path) => PROTECTED.some((re) => re.test(normalise(path)));

function refuse(what) {
  process.stderr.write(
    `Blocked: ${what} and this is a fix task. Fix the code, not the check. If the check itself ` +
      'is wrong, say so and stop; a human changes it in a separate change. Fix mode ends when ' +
      '.claude/FIX_TASK is deleted on its own, which is allowed once gh finds an open pull ' +
      'request for the branch.\n',
  );
  process.exit(2);
}

/** True when gh finds an open pull request for the project's current branch; false otherwise. */
function branchHasPullRequest() {
  const run = (file, args, timeout) =>
    execFileSync(file, args, {
      cwd: root,
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  try {
    const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], 5000).trim();
    if (!branch || branch === 'HEAD') return false;
    const list = run('gh', ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number'], 15000);
    return JSON.parse(list).length > 0;
  } catch {
    return false;
  }
}

const WRITING_COMMANDS =
  /^(tee|cp|mv|rm|del|erase|rd|rmdir|truncate|Set-Content|sc|Add-Content|ac|Out-File|Remove-Item|ri|Move-Item|mi|Copy-Item|cpi|Clear-Content|clc|Rename-Item|rni|New-Item|ni)$/i;
// Interpreters and wrappers that run whatever follows: the inner text is judged as its own segment.
const WRAPPERS = /^(bash|sh|zsh|dash|pwsh|powershell|cmd|eval|xargs|find|sudo|env|nohup|time|python|python3|perl|ruby|node)$/i;
const WRITE_WORDS =
  /\b(rm|del|erase|rd|rmdir|mv|cp|tee|truncate|unlink|rename|writeFile|appendFile|createWriteStream|openSync|rmSync|rmdirSync|copyFile|Remove-Item|Set-Content|Add-Content|Out-File|Move-Item|Copy-Item|Clear-Content|Rename-Item|New-Item|-delete|-exec|write_text|write_bytes|shutil|os\.remove|open\s*\([^)]*['"][wa][+b]?['"]|>)/i;

/** The command word without a path prefix or a leading backslash, so /bin/rm and \rm are rm. */
const bareCommand = (word) => word.replace(/^.*[\\/]/, '').replace(/^\\/, '');

/** The targets a redirect in the segment points at, quotes stripped. */
function redirectTargets(segment) {
  const targets = [];
  for (const m of segment.matchAll(/(?:^|[^<])(?:\d?>{1,2}|&>|>\|)\s*("[^"]*"|'[^']*'|\S+)/g)) {
    targets.push(stripQuotes(m[1]));
  }
  return targets;
}

/**
 * Judges one segment. Returns null when it may run, or the protected targets it writes to (an
 * empty list meaning the whole tree) when it may not.
 */
function judge(segment, prefix) {
  const words = tokens(segment);
  const command = bareCommand(commandWord(words));
  const rest = words.slice(words.indexOf(commandWord(words)) + 1);
  // Path-like pieces: split on whitespace and on the characters that wrap a path in a script,
  // so a path inside quotes or a function call is seen too; a carried `cd` prefixes each piece.
  const pieces = segment.split(/[\s"'`(),;=|]+/).filter(Boolean);
  const withPrefix = (p) => (prefix && !/^([A-Za-z]:)?\//.test(normalise(p)) ? `${prefix}/${p}` : p);
  const protectedPieces = pieces.filter((p) => isProtected(p) || isProtected(withPrefix(p)));
  const wholeTree = pieces.some((p) => WHOLE_TREE.test(p)) || (prefix && isProtected(prefix));

  let writes = false;
  if (command === 'sed' && words.some((w) => /^-[a-zA-Z]*i|^--in-place/.test(w))) writes = true;
  if (WRITING_COMMANDS.test(command)) writes = true;
  if (command === 'git') {
    const sub = rest[0] ?? '';
    if (/^(restore|rm|clean|mv|checkout)$/.test(sub)) writes = true;
    if (sub === 'reset' && rest.includes('--hard')) return [];
    if (sub === 'stash' && !/^(list|show)$/.test(rest[1] ?? '')) return [];
  }
  if (command === 'node' && rest.some((w) => /^(-e|--eval|-p|--print)$/.test(w))) {
    if (WRITE_WORDS.test(segment)) writes = true;
  } else if (WRAPPERS.test(command)) {
    // The wrapped text is judged as a segment of its own; a wrapper carrying any write word
    // with no visible target is taken to reach the whole tree.
    const inner = stripQuotes(rest.filter((w) => !/^-/.test(w)).join(' '));
    if (inner && inner !== segment) {
      const verdict = judge(inner, prefix);
      if (verdict) return verdict;
    }
    if (WRITE_WORDS.test(segment)) return protectedPieces.length > 0 ? protectedPieces : [];
  }
  if (/^(pnpm|npm|yarn)$/.test(command) && /^(add|remove|rm|uninstall|update|up|pkg|link)$/.test(rest[0] ?? '')) {
    return ['package.json'];
  }
  if (command === 'prettier' && rest.some((w) => /^(--write|-w)$/.test(w))) writes = true;

  const redirected = redirectTargets(segment).map(withPrefix).filter(isProtected);
  if (redirected.length > 0) return [...new Set([...protectedPieces, ...redirected])];
  if (!writes) return null;
  if (wholeTree) return [];
  return protectedPieces.length > 0 ? protectedPieces : null;
}

function inspectCommand(command) {
  let prefix = '';
  for (const segment of segments(command)) {
    const words = tokens(segment);
    if (bareCommand(commandWord(words)) === 'cd' && words[1]) {
      prefix = normalise(prefix ? `${prefix}/${words[1]}` : words[1]);
      continue;
    }
    const targets = judge(segment, prefix);
    if (targets === null) continue;
    const onlyTheMarker = targets.length > 0 && targets.every((t) => MARKER.test(normalise(t)));
    if (onlyTheMarker && branchHasPullRequest()) continue;
    const named = targets.length > 0 ? targets[0] : 'the whole tree';
    refuse(`"${segment}" writes to ${named}, a test or gate file`);
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
