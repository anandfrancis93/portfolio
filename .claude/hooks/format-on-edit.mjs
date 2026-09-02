// PostToolUse hook on Edit and Write. Formats the touched file with Prettier and lints CSS and
// Astro files with stylelint so drift never accumulates. Prettier's own ignore file decides
// what is skipped, so the hook and `pnpm lint` agree. Tools are run through the current Node
// binary and their JavaScript entry points, never a shell, so paths with spaces are safe.
// Exit 2 reports the problem to Claude; a tool that cannot run is reported, not hidden.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, relative, resolve } from 'node:path';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, ''));
} catch {
  process.exit(0);
}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const filePath = String(input?.tool_input?.file_path ?? '');
if (!filePath) process.exit(0);

const abs = resolve(filePath);
const rel = relative(root, abs).replace(/\\/g, '/');
if (rel.startsWith('..') || rel.startsWith('node_modules/') || rel.startsWith('dist/')) {
  process.exit(0);
}
if (!existsSync(abs)) process.exit(0);

const ext = extname(abs).toLowerCase();
const BINARY = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.pdf',
]);
if (BINARY.has(ext)) process.exit(0);

const prettierEntry = resolve(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
const stylelintEntry = resolve(root, 'node_modules', 'stylelint', 'bin', 'stylelint.mjs');
// Dependencies not installed yet: nothing to run.
if (!existsSync(prettierEntry)) process.exit(0);

const run = (entry, args) =>
  spawnSync(process.execPath, [entry, ...args], { cwd: root, encoding: 'utf8', windowsHide: true });

const describe = (result) =>
  [result.error?.message, result.stderr, result.stdout].filter(Boolean).join('\n').trim();

const fmt = run(prettierEntry, ['--write', '--ignore-unknown', '--log-level', 'warn', abs]);
if (fmt.error || fmt.status !== 0) {
  process.stderr.write(`Prettier could not format ${rel}:\n${describe(fmt)}\n`);
  process.exit(2);
}

if ((ext === '.css' || ext === '.astro') && existsSync(stylelintEntry)) {
  const lint = run(stylelintEntry, [abs, '--formatter', 'compact', '--allow-empty-input']);
  if (lint.error || lint.status === null || (lint.status !== 0 && lint.status !== 2)) {
    process.stderr.write(
      `stylelint could not run on ${rel} (exit ${lint.status ?? 'none'}):\n${describe(lint)}\n`,
    );
    process.exit(2);
  }
  if (lint.status === 2) {
    process.stderr.write(`stylelint findings in ${rel}:\n${describe(lint)}\n`);
    process.exit(2);
  }
}

process.exit(0);
