// PreToolUse hook on Edit, Write, Bash, PowerShell and the GitHub file tools. During a fix task
// the agent may not weaken the check on the code it is fixing. Fix mode is on when the marker
// file .claude/FIX_TASK exists in the project (create it at the start of a bug-fix task) or when
// the environment sets CLAUDE_TASK_MODE=fix. An Edit, Write or GitHub file call is judged by its
// path. A shell command is judged segment by segment (split outside quotes, heredoc bodies
// kept): a segment is refused when it names a protected path (or the whole tree) and also
// carries a form that writes, moves or deletes: sed and perl in place, a redirect onto the path,
// tee, cp, mv, rm, dd, ln, truncate, git checkout, restore, rm, clean, mv, reset --hard, stash,
// apply and patch, a file write inside node -e, python -c, perl -e or a heredoc program, package
// rewrites through pnpm, prettier --write, the PowerShell file cmdlets, their aliases and
// [IO.File] writes, and any of those inside bash -c, eval, sudo, find -exec or xargs. A `cd` and a
// VAR=path earlier in the command line are carried into the later segments. Reading a protected
// file, or redirecting elsewhere, stays allowed. What the guard cannot see, it says so in
// CLAUDE.md: a script written elsewhere and run, or a patch file applied, carries its paths out
// of sight, and there the proof rests on review seeing the test diff, which the marker rule
// guarantees. The marker itself is protected and may be removed, on its own, only once gh finds
// an open, non-draft pull request for the current branch, so fix mode ends after the PR is
// opened. See the playbook's "Give Claude a feedback loop" and spec 002 section 6.
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
  /(^|\/)scripts\/(check-[^/]+|lighthouse|postbuild)\.mjs$/i,
  /(^|\/)src\/config\/pairings\.mjs$/i,
  /(^|\/)package\.json$/i,
  /(^|\/)tsconfig\.json$/i,
  /(^|\/)\.gitattributes$/i,
  /(^|\/)\.claude(\/hooks(\/|$)|\/settings(\.local)?\.json$|\/FIX_TASK$|$)/i,
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
      'is wrong, pin it with a test, then end fix mode and change it in a commit of its own, ' +
      'which the PR calls out. Fix mode ends when ' +
      '.claude/FIX_TASK is deleted on its own, which is allowed once gh finds an open, non-draft ' +
      'pull request for the branch.\n',
  );
  process.exit(2);
}

/** True when gh finds an open, non-draft pull request for the project's current branch. */
function branchHasPullRequest() {
  const run = (file, args, timeout) =>
    execFileSync(file, args, {
      cwd: root,
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      // Resolve git and gh on PATH only, never in the current directory.
      env: { ...process.env, NoDefaultCurrentDirectoryInExePath: '1' },
    });
  try {
    const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], 5000).trim();
    if (!branch || branch === 'HEAD') return false;
    const list = run(
      'gh',
      ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,isDraft'],
      15000,
    );
    return JSON.parse(list).some((pr) => !pr.isDraft);
  } catch {
    return false;
  }
}

const WRITING_COMMANDS =
  /^(tee|cp|mv|rm|del|erase|rd|rmdir|truncate|dd|ln|patch|Set-Content|sc|Add-Content|ac|Out-File|Remove-Item|ri|Move-Item|mi|Copy-Item|cpi|Clear-Content|clc|Rename-Item|rni|New-Item|ni)$/i;
