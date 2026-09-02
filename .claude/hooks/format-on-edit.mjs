// PostToolUse hook on Edit and Write. Formats the touched file with Prettier and lints CSS
// with stylelint so drift never accumulates. Scoped to source, scripts, tests and root
// config; skipped when dependencies are not installed yet.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, extname, relative } from 'node:path';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const filePath = String(input?.tool_input?.file_path ?? '');
if (!filePath) process.exit(0);

const abs = resolve(filePath);
const rel = relative(root, abs).replace(/\\/g, '/');
if (rel.startsWith('..')) process.exit(0);

const inScope =
  /^(src|scripts|tests|\.github)\//.test(rel) ||
  (!rel.includes('/') && /\.(json|mjs|cjs|js|ts|yml|yaml)$/.test(rel));
if (!inScope) process.exit(0);

const prettierBin = resolve(root, 'node_modules/.bin/prettier');
const stylelintBin = resolve(root, 'node_modules/.bin/stylelint');
if (!existsSync(prettierBin)) process.exit(0);

const run = (bin, args) =>
  spawnSync(process.platform === 'win32' ? `${bin}.cmd` : bin, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

const fmt = run(prettierBin, ['--write', '--log-level', 'warn', abs]);
if (fmt.status !== 0 && fmt.stderr) process.stderr.write(fmt.stderr);

if (extname(abs) === '.css' && existsSync(stylelintBin)) {
  const lint = run(stylelintBin, [abs, '--formatter', 'compact']);
  if (lint.status !== 0) {
    process.stderr.write(`stylelint findings in ${rel}:\n${lint.stdout}${lint.stderr}`);
    process.exit(2);
  }
}

process.exit(0);
