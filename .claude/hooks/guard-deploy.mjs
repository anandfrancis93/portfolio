// PreToolUse hook on Bash and PowerShell. Anything that mutates the production Worker needs a
// named release authorization. Exit 2 blocks the command and sends the message to Claude.
// See docs/sdlc/001-portfolio-v1/plan.md phase A and the playbook's "Hooks as approval gates".
//
// The command is split into shell segments and each segment is inspected on its own, so a
// preview flag in one segment cannot excuse a production command in another.
import { readFileSync } from 'node:fs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, ''));
} catch {
  process.exit(0);
}

const command = String(input?.tool_input?.command ?? '');
if (!command.trim()) process.exit(0);

// Subcommands that change what production serves or can serve.
const MUTATING = new Set(['deploy', 'rollback', 'delete']);
const MUTATING_PAIRS = new Set([
  'versions deploy',
  'triggers deploy',
  'secret put',
  'secret delete',
  'secret bulk',
]);

const stripQuotes = (t) => t.replace(/^["']+|["']+$/g, '');

function inspectSegment(segment) {
  const tokens = segment.split(/\s+/).filter(Boolean).map(stripQuotes);
  if (tokens.length === 0) return null;

  const approvedInline = tokens.some((t) => /^RELEASE_APPROVAL=.+/.test(t));

  // Environment: --env X, --env=X, -e X, -e=X. The value token is skipped when reading words.
  let env = null;
  const skip = new Set();
  tokens.forEach((t, i) => {
    const m = /^(?:--env|-e)=(.+)$/.exec(t);
    if (m) env = m[1];
    else if (t === '--env' || t === '-e') {
      env = tokens[i + 1] ?? null;
      skip.add(i + 1);
    }
  });

  let mutating = false;

  const wi = tokens.findIndex((t) => /(^|[\\/])wrangler(\.exe|\.cmd)?$/i.test(t));
  if (wi >= 0) {
    const words = tokens.slice(wi + 1).filter((t, i) => !t.startsWith('-') && !skip.has(wi + 1 + i));
    mutating = MUTATING.has(words[0]) || MUTATING_PAIRS.has(`${words[0]} ${words[1]}`);
  }

  // The repo's own deploy script, when run (reading it with cat or grep is not a deploy), and
  // its npm alias.
  const di = tokens.findIndex((t) => /(^|[\\/])deploy\.mjs$/.test(t));
  if (di > 0 && /(^|[\\/])node(\.exe)?$/i.test(tokens[di - 1])) mutating = true;
  if (tokens.includes('deploy:production')) {
    mutating = true;
    env = env ?? 'production';
  }

  if (!mutating) return null;
  if (env === 'preview') return null;
  if (approvedInline) return null;
  return segment.trim();
}

const segments = command.split(/\r?\n|&&|\|\||;|\|/);
const offending = segments.map(inspectSegment).filter(Boolean);

if (offending.length > 0 && !process.env.RELEASE_APPROVAL) {
  process.stderr.write(
    'Blocked: this command changes the production Worker and no release authorization is set.\n' +
      offending.map((s) => `  ${s}`).join('\n') +
      '\nSet RELEASE_APPROVAL to the approval reference (for example the release ticket or the ' +
      'approving message) before running it. Preview commands (--env preview or -e preview) are ' +
      'always allowed, and so is `wrangler versions upload`.\n',
  );
  process.exit(2);
}

process.exit(0);
