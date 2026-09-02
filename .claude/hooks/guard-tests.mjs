// PreToolUse hook on Edit and Write. During a fix task the agent may not weaken the check on
// the code it is fixing. Fix mode is on when the marker file .claude/FIX_TASK exists in the
// project (create it at the start of a bug-fix task, delete it when done) or when the
// environment sets CLAUDE_TASK_MODE=fix. See the playbook's "Give Claude a feedback loop".
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const filePath = String(input?.tool_input?.file_path ?? '').replace(/\\/g, '/');

// Tests, and every file that decides what the tests and gates check.
const PROTECTED = [
  /(^|\/)tests\//,
  /\.(spec|test)\.[cm]?[jt]sx?$/,
  /(^|\/)playwright\.config\.[cm]?[jt]s$/,
  /(^|\/)stylelint\.config\.[cm]?js$/,
  /(^|\/)\.htmlvalidate\.json$/,
  /(^|\/)lighthouserc[^/]*\.[cm]?js$/,
  /(^|\/)\.github\/workflows\//,
  /(^|\/)scripts\/check-[^/]+\.mjs$/,
  /(^|\/)src\/config\/pairings\.mjs$/,
];

if (PROTECTED.some((re) => re.test(filePath))) {
  process.stderr.write(
    `Blocked: ${filePath} is a test or gate file and this is a fix task. Fix the code, not the ` +
      'check. If the check itself is wrong, say so and stop; a human changes it in a separate ' +
      'change. Fix mode ends when .claude/FIX_TASK is deleted.\n',
  );
  process.exit(2);
}

process.exit(0);