// Shells and wrappers whose argument is a command line of its own.
const SHELLS = /^(bash|sh|zsh|dash|pwsh|powershell|cmd|eval|sudo|env|nohup|time)$/i;
// Interpreters whose argument is a program: judged by the write words in it.
const INTERPRETERS = /^(node|python|python3|perl|ruby)$/i;
const WRITE_WORDS =
  /\b(rm|del|erase|rd|rmdir|mv|cp|tee|dd|truncate|unlink|rename|writeFile|appendFile|createWriteStream|openSync|rmSync|rmdirSync|copyFile|Remove-Item|Set-Content|Add-Content|Out-File|Move-Item|Copy-Item|Clear-Content|Rename-Item|New-Item|write_text|write_bytes|shutil|os\.remove|WriteAll(Text|Lines|Bytes)|::(Delete|Move|Copy)|open\s*\([^)]*['"][wa][+b]?['"])|>/i;

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

/** Path-like pieces of a segment, split on whitespace and the characters that wrap a path. */
const piecesOf = (segment) => segment.split(/[\s"'`(),;=|]+/).filter(Boolean);

/**
 * Judges one segment in the context of a carried `cd` prefix. Returns null when it may run, or
 * the protected targets it writes to (an empty list meaning the whole tree) when it may not.
 */
function judge(segment, prefix) {
  const words = tokens(segment);
  const commandToken = commandWord(words);
  const command = bareCommand(commandToken);
  const rest = words.slice(words.indexOf(commandToken) + 1);
  const withPrefix = (p) =>
    prefix && !/^([A-Za-z]:)?\//.test(normalise(p)) ? `${prefix}/${p}` : p;
  const pieces = piecesOf(segment);
  const protectedPieces = pieces.filter((p) => isProtected(p) || isProtected(withPrefix(p)));
  const wholeTree = pieces.some((p) => WHOLE_TREE.test(p)) || (prefix && isProtected(prefix));
  const verdict = (writes) => {
    const redirected = redirectTargets(segment).map(withPrefix).filter(isProtected);
    if (redirected.length > 0) return [...new Set([...protectedPieces, ...redirected])];
    if (!writes) return null;
    if (wholeTree) return [];
    return protectedPieces.length > 0 ? protectedPieces : null;
  };

  if (SHELLS.test(command)) {
    // The wrapped text is a command line of its own.
    const inner = stripQuotes(rest.filter((w) => !/^-/.test(w)).join(' '));
    if (inner && inner !== segment) {
      for (const part of segments(inner)) {
        const v = judge(part, prefix);
        if (v) return v;
      }
      return verdict(false);
    }
    return verdict(false);
  }
  if (command === 'xargs') {
    // Its input is a pipe the guard cannot see, so a writing xargs reaches the whole tree.
    return WRITE_WORDS.test(segment) ? [] : null;
  }
  if (command === 'find') {
    const writes = rest.includes('-delete') || (rest.includes('-exec') && WRITE_WORDS.test(segment));
    return verdict(writes);
  }
  if (INTERPRETERS.test(command)) {
    const program =
      rest.some((w) => /^(-e|--eval|-p|--print|-c|-E)$/.test(w)) ||
      rest[0] === '-' ||
      /<</.test(segment);
    if (command === 'perl' && rest.some((w) => /^-[a-zA-Z]*i/.test(w))) return verdict(true);
    if (program) {
      if (!WRITE_WORDS.test(segment)) return verdict(false);
      return protectedPieces.length > 0 || wholeTree ? verdict(true) : [];
    }
    return verdict(false);
  }
  if (command === 'git') {
    const sub = rest[0] ?? '';
    if (/^(restore|rm|clean|mv|checkout)$/.test(sub)) return verdict(true);
    if (sub === 'apply') return [];
    if (sub === 'reset' && rest.includes('--hard')) return [];
    if (sub === 'stash' && !/^(list|show)$/.test(rest[1] ?? '')) return [];
    return verdict(false);
  }
  if (/^(pnpm|npm|yarn)$/.test(command)) {
    if (/^(add|remove|rm|uninstall|update|up|pkg|link)$/.test(rest[0] ?? '')) return ['package.json'];
    return verdict(false);
  }
  if (command === 'sed') return verdict(rest.some((w) => /^-[a-zA-Z]*i|^--in-place/.test(w)));
  if (command === 'prettier') return verdict(rest.some((w) => /^(--write|-w)$/.test(w)));
  if (command === 'patch') return [];
  if (/\[(System\.)?IO\.File\]::/i.test(segment)) {
    return WRITE_WORDS.test(segment) ? verdict(true) : verdict(false);
  }
  return verdict(WRITING_COMMANDS.test(command));
}

function inspectCommand(command) {
  let prefix = '';
  const variables = new Map();
  for (const raw of segments(command)) {
    // Carry a VAR=value assignment forward, so a path held in a variable is still seen.
    let segment = raw;
    for (const [name, value] of variables) {
      segment = segment.replace(new RegExp(`\\$\\{?${name}\\}?`, 'g'), value);
    }
    const words = tokens(segment);
    for (const w of words) {
      const m = /^([A-Za-z_]\w*)=(.+)$/.exec(w);
      if (m) variables.set(m[1], m[2]);
      else break;
    }
    if (bareCommand(commandWord(words)) === 'cd' && words[1]) {
      prefix = normalise(prefix ? `${prefix}/${words[1]}` : words[1]);
      continue;
    }
    const targets = judge(segment, prefix);
    if (targets === null) continue;
    const onlyTheMarker = targets.length > 0 && targets.every((t) => MARKER.test(normalise(t)));
    if (onlyTheMarker && branchHasPullRequest()) continue;
    const named = targets.length > 0 ? targets[0] : 'the whole tree';
    refuse(`"${raw}" writes to ${named}, a test or gate file`);
  }
}

try {
  const tool = String(input?.tool_name ?? '');
  if (tool === 'Bash' || tool === 'PowerShell') {
    inspectCommand(String(input?.tool_input?.command ?? ''));
  } else if (tool.startsWith('mcp__github__')) {
    // The GitHub file tools write to the branch without touching the tree.
    const paths = [
      input?.tool_input?.path,
      ...(Array.isArray(input?.tool_input?.files) ? input.tool_input.files.map((f) => f?.path) : []),
    ].filter(Boolean);
    const hit = paths.find((p) => isProtected(String(p)));
    if (hit) refuse(`${hit} is a test or gate file`);
  } else {
    const filePath = normalise(input?.tool_input?.file_path ?? '');
    if (filePath && isProtected(filePath)) refuse(`${filePath} is a test or gate file`);
  }
} catch (error) {
  // The guard fails closed on its own errors while fix mode is on.
  refuse(`the guard could not judge this call (${error?.message ?? error})`);
}

process.exit(0);
